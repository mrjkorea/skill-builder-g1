/**
 * Phonics audit helpers (skill summaries + question verdict rules).
 * Mirrors skillbuilder_phonics_audit categories; no question text edits.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.SB_PHONICS_AUDIT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LABEL_JARGON =
    /blend or a digraph|blend or digraph|open or closed|syllable type|schwa|syllable division|choose the correct syllable division|segment "|how do you segment|how do you break|vowel or consonant|which letter is a vowel in the word|closed-syllable exception|vowel team or silent e|spelling-pattern label|vowel-sound label|y-sound label|tap the better|consonants work in|exception pattern appears|doubles a consonant between/i;

  const SENTENCE_FILL =
    /fits in the blank|belongs in the blank|fits the blank|which word fits the blank|which word fits\? i |pass a clean|walking __|kept walking|says meow|says oink|barks loudly|crawls on the leaf|oinks|falls from clouds/i;

  const ABSTRACT_SOUND_LABEL =
    /which word has a short vowel sound|which word has a long [aeiou] sound|which word says long|different vowel sound from the others|same vowel sound as|short or long\?|long vowel sound|short vowel sound in /i;

  const SYLLABLE_COUNT_NO_PICTURE = /how many syllables|how many syllables are in/i;

  const SIGHT_SENTENCE = /sight word|which word fits: it is|which word fits\? i can/i;

  function parseSkillLine(line) {
    const m = String(line).match(/^- ([^:]+):\s*\d+ q\.\s*(.+?)\s+(GOOD|FIXABLE|BAD)\s*\(/);
    if (!m) return null;
    const counts = { GOOD: 0, FIXABLE: 0, BAD: 0 };
    const tail = line.match(/\(([^)]+)\)/);
    if (tail) {
      for (const part of tail[1].split(",")) {
        const c = part.trim().match(/^(GOOD|FIXABLE|BAD)\s+(\d+)/);
        if (c) counts[c[1]] = Number(c[2]);
      }
    }
    return { skill_id: m[1].trim(), verdict: m[3], counts };
  }

  function parseFinalLines(text) {
    const byLevel = { seed: {}, roots: {}, sprout: {} };
    let level = null;
    for (const line of String(text || "").split(/\n/)) {
      if (/^##### seed/.test(line)) level = "seed";
      else if (/^##### roots/.test(line)) level = "roots";
      else if (/^##### sprout/.test(line)) level = "sprout";
      else if (!level || !line.startsWith("- ")) continue;
      const row = parseSkillLine(line);
      if (row) byLevel[level][row.skill_id] = row;
    }
    return byLevel;
  }

  function hasPictureNeed(q) {
    const needs = String((q && q.needs) || "");
    return needs.length > 0 && !/^sound:/i.test(needs);
  }

  function questionVerdict(q, skillRow) {
    const prompt = String((q && q.prompt) || "");
    const hay = prompt.toLowerCase();
    const skillVerdict = skillRow && skillRow.verdict ? skillRow.verdict : "FIXABLE";

    if (LABEL_JARGON.test(hay) || LABEL_JARGON.test(prompt)) return "BAD";
    if (SENTENCE_FILL.test(hay)) return "BAD";
    if (ABSTRACT_SOUND_LABEL.test(hay)) return "BAD";
    if (SIGHT_SENTENCE.test(hay)) return "BAD";
    if (SYLLABLE_COUNT_NO_PICTURE.test(hay) && !hasPictureNeed(q)) return "BAD";
    if (/identify_letters|find_vowel_letter|vowel_or_consonant|sort_blend_or_digraph|letters_make_word|put_letters_in_order|spell_sight_word|short_vowel_sound|same_vowel_sound/.test(String(q.skill_id || ""))) {
      if (SENTENCE_FILL.test(hay) || ABSTRACT_SOUND_LABEL.test(hay)) return "BAD";
    }

    if (hasPictureNeed(q)) {
      if (/which word is in the picture|which word goes with the picture|look at the picture/i.test(hay)) return "GOOD";
      if (/the picture shows/i.test(hay)) return "GOOD";
      if (/find the word for this picture/i.test(hay)) return "GOOD";
      return "FIXABLE";
    }

    if (/^sound:/i.test(String(q.needs || ""))) return "FIXABLE";

    if (skillVerdict === "GOOD") return "BAD";
    if (skillVerdict === "BAD") return "BAD";
    return "FIXABLE";
  }

  function excludeQuestionIds(questions, skillRow) {
    const out = [];
    for (const q of questions) {
      if (!q || !q.id) continue;
      if (questionVerdict(q, skillRow) === "BAD") out.push(String(q.id));
    }
    return out;
  }

  return {
    parseFinalLines,
    parseSkillLine,
    questionVerdict,
    excludeQuestionIds,
    hasPictureNeed,
  };
});
