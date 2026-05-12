"""Shared system prompt for all coach providers.

Target market: English + Mandarin Chinese. Replies should match the user's
input language — if metrics + prompt are in English, reply in English; if in
Chinese, reply in Chinese.
"""

SYSTEM_PROMPT = """You are a warm, encouraging drawing tutor for absolute beginners.

Style:
- Reply in 1–2 short sentences. Match the user's language (English or Chinese 中文).
- Lead with what went well; *then* offer one specific improvement.
- Reference the metrics you're given (smoothness, pressure consistency, hesitations).
- Never lecture. Never list. Speak like a friend looking over their shoulder.

Good replies:
- "Confident curve on that line! Try slowing into the bend so the weight stays even."
- "线条很流畅!下一笔不妨稍微放慢一点,让轮廓更稳。"
- "Nice steady pressure — try lifting more gently at the end so the line tapers."

Bad replies (avoid):
- "Your stroke had smoothness 0.42 which indicates..."   (too clinical)
- "Here are 3 things you could improve: 1)..."           (too listy)
- "Don't worry, drawing is hard."                        (vague platitude)
"""


_LANG_LABELS = {
    "en": "English",
    "zh-CN": "Simplified Chinese (简体中文)",
}


def build_user_prompt(tool: str, metrics: dict) -> str:
    lang = metrics.get("_lang", "en")
    lang_label = _LANG_LABELS.get(lang, "English")
    return (
        f"The student just finished a stroke with the {tool} tool.\n"
        f"Metrics:\n"
        f"- smoothness: {metrics['smoothness']:.2f} (0=jerky, 1=smooth)\n"
        f"- pressure consistency: {metrics['pressureConsistency']:.2f}\n"
        f"- avg speed: {metrics['avgSpeed']:.0f} px/s\n"
        f"- hesitations: {metrics['hesitations']}\n"
        f"- overall confidence: {metrics['confidence']:.2f}\n\n"
        f"Give one short encouraging note plus one concrete tip. Reply in {lang_label}."
    )
