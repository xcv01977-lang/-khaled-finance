// Budget lines, categories and the cumulative balance, against a running demo build (see smoke.mjs).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const toNum = (t) => Number(t.replace(/[^\d.\-−]/g, "").replace("−", "-"));
const allowed = async () => toNum(await page.locator('[role="img"] .text-6xl').textContent());
const openSettings = () => page.click('button[aria-label="الإعدادات"]');

await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(800);

// 1. two lines: expenses (counts toward the daily number) and investment (does not)
await openSettings();
await page.click('button:has-text("📂 البنود")');
await page.click('button:has-text("＋ أضف بند")');
await page.click('button[aria-pressed]:has-text("مصاريف")');
await page.fill("#l-planned", "3000");
await page.click('form button:has-text("حفظ")');
await page.click('button:has-text("＋ أضف بند")');
await page.click('button[aria-pressed]:has-text("استثمار")');
await page.fill("#l-planned", "1500");
await page.fill("#l-opening", "-300");
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("text=ما يدخل في المسموح اليوم");
await page.keyboard.press("Escape");

// 2. balance sheet: investment = -300 opening + 1500 planned, nothing spent
await page.click('button:has-text("الميزان التراكمي")');
await page.waitForSelector('[role="dialog"] >> text=استثمار');
const invCard = page.locator("li", { hasText: "استثمار" });
assert.match(await invCard.textContent(), /\+1,200/);
const expCard = page.locator("li", { hasText: "مصاريف" });
const spentText = await expCard.locator("text=/صرفت/").first().textContent();
const spent = toNum(spentText.split("من")[0]);
assert.match(await expCard.textContent(), new RegExp(`\\+${(3000 - spent).toLocaleString("en-US")}`));
await page.keyboard.press("Escape");

// 3. link the "أخرى" category to the investment line
await openSettings();
await page.click('button:has-text("🏷️ التصنيفات")');
await page.click('li button:has-text("أخرى")');
await page.selectOption("#c-line", { label: "📈 استثمار" });
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("text=استثمار >> nth=0");
await page.keyboard.press("Escape");

// 4. spending on investment does not touch today's allowance but does reduce that line
const before = await allowed();
const addTx = async (amount, category) => {
  await page.click('button[aria-label="إضافة عملية"]');
  await page.fill("#amount", amount);
  await page.click(`button[aria-pressed]:has-text("${category}")`);
  await page.click('form button:has-text("حفظ")');
  await page.waitForSelector("#amount", { state: "detached" });
};
await addTx("500", "أخرى");
assert.equal(await allowed(), before, "investment spending leaves the daily number alone");
await page.click('button:has-text("الميزان التراكمي")');
assert.match(await page.locator("li", { hasText: "استثمار" }).textContent(), /\+700/);
await page.keyboard.press("Escape");

// 5. overspending the expenses line turns it red and lowers today's number
await addTx("5000", "قهوة");
assert.ok((await allowed()) < 0, "daily number goes negative after a big overspend");
await page.click('button:has-text("الميزان التراكمي")');
const over = page.locator("li", { hasText: "مصاريف" });
assert.match(await over.textContent(), /عجز/);
assert.ok(await over.locator(".text-bad").count() > 0, "deficit is shown in red");
await page.keyboard.press("Escape");

// 6. everything survives a reload
await page.reload();
await page.waitForSelector("text=الميزان التراكمي");
assert.ok((await allowed()) < 0);

assert.deepEqual(errors, [], "no console errors");
await browser.close();
console.log("balance ok");
