/**
 * CMUdict helpers and grade-1 word-list loading.
 * Phoneme checks use the dictionary's actual pronunciations.
 */
import fs from "node:fs";

export const VOWELS = new Set([
  "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW",
]);

export function basePhone(p) {
  return p.replace(/[0-2]$/, "");
}

export function bases(phones) {
  return phones.map(basePhone);
}

export function primaryVowel(phones) {
  const stressed = phones.find((p) => VOWELS.has(basePhone(p)) && p.endsWith("1"));
  if (stressed) return basePhone(stressed);
  const any = phones.find((p) => VOWELS.has(basePhone(p)));
  return any ? basePhone(any) : null;
}

function stressedVowel(phones) {
  const stressed = phones.find((p) => VOWELS.has(basePhone(p)) && p.endsWith("1"));
  return stressed ? basePhone(stressed) : null;
}

export function syllableCount(phones) {
  return phones.filter((p) => VOWELS.has(basePhone(p))).length;
}

export function loadCmudict(dictPath) {
  const map = new Map();
  const text = fs.readFileSync(dictPath, "utf8");
  for (const line of text.split("\n")) {
    if (!line || line.startsWith(";;;")) continue;
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    const word = m[1].toLowerCase().replace(/\(\d+\)$/, "");
    const phones = m[2].trim().replace(/\s+#.*$/, "").split(/\s+/).filter(Boolean);
    if (!map.has(word)) map.set(word, []);
    map.get(word).push(phones);
  }
  return map;
}

export function loadFryFirst300(path) {
  const text = fs.readFileSync(path, "utf8");
  const hundreds = [[], [], []];
  let section = 0;
  for (const line of text.split("\n")) {
    if (/Second Hundred/i.test(line)) {
      section = 1;
      continue;
    }
    if (/Third Hundred/i.test(line)) {
      section = 2;
      continue;
    }
    if (/Fourth Hundred/i.test(line)) break;
    if (!line.trim() || /List 1/.test(line) || /Printable/.test(line)) continue;
    if (section > 2) continue;
    const words = line.split(/\t+/).map((w) => w.trim()).filter(Boolean);
    hundreds[section].push(...words);
  }
  if (hundreds.some((h) => h.length !== 100)) {
    throw new Error(`Fry hundreds parsed as ${hundreds.map((h) => h.length).join(",")}`);
  }
  const ordered = hundreds.flat();
  const set = new Set(ordered.map((w) => w.toLowerCase()));
  return { ordered, set };
}

function wordsAfterCount(text) {
  return text.split(",").map((w) => w.trim()).filter((w) => w && !/\s/.test(w));
}

export function loadDolchFromWikipedia(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim()
  );
  const take = (label) => {
    const p = paras.find((x) => x.startsWith(label));
    if (!p) throw new Error(`Dolch section missing: ${label}`);
    const body = p.replace(/^.*?\(\d+ words\)\s*/, "");
    return wordsAfterCount(body);
  };
  const pre = take("Pre-primer");
  const primer = take("Primer");
  const g1 = take("1st Grade");
  if (pre.length !== 40 || primer.length !== 52 || g1.length !== 41) {
    throw new Error(`Dolch counts ${pre.length},${primer.length},${g1.length}`);
  }
  const nounPara = paras.find((x) => /^\(\d+ words\)/.test(x) && x.includes("apple"));
  const nouns = nounPara ? wordsAfterCount(nounPara.replace(/^\(\d+ words\)\s*/, "")) : [];
  const levels = { pre, primer, g1 };
  const allowed = new Set([...pre, ...primer, ...g1].map((w) => w.toLowerCase()));
  return { levels, allowed, nouns };
}

const LETTER_PHONE = {
  b: "B", c: "K", d: "D", f: "F", g: "G", h: "HH", j: "JH", k: "K", l: "L", m: "M",
  n: "N", p: "P", r: "R", s: "S", t: "T", v: "V", w: "W", y: "Y", z: "Z",
  a: "AE", e: "EH", i: "IH", o: "AA", u: "AH",
};

const LONG = { a: "EY", e: "IY", i: "AY", o: "OW", u: "UW" };

