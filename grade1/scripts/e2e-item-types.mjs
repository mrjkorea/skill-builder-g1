/**
 * Smoke: one skill per item_type on live or local base URL.
 * Usage: node grade1/scripts/e2e-item-types.mjs [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://mrjkorea.github.io/skill-builder-g1/grade1/";
const ID = "zz_test_it_sb";
const PW = "zztest99";

const TYPES = [
  "abcd",
  "sort_four_bins",
  "tap_missing_word",
  "picture_to_word",
  "word_to_picture",
  "ab",
  "order_sentences",
  "order_words",
  "listen_tap",
  "sort_two_bins",
  "odd_one_out",
];

async function login(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "I already have an ID" }).click();
  await page.getByLabel("ID").fill(ID);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForSelector("h1.title-main", { timeout: 120000 });
}

async function openSkillByType(page, type) {
  const meta = await page.evaluate(async (t) => {
    const skills = await fetch("./pack/skills.json").then((r) => r.json());
    const s = skills.find((sk) => sk.item_type === t);
    return s ? { title: s.title_en, id: s.skill_id, cat: s.category } : null;
  }, type);
  if (!meta) return { type, err: "no skill" };
  await page.evaluate((title) => {
    const inp = document.querySelector(".search");
    if (inp) {
      inp.value = title;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, meta.title);
  await page.waitForTimeout(400);
  const btn = page.locator("button.skill-row").filter({ hasText: meta.title.slice(0, 24) }).first();
  if ((await btn.count()) === 0) return { type, err: "no row", meta };
  await btn.click();
  await page.waitForTimeout(2000);
  const txt = await page.locator("#app").innerText();
  if (txt.includes("No questions")) return { type, err: "no questions", meta };
  const choices = await page.locator(".choice, .picwrap, .chip").count();
  const spoke = await page.evaluate(() => {
    return typeof window.speechSynthesis !== "undefined";
  });
  return { type, choices, spoke, snippet: txt.slice(0, 80), meta };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await login(page);
const results = [];
for (const t of TYPES) {
  await page.getByRole("button", { name: "Index" }).click().catch(() => {});
  await page.waitForSelector("h1.title-main", { timeout: 15000 }).catch(() => {});
  results.push(await openSkillByType(page, t));
}
console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
