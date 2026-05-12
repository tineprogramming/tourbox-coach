/** Minimal i18n dictionary. Add a new key in `en`, mirror it in every other
 * locale (TypeScript will yell if you forget). Strings only — for AI replies
 * we pass `lang` to the backend so the model answers in the right language.
 *
 * Keep this list tight. Don't add strings that aren't user-visible.
 */

export type Locale = "en" | "zh-CN";

export const LOCALE_OPTIONS: { id: Locale; label: string; flag: string }[] = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "zh-CN", label: "简体中文", flag: "🇨🇳" },
];

const en = {
  // Topbar / brand
  "brand.tag": "Pi 5 + HAT · hybrid AI",

  // Connection / cloud
  "conn.connected": "Connected",
  "conn.connecting": "Connecting…",
  "conn.disconnected": "Disconnected",
  "conn.reconnecting": "Reconnecting…",
  "cloud.online": "Cloud · Online",
  "cloud.offline": "Cloud · Offline",
  "cloud.checking": "Checking…",

  // Coach selector
  "coach.label": "Coach",

  // ActionsBar
  "act.undo": "Undo",
  "act.clear": "Clear",
  "act.new": "New session",
  "act.polish": "Polish My Drawing",
  "act.askVision": "👁 Ask vision",
  "act.hud": "HUD",
  "act.exportJsonl": "Export .jsonl",
  "act.exportJson": "Export .json",

  // Polish modal
  "polish.title": "Polish My Drawing",
  "polish.style": "Style",
  "polish.model": "Model",
  "polish.generate": "Generate",
  "polish.regenerate": "Regenerate",
  "polish.generating": "Generating…",
  "polish.developing": "Developing…",
  "polish.yourSketch": "Your sketch",
  "polish.mode.reimagine": "AI reimagine mode",
  "polish.mode.faithful": "Faithful mode",
  "polish.mode.reimagineBlurb":
    "AI read your sketch and reimagined it in this style — lines aren't preserved literally. Use Wanxiang / Seedream / Flux Kontext if you want to keep the exact lines.",
  "polish.mode.faithfulBlurb":
    "AI used your sketch as a structure guide — lines + composition are preserved.",
  "polish.whatSeen": "What the AI saw in your sketch",
  "polish.promptSent": "Prompt sent to Flux",

  // Vision modal
  "vision.title": "👁 Ask vision",
  "vision.question": "Question",
  "vision.ask": "Ask",
  "vision.askAgain": "Ask again",
  "vision.looking": "Looking…",
  "vision.thinking": "Thinking…",
  "vision.lookingSub": "Looking at your drawing…",
  "vision.hoverHint": "Hover a region or chip:",
  "vision.default":
    "Look at my drawing. What do you see, and what's one concrete tip to make it better?",
  "vision.suggest.see": "What do you see, and one tip to improve?",
  "vision.suggest.proportions": "How are the proportions? Any specific fix?",
  "vision.suggest.style": "What style is this drawing in? How can I lean into it?",
  "vision.suggest.practice":
    "If a beginner drew this, what should they practice next?",

  // Errors
  "err.copy": "Copy",
  "err.copied": "✓ Copied",
  "err.label": "⚠️ Error",
  "err.close": "Close",

  // Language picker
  "lang.label": "Language",

  // Brand
  "brand.name": "TourBox Coach",

  // Toolbar / SettingsPanel
  "tools.label": "Tools",
  "settings.color": "Color",
  "settings.customColor": "Custom color",
  "settings.thickness": "Thickness",
  "settings.opacity": "Opacity",

  // Ghost guide
  "ghost.label": "Guide",
  "ghost.title": "Reference overlay. 100% = trace mode · 0% = solo.",

  // HUD
  "hud.title": "Pen telemetry",
  "hud.heading": "PEN TELEMETRY",
  "hud.liveSignal": "Live signal",
  "hud.pressureLast": "Pressure (last 4 s)",
  "hud.session": "Session",
  "hud.smoothness": "Smoothness",
  "hud.pressure": "Pressure",
  "hud.confidence": "Confidence",
  "hud.hesitations": "Hesitations",

  // Coach providers (shown in dropdown)
  "coachProv.local": "🔒 Local",
  "coachProv.cluster": "🚀 Cluster · Qwen3-32B-AWQ",
  "coachProv.deepseek": "☁️ DeepSeek",
  "coachProv.qwenPlus": "☁️ Qwen-Plus",
  "coachProv.kimi": "☁️ Kimi",
  "coachProv.minimax": "☁️ MiniMax",
  "coachProv.offlineSuffix": " · offline",
  "coachProv.title.online": "Pick the AI coach. Local = on-device. Cloud = faster, needs internet.",
  "coachProv.title.offline": "No internet — cloud coaches disabled. Pi is using local on-device AI only.",

  // Polish styles
  "style.watercolor": "Watercolor",
  "style.anime": "Anime",
  "style.oilPainting": "Oil painting",
  "style.pencilSketch": "Pencil sketch",
  "style.conceptArt": "Concept art",
  "style.inkWash": "Ink wash 水墨",
  "style.realistic": "Realistic photo",

  // Footer
  "footer.help":
    "Press H for HUD · ⌘Z to undo · G to peek a ghost · Tab to accept it · ",
  "footer.piSetup": "Pi network setup →",

  // AI box
  "ai.sub": "Coach · Polish · Vision",
  "ai.intlNote":
    "International model may be blocked from mainland China networks. The cluster + Chinese cloud options stay reachable.",

  // Polish mode picker
  "polish.modeHeader": "Mode",
  "polish.modeFaithful": "🎯 Sketch-Faithful",
  "polish.modeFaithfulSub": "Preserves your lines + composition",
  "polish.modeReimagine": "🎨 AI Reimagine",
  "polish.modeReimagineSub": "Creative reinterpretation",
  "polish.providerCategory.cluster": "Thailand cluster",
  "polish.providerCategory.chinese": "Chinese cloud",
  "polish.providerCategory.international": "International",

  // Polish multi-select compare
  "polish.modelsCompare": "Models to compare",
  "polish.selectAll": "Select all",
  "polish.justCluster": "Just cluster",
  "polish.compareN": "Compare {n} models",

  // Vision provider selector
  "vision.providerLabel": "Vision model",
  "vision.providerCategory.cluster": "Thailand cluster",
  "vision.providerCategory.chinese": "Chinese cloud",
  "vision.providerCategory.international": "International",
} as const;

