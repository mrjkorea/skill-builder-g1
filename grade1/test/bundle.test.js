"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("grade pages do not load a TTS engine", () => {
  const files = [
    "../index.html",
    "../app.js",
    "../../grade2/index.html",
    "../../grade2/app.js",
    "../../index.html",
    "../../levels/player.js",
  ].map((rel) => fs.readFileSync(path.join(__dirname, rel), "utf8"));
  const blob = files.join("\n");
  assert.doesNotMatch(blob, /kokoro/i);
  assert.doesNotMatch(blob, /huggingface/i);
  assert.doesNotMatch(blob, /speechSynthesis/);
  assert.doesNotMatch(blob, /SpeechSynthesisUtterance/);
  assert.doesNotMatch(blob, /SkillBuilderTts/);
  assert.match(files[0], /app\.js\?v=20261020-notts/);
});
