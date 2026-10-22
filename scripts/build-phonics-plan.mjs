#!/usr/bin/env node
/**
 * Build levels/phonics-plan.json from phonics plan + final_lines audit rules.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);
const audit = require("../levels/phonics-audit.js");

const finalLinesPath =
  process.argv[2] ||
  path.join(root, "levels", "_notes", "final_lines.txt");

const PLAN = {
  seed: [
    { num: 1, title: "Letter sounds A–Z", skillIds: [], comingSoon: true },
    { num: 2, title: "First sound", skillIds: ["seed_v2_first_letter"] },
    { num: 3, title: "Last sound", skillIds: ["seed_v2_last_letter"] },
    { num: 4, title: "Same first sound", skillIds: ["seed_v2_same_first_sound"] },
    { num: 5, title: "Same last sound", skillIds: ["seed_v2_same_last_sound"] },
    { num: 6, title: "Middle (vowel) sound", skillIds: ["seed_v2_same_middle_sound"] },
    {
      num: 7,
      title: "Rhymes",
      skillIds: ["seed_v2_rhyming_words", "seed_v2_complete_rhyme", "seed_v2_build_rhyme_set"],
    },
    { num: 8, title: "Odd one out rhyme", skillIds: ["seed_v2_not_rhyme"] },
    { num: 9, title: "Blend sounds", skillIds: ["seed_v2_spell_short_vowel"] },
    {
      num: 10,
      title: "Short a",
      skillIds: ["seed_v2_complete_short_a", "seed_v2_short_a_picture", "seed_v2_am_an_words"],
    },
    { num: 11, title: "Short i", skillIds: ["seed_v2_short_i_picture", "seed_v2_complete_short_i"] },
    { num: 12, title: "Short o", skillIds: ["seed_v2_short_o_picture", "seed_v2_complete_short_o"] },
    { num: 13, title: "Short e", skillIds: ["seed_v2_short_e_picture", "seed_v2_complete_short_e"] },
    { num: 14, title: "Short u", skillIds: ["seed_v2_short_u_picture", "seed_v2_complete_short_u"] },
    { num: 15, title: "Short vowel mix", skillIds: ["seed_v2_complete_short_vowel"] },
    { num: 16, title: "Read CVC words", skillIds: ["seed_v2_read_cvc"] },
    { num: 17, title: "Change first sound", skillIds: ["seed_v2_change_first_letter", "seed_v2_change_letter_review"] },
    { num: 18, title: "Change last sound", skillIds: ["seed_v2_change_last_letter"] },
    { num: 19, title: "Change middle vowel", skillIds: [], comingSoon: true },
    { num: 20, title: "Double endings ff ll ss zz ck", skillIds: ["seed_v2_final_double", "seed_v2_ck_words"] },
    {
      num: 21,
      title: "Digraphs sh ch th",
      skillIds: ["seed_v2_digraph_ch_sh_th", "seed_v2_complete_digraph", "seed_v2_spell_digraph"],
    },
    { num: 22, title: "Digraphs wh, ph (light)", skillIds: [], comingSoon: true },
    { num: 23, title: "qu and x", skillIds: ["seed_v2_qu_words"] },
    { num: 24, title: "ng and nk endings", skillIds: ["seed_v2_ng_nk"] },
    { num: 25, title: "Beginning blends", skillIds: ["seed_v2_missing_blend", "seed_v2_complete_start_blend"] },
    { num: 26, title: "Ending blends", skillIds: ["seed_v2_complete_end_blend"] },
    { num: 27, title: "Compound words", skillIds: ["seed_v2_compound_words"] },
    {
      num: 28,
      title: "Silent e",
      skillIds: ["seed_v2_silent_e_picture", "seed_v2_complete_silent_e"],
    },
    { num: 29, title: "Short or long?", skillIds: [], comingSoon: true },
  ],
  roots: [
    { num: 30, title: "Long a (ai ay a_e)", skillIds: [], comingSoon: true },
    { num: 31, title: "Long e (ee ea)", skillIds: [], comingSoon: true },
    { num: 32, title: "Long i (igh ie y i_e)", skillIds: [], comingSoon: true },
    { num: 33, title: "Long o (oa ow o_e)", skillIds: [], comingSoon: true },
    { num: 34, title: "Long u (ue ew u_e)", skillIds: [], comingSoon: true },
    { num: 35, title: "Vowel team picture match", skillIds: [], comingSoon: true },
    { num: 36, title: "y as a vowel", skillIds: [], comingSoon: true },
    {
      num: 37,
      title: "ar and or",
      skillIds: ["roots_v2_r_controlled"],
    },
    { num: 38, title: "er ir ur", skillIds: ["roots_v2_r_control_er_ir_ur"] },
    {
      num: 39,
      title: "oi oy ou ow",
      skillIds: ["roots_v2_diphthong_oi_oy_ou_ow"],
    },
    { num: 40, title: "oo (moon, book), au aw", skillIds: ["roots_v2_variant_vowels"] },
    { num: 41, title: "tch and dge", skillIds: ["roots_v2_read_digraph_trigraph"] },
    { num: 42, title: "Three-letter blends", skillIds: [], comingSoon: true },
    { num: 43, title: "Digraph word pick", skillIds: ["roots_v2_digraph_word_pick"] },
    {
      num: 44,
      title: "Change or take away a sound",
      skillIds: ["roots_v2_change_sound", "roots_v2_delete_sound"],
    },
    { num: 45, title: "Rhymes with long vowels", skillIds: ["roots_v2_rhyme_pick"] },
    { num: 46, title: "Same start sound review", skillIds: ["roots_v2_same_start_sound"] },
    { num: 47, title: "Soft c and soft g", skillIds: [], comingSoon: true },
    { num: 48, title: "Silent letters kn wr mb", skillIds: [], comingSoon: true },
    { num: 49, title: "Endings -s -es -ed -ing", skillIds: [], comingSoon: true },
    { num: 50, title: "Syllables: clap count", skillIds: [], comingSoon: true },
    { num: 51, title: "Two-syllable compound and word build", skillIds: ["roots_v2_compound_words"] },
    { num: 52, title: "Spell by tapping letters", skillIds: ["roots_v2_spell_tap_review"] },
    { num: 53, title: "Homophones by picture", skillIds: [], comingSoon: true },
  ],
  sprout: [
    { num: 54, title: "Consonant-le", skillIds: ["sprout_v3_consonant_le_spell"] },
    { num: 55, title: "r-vowel spelling review", skillIds: ["sprout_v3_r_vowel_spell"] },
    { num: 56, title: "Digraph review", skillIds: ["sprout_v3_digraph_spell"] },
    { num: 57, title: "Advanced rhymes", skillIds: ["sprout_v3_rhyme_advanced"] },
    {
      num: 58,
      title: "Two/three-syllable spelling",
      skillIds: ["sprout_v3_spell_multisyllable", "sprout_v3_read_multisyllable"],
    },
    { num: 59, title: "Mixed phonics review", skillIds: [], comingSoon: true },
  ],
};

function strandFor(skillId, name) {
  const s = String(skillId || "") + " " + String(name || "");
  const hay = s.toLowerCase();
  if (/phon|vowel|digraph|blend|syllab|rhyme|diphthong|consonant|schwa|trigraph|silent/.test(hay)) return "phonics";
  if (/change_sound|delete_sound|spell_tap|compound_words|variant_vowel|r_control|digraph_word|homophone|multisyllab|consonant_le|ng_nk|ck_tch|long_vowel|soft_c|silent_letter|read_digraph|read_blend|rhyme_pick|same_start/.test(hay))
    return "phonics";
  return "other";
}

function loadQs(level) {
  return fs
    .readFileSync(path.join(root, "levels", level, "questions.jsonl"), "utf8")
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function isPhonicsSkillId(id, name) {
  return strandFor(id, name) === "phonics";
}

const finalText = fs.readFileSync(finalLinesPath, "utf8");
const skillAudit = audit.parseFinalLines(finalText);

const excludeQuestions = { seed: {}, roots: {}, sprout: {} };
const hiddenSkills = { seed: [], roots: [], sprout: [] };

for (const level of ["seed", "roots", "sprout"]) {
  const bySkill = new Map();
  for (const q of loadQs(level)) {
    const id = String(q.skill_id || "");
    if (!bySkill.has(id)) bySkill.set(id, []);
    bySkill.get(id).push(q);
  }

  const planIds = new Set();
  for (const slot of PLAN[level]) {
    for (const sid of slot.skillIds || []) planIds.add(sid);
  }

  for (const [skillId, questions] of bySkill) {
    const sampleName = questions[0] && questions[0].name ? questions[0].name : "";
    if (!isPhonicsSkillId(skillId, sampleName)) continue;
    const row = skillAudit[level][skillId];
    const excluded = audit.excludeQuestionIds(questions, row);
    if (excluded.length) excludeQuestions[level][skillId] = excluded;

    const visible = questions.filter((q) => !excluded.includes(String(q.id)));
    if (!planIds.has(skillId)) hiddenSkills[level].push(skillId);
    else if (visible.length === 0) hiddenSkills[level].push(skillId);
  }

  hiddenSkills[level] = [...new Set(hiddenSkills[level])].sort();
}

const out = {
  version: 1,
  hiddenSkills,
  excludeQuestions,
  levels: PLAN,
};

const outPath = path.join(root, "levels", "phonics-plan.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log("Wrote", outPath);

for (const level of ["seed", "roots", "sprout"]) {
  let hiddenQ = 0;
  let visibleQ = 0;
  let visibleSkills = 0;
  const planIds = new Set();
  for (const slot of PLAN[level]) for (const sid of slot.skillIds || []) planIds.add(sid);
  const bySkill = new Map();
  for (const q of loadQs(level)) {
    const id = String(q.skill_id || "");
    if (!bySkill.has(id)) bySkill.set(id, []);
    bySkill.get(id).push(q);
  }
  for (const sid of planIds) {
    if (hiddenSkills[level].includes(sid)) continue;
    const qs = bySkill.get(sid) || [];
    const ex = new Set(excludeQuestions[level][sid] || []);
    const vis = qs.filter((q) => !ex.has(q.id));
    if (vis.length) visibleSkills += 1;
    visibleQ += vis.length;
    hiddenQ += qs.length - vis.length;
  }
  console.log(
    level,
    "plan skills with visible questions:",
    visibleSkills,
    "visible q:",
    visibleQ,
    "excluded q:",
    hiddenQ,
    "hidden phonics skills:",
    hiddenSkills[level].length
  );
}
