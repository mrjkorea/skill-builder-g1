/** Deterministic question assembly. Correct answers and distractors are chosen here. */

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s) {
  return String(s).trim();
}

function key(s) {
  return norm(s);
}

/**
 * Pick one option that passes `test` and n-1 that fail it.
 * Throws if a distractor also passes.
 */
export function mcTest({ question, options, test, n, rng, prefer }) {
  const uniq = [];
  const seen = new Set();
  for (const raw of options) {
    const t = norm(raw);
    if (!t) continue;
    const k = key(t);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(t);
  }
  const goods = uniq.filter((o) => test(o));
  const bads = uniq.filter((o) => !test(o));
  if (goods.length < 1) throw new Error(`no correct option for: ${question}`);
  if (bads.length < n - 1) {
    throw new Error(`need ${n - 1} distractors, have ${bads.length} for: ${question}`);
  }
  let correct = goods[0];
  if (prefer && goods.some((g) => key(g) === key(prefer))) {
    correct = goods.find((g) => key(g) === key(prefer));
  }
  const chosen = shuffle(bads, rng).slice(0, n - 1);
  const choices = shuffle([correct, ...chosen], rng);
  const pass = choices.filter((c) => test(c));
  if (pass.length !== 1) {
    throw new Error(`distractor also correct: ${question} :: ${choices.join(" | ")}`);
  }
  const idx = choices.findIndex((c) => key(c) === key(correct));
  if (idx < 0) throw new Error(`answer missing: ${question}`);
  return { question, choices, answer: "ABCDEFGH"[idx] };
}

export function makeOrder({ question, ordered, rng }) {
  if (new Set(ordered).size !== ordered.length) throw new Error(`duplicate order items: ${question}`);
  const shown = shuffle(ordered.map((text, i) => ({ text, i })), rng);
  const choices = shown.map((x) => x.text);
  const letters = "ABCDEFGH";
  const answer = ordered
    .map((text) => letters[shown.findIndex((s) => s.text === text)])
    .join(", ");
  const rebuilt = answer.split(", ").map((L) => choices[letters.indexOf(L)]);
  if (rebuilt.join("\n") !== ordered.join("\n")) throw new Error(`order rebuild failed: ${question}`);
  return { question, choices, answer };
}

export function makeSort({ question, bins, pairs, rng }) {
  for (const p of pairs) {
    if (!bins.includes(p.bin)) throw new Error(`bad bin ${p.bin} for ${p.text}`);
    if (p.check && !p.check(p)) throw new Error(`sort check failed for ${p.text} -> ${p.bin}`);
  }
  const shown = shuffle(pairs, rng);
  const choices = shown.map((p) => p.text);
  const letters = "ABCDEFGH";
  const answer = shown.map((p, i) => `${letters[i]} → ${p.bin}`).join("; ");
  return { question, choices, answer };
}

/** One-phoneme difference for monosyllables, using citation phones. */
export function changeKind(a, b) {
  if (!a || !b) return "more than one";
  if (a.bases.join(" ") === b.bases.join(" ")) return "same";
  if (a.syllables !== 1 || b.syllables !== 1) return "more than one";
  if (a.bases.length !== b.bases.length) return "more than one";
  const diffs = [];
  for (let i = 0; i < a.bases.length; i++) if (a.bases[i] !== b.bases[i]) diffs.push(i);
  if (diffs.length !== 1) return "more than one";
  const i = diffs[0];
  if (i === 0) return "first sound";
  if (i === a.bases.length - 1) return "last sound";
  if (i === a.vIdx) return "middle sound";
  return "more than one";
}

export function letterDistance(a, b) {
  if (a.length !== b.length) return 99;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export function misspellings(word, dictHas) {
  const out = [];
  const seen = new Set();
  const add = (s) => {
    if (!s || s === word || s.length < 2 || seen.has(s)) return;
    if (dictHas(s)) return;
    seen.add(s);
    out.push(s);
  };
  const chars = word.split("");
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars.slice();
    [a[i], a[i + 1]] = [a[i + 1], a[i]];
    add(a.join(""));
  }
  for (let i = 0; i < word.length; i++) add(word.slice(0, i) + word.slice(i + 1));
  for (const v of ["a", "e", "i", "o", "u"]) {
    for (let i = 0; i < word.length; i++) {
      if ("aeiou".includes(word[i]) && word[i] !== v) add(word.slice(0, i) + v + word.slice(i + 1));
    }
  }
  for (let i = 0; i < word.length; i++) add(word.slice(0, i) + word[i] + word.slice(i));
  return out;
}

export const LETTERS = "ABCDEFGH";
