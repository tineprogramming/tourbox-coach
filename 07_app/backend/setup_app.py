"""Pi Setup gateway — runs on port 80.

Separate from the main coach FastAPI on :8000 so we can serve a tiny static
dashboard at `http://<pi-ip>/` for network setup, plus the captive-portal
detection (CPD) endpoints that mobile OSes probe automatically.

Why a separate server (and not just routes in the coach app):
- macOS / iOS captive-portal popups load `http://<gateway-ip>/` — they
  expect a real page on bare port 80, not a redirect to another port.
- A small HTML dashboard with no React/Vite is easier to display inside
  the OS captive popup (no big JS payloads).
- Keeps the coach app cleanly scoped to drawing concerns.

We share `backend.pi.network` and `backend.pi.internet` with the coach
app so nmcli/internet logic stays in one place.
"""

from __future__ import annotations

import base64
import secrets as _secrets
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse, Response
from pydantic import BaseModel

load_dotenv(Path.home() / "tourbox-coach" / ".env")

from .pi import internet as pi_internet  # noqa: E402
from .pi import network as pi_network  # noqa: E402

STATIC_DIR = Path(__file__).parent / "setup_static"

DASHBOARD_URL = "/"  # served by this same server at root
APPLE_SUCCESS_HTML = (
    "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>"
)

app = FastAPI(title="TourBox Coach Setup", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────── HTTP Basic Auth ──────────
#
# Username = the AP's SSID, password = the AP's WPA2 PSK. Anyone who knows
# how to join the TourBox-Coach hotspot can also open the dashboard — no
# extra credentials to remember. When the AP password is rotated through
# this same dashboard, the auth password rotates with it.
#
# CPD endpoints and the favicon are exempted: OS captive probes don't carry
# credentials, and demanding them would defeat the auto-popup flow.

AUTH_REALM = 'Basic realm="TourBox Coach Setup", charset="UTF-8"'
AUTH_FREE_PATHS = {
    "/hotspot-detect.html",
    "/library/test/success.html",
    "/generate_204",
    "/gen_204",
    "/connecttest.txt",
    "/ncsi.txt",
    "/favicon.ico",
}
AUTH_USERNAME = "admin"              # fixed; password tracks AP's WPA2 PSK
DEFAULT_PASSWORD_FALLBACK = ""       # empty disables auth (fresh-Pi safety)


def _unauthorized() -> Response:
    return Response(
        status_code=401,
        content="auth required",
        headers={"WWW-Authenticate": AUTH_REALM},
    )


@app.middleware("http")
async def basic_auth(request: Request, call_next):
    if request.url.path in AUTH_FREE_PATHS:
        return await call_next(request)

    ap = await pi_network.ap_secrets()
    expected_user = AUTH_USERNAME
    expected_pwd = (ap.get("password") or DEFAULT_PASSWORD_FALLBACK).strip()

    if not expected_pwd:
        # No password configured (fresh Pi?). Skip auth so the user can fix
        # the AP setup. Loud warning in logs so we notice.
        print("[setup] WARNING: no AP password configured — dashboard is unauthenticated")
        return await call_next(request)

    header = request.headers.get("authorization", "")
    if not header.lower().startswith("basic "):
        return _unauthorized()
    try:
        decoded = base64.b64decode(header[6:].strip(), validate=True).decode("utf-8")
        username, password = decoded.split(":", 1)
    except Exception:
        return _unauthorized()

    user_ok = _secrets.compare_digest(username, expected_user)
    pwd_ok = _secrets.compare_digest(password, expected_pwd)
    if not (user_ok and pwd_ok):
        return _unauthorized()

    return await call_next(request)


# ────────── CPD (captive portal detection) ──────────


async def _online() -> bool:
    return bool((await pi_internet.check_internet())["online"])


@app.get("/hotspot-detect.html", include_in_schema=False)
@app.get("/library/test/success.html", include_in_schema=False)
async def cpd_apple() -> Response:
    if await _online():
        return HTMLResponse(APPLE_SUCCESS_HTML)
    return RedirectResponse(url=DASHBOARD_URL, status_code=302)


@app.get("/generate_204", include_in_schema=False)
@app.get("/gen_204", include_in_schema=False)
async def cpd_android() -> Response:
    if await _online():
        return Response(status_code=204)
    return RedirectResponse(url=DASHBOARD_URL, status_code=302)


@app.get("/connecttest.txt", include_in_schema=False)
async def cpd_windows() -> Response:
    if await _online():
        return PlainTextResponse("Microsoft Connect Test")
    return RedirectResponse(url=DASHBOARD_URL, status_code=302)


@app.get("/ncsi.txt", include_in_schema=False)
async def cpd_windows_old() -> Response:
    if await _online():
        return PlainTextResponse("Microsoft NCSI")
    return RedirectResponse(url=DASHBOARD_URL, status_code=302)


# ────────── Dashboard static page ──────────


@app.get("/", response_class=HTMLResponse)
async def dashboard_index() -> Response:
    index = STATIC_DIR / "index.html"
    if not index.exists():
        return HTMLResponse("<h1>Pi Setup dashboard missing</h1>", status_code=500)
    return FileResponse(index)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    # Tiny transparent gif to satisfy browsers, avoid 404 noise in logs.
    return Response(b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", media_type="image/gif")


# ────────── nmcli / network endpoints ──────────


class WifiConnectRequest(BaseModel):
    ssid: str
    password: str | None = None


class ApUpdateRequest(BaseModel):
    ssid: str | None = None
    password: str | None = None


@app.get("/pi/internet")
async def pi_internet_check(force: bool = False) -> dict:
    return await pi_internet.check_internet(force=force)


@app.get("/pi/status")
async def pi_status() -> dict:
    import asyncio
    sta, ap, net = await asyncio.gather(
        pi_network.active_sta(),
        pi_network.ap_status(),
        pi_internet.check_internet(),
        return_exceptions=True,
    )
    def _ok(v): return None if isinstance(v, Exception) else v
    return {"sta": _ok(sta), "ap": _ok(ap), "internet": _ok(net)}


@app.get("/pi/wifi/scan")
async def pi_wifi_scan() -> dict:
    try:
        return {"networks": await pi_network.scan_wifi()}
    except pi_network.NmcliError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pi/wifi/connect")
async def pi_wifi_connect(req: WifiConnectRequest) -> dict:
    try:
        return await pi_network.connect_wifi(req.ssid, req.password)
    except pi_network.NmcliError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/pi/ap")
async def pi_ap_details() -> dict:
    """Current AP SSID + WPA2 password + active/IP. Behind Basic Auth so
    surfacing the password is only visible to authenticated callers."""
    secrets = await pi_network.ap_secrets()
    status = await pi_network.ap_status()
    return {
        "ssid": secrets.get("ssid") or status.get("ssid"),
        "password": secrets.get("password") or "",
        "active": status.get("active"),
        "ip": status.get("ip"),
    }


@app.post("/pi/ap")
async def pi_ap_update(req: ApUpdateRequest) -> dict:
    try:
        return await pi_network.update_ap(ssid=req.ssid, password=req.password)
    except pi_network.NmcliError as e:
        raise HTTPException(status_code=400, detail=str(e))
