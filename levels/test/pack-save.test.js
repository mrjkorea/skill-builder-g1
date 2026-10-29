"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const packSave = require("../pack-save.js");
const progressApi = require("../progress.js");

const BUILD = "20261029-roots-progress";
const root = path.join(__dirname, "..", "..");

function miniAuth() {
  const packState = {};
  const calls = { load: [], save: [] };
  let loadHandler = async () => ({ ok: true, found: false, progress_json: "" });
  let saveHandler = async () => ({ ok: true });
  return {
    calls,
    packState,
    setLoad(fn) {
      loadHandler = fn;
    },
    setSave(fn) {
      saveHandler = fn;
    },
    packReady(program) {
      const ps = packState[program];
      return !!(ps && ps.loaded && !ps.error);
    },
    async loadPack(program) {
      calls.load.push(program);
      packState[program] = { loaded: false, json: "", error: "loading" };
      let data;
      try {
        data = await loadHandler(program);
      } catch (_) {
        packState[program] = { loaded: false, json: "", error: "network" };
        return { ok: false, error: "network" };
      }
      if (!data || data.ok !== true) {
        packState[program] = {
          loaded: false,
          json: "",
          error: (data && data.error) || "pack_load_failed",
        };
        return data || { ok: false, error: "pack_load_failed" };
      }
      const json = data.progress_json != null ? String(data.progress_json) : "";
      packState[program] = { loaded: true, json: json, error: "" };
      return { ok: true, found: !!data.found, progress_json: json };
    },
    async savePack(program, progressJson) {
      const ps = packState[program];
      const loaded = !!(ps && ps.loaded);
      calls.save.push({ program, progressJson, loaded });
      if (!loaded) return { ok: false, error: "pack_not_loaded" };
      let data;
      try {
        data = await saveHandler(program, progressJson);
      } catch (_) {
        ps.loaded = false;
        ps.error = "network";
        return { ok: false, error: "network" };
      }
      if (data && data.ok) {
        packState[program] = { loaded: true, json: String(progressJson), error: "" };
        return data;
      }
      ps.loaded = false;
      ps.error = (data && data.error) || "save_failed";
      return data || { ok: false, error: "save_failed" };
    },
  };
}

function setup(opts) {
  const options = opts || {};
  const level = options.level || "roots";
  const program = options.program || "skill-builder-" + level;
  let progress = options.progress || progressApi.emptyProgress(level);
  let studentId = options.studentId != null ? options.studentId : "jei";
  const statuses = [];
  const timers = [];
  const auth = options.auth || miniAuth();
  const saver = packSave.create({
    program,
    level,
    Progress: progressApi,
    getAuth: () => auth,
    getProgress: () => progress,
    setProgress: (next) => {
      progress = next;
    },
    getStudentId: () => studentId,
    setStatus: (status) => {
      statuses.push(status);
    },
    applyTeacher: options.applyTeacher,
    setTimer(fn, ms) {
      const timer = { fn, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      if (timer) timer.cleared = true;
    },
    retryMs: options.retryMs != null ? options.retryMs : packSave.RETRY_MS,
  });
  return {
    saver,
    auth,
    timers,
    statuses,
    program,
    getProgress: () => progress,
    setProgress: (next) => {
      progress = next;
    },
    setStudentId: (id) => {
      studentId = id;
    },
  };
}

async function waitUntil(fn) {
  for (let i = 0; i < 50; i++) {
    if (fn()) return;
    await Promise.resolve();
  }
  throw new Error("timed out waiting for pack save step");
}

function liveTimers(timers) {
  return timers.filter((timer) => !timer.cleared);
}

function savedJson(auth) {
  const row = auth.calls.save[auth.calls.save.length - 1];
  assert.ok(row, "expected savePack");
  assert.equal(row.loaded, true);
  return JSON.parse(row.progressJson);
}

test("answers during a slow loadPack are merged into the empty AppProgress pack", async () => {
  const ctx = setup();
  let release;
  ctx.auth.setLoad(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const started = ctx.saver.refresh();
  await waitUntil(() => ctx.auth.calls.load.length === 1);
  assert.equal(ctx.auth.calls.save.length, 0);
  const local = ctx.getProgress();
  local.scores.roots_skill = 10;
  local.stats.roots_skill = { correct: 1, wrong: 0 };
  const answer = ctx.saver.noteLocalChange();
  assert.equal(ctx.statuses.includes("pending"), true);
  assert.equal(ctx.auth.calls.save.length, 0);
  release({ ok: true, found: false, progress_json: "" });
  await started;
  await answer;
  const saved = savedJson(ctx.auth);
  assert.equal(ctx.auth.calls.load[0], "skill-builder-roots");
  assert.equal(ctx.auth.calls.save[0].program, "skill-builder-roots");
  assert.equal(saved.scores.roots_skill, 10);
  assert.equal(saved.stats.roots_skill.correct, 1);
  assert.equal(ctx.auth.calls.save.every((row) => row.loaded), true);
  assert.equal(ctx.statuses[ctx.statuses.length - 1], "saved");
});

test("failed loadPack does not save, then a retry writes the pending score", async () => {
  const ctx = setup();
  let loads = 0;
  ctx.auth.setLoad(async () => {
    loads += 1;
    if (loads < 3) return { ok: false, error: "network" };
    return { ok: true, found: false, progress_json: "" };
  });
  await ctx.saver.refresh();
  assert.equal(ctx.auth.calls.save.length, 0);
  assert.equal(liveTimers(ctx.timers).length, 0);

  const local = ctx.getProgress();
  local.scores.roots_skill = 10;
  local.stats.roots_skill = { correct: 1, wrong: 0 };
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.save.length, 0);
  assert.equal(ctx.statuses.includes("pending"), true);
  const pending = liveTimers(ctx.timers);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].ms, packSave.RETRY_MS);
  assert.ok(packSave.RETRY_MS <= 5000);

  await pending[0].fn();
  const saved = savedJson(ctx.auth);
  assert.equal(saved.scores.roots_skill, 10);
  assert.equal(ctx.auth.packReady("skill-builder-roots"), true);
  assert.equal(ctx.statuses[ctx.statuses.length - 1], "saved");
});