export function analyzeWord(dict, rawWord) {
  const word = rawWord.toLowerCase();
  const variants = dict.get(word);
  if (!variants || variants.length === 0) return null;
  const stressed = variants.map(stressedVowel).filter(Boolean);
  const citationStressed = stressedVowel(variants[0]);
  // A stress-0 reduction (can -> K AH0 N) is not a second vowel identity.
  // A different stress-1 vowel (read -> EH or IY, lot -> AA or AO) is a conflict.
  const vowelConflict = stressed.some((v) => v !== citationStressed);
  const phones = variants[0];
  const b = bases(phones);
  const vowelIdxs = [];
  phones.forEach((p, i) => {
    if (VOWELS.has(basePhone(p))) vowelIdxs.push(i);
  });
  const pIdx = phones.findIndex((p) => VOWELS.has(basePhone(p)) && p.endsWith("1"));
  const vIdx = pIdx >= 0 ? pIdx : vowelIdxs[0] ?? -1;
  return {
    word,
    phones,
    bases: b,
    variants,
    ambiguousVowel: vowelConflict,
    vowelConflict,
    primary: primaryVowel(phones),
    syllables: syllableCount(phones),
    onset: vIdx >= 0 ? b.slice(0, vIdx) : b.slice(),
    coda: vIdx >= 0 ? b.slice(vIdx + 1) : [],
    rime: vIdx >= 0 ? b.slice(vIdx).join(" ") : "",
    vIdx,
  };
}

export function isTransparentCvc(rec) {
  if (!rec || rec.vowelConflict) return false;
  if (!/^[b-df-hj-np-tv-z][aeiou][b-df-hj-np-tv-z]$/.test(rec.word)) return false;
  if (rec.syllables !== 1) return false;
  const expect = rec.word.split("").map((ch) => LETTER_PHONE[ch]);
  return rec.bases.join(" ") === expect.join(" ");
}

export function silentEMatch(rec) {
  if (!rec || rec.vowelConflict || rec.syllables !== 1) return null;
  const m = rec.word.match(/^([b-df-hj-np-tv-z]+)([aeiou])([b-df-hj-np-tv-z])e$/);
  if (!m) return null;
  const [, onset, vowel, coda] = m;
  if ([...onset, coda].some((ch) => !LETTER_PHONE[ch])) return null;
  const onsetPh = onset.split("").map((ch) => LETTER_PHONE[ch]);
  const codaPh = LETTER_PHONE[coda];
  const got = rec.bases.join(" ");
  if (vowel === "u") {
    const a = [...onsetPh, "Y", "UW", codaPh].join(" ");
    const b = [...onsetPh, "UW", codaPh].join(" ");
    if (got === a || got === b) return { vowel: "u", long: "UW", pattern: "u_e" };
    return null;
  }
  const expect = [...onsetPh, LONG[vowel], codaPh].join(" ");
  if (got === expect) return { vowel, long: LONG[vowel], pattern: `${vowel}_e` };
  return null;
}

/**
 * Silent-e spelling plus the long vowel on the citation form.
 * Allows soft c/g and voiced s, which are not 1:1 letter-phone maps.
 */
export function silentEPattern(rec) {
  if (!rec || rec.vowelConflict || rec.syllables !== 1) return null;
  const m = rec.word.match(/^([b-df-hj-np-tv-z]*)([aeiou])([b-df-hj-np-tv-z])e$/);
  if (!m) return null;
  const vowel = m[2];
  if (vowel === "u") {
    if (rec.primary === "UW" || rec.bases.includes("UW")) return { pattern: "u_e", vowel: "u" };
    return null;
  }
  if (rec.primary !== LONG[vowel]) return null;
  return { pattern: `${vowel}_e`, vowel };
}

