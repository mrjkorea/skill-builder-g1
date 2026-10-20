/**
 * Picture lookup for Seed, Roots, and Sprout.
 * New drawings win. Old grade1 pictures are reused by word or name.
 * No question counts are hard-coded.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_PICTURES = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STOP = new Set(
    "a an the and or of to in on with their someone has been is are was were for by at from into over only likely nearby that this it you see what do they them who whose which when where why how".split(
      " "
    )
  );

  function subjectOf(q) {
    const needs = String((q && q.needs) || "").trim();
    if (/^picture:/i.test(needs)) return needs.slice(needs.indexOf(":") + 1).trim();
    if (/^picture$/i.test(needs)) return String((q && q.answer) || "").trim();
    return "";
  }

  function normKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function wordForms(word) {
    const w = normKey(word).replace(/[^a-z0-9]/g, "");
    if (!w) return [];
    const out = [w];
    if (w.length > 3 && w.endsWith("s")) out.push(w.slice(0, -1));
    if (w.length > 4 && w.endsWith("es")) out.push(w.slice(0, -2));
    return out;
  }

  function directOld(subject, oldMap) {
    const s = normKey(subject);
    if (!s) return null;
    const words = s.replace(/[_-]/g, " ").split(/\s+/).filter(Boolean);
    const tries = [
      s,
      s.replace(/[_-]/g, " "),
      s.replace(/[\s_-]/g, ""),
      s.replace(/[_-]/g, ""),
    ];
    if (words.length) {
      tries.push(words[words.length - 1]);
      tries.push(words[0]);
    }
    for (const key of tries) {
      if (key && oldMap[key]) return oldMap[key];
    }
    return null;
  }

  function phraseOld(subject, oldMap) {
    const s = normKey(subject);
    if (!s || !/\s/.test(s.replace(/[_-]/g, " "))) return null;
    const words = s.replace(/[_-]/g, " ").split(/\s+/).filter(Boolean);
    let best = null;
    let bestLen = -1;
    let bestPos = -1;
    words.forEach((word, i) => {
      if (STOP.has(word)) return;
      for (const key of wordForms(word)) {
        if (!oldMap[key]) continue;
        if (key.length > bestLen || (key.length === bestLen && i > bestPos)) {
          best = oldMap[key];
          bestLen = key.length;
          bestPos = i;
        }
      }
    });
    return best;
  }

  /**
   * @returns {{kind:"new"|"old", file:string, subject:string}|null}
   */
  function resolve(q, newIndex, oldMap) {
    const subject = subjectOf(q);
    if (!subject) return null;
    const key = normKey(subject);
    const made = newIndex && newIndex[key];
    if (made) return { kind: "new", file: made, subject };
    const old = directOld(subject, oldMap || {}) || phraseOld(subject, oldMap || {});
    if (old) return { kind: "old", file: old, subject };
    return null;
  }

  return {
    STOP,
    subjectOf,
    resolve,
  };
});