test("flush after a failed load retries immediately instead of waiting out the timer", async () => {
  const ctx = setup();
  let loads = 0;
  ctx.auth.setLoad(async () => {
    loads += 1;
    if (loads === 1) return { ok: false, error: "pack_load_failed" };
    return { ok: true, found: false, progress_json: "" };
  });
  ctx.getProgress().scores.roots_skill = 12;
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.save.length, 0);
  assert.equal(ctx.statuses.includes("pending"), true);
  await ctx.saver.flush();
  assert.equal(savedJson(ctx.auth).scores.roots_skill, 12);
  assert.equal(ctx.auth.calls.save.every((row) => row.loaded), true);
});

test("thrown loadPack stays pending and retries like a network failure", async () => {
  const ctx = setup();
  let loads = 0;
  ctx.auth.setLoad(async () => {
    loads += 1;
    if (loads === 1) throw new Error("boom");
    return { ok: true, found: false, progress_json: "" };
  });
  ctx.setProgress(
    progressApi.parseProgress(
      { v: 2, level: "roots", scores: { roots_skill: 20 }, stats: { roots_skill: { correct: 2, wrong: 0 } } },
      "roots"
    )
  );
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.save.length, 0);
  await liveTimers(ctx.timers)[0].fn();
  assert.equal(savedJson(ctx.auth).scores.roots_skill, 20);
});

test("load merges an existing pack with in-memory scores and saves", async () => {
  const ctx = setup();
  const remote = { v: 2, level: "roots", scores: { other: 30 }, stats: {}, last: null, cursor: {} };
  ctx.auth.setLoad(async () => ({ ok: true, found: true, progress_json: JSON.stringify(remote) }));
  const local = ctx.getProgress();
  local.scores.roots_skill = 10;
  await ctx.saver.refresh();
  const saved = savedJson(ctx.auth);
  assert.equal(saved.scores.roots_skill, 10);
  assert.equal(saved.scores.other, 30);
  assert.equal(ctx.auth.calls.load.length, 1);
});

test("savePack pack_not_loaded after a failed save reloads and then saves", async () => {
  const ctx = setup();
  let saves = 0;
  ctx.auth.setSave(async () => {
    saves += 1;
    if (saves === 1) return { ok: false, error: "network" };
    return { ok: true };
  });
  const local = ctx.getProgress();
  local.scores.roots_skill = 40;
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.load.length, 2);
  assert.equal(ctx.auth.calls.save.length, 2);
  assert.equal(ctx.auth.calls.save.every((row) => row.loaded), true);
  assert.equal(savedJson(ctx.auth).scores.roots_skill, 40);
  assert.equal(ctx.auth.packReady("skill-builder-roots"), true);
  assert.equal(ctx.statuses[ctx.statuses.length - 1], "saved");
  assert.equal(liveTimers(ctx.timers).length, 0);
});

test("a save that keeps failing schedules one retry and does not tight-loop", async () => {
  const ctx = setup();
  ctx.auth.setSave(async () => ({ ok: false, error: "save_failed" }));
  ctx.getProgress().scores.roots_skill = 10;
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.save.length, 2);
  assert.equal(ctx.auth.calls.load.length, 2);
  assert.equal(ctx.auth.calls.save.every((row) => row.loaded), true);
  assert.equal(ctx.statuses[ctx.statuses.length - 1], "error");
  assert.equal(liveTimers(ctx.timers).length, 1);
});

test("bad_token does not retry loadPack", async () => {
  const ctx = setup();
  ctx.auth.setLoad(async () => ({ ok: false, error: "bad_token" }));
  ctx.getProgress().scores.roots_skill = 10;
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.load.length, 1);
  assert.equal(ctx.auth.calls.save.length, 0);
  assert.equal(liveTimers(ctx.timers).length, 0);
  assert.equal(ctx.statuses[ctx.statuses.length - 1], "error");
});

