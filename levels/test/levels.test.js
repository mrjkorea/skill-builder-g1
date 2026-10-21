"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const pictures = require("../picture-resolve.js");
const progress = require("../progress.js");

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
});

test("chooser lists levels only, not legacy grade apps", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /levels\/seed\//);
  assert.match(html, /Coming soon/);
  assert.equal(/grade1\/|Grade 1|Grade 2/i.test(html), false);
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
        assert.equal(fs.existsSync(path.join(root, "levels", level, manifest.questions[word].file)), true);
      }
    }
  }
  assert.equal(gaps.length, 23);
});