/** Spelling pattern plus the long vowel, even when soft c/g blocks a 1:1 letter map. */
export function longVowelSpelling(rec) {
  if (!rec || rec.vowelConflict || rec.syllables !== 1) return [];
  const tags = [];
  const silent = silentEPattern(rec);
  if (silent) tags.push(silent.pattern);
  const w = rec.word;
  const v = rec.primary;
  const has = (pat, vowel) => w.includes(pat) && v === vowel;
  if (has("ai", "EY")) tags.push("ai");
  if (/ay$/.test(w) && v === "EY") tags.push("ay");
  if (has("ee", "IY")) tags.push("ee");
  if (has("ea", "IY")) tags.push("ea");
  if (has("igh", "AY")) tags.push("igh");
  if (/ie$/.test(w) && v === "AY") tags.push("ie");
  if (has("oa", "OW")) tags.push("oa");
  if (/ow$/.test(w) && v === "OW") tags.push("ow");
  if (/ew$/.test(w) && (v === "UW" || rec.bases.includes("UW"))) tags.push("ew");
  if (/ue$/.test(w) && rec.bases.includes("UW")) tags.push("ue");
  if (has("oo", "UW")) tags.push("oo");
  if (/y$/.test(w) && v === "AY" && rec.syllables === 1 && w.length > 2) tags.push("y");
  return tags;
}

export function diphthongTags(rec) {
  if (!rec || rec.vowelConflict) return [];
  const w = rec.word;
  const tags = [];
  if ((w.includes("oi") || /oy$/.test(w)) && rec.primary === "OY") tags.push(w.includes("oi") ? "oi" : "oy");
  if (/oy$/.test(w) && rec.primary === "OY" && !tags.includes("oy")) tags.push("oy");
  if (w.includes("ou") && rec.primary === "AW") tags.push("ou");
  if (/ow/.test(w) && rec.primary === "AW") tags.push("ow");
  return [...new Set(tags)];
}

export function rControlTags(rec) {
  if (!rec || rec.vowelConflict) return [];
  const phones = rec.bases.join(" ");
  const w = rec.word;
  const tags = [];
  if (w.includes("ar") && phones.includes("AA R")) tags.push("ar");
  if (w.includes("er") && phones.includes("ER")) tags.push("er");
  if (w.includes("ir") && phones.includes("ER")) tags.push("ir");
  if (w.includes("or") && phones.includes("AO R")) tags.push("or");
  if (w.includes("ur") && phones.includes("ER")) tags.push("ur");
  return tags;
}

export function digraphTags(rec) {
  if (!rec) return [];
  const w = rec.word;
  const p = rec.bases;
  const tags = [];
  if (w.includes("ch") && p.includes("CH")) tags.push("ch");
  if (w.includes("sh") && p.includes("SH")) tags.push("sh");
  if (w.includes("th") && (p.includes("TH") || p.includes("DH"))) tags.push("th");
  if (w.endsWith("ck") && p[p.length - 1] === "K") tags.push("ck");
  if (w.endsWith("ng") && p.includes("NG") && p[p.length - 1] === "NG") tags.push("ng");
  if (w.endsWith("nk") && p.includes("NG") && p[p.length - 1] === "K") tags.push("nk");
  if (w.startsWith("wh") && (p[0] === "W" || p[0] === "HH")) tags.push("wh");
  if (w.includes("ph") && p.includes("F")) tags.push("ph");
  return tags;
}

export function flossTags(rec) {
  if (!rec || rec.syllables !== 1) return [];
  const w = rec.word;
  const last = rec.bases[rec.bases.length - 1];
  const tags = [];
  if (w.endsWith("ss") && last === "S") tags.push("ss");
  if (w.endsWith("ll") && last === "L") tags.push("ll");
  if (w.endsWith("ff") && last === "F") tags.push("ff");
  if (w.endsWith("zz") && last === "Z") tags.push("zz");
  if (w.endsWith("ck") && last === "K") tags.push("ck");
  return tags;
}

const DIGRAPH_START = new Set(["ch", "sh", "th", "wh", "ph", "kn", "wr", "qu"]);
const ONE_SOUND_END = new Set(["ck", "sh", "ch", "th", "ng", "ss", "ll", "ff", "zz", "ph"]);

export function startsWithBlend(rec) {
  if (!rec || rec.onset.length < 2) return false;
  const first2 = rec.word.slice(0, 2);
  if (DIGRAPH_START.has(first2)) return false;
  if (!/^[^aeiouy]{2}/.test(rec.word)) return false;
  return true;
}

export function endsWithBlend(rec) {
  if (!rec || rec.syllables !== 1 || rec.coda.length < 2) return false;
  const last2 = rec.word.slice(-2);
  if (ONE_SOUND_END.has(last2)) return false;
  if (!/[^aeiou]{2}$/.test(rec.word)) return false;
  return true;
}

