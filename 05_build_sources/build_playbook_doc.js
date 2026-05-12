const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, Header, Footer, PageNumber
} = require("docx");

// ──── Helpers ────
const C = {
  primary: "5B21B6",
  primaryDk: "2E1065",
  primaryLt: "8B5CF6",
  accent: "F59E0B",
  textDk: "1E1B4B",
  textMd: "475569",
  bgSoft: "F5F3FF",
  border: "CCCCCC",
  borderLt: "E0E7FF",
  white: "FFFFFF",
};

const border = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const borders = { top: border, bottom: border, left: border, right: border };

// Quick paragraph helpers
const P = (text, opts = {}) => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text, ...opts })],
});

const PItalic = (text, opts = {}) => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text, italics: true, ...opts })],
});

const PBold = (text, opts = {}) => new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text, bold: true, ...opts })],
});

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text })],
  pageBreakBefore: false,
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text })],
});

const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text })],
});

const Bullet = (text, opts = {}) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { after: 80 },
  children: [new TextRun({ text, ...opts })],
});

// Mixed inline runs in one paragraph
const PMixed = (runs, opts = {}) => new Paragraph({
  spacing: { after: 120 },
  ...opts,
  children: runs.map(r => new TextRun(r)),
});

const BulletMixed = (runs) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { after: 80 },
  children: runs.map(r => new TextRun(r)),
});

// Quote block (indented italic with left border)
const Quote = (text) => new Paragraph({
  spacing: { before: 100, after: 200 },
  indent: { left: 360 },
  border: {
    left: { style: BorderStyle.SINGLE, size: 24, color: C.primary, space: 12 },
  },
  children: [new TextRun({ text, italics: true, size: 24, color: C.textDk })],
});

const Spacer = () => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "" })] });

const Divider = () => new Paragraph({
  spacing: { before: 200, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.borderLt, space: 1 } },
  children: [new TextRun({ text: "" })],
});

// Table cell with text
const cell = (text, opts = {}) => {
  const { width = 2000, bold = false, fill = null, color = null, fontSize = 20, align = AlignmentType.LEFT } = opts;
  const cellOpts = {
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text: String(text), bold, color: color || undefined, size: fontSize })],
      }),
    ],
  };
  if (fill) cellOpts.shading = { fill, type: ShadingType.CLEAR };
  return new TableCell(cellOpts);
};

// Header row
const tableHeaderRow = (cells, widths) =>
  new TableRow({
    tableHeader: true,
    children: cells.map((c, i) =>
      cell(c, { width: widths[i], bold: true, fill: C.primary, color: C.white, fontSize: 20 })
    ),
  });

const tableDataRow = (cells, widths) =>
  new TableRow({
    children: cells.map((c, i) => cell(c, { width: widths[i], fontSize: 20 })),
  });

const makeTable = (headers, rows, widths) => {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      tableHeaderRow(headers, widths),
      ...rows.map(r => tableDataRow(r, widths)),
    ],
  });
};

// ──── BUILD DOCUMENT ────

const sections = [];

// === Title page ===
sections.push(
  new Paragraph({
    spacing: { before: 2400, after: 200 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: "TOURBOX COACH", bold: true, size: 24, color: C.primary, characterSpacing: 80 })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: "Team Playbook", bold: true, size: 72, color: C.textDk, font: "Georgia" })],
  }),
  new Paragraph({
    spacing: { after: 600 },
    children: [new TextRun({ text: "How We Build the Future of Creative Learning", italics: true, size: 32, color: C.primary, font: "Georgia" })],
  }),
  new Paragraph({
    spacing: { after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.accent, space: 12 } },
    indent: { left: 240 },
    children: [new TextRun({ text: "Document purpose: ", bold: true, size: 22 }), new TextRun({ text: "This is our internal North Star — the document everyone on the TourBox Coach initiative refers to when they need direction. Read it on day one. Reference it when stuck. Update it when reality changes.", size: 22 })],
  }),
  new Paragraph({
    spacing: { after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: C.accent, space: 12 } },
    indent: { left: 240 },
    children: [new TextRun({ text: "Audience: ", bold: true, size: 22 }), new TextRun({ text: "Everyone working on this — leadership, PMs, engineers, designers, AI team, marketing, finance. One doc, one truth.", size: 22 })],
  }),
  new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: "Last updated: May 2026 — v1.0", size: 20, color: C.textMd })] }),
  new Paragraph({ children: [new TextRun({ text: "Owner: Strategy team", size: 20, color: C.textMd })] }),
  new Paragraph({ children: [new TextRun({ text: "Status: Living document. Comments and edits welcome.", size: 20, color: C.textMd, italics: true })] }),
  new Paragraph({ children: [new PageBreak()] })
);

// === Table of contents ===
sections.push(
  H1("Table of Contents"),
  ...[
    "1. Why This Document Exists",
    "2. Where We're Going (Vision & Mission)",
    "3. The Strategic Bet",
    "4. The Four-Year Roadmap",
    "5. Year 0 Deep Dive",
    "6. Team Structure & Ownership",
    "7. Workstreams in Detail",
    "8. Working Principles & Culture",
    "9. Success Metrics & Reporting",
    "10. Risk Register",
    "11. Communication, Tools & Rituals",
    "12. Frequently Asked Questions",
    "13. Glossary & Appendices",
  ].map(t => P(t, { size: 24 })),
  new Paragraph({ children: [new PageBreak()] })
);

// === 1. Why This Document Exists ===
sections.push(
  H1("1. Why This Document Exists"),
  P("We're starting something new at TourBox. After 7 years of serving creative professionals, we're expanding into a much larger market: 300 million aspiring artists who want to draw but don't know where to start."),
  P("This isn't a side project. It's a strategic bet on the next decade of TourBox. It will involve software, hardware, AI, curriculum, education partnerships, and entirely new go-to-market channels."),
  P("That means alignment matters more than ever. When you have 30+ people working across software, AI, hardware, and content, small misalignments compound into wasted quarters. This document is the antidote."),

  H2("Three things this doc is for"),
  BulletMixed([{ text: "Onboarding — ", bold: true }, { text: "New team members read this first. By the end, they understand what we're building, why, and how their role fits." }]),
  BulletMixed([{ text: "Decision-making — ", bold: true }, { text: "When you face a fork in the road, this doc tells you what we'd usually do and why. If your case is an exception, document it." }]),
  BulletMixed([{ text: "Re-alignment — ", bold: true }, { text: "When a team starts drifting (it happens), this doc is the gravity that pulls us back." }]),

  H2("Three things this doc is NOT"),
  BulletMixed([{ text: "Not a project plan. ", bold: true }, { text: "Project plans live in our PM tool. This is the strategy and the principles, not the Gantt chart." }]),
  BulletMixed([{ text: "Not immutable. ", bold: true }, { text: "Reality changes. When we learn something new, we update this. Markup history matters." }]),
  BulletMixed([{ text: "Not a substitute for talking. ", bold: true }, { text: "When you're confused, ask your lead. The doc is a starting point, not the final word." }]),
);

