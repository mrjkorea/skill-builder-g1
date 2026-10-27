"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const teacher = require("../teacher.js");

const BUILD = "20261027-teacher";
const root = path.join(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("button sits in the gap immediately left of the name chip", () => {
  const chip = { top: 12, left: 250 };
  const box = teacher.buttonBox(chip, 400, 96, 8);
  assert.equal(box.top, 12);
  assert.equal(box.left + 96 + box.gap, chip.left);
  assert.equal(400 - box.right, chip.left - 8);
});

test("PIN check uses study_teacher_check and never a local PIN", async () => {
  const calls = [];
  const auth = {
    ENDPOINT: "https://example.test/exec",
    student: () => "ada",
    token: () => "tok",
  };
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    return { json: async () => ({ ok: false, message: "Wrong PIN." }) };
  };
  const result = await teacher.verifyTeacherPin("  no-guess  ", { auth, fetch: fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Wrong PIN.");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, auth.ENDPOINT);
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.deepEqual(calls[0].body, {
    action: "study_teacher_check",
    pin: "no-guess",
    id: "ada",
    token: "tok",
  });
  const src = read("levels/teacher.js");
  assert.doesNotMatch(src, /pin\s*===?\s*["']/);
  assert.doesNotMatch(src, /teacher_secret\s*:\s*["'][^"']+["']/);
  assert.doesNotMatch(src, /STUDY_TEACHER_PIN\s*=/);
});

test("empty PIN does not call the server", async () => {
  let called = false;
  const result = await teacher.verifyTeacherPin("   ", {
    auth: { ENDPOINT: "https://example.test/exec" },
    fetch: async () => {
      called = true;
      return { json: async () => ({ ok: true }) };
    },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { ok: false, message: "Type the teacher PIN." });
});

test("correct study_teacher_check unlocks", async () => {
  const result = await teacher.verifyTeacherPin("right", {
    auth: { ENDPOINT: "https://example.test/exec", student: () => "ada", token: () => "tok" },
    fetch: async () => ({ json: async () => ({ ok: true }) }),
  });
  assert.deepEqual(result, { ok: true, message: "" });
});

test("missing study_teacher_check falls back to teacher_list_students", async () => {
  const bodies = [];
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    if (body.action === "study_teacher_check") return { json: async () => ({ error: "bad_action" }) };
    return { json: async () => ({ ok: true, students: [{ id: "ada" }] }) };
  };
  const result = await teacher.verifyTeacherPin("right", {
    auth: { ENDPOINT: "https://example.test/exec", student: () => "ada", token: () => "t" },
    fetch: fetchImpl,
  });
  assert.equal(result.ok, true);
  assert.equal(bodies[1].action, "teacher_list_students");
  assert.equal(bodies[1].teacher_secret, "right");
  assert.equal(bodies[1].id, "ada");
});

test("wrong teacher_secret stays locked", async () => {
  const result = await teacher.verifyTeacherPin("nope", {
    auth: { ENDPOINT: "https://example.test/exec" },
    fetch: async (_url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.action === "study_teacher_check") return { json: async () => ({ error: "bad_action" }) };
      return { json: async () => ({ ok: false, error: "forbidden", message: "Wrong PIN." }) };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Wrong PIN.");
});

test("both actions missing stays locked", async () => {
  const result = await teacher.verifyTeacherPin("nope", {
    auth: { ENDPOINT: "https://example.test/exec" },
    fetch: async () => ({ json: async () => ({ error: "bad_action" }) }),
  });
  assert.deepEqual(result, { ok: false, message: "Teacher check is not available yet." });
});

test("network failure stays locked", async () => {
  const result = await teacher.verifyTeacherPin("nope", {
    auth: { ENDPOINT: "https://example.test/exec" },
    fetch: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /Could not check the PIN/);
});

test("sign-in missing stays locked", async () => {
  const result = await teacher.verifyTeacherPin("nope", { auth: null, fetch: async () => ({ json: async () => ({ ok: true }) }) });
  assert.equal(result.ok, false);
  assert.equal(result.message, "Sign-in is not loaded.");
});

test("grade host maps mastery at the grade score cap", async () => {
  const saved = [];
  let opened = "";
  const host = teacher.gradeHost({
    levelId: "g1",
    levelTitle: "Grade 1",
    categories: () => [{ key: "phonics", label: "Phonics" }],
    skillsIn: () => [
      { skill_id: "a", number: 1, title_en: "Short a" },
      { skill_id: "b", number: 2, title_en: "Short e" },
    ],
    score: (id) => (id === "a" ? 99 : 40),
    titleOf: (skill) => skill.number + ". " + skill.title_en,
    setScore: async (id, score) => {
      saved.push({ id, score });
      return true;
    },
    open: (id) => {
      opened = id;
    },
  });
  assert.equal(host.catalog()[0].skills[0].mastered, true);
  assert.equal(host.catalog()[0].skills[1].mastered, false);
  assert.equal(await host.setMastered("b", true), true);
  assert.deepEqual(saved, [{ id: "b", score: 99 }]);
  await host.setMastered("a", false);
  assert.equal(saved[1].score, 0);
  host.jump("a");
  assert.equal(opened, "a");
});

test("signed-in pages share one teacher module and the build id", () => {
  const pages = [
    "levels/seed/index.html",
    "levels/roots/index.html",
    "levels/sprout/index.html",
    "levels/sapling/index.html",
    "grade1/index.html",
    "grade2/index.html",
    "index.html",
  ];
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /meta name="mrj-build" content="20261027-teacher"/, page);
    assert.match(html, /teacher\.js\?v=20261027-teacher/, page);
    assert.match(html, /teacher\.css\?v=20261027-teacher/, page);
  }
  const player = read("levels/player.js");
  assert.match(player, /SB_TEACHER/);
  assert.match(player, /setMastered/);
  assert.match(read("grade1/app.js"), /gradeHost/);
  assert.match(read("grade2/app.js"), /gradeHost/);
  assert.equal(teacher.BUILD, BUILD);
});
