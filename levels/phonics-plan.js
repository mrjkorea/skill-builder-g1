/**
 * Phonics plan visibility (hide skills / exclude questions). No scoring changes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_PHONICS_PLAN = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function planSlotsForLevel(plan, level) {
    if (!plan || !plan.levels) return [];
    const cfg = plan.levels[level];
    if (!cfg) return [];
    if (Array.isArray(cfg)) return cfg;
    return cfg.plan || [];
  }

  function hiddenSet(plan, level) {
    const list = (plan && plan.hiddenSkills && plan.hiddenSkills[level]) || [];
    return new Set(list);
  }

  function excludeMap(plan, level) {
    return (plan && plan.excludeQuestions && plan.excludeQuestions[level]) || {};
  }

  function applyQuestionFilter(skill, plan, level) {
    if (!skill || !Array.isArray(skill.questions)) return skill;
    const ex = excludeMap(plan, level)[skill.skill_id];
    if (!ex || !ex.length) return skill;
    const drop = new Set(ex);
    const questions = skill.questions.filter((q) => q && !drop.has(String(q.id)));
    return Object.assign({}, skill, { questions });
  }

  function applyToSkills(skills, plan, level) {
    const hidden = hiddenSet(plan, level);
    const exAll = excludeMap(plan, level);
    return skills.map((skill) => {
      let s = skill;
      if (exAll[skill.skill_id]) s = applyQuestionFilter(s, plan, level);
      if (hidden.has(skill.skill_id)) {
        s = Object.assign({}, s, { phonicsHidden: true });
      }
      return s;
    });
  }

  function planSkillIds(plan, level) {
    const ids = [];
    for (const slot of planSlotsForLevel(plan, level)) {
      for (const id of slot.skillIds || []) ids.push(id);
    }
    return ids;
  }

  function isPhonicsHidden(skill, plan, level) {
    return hiddenSet(plan, level).has(skill.skill_id);
  }

  function visibleForIndex(skill, plan, level) {
    if (!skill || skill.strand !== "phonics") return true;
    if (isPhonicsHidden(skill, plan, level)) return false;
    if (!skill.questions || !skill.questions.length) return false;
    return true;
  }

  function phonicsPlanSlots(plan, level) {
    return planSlotsForLevel(plan, level);
  }

  function countStats(skills, plan, level) {
    const hidden = hiddenSet(plan, level);
    const slots = planSlotsForLevel(plan, level);
    const planIds = new Set(planSkillIds(plan, level));
    let visibleSkills = 0;
    let comingSoonSlots = 0;
    let hiddenSkills = 0;
    let visibleQuestions = 0;
    let hiddenQuestions = 0;

    const byId = new Map();
    for (const s of skills) byId.set(s.skill_id, s);

    for (const slot of slots) {
      if (slot.comingSoon && (!slot.skillIds || !slot.skillIds.length)) {
        comingSoonSlots += 1;
        continue;
      }
      let anyVisible = false;
      for (const id of slot.skillIds || []) {
        const s = byId.get(id);
        if (!s) {
          comingSoonSlots += 1;
          continue;
        }
        if (hidden.has(id)) {
          hiddenSkills += 1;
          continue;
        }
        const n = (s.questions && s.questions.length) || 0;
        if (n > 0) {
          visibleSkills += 1;
          visibleQuestions += n;
          anyVisible = true;
        }
      }
      if ((slot.skillIds || []).length && !anyVisible && !slot.comingSoon) comingSoonSlots += 1;
    }

    for (const s of skills) {
      if (s.strand !== "phonics" || planIds.has(s.skill_id)) continue;
      if (hidden.has(s.skill_id)) hiddenSkills += 1;
    }

    const exAll = excludeMap(plan, level);
    for (const id of planIds) {
      const raw = byId.get(id);
      if (!raw) continue;
      const ex = exAll[id] || [];
      hiddenQuestions += ex.length;
    }

    return {
      visibleSkills,
      comingSoonSlots,
      hiddenSkills,
      visibleQuestions,
      hiddenQuestions,
    };
  }

  return {
    planSlotsForLevel,
    hiddenSet,
    excludeMap,
    applyQuestionFilter,
    applyToSkills,
    planSkillIds,
    isPhonicsHidden,
    visibleForIndex,
    phonicsPlanSlots,
    countStats,
  };
});