// === 2. Where We're Going ===
sections.push(
  Divider(),
  H1("2. Where We're Going"),

  H2("Vision (3-year horizon)"),
  Quote("TourBox becomes the platform that teaches the world to draw."),
  P("Within three years, \u201CTourBox\u201D should mean something different to a 14-year-old aspiring manga artist than it does to a 35-year-old retoucher today. Same company, same values, dramatically expanded reach."),

  H2("Mission (what we do every day)"),
  Quote("We give beginners the tactile tools, AI guidance, and structured curriculum they need to become artists \u2014 not by replacing their effort, but by scaffolding it."),
  PMixed([{ text: "The verbs that matter: " }, { text: "scaffold, guide, encourage, teach.", bold: true }, { text: " We are not a generation tool. We are a teaching tool." }]),

  H2("What success looks like"),
  PBold("By end of Year 1:"),
  Bullet("A person who has never drawn before can pick up TourBox Coach, follow lessons, and produce work they're proud of within 30 days."),
  Bullet("Their parents trust the device because all AI runs locally, no data leaves the box."),
  Bullet("That person tells their friends. We grow through delight, not paid acquisition."),
  PBold("By end of Year 3:"),
  Bullet("TourBox Coach is in art classrooms, gift guides, and YouTube tutorials worldwide."),
  Bullet("We are the default answer to \u201CI want to learn to draw \u2014 what should I get?\u201D"),
  Bullet("Our marketplace lets working artists earn meaningful income teaching their craft."),

  H2("What it does NOT look like"),
  BulletMixed([{ text: "Not", bold: true }, { text: " another AI image generator. Midjourney, DALL\u00B7E, and Flux already serve that market." }]),
  BulletMixed([{ text: "Not", bold: true }, { text: " a Wacom replacement for pros (though we still serve pros \u2014 see Pro Track)." }]),
  BulletMixed([{ text: "Not", bold: true }, { text: " a closed walled garden. Privacy and openness matter." }]),
  BulletMixed([{ text: "Not", bold: true }, { text: " a subscription-first business. Hardware is primary; subscription is optional." }]),
);

// === 3. The Strategic Bet ===
sections.push(
  Divider(),
  H1("3. The Strategic Bet"),
  PMixed([{ text: "We are betting that " }, { text: "three converging trends create a once-per-decade window:", bold: true }]),

  H2("Bet #1: Edge AI just became cheap enough"),
  PMixed([
    { text: "Mobile-class chips (Snapdragon 8 Gen 3, Dimensity 9300) now run useful vision and small diffusion models at 30+ TOPS for under $80 BOM cost, fanless. Two years ago, this hardware would have needed a fan and cost $400. Two years from now, every consumer device will have this. " },
    { text: "The window is 12\u201318 months.", bold: true },
  ]),

  H2("Bet #2: AI tutoring is an unsolved problem"),
  P("Generative AI is commoditized. Tutoring AI \u2014 the kind that watches your work, gives helpful feedback, and adapts to your skill level \u2014 is not. Nobody has cracked it for visual arts. The reference is Duolingo: they spent a decade making language learning a daily habit. We can do the same for drawing, and the technology to do it now exists for the first time."),

  H2("Bet #3: Hardware is our defensible advantage"),
  PMixed([
    { text: "Software is being commoditized by AI. Hardware with deep IP, manufacturing relationships, and tactile UX is much harder to replicate. TourBox has 7 years of haptic IP, ergonomic patents, and brand trust in the creative community. " },
    { text: "This is our moat. We must use it.", bold: true },
  ]),

  H2("What we're NOT betting on"),
  BulletMixed([{ text: "We are " }, { text: "not", bold: true }, { text: " betting on Apple or Adobe staying out forever. They will enter eventually. Our 12-month head start is everything." }]),
  BulletMixed([{ text: "We are " }, { text: "not", bold: true }, { text: " betting on cloud AI. Privacy matters too much in our target segment (kids, education)." }]),
  BulletMixed([{ text: "We are " }, { text: "not", bold: true }, { text: " betting on a hit single product. We're building a multi-year category." }]),

  H2("How we know if we're right"),
  P("We have explicit gate metrics at the end of Year 0 (see Section 9). If we miss them, we kill or pivot. No ego. No sunk-cost."),
);

// === 4. Four-Year Roadmap ===
sections.push(
  Divider(),
  H1("4. The Four-Year Roadmap"),

  H2("Year 0 (Months 1\u20136): Validate"),
  PMixed([{ text: "Goal: ", bold: true }, { text: "Prove that beginners will pay to learn drawing with TourBox + AI tutoring, before we spend a single dollar on new hardware." }]),
  PBold("Deliverables:"),
  Bullet("AI Tutor MVP app (iOS, macOS, Windows)"),
  Bullet("20 starter lessons with Ghost Guide system"),
  Bullet("1,000 paid beta users"),
  Bullet("Validated gate metrics (retention, NPS, willingness-to-pay)"),
  PMixed([{ text: "Investment: ", bold: true }, { text: "$1.5M" }]),
  PMixed([{ text: "Headcount: ", bold: true }, { text: "~12 people (software, curriculum, design, AI, BD)" }]),

  H2("Year 1: Hardware v1"),
  PMixed([{ text: "Goal: ", bold: true }, { text: "Ship the Coach Bundle \u2014 TourBox controller + AI Companion Box \u2014 to 50,000 customers." }]),
  PBold("Deliverables:"),
  Bullet("AI Companion Box hardware (Snapdragon-class, fanless, $80\u2013120 BOM)"),
  Bullet("100+ lessons published"),
  Bullet("$299 retail bundle"),
  Bullet("$15M revenue"),
  PMixed([{ text: "Investment: ", bold: true }, { text: "~$8M (hardware R&D, manufacturing, GTM)" }]),
  PMixed([{ text: "Headcount: ", bold: true }, { text: "~30 people" }]),

  H2("Year 2: Integrated"),
  PMixed([{ text: "Goal: ", bold: true }, { text: "All-in-one controller with AI built in, plus a small reference screen. Premium tier." }]),
  PBold("Deliverables:"),
  Bullet("TourBox Coach Pro at $449 retail"),
  Bullet("Marketplace launch \u2014 pro artists sell lesson packs"),
  Bullet("Open SDK release"),
  Bullet("100K+ units shipped"),

  H2("Year 3: Flagship"),
  PMixed([{ text: "Goal: ", bold: true }, { text: "Full pen display + AI tutor in one device. The category-defining product." }]),
  PBold("Deliverables:"),
  Bullet("TourBox Coach Studio at $999 retail"),
  Bullet("Pen display 11\u201313\u201D OLED"),
  Bullet("Education channel partnerships"),
  Bullet("250K+ units total ecosystem"),

  H2("Pro Parallel Track (runs Year 0 onward)"),
  PMixed([{ text: "Goal: ", bold: true }, { text: "Don't abandon our 300K existing pro customers. Ship AI plugins and SDKs alongside the consumer track." }]),
  PBold("Deliverables:"),
  Bullet("TourBox AI Bridge app \u2014 routes controller actions to local AI tools"),
  Bullet("ComfyUI custom node"),
  Bullet("Krita / Photoshop plugins"),
  Bullet("Open SDK for community builders"),
  PMixed([{ text: "Investment: ", bold: true }, { text: "~$600K over 12 months \u2014 small, parallel team. Not the main bet, but protects core revenue." }]),
);

