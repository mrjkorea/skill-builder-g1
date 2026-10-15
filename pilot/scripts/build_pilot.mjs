/**
 * Build the Grade 1 text-only pilot from verified facts.
 * Sentences and clues are hand-written. This script checks phonics
 * against CMUdict and chooses every correct answer and distractor.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCmudict, loadFryFirst300, loadDolchFromWikipedia,
  analyzeWord, articleFor, confirmRegularPlural,
} from "./lexicon.mjs";
import { hash, mulberry32, mcTest, makeSort, makeOrder } from "./engine.mjs";
import { CLUES } from "./content.mjs";
import { registerLanguage } from "./register_language.mjs";
import { registerPhonics } from "./register_phonics.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pilot = path.resolve(here, "..");
const repo = path.resolve(pilot, "..");

const TEXT_TYPES = new Set(["picture_to_word", "word_to_picture", "listen_tap"]);

function isTextVersion(skill) {
  return TEXT_TYPES.has(skill.item_type) || skill.present === "listen";
}

function main() {
  const dict = loadCmudict(path.join(pilot, "sources/cmudict.dict"));
  const fry = loadFryFirst300(path.join(pilot, "sources/fry-1000.txt"));
  const dolch = loadDolchFromWikipedia(path.join(pilot, "sources/dolch-wikipedia.html"));
  const skills = JSON.parse(fs.readFileSync(path.join(repo, "grade1/pack/skills.json"), "utf8"));
  if (skills.length !== 198) throw new Error(`expected 198 skills, got ${skills.length}`);

  const clueValues = Object.values(CLUES);
  if (new Set(clueValues).size !== clueValues.length) throw new Error("duplicate child clues");

  const handlers = new Map();
  const on = (id, fn) => {
    if (handlers.has(id)) throw new Error(`duplicate handler ${id}`);
    handlers.set(id, fn);
  };

  const h = {
    dict,
    dictHas: (word) => dict.has(String(word).toLowerCase()),
    article: (word) => {
      const rec = analyzeWord(dict, word);
      return rec ? articleFor(rec) : null;
    },
    firstPhone: (word) => {
      const rec = analyzeWord(dict, word);
      return rec ? rec.bases[0] : null;
    },
    plural: (word) => confirmRegularPlural(dict, word),
    bank(env, rows, nChoices) {
      const use = rows.slice(0, env.n);
      if (use.length < env.n) {
        throw new Error(`${env.skill.family_id} has ${rows.length} rows, need ${env.n}`);
      }
      return use.map((row) => {
        const n = row.n || nChoices || row.bad.length + 1;
        env.grammarFact({ claim: row.claim, answer: row.correct });
        return mcTest({
          question: env.q(row.q),
          options: [row.correct, ...row.bad],
          test: row.test,
          n,
          rng: env.rng,
          prefer: row.correct,
        });
      });
    },
    ab(env, rows) {
      return h.bank(env, rows, 2);
    },
    sort(env, question, bins, pairs) {
      for (const p of pairs) env.grammarFact({ claim: `${p.text} → ${p.bin}` });
      const q = question.includes("Bins:") ? question : `${question} Bins: ${bins.join(" | ")}.`;
      return makeSort({ question: env.q(q), bins, pairs, rng: env.rng });
    },
    order(env, question, ordered) {
      env.grammarFact({ claim: ordered.join(" | ") });
      return makeOrder({ question: env.q(question), ordered, rng: env.rng });
    },
  };

  registerLanguage(on, h);
  registerPhonics(on, h);

  const missing = skills.filter((s) => !handlers.has(s.family_id)).map((s) => s.family_id);
  if (missing.length) throw new Error(`no handler:\n${missing.join("\n")}`);

  const phonics = skills.filter((s) => s.category === "phonics").sort((a, b) => a.order - b.order);
  if (phonics.length !== 105) throw new Error(`expected 105 phonics skills, got ${phonics.length}`);
  const three = new Set(phonics.slice(0, 104).map((s) => s.family_id));

  const factsDir = path.join(pilot, "facts");
  fs.mkdirSync(factsDir, { recursive: true });
  for (const name of fs.readdirSync(factsDir)) {
    if (name.endsWith(".json")) fs.unlinkSync(path.join(factsDir, name));
  }

  const items = [];
  const skillReports = [];
  const seenSkillId = new Map();
  const ordered = skills.slice().sort((a, b) => a.order - b.order);

  for (const skill of ordered) {
    const n = three.has(skill.family_id) ? 3 : 2;
    const text = isTextVersion(skill);
    const facts = [];
    const dropped = [];
    const factIndex = new Map();
    const env = {
      n,
      rng: mulberry32(hash(skill.family_id)),
      skill,
      q(s) {
        return text ? `[text version] ${s}` : s;
      },
      keepFact(rec, claims) {
        if (!rec || !rec.word) throw new Error(`empty fact in ${skill.family_id}`);
        let row = factIndex.get(rec.word);
        if (!row) {
          row = { word: rec.word, phones: rec.phones, claims: [] };
          factIndex.set(rec.word, row);
          facts.push(row);
        }
        for (const c of claims) if (c && !row.claims.includes(c)) row.claims.push(c);
      },
      grammarFact(obj) {
        facts.push({ claim: obj.claim });
      },
      drop(word, claim, reason) {
        dropped.push({ word, claim, reason });
      },
    };
    const made = handlers.get(skill.family_id)(env);
    if (!Array.isArray(made) || made.length !== n) {
      throw new Error(`${skill.family_id} made ${made && made.length} items, need ${n}`);
    }
    const count = (seenSkillId.get(skill.skill_id) || 0) + 1;
    seenSkillId.set(skill.skill_id, count);
    const file = count === 1 ? `${skill.skill_id}.json` : `${skill.skill_id}__${count}.json`;
    const factDoc = {
      skill_id: skill.skill_id,
      family_id: skill.family_id,
      title: skill.title_en,
      item_type: skill.item_type,
      present: skill.present,
      text_version: text,
      question_count: n,
      facts,
      dropped,
    };
    fs.writeFileSync(path.join(factsDir, file), `${JSON.stringify(factDoc, null, 2)}\n`);
    made.forEach((item, i) => {
      items.push({
        id: `q${String(items.length + 1).padStart(3, "0")}`,
        skill_id: skill.skill_id,
        family_id: skill.family_id,
        type: skill.item_type,
        question: item.question,
        choices: item.choices,
        answer: item.answer,
        text_version: text,
        title: skill.title_en,
        n_in_skill: i + 1,
      });
    });
    skillReports.push({ ...factDoc, fact_file: file });
  }

  if (items.length !== 500) throw new Error(`expected 500 items, got ${items.length}`);
  validate(items, ordered, three);

  const publicItems = items.map(({ id, skill_id, family_id, type, question, choices, answer, text_version }) => ({
    id, skill_id, family_id, type, question, choices, answer, text_version,
  }));
  fs.writeFileSync(path.join(pilot, "grade1_pilot_500.json"), `${JSON.stringify(publicItems, null, 2)}\n`);
  fs.writeFileSync(path.join(pilot, "grade1_pilot_500.txt"), renderText(items));
  fs.writeFileSync(path.join(pilot, "SUMMARY.md"), renderSummary({
    skillReports, items, dict, fry, dolch, phonics,
  }));
  console.log(`wrote ${items.length} questions across ${skillReports.length} skills`);
}

function validate(items, skills, three) {
  const bySkill = new Map();
  for (const item of items) {
    if (!item.question || item.question.includes("undefined") || item.question.includes("null")) {
      throw new Error(`bad question ${item.id}`);
    }
    if (JSON.stringify(item).includes("undefined")) throw new Error(`undefined in ${item.id}`);
    const keys = item.choices.map((c) => String(c).trim());
    if (new Set(keys).size !== keys.length) throw new Error(`duplicate choices ${item.id}`);
    if (item.choices.some((c) => !String(c).trim())) throw new Error(`blank choice ${item.id}`);
    const text = item.text_version;
    const marked = item.question.startsWith("[text version] ");
    if (text !== marked) throw new Error(`text-version mark mismatch ${item.id}`);
    if (/^[A-H]$/.test(item.answer)) {
      const idx = item.answer.charCodeAt(0) - 65;
      if (!item.choices[idx]) throw new Error(`answer letter missing ${item.id}`);
    } else if (item.answer.includes("→")) {
      const parts = item.answer.split("; ").map((p) => p.trim());
      if (parts.length !== item.choices.length) throw new Error(`sort answer length ${item.id}`);
    } else if (item.answer.includes(", ")) {
      const letters = item.answer.split(", ");
      if (letters.length !== item.choices.length) throw new Error(`order answer length ${item.id}`);
    } else {
      throw new Error(`bad answer format ${item.id}: ${item.answer}`);
    }
    const list = bySkill.get(item.family_id) || [];
    list.push(item);
    bySkill.set(item.family_id, list);
  }
  let n3 = 0;
  let n2 = 0;
  for (const skill of skills) {
    const got = bySkill.get(skill.family_id) || [];
    const expect = three.has(skill.family_id) ? 3 : 2;
    if (got.length !== expect) throw new Error(`${skill.family_id} count ${got.length}`);
    if (expect === 3) n3++;
    else n2++;
    if (skill.item_type === "ab" && got.some((g) => g.choices.length !== 2)) {
      throw new Error(`ab choice count ${skill.family_id}`);
    }
    if (["abcd", "picture_to_word", "word_to_picture", "listen_tap", "odd_one_out"].includes(skill.item_type)) {
      if (got.some((g) => g.choices.length !== 4)) throw new Error(`need 4 choices ${skill.family_id}`);
    }
  }
  if (n3 !== 104 || n2 !== 94) throw new Error(`allocation ${n3} x3 and ${n2} x2`);
  const ids = items.map((i) => i.id);
  if (ids[0] !== "q001" || ids[499] !== "q500") throw new Error("id range");
  if (new Set(ids).size !== 500) throw new Error("duplicate ids");
}

function renderText(items) {
  const lines = [
    "Mr. Jay's Grade 1 ESL Skill Builder",
    "Text-only pilot. 500 questions. No audio and no pictures.",
    "",
  ];
  let last = "";
  for (const item of items) {
    const head = `${item.title}\n${item.skill_id}`;
    if (head !== last) {
      if (last) lines.push("");
      lines.push(item.title);
      lines.push(item.skill_id);
      lines.push("");
      last = head;
    }
    lines.push(`${item.n_in_skill}. ${item.question}`);
    item.choices.forEach((choice, i) => {
      lines.push(`${"ABCDEFGH"[i]}. ${choice}`);
    });
    lines.push(`Answer: ${item.answer}`);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

function renderSummary({ skillReports, items, dict, fry, dolch, phonics }) {
  const drops = skillReports.flatMap((s) => s.dropped.map((d) => ({ ...d, skill_id: s.skill_id, family_id: s.family_id, title: s.title })));
  const textSkills = skillReports.filter((s) => s.text_version);
  const textQuestions = items.filter((i) => i.text_version).length;
  const lines = [];
  lines.push("# Grade 1 pilot summary");
  lines.push("");
  lines.push("500 text-only questions cover all 198 skills. 104 skills have 3 questions and 94 have 2.");
  lines.push("");
  lines.push("The first 104 phonics skills in catalog order have 3 questions. The last phonics skill, `fam_which_word_does_not_rhyme`, and all 93 grammar, vocabulary, and reading skills have 2. 104 × 3 + 94 × 2 = 500.");
  lines.push("");
  lines.push("No skill was skipped.");
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  lines.push(`- CMUdict citation forms: ${dict.size} headwords. A phonics fact is kept only when the citation phonemes match the claim. A different stress-1 vowel drops the word. A stress-0 reduction does not.`);
  lines.push(`- Fry first 300: ${fry.ordered.length} words.`);
  lines.push(`- Dolch pre-primer ${dolch.levels.pre.length}, primer ${dolch.levels.primer.length}, grade 1 ${dolch.levels.g1.length}. Wikipedia grade 1 uses "going". The saved ReadWriteThink PDF was not parsed.`);
  lines.push(`- Dolch nouns used as common content words: ${dolch.nouns.length}.`);
  lines.push("- Other words are common CVC and decodable words whose sounds were confirmed in CMUdict, plus the sight words named in each skill title.");
  lines.push("- The old question bank in grade1/pack was not reused.");
  lines.push("");
  lines.push("## Text versions");
  lines.push("");
  lines.push(`${textSkills.length} skills are picture_to_word, word_to_picture, listen_tap, or listen-presented. Their ${textQuestions} questions are marked \`[text version]\` and test the same skill in words.`);
  lines.push("");
  lines.push("## Facts dropped");
  lines.push("");
  if (!drops.length) {
    lines.push("None.");
  } else {
    lines.push("These claims were not used. The script could not confirm them in CMUdict, or the claim was the matter/mat substring error.");
    lines.push("");
    for (const d of drops) {
      lines.push(`- ${d.skill_id} (${d.title}): ${d.word} / ${d.claim} — ${d.reason}`);
    }
  }
  lines.push("");
  lines.push("A spelling chunk such as \"mat\" inside \"matter\" is not a word inside a word. Compounds are kept only when both part spellings and both citation pronunciations join to the longer word, as in cup + cake.");
  lines.push("");
  lines.push("## Counts per skill");
  lines.push("");
  for (const s of skillReports) {
    const mark = s.text_version ? " text-version" : "";
    lines.push(`- ${s.question_count} — ${s.skill_id} — ${s.title} (${s.item_type}${mark}). Facts kept: ${s.facts.length}. Dropped: ${s.dropped.length}. File: facts/${s.fact_file}`);
  }
  lines.push("");
  lines.push(`Phonics skills: ${phonics.length}. Questions: ${items.length}.`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

main();
