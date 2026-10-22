"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const pictures = require("../picture-resolve.js");
const progress = require("../progress.js");
const audioUrl = require("../audio-url.js");
const strandTheme = require("../strand-theme.js");
const phonicsPlan = require("../phonics-plan.js");
const phonicsAudit = require("../phonics-audit.js");

const root = path.join(__dirname, "..", "..");

function readList(name) {
  return fs
    .readFileSync(path.join(root, "levels/_notes", name), "utf8")
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadQs(level) {
  return fs
    .readFileSync(path.join(root, "levels", level, "questions.jsonl"), "utf8")
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("new pictures exist for every subject in the notes", () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, "levels/pictures/index.json"), "utf8"));
  const subjects = [
    ...readList("new_pictures_seed.txt"),
    ...readList("new_pictures_roots.txt"),
    ...readList("new_pictures_sprout.txt"),
  ];
  assert.equal(subjects.length, 80);
  assert.equal(Object.keys(index).length, 80);
  for (const subject of subjects) {
    const file = index[subject.toLowerCase()];
    assert.ok(file, subject);
    const full = path.join(root, "levels/pictures", file);
    assert.equal(fs.existsSync(full), true, subject);
    assert.ok(fs.statSync(full).size < 30 * 1024, subject);
  }
});

test("picture questions reuse old art or use a new drawing", () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, "levels/pictures/index.json"), "utf8"));
  const old = JSON.parse(fs.readFileSync(path.join(root, "grade1/pack/pictures.json"), "utf8"));
  const counts = { seed: { new: 0, old: 0, missing: 0 }, roots: { new: 0, old: 0, missing: 0 }, sprout: { new: 0, old: 0, missing: 0 } };
  const missing = [];
  for (const level of ["seed", "roots", "sprout"]) {
    for (const q of loadQs(level)) {
      if (!pictures.subjectOf(q)) continue;
      const hit = pictures.resolve(q, index, old);
      if (!hit) {
        counts[level].missing += 1;
        missing.push(level + " " + q.id + " " + pictures.subjectOf(q));
      } else if (hit.kind === "new") counts[level].new += 1;
      else counts[level].old += 1;
    }
  }
  assert.deepEqual(missing, []);
  assert.equal(counts.seed.new, 51);
  assert.equal(counts.seed.old, 750);
  assert.equal(counts.roots.new, 18);
  assert.equal(counts.roots.old, 30);
  assert.equal(counts.sprout.new, 15);
  assert.equal(counts.sprout.old, 26);
});

test("progress merge keeps the further score and place without localStorage", () => {
  const src = fs.readFileSync(path.join(root, "levels/progress.js"), "utf8");
  assert.equal(src.includes("localStorage"), false);
  const local = progress.parseProgress(
    { v: 2, level: "seed", scores: { a: 10 }, stats: { a: { correct: 1, wrong: 0 } }, last: { skill_id: "a", index: 3 }, cursor: { a: 3 } },
    "seed"
  );
  const remote = progress.parseProgress(
    { v: 2, level: "seed", scores: { a: 40, b: 5 }, stats: { a: { correct: 2, wrong: 1 } }, last: null, cursor: { a: 1, b: 2 } },
    "seed"
  );
  const merged = progress.mergeProgress(local, remote, "seed");
  assert.equal(merged.scores.a, 40);
  assert.equal(merged.scores.b, 5);
  assert.equal(merged.stats.a.correct, 2);
  assert.equal(merged.stats.a.wrong, 1);
  assert.equal(merged.cursor.a, 3);
  assert.equal(merged.cursor.b, 2);
  assert.equal(merged.last.skill_id, "a");
  assert.equal(merged.last.index, 3);
  const up = progress.applyScore(0, true, 0);
  assert.equal(up.score, 10);
  const down = progress.applyScore(10, false, 0);
  assert.equal(down.score, 8);
});

test("mastery is SmartScore at 100 with legacy 99 upgraded on load", () => {
  assert.equal(progress.MASTER_SCORE, 100);
  assert.equal(progress.isSkillMastered(98), false);
  assert.equal(progress.isSkillMastered(99), true);
  assert.equal(progress.isSkillMastered(100), true);
  const legacy = progress.parseProgress({ v: 2, level: "seed", scores: { done: 99, mid: 50 } }, "seed");
  assert.equal(legacy.scores.done, 100);
  assert.equal(legacy.scores.mid, 50);
  assert.equal(progress.isSkillMastered(progress.skillScore(legacy, "done")), true);
  const skills = [{ skill_id: "a" }, { skill_id: "b" }, { skill_id: "c" }];
  assert.equal(progress.nextSkillInOrder(skills, "a").skill_id, "b");
  assert.equal(progress.nextSkillInOrder(skills, "c"), null);
});

test("skill-nav builds skill and index URLs", () => {
  const nav = require("../skill-nav.js");
  const base = "https://example.com/levels/seed/?foo=1";
  assert.equal(nav.parseSkillParam(base + "&skill=abc"), "abc");
  assert.equal(nav.skillPageUrl("x", base), "/levels/seed/?foo=1&skill=x");
  assert.equal(nav.indexPageUrl(base + "&skill=x"), "/levels/seed/?foo=1");
});