// === 5. Year 0 Deep Dive ===
sections.push(
  Divider(),
  H1("5. Year 0 Deep Dive"),
  PItalic("This is where most of us are working right now. The most detailed section of this playbook."),

  H2("Phase 0a (Months 1\u20133): Build the MVP"),
  PMixed([{ text: "Mission: ", bold: true }, { text: "Get a usable, paid AI Tutor app into the hands of 100 alpha users by end of Month 3." }]),

  H3("Week-by-week milestones"),
  PBold("Weeks 1\u20132: Foundation"),
  Bullet("Confirm tech stack (React Native? Native Swift + Kotlin? \u2014 decision needed Week 1)"),
  Bullet("Set up CI/CD, monorepo, design system"),
  Bullet("Hire remaining 4 roles (curriculum lead, AI engineer \u00D7 2, mobile engineer)"),
  Bullet("First lesson script written and reviewed"),

  PBold("Weeks 3\u20134: Core engine"),
  Bullet("Ghost Guide rendering pipeline working \u2014 opacity dial controlled by TourBox knob"),
  Bullet("TourBox SDK integration on iOS and Mac"),
  Bullet("Lesson framework: load lesson JSON \u2192 render reference \u2192 track progress"),
  Bullet("First end-to-end lesson playable internally"),

  PBold("Weeks 5\u20136: AI feedback loop"),
  Bullet("Stroke capture working on canvas"),
  Bullet("Cloud LLM integration for stroke analysis (we'll move to on-device by Year 1)"),
  Bullet("Encouragement engine prototype"),
  Bullet("First feedback loop tested with 5 internal users"),

  PBold("Weeks 7\u20139: Lesson library"),
  Bullet("20 starter lessons fully scripted, illustrated, and tested"),
  Bullet("Onboarding flow with skill assessment (Day 1 experience)"),
  Bullet("Progress dashboard"),
  Bullet("Parent-friendly mode (kid usage analytics)"),

  PBold("Weeks 10\u201312: Polish + alpha launch"),
  Bullet("Bug fix and polish"),
  Bullet("Launch alpha to 100 users from existing customer base"),
  Bullet("Set up feedback collection"),
  Bullet("Prepare beta launch playbook"),

  H3("Phase 0a deliverables"),
  makeTable(
    ["#", "Deliverable", "Owner", "Done When"],
    [
      ["1", "iOS app (alpha)", "Mobile Lead", "TestFlight build with all 20 lessons"],
      ["2", "macOS app (alpha)", "Desktop Lead", "DMG installer + signing"],
      ["3", "TourBox SDK integration", "Hardware Eng", "Knob \u2192 opacity, all buttons mapped"],
      ["4", "20 starter lessons", "Curriculum Lead", "Reviewed + tested by 3 internal artists"],
      ["5", "AI feedback engine", "AI Lead", "Returns helpful feedback for 80% of strokes"],
      ["6", "Onboarding flow", "Design Lead", "First-time-user can complete in <5 min"],
      ["7", "Analytics dashboard", "Data Eng", "Tracks lesson completion, time, retention"],
      ["8", "Privacy review", "Legal/Security", "Sign-off on data flows"],
    ],
    [600, 2800, 2200, 3760]
  ),
  Spacer(),

  H2("Phase 0b (Months 4\u20136): Beta and iterate"),
  PMixed([{ text: "Mission: ", bold: true }, { text: "Reach 1,000 paid beta users and validate the four gate metrics." }]),

  H3("Activities"),
  PBold("Beta launch (Month 4)"),
  Bullet("Open beta to existing TourBox customers + waitlist (target: 500 in first 2 weeks)"),
  Bullet("Pricing test: $19/mo, $39/quarter, $99/year \u2014 see what converts"),
  Bullet("Active community channel (Discord) for beta users"),
  Bullet("Weekly beta updates with new content"),

  PBold("Iteration loop (Months 4\u20136)"),
  Bullet("Weekly cohort analysis: who comes back, who churns, why"),
  Bullet("Lesson-level analytics: which lessons frustrate, which delight"),
  Bullet("Curriculum adjustments based on data"),
  Bullet("Feature requests prioritized by retention impact"),

  PBold("Hardware spec validation (Month 5)"),
  Bullet("Profile AI inference cost across device types"),
  Bullet("Identify which Year 1 hardware specs match real usage"),
  Bullet("Make/break decisions on AI Companion Box BOM"),

  PBold("Gate review prep (Month 6)"),
  Bullet("Compile data for executive review"),
  Bullet("Year 1 budget request"),
  Bullet("Hardware go/no-go decision"),

  H3("Gate metrics (must hit ALL four)"),
  makeTable(
    ["Metric", "Target", "Why it matters"],
    [
      ["Paid beta users", "1,000+", "Proves people will pay, not just try"],
      ["30-day retention", "40%+", "Proves the product is sticky"],
      ["NPS from beginner segment", "40+", "Proves we're solving the right problem"],
      ["Willingness to pay (monthly)", "$15+", "Proves unit economics work"],
    ],
    [3000, 1500, 4860]
  ),
  Spacer(),
  PItalic("If we miss any one: we don't proceed to Year 1 hardware. We pivot or kill."),
);

