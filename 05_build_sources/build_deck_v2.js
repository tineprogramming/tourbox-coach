const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaPalette, FaUsers, FaRocket, FaShieldAlt, FaLightbulb, FaCog,
  FaLock, FaGraduationCap, FaChartLine, FaCheckCircle, FaCircle,
  FaBullseye, FaCubes, FaHandshake, FaArrowRight, FaStar,
  FaPaintBrush, FaRobot, FaMicrochip, FaBookOpen, FaHeart,
  FaQuestion, FaInfinity, FaGem, FaCompass, FaLayerGroup, FaEye, FaBrain
} = require("react-icons/fa");

const C = {
  primary:    "5B21B6",
  primaryDk:  "2E1065",
  primaryLt:  "8B5CF6",
  secondary:  "C4B5FD",
  accent:     "F59E0B",
  accentPink: "EC4899",
  bg:         "FFFFFF",
  bgSoft:     "F5F3FF",
  textDk:     "1E1B4B",
  textMd:     "475569",
  textLt:     "94A3B8",
  border:     "E0E7FF",
  success:    "10B981",
};

async function iconPng(IconComponent, color = "#" + C.primary, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "TourBox Strategy Team";
  pres.title = "TourBox Coach — AI Drawing Tutor Pitch v2";

  const W = 13.333, H = 7.5;

  const ic = {
    usersDk:    await iconPng(FaUsers, "#" + C.primary),
    chart:      await iconPng(FaChartLine, "#" + C.primary),
    chartW:     await iconPng(FaChartLine, "#FFFFFF"),
    lightbulbW: await iconPng(FaLightbulb, "#FFFFFF"),
    bullseyeW:  await iconPng(FaBullseye, "#FFFFFF"),
    chip:       await iconPng(FaMicrochip, "#" + C.primary),
    cubes:      await iconPng(FaCubes, "#" + C.primary),
    book:       await iconPng(FaBookOpen, "#" + C.primary),
    handshake:  await iconPng(FaHandshake, "#" + C.primary),
    question:   await iconPng(FaQuestion, "#" + C.primary),
    compassW:   await iconPng(FaCompass, "#FFFFFF"),
    cogW:       await iconPng(FaCog, "#FFFFFF"),
    eyeW:       await iconPng(FaEye, "#FFFFFF"),
    lockW:      await iconPng(FaLock, "#FFFFFF"),
    brainW:     await iconPng(FaBrain, "#FFFFFF"),
    heartW:     await iconPng(FaHeart, "#FFFFFF"),
  };

  const addFooter = (slide, num, total) => {
    slide.addText("TourBox Coach  •  Confidential", {
      x: 0.5, y: H - 0.4, w: 6, h: 0.3,
      fontSize: 9, color: C.textLt, fontFace: "Calibri", margin: 0,
    });
    slide.addText(`${num} / ${total}`, {
      x: W - 1.2, y: H - 0.4, w: 0.7, h: 0.3,
      fontSize: 9, color: C.textLt, fontFace: "Calibri", align: "right", margin: 0,
    });
  };

  const TOTAL = 13;

  // ═════════════════════════════════════════════════════════════
  // SLIDE 1 — TITLE
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.primaryDk };

    s.addShape(pres.shapes.OVAL, {
      x: W - 4, y: -2, w: 6, h: 6,
      fill: { color: C.primaryLt, transparency: 70 },
      line: { color: C.primaryLt, width: 0 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: -2, y: H - 3, w: 5, h: 5,
      fill: { color: C.accent, transparency: 80 },
      line: { color: C.accent, width: 0 },
    });

    s.addText("STRATEGIC PITCH  •  CEO REVIEW", {
      x: 0.8, y: 1.2, w: 8, h: 0.4,
      fontSize: 12, color: C.secondary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });

    s.addText("TourBox Coach", {
      x: 0.8, y: 1.8, w: 11, h: 1.4,
      fontSize: 72, color: "FFFFFF", bold: true,
      fontFace: "Georgia", margin: 0,
    });

    s.addText("The first Intelligence Surface for creators", {
      x: 0.8, y: 3.3, w: 11, h: 0.7,
      fontSize: 26, color: C.secondary, italic: true,
      fontFace: "Georgia", margin: 0,
    });

    s.addText("Reimagining TourBox for the next 300M creators", {
      x: 0.8, y: 4.2, w: 11, h: 0.5,
      fontSize: 16, color: "FFFFFF",
      fontFace: "Calibri", margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
      x: 0.8, y: 6.5, w: 1.5, h: 0,
      line: { color: C.accent, width: 3 },
    });
    s.addText("Strategy Team  •  May 2026", {
      x: 0.8, y: 6.7, w: 6, h: 0.4,
      fontSize: 12, color: C.secondary,
      fontFace: "Calibri", margin: 0,
    });
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 2 — THE OPPORTUNITY (with feedback loop hook)
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("01  •  THE OPPORTUNITY", {
      x: 0.7, y: 0.5, w: 6, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });

    s.addText("300 million \"wish-I-could\" artists.", {
      x: 0.7, y: 0.95, w: 12, h: 0.75,
      fontSize: 30, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("The gap between inspiration and the first stroke is too wide.", {
      x: 0.7, y: 1.7, w: 12, h: 0.5,
      fontSize: 18, color: C.primary, italic: true,
      fontFace: "Georgia", margin: 0,
    });

    // 3 stat cards (smaller now to make room for "Why" callout)
    const cards = [
      { num: "300M+", label: "Aspiring artists worldwide", icon: ic.usersDk },
      { num: "60×", label: "Larger than creative pro market", icon: ic.chart },
      { num: "$0", label: "Tools designed to teach beginners", icon: ic.question },
    ];
    const cardW = 3.8, gap = 0.3;
    const startX = (W - (cardW * 3 + gap * 2)) / 2;
    cards.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      const y = 2.6;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: cardW, h: 1.85,
        fill: { color: C.bgSoft },
        line: { color: C.border, width: 1 },
      });
      s.addImage({ data: c.icon, x: x + 0.3, y: y + 0.25, w: 0.4, h: 0.4 });
      s.addText(c.num, {
        x: x + 0.3, y: y + 0.7, w: cardW - 0.6, h: 0.7,
        fontSize: 40, color: C.primary, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(c.label, {
        x: x + 0.3, y: y + 1.4, w: cardW - 0.6, h: 0.4,
        fontSize: 11, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    // The "Why" callout — emotional hook
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 4.85, w: 12, h: 1.95,
      fill: { color: C.primaryDk },
      line: { width: 0 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 4.85, w: 0.15, h: 1.95,
      fill: { color: C.accent },
      line: { width: 0 },
    });
    s.addText("THE \"WHY\" — WHY THEY QUIT", {
      x: 1.05, y: 5.0, w: 8, h: 0.35,
      fontSize: 10, color: C.accent, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "Most beginners quit because they have no ", options: { color: "FFFFFF" } },
      { text: "feedback loop", options: { color: C.accent, bold: true } },
      { text: ". They don't know ", options: { color: "FFFFFF" } },
      { text: "why", options: { color: "FFFFFF", italic: true } },
      { text: " their lines look wrong.\nPrivate tutors are expensive. YouTube is passive.\n", options: { color: "FFFFFF" } },
      { text: "TourBox Coach is the first active learning bridge.", options: { color: C.accent, bold: true, italic: true } },
    ], {
      x: 1.05, y: 5.4, w: 11.4, h: 1.4,
      fontSize: 16, fontFace: "Calibri", margin: 0,
      paraSpaceAfter: 4,
    });

    addFooter(s, 2, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 3 — MARKET SIZE
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("02  •  MARKET SIZE", {
      x: 0.7, y: 0.5, w: 6, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });

    s.addText("From niche to mass market", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 36, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("Beginner segment is 60× our current addressable market.", {
      x: 0.7, y: 1.7, w: 12, h: 0.45,
      fontSize: 16, color: C.textMd,
      fontFace: "Calibri", margin: 0,
    });

    s.addChart(pres.charts.BAR, [{
      name: "Users (millions)",
      labels: ["Creative pros\n(current TAM)", "Hobbyist creators", "Aspiring artists\n(NEW TAM)", "Comparison: Duolingo MAU"],
      values: [5, 50, 300, 100],
    }], {
      x: 0.7, y: 2.5, w: 7.5, h: 4.3, barDir: "bar",
      chartColors: [C.primary],
      chartArea: { fill: { color: "FFFFFF" } },
      catAxisLabelColor: C.textDk,
      catAxisLabelFontSize: 11,
      valAxisLabelColor: C.textMd,
      valAxisLabelFontSize: 10,
      valGridLine: { color: C.border, size: 0.5 },
      catGridLine: { style: "none" },
      showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: C.textDk,
      dataLabelFontSize: 11,
      showLegend: false,
      valAxisTitle: "Million users",
      showValAxisTitle: true,
      valAxisTitleColor: C.textMd,
      valAxisTitleFontSize: 10,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 8.7, y: 2.5, w: 4.0, h: 4.3,
      fill: { color: C.primaryDk },
      line: { width: 0 },
    });
    s.addImage({ data: ic.lightbulbW, x: 8.95, y: 2.75, w: 0.4, h: 0.4 });
    s.addText("THE INSIGHT", {
      x: 9.4, y: 2.75, w: 3, h: 0.4,
      fontSize: 11, color: C.accent, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Education + creativity = the largest underserved market in consumer tech.", {
      x: 8.95, y: 3.3, w: 3.55, h: 1.3,
      fontSize: 16, color: "FFFFFF", bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText([
      { text: "Duolingo proved language learning at scale (100M MAU, $7B valuation).\n\n", options: { color: "FFFFFF", fontSize: 11 } },
      { text: "No one has done this for art — yet.", options: { color: C.accent, fontSize: 12, italic: true, bold: true } },
    ], {
      x: 8.95, y: 4.7, w: 3.55, h: 1.9,
      fontFace: "Calibri", margin: 0,
    });

    addFooter(s, 3, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 4 — KEY INSIGHT (Don't automate, empower)
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("03  •  KEY INSIGHT", {
      x: 0.7, y: 0.5, w: 6, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });

    s.addText("Don't automate creativity.", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 36, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("Empower it.", {
      x: 0.7, y: 1.65, w: 12, h: 0.7,
      fontSize: 36, color: C.primary, bold: true, italic: true,
      fontFace: "Georgia", margin: 0,
    });

    const colY = 2.7, colH = 3.2;
    // OLD WORLD
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: colY, w: 6.0, h: colH,
      fill: { color: "F8FAFC" },
      line: { color: C.border, width: 1 },
    });
    s.addText("OLD WORLD", {
      x: 1.0, y: colY + 0.3, w: 5.4, h: 0.3,
      fontSize: 10, color: C.textLt, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Generative AI", {
      x: 1.0, y: colY + 0.6, w: 5.4, h: 0.45,
      fontSize: 20, color: C.textMd, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("\"Substitute for skill\"", {
      x: 1.0, y: colY + 1.1, w: 5.4, h: 0.35,
      fontSize: 12, color: C.textLt, italic: true,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "Low barrier, low value", options: { bullet: true, breakLine: true, color: C.textMd } },
      { text: "Already commoditized (Midjourney, DALL·E)", options: { bullet: true, breakLine: true, color: C.textMd } },
      { text: "Creates outputs, not artists", options: { bullet: true, breakLine: true, color: C.textMd } },
      { text: "Doesn't justify hardware purchase", options: { bullet: true, color: C.textMd } },
    ], {
      x: 1.0, y: colY + 1.55, w: 5.4, h: 1.55,
      fontSize: 12, fontFace: "Calibri", paraSpaceAfter: 6,
    });

    // NEW WORLD
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.95, y: colY, w: 5.7, h: colH,
      fill: { color: C.primaryDk },
      line: { width: 0 },
      shadow: { type: "outer", color: "000000", blur: 16, offset: 4, angle: 90, opacity: 0.15 },
    });
    s.addText("NEW WORLD — TOURBOX", {
      x: 7.25, y: colY + 0.3, w: 5.1, h: 0.3,
      fontSize: 10, color: C.accent, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Tutoring AI", {
      x: 7.25, y: colY + 0.6, w: 5.1, h: 0.45,
      fontSize: 20, color: "FFFFFF", bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("\"Scaffolding for growth\"", {
      x: 7.25, y: colY + 1.1, w: 5.1, h: 0.35,
      fontSize: 12, color: C.secondary, italic: true,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "High engagement, high loyalty", options: { bullet: true, breakLine: true, color: "FFFFFF" } },
      { text: "Builds skill that compounds", options: { bullet: true, breakLine: true, color: "FFFFFF" } },
      { text: "Tactile dial = adjustable learning curve", options: { bullet: true, breakLine: true, color: "FFFFFF" } },
      { text: "Hardware-software combo = defensible moat", options: { bullet: true, color: "FFFFFF" } },
    ], {
      x: 7.25, y: colY + 1.55, w: 5.1, h: 1.55,
      fontSize: 12, fontFace: "Calibri", paraSpaceAfter: 6,
    });

    // Vision quote
    s.addText([
      { text: "We're moving from a \"Control Surface\" for pros to an ", options: { color: C.textDk } },
      { text: "\"Intelligence Surface\"", options: { color: C.primary, bold: true } },
      { text: " for everyone.", options: { color: C.textDk } },
    ], {
      x: 0.7, y: 6.15, w: 12, h: 0.85,
      fontSize: 16, italic: true, align: "center", bold: true,
      fontFace: "Georgia", margin: 0,
    });

    addFooter(s, 4, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 5 — PRODUCT VISION (with Mai persona + AI Sight + Ghost Guide)
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("04  •  PRODUCT VISION", {
      x: 0.7, y: 0.5, w: 6, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("A personal art tutor in a box.", {
      x: 0.7, y: 0.95, w: 12, h: 0.65,
      fontSize: 32, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    // Persona callout
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.7, w: 12, h: 0.65,
      fill: { color: C.bgSoft },
      line: { color: C.primaryLt, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.7, w: 0.1, h: 0.65,
      fill: { color: C.accentPink },
      line: { width: 0 },
    });
    s.addText([
      { text: "MEET MAI, 14   ", options: { color: C.accentPink, bold: true, charSpacing: 3, fontSize: 10 } },
      { text: "She wants to draw anime but is afraid to post. YouTube overwhelms her. Parents won't pay tutors. ", options: { color: C.textDk, fontSize: 12 } },
      { text: "TourBox Coach is for her.", options: { color: C.primary, bold: true, italic: true, fontSize: 12 } },
    ], {
      x: 1.0, y: 1.78, w: 11.5, h: 0.5,
      fontFace: "Calibri", margin: 0, valign: "middle",
    });

    // 4 feature cards
    const features = [
      { icon: ic.compassW, t: "Curated Curriculum", d: "100+ progressive lessons — first line to finished portrait. Co-designed with working artists." },
      { icon: ic.cogW,     t: "Ghost Guide Dial", tag: "THE MAGIC MOMENT", d: "The muscle memory controller. Turn the knob: 100% guided trace → 0% solo." },
      { icon: ic.eyeW,     t: "AI Sight Feedback", d: "After each stroke, vision AI reviews proportion and suggests one specific improvement." },
      { icon: ic.lockW,    t: "Private by Default", d: "All AI runs on-device. No cloud, no data leaves the box. Parents trust it for kids." },
    ];
    const fx = 0.7, fy = 2.6;
    const fw = 5.95, fh = 2.05, fgap = 0.2;
    features.forEach((f, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = fx + col * (fw + fgap);
      const y = fy + row * (fh + fgap);
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: fw, h: fh,
        fill: { color: C.bgSoft },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.35, y: y + 0.35, w: 0.75, h: 0.75,
        fill: { color: C.primary },
        line: { width: 0 },
      });
      s.addImage({ data: f.icon, x: x + 0.48, y: y + 0.48, w: 0.5, h: 0.5 });

      s.addText(f.t, {
        x: x + 1.3, y: y + 0.35, w: fw - 1.5, h: 0.45,
        fontSize: 17, color: C.textDk, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      if (f.tag) {
        s.addText(f.tag, {
          x: x + 1.3, y: y + 0.78, w: fw - 1.5, h: 0.3,
          fontSize: 9, color: C.accent, bold: true, charSpacing: 3,
          fontFace: "Calibri", margin: 0,
        });
      }
      s.addText(f.d, {
        x: x + 1.3, y: y + (f.tag ? 1.05 : 0.85), w: fw - 1.5, h: f.tag ? 0.95 : 1.15,
        fontSize: 11, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    addFooter(s, 5, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 6 — WHY US (Haptic Brain)
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("05  •  WHY TOURBOX WINS THIS", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "Our unfair advantage: the ", options: { color: C.textDk } },
      { text: "Haptic Brain", options: { color: C.primary, italic: true } },
    ], {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 32, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    // Hero statement
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 1.85, w: 12, h: 0.85,
      fill: { color: C.bgSoft },
      line: { width: 0 },
    });
    s.addText([
      { text: "Skill-building requires ", options: { color: C.textDk } },
      { text: "physical touch", options: { color: C.primary, bold: true } },
      { text: " — not just a touchscreen.\nWe already shipped the body. Now we add the brain.", options: { color: C.textDk } },
    ], {
      x: 0.95, y: 1.95, w: 11.6, h: 0.7,
      fontSize: 14, italic: true,
      fontFace: "Georgia", margin: 0, valign: "middle",
    });

    // 4 advantages
    const pillars = [
      { num: "01", t: "7 years of tactile IP", d: "Patents on multi-control layout, dial mechanics, haptic feedback. Software-only competitors cannot replicate the feel of a real dial." },
      { num: "02", t: "Two-hand creative workflow", d: "Apple Pencil owns the right hand. Nobody owns the left. The ergonomic insight Apple, Wacom, and Adobe missed." },
      { num: "03", t: "300K loyal customer base", d: "Built-in beta pool, social proof, and brand trust. Day-one validation pool no startup can match." },
      { num: "04", t: "Edge-AI sweet spot, right now", d: "Mobile chips at 30+ TOPS, $80 BOM. The window opened in 2025. It closes when everyone notices." },
    ];

    pillars.forEach((p, i) => {
      const y = 2.95 + i * 0.85;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.7, y, w: 12, h: 0.7,
        fill: { color: "FFFFFF" },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.7, y, w: 0.1, h: 0.7,
        fill: { color: C.primary },
        line: { width: 0 },
      });
      s.addText(p.num, {
        x: 0.95, y: y + 0.1, w: 1.0, h: 0.55,
        fontSize: 28, color: C.primary, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(p.t, {
        x: 2.05, y: y + 0.05, w: 10.5, h: 0.35,
        fontSize: 15, color: C.textDk, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(p.d, {
        x: 2.05, y: y + 0.38, w: 10.5, h: 0.35,
        fontSize: 11, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    // Closer
    s.addText("Competitors need 5 years to build our hardware. We need 12 months to add the brain.", {
      x: 0.7, y: 6.6, w: 12, h: 0.4,
      fontSize: 13, color: C.textDk, italic: true, bold: true, align: "center",
      fontFace: "Georgia", margin: 0,
    });

    addFooter(s, 6, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 7 — ROADMAP
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("06  •  ROADMAP", {
      x: 0.7, y: 0.5, w: 6, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("De-risked path to category leadership", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 32, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("Validate first. Invest in hardware after data confirms demand.", {
      x: 0.7, y: 1.7, w: 12, h: 0.4,
      fontSize: 14, color: C.textMd, italic: true,
      fontFace: "Calibri", margin: 0,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.9, y: 3.65, w: 11.5, h: 0.04,
      fill: { color: C.border },
      line: { width: 0 },
    });

    const phases = [
      { y0: "Year 0", title: "Software MVP", sub: "Validate", desc: "AI Tutor app + existing hardware. 1K paid beta, retention metrics.", color: C.accent },
      { y0: "Year 1", title: "Coach Bundle", sub: "Hardware v1", desc: "AI companion box + controller. $299 retail, 50K target.", color: C.primaryLt },
      { y0: "Year 2", title: "Coach Pro", sub: "Integrated", desc: "All-in-one controller + AI + small reference screen. $449.", color: C.primary },
      { y0: "Year 3", title: "Studio", sub: "Flagship", desc: "Full pen display + AI tutor. $999 halo product.", color: C.primaryDk },
    ];
    const phW = 2.7, phGap = 0.25, totalPhW = phW * 4 + phGap * 3;
    const phStartX = (W - totalPhW) / 2;
    phases.forEach((p, i) => {
      const x = phStartX + i * (phW + phGap);
      s.addShape(pres.shapes.OVAL, {
        x: x + phW / 2 - 0.18, y: 3.5, w: 0.36, h: 0.36,
        fill: { color: p.color },
        line: { color: "FFFFFF", width: 3 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 4.1, w: phW, h: 2.7,
        fill: { color: "FFFFFF" },
        line: { color: C.border, width: 1 },
        shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 90, opacity: 0.06 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 4.1, w: phW, h: 0.1,
        fill: { color: p.color },
        line: { width: 0 },
      });
      s.addText(p.y0, {
        x: x + 0.25, y: 4.3, w: phW - 0.5, h: 0.35,
        fontSize: 11, color: p.color, bold: true, charSpacing: 4,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(p.title, {
        x: x + 0.25, y: 4.65, w: phW - 0.5, h: 0.55,
        fontSize: 22, color: C.textDk, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(p.sub, {
        x: x + 0.25, y: 5.18, w: phW - 0.5, h: 0.35,
        fontSize: 12, color: C.textMd, italic: true,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(p.desc, {
        x: x + 0.25, y: 5.6, w: phW - 0.5, h: 1.1,
        fontSize: 11, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    phases.forEach((p, i) => {
      const x = phStartX + i * (phW + phGap);
      s.addText(p.y0.toUpperCase(), {
        x, y: 2.9, w: phW, h: 0.4,
        fontSize: 11, color: C.textLt, bold: true, charSpacing: 4, align: "center",
        fontFace: "Calibri", margin: 0,
      });
    });

    addFooter(s, 7, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 8 — YEAR 0 DETAIL
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("07  •  YEAR 0 — WHAT WE DO NEXT", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Software-first, low-risk, fast feedback", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 32, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    s.addText("PHASE 0a  ·  Months 1–3", {
      x: 0.7, y: 2.0, w: 6, h: 0.35,
      fontSize: 11, color: C.accent, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Build AI Tutor MVP", {
      x: 0.7, y: 2.35, w: 6, h: 0.5,
      fontSize: 22, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText([
      { text: "iOS, macOS, Windows app — uses existing TourBox controller", options: { bullet: true, breakLine: true } },
      { text: "20 starter lessons + Ghost Guide system", options: { bullet: true, breakLine: true } },
      { text: "AI feedback (cloud LLM initially, on-device by Year 1)", options: { bullet: true, breakLine: true } },
      { text: "Progress tracking + parent-friendly dashboard", options: { bullet: true } },
    ], {
      x: 0.7, y: 2.95, w: 6, h: 1.95,
      fontSize: 12, color: C.textMd, fontFace: "Calibri", paraSpaceAfter: 6,
    });

    s.addText("PHASE 0b  ·  Months 4–6", {
      x: 0.7, y: 5.0, w: 6, h: 0.35,
      fontSize: 11, color: C.primaryLt, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Beta + iterate", {
      x: 0.7, y: 5.35, w: 6, h: 0.5,
      fontSize: 22, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText([
      { text: "1,000 paid beta users (existing customers + new beginners)", options: { bullet: true, breakLine: true } },
      { text: "Refine curriculum based on usage data", options: { bullet: true, breakLine: true } },
      { text: "Validate hardware spec for Year 1", options: { bullet: true } },
    ], {
      x: 0.7, y: 5.95, w: 6, h: 1.4,
      fontSize: 12, color: C.textMd, fontFace: "Calibri", paraSpaceAfter: 6,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 7.5, y: 2.0, w: 5.2, h: 5.0,
      fill: { color: C.primaryDk },
      line: { width: 0 },
    });
    s.addImage({ data: ic.bullseyeW, x: 7.85, y: 2.3, w: 0.5, h: 0.5 });
    s.addText("YEAR 0 GATE METRICS", {
      x: 8.5, y: 2.35, w: 4, h: 0.4,
      fontSize: 11, color: C.accent, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Decision criteria for Year 1", {
      x: 7.85, y: 2.95, w: 4.6, h: 0.5,
      fontSize: 16, color: "FFFFFF", italic: true,
      fontFace: "Georgia", margin: 0,
    });

    const metrics = [
      { k: "1,000+", v: "paid beta users" },
      { k: "40%+",   v: "30-day retention" },
      { k: "NPS 40+", v: "from beginner segment" },
      { k: "$15+",  v: "willingness to pay (monthly)" },
    ];
    metrics.forEach((m, i) => {
      const my = 3.7 + i * 0.78;
      s.addText(m.k, {
        x: 7.85, y: my, w: 1.7, h: 0.5,
        fontSize: 22, color: C.accent, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(m.v, {
        x: 9.55, y: my + 0.1, w: 3.0, h: 0.4,
        fontSize: 12, color: "FFFFFF",
        fontFace: "Calibri", margin: 0,
      });
    });

    addFooter(s, 8, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 9 — YEAR 1 HARDWARE
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("08  •  YEAR 1 — FIRST HARDWARE", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Coach Bundle: controller + AI box", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 32, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 2.0, w: 6.0, h: 4.9,
      fill: { color: C.bgSoft },
      line: { color: C.border, width: 1 },
    });
    s.addImage({ data: ic.chip, x: 0.95, y: 2.25, w: 0.5, h: 0.5 });
    s.addText("HARDWARE — AI COMPANION BOX", {
      x: 1.55, y: 2.3, w: 5, h: 0.4,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });

    const specs = [
      ["SoC", "Mobile-class NPU (Snapdragon 8 Gen 3 / Dimensity 9300)"],
      ["Memory", "12 GB LPDDR5X, 128 GB storage"],
      ["AI compute", "30+ TOPS — runs vision + small diffusion models"],
      ["Cooling", "Passive (fanless) — silent on desk"],
      ["Connectivity", "USB-C to host (iPad, Mac, Windows)"],
      ["Form factor", "Stackable with TourBox controller"],
      ["Power", "USB-C PD, 15W max"],
      ["BOM target", "$80–120  →  retail $299 bundle"],
    ];
    specs.forEach((sp, i) => {
      const sy = 3.0 + i * 0.46;
      s.addText(sp[0], {
        x: 1.0, y: sy, w: 1.5, h: 0.4,
        fontSize: 11, color: C.primary, bold: true,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(sp[1], {
        x: 2.55, y: sy, w: 4.05, h: 0.4,
        fontSize: 11, color: C.textDk,
        fontFace: "Calibri", margin: 0,
      });
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 7.0, y: 2.0, w: 5.7, h: 4.9,
      fill: { color: "FFFFFF" },
      line: { color: C.border, width: 1 },
      shadow: { type: "outer", color: "000000", blur: 12, offset: 3, angle: 90, opacity: 0.08 },
    });
    s.addImage({ data: ic.chart, x: 7.25, y: 2.25, w: 0.5, h: 0.5 });
    s.addText("BUSINESS CASE", {
      x: 7.85, y: 2.3, w: 5, h: 0.4,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });

    const bigStats = [
      { n: "$299", l: "Bundle retail price", x: 7.25 },
      { n: "50K",  l: "Year 1 unit target",   x: 9.95 },
    ];
    bigStats.forEach((b) => {
      s.addText(b.n, {
        x: b.x, y: 2.95, w: 2.6, h: 0.85,
        fontSize: 44, color: C.primary, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(b.l, {
        x: b.x, y: 3.85, w: 2.6, h: 0.4,
        fontSize: 11, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    s.addShape(pres.shapes.LINE, {
      x: 7.25, y: 4.45, w: 5.2, h: 0,
      line: { color: C.border, width: 1 },
    });

    s.addText("ECONOMICS", {
      x: 7.25, y: 4.6, w: 5, h: 0.35,
      fontSize: 10, color: C.textLt, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "Gross margin: ~55% on hardware", options: { bullet: true, breakLine: true, color: C.textDk } },
      { text: "Optional content sub: $5/mo (40% take rate)", options: { bullet: true, breakLine: true, color: C.textDk } },
      { text: "Year 1 revenue target: $15M", options: { bullet: true, breakLine: true, color: C.textDk } },
      { text: "Day-one curriculum from Year 0 validated", options: { bullet: true, color: C.textDk } },
    ], {
      x: 7.25, y: 4.95, w: 5.2, h: 1.85,
      fontSize: 12, fontFace: "Calibri", paraSpaceAfter: 6,
    });

    addFooter(s, 9, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 10 — PARALLEL TRACK (Pro Ecosystem)
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("09  •  PARALLEL TRACK", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("We don't abandon our pros — we level them up too.", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 28, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    // Why this matters
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 2.0, w: 5.5, h: 4.85,
      fill: { color: C.bgSoft },
      line: { color: C.border, width: 1 },
    });
    s.addText("WHY THIS MATTERS", {
      x: 0.95, y: 2.2, w: 5, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "While we build the beginner platform, our 300K existing pros get an AI upgrade path through software — at minimal cost.\n\n", options: { color: C.textDk, fontSize: 12 } },
      { text: "This protects revenue, deepens loyalty, and signals that TourBox owns AI across the entire creative spectrum.", options: { color: C.textDk, fontSize: 12 } },
    ], {
      x: 0.95, y: 2.6, w: 5.05, h: 2.4,
      fontFace: "Calibri", margin: 0,
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.95, y: 5.4, w: 5.05, h: 1.2,
      fill: { color: C.primaryDk },
      line: { width: 0 },
    });
    s.addText("Pro track total cost", {
      x: 1.15, y: 5.5, w: 4.7, h: 0.3,
      fontSize: 10, color: C.secondary, bold: true, charSpacing: 3,
      fontFace: "Calibri", margin: 0,
    });
    s.addText([
      { text: "$600K", options: { color: C.accent, fontSize: 26, bold: true } },
      { text: "  over 12 months", options: { color: "FFFFFF", fontSize: 13 } },
    ], {
      x: 1.15, y: 5.78, w: 4.7, h: 0.5,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("Parallel team. Zero impact on AI Tutor timeline.", {
      x: 1.15, y: 6.25, w: 4.7, h: 0.3,
      fontSize: 10, color: C.secondary, italic: true,
      fontFace: "Calibri", margin: 0,
    });

    // What we ship
    s.addText("WHAT WE SHIP — PARALLEL TO AI TUTOR", {
      x: 6.5, y: 2.2, w: 6.5, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });

    const tracks = [
      { t: "TourBox AI Bridge app", inv: "2 engineers, 4 mo", out: "Routes TourBox actions to local AI tools" },
      { t: "ComfyUI custom node", inv: "1 engineer, 2 mo", out: "Viral with AI art community (~500K users)" },
      { t: "Krita / Photoshop plugins", inv: "2 engineers, 6 mo", out: "Pro workflows with Stable Diffusion, Flux" },
      { t: "Open SDK", inv: "Year 2", out: "Community-built plugins" },
    ];
    tracks.forEach((tr, i) => {
      const y = 2.65 + i * 1.05;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 6.5, y, w: 6.2, h: 0.95,
        fill: { color: "FFFFFF" },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 6.5, y, w: 0.08, h: 0.95,
        fill: { color: C.primaryLt },
        line: { width: 0 },
      });
      s.addText(tr.t, {
        x: 6.7, y: y + 0.1, w: 4.0, h: 0.4,
        fontSize: 13, color: C.textDk, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(tr.inv, {
        x: 6.7, y: y + 0.5, w: 4.0, h: 0.35,
        fontSize: 10, color: C.primary, italic: true,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(tr.out, {
        x: 10.7, y: y + 0.3, w: 1.95, h: 0.45,
        fontSize: 10, color: C.textMd,
        fontFace: "Calibri", margin: 0, valign: "middle",
      });
    });

    addFooter(s, 10, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 11 — BUSINESS MODEL & MOAT
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("10  •  BUSINESS MODEL & MOAT", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Multiple revenue streams, defensible by design", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 28, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    const revenue = [
      { icon: ic.cubes, t: "Hardware", d: "$299 bundle  →  $999 flagship", weight: "Primary" },
      { icon: ic.book, t: "Content", d: "$5/mo subscription, optional", weight: "Recurring" },
      { icon: ic.handshake, t: "Marketplace", d: "Pros sell lesson packs (30% take)", weight: "Year 2+" },
    ];
    revenue.forEach((r, i) => {
      const x = 0.7 + i * 4.1;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 2.0, w: 3.85, h: 1.85,
        fill: { color: C.bgSoft },
        line: { color: C.border, width: 1 },
      });
      s.addImage({ data: r.icon, x: x + 0.3, y: 2.25, w: 0.5, h: 0.5 });
      s.addText(r.weight.toUpperCase(), {
        x: x + 0.95, y: 2.3, w: 2.8, h: 0.35,
        fontSize: 9, color: C.primary, bold: true, charSpacing: 4,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(r.t, {
        x: x + 0.3, y: 2.85, w: 3.4, h: 0.5,
        fontSize: 22, color: C.textDk, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(r.d, {
        x: x + 0.3, y: 3.4, w: 3.4, h: 0.4,
        fontSize: 12, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    // Marketplace flywheel
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y: 4.05, w: 12, h: 0.7,
      fill: { color: C.primaryDk },
      line: { width: 0 },
    });
    s.addText([
      { text: "FLYWHEEL  ", options: { color: C.accent, bold: true, charSpacing: 3, fontSize: 10 } },
      { text: "Pros create lessons → beginners buy from idols → TourBox earns platform fee → more pros join.", options: { color: "FFFFFF", fontSize: 12 } },
    ], {
      x: 0.95, y: 4.18, w: 11.5, h: 0.45,
      fontFace: "Calibri", margin: 0, valign: "middle",
    });

    s.addText("FOUR LAYERS OF DEFENSE", {
      x: 0.7, y: 4.95, w: 12, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 4,
      fontFace: "Calibri", margin: 0,
    });

    const moats = [
      { t: "Hardware",   d: "Tactile IP, ergonomic patents, supplier relationships" },
      { t: "Curriculum", d: "Proprietary 100+ lessons designed by working artists" },
      { t: "On-device AI", d: "Privacy-first models — no cloud lock-in for users" },
      { t: "Community",  d: "Progress data, social loops, artist-led marketplace" },
    ];
    moats.forEach((m, i) => {
      const x = 0.7 + i * 3.075;
      const y = 5.45;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 2.95, h: 1.6,
        fill: { color: C.primaryDk },
        line: { width: 0 },
      });
      s.addText(`0${i + 1}`, {
        x: x + 0.3, y: y + 0.2, w: 1.5, h: 0.4,
        fontSize: 18, color: C.accent, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(m.t, {
        x: x + 0.3, y: y + 0.65, w: 2.55, h: 0.4,
        fontSize: 14, color: "FFFFFF", bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(m.d, {
        x: x + 0.3, y: y + 1.05, w: 2.55, h: 0.5,
        fontSize: 9, color: C.secondary,
        fontFace: "Calibri", margin: 0,
      });
    });

    addFooter(s, 11, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 12 — RISKS
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.bg };

    s.addText("11  •  RISKS & MITIGATION", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.primary, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });
    s.addText("Honest about what could go wrong", {
      x: 0.7, y: 0.95, w: 12, h: 0.7,
      fontSize: 32, color: C.textDk, bold: true,
      fontFace: "Georgia", margin: 0,
    });

    const risks = [
      {
        risk: "Apple or Wacom enters this space first",
        mit:  "Curriculum + community moat takes years to copy. We have 12-month head start.",
      },
      {
        risk: "Beginners won't pay for hardware",
        mit:  "Year 0 software MVP validates willingness-to-pay BEFORE any hardware spend.",
      },
      {
        risk: "AI feedback quality is too generic to be useful",
        mit:  "Co-design with art teachers from Year 0. Validate through retention metrics.",
      },
      {
        risk: "TourBox brand is known for pros, not beginners",
        mit:  "Sub-brand 'Coach' positioning. Different distribution channels (education, gift).",
      },
      {
        risk: "Hardware delays push timeline by 6+ months",
        mit:  "Off-the-shelf reference designs (Qualcomm, MediaTek). No custom silicon.",
      },
    ];

    risks.forEach((r, i) => {
      const y = 2.05 + i * 0.95;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.7, y, w: 12, h: 0.85,
        fill: { color: "FFFFFF" },
        line: { color: C.border, width: 1 },
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.7, y, w: 5.0, h: 0.85,
        fill: { color: C.bgSoft },
        line: { width: 0 },
      });
      s.addText("RISK", {
        x: 0.95, y: y + 0.1, w: 0.8, h: 0.3,
        fontSize: 9, color: C.accentPink, bold: true, charSpacing: 3,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(r.risk, {
        x: 0.95, y: y + 0.35, w: 4.65, h: 0.45,
        fontSize: 12, color: C.textDk, bold: true,
        fontFace: "Calibri", margin: 0,
      });
      s.addText("MITIGATION", {
        x: 5.95, y: y + 0.1, w: 1.5, h: 0.3,
        fontSize: 9, color: C.success, bold: true, charSpacing: 3,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(r.mit, {
        x: 5.95, y: y + 0.35, w: 6.5, h: 0.45,
        fontSize: 11, color: C.textMd,
        fontFace: "Calibri", margin: 0,
      });
    });

    addFooter(s, 12, TOTAL);
  }

  // ═════════════════════════════════════════════════════════════
  // SLIDE 13 — THE ASK (FOMO close)
  // ═════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.primaryDk };

    s.addShape(pres.shapes.OVAL, {
      x: -3, y: -3, w: 4, h: 4,
      fill: { color: C.primaryLt, transparency: 78 },
      line: { width: 0 },
    });
    s.addShape(pres.shapes.OVAL, {
      x: W - 3, y: H - 3, w: 5, h: 5,
      fill: { color: C.accent, transparency: 80 },
      line: { width: 0 },
    });

    s.addText("12  •  THE ASK", {
      x: 0.7, y: 0.5, w: 8, h: 0.35,
      fontSize: 11, color: C.accent, bold: true, charSpacing: 6,
      fontFace: "Calibri", margin: 0,
    });

    s.addText("$1.5M to own the category.", {
      x: 0.7, y: 1.05, w: 12, h: 1.0,
      fontSize: 48, color: "FFFFFF", bold: true,
      fontFace: "Georgia", margin: 0,
    });
    s.addText("See you in 6 months with the data.", {
      x: 0.7, y: 2.05, w: 12, h: 0.6,
      fontSize: 22, color: C.secondary, italic: true,
      fontFace: "Georgia", margin: 0,
    });

    const asks = [
      { num: "$1.5M", label: "Year 0 budget", sub: "Software + curriculum + beta" },
      { num: "6 mo",  label: "Time to gate", sub: "Decision before hardware spend" },
      { num: "1K",    label: "Paid beta users", sub: "Hard go/no-go criterion" },
    ];
    asks.forEach((a, i) => {
      const x = 0.7 + i * 4.1;
      const y = 3.1;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 3.85, h: 1.85,
        fill: { color: "FFFFFF", transparency: 92 },
        line: { color: C.secondary, width: 1 },
      });
      s.addText(a.num, {
        x: x + 0.3, y: y + 0.2, w: 3.4, h: 0.75,
        fontSize: 36, color: C.accent, bold: true,
        fontFace: "Georgia", margin: 0,
      });
      s.addText(a.label.toUpperCase(), {
        x: x + 0.3, y: y + 0.95, w: 3.4, h: 0.35,
        fontSize: 11, color: "FFFFFF", bold: true, charSpacing: 4,
        fontFace: "Calibri", margin: 0,
      });
      s.addText(a.sub, {
        x: x + 0.3, y: y + 1.3, w: 3.4, h: 0.45,
        fontSize: 10, color: C.secondary,
        fontFace: "Calibri", margin: 0,
      });
    });

    // FOMO close
    s.addShape(pres.shapes.LINE, {
      x: 0.7, y: 5.3, w: 1.5, h: 0,
      line: { color: C.accent, width: 3 },
    });

    s.addText([
      { text: "In 2026, AI is everywhere.\n", options: { color: "FFFFFF", fontSize: 18 } },
      { text: "But nobody owns ", options: { color: "FFFFFF", fontSize: 18 } },
      { text: "\"Human-AI Learning\"", options: { color: C.accent, fontSize: 18, bold: true } },
      { text: ".\n\n", options: { color: "FFFFFF", fontSize: 18 } },
      { text: "Let's not just sell a controller —\n", options: { color: C.secondary, fontSize: 18, italic: true } },
      { text: "Let's sell the ability to create.", options: { color: "FFFFFF", fontSize: 22, bold: true, italic: true } },
    ], {
      x: 0.7, y: 5.5, w: 12, h: 1.85,
      fontFace: "Georgia", margin: 0,
    });
  }

  await pres.writeFile({ fileName: "/home/claude/TourBox_Coach_Pitch_v2.pptx" });
  console.log("✓ Done — TourBox_Coach_Pitch_v2.pptx");
})().catch((e) => { console.error(e); process.exit(1); });
