/**
 * Builds the 80 new kid pictures listed in levels/_notes.
 * Run: node levels/scripts/make-pictures.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "pictures");
const NOTES = path.join(ROOT, "_notes");

const INK = "#1e293b";
const S = `fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const SF = (fill) => `fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

function dedupeAttrs(markup) {
  return markup.replace(/<[^>]+>/g, (tag) => {
    const open = tag.match(/^<([a-zA-Z0-9:-]+)([\s\S]*?)(\/?)>$/);
    if (!open || tag.startsWith("</")) return tag;
    const map = new Map();
    const order = [];
    const re = /([:@\w-]+)="([^"]*)"/g;
    let attr;
    while ((attr = re.exec(open[2]))) {
      if (!map.has(attr[1])) order.push(attr[1]);
      map.set(attr[1], attr[2]);
    }
    const body = order.map((key) => `${key}="${map.get(key)}"`).join(" ");
    return `<${open[1]}${body ? " " + body : ""}${open[3] ? "/" : ""}>`;
  });
}

function svg(inner, bg = "#fff7ed") {
  return dedupeAttrs(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="${bg}"/>${inner}</svg>\n`
  );
}

function face(cx, cy, mood) {
  const skin = "#fdba74";
  let brows = "";
  let mouth = "";
  let extra = "";
  if (mood === "angry") {
    brows = `<path d="M${cx - 16} ${cy - 8} l12 6 M${cx + 16} ${cy - 8} l-12 6" ${S}/>`;
    mouth = `<path d="M${cx - 10} ${cy + 14} q10 -10 20 0" ${S}/>`;
    extra = `<path d="M${cx - 28} ${cy - 22} q-8 -14 4 -6 M${cx + 28} ${cy - 22} q8 -14 -4 -6" ${S}/>`;
  } else if (mood === "bored") {
    brows = `<path d="M${cx - 16} ${cy - 6} h12 M${cx + 4} ${cy - 6} h12" ${S}/>`;
    mouth = `<ellipse cx="${cx}" cy="${cy + 14}" rx="6" ry="8" ${SF("#f9a8d4")}/>`;
  } else if (mood === "thirsty") {
    brows = `<path d="M${cx - 16} ${cy - 4} q6 -4 12 0 M${cx + 4} ${cy - 4} q6 -4 12 0" ${S}/>`;
    mouth = `<path d="M${cx - 8} ${cy + 16} h16" ${S}/>`;
    extra = `<path d="M${cx + 22} ${cy + 2} q6 10 0 16 q-6 -6 0 -16" ${SF("#7dd3fc")}/>`;
  } else {
    brows = `<path d="M${cx - 16} ${cy - 6} h10 M${cx + 6} ${cy - 6} h10" ${S}/>`;
    mouth = `<path d="M${cx - 8} ${cy + 12} q8 8 16 0" ${S}/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="28" ${SF(skin)}/>
    <circle cx="${cx - 10}" cy="${cy}" r="3" fill="${INK}"/>
    <circle cx="${cx + 10}" cy="${cy}" r="3" fill="${INK}"/>
    ${brows}${mouth}${extra}`;
}

function person(x, y, shirt) {
  return `<circle cx="${x}" cy="${y}" r="11" ${SF("#fdba74")}/>
    <path d="M${x - 8} ${y - 8} q8 -10 16 0" ${S}/>
    <path d="M${x} ${y + 11} v18" ${S}/>
    <path d="M${x - 16} ${y + 20} h32 v18 h-32 z" ${SF(shirt)}/>
    <path d="M${x} ${y + 20} l-16 8 M${x} ${y + 20} l16 8" ${S}/>
    <path d="M${x} ${y + 38} l-8 18 M${x} ${y + 38} l8 18" ${S}/>`;
}

const pics = {};

pics.dolphin = svg(
  `<ellipse cx="78" cy="90" rx="54" ry="24" ${SF("#38bdf8")}/>
   <path d="M124 82 q28 -36 6 -4" ${SF("#38bdf8")}/>
   <path d="M36 80 q-18 -28 18 -6" ${SF("#7dd3fc")}/>
   <path d="M78 112 q8 22 0 8" ${SF("#38bdf8")}/>
   <circle cx="48" cy="86" r="3" fill="${INK}"/>
   <path d="M34 96 q12 8 20 -2" ${S}/>
   <path d="M16 128 q16 -10 32 0 t32 0 t32 0 t32 0" ${S} stroke="#0284c7"/>`,
  "#e0f2fe"
);

pics.eye = svg(
  `<path d="M18 80 q62 -48 124 0 q-62 48 -124 0 z" ${SF("#fff")}/>
   <circle cx="80" cy="80" r="24" ${SF("#38bdf8")}/>
   <circle cx="80" cy="80" r="12" fill="${INK}"/>
   <circle cx="88" cy="74" r="4" fill="#fff"/>`
);

pics.finger = svg(
  `<path d="M70 28 h20 v70 h-20 z" ${SF("#fdba74")}/>
   <path d="M48 78 h22 v36 h-18 q-8 0 -8 -10 z" ${SF("#fdba74")}/>
   <path d="M90 86 h18 v28 h-18 z" ${SF("#fdba74")}/>
   <path d="M46 114 h70 v22 h-70 z" ${SF("#fdba74")}/>
   <path d="M74 36 h4" ${S}/>`
);

pics.ankle = svg(
  `<path d="M70 18 h22 v70 l28 18 v16 h-78 v-16 l28 -18 z" ${SF("#fdba74")}/>
   <path d="M62 78 h40" ${S} stroke="#ef4444" stroke-width="5"/>
   <ellipse cx="92" cy="124" rx="36" ry="14" ${SF("#fdba74")}/>`
);

pics.tongue = svg(
  `<path d="M30 58 q50 -30 100 0 v36 q-50 20 -100 0 z" ${SF("#fecdd3")}/>
   <path d="M48 70 h64" ${S}/>
   <path d="M58 78 q22 36 44 0 v-8 h-44 z" ${SF("#f472b6")}/>
   <circle cx="58" cy="64" r="3" fill="#fff"/><circle cx="102" cy="64" r="3" fill="#fff"/>`
);

pics.pants = svg(
  `<path d="M48 36 h64 l8 18 -22 8 -6 62 h-18 l-4 -62 -4 62 h-18 l-6 -62 -22 -8 z" ${SF("#2563eb")}/>
   <path d="M80 54 v70" ${S}/>
   <path d="M58 48 h12 M90 48 h12" ${S}/>`
);

pics.skirt = svg(
  `<path d="M58 28 h44 v16 h-44 z" ${SF("#f472b6")}/>
   <path d="M40 44 h80 l-14 84 h-52 z" ${SF("#fb7185")}/>
   <path d="M70 44 l-8 84 M90 44 l8 84" ${S}/>`
);

pics.shorts = svg(
  `<path d="M46 48 h68 l6 14 -20 6 2 36 h-20 l-2 -36 -2 36 h-20 l2 -36 -20 -6 z" ${SF("#22c55e")}/>
   <path d="M80 62 v40" ${S}/>`
);

pics.sweater = svg(
  `<path d="M48 48 l-24 18 10 16 14 -10 v58 h64 v-58 l14 10 10 -16 -24 -18 -16 12 h-32 z" ${SF("#ef4444")}/>
   <path d="M64 48 q16 16 32 0" ${S}/>`
);

pics.sandal = svg(
  `<path d="M28 96 q20 -28 70 -8 l28 6 q8 18 -8 22 h-86 q-12 -4 -4 -20 z" ${SF("#f59e0b")}/>
   <path d="M48 86 q10 16 4 28 M78 80 q8 18 2 30 M104 84 q-4 16 -2 26" ${S}/>`
);

pics.jeans = svg(
  `<path d="M48 34 h64 l10 16 -24 8 -4 68 h-20 l-2 -68 -2 68 h-20 l-4 -68 -24 -8 z" ${SF("#1d4ed8")}/>
   <path d="M62 70 h14 v16 h-14 z M86 70 h14 v16 h-14 z" ${SF("#93c5fd")}/>
   <path d="M80 50 v78" ${S} stroke="#bfdbfe"/>`
);

pics.apron = svg(
  `<path d="M58 24 h44 l6 18 h-56 z" ${SF("#fff")}/>
   <path d="M46 42 h68 v82 h-68 z" ${SF("#fb923c")}/>
   <path d="M62 78 h36 v28 h-36 z" ${SF("#fff7ed")}/>
   <path d="M52 42 q-16 10 -8 28 M108 42 q16 10 8 28" ${S}/>`
);

pics.tomato = svg(
  `<circle cx="80" cy="90" r="40" ${SF("#ef4444")}/>
   <path d="M80 50 q-8 16 -18 8 q10 2 18 10 q8 -8 18 -10 q-10 8 -18 -8" ${SF("#22c55e")}/>
   <circle cx="66" cy="84" r="6" fill="#fecaca" opacity="0.8"/>`
);

pics.ladybug = svg(
  `<ellipse cx="80" cy="96" rx="40" ry="32" ${SF("#ef4444")}/>
   <circle cx="80" cy="62" r="16" ${SF("#1e293b")}/>
   <path d="M80 64 v64" ${S}/>
   <circle cx="64" cy="90" r="6" fill="${INK}"/><circle cx="98" cy="92" r="6" fill="${INK}"/>
   <circle cx="70" cy="112" r="5" fill="${INK}"/><circle cx="96" cy="114" r="5" fill="${INK}"/>
   <path d="M64 52 q-16 -16 -8 -4 M96 52 q16 -16 8 -4" ${S}/>`,
  "#fef3c7"
);

pics.ocean = svg(
  `<circle cx="122" cy="36" r="16" ${SF("#facc15")}/>
   <path d="M0 90 h160 v70 h-160 z" fill="#0284c7"/>
   <path d="M0 100 q20 -16 40 0 t40 0 t40 0 t40 0 v60 h-160 z" fill="#38bdf8"/>
   <path d="M0 118 q20 -12 40 0 t40 0 t40 0 t40 0" ${S} stroke="#fff"/>`,
  "#e0f2fe"
);

pics.blueberry = svg(
  `<circle cx="58" cy="78" r="22" ${SF("#2563eb")}/>
   <circle cx="96" cy="70" r="24" ${SF("#1d4ed8")}/>
   <circle cx="78" cy="104" r="22" ${SF("#3b82f6")}/>
   <path d="M90 48 q8 -16 18 -8" ${SF("#22c55e")}/>
   <circle cx="88" cy="64" r="3" fill="#bfdbfe"/>`
);

pics.cucumber = svg(
  `<ellipse cx="80" cy="82" rx="26" ry="52" transform="rotate(-18 80 82)" ${SF("#4ade80")}/>
   <path d="M62 48 q8 10 0 18 M70 40 q10 12 2 20 M78 36 q8 12 0 18" ${S} stroke="#166534"/>`
);

pics.tire = svg(
  `<circle cx="80" cy="80" r="52" ${SF("#111827")}/>
   <circle cx="80" cy="80" r="28" ${SF("#9ca3af")}/>
   <circle cx="80" cy="80" r="8" ${SF("#e5e7eb")}/>
   <path d="M80 52 v16 M80 92 v16 M52 80 h16 M92 80 h16" ${S}/>`,
  "#e5e7eb"
);

pics.chocolate = svg(
  `<rect x="36" y="40" width="88" height="80" rx="8" ${SF("#92400e")}/>
   <path d="M65 40 v80 M94 40 v80 M36 66 h88 M36 92 h88" ${S} stroke="#fcd34d"/>`
);

pics.flamingo = svg(
  `<path d="M48 110 q20 -10 36 -40 q8 -20 28 -16" ${S} stroke="#fb7185" stroke-width="8"/>
   <circle cx="112" cy="48" r="12" ${SF("#fb7185")}/>
   <path d="M122 46 h16" ${SF("#fb7185")}/>
   <path d="M70 108 v28 M86 112 v24" ${S} stroke="#fb7185" stroke-width="4"/>
   <path d="M40 78 q20 20 10 8" ${SF("#fda4af")}/>`,
  "#fce7f3"
);

pics.basketball = svg(
  `<circle cx="80" cy="80" r="48" ${SF("#f97316")}/>
   <path d="M80 32 v96 M32 80 h96 M42 48 q38 20 76 0 M42 112 q38 -20 76 0" ${S}/>`
);

pics.eggplant = svg(
  `<path d="M70 36 q20 -20 28 8 q18 8 8 18 q-40 90 -48 40 q-8 -28 12 -66 z" ${SF("#7e22ce")}/>
   <path d="M78 40 q6 -16 20 -8 q-8 6 -4 14" ${SF("#22c55e")}/>`
);

pics.violet = svg(
  `<circle cx="80" cy="78" r="10" ${SF("#facc15")}/>
   <ellipse cx="80" cy="48" rx="12" ry="20" ${SF("#7c3aed")}/>
   <ellipse cx="80" cy="108" rx="12" ry="20" ${SF("#7c3aed")}/>
   <ellipse cx="50" cy="78" rx="20" ry="12" ${SF("#8b5cf6")}/>
   <ellipse cx="110" cy="78" rx="20" ry="12" ${SF("#8b5cf6")}/>
   <path d="M80 118 v24" ${S} stroke="#166534" stroke-width="4"/>`,
  "#f5f3ff"
);

pics.belt = svg(
  `<rect x="18" y="64" width="124" height="28" rx="6" ${SF("#92400e")}/>
   <rect x="96" y="58" width="28" height="40" rx="4" ${SF("#fbbf24")}/>
   <circle cx="110" cy="78" r="4" fill="${INK}"/>
   <path d="M36 78 h48" ${S}/>`
);

pics.sunflower = svg(
  `<circle cx="80" cy="70" r="18" ${SF("#92400e")}/>
   ${Array.from({ length: 10 }, (_, i) => {
     const a = (i / 10) * Math.PI * 2;
     const x = 80 + Math.cos(a) * 34;
     const y = 70 + Math.sin(a) * 34;
     return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="12" ry="8" transform="rotate(${(i * 36).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" ${SF("#facc15")}/>`;
   }).join("")}
   <path d="M80 104 v40" ${S} stroke="#166534" stroke-width="5"/>
   <path d="M80 124 q-18 8 -16 16 M80 132 q16 4 18 14" ${SF("#22c55e")}/>`,
  "#fef9c3"
);

pics.mailbox = svg(
  `<rect x="70" y="78" width="12" height="58" ${SF("#9ca3af")}/>
   <path d="M28 78 h104 v-28 a28 28 0 0 0 -104 0 z" ${SF("#2563eb")}/>
   <rect x="108" y="36" width="28" height="10" ${SF("#ef4444")}/>
   <circle cx="46" cy="62" r="4" fill="#fde68a"/>`,
  "#ecfeff"
);

pics.toothbrush = svg(
  `<path d="M28 108 q40 -20 90 -8" ${S} stroke="#38bdf8" stroke-width="8"/>
   <rect x="96" y="70" width="36" height="18" rx="4" transform="rotate(-12 114 79)" ${SF("#fff")}/>
   <path d="M102 78 v10 M110 76 v12 M118 75 v12 M126 76 v10" ${S} stroke="#94a3b8"/>
   <circle cx="48" cy="70" r="10" ${SF("#bfdbfe")}/>`
);

pics.treehouse = svg(
  `<rect x="72" y="70" width="16" height="70" ${SF("#92400e")}/>
   <circle cx="80" cy="78" r="40" ${SF("#22c55e")}/>
   <rect x="48" y="58" width="64" height="36" ${SF("#f59e0b")}/>
   <path d="M44 58 l36 -24 36 24" ${SF("#b45309")}/>
   <rect x="74" y="70" width="14" height="18" ${SF("#7c2d12")}/>`,
  "#ecfccb"
);

pics.whistle = svg(
  `<path d="M28 78 h70 v22 h-70 z" ${SF("#e5e7eb")}/>
   <circle cx="46" cy="89" r="10" ${SF("#fff")}/>
   <path d="M98 78 h28 l-10 22 h-18 z" ${SF("#e5e7eb")}/>
   <path d="M36 78 q-8 -20 12 -16" ${S}/>
   <path d="M120 70 q10 -8 8 8 M128 66 q12 -6 6 12" ${S}/>`,
  "#f8fafc"
);

pics.thirsty = svg(
  `${face(62, 70, "thirsty")}
   <path d="M108 78 h28 v36 h-28 z" ${SF("#e0f2fe")}/>
   <path d="M112 90 h20" ${S} stroke="#38bdf8"/>`
);

pics.bored = svg(`${face(80, 78, "bored")}<path d="M40 40 q8 6 0 12" ${S}/>`, "#f1f5f9");

pics.angry = svg(`${face(80, 82, "angry")}`, "#fee2e2");

pics.onion = svg(
  `<ellipse cx="80" cy="96" rx="36" ry="32" ${SF("#f5f3ff")}/>
   <path d="M80 64 q-6 -20 0 -28 q6 8 0 28" ${SF("#22c55e")}/>
   <path d="M58 96 q22 10 44 0 M62 108 q18 8 36 0" ${S} stroke="#c4b5fd"/>`
);

pics.pizza = svg(
  `<path d="M80 28 l48 96 h-96 z" ${SF("#fbbf24")}/>
   <path d="M80 28 l48 96" ${S} stroke="#f59e0b"/>
   <circle cx="70" cy="80" r="7" ${SF("#ef4444")}/>
   <circle cx="92" cy="96" r="7" ${SF("#ef4444")}/>
   <circle cx="74" cy="108" r="6" ${SF("#ef4444")}/>`
);

pics.yogurt = svg(
  `<path d="M52 58 h56 l-8 70 h-40 z" ${SF("#fff")}/>
   <path d="M48 50 h64 v14 h-64 z" ${SF("#f9a8d4")}/>
   <ellipse cx="80" cy="64" rx="22" ry="6" ${SF("#fde68a")}/>
   <path d="M108 46 v70" ${S} stroke="#94a3b8" stroke-width="4"/>`
);

pics.women = svg(
  `${person(52, 48, "#f472b6")}
   <path d="M36 96 h32 l-4 40 h-24 z" ${SF("#f472b6")}/>
   ${person(108, 48, "#a78bfa")}
   <path d="M92 96 h32 l-4 40 h-24 z" ${SF("#a78bfa")}/>`,
  "#fdf2f8"
);

pics.tulip = svg(
  `<path d="M80 70 q-28 -8 -18 -36 q20 8 18 36 q28 -8 18 -36 q-20 8 -18 36 z" ${SF("#ef4444")}/>
   <path d="M80 78 v58" ${S} stroke="#166534" stroke-width="4"/>
   <path d="M80 110 q-20 6 -16 16" ${SF("#22c55e")}/>`,
  "#fff1f2"
);

pics.church = svg(
  `<rect x="48" y="70" width="64" height="66" ${SF("#e2e8f0")}/>
   <path d="M40 70 l40 -36 40 36" ${SF("#64748b")}/>
   <rect x="74" y="18" width="12" height="22" ${SF("#64748b")}/>
   <path d="M80 8 v16 M74 14 h12" ${S}/>
   <rect x="70" y="100" width="20" height="36" ${SF("#92400e")}/>
   <path d="M58 86 h10 v14 h-10 z M92 86 h10 v14 h-10 z" ${SF("#7dd3fc")}/>`,
  "#f8fafc"
);

pics.squid = svg(
  `<ellipse cx="80" cy="58" rx="28" ry="24" ${SF("#c084fc")}/>
   <circle cx="70" cy="54" r="4" fill="${INK}"/><circle cx="90" cy="54" r="4" fill="${INK}"/>
   <path d="M52 74 q-8 50 10 8 M64 78 q-4 56 8 6 M76 80 q0 58 4 4 M88 78 q6 56 -4 6 M100 74 q12 48 -8 8" ${S} stroke="#a855f7" stroke-width="5"/>`,
  "#faf5ff"
);

pics.square = svg(`<rect x="40" y="40" width="80" height="80" ${SF("#38bdf8")}/>`, "#e0f2fe");

pics.eraser = svg(
  `<rect x="28" y="64" width="104" height="36" rx="6" ${SF("#f9a8d4")}/>
   <rect x="28" y="64" width="28" height="36" ${SF("#94a3b8")}/>`
);

pics.notebook = svg(
  `<rect x="40" y="28" width="84" height="108" rx="4" ${SF("#fff")}/>
   <path d="M40 28 q-16 18 -8 36 q-10 20 8 36 q-12 16 0 36" ${S}/>
   <path d="M56 52 h52 M56 72 h52 M56 92 h40" ${S} stroke="#93c5fd"/>`
);

pics.wire = svg(
  `<path d="M30 80 q16 -28 0 -8 q16 28 0 8 q16 -28 0 -8 q16 28 0 8 q16 -28 0 -8 q16 28 0 8 q16 -28 32 0" ${S} stroke="#f59e0b" stroke-width="5"/>`
);

pics.cage = svg(
  `<path d="M40 48 h80 v70 h-80 z" ${S}/>
   <path d="M40 48 q40 -28 80 0" ${S}/>
   <path d="M56 48 v70 M72 44 v74 M88 44 v74 M104 48 v70" ${S}/>
   <path d="M36 118 h88" ${S}/>
   <circle cx="80" cy="78" r="8" ${SF("#facc15")}/>`
);

pics.straw = svg(
  `<path d="M48 70 h64 l-8 58 h-48 z" ${SF("#bfdbfe")}/>
   <path d="M96 36 q20 8 8 28" ${S} stroke="#f97316" stroke-width="6"/>
   <path d="M104 36 q18 0 10 18" ${S} stroke="#f97316" stroke-width="6"/>`
);

pics.shrimp = svg(
  `<path d="M36 90 q20 -40 48 -10 q20 20 28 -8 q16 8 8 24 q-20 28 -48 10 q-28 -8 -36 -16 z" ${SF("#fb7185")}/>
   <circle cx="108" cy="70" r="3" fill="${INK}"/>
   <path d="M40 100 q-10 16 6 10 M52 108 q-8 14 8 6" ${S}/>`,
  "#fff1f2"
);

pics.shrub = svg(
  `<ellipse cx="80" cy="100" rx="50" ry="28" ${SF("#16a34a")}/>
   <ellipse cx="58" cy="84" rx="28" ry="22" ${SF("#22c55e")}/>
   <ellipse cx="104" cy="82" rx="30" ry="24" ${SF("#4ade80")}/>
   <circle cx="70" cy="78" r="4" ${SF("#f472b6")}/>
   <circle cx="98" cy="74" r="4" ${SF("#facc15")}/>`,
  "#f0fdf4"
);

pics.shoes = svg(
  `<path d="M18 96 q16 -20 48 -6 l20 4 v16 h-64 q-10 -2 -4 -14 z" ${SF("#ef4444")}/>
   <path d="M78 100 q18 -22 52 -4 l16 6 v16 h-64 q-8 -4 -4 -18 z" ${SF("#2563eb")}/>`
);

pics.reading = svg(
  `<rect x="28" y="88" width="70" height="40" rx="4" ${SF("#fef3c7")}/>
   <path d="M28 88 q35 12 70 0" ${S}/>
   <path d="M98 36 h18 v28 h-10 l-8 10 z" ${SF("#fde68a")}/>
   <circle cx="118" cy="28" r="10" ${SF("#facc15")}/>
   <circle cx="124" cy="78" r="14" ${S}/>
   <path d="M112 86 q12 16 28 8" ${S}/>`,
  "#fffbeb"
);

pics.baking = svg(
  `<ellipse cx="78" cy="100" rx="36" ry="16" ${SF("#e2e8f0")}/>
   <path d="M42 100 q0 -28 36 -28 q36 0 36 28" ${SF("#fff")}/>
   <path d="M108 70 q20 -30 28 8" ${S} stroke="#94a3b8" stroke-width="5"/>
   <ellipse cx="40" cy="78" rx="16" ry="10" ${SF("#fde68a")}/>`,
  "#fffbeb"
);

pics.theater = svg(
  `<path d="M20 120 v-30 q60 -40 120 0 v30 z" ${SF("#1e293b")}/>
   <rect x="36" y="48" width="88" height="40" ${SF("#7dd3fc")}/>
   <rect x="70" y="100" width="20" height="14" ${SF("#facc15")}/>
   <circle cx="40" cy="36" r="6" ${SF("#facc15")}/>`,
  "#0f172a"
);

pics.drawing = svg(
  `<rect x="36" y="48" width="70" height="64" ${SF("#fff")}/>
   <path d="M48 96 q16 -20 20 0 q10 -24 22 8" ${S} stroke="#ef4444"/>
   <rect x="110" y="40" width="10" height="36" ${SF("#ef4444")}/>
   <rect x="110" y="78" width="10" height="36" ${SF("#22c55e")}/>
   <rect x="110" y="116" width="10" height="16" ${SF("#facc15")}/>`
);

pics.campsite = svg(
  `<path d="M30 120 l40 -64 40 64 z" ${SF("#f59e0b")}/>
   <rect x="96" y="78" width="28" height="36" rx="4" ${SF("#fde68a")}/>
   <path d="M110 70 q8 -16 0 -8" ${S} stroke="#f97316"/>
   <ellipse cx="48" cy="108" rx="22" ry="10" ${SF("#2563eb")}/>`,
  "#ecfccb"
);

pics.gardening = svg(
  `<path d="M36 70 h28 v48 h-28 z" ${SF("#38bdf8")}/>
   <path d="M50 70 q-6 -28 8 -36" ${S}/>
   <path d="M88 100 h40 v20 h-40 z" ${SF("#92400e")}/>
   <path d="M108 100 v-36" ${S} stroke="#166534" stroke-width="4"/>
   <circle cx="108" cy="58" r="8" ${SF("#4ade80")}/>`,
  "#f0fdf4"
);

pics.classroom = svg(
  `<rect x="28" y="28" width="104" height="64" ${SF("#166534")}/>
   <path d="M40 48 h80 M40 68 h60" ${S} stroke="#fff"/>
   <rect x="36" y="108" width="36" height="16" ${SF("#f9a8d4")}/>
   <rect x="90" y="104" width="28" height="20" ${SF("#fff")}/>`
);

pics["birds nearby"] = svg(
  `<path d="M70 96 q-28 -8 -20 -28 q28 8 20 28 q28 -8 24 -28 q-20 10 -24 28 z" ${SF("#92400e")}/>
   <ellipse cx="62" cy="78" rx="8" ry="10" ${SF("#fff7ed")}/>
   <ellipse cx="86" cy="74" rx="8" ry="10" ${SF("#fff7ed")}/>
   <path d="M40 50 q16 -16 8 4 M120 46 q-16 -18 -6 6" ${S}/>`,
  "#f0fdf4"
);

pics.painting = svg(
  `<rect x="78" y="36" width="56" height="70" ${SF("#fff")}/>
   <path d="M86 80 q16 -20 20 4 q12 -16 16 8" ${S} stroke="#a855f7"/>
   <ellipse cx="46" cy="100" rx="22" ry="14" ${SF("#92400e")}/>
   <circle cx="36" cy="96" r="5" fill="#ef4444"/><circle cx="50" cy="90" r="5" fill="#3b82f6"/>
   <path d="M46 86 v-30" ${S}/>`
);

pics["coaching or pe"] = svg(
  `<circle cx="48" cy="70" r="16" ${S}/>
   <path d="M48 54 v-16" ${S}/>
   <rect x="86" y="40" width="40" height="56" ${SF("#fff")}/>
   <path d="M96 56 h22 M96 70 h22 M96 84 h14" ${S}/>
   <circle cx="70" cy="110" r="14" ${SF("#f97316")}/>`
);

pics["a sleeping area"] = svg(
  `<rect x="28" y="78" width="104" height="28" rx="10" ${SF("#fff")}/>
   <path d="M36 78 q16 -28 32 0" ${SF("#bfdbfe")}/>
   <rect x="28" y="106" width="104" height="22" ${SF("#93c5fd")}/>`
);

pics.planting = svg(
  `<rect x="36" y="48" width="36" height="48" ${SF("#fde68a")}/>
   <circle cx="54" cy="70" r="8" ${SF("#22c55e")}/>
   <path d="M96 108 l28 -48" ${S} stroke="#92400e" stroke-width="6"/>
   <path d="M118 52 l16 8 -18 10 z" ${SF("#9ca3af")}/>
   <rect x="40" y="112" width="80" height="16" ${SF("#92400e")}/>`,
  "#f0fdf4"
);

pics["someone reading nearby"] = svg(
  `<path d="M36 46 h16 v40 h-8 l-8 12 z" ${SF("#fde68a")}/>
   <rect x="70" y="70" width="64" height="40" ${SF("#fff")}/>
   <path d="M102 70 v40" ${S}/>
   <path d="M40 120 h28 v16 h-28 z" ${SF("#fff")}/>
   <path d="M48 120 q6 -10 12 0" ${S} stroke="#92400e"/>`,
  "#fffbeb"
);

pics["baking nearby"] = svg(
  `<path d="M28 40 h40 l-6 70 h-28 z" ${SF("#fb923c")}/>
   <path d="M78 90 q16 -40 36 0" ${S} stroke="#94a3b8" stroke-width="5"/>
   <rect x="100" y="96" width="36" height="16" ${SF("#9ca3af")}/>
   <circle cx="112" cy="70" r="8" ${SF("#fde68a")}/>
   <circle cx="132" cy="74" r="8" ${SF("#fdba74")}/>`
);

pics["camping plans"] = svg(
  `<path d="M36 110 l30 -50 30 50 z" ${SF("#86efac")}/>
   <path d="M100 108 l8 -40 8 40" ${S}/>
   <path d="M108 68 v-20" ${S}/>
   <path d="M36 124 h100" ${S}/>`
);

pics["books being shelved"] = svg(
  `<rect x="28" y="36" width="70" height="90" ${SF("#94a3b8")}/>
   <rect x="36" y="48" width="12" height="28" ${SF("#ef4444")}/>
   <rect x="50" y="44" width="12" height="32" ${SF("#3b82f6")}/>
   <rect x="64" y="50" width="12" height="26" ${SF("#22c55e")}/>
   <rect x="108" y="70" width="28" height="36" ${SF("#e2e8f0")}/>`
);

pics.cleaning = svg(
  `<path d="M70 28 v70" ${S} stroke="#92400e" stroke-width="5"/>
   <path d="M48 98 h44 l-8 18 h-28 z" ${SF("#f97316")}/>
   <path d="M108 108 h28 l-6 16 h-16 z" ${SF("#64748b")}/>`
);

pics["it rained outside"] = svg(
  `<rect x="96" y="36" width="40" height="78" ${SF("#92400e")}/>
   <path d="M28 40 q20 8 16 36 q20 -8 28 10" ${S} stroke="#38bdf8" stroke-width="4"/>
   <path d="M36 100 q16 -16 40 -4 l16 8 v16 h-58 z" ${SF("#1d4ed8")}/>
   <path d="M40 70 l6 16 M58 64 l6 18" ${S} stroke="#0284c7"/>`,
  "#e0f2fe"
);

pics["someone walked in with dirty shoes"] = svg(
  `<rect x="20" y="36" width="120" height="90" ${SF("#f8fafc")}/>
   <ellipse cx="48" cy="78" rx="16" ry="10" ${SF("#92400e")}/>
   <ellipse cx="84" cy="96" rx="16" ry="10" ${SF("#92400e")}/>
   <ellipse cx="118" cy="112" rx="14" ry="8" ${SF("#a16207")}/>`,
  "#fef3c7"
);

pics["someone has been painting"] = svg(
  `<rect x="70" y="28" width="68" height="80" ${SF("#fff")}/>
   <path d="M82 80 q14 -24 18 6 q16 -20 22 10" ${S} stroke="#ef4444"/>
   <path d="M36 100 q8 -40 8 0" ${S} stroke="#92400e" stroke-width="5"/>
   <path d="M28 70 h20" ${S} stroke="#3b82f6" stroke-width="6"/>
   <path d="M30 58 q6 8 -2 10" ${S} stroke="#38bdf8"/>`,
  "#fdf4ff"
);

pics["someone is cooking"] = svg(
  `<rect x="28" y="96" width="104" height="16" ${SF("#e2e8f0")}/>
   <path d="M40 96 q10 -20 16 0 q8 -16 14 0" ${SF("#fde68a")}/>
   <path d="M96 88 q16 -28 28 0 q-8 8 -28 0" ${SF("#fff")}/>
   <path d="M104 88 q6 -16 14 0" ${S}/>`,
  "#fffbeb"
);

pics["someone borrowed books"] = svg(
  `<rect x="28" y="48" width="36" height="24" rx="3" ${SF("#fde68a")}/>
   <rect x="70" y="40" width="22" height="70" ${SF("#ef4444")}/>
   <rect x="94" y="48" width="18" height="62" ${SF("#3b82f6")}/>
   <rect x="114" y="56" width="16" height="54" ${SF("#22c55e")}/>`
);

pics["someone went skating"] = svg(
  `<path d="M28 110 h104" ${S} stroke="#94a3b8" stroke-width="6"/>
   <path d="M40 100 q20 -8 40 0 l10 8 h-54 z" ${SF("#fff")}/>
   <path d="M100 96 q16 -6 28 4 v10 h-32 z" ${SF("#fff")}/>
   <path d="M78 48 h28 v22 h-28 z" ${SF("#ef4444")}/>
   <path d="M86 48 v-10 h12 v10" ${S}/>`,
  "#e0f2fe"
);

pics["someone has been sewing"] = svg(
  `<rect x="36" y="70" width="50" height="36" ${SF("#f472b6")}/>
   <circle cx="108" cy="64" r="16" ${SF("#e2e8f0")}/>
   <path d="M108 48 v-16" ${S}/>
   <path d="M40 120 q30 -10 50 8 q20 10 30 -6" ${S} stroke="#a855f7"/>`
);

pics["someone watched birds"] = svg(
  `<circle cx="58" cy="78" r="18" ${S}/>
   <circle cx="96" cy="78" r="18" ${S}/>
   <path d="M76 78 h2" ${S}/>
   <rect x="40" y="108" width="70" height="28" ${SF("#fde68a")}/>
   <path d="M52 116 q10 -8 16 4 M78 118 q8 -10 14 2" ${S}/>`
);

pics["someone built a birdhouse"] = svg(
  `<path d="M78 40 l28 20 v36 h-56 v-36 z" ${SF("#f59e0b")}/>
   <circle cx="78" cy="74" r="6" fill="${INK}"/>
   <rect x="28" y="100" width="28" height="10" ${SF("#92400e")}/>
   <path d="M120 108 l-8 -36" ${S} stroke="#64748b" stroke-width="5"/>`
);

pics["someone watered plants"] = svg(
  `<path d="M36 78 h30 v28 h-30 z" ${SF("#38bdf8")}/>
   <path d="M66 90 h20 l8 8" ${S}/>
   <path d="M108 108 v-30" ${S} stroke="#166534" stroke-width="4"/>
   <circle cx="108" cy="70" r="14" ${SF("#22c55e")}/>
   <ellipse cx="108" cy="118" rx="24" ry="8" ${SF("#92400e")}/>
   <path d="M96 100 q4 6 0 8 M108 96 q4 8 0 10" ${S} stroke="#38bdf8"/>`,
  "#f0fdf4"
);

pics["someone looked at photos"] = svg(
  `<rect x="28" y="64" width="44" height="32" rx="6" ${SF("#111827")}/>
   <circle cx="50" cy="80" r="10" ${SF("#38bdf8")}/>
   <rect x="86" y="48" width="46" height="36" ${SF("#fff")}/>
   <rect x="92" y="92" width="40" height="30" ${SF("#fde68a")}/>
   <circle cx="104" cy="62" r="6" ${SF("#fdba74")}/>`
);

pics["someone is going camping"] = svg(
  `<ellipse cx="52" cy="90" rx="28" ry="16" ${SF("#2563eb")}/>
   <rect x="88" y="70" width="44" height="36" ${SF("#86efac")}/>
   <path d="M88 70 l22 -16 22 16" ${S}/>`
);

pics["someone cleaned up"] = svg(
  `<path d="M48 36 v64" ${S} stroke="#92400e" stroke-width="5"/>
   <path d="M30 100 h36 l-6 16 h-24 z" ${SF("#f97316")}/>
   <path d="M100 110 h36 l-8 14 h-20 z" ${SF("#64748b")}/>
   <path d="M24 132 h112" ${S} stroke="#86efac" stroke-width="6"/>`,
  "#f0fdf4"
);

pics["someone watched the stars"] = svg(
  `<rect width="160" height="160" fill="#0f172a"/>
   <circle cx="36" cy="36" r="2" fill="#fff"/><circle cx="70" cy="24" r="2" fill="#fff"/>
   <circle cx="120" cy="40" r="2" fill="#fff"/><path d="M100 28 l3 8 8 2 -8 2 -3 8 -3 -8 -8 -2 8 -2 z" fill="#fde68a"/>
   <path d="M40 120 l28 -48 18 28 10 -8 24 36 z" ${SF("#334155")}/>
   <rect x="78" y="78" width="28" height="16" ${SF("#94a3b8")}/>
   <path d="M106 86 h24" ${S}/>`,
  "#0f172a"
);

pics["someone has been drawing"] = svg(
  `<rect x="36" y="28" width="88" height="104" rx="4" ${SF("#fff")}/>
   <path d="M52 60 q16 -16 12 8 q20 -20 16 10" ${S} stroke="#ef4444"/>
   <circle cx="70" cy="100" r="10" ${S} stroke="#3b82f6"/>
   <path d="M52 124 h50" ${S} stroke="#22c55e"/>`
);

function slug(subject) {
  return String(subject)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readList(name) {
  return fs
    .readFileSync(path.join(NOTES, name), "utf8")
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const subjects = [
  ...readList("new_pictures_seed.txt"),
  ...readList("new_pictures_roots.txt"),
  ...readList("new_pictures_sprout.txt"),
];

fs.mkdirSync(OUT, { recursive: true });
const index = {};
const seen = new Set();
for (const subject of subjects) {
  const key = subject.toLowerCase();
  if (seen.has(key)) throw new Error("duplicate subject " + subject);
  seen.add(key);
  if (!pics[key]) throw new Error("no drawing for " + subject);
  const file = slug(subject) + ".svg";
  const body = pics[key];
  if (Buffer.byteLength(body) > 30 * 1024) throw new Error(file + " is over 30KB");
  fs.writeFileSync(path.join(OUT, file), body);
  index[key] = file;
}

for (const name of fs.readdirSync(OUT)) {
  if (name.endsWith(".svg") && !Object.values(index).includes(name)) fs.unlinkSync(path.join(OUT, name));
}

fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log("pictures", Object.keys(index).length);