// === 6. Team Structure ===
sections.push(
  Divider(),
  H1("6. Team Structure & Ownership"),

  H2("Role responsibilities"),

  H3("Initiative Lead"),
  Bullet("North-star alignment"),
  Bullet("Cross-functional unblocking"),
  Bullet("Reports to CEO weekly"),
  Bullet("Owns the gate review at end of Year 0"),

  H3("Product / Curriculum"),
  BulletMixed([{ text: "Product Manager (1) ", bold: true }, { text: "\u2014 feature prioritization, roadmap, user research" }]),
  BulletMixed([{ text: "Curriculum Lead (1) ", bold: true }, { text: "\u2014 lesson design, pedagogical framework" }]),
  BulletMixed([{ text: "Curriculum Designers (2, contract initially) ", bold: true }, { text: "\u2014 lesson production, illustration" }]),
  BulletMixed([{ text: "UX Researcher (1) ", bold: true }, { text: "\u2014 beta user interviews, usability testing" }]),

  H3("Engineering"),
  BulletMixed([{ text: "Engineering Lead (1) ", bold: true }, { text: "\u2014 technical direction, architecture, hiring" }]),
  BulletMixed([{ text: "Mobile Engineers (3) ", bold: true }, { text: "\u2014 iOS, Android (Year 1+), shared codebase" }]),
  BulletMixed([{ text: "Desktop Engineer (1) ", bold: true }, { text: "\u2014 macOS, Windows" }]),
  BulletMixed([{ text: "Hardware Engineer (1, scales Year 1) ", bold: true }, { text: "\u2014 TourBox SDK, future hardware integration" }]),
  BulletMixed([{ text: "Backend / Data Engineer (1) ", bold: true }, { text: "\u2014 analytics, cloud sync, billing" }]),

  H3("AI/ML"),
  BulletMixed([{ text: "AI Lead (1) ", bold: true }, { text: "\u2014 model selection, training, deployment strategy" }]),
  BulletMixed([{ text: "AI/ML Engineers (2) ", bold: true }, { text: "\u2014 vision models, on-device optimization, RLHF for feedback tone" }]),
  BulletMixed([{ text: "Data Annotators (contract) ", bold: true }, { text: "\u2014 lesson reference data, feedback quality" }]),

  H3("Design"),
  BulletMixed([{ text: "Design Lead (1) ", bold: true }, { text: "\u2014 visual identity, design system, brand voice" }]),
  BulletMixed([{ text: "Product Designer (1) ", bold: true }, { text: "\u2014 UX flows, interaction" }]),
  BulletMixed([{ text: "Motion / Illustrator (1) ", bold: true }, { text: "\u2014 brand visuals, lesson illustrations" }]),

  H3("Go-To-Market"),
  BulletMixed([{ text: "Marketing Lead (1) ", bold: true }, { text: "\u2014 positioning, brand, launch strategy" }]),
  BulletMixed([{ text: "Content / Community (1) ", bold: true }, { text: "\u2014 beta community, social, partnerships" }]),
  BulletMixed([{ text: "BD Lead (1, Year 1+) ", bold: true }, { text: "\u2014 education channels, retail partnerships" }]),

  H3("Operations"),
  BulletMixed([{ text: "Program Manager (1) ", bold: true }, { text: "\u2014 meeting cadence, OKR tracking, vendor management" }]),
  BulletMixed([{ text: "Finance partner (0.5) ", bold: true }, { text: "\u2014 budget, BOM tracking, business case" }]),

  H2("RACI for common decisions"),
  makeTable(
    ["Decision", "Responsible", "Accountable", "Consulted"],
    [
      ["Lesson curriculum changes", "Curriculum Lead", "Product Manager", "UX Researcher, Design Lead"],
      ["Tech stack choices", "Engineering Lead", "Initiative Lead", "AI Lead"],
      ["AI model selection", "AI Lead", "Engineering Lead", "Privacy/Legal"],
      ["Pricing changes", "Product Manager", "Marketing Lead", "Finance"],
      ["Hardware spec", "Hardware Eng", "Engineering Lead", "AI Lead, Finance"],
      ["Brand / positioning", "Marketing Lead", "Design Lead", "Initiative Lead"],
      ["Killing a feature", "Product Manager", "Initiative Lead", "Engineering Lead"],
      ["Hiring", "Hiring Manager", "Function Lead", "HR"],
    ],
    [3000, 2200, 2200, 2960]
  ),
  Spacer(),
  PItalic("When in doubt: Responsible does the work, Accountable owns the outcome, Consulted must be asked before decision, Informed told after."),
);

