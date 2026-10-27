"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scoreSave = require("../sb-score-save.js");

const BUILD = "20261027-teacher";
const TEST_STUDENT = "zz_test_mrjmetrics";

function loadMrjScores(mocks) {
  const root = {
    MRJ_AUTH: mocks.MRJ_AUTH,
    addEventListener: null,
    fetch: mocks.fetch,
    localStorage: mocks.localStorage,
  };
  const code = fs.readFileSync(path.join(__dirname, "../mrj-scores.js"), "utf8");
  const ctx = vm.createContext({ window: root, root, fetch: mocks.fetch });
  vm.runInContext(code, ctx, { filename: "mrj-scores.js" });
  return root.MRJ_SCORES;
}

test("index.html cache-bust stamps match mrj-build for changed JS", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const meta = html.match(/meta name="mrj-build" content="([^"]+)"/);
  assert.ok(meta, "mrj-build meta");
  assert.equal(meta[1], BUILD);
  assert.match(html, new RegExp(`app\\.js\\?v=${BUILD}`));
  assert.match(html, new RegExp(`mrj-scores\\.js\\?v=${BUILD}`));
  const stamp = fs.readFileSync(path.join(__dirname, "../BUILD_STAMP.txt"), "utf8");
  assert.match(stamp, new RegExp(`stamp=${BUILD}`));
});

test("one correct answer on skill A1 logs CM question, CM skill_score, and noteScore", () => {
  const posts = [];
  const notes = [];
  const MRJ_SCORES = {
    post(opts) {
      posts.push(opts);
      return Promise.resolve({ status: "ok" });
    },
    localDate() {
      return "2026-10-11";
    },
  };
  const MRJ_AUTH = {
    noteScore(opts) {
      notes.push(opts);
    },
  };

  scoreSave.logAnswer(
    { studentId: TEST_STUDENT, MRJ_SCORES, MRJ_AUTH },
    "A1",
    "q_test_001",
    true,
    55,
    2
  );

  assert.equal(posts.length, 2);
  const question = posts[0];
  assert.equal(question.itemId, "g1:A1:q_test_001");
  assert.equal(question.itemType, "question");
  assert.equal(question.scoreValue, 1);
  assert.equal(question.scoreMax, 1);
  assert.equal(question.correctness, "correct");
  assert.deepEqual(question.metadata, { smart_score: 55, tier: 2 });

  const skillRow = posts[1];
  assert.equal(skillRow.itemId, "g1:A1");
  assert.equal(skillRow.itemType, "skill_score");
  assert.equal(skillRow.scoreValue, 55);
  assert.equal(skillRow.scoreMax, 100);
  assert.equal(skillRow.scorePct, 55);

  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0], {
    program: "skill-builder-g1",
    itemId: "g1:A1",
    scoreValue: 55,
    scoreMax: 100,
    scorePct: 55,
    localDate: "2026-10-11",
  });
});

test("signed out student sends no CM or SSI rows", () => {
  const posts = [];
  const notes = [];
  scoreSave.logAnswer(
    {
      studentId: "",
      MRJ_SCORES: { post: (o) => posts.push(o), localDate: () => "2026-10-11" },
      MRJ_AUTH: { noteScore: (o) => notes.push(o) },
    },
    "A1",
    "q1",
    true,
    10,
    2
  );
  assert.equal(posts.length, 0);
  assert.equal(notes.length, 0);
});

test("MRJ_SCORES.post uses student id_key instead of unknown", async () => {
  let captured;
  const fetchCalls = [];
  const MRJ_SCORES = loadMrjScores({
    MRJ_AUTH: { student: () => TEST_STUDENT },
    fetch(_url, init) {
      fetchCalls.push(1);
      captured = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });
    },
    localStorage: {
      getItem: () => "[]",
      setItem: () => {},
    },
  });

  await MRJ_SCORES.post({
    program: "skill-builder-g1",
    itemId: "g1:test",
    itemType: "skill_score",
    scoreValue: 40,
    scoreMax: 100,
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(captured.student_email, TEST_STUDENT);
  assert.equal(captured.student_name, TEST_STUDENT);
  assert.match(captured.session_id, /^skill-builder-g1-zz_test_mrjmetrics-/);
  assert.equal(captured.events[0].identity_method, "mrj_signin");
  assert.equal(captured.events[0].identity_confidence, "high");
});

test("MRJ_SCORES.post skips when no signed-in student", async () => {
  let fetchCalls = 0;
  const MRJ_SCORES = loadMrjScores({
    MRJ_AUTH: { student: () => "" },
    fetch() {
      fetchCalls += 1;
      return Promise.resolve({ ok: true, json: () => ({}) });
    },
    localStorage: {
      getItem: () => "[]",
      setItem: () => {},
    },
  });

  const res = await MRJ_SCORES.post({ itemId: "g1:x", scoreValue: 1, scoreMax: 1 });
  assert.equal(res.status, "skipped");
  assert.equal(fetchCalls, 0);
});
