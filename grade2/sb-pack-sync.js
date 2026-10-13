/**
 * Skill Builder — progress pack merge + storage helpers (Grade 2, browser + Node tests).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof root !== "undefined") {
    root.SB_PACK_SYNC = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PACK_PROGRAM = "skill-builder";
  const LEGACY_PACK_PROGRAM = "skill-builder-g1";
  const GRADE_G2 = "g2";

  const SCORES_BASE = "sb_scores_g2";
  const STATS_BASE = "sb_stats_g2";
  const LANG_BASE = "sb_lang_g2";
  const LEGACY_CLAIMED_KEY = "sb_legacy_claimed_by_g2";
  const DEVICE_WIDE_KEYS = [SCORES_BASE, STATS_BASE, LANG_BASE];

  function idKey(id) {
    return String(id == null ? "" : id)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function studentStorageKey(base, studentIdKey) {
    const k = idKey(studentIdKey);
    if (!k) return base;
    return base + ":" + k;
  }

  function emptyProgress(grade) {
    const g = grade || GRADE_G2;
    return { v: 2, grade: g, scores: {}, stats: {}, lang: null, last: null };
  }

  function normalizeLast(last) {
    if (!last || typeof last !== "object") return null;
    const skillId = last.skill_id != null ? String(last.skill_id).trim() : "";
    const category = last.category != null ? String(last.category).trim() : "";
    if (!skillId) return null;
    return { skill_id: skillId, category: category || null };
  }

  function parseProgressJson(raw, grade) {
    const empty = emptyProgress(grade);
    if (raw == null || raw === "") return empty;
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || typeof data !== "object") return empty;
      const scores =
        data.scores && typeof data.scores === "object" && !Array.isArray(data.scores) ? data.scores : {};
      const stats = data.stats && typeof data.stats === "object" && !Array.isArray(data.stats) ? data.stats : {};
      const lang = data.lang != null && String(data.lang) !== "" ? String(data.lang) : null;
      const g = data.grade != null && String(data.grade) !== "" ? String(data.grade) : grade || GRADE_G2;
      const last = normalizeLast(data.last);
      const v = Number(data.v) >= 2 ? 2 : 2;
      return { v, grade: g, scores, stats, lang, last };
    } catch (_) {
      return empty;
    }
  }

  function mergeScoreMaps(a, b) {
    const out = Object.assign({}, a || {});
    const src = b || {};
    for (const key of Object.keys(src)) {
      const n = Number(src[key]);
      if (!Number.isFinite(n)) continue;
      const cur = Number(out[key]);
      out[key] = Number.isFinite(cur) ? Math.max(cur, n) : n;
    }
    return out;
  }

  /** Keep every skill id from baseline; overlay live scores (shared G1+G2 pack). */
  function scoresForPackSave(baseline, working) {
    return Object.assign({}, baseline || {}, working || {});
  }

  function mergeStatMaps(a, b) {
    const out = Object.assign({}, a || {});
    const src = b || {};
    for (const key of Object.keys(src)) {
      const st = src[key];
      if (!st || typeof st !== "object") continue;
      const cur = out[key] || { correct: 0, wrong: 0 };
      out[key] = {
        correct: Math.max(Number(cur.correct) || 0, Number(st.correct) || 0),
        wrong: Math.max(Number(cur.wrong) || 0, Number(st.wrong) || 0),
      };
    }
    return out;
  }

  function pickLast(a, b) {
    const la = normalizeLast(a);
    const lb = normalizeLast(b);
    if (!la) return lb;
    if (!lb) return la;
    return la.skill_id === lb.skill_id ? la : lb;
  }

  function mergeProgress(local, remote, grade) {
    const a = local || emptyProgress(grade);
    const b = remote || emptyProgress(grade);
    const scores = mergeScoreMaps(a.scores, b.scores);
    const stats = mergeStatMaps(a.stats, b.stats);
    let lang = a.lang;
    if (!lang && b.lang) lang = b.lang;
    const g = a.grade || b.grade || grade || GRADE_G2;
    const last = pickLast(a.last, b.last);
    return { v: 2, grade: g, scores, stats, lang, last };
  }

  function progressWeight(p) {
    if (!p) return 0;
    let w = 0;
    const scores = p.scores || {};
    for (const key of Object.keys(scores)) {
      const n = Number(scores[key]);
      if (Number.isFinite(n)) w += n;
    }
    const stats = p.stats || {};
    for (const key of Object.keys(stats)) {
      const st = stats[key];
      if (!st) continue;
      w += (Number(st.correct) || 0) + (Number(st.wrong) || 0);
    }
    if (p.last && p.last.skill_id) w += 1;
    return w;
  }

  function isRicherThan(merged, baseline) {
    const wm = progressWeight(merged);
    const wb = progressWeight(baseline);
    if (wm !== wb) return wm > wb;
    return JSON.stringify(merged) !== JSON.stringify(baseline);
  }

  function canSaveToServer(packSynced, auth, program) {
    if (!packSynced) return false;
    if (!auth || typeof auth.packReady !== "function") return false;
    try {
      return !!auth.packReady(program);
    } catch (_) {
      return false;
    }
  }

  function mergeAfterPackLoad(currentProgress, serverRaw, grade) {
    const serverParsed = parseProgressJson(serverRaw, grade);
    const merged = mergeProgress(currentProgress, serverParsed, grade);
    return { merged, serverParsed };
  }

  function readLegacyClaimed() {
    try {
      return idKey(localStorage.getItem(LEGACY_CLAIMED_KEY) || "");
    } catch (_) {
      return "";
    }
  }

  function setLegacyClaimed(studentIdKey) {
    const k = idKey(studentIdKey);
    if (!k) return;
    try {
      localStorage.setItem(LEGACY_CLAIMED_KEY, k);
    } catch (_) {}
  }

  function consumeDeviceLegacy(studentIdKey, grade) {
    const k = idKey(studentIdKey);
    if (!k || typeof localStorage === "undefined") return null;
    const claimed = readLegacyClaimed();
    let hasLegacy = false;
    for (const base of DEVICE_WIDE_KEYS) {
      try {
        if (localStorage.getItem(base)) hasLegacy = true;
      } catch (_) {}
    }
    if (!hasLegacy) return null;
    if (claimed && claimed !== k) return null;

    const scores = {};
    const stats = {};
    let lang = null;
    try {
      const rawScores = localStorage.getItem(SCORES_BASE);
      if (rawScores) Object.assign(scores, JSON.parse(rawScores));
      const rawStats = localStorage.getItem(STATS_BASE);
      if (rawStats) Object.assign(stats, JSON.parse(rawStats));
      const rawLang = localStorage.getItem(LANG_BASE);
      if (rawLang) lang = rawLang;
    } catch (_) {}

    for (const base of DEVICE_WIDE_KEYS) {
      try {
        localStorage.removeItem(base);
      } catch (_) {}
    }
    setLegacyClaimed(k);
    return parseProgressJson({ v: 2, grade: grade || GRADE_G2, scores, stats, lang, last: null }, grade);
  }

  function purgeDeviceWideKeys() {
    if (typeof localStorage === "undefined") return;
    for (const base of DEVICE_WIDE_KEYS) {
      try {
        localStorage.removeItem(base);
      } catch (_) {}
    }
  }

  return {
    PACK_PROGRAM,
    LEGACY_PACK_PROGRAM,
    GRADE_G2,
    SCORES_BASE,
    STATS_BASE,
    LANG_BASE,
    LEGACY_CLAIMED_KEY,
    DEVICE_WIDE_KEYS,
    idKey,
    studentStorageKey,
    emptyProgress,
    parseProgressJson,
    mergeScoreMaps,
    mergeStatMaps,
    mergeProgress,
    scoresForPackSave,
    progressWeight,
    isRicherThan,
    canSaveToServer,
    mergeAfterPackLoad,
    consumeDeviceLegacy,
    purgeDeviceWideKeys,
    normalizeLast,
  };
});