// === 7. Workstreams ===
sections.push(
  Divider(),
  H1("7. Workstreams in Detail"),

  H2("7.1 Curriculum Workstream"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "Curriculum Lead" }]),
  PMixed([{ text: "North star: ", bold: true }, { text: "Build the pedagogical framework that takes someone from \u201CI've never drawn\u201D to \u201CI can finish a piece I'm proud of\u201D in 30\u201390 days of regular use." }]),

  PBold("Year 0 deliverables:"),
  Bullet("20 starter lessons (Phase 0a) \u2192 100+ by Year 1 launch"),
  Bullet("Pedagogical framework document (how we think about teaching)"),
  Bullet("Lesson template + production pipeline"),
  Bullet("Skill assessment system (Day 1)"),
  Bullet("Progress tracking schema"),

  PBold("Lesson categories (Year 0 starter set):"),
  Bullet("Foundational marks (5 lessons) \u2014 line confidence, basic shapes"),
  Bullet("Observation (4 lessons) \u2014 proportion, basic perspective"),
  Bullet("Construction (4 lessons) \u2014 building forms from primitives"),
  Bullet("Faces (4 lessons) \u2014 proportions, emotion, simple portraits"),
  Bullet("Style transfer (3 lessons) \u2014 applying lessons to anime, cartoon, realistic"),

  PBold("Working principles:"),
  Bullet("Every lesson must be completable in 15\u201330 minutes"),
  Bullet("Every lesson must have a \u201Cwin\u201D \u2014 something to be proud of at the end"),
  Bullet("No lesson assumes prior art knowledge"),
  Bullet("Progressive difficulty curve: 80% of users complete each next lesson"),
  Bullet("Voice is encouraging but specific (avoid \u201Cnice job!\u201D \u2014 say \u201Cnice control on that long line\u201D)"),

  H2("7.2 Software Engineering Workstream"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "Engineering Lead" }]),
  PMixed([{ text: "North star: ", bold: true }, { text: "Ship a delightful, fast, reliable cross-platform app that beginners love using daily." }]),

  PBold("Year 0 architecture decisions (must be made by Week 2):"),
  makeTable(
    ["Decision", "Recommendation"],
    [
      ["Mobile codebase", "Native (Swift + Kotlin) \u2014 drawing perf and TourBox SDK matter"],
      ["Desktop framework", "Tauri \u2014 smaller, faster, better feeling than Electron"],
      ["Backend", "Supabase initially \u2014 fast, can migrate later"],
      ["Analytics", "PostHog \u2014 open source, can self-host for privacy"],
    ],
    [3000, 6360]
  ),
  Spacer(),

  PBold("Engineering principles:"),
  BulletMixed([{ text: "Performance is a feature. ", bold: true }, { text: "A laggy drawing experience kills retention. Test on 3-year-old hardware." }]),
  BulletMixed([{ text: "Privacy is non-negotiable. ", bold: true }, { text: "Default to no data collection. Explicit opt-in for everything else." }]),
  BulletMixed([{ text: "Simplicity over cleverness. ", bold: true }, { text: "A 14-year-old should be able to use the app, so the code should be simple enough that a new engineer is productive in week 1." }]),
  BulletMixed([{ text: "Test before merging. ", bold: true }, { text: "No exceptions for \u201Csmall changes.\u201D" }]),
  BulletMixed([{ text: "Accessibility from day one. ", bold: true }, { text: "Color contrast, font sizing, screen reader support." }]),

  PBold("Code quality bar:"),
  Bullet("All code reviewed by another engineer before merge"),
  Bullet("80% test coverage minimum on business logic (drawing engine, lesson player)"),
  Bullet("Performance budget: app startup <2s, lesson load <500ms, stroke latency <16ms"),
  Bullet("Crash rate target: <0.1% sessions"),

  H2("7.3 AI/ML Workstream"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "AI Lead" }]),
  PMixed([{ text: "North star: ", bold: true }, { text: "AI feedback that beginners trust \u2014 encouraging, specific, kind, useful, and on-device by Year 1." }]),

  PBold("Year 0 model strategy:"),
  makeTable(
    ["Capability", "Year 0 (cloud-first)", "Year 1 (on-device)"],
    [
      ["Stroke analysis", "GPT-4V / Claude (via API)", "Custom small VLM (~3B params)"],
      ["Proportion checking", "MediaPipe + heuristics", "Same, optimized"],
      ["Lesson recommendation", "Server-side rules", "On-device personalization"],
      ["Tone of feedback", "RLHF-tuned LLM", "Distilled smaller LLM"],
    ],
    [2400, 3480, 3480]
  ),
  Spacer(),

  PBold("Why cloud-first in Year 0:"),
  Bullet("Faster iteration on quality"),
  Bullet("We need data to train Year 1 on-device models"),
  Bullet("Beta users explicitly opt in to cloud during beta phase"),

  PBold("Why on-device by Year 1:"),
  Bullet("Privacy promise to parents and educators"),
  Bullet("Latency: feedback must feel instant"),
  Bullet("Cost: cloud inference at scale eats margin"),

  PBold("Feedback quality principles:"),
  BulletMixed([{ text: "Specific over generic. ", bold: true }, { text: "\u201CYour line is wobbly here\u201D beats \u201Cgood job.\u201D" }]),
  BulletMixed([{ text: "One thing at a time. ", bold: true }, { text: "Beginners can't process 5 critiques." }]),
  BulletMixed([{ text: "Encouraging frame. ", bold: true }, { text: "Lead with what works, then suggest improvement." }]),
  BulletMixed([{ text: "No shame. ", bold: true }, { text: "Never use words like \u201Cwrong,\u201D \u201Cbad,\u201D \u201Cincorrect.\u201D" }]),
  BulletMixed([{ text: "Age-aware. ", bold: true }, { text: "Tone for 14-year-old \u2260 tone for 40-year-old." }]),

  H2("7.4 Hardware Workstream (Year 1+)"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "Hardware Lead (to be hired Q3 of Year 0)" }]),

  PBold("Year 0 activity:"),
  Bullet("Profile AI workload on candidate SoCs"),
  Bullet("Validate $80\u2013120 BOM target"),
  Bullet("Reference design exploration with Qualcomm and MediaTek"),
  Bullet("Industrial design exploration (no commitments)"),

  PBold("Year 1 deliverable: AI Companion Box"),
  Bullet("Stackable form factor with TourBox controller"),
  Bullet("Snapdragon 8 Gen 3 or Dimensity 9300 class SoC"),
  Bullet("12 GB LPDDR5X, 128 GB storage"),
  Bullet("USB-C to host, USB-C PD power"),
  Bullet("Passive cooling (no fan)"),
  Bullet("~$80\u2013120 BOM, $299 retail bundle"),

  PBold("Hardware principles:"),
  BulletMixed([{ text: "Off-the-shelf reference designs first. ", bold: true }, { text: "Don't custom-silicon. We don't have time." }]),
  BulletMixed([{ text: "Reuse TourBox supply chain. ", bold: true }, { text: "Same factories, same QA." }]),
  BulletMixed([{ text: "Plan for 100K units year 1. ", bold: true }, { text: "Pricing power kicks in at scale." }]),
  BulletMixed([{ text: "Built-in upgrade path. ", bold: true }, { text: "Year 1 device should remain useful when Year 2 ships." }]),

  H2("7.5 Design Workstream"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "Design Lead" }]),
  PMixed([{ text: "North star: ", bold: true }, { text: "Visual + interaction design that feels like a creative tool but communicates \u201CI am for beginners.\u201D" }]),

  PBold("Brand positioning:"),
  Bullet("Different sub-brand from TourBox pro line"),
  Bullet("Sub-brand name: \u201CTourBox Coach\u201D (working name \u2014 may evolve)"),
  Bullet("Voice: encouraging, warm, slightly playful, never condescending"),
  Bullet("Visual style: warm purple/violet palette (inherited from TourBox brand), softer edges, more whitespace than pro line"),

  PBold("Design principles:"),
  BulletMixed([{ text: "Whitespace breeds confidence. ", bold: true }, { text: "Beginners feel overwhelmed. Empty space is comfort." }]),
  BulletMixed([{ text: "One primary action per screen. ", bold: true }, { text: "Never make a beginner choose between 5 buttons." }]),
  BulletMixed([{ text: "Celebrate small wins. ", bold: true }, { text: "Animation, sound, color \u2014 make completing a lesson feel good." }]),
  BulletMixed([{ text: "Visible progress. ", bold: true }, { text: "Beginners need to see they're improving." }]),
  BulletMixed([{ text: "Accessible by default. ", bold: true }, { text: "Color contrast WCAG AA minimum." }]),

  H2("7.6 Marketing & GTM Workstream"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "Marketing Lead" }]),
  PMixed([{ text: "North star: ", bold: true }, { text: "Beginners discover us, trust us, and tell their friends. Growth comes from delight, not paid ads." }]),

  PBold("Year 1 launch strategy \u2014 channels:"),
  BulletMixed([{ text: "Channel 1: ", bold: true }, { text: "Direct-to-consumer via TourBox.com (warm audience)" }]),
  BulletMixed([{ text: "Channel 2: ", bold: true }, { text: "Amazon (cold acquisition, high volume)" }]),
  BulletMixed([{ text: "Channel 3: ", bold: true }, { text: "Education partnerships (art schools, after-school programs)" }]),
  BulletMixed([{ text: "Channel 4: ", bold: true }, { text: "Gift / hobby retail (long-term)" }]),

  PBold("Positioning principles:"),
  BulletMixed([{ text: "Don't hide that it's AI ", bold: true }, { text: "\u2014 use AI honestly as a teaching tool" }]),
  BulletMixed([{ text: "Lead with privacy ", bold: true }, { text: "\u2014 \u201Ceverything stays on your device\u201D is a huge differentiator for parents" }]),
  BulletMixed([{ text: "Show real student work ", bold: true }, { text: "\u2014 not glossy renders. Imperfect, honest progression" }]),
  BulletMixed([{ text: "Demo the magic moment ", bold: true }, { text: "\u2014 Ghost Guide Dial fade is our category-defining feature" }]),

  H2("7.7 Pro Parallel Track"),
  PMixed([{ text: "Owner: ", bold: true }, { text: "Pro Lead (1, can be Engineering Lead initially)" }]),
  PMixed([{ text: "North star: ", bold: true }, { text: "Existing 300K pro customers feel TourBox is investing in them too." }]),

  PBold("Year 0\u20131 deliverables:"),
  Bullet("TourBox AI Bridge app (Mac, Win) \u2014 4 months, 2 engineers"),
  Bullet("ComfyUI custom node \u2014 2 months, 1 engineer"),
  Bullet("Krita and Photoshop plugins \u2014 6 months, 2 engineers"),
  Bullet("Open SDK alpha (Year 2)"),

  PBold("Coordinate but don't conflate:"),
  Bullet("Different team, different deliverables"),
  Bullet("Shared infrastructure (TourBox SDK, brand)"),
  Bullet("Lessons learned flow both directions"),
);

