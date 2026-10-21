#!/usr/bin/env node
/**
 * HEAD-check every intro + question (+ sound) clip on GitHub Pages audio repos.
 * Usage: node scripts/verify-audio-pages.mjs [--sample N]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const levels = ["seed", "roots", "sprout"];
const sample = process.argv.includes("--sample")
  ? Number(process.argv[process.argv.indexOf("--sample") + 1]) || 5
  : 0;

function loadQs(level) {
  return fs
    .readFileSync(path.join(root, "levels", level, "questions.jsonl"), "utf8")
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function resolveClipUrl(manifest, file) {
  const rel = String(file).replace(/^\//, "");
  const base = manifest.audio_base != null ? String(manifest.audio_base).trim() : "";
  if (!base) return rel;
  const prefix = base.endsWith("/") ? base : base + "/";
  return prefix + rel;
}

async function headOk(url) {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  return res.ok;
}

const urls = [];
let questionRows = 0;

for (const level of levels) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "levels", level, "manifest.json"), "utf8"));
  const intros = manifest.intros || {};
  for (const row of Object.values(intros)) {
    if (row && row.file) urls.push(resolveClipUrl(manifest, row.file));
  }
  for (const q of loadQs(level)) {
    questionRows += 1;
    const pr = manifest.questions && manifest.questions[q.prompt];
    if (pr && pr.file) urls.push(resolveClipUrl(manifest, pr.file));
    const needs = String(q.needs || "");
    if (needs.startsWith("sound:")) {
      const word = needs.slice(6);
      const sr = manifest.questions && manifest.questions[word];
      if (sr && sr.file) urls.push(resolveClipUrl(manifest, sr.file));
    }
  }
}

const unique = [...new Set(urls)];
const toCheck = sample > 0 ? unique.slice(0, sample) : unique;

console.log("question rows:", questionRows);
console.log("intro+clip URL refs (with duplicates):", urls.length);
console.log("unique URLs to check:", toCheck.length);

let missing = 0;
const concurrency = 24;
let i = 0;

async function worker() {
  while (i < toCheck.length) {
    const idx = i++;
    const url = toCheck[idx];
    let ok = false;
    try {
      ok = await headOk(url);
    } catch (_) {
      ok = false;
    }
    if (!ok) {
      missing += 1;
      if (missing <= 20) console.error("MISSING", url);
    }
    if ((idx + 1) % 500 === 0) console.log("checked", idx + 1, "/", toCheck.length);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.log("missing:", missing);
if (missing > 0) process.exit(1);