export type StringKey = keyof typeof en;

const zhCN: Record<StringKey, string> = {
  "brand.tag": "Pi 5 + HAT · 混合 AI",

  "conn.connected": "已连接",
  "conn.connecting": "连接中…",
  "conn.disconnected": "已断开",
  "conn.reconnecting": "重新连接…",
  "cloud.online": "云端 · 在线",
  "cloud.offline": "云端 · 离线",
  "cloud.checking": "检查中…",

  "coach.label": "教练",

  "act.undo": "撤销",
  "act.clear": "清空",
  "act.new": "新会话",
  "act.polish": "润色我的画",
  "act.askVision": "👁 询问视觉",
  "act.hud": "HUD",
  "act.exportJsonl": "导出 .jsonl",
  "act.exportJson": "导出 .json",

  "polish.title": "润色我的画",
  "polish.style": "风格",
  "polish.model": "模型",
  "polish.generate": "生成",
  "polish.regenerate": "重新生成",
  "polish.generating": "生成中…",
  "polish.developing": "显影中…",
  "polish.yourSketch": "你的草图",
  "polish.mode.reimagine": "AI 重新想象模式",
  "polish.mode.faithful": "忠实模式",
  "polish.mode.reimagineBlurb":
    "AI 读了你的草图并按这个风格重新创作 —— 没有逐线保留。如果要保留原线条,请选 Wanxiang / Seedream / Flux Kontext。",
  "polish.mode.faithfulBlurb": "AI 把你的草图当作结构指引 —— 保留线条和构图。",
  "polish.whatSeen": "AI 在你的草图里看到了什么",
  "polish.promptSent": "发送给 Flux 的提示词",

  "vision.title": "👁 询问视觉",
  "vision.question": "问题",
  "vision.ask": "询问",
  "vision.askAgain": "再问一次",
  "vision.looking": "查看中…",
  "vision.thinking": "思考中…",
  "vision.lookingSub": "正在查看你的画…",
  "vision.hoverHint": "把鼠标移到区域或标签上:",
  "vision.default": "看看我的画。你看到什么? 给我一个具体的改进建议。",
  "vision.suggest.see": "你看到什么? 有一个改进建议吗?",
  "vision.suggest.proportions": "比例怎么样? 有具体可以修正的地方吗?",
  "vision.suggest.style": "这幅画是什么风格? 我可以怎么发挥这个风格?",
  "vision.suggest.practice": "如果是新手画的, 接下来应该练习什么?",

  "err.copy": "复制",
  "err.copied": "✓ 已复制",
  "err.label": "⚠️ 错误",
  "err.close": "关闭",

  "lang.label": "语言",

  "brand.name": "TourBox Coach",

  "tools.label": "工具",
  "settings.color": "颜色",
  "settings.customColor": "自定义颜色",
  "settings.thickness": "粗细",
  "settings.opacity": "不透明度",

  "ghost.label": "参考",
  "ghost.title": "参考图叠加。100% = 描摹模式 · 0% = 独立绘画。",

  "hud.title": "笔尖遥测",
  "hud.heading": "笔尖遥测",
  "hud.liveSignal": "实时信号",
  "hud.pressureLast": "压感 (最近 4 秒)",
  "hud.session": "会话",
  "hud.smoothness": "流畅度",
  "hud.pressure": "压感",
  "hud.confidence": "信心",
  "hud.hesitations": "停顿次数",

  "coachProv.local": "🔒 本地",
  "coachProv.cluster": "🚀 集群 · Qwen3-32B-AWQ",
  "coachProv.deepseek": "☁️ DeepSeek",
  "coachProv.qwenPlus": "☁️ 通义千问 Plus",
  "coachProv.kimi": "☁️ Kimi",
  "coachProv.minimax": "☁️ MiniMax",
  "coachProv.offlineSuffix": " · 离线",
  "coachProv.title.online": "选择 AI 教练。本地 = 设备内运行。云端 = 更快, 需要联网。",
  "coachProv.title.offline": "无网络 — 云端教练已停用。Pi 仅使用设备内 AI。",

  "style.watercolor": "水彩",
  "style.anime": "动漫",
  "style.oilPainting": "油画",
  "style.pencilSketch": "铅笔素描",
  "style.conceptArt": "概念美术",
  "style.inkWash": "水墨",
  "style.realistic": "写实照片",

  "footer.help":
    "按 H 显示 HUD · ⌘Z 撤销 · G 预览 ghost · Tab 接受 · ",
  "footer.piSetup": "Pi 网络设置 →",

  "ai.sub": "教练 · 润色 · 视觉",
  "ai.intlNote": "国际模型在中国大陆网络可能被屏蔽。集群和中国云端选项始终可用。",

  "polish.modeHeader": "模式",
  "polish.modeFaithful": "🎯 忠实模式",
  "polish.modeFaithfulSub": "保留你的线条和构图",
  "polish.modeReimagine": "🎨 AI 重新想象",
  "polish.modeReimagineSub": "创意重新诠释",
  "polish.providerCategory.cluster": "泰国集群",
  "polish.providerCategory.chinese": "中国云端",
  "polish.providerCategory.international": "国际",

  "polish.modelsCompare": "对比模型",
  "polish.selectAll": "全选",
  "polish.justCluster": "仅集群",
  "polish.compareN": "对比 {n} 个模型",

  "vision.providerLabel": "视觉模型",
  "vision.providerCategory.cluster": "泰国集群",
  "vision.providerCategory.chinese": "中国云端",
  "vision.providerCategory.international": "国际",
};

const DICT: Record<Locale, Record<StringKey, string>> = {
  en,
  "zh-CN": zhCN,
};

export function translate(key: StringKey, locale: Locale): string {
  return DICT[locale]?.[key] ?? en[key] ?? key;
}

/** Sniff the browser's preferred language. Returns the closest match in
 * LOCALE_OPTIONS, defaulting to "en". */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const tags = [navigator.language, ...(navigator.languages ?? [])];
  for (const t of tags) {
    const lower = t.toLowerCase();
    if (lower.startsWith("zh")) return "zh-CN";
    if (lower.startsWith("en")) return "en";
  }
  return "en";
}