test("level player has no TTS and no local progress store", () => {
  const player = fs.readFileSync(path.join(root, "levels/player.js"), "utf8");
  assert.equal(/speechSynthesis|SpeechSynthesis|kokoro|SkillBuilderTts|localStorage/i.test(player), false);
  assert.match(player, /questions\.jsonl/);
  assert.match(player, /manifest\.json/);
  assert.equal(/10250|7052|7702/.test(player), false);
  assert.match(player, /SB_LEVEL_UI/);
  assert.match(player, /SB_STRAND_THEME/);
  assert.match(player, /SB_INDEX_UI/);
  assert.match(player, /SB_PHONICS_PLAN/);
});

test("phonics plan hides non-plan skills and excludes BAD-pattern questions", () => {
  const plan = JSON.parse(fs.readFileSync(path.join(root, "levels/phonics-plan.json"), "utf8"));
  assert.ok(plan.hiddenSkills.seed.includes("seed_v2_find_vowel_letter"));
  assert.ok(plan.hiddenSkills.seed.includes("seed_v2_sort_blend_or_digraph"));
  const ex = plan.excludeQuestions.seed["seed_v2_silent_e_picture"] || [];
  assert.ok(ex.length > 0);
  const qs = loadQs("seed").filter((q) => q.skill_id === "seed_v2_silent_e_picture");
  const row = phonicsAudit.parseFinalLines(
    fs.readFileSync(path.join(root, "levels/_notes/final_lines.txt"), "utf8")
  ).seed.seed_v2_silent_e_picture;
  for (const id of ex) {
    const q = qs.find((x) => x.id === id);
    assert.ok(q, id);
    assert.equal(phonicsAudit.questionVerdict(q, row), "BAD");
  }
  const skill = {
    skill_id: "seed_v2_silent_e_picture",
    strand: "phonics",
    title: "Silent e",
    questions: qs,
  };
  const filtered = phonicsPlan.applyQuestionFilter(skill, plan, "seed");
  assert.equal(filtered.questions.length, qs.length - ex.length);
  assert.equal(phonicsPlan.visibleForIndex({ ...skill, questions: filtered.questions }, plan, "seed"), true);
  assert.equal(
    phonicsPlan.visibleForIndex({ skill_id: "seed_v2_find_vowel_letter", strand: "phonics", questions: [{}] }, plan, "seed"),
    false
  );
});

test("phonics plan JSON has 59 ordered slots across levels", () => {
  const plan = JSON.parse(fs.readFileSync(path.join(root, "levels/phonics-plan.json"), "utf8"));
  let n = 0;
  for (const level of ["seed", "roots", "sprout"]) {
    n += plan.levels[level].length;
  }
  assert.equal(n, 59);
  assert.equal(plan.levels.seed[0].comingSoon, true);
});

test("strand themes cover standard subjects with section anchors", () => {
  assert.deepEqual(strandTheme.STRAND_ORDER, ["phonics", "reading", "grammar", "vocabulary"]);
  const p = strandTheme.themeFor("phonics");
  assert.equal(p.color, "#0ea5e9");
  assert.equal(strandTheme.sectionId("grammar"), "strand-grammar");
  assert.match(strandTheme.iconSvg("reading"), /<svg/);
});

test("audio_base resolves clip URLs for Pages satellites", () => {
  const m = { audio_base: "https://example.com/skill-builder-g1-audio-2/levels/seed/" };
  assert.equal(
    audioUrl.resolveClipUrl(m, "audio/q/abc.mp3"),
    "https://example.com/skill-builder-g1-audio-2/levels/seed/audio/q/abc.mp3"
  );
  assert.equal(audioUrl.resolveClipUrl({}, "audio/q/x.mp3"), "audio/q/x.mp3");
});

test("manifest audio_base is set for each live level", () => {
  const expected = {
    seed: "skill-builder-g1-audio-2",
    roots: "skill-builder-g1-audio-3",
    sprout: "skill-builder-g1-audio-4",
  };
  for (const [level, repo] of Object.entries(expected)) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "levels", level, "manifest.json"), "utf8"));
    assert.match(String(manifest.audio_base || ""), new RegExp(repo));
    assert.match(String(manifest.audio_base), new RegExp("levels/" + level + "/"));
    assert.match(String(manifest.audio_base), /^https:\/\//);
    assert.equal(
      fs.existsSync(path.join(root, "levels", level, "audio")),
      false,
      "level audio must not ship in main; use audio_base Pages repos"
    );
  }
});

test("chooser lists levels only, not legacy grade apps", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /levels\/seed\//);
  assert.match(html, /Coming soon/);
  assert.equal(/grade1\/|Grade 1|Grade 2/i.test(html), false);
  assert.match(html, /anim-seed/);
  assert.match(fs.readFileSync(path.join(root, "chooser.css"), "utf8"), /prefers-reduced-motion/);
});

test("prompts missing a manifest clip are only the known gaps", () => {
  const gaps = [];
  for (const level of ["seed", "roots", "sprout"]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "levels", level, "manifest.json"), "utf8"));
    for (const q of loadQs(level)) {
      if (!manifest.questions[q.prompt]) gaps.push(level + ":" + q.id);
      const needs = String(q.needs || "");
      if (needs.startsWith("sound:")) {
        const word = needs.slice(6);
        assert.ok(manifest.questions[word], word);
        assert.match(String(manifest.audio_base || ""), /^https:\/\//);
        assert.match(
          audioUrl.resolveClipUrl(manifest, manifest.questions[word].file),
          /^https:\/\//
        );
      }
    }
  }
  assert.equal(gaps.length, 0);
});