// === 8. Working Principles ===
sections.push(
  Divider(),
  H1("8. Working Principles & Culture"),

  H2("How we make decisions"),
  BulletMixed([{ text: "Default to action. ", bold: true }, { text: "A wrong decision made fast is usually better than a correct decision made slow. We can correct course quickly." }]),
  BulletMixed([{ text: "Disagree and commit. ", bold: true }, { text: "When the team is split, the Accountable person makes the call. Everyone else commits and stops re-litigating." }]),
  BulletMixed([{ text: "Strong opinions, loosely held. ", bold: true }, { text: "Have a perspective. Argue for it. Update when you see new evidence." }]),
  BulletMixed([{ text: "Killing is success. ", bold: true }, { text: "When something isn't working, killing it is a win, not a failure. Sunk cost is the enemy." }]),
  BulletMixed([{ text: "Customer over hierarchy. ", bold: true }, { text: "If the user research says one thing and the leader says another, the leader doesn't automatically win. Bring the data." }]),

  H2("How we work"),
  PMixed([{ text: "Speed over polish in Year 0. ", bold: true }, { text: "We're validating, not perfecting. Ship the rough version, learn, then polish what matters." }]),
  PMixed([{ text: "Async first. ", bold: true }, { text: "Default to writing. Save synchronous time for unblocking, brainstorming, and connection." }]),
  PMixed([{ text: "Documentation is the product. ", bold: true }, { text: "If it's not written down, it doesn't exist. Decisions, designs, and learnings all get docs." }]),
  PMixed([{ text: "Small batches. ", bold: true }, { text: "Break work into 1\u20132 week chunks. Long projects without milestones drift." }]),
  PMixed([{ text: "No heroes. ", bold: true }, { text: "Sustainable pace beats sprints to burnout. We have years of work ahead." }]),

  H2("How we treat each other"),
  BulletMixed([{ text: "Be kind, be direct. ", bold: true }, { text: "Both. Niceness without honesty is poison; bluntness without kindness is poison too." }]),
  BulletMixed([{ text: "Assume good intent. ", bold: true }, { text: "When something seems off, ask first, accuse never." }]),
  BulletMixed([{ text: "Credit generously. ", bold: true }, { text: "Recognize specific work by specific people." }]),
  BulletMixed([{ text: "Disagree with ideas, not people. ", bold: true }, { text: "\u201CI think this approach is wrong because X\u201D not \u201Cyou are wrong.\u201D" }]),
  BulletMixed([{ text: "Make space for newcomers. ", bold: true }, { text: "Loudest voice \u2260 best idea. Pull quiet people into the conversation." }]),
);

// === 9. Success Metrics ===
sections.push(
  Divider(),
  H1("9. Success Metrics & Reporting"),

  H2("North-Star Metric"),
  Quote("30-Day Active Learner: a user who completes at least one lesson per week for 4 consecutive weeks."),
  P("This is the metric that proves we're a habit, not a novelty."),

  H2("Year 0 Gate Metrics"),
  makeTable(
    ["Metric", "Target", "Reviewed"],
    [
      ["Paid beta users", "1,000+", "Monthly"],
      ["30-day retention", "40%+", "Weekly"],
      ["NPS (beginner segment)", "40+", "Monthly"],
      ["Monthly willingness-to-pay", "$15+", "Monthly"],
      ["Lessons per active user per week", "3+", "Weekly"],
    ],
    [3500, 1500, 4360]
  ),
  Spacer(),

  H2("Year 1 Targets"),
  makeTable(
    ["Metric", "Target"],
    [
      ["Coach Bundle units shipped", "50,000"],
      ["Revenue", "$15M"],
      ["Hardware gross margin", "~55%"],
      ["90-day retention", "25%+"],
      ["NPS", "50+"],
      ["Subscription attach rate", "40%"],
    ],
    [4500, 4860]
  ),
  Spacer(),

  H2("Reporting cadence"),
  makeTable(
    ["Frequency", "Format", "Audience"],
    [
      ["Daily", "Slack #metrics auto-posts", "Whole team"],
      ["Weekly", "Workstream lead written update", "Whole team"],
      ["Bi-weekly", "All-hands metrics review (30 min)", "Whole team"],
      ["Monthly", "Initiative Lead \u2192 CEO", "Leadership"],
      ["Quarterly", "Strategy review, OKR setting", "Leadership + workstream leads"],
    ],
    [1800, 3700, 3860]
  ),
  Spacer(),
);

