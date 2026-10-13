/**
 * Skill Builder G2 — per-answer CM + SSI logging (browser + Node tests).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof root !== "undefined") {
    root.SB_SCORE_SAVE = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROGRAM = "skill-builder-g1";

  function questionId(q) {
    if (q == null) return "";
    if (typeof q === "string" || typeof q === "number") return String(q);
    if (q.item_id != null) return String(q.item_id);
    return "";
  }

  function logAnswer(ctx, skillId, q, correct, smartScore, tier) {
    const studentId = String((ctx && ctx.studentId) || "").trim();
    if (!studentId) return;
    const scores = ctx && ctx.MRJ_SCORES;
    if (!scores || !scores.post) return;

    const qid = questionId(q);
    const s = typeof smartScore === "number" ? smartScore : 0;
    const tierVal = tier != null ? tier : 2;
    const localDate = scores.localDate ? scores.localDate() : "";

    const base = {
      student: studentId,
      program: PROGRAM,
      appName: "MRJ Skill Builder Grade 2",
      source: PROGRAM,
      bookTitle: "English Skill Builder Grade 2",
      unitTitle: skillId || "",
    };

    scores.post({
      ...base,
      itemId: "g2:" + skillId + ":" + qid,
      itemType: "question",
      scoreValue: correct ? 1 : 0,
      scoreMax: 1,
      correctness: correct ? "correct" : "incorrect",
      metadata: { smart_score: s, tier: tierVal },
    });

    const auth = ctx && ctx.MRJ_AUTH;
    if (auth && auth.noteScore) {
      auth.noteScore({
        program: PROGRAM,
        itemId: "g2:" + skillId,
        scoreValue: s,
        scoreMax: 100,
        scorePct: s,
        localDate,
      });
    }

    scores.post({
      ...base,
      itemId: "g2:" + skillId,
      itemType: "skill_score",
      scoreValue: s,
      scoreMax: 100,
      scorePct: s,
    });
  }

  return {
    PROGRAM,
    questionId,
    logAnswer,
  };
});