export function shortVowelTag(rec) {
  if (!rec || rec.vowelConflict || !isTransparentCvc(rec)) return null;
  const map = { AE: "short_a", EH: "short_e", IH: "short_i", AA: "short_o", AH: "short_u" };
  return map[rec.primary] || null;
}

export function vowelClass(rec) {
  if (!rec || rec.vowelConflict || rec.syllables !== 1) return null;
  const map = {
    AE: "short_a", EH: "short_e", IH: "short_i", AA: "short_o", AH: "short_u",
    EY: "long_a", IY: "long_e", AY: "long_i", OW: "long_o", UW: "long_u",
    AW: "diphthong_aw", OY: "diphthong_oy", AO: "aw_as_in_dog", UH: "oo_as_in_book",
    ER: "r_vowel",
  };
  return map[rec.primary] || null;
}

export function firstLetterMatchesSound(rec) {
  if (!rec) return false;
  const ch = rec.word[0];
  const expect = LETTER_PHONE[ch];
  if (!expect) return false;
  return rec.bases[0] === expect;
}

export function lastLetterMatchesSound(rec) {
  if (!rec) return false;
  const ch = rec.word[rec.word.length - 1];
  const expect = LETTER_PHONE[ch];
  if (!expect) return false;
  return rec.bases[rec.bases.length - 1] === expect;
}

/**
 * Reject "word contains word" claims that are only spelling substrings
 * or a phoneme prefix of one unanalyzed word (the matter/mat error).
 * A compound is confirmed only when two whole-word pronunciations concatenate
 * to the longer word's pronunciation.
 */
export function confirmCompound(dict, part1, part2, word) {
  if (`${part1}${part2}` !== word) {
    return { ok: false, reason: "parts do not join to the spelling" };
  }
  const a = analyzeWord(dict, part1);
  const b = analyzeWord(dict, part2);
  const c = analyzeWord(dict, word);
  if (!a || !b || !c) {
    return { ok: false, reason: "a part or the word is missing from CMUdict" };
  }
  if (c.syllables !== 2) {
    return { ok: false, reason: `expected 2 syllables, CMUdict has ${c.syllables}` };
  }
  const concat = [...a.bases, ...b.bases].join(" ");
  const whole = c.bases.join(" ");
  if (concat !== whole) {
    return {
      ok: false,
      reason: `phones ${whole} are not ${part1} (${a.bases.join(" ")}) + ${part2} (${b.bases.join(" ")})`,
    };
  }
  return { ok: true, phones: c.phones, syllables: 2 };
}

export function confirmPhoneSplit(dict, word, partSpellings, partPhones) {
  const rec = analyzeWord(dict, word);
  if (!rec) return { ok: false, reason: "not in CMUdict" };
  if (partSpellings.join("") !== word) return { ok: false, reason: "spellings do not join" };
  if (rec.syllables !== partPhones.length) {
    return { ok: false, reason: `syllable count ${rec.syllables} != ${partPhones.length}` };
  }
  const flat = partPhones.flat();
  if (flat.join(" ") !== rec.bases.join(" ")) {
    return { ok: false, reason: `phones ${rec.bases.join(" ")} != ${flat.join(" ")}` };
  }
  return { ok: true, phones: rec.phones, syllables: rec.syllables };
}

export function articleFor(rec) {
  if (!rec || rec.bases.length === 0) return null;
  return VOWELS.has(rec.bases[0]) ? "an" : "a";
}

export function regularPluralSpelling(word) {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

export function confirmRegularPlural(dict, word) {
  const plural = regularPluralSpelling(word);
  const sing = analyzeWord(dict, word);
  const pl = analyzeWord(dict, plural);
  if (!sing || !pl) return { ok: false, plural, reason: "singular or plural missing from CMUdict" };
  const sibilant = /(s|x|z|ch|sh)$/i.test(word);
  if (sibilant && pl.syllables !== sing.syllables + 1) {
    return { ok: false, plural, reason: "es plural did not add a syllable" };
  }
  return { ok: true, plural, singPhones: sing.phones, pluralPhones: pl.phones };
}

export { LETTER_PHONE, LONG };
