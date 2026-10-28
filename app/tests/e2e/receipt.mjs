// Receipt photo → form, using the real OCR engine in the browser (served from /tesseract).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const fx = (n) => fileURLToPath(new URL(`../fixtures/${n}`, import.meta.url));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const external = [];
page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });

await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");

const scan = async (file) => {
  await page.click('button[aria-label="إضافة عملية"]');
  await page.setInputFiles("#receipt", fx(file));
  await page.waitForSelector('p[role="status"]', { timeout: 180_000 });
  return { amount: await page.inputValue("#amount"), merchant: await page.inputValue("#merchant"), note: await page.locator('p[role="status"]').first().textContent() };
};

// English receipt: printed TOTAL read directly
let r = await scan("receipt-en.png");
assert.equal(r.amount, "41.4");
assert.match(r.merchant, /STARBUCKS/i);
assert.match(r.note, /قرأت الإجمالي/);
assert.equal(await page.locator('button[aria-pressed="true"]:has-text("قهوة")').count(), 1, "category guessed from the merchant");
await page.keyboard.press("Escape");

// Arabic receipt: the bold total line is hard to read, so the amount must still be right (printed or derived), never a guess
r = await scan("receipt-ar.png");
assert.equal(r.amount, "50.6", `amount was ${r.amount} (${r.note})`);
assert.match(r.note, /قرأت الإجمالي|حسبته من المجموع/);
await page.keyboard.press("Escape");

// the photo never leaves the device: no request went to another origin
assert.deepEqual(external, [], "no third-party requests while scanning");
assert.deepEqual(errors, [], "no console errors");
await browser.close();
console.log("receipt ok");
