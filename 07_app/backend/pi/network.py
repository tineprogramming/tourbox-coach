"""nmcli wrappers for the Pi Dashboard.

We shell out to `nmcli` because it's already the system's network manager
on Trixie. The API surface is intentionally tiny: scan SSIDs, connect to one,
read the AP config, update the AP SSID/password.

Run as the tourbox user (which has NOPASSWD sudo from install). Where we
need state changes we go through `sudo`.
"""

from __future__ import annotations

import asyncio
import shlex
import time
from typing import Any

AP_CONNECTION = "tourbox-ap"

# Reading the AP's WPA2 password requires `sudo nmcli -s` which forks a
# process; the dashboard Basic-Auth middleware reads it on every request, so
# cache for a minute. Invalidated when `update_ap` runs.
_AP_SECRETS_CACHE: dict[str, Any] = {"checked_at": 0.0, "ssid": None, "password": None}
_AP_SECRETS_TTL_S = 60.0


class NmcliError(RuntimeError):
    pass


async def _run(cmd: list[str], check: bool = True) -> tuple[int, str, str]:
    """Run a subprocess; return (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    out = stdout.decode("utf-8", errors="replace").strip()
    err = stderr.decode("utf-8", errors="replace").strip()
    if check and proc.returncode != 0:
        raise NmcliError(f"command failed ({proc.returncode}): {shlex.join(cmd)}\n{err}")
    return proc.returncode or 0, out, err


async def device_status() -> list[dict[str, str]]:
    """`nmcli device status` parsed."""
    _, out, _ = await _run(["nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"])
    devices = []
    for line in out.splitlines():
        # nmcli's terse format escapes : with \: ; for our purposes simple split is fine
        # because device/type/state/connection don't contain colons in practice.
        parts = line.split(":", 3)
        if len(parts) == 4:
            d, t, s, c = parts
            devices.append({"device": d, "type": t, "state": s, "connection": c})
    return devices


async def active_sta() -> dict[str, Any] | None:
    """Return info on the active STA (wlan0 client connection) or None."""
    for d in await device_status():
        if d["device"] == "wlan0" and d["state"].startswith("connected"):
            # Pull the SSID via iw because nmcli's "show" needs the connection
            # id and may not match upstream-switched names.
            _, ssid_out, _ = await _run(["/usr/sbin/iw", "dev", "wlan0", "link"], check=False)
            ssid = None
            for line in ssid_out.splitlines():
                line = line.strip()
                if line.startswith("SSID:"):
                    ssid = line[5:].strip()
            _, ip_out, _ = await _run(["ip", "-4", "-o", "addr", "show", "wlan0"], check=False)
            ip = None
            for tok in ip_out.split():
                if "/" in tok and "." in tok and tok.count(".") == 3:
                    ip = tok.split("/")[0]
                    break
            return {"connection": d["connection"], "ssid": ssid, "ip": ip}
    return None


async def ap_secrets(force: bool = False) -> dict[str, Any]:
    """Return the AP's SSID + WPA2 password from nmcli (cached).

    Requires `sudo` because nmcli only exposes secrets to the owner of the
    connection (here: root, since we created it via sudo).
    """
    if not force and time.time() - float(_AP_SECRETS_CACHE["checked_at"]) < _AP_SECRETS_TTL_S:
        return {"ssid": _AP_SECRETS_CACHE["ssid"], "password": _AP_SECRETS_CACHE["password"]}

    rc, out, _ = await _run(
        ["sudo", "nmcli", "-s", "-t", "-f",
         "802-11-wireless.ssid,802-11-wireless-security.psk", "connection", "show", AP_CONNECTION],
        check=False,
    )
    ssid: str | None = None
    password: str | None = None
    if rc == 0:
        for line in out.splitlines():
            if line.startswith("802-11-wireless.ssid:"):
                ssid = line.split(":", 1)[1] or None
            elif line.startswith("802-11-wireless-security.psk:"):
                password = line.split(":", 1)[1] or None

    _AP_SECRETS_CACHE.update({
        "checked_at": time.time(),
        "ssid": ssid,
        "password": password,
    })
    return {"ssid": ssid, "password": password}


def _invalidate_ap_secrets() -> None:
    _AP_SECRETS_CACHE["checked_at"] = 0.0


async def ap_status() -> dict[str, Any]:
    """Return current AP connection details (SSID + IP + active state). Password
    is never returned over the wire."""
    rc, out, _ = await _run(["nmcli", "-t", "-f", "GENERAL.STATE,802-11-wireless.ssid,IP4.ADDRESS",
                              "connection", "show", AP_CONNECTION], check=False)
    if rc != 0:
        return {"active": False, "ssid": None, "ip": None}
    info: dict[str, str] = {}
    for line in out.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            info[k.strip()] = v.strip()
    ssid = info.get("802-11-wireless.ssid") or None
    state = info.get("GENERAL.STATE") or ""
    ip = info.get("IP4.ADDRESS[1]") or info.get("IP4.ADDRESS") or None
    if ip and "/" in ip:
        ip = ip.split("/")[0]
    return {
        "active": "activated" in state.lower(),
        "ssid": ssid,
        "ip": ip,
    }


async def scan_wifi() -> list[dict[str, Any]]:
    """Trigger a wifi scan and return seen SSIDs (deduplicated, sorted by signal).

    Notes:
    - `nmcli device wifi rescan` is polkit-protected; needs sudo (NOPASSWD
      configured in /etc/sudoers.d/) — otherwise we get "not authorized".
    - nmcli's `IN-USE` column is unreliable when called from a non-TTY
      systemd subprocess: it sometimes omits the asterisk even for the
      currently-connected network. We cross-reference against the STA's
      active SSID (from `iw dev wlan0 link`) to mark it ourselves.
    """
    await _run(["sudo", "nmcli", "device", "wifi", "rescan"], check=False)
    # Scan is async; results trickle in over ~3-5s as the radio hops channels.
    await asyncio.sleep(4.0)

    # Pull the active SSID independently so we can reliably flag in_use.
    active_ssid = None
    _, link_out, _ = await _run(["/usr/sbin/iw", "dev", "wlan0", "link"], check=False)
    for line in link_out.splitlines():
        s = line.strip()
        if s.startswith("SSID:"):
            active_ssid = s[5:].strip()
            break

    _, out, _ = await _run(["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY,FREQ", "device", "wifi", "list"])
    seen: dict[str, dict[str, Any]] = {}
    for line in out.splitlines():
        # nmcli -t output: SSID:SIGNAL:SECURITY:FREQ. SSID may itself contain
        # ":" escaped as "\:"; rejoin from the right to recover.
        parts = line.split(":")
        if len(parts) < 4:
            continue
        ssid = ":".join(parts[:-3]).replace("\\:", ":")
        signal = parts[-3]
        security = parts[-2]
        freq = parts[-1]
        if not ssid or ssid == "--":
            continue
        try:
            sig = int(signal)
        except ValueError:
            sig = 0
        import re as _re; _fm = _re.search(r'\d+', freq); freq_mhz = int(_fm.group()) if _fm else 0
        band = "5GHz" if freq_mhz >= 5000 else "2.4GHz"
        prev = seen.get(ssid)
        if prev is None or sig > prev["signal"]:
            seen[ssid] = {
                "ssid": ssid,
                "signal": sig,
                "security": security or "open",
                "frequency": freq_mhz,
                "band": band,
                # Warn: if user switches to a 5GHz network, the AP will also
                # move to 5GHz (BCM43455 #channels <= 1), which breaks 2.4GHz
                # clients. Let the frontend surface this as a warning.
                "ap_channel_warning": band == "5GHz",
                "in_use": ssid == active_ssid,
                "is_self_ap": ssid.lower() == "tourbox-coach",
            }
    items = [s for s in seen.values() if not s["is_self_ap"]]
    items.sort(key=lambda s: (not s["in_use"], -s["signal"]))
    return items


async def _wait_for_ip(iface: str = "wlan0", timeout_s: int = 30) -> str | None:
    """Poll until wlan0 has an IPv4 address. Returns IP or None on timeout."""
    import asyncio
    for _ in range(timeout_s):
        await asyncio.sleep(1)
        _, out, _ = await _run(["ip", "-4", "-o", "addr", "show", iface], check=False)
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 4 and parts[2] == "inet":
                return parts[3].split("/")[0]
    return None


async def connect_wifi(ssid: str, password: str | None) -> dict[str, Any]:
    """Connect wlan0 to a given SSID. Waits for a real DHCP lease before
    returning so the caller always gets a meaningful `ip` field.

    Returns dict with `connected: bool`, `ip`, and diagnostic info.
    """
    if not ssid:
        raise NmcliError("ssid required")

    # Delete ALL WiFi profiles whose 802-11-wireless.ssid matches our target SSID.
    # Profile NAME may differ from SSID (e.g. netplan-wlan0-TineWifi-China for
    # SSID TineWifi-China), so we must read each profile's actual SSID property.
    _, conn_out, _ = await _run(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"])
    for line in conn_out.splitlines():
        parts = line.split(":")
        if len(parts) < 2 or parts[1] != "802-11-wireless":
            continue
        profile_name = ":".join(parts[:-1])  # NAME may contain colons (rare but safe)
        _, ssid_out, _ = await _run(
            ["nmcli", "-g", "802-11-wireless.ssid", "connection", "show", profile_name],
            check=False,
        )
        if ssid_out.strip() == ssid:
            await _run(["sudo", "nmcli", "connection", "delete", profile_name], check=False)

    # Build 'connection add' with explicit security settings.
    # 'device wifi connect' on nmcli 1.52 doesn't auto-set key-mgmt even
    # when a password is given, causing "key-mgmt: property is missing".
    import time as _time
    con_name = f"tourbox-{ssid[:20]}-{int(_time.time())}"
    add_cmd = [
        "sudo", "nmcli", "connection", "add",
        "type", "wifi",
        "con-name", con_name,
        "ifname", "wlan0",
        "ssid", ssid,
        "ipv4.method", "auto",
    ]
    if password:
        add_cmd += ["wifi-sec.key-mgmt", "wpa-psk", "wifi-sec.psk", password]

    rc, out, err = await _run(add_cmd, check=False)
    if rc != 0:
        return {"connected": False, "error": err or out, "ssid": ssid}

    # Bring up the new profile.
    rc, out, err = await _run(
        ["sudo", "nmcli", "connection", "up", con_name, "ifname", "wlan0"],
        check=False,
    )
    if rc != 0:
        # Clean up the profile we just created.
        await _run(["sudo", "nmcli", "connection", "delete", con_name], check=False)
        msg = err or out
        if "Secrets" in msg or "psk" in msg.lower() or "auth" in msg.lower():
            msg = "Authentication failed — check the password."
        return {"connected": False, "error": msg, "ssid": ssid}

    # nmcli returns 0 after L2 association; DHCP may still be running.
    # Wait up to 15s for an IP to appear naturally.
    ip = await _wait_for_ip("wlan0", timeout_s=15)

    if not ip:
        # Fallback: explicit dhclient in case NM's DHCP stalled.
        await _run(["sudo", "dhclient", "-1", "-v", "wlan0"], check=False)
        ip = await _wait_for_ip("wlan0", timeout_s=15)

    if not ip:
        # Connected at L2 but truly no DHCP — report honestly.
        return {
            "connected": True,
            "ip": None,
            "warning": "WiFi associated but DHCP did not assign an IP within 30s. Try restarting NetworkManager.",
            "ssid": ssid,
        }

    return {"connected": True, "ip": ip, "output": out, "ssid": ssid}


async def update_ap(ssid: str | None = None, password: str | None = None) -> dict[str, Any]:
    """Update the AP SSID and/or WPA2 password, then reactivate the connection
    so changes take effect immediately."""
    if not ssid and not password:
        raise NmcliError("nothing to update")
    args: list[str] = ["sudo", "nmcli", "connection", "modify", AP_CONNECTION]
    if ssid:
        args.extend(["802-11-wireless.ssid", ssid])
    if password:
        if len(password) < 8:
            raise NmcliError("WPA2 password must be >= 8 chars")
        args.extend(["wifi-sec.psk", password])
    rc, out, err = await _run(args, check=False)
    if rc != 0:
        raise NmcliError(f"modify failed: {err or out}")
    # Reapply the changes (`down` then `up` is safer than `reload`).
    await _run(["sudo", "nmcli", "connection", "down", AP_CONNECTION], check=False)
    rc2, out2, err2 = await _run(["sudo", "nmcli", "connection", "up", AP_CONNECTION], check=False)
    if rc2 != 0:
        raise NmcliError(f"reactivate failed: {err2 or out2}")
    # Force next ap_secrets() call to re-read (auth uses the new password).
    _invalidate_ap_secrets()
    return await ap_status()
