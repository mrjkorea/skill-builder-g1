"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sync = require("../sb-pack-sync.js");

test("mergeProgress keeps max scores per skill", () => {
  const local = { v: 1, scores: { a: 40, b: 10 }, stats: {}, lang: null };
  const remote = { v: 1, scores: { a: 55, c: 5 }, stats: {}, lang: null };
  const merged = sync.mergeProgress(local, remote);
  assert.equal(merged.scores.a, 55);
  assert.equal(merged.scores.b, 10);
  assert.equal(merged.scores.c, 5);
});

test("mergeProgress keeps max correct/wrong per skill", () => {
  const local = {
    v: 1,
    scores: {},
    stats: { s1: { correct: 3, wrong: 1 }, s2: { correct: 0, wrong: 2 } },
    lang: null,
  };
  const remote = {
    v: 1,
    scores: {},
    stats: { s1: { correct: 2, wrong: 4 }, s2: { correct: 1, wrong: 0 } },
    lang: null,
  };
  const merged = sync.mergeProgress(local, remote);
  assert.deepEqual(merged.stats.s1, { correct: 3, wrong: 4 });
  assert.deepEqual(merged.stats.s2, { correct: 1, wrong: 2 });
});

test("parseProgressJson treats invalid server JSON as empty", () => {
  const parsed = sync.parseProgressJson("{not json");
  assert.deepEqual(parsed.scores, {});
  assert.deepEqual(parsed.stats, {});
});

test("isRicherThan detects merged progress worth uploading", () => {
  const server = sync.parseProgressJson('{"scores":{"x":10},"stats":{}}');
  const merged = sync.mergeProgress(server, { v: 1, scores: { x: 10 }, stats: {}, lang: null });
  const richer = sync.mergeProgress(merged, {
    v: 1,
    scores: { x: 10, y: 5 },
    stats: {},
    lang: null,
  });
  assert.equal(sync.isRicherThan(richer, server), true);
});

test("canSaveToServer requires packReady after successful load", () => {
  const auth = { packReady: (p) => p === "skill-builder-g1" };
  assert.equal(sync.canSaveToServer(false, auth, "skill-builder-g1"), false);
  assert.equal(sync.canSaveToServer(true, auth, "skill-builder-g1"), true);
  assert.equal(sync.canSaveToServer(true, auth, "other"), false);
});

test("studentStorageKey does not read legacy device-wide keys", () => {
  const legacy = { sb_scores: '{"a":99}', "sb_scores:alice": '{"a":10}' };
  const key = sync.studentStorageKey(sync.SCORES_BASE, "alice");
  assert.equal(key, "sb_scores:alice");
  const raw = legacy[key];
  assert.equal(JSON.parse(raw).a, 10);
  assert.notEqual(legacy.sb_scores, raw);
});

test("idKey normalizes student ids like mrj-auth", () => {
  assert.equal(sync.idKey("  Alice  "), "alice");
});
