/**
 * Cloud progress blob for one Skill Builder level.
 * Stored as progress_json by the existing sign-in savePack.
 * Scores and place live in the cloud pack only.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_LEVEL_PROGRESS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function emptyProgress(level) {
    return { v: 2, level: level || "", scores: {}, stats: {}, last: null, cursor: {} };
  }

  function normalizeLast(last) {
    if (!last || typeof last !== "object") return null;
    const skillId = last.skill_id != null ? String(last.skill_id).trim() : "";
    if (!skillId) return null;
    const category = last.category != null ? String(last.category).trim() : "";
    const index = Number(last.index);
    return {
      skill_id: skillId,
      category: category || null,
      index: Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0,
    };
  }

  function copyScores(src) {
    const out = {};
    const scores = src && typeof src === "object" ? src : {};
    for (const key of Object.keys(scores)) {
      const n = Number(scores[key]);
      if (Number.isFinite(n)) out[key] = Math.max(0, Math.min(99, n));
    }
    return out;
  }

  function copyStats(src) {
    const out = {};
    const stats = src && typeof src === "object" ? src : {};
    for (const key of Object.keys(stats)) {
      const st = stats[key];
      if (!st || typeof st !== "object") continue;
      out[key] = {
        correct: Math.max(0, Number(st.correct) || 0),
        wrong: Math.max(0, Number(st.wrong) || 0),
      };
    }
    return out;
  }

  function copyCursor(src) {
    const out = {};
    const cursor = src && typeof src === "object" ? src : {};
    for (const key of Object.keys(cursor)) {
      const n = Number(cursor[key]);
      if (Number.isFinite(n) && n >= 0) out[key] = Math.floor(n);
    }
    return out;
  }

  function parseProgress(raw, level) {
    const empty = emptyProgress(level);
    if (raw == null || raw === "") return empty;
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || typeof data !== "object") return empty;
      return {
        v: 2,
        level: data.level != null && String(data.level) !== "" ? String(data.level) : level || "",
        scores: copyScores(data.scores),
        stats: copyStats(data.stats),
        last: normalizeLast(data.last),
        cursor: copyCursor(data.cursor),
      };
    } catch (_) {
      return empty;
    }
  }

  function mergeScores(a, b) {
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

  function mergeStats(a, b) {
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

  function mergeCursor(a, b) {
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

  function mergeProgress(local, remote, level) {
    const a = local || emptyProgress(level);
    const b = remote || emptyProgress(level);
    return {
      v: 2,
      level: a.level || b.level || level || "",
      scores: mergeScores(a.scores, b.scores),
      stats: mergeStats(a.stats, b.stats),
      last: normalizeLast(a.last) || normalizeLast(b.last),
      cursor: mergeCursor(a.cursor, b.cursor),
    };
  }

  function band(score) {
    if (score >= 90) return "star";
    if (score >= 71) return "high";
    if (score >= 40) return "mid";
    return "low";
  }

  /** SmartScore ceiling; also the mastery threshold (see applyScore clamp). */
  const MASTER_SCORE = 99;

  function skillScore(progress, skillId) {
    const n = Number(progress && progress.scores && progress.scores[skillId]);
    return Number.isFinite(n) ? Math.max(0, Math.min(MASTER_SCORE, n)) : 0;
  }

  function isSkillMastered(score) {
    const n = Number(score);
    return Number.isFinite(n) && n >= MASTER_SCORE;
  }

  function nextSkillInOrder(skills, currentSkillId) {
    const list = Array.isArray(skills) ? skills : [];
    const id = String(currentSkillId || "");
    const idx = list.findIndex((s) => s && s.skill_id === id);
    if (idx < 0 || idx >= list.length - 1) return null;
    return list[idx + 1] || null;
  }

  function applyScore(score, correct, streak) {
    let s = Number(score) || 0;
    let nextStreak = Number(streak) || 0;
    const b = band(s);
    if (correct) {
      if (b === "low") s += 10;
      else if (b === "mid") s += 7;
      else if (b === "high") s += 4;
      else {
        nextStreak += 1;
        s += nextStreak >= 3 ? 2 : 1;
      }
    } else {
      nextStreak = 0;
      if (b === "star") s -= 5;
      else if (b === "high") s -= 6;
      else if (b === "mid") s -= 4;
      else s -= 2;
    }
    s = Math.max(0, Math.min(MASTER_SCORE, s));
    return { score: s, streak: nextStreak };
  }

  return {
    MASTER_SCORE,
    emptyProgress,
    parseProgress,
    mergeProgress,
    normalizeLast,
    applyScore,
    skillScore,
    isSkillMastered,
    nextSkillInOrder,
  };
});
