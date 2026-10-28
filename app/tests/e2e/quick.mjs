// Quick entry and the assistant, against the demo build (see smoke.mjs).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(600);

// 1. "قهوة ١٨" + Enter records an expense with the right category, without touching any other field
await page.click('button[aria-label="إضافة عملية"]');
await page.waitForSelector("#quick:focus");
await page.fill("#quick", "ستاربكس ٢٣٫٥");
assert.equal(await page.inputValue("#amount"), "23.5");
assert.equal(await page.locator('button[aria-pressed="true"]:has-text("قهوة")').count(), 1, "category guessed from the merchant");
assert.equal(await page.inputValue("#merchant"), "ستاربكس");
await page.press("#quick", "Enter");
await page.waitForSelector("#quick", { state: "detached" });
const row = page.locator("li", { hasText: "ستاربكس" }).first();
assert.match(await row.textContent(), /23\.5/);
assert.match(await row.textContent(), /قهوة · اليوم/);

// 2. a date word moves the date; the form stays editable
await page.click('button[aria-label="إضافة عملية"]');
await page.fill("#quick", "بنزين 90 أمس");
assert.equal(await page.locator('button[aria-pressed="true"]:has-text("أمس")').count(), 1);
await page.click('button[aria-pressed]:has-text("مواصلات")'); // manual pick after typing
await page.fill("#quick", "بنزين 95 أمس"); // further typing keeps the manual category unless the text names one
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("#amount", { state: "detached" });
assert.match(await page.locator("li", { hasText: "بنزين" }).first().textContent(), /95/);

// 3. refund wording flips the type
await page.click('button[aria-label="إضافة عملية"]');
await page.fill("#quick", "استرداد 50 نون");
assert.equal(await page.locator('button[aria-pressed="true"]:has-text("استرداد")').count(), 1);
await page.keyboard.press("Escape");

// 4. the assistant answers from the data and is honest when it cannot
await page.click('button[aria-label="اسأل ميزان"]');
const ask = async (q) => {
  const before = await page.locator('[aria-live="polite"] > div').count();
  await page.fill("#ask", q);
  await page.press("#ask", "Enter");
  await page.waitForFunction((n) => document.querySelectorAll('[aria-live="polite"] > div').length > n + 1, before);
  const all = await page.locator('[aria-live="polite"] > div').allTextContents();
  return all.filter(Boolean).at(-1);
};
assert.match(await ask("كم صرفت هالدورة؟"), /صرفت .* ر\.س هالدورة/);
assert.match(await ask("كم صرفت على القهوة؟"), /على قهوة/);
assert.match(await ask("كم صرفت على الطيران؟"), /ما لقيت تصنيف أو محل باسم «الطيران»/);
assert.match(await ask("أقدر أشتري شي بـ 100000؟"), /^لا\./);
assert.match(await ask("وش أكثر شي يستهلك فلوسي؟"), /أكثر شي يستهلك فلوسك/);
assert.match(await ask("كلام ما له معنى"), /ما فهمت سؤالك/);

assert.deepEqual(errors, [], "no console errors");
await browser.close();
console.log("quick ok");
