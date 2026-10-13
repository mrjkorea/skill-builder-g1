"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("grade1 index does not load Kokoro (classroom PCs use browser speech)", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.doesNotMatch(html, /kokoro/i);
  assert.doesNotMatch(html, /huggingface/i);
  assert.match(html, /app\.js\?v=20261013-perf/);
});
