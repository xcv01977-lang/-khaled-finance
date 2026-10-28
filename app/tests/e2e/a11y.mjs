// Accessibility audit (axe-core) of every screen in both themes, plus keyboard focus behaviour of sheets.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axePath = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE ?? "http://localhost:3111";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" });
const page = await ctx.newPage();
await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(900);
await page.addScriptTag({ path: axePath });

const problems = [];
async function audit(name) {
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary ?? "").split("\n").slice(0, 2).join(" | ")) }));
  });
  for (const v of res) problems.push({ screen: name, ...v });
}
const theme = (t) => page.evaluate((x) => { document.documentElement.setAttribute("data-theme", x); }, t);
const close = () => page.keyboard.press("Escape");

const screens = [
  ["home", async () => {}],
  ["add", async () => { await page.click('button[aria-label="إضافة عملية"]'); }],
  ["settings", async () => { await page.click('button[aria-label="الإعدادات"]'); }],
  ["balance", async () => { await page.click('button:has-text("الميزان التراكمي")'); }],
  ["assistant", async () => { await page.click('button[aria-label="اسأل ميزان"]'); }],
  ["installments", async () => { await page.click('button:has-text("🧾 الأقساط")'); }],
  ["goals", async () => { await page.click('button:has-text("🎯 الأهداف")'); }],
  ["recurring", async () => { await page.click('button:has-text("🔁 المتكرر")'); }],
  ["inbox", async () => { await page.click('button[aria-label="الإعدادات"]'); await page.click('button:has-text("📩 رسائل البنك")'); }],
  ["backup", async () => { await page.click('button[aria-label="الإعدادات"]'); await page.click('button:has-text("💾 نسخ احتياطي")'); }],
  ["lines", async () => { await page.click('button[aria-label="الإعدادات"]'); await page.click('button:has-text("📂 البنود")'); }],
];

for (const t of ["dark", "light"]) {
  await theme(t);
  for (const [name, open] of screens) {
    await open();
    await page.waitForTimeout(450); // let the sheet animation finish so contrast is measured on settled colours
    await audit(`${name}/${t}`);
    if (name !== "home") await close();
    await page.waitForTimeout(150);
  }
}

// keyboard: Tab never leaves an open sheet, and closing returns focus to the button that opened it
await page.click('button[aria-label="إضافة عملية"]');
const inside = async () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); assert.equal(await inside(), true, `focus escaped the sheet on Tab #${i + 1}`); }
for (let i = 0; i < 40; i++) { await page.keyboard.press("Shift+Tab"); assert.equal(await inside(), true, `focus escaped the sheet on Shift+Tab #${i + 1}`); }
await close();
assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "إضافة عملية", "focus returns to the opener");

const serious = problems.filter((p) => p.impact === "serious" || p.impact === "critical");
console.log(`axe: ${problems.length} findings, ${serious.length} serious/critical`);
const byId = new Map();
for (const p of problems) { const k = `${p.impact} ${p.id}`; byId.set(k, [...(byId.get(k) ?? []), p]); }
for (const [k, list] of byId) { console.log(`\n${k} (${list.length}) — ${list[0].help}`); for (const p of list.slice(0, 3)) console.log(`   [${p.screen}] ${p.nodes[0]}`); }
await browser.close();
if (serious.length) process.exit(1);
console.log("a11y ok");
