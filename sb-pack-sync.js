/**
 * Skill Builder G1 — progress pack merge + storage helpers (browser + Node tests).
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

  const SCORES_BASE = "sb_scores";
  const STATS_BASE = "sb_stats";
  const LANG_BASE = "sb_lang";

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

  function emptyProgress() {
    return { v: 1, scores: {}, stats: {}, lang: null };
  }

  function parseProgressJson(raw) {
    if (raw == null || raw === "") return emptyProgress();
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || typeof data !== "object") return emptyProgress();
      const scores =
        data.scores && typeof data.scores === "object" && !Array.isArray(data.scores) ? data.scores : {};
      const stats = data.stats && typeof data.stats === "object" && !Array.isArray(data.stats) ? data.stats : {};
      const lang = data.lang != null && String(data.lang) !== "" ? String(data.lang) : null;
      return { v: 1, scores, stats, lang };
    } catch (_) {
      return emptyProgress();
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

  function mergeProgress(local, remote) {
    const a = local || emptyProgress();
    const b = remote || emptyProgress();
    const scores = mergeScoreMaps(a.scores, b.scores);
    const stats = mergeStatMaps(a.stats, b.stats);
    let lang = a.lang;
    if (!lang && b.lang) lang = b.lang;
    return { v: 1, scores, stats, lang };
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

  return {
    SCORES_BASE,
    STATS_BASE,
    LANG_BASE,
    idKey,
    studentStorageKey,
    emptyProgress,
    parseProgressJson,
    mergeScoreMaps,
    mergeStatMaps,
    mergeProgress,
    progressWeight,
    isRicherThan,
    canSaveToServer,
  };
});