test("a second answer during savePack is still written", async () => {
  const ctx = setup();
  let release;
  let held = false;
  ctx.auth.setSave(() => {
    if (held) return Promise.resolve({ ok: true });
    held = true;
    return new Promise((resolve) => {
      release = () => resolve({ ok: true });
    });
  });
  ctx.getProgress().scores.a = 10;
  const first = ctx.saver.noteLocalChange();
  await waitUntil(() => typeof release === "function");
  ctx.getProgress().scores.a = 20;
  ctx.getProgress().scores.b = 5;
  const second = ctx.saver.noteLocalChange();
  release({ ok: true });
  await first;
  await second;
  const saved = savedJson(ctx.auth);
  assert.equal(saved.scores.a, 20);
  assert.equal(saved.scores.b, 5);
  assert.ok(ctx.auth.calls.save.length >= 2);
});

test("pagehide flush waits for a slow load before it resolves", async () => {
  const ctx = setup();
  let release;
  ctx.auth.setLoad(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  ctx.getProgress().scores.roots_skill = 15;
  const pending = ctx.saver.flush();
  let done = false;
  pending.then(() => {
    done = true;
  });
  await waitUntil(() => ctx.auth.calls.load.length === 1);
  await Promise.resolve();
  assert.equal(done, false);
  assert.equal(ctx.auth.calls.save.length, 0);
  release({ ok: true, found: false, progress_json: "" });
  await pending;
  assert.equal(done, true);
  assert.equal(savedJson(ctx.auth).scores.roots_skill, 15);
});

test("flush resolves after savePack so sign-out can follow the write", async () => {
  const ctx = setup();
  const order = [];
  let release;
  ctx.auth.setSave(
    () =>
      new Promise((resolve) => {
        release = () => {
          order.push("save");
          resolve({ ok: true });
        };
      })
  );
  ctx.getProgress().scores.roots_skill = 10;
  const pending = ctx.saver.noteLocalChange();
  await waitUntil(() => typeof release === "function");
  let done = false;
  pending.then(() => {
    done = true;
  });
  await Promise.resolve();
  assert.equal(done, false);
  release();
  await pending;
  order.push("signOut");
  assert.deepEqual(order, ["save", "signOut"]);
  assert.equal(ctx.auth.packReady(ctx.program), true);
});

test("seed uses the same flush with its own program key", async () => {
  const ctx = setup({ level: "seed", program: "skill-builder-seed" });
  ctx.getProgress().scores.seed_skill = 10;
  await ctx.saver.noteLocalChange();
  assert.equal(ctx.auth.calls.load[0], "skill-builder-seed");
  assert.equal(ctx.auth.calls.save[0].program, "skill-builder-seed");
  assert.equal(savedJson(ctx.auth).scores.seed_skill, 10);
});

test("level pages stamp the progress fix and still load the teacher build", () => {
  const player = fs.readFileSync(path.join(root, "levels/player.js"), "utf8");
  const glue = fs.readFileSync(path.join(root, "levels/pack-save.js"), "utf8");
  assert.equal(glue.includes("localStorage"), false);
  assert.equal(/if \(!packReady \|\| !root\.MRJ_AUTH/.test(player), false);
  assert.match(player, /SB_PACK_SAVE/);
  assert.match(player, /saver\.refresh\(/);
  assert.match(player, /saver\.flush\(/);
  assert.match(player, /skill-builder-" \+ level/);
  assert.match(player, /noteScore/);
  const signAt = player.indexOf('"Sign out"');
  assert.ok(signAt >= 0);
  const signBlock = player.slice(signAt, player.indexOf("bar.appendChild(out)", signAt));
  const flushAt = signBlock.indexOf("await saver.flush()");
  assert.ok(flushAt >= 0);
  assert.ok(flushAt < signBlock.indexOf('studentId = ""'));
  assert.ok(flushAt < signBlock.indexOf(".signOut()"));
  assert.match(player, /pagehide[\s\S]{0,180}saver\.flush\(\)/);
  assert.match(player, /visibilityState === "hidden"[\s\S]{0,120}saver\.flush\(\)/);

  for (const level of ["seed", "roots", "sprout", "sapling"]) {
    const html = fs.readFileSync(path.join(root, "levels", level, "index.html"), "utf8");
    assert.match(html, new RegExp('meta name="mrj-build" content="' + BUILD + '"'), level);
    assert.match(html, new RegExp("pack-save\\.js\\?v=" + BUILD), level);
    assert.match(html, new RegExp("player\\.js\\?v=" + BUILD), level);
    assert.match(html, /teacher\.js\?v=20261027-teacher/, level);
    assert.match(html, /teacher\.css\?v=20261027-teacher/, level);
    assert.match(html, new RegExp('data-mrj-score-programs="skill-builder-' + level + '"'), level);
    assert.match(html, new RegExp('SB_LEVELS\\.start\\(\\{ level: "' + level + '"'), level);
    assert.ok(html.indexOf("pack-save.js") < html.indexOf("player.js"), level);
  }
});