// === 10. Risks ===
sections.push(
  Divider(),
  H1("10. Risk Register"),
  P("We track risks explicitly. Each has an owner. Each has a watch metric. Quarterly review and update."),

  H2("Top risks"),

  H3("R1: Beginner segment doesn't validate"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Medium  \u2022  " }, { text: "Impact: ", bold: true }, { text: "Critical (kills the program)  \u2022  " }, { text: "Owner: ", bold: true }, { text: "Product Manager" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "Year 0 gate metrics \u2014 especially 30-day retention" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "Phase 0a structured to fail fast. By Month 4 we know if retention is heading toward 40%. If trending below 25% by Month 4, we pivot before spending Q3 budget." }]),

  H3("R2: AI feedback quality is too generic"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Medium-High  \u2022  " }, { text: "Impact: ", bold: true }, { text: "High  \u2022  " }, { text: "Owner: ", bold: true }, { text: "AI Lead" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "\u201CFeedback felt helpful\u201D rate during alpha and beta" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "Co-design with art teachers from day one. Manual review of all alpha feedback samples. RLHF tuning monthly." }]),

  H3("R3: Apple or Adobe enters this space"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Medium  \u2022  " }, { text: "Impact: ", bold: true }, { text: "High  \u2022  " }, { text: "Owner: ", bold: true }, { text: "Initiative Lead" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "Industry news monitoring, patent filings" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "Curriculum and community moats compound over time. Move fast in Year 0\u20131. By Year 2 we should be the obvious answer in the category." }]),

  H3("R4: Hardware delays push timeline"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Medium  \u2022  " }, { text: "Impact: ", bold: true }, { text: "Medium-High  \u2022  " }, { text: "Owner: ", bold: true }, { text: "Hardware Lead" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "Sample availability, certification timelines" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "Off-the-shelf reference designs only. No custom silicon in Year 1. Maintain second-source supplier relationships." }]),

  H3("R5: TourBox brand is wrong for beginner segment"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Low-Medium  \u2022  " }, { text: "Impact: ", bold: true }, { text: "Medium  \u2022  " }, { text: "Owner: ", bold: true }, { text: "Marketing Lead" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "Beginner brand survey scores" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "Sub-brand \u201CCoach\u201D positioning. Different distribution channels. Testing with non-existing-customers in beta." }]),

  H3("R6: Privacy / safety incident with kid user"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Low  \u2022  " }, { text: "Impact: ", bold: true }, { text: "Critical (brand-defining)  \u2022  " }, { text: "Owner: ", bold: true }, { text: "Legal/Security + AI Lead" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "All AI outputs sampled and reviewed" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "On-device processing by Year 1. Manual safety review of feedback model outputs. Clear parental controls. Bug bounty program." }]),

  H3("R7: Team burnout"),
  PMixed([{ text: "Probability: ", bold: true }, { text: "Medium  \u2022  " }, { text: "Impact: ", bold: true }, { text: "High  \u2022  " }, { text: "Owner: ", bold: true }, { text: "Initiative Lead + each manager" }]),
  PMixed([{ text: "Watch metric: ", bold: true }, { text: "Team pulse survey (monthly), unplanned turnover" }]),
  PMixed([{ text: "Mitigation: ", bold: true }, { text: "Realistic timelines. No heroics culture. 4-day on-call rotations. Mandatory time off after major launches." }]),

  H2("Quarterly pre-mortem"),
  PMixed([{ text: "Every quarter, in a 60-minute meeting, we ask: " }, { text: "\u201CIt's 6 months from now. The program failed. What killed it?\u201D", italics: true }]),
  P("Each lead writes their answer privately. We share, cluster, and update the risk register. This catches new risks the project plan misses."),
);

// === 11. Communication ===
sections.push(
  Divider(),
  H1("11. Communication, Tools & Rituals"),

  H2("Tool stack"),
  makeTable(
    ["Purpose", "Tool", "Why"],
    [
      ["Async writing / docs", "Notion", "All decisions, specs, retros"],
      ["Code", "GitHub", "Standard"],
      ["Project management", "Linear", "Engineering tasks"],
      ["Design", "Figma", "Standard"],
      ["Communication", "Slack", "Default, but written-first"],
      ["Calls", "Google Meet / Zoom", "Recordings shared"],
      ["Analytics", "PostHog", "Open source, privacy-first"],
      ["Customer feedback", "Productboard", "Aggregated requests"],
      ["Beta community", "Discord", "Beta users only"],
    ],
    [2400, 2400, 4560]
  ),
  Spacer(),

  H2("Meeting cadence"),
  makeTable(
    ["Meeting", "Frequency", "Owner", "Purpose"],
    [
      ["All-hands", "Bi-weekly", "Initiative Lead", "Updates, metrics, Q&A"],
      ["Workstream sync", "Weekly", "Workstream Lead", "Tactical alignment"],
      ["Design + Engineering", "Weekly", "Design Lead", "Spec review"],
      ["AI quality review", "Weekly", "AI Lead", "Sample review, tuning"],
      ["Curriculum review", "Weekly", "Curriculum Lead", "New lessons reviewed"],
      ["Beta user calls", "2\u00D7 per week", "UX Researcher", "Direct feedback"],
      ["Retro", "Every 2 weeks", "Program Manager", "What worked, what didn't"],
      ["OKR review", "Quarterly", "Initiative Lead", "Big picture realign"],
      ["Pre-mortem", "Quarterly", "Strategy team", "Risk update"],
    ],
    [2400, 1700, 2400, 2860]
  ),
  Spacer(),

  PBold("Meeting rules:"),
  Bullet("No meeting without an agenda."),
  Bullet("No meeting that could've been a doc."),
  BulletMixed([{ text: "Always end with: " }, { text: "\u201Cwho does what by when?\u201D ", italics: true }, { text: "\u2014 and write it down." }]),
  Bullet("Notes published within 24 hours, every time."),

  H2("Daily rhythm"),
  Bullet("Async by default. Don't expect responses outside core hours."),
  Bullet("Core hours: 10am\u20133pm local time for whichever zone the workstream is anchored in."),
  Bullet("Slack response expectation: same business day for non-urgent; 2 hours for urgent."),
  Bullet("\u201CDo not disturb\u201D hours respected. Heads-down time matters."),

  H2("Documentation standards"),
  P("Every important thing gets a doc. Examples:"),
  BulletMixed([{ text: "Decision docs (DACI): ", bold: true }, { text: "Who decided what, why, when, and what we considered." }]),
  BulletMixed([{ text: "Design specs: ", bold: true }, { text: "What we're building, how it should look, why." }]),
  BulletMixed([{ text: "Engineering specs: ", bold: true }, { text: "How we'll build it, key tradeoffs." }]),
  BulletMixed([{ text: "Retros: ", bold: true }, { text: "What worked, what didn't, what we'll change." }]),
  BulletMixed([{ text: "One-pagers: ", bold: true }, { text: "For any cross-functional initiative." }]),
);

// === 12. FAQ ===
sections.push(
  Divider(),
  H1("12. Frequently Asked Questions"),

  PBold("Q: Is the pro market dead to us now?"),
  P("A: No. We have a parallel pro track (Section 4) protecting and expanding for our 300K existing customers. Beginner is the new bet, not the only bet."),

  PBold("Q: What if we miss the Year 0 gate metrics?"),
  P("A: We pivot or kill. We've explicitly designed Year 0 to fail fast and cheaply. Better to spend $1.5M and learn than $10M and learn the same thing later."),

  PBold("Q: How is this different from Procreate / Krita / Adobe Fresco?"),
  P("A: They're tools. We're a teacher. They assume you know what you're doing; we assume you don't and walk you through it."),

  PBold("Q: Why on-device AI? Cloud is easier."),
  P("A: Two reasons. (1) Privacy \u2014 our target users include kids and education. Cloud AI is a non-starter. (2) Cost at scale \u2014 cloud inference at 100K monthly active users would eat our margin."),

  PBold("Q: Why not just make a software-only product?"),
  P("A: Hardware is our defensible advantage. Software-only puts us in race-to-the-bottom land with infinite competitors. Hardware + curriculum + AI is a moat."),

  PBold("Q: What if Apple / Adobe / Google launches this first?"),
  P("A: They might. Our 12-month head start matters. Curriculum and community moats compound over time. We've planned for this \u2014 see Risk R3."),

  PBold("Q: Will we kill the existing TourBox products?"),
  P("A: No. They continue. Same factory, same supply chain, same team for those. Coach is a new line, not a replacement."),

  PBold("Q: Why is this called \u201CTourBox Coach\u201D and not something else?"),
  P("A: Working name. Could change. Marketing Lead owns final naming."),

  PBold("Q: Can I work on both Coach and the pro track?"),
  P("A: Generally no \u2014 context switching kills productivity. Some shared infrastructure roles are exceptions (e.g., TourBox SDK engineering)."),

  PBold("Q: What if I disagree with the strategy?"),
  P("A: Talk to your lead. If still unresolved, talk to the Initiative Lead. Disagreement is healthy; silent resentment is not."),

  PBold("Q: When do I see the new TourBox prototype?"),
  P("A: Year 1 prototype shows late Q4 of Year 0. Until then, software is on the existing TourBox."),
);

// === 13. Glossary ===
sections.push(
  Divider(),
  H1("13. Glossary & Appendices"),

  H2("Glossary"),
  makeTable(
    ["Term", "Definition"],
    [
      ["AI Companion Box", "Year 1 hardware product \u2014 stackable AI compute box for the controller"],
      ["AI Sight", "Our internal name for vision-AI feedback after each stroke"],
      ["BOM", "Bill of materials \u2014 component cost of hardware"],
      ["Coach Bundle", "Year 1 retail SKU: TourBox controller + AI Companion Box"],
      ["Coach Pro", "Year 2 product: integrated controller + AI + reference screen"],
      ["Coach Studio", "Year 3 flagship: pen display + integrated AI tutor"],
      ["Gate metric", "A non-negotiable threshold for advancing to the next phase"],
      ["Ghost Guide", "Translucent reference image overlay; opacity controlled by knob"],
      ["Haptic Brain", "Internal shorthand for \u201Ctactile hardware + intelligent software\u201D"],
      ["Initiative Lead", "The person overall accountable for the Coach program"],
      ["Intelligence Surface", "Our positioning frame \u2014 vs traditional \u201Ccontrol surface\u201D"],
      ["NPS", "Net Promoter Score \u2014 how likely users are to recommend"],
      ["NPU", "Neural processing unit \u2014 AI-specific chip"],
      ["RLHF", "Reinforcement learning from human feedback (model tuning)"],
      ["TOPS", "Trillion operations per second (NPU performance unit)"],
      ["Workstream", "A functional team (Engineering, Curriculum, AI, etc.)"],
    ],
    [2800, 6560]
  ),
  Spacer(),

  H2("Appendix A: Reading list"),
  PItalic("For new team members. None required, all encouraged."),

  PBold("Strategy and product:"),
  Bullet("Crossing the Chasm \u2014 Geoffrey Moore (we are early-market for the segment)"),
  Bullet("The Innovator's Dilemma \u2014 Clayton Christensen (why incumbents miss this)"),
  Bullet("Hooked \u2014 Nir Eyal (habit-building products)"),

  PBold("Education and learning:"),
  Bullet("Make It Stick \u2014 Brown, Roediger, McDaniel (how learning actually works)"),
  Bullet("The Talent Code \u2014 Daniel Coyle (deliberate practice, scaffolding)"),
  Bullet("Research papers on Duolingo's gamification approach"),

  PBold("Drawing and pedagogy:"),
  Bullet("Drawing on the Right Side of the Brain \u2014 Betty Edwards (foundational)"),
  Bullet("Keys to Drawing \u2014 Bert Dodson (technique progression)"),
  Bullet("Imaginative Realism \u2014 James Gurney (composition fundamentals)"),

  H2("Appendix B: Quick reference card"),
  PItalic("Print this. Pin it."),
  Spacer(),

  PMixed([{ text: "Our north star: ", bold: true }, { text: "TourBox becomes the platform that teaches the world to draw." }]),
  PMixed([{ text: "Year 0 mission: ", bold: true }, { text: "Validate that beginners pay to learn drawing with TourBox + AI." }]),
  PMixed([{ text: "Gate metrics: ", bold: true }, { text: "1K paid beta \u00B7 40% retention \u00B7 NPS 40+ \u00B7 $15+/mo WTP" }]),

  PBold("When in doubt:"),
  Bullet("Does it serve the beginner?"),
  Bullet("Does it respect privacy?"),
  Bullet("Does it ship faster than perfect?"),
  Bullet("Have I written it down?"),

  PBold("Non-negotiables:"),
  Bullet("Privacy (on-device by Year 1)"),
  Bullet("Encouraging tone (never harsh)"),
  Bullet("Tactile hardware as our moat"),
  Bullet("Gate-metric discipline (we kill if we miss)"),

  Spacer(),
  Divider(),

  PItalic("End of playbook. Suggestions, questions, corrections \u2014 go to the comments thread or grab the doc owner."),
  PItalic("Last reminder: this is a living document. If reality changes and the playbook doesn't, that's our fault, not reality's. Push the update."),
);

// ──── DOCUMENT ASSEMBLY ────

const doc = new Document({
  creator: "TourBox Strategy Team",
  title: "TourBox Coach Team Playbook",
  description: "Internal team playbook for the TourBox Coach initiative",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } }, // 11pt default
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 40, bold: true, font: "Georgia", color: C.primaryDk },
        paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Georgia", color: C.primary },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Calibri", color: C.textDk },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "TourBox Coach \u2014 Team Playbook", size: 16, color: C.textMd, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ size: 16, color: C.textMd, children: ["Page ", PageNumber.CURRENT] })],
          })],
        }),
      },
      children: sections,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("/home/claude/TourBox_Coach_Team_Playbook.docx", buffer);
  console.log("\u2713 Done \u2014 TourBox_Coach_Team_Playbook.docx");
});
