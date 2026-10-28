// Instalments, goals, recurring charges and smart alerts, against the demo build (see smoke.mjs).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const riyadh = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date(Date.now() + offset * 86_400_000));
const dialog = page.locator('[role="dialog"]');
const closeSheet = () => page.keyboard.press("Escape");

await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(600);

// ---------- instalments
await page.click('button:has-text("🧾 الأقساط")');
await page.click('button:has-text("＋ أضف قسط")');
await page.fill("#p-name", "نون");
await page.fill("#p-amount", "125");
await page.fill("#p-first", riyadh(2));
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("text=باقي عليك من الأقساط");
assert.match(await dialog.textContent(), /دفعة 1 من 4/);
assert.match(await dialog.textContent(), /500/); // 4 × 125 still to pay
await closeSheet();

// it shows up in upcoming payments and comes off the budget
await page.click('summary:has-text("المدفوعات القادمة")');
const row = page.locator("li", { hasText: "نون" });
assert.match(await row.textContent(), /دفعة 1 من 4/);
await row.getByRole("button", { name: "دفعت" }).click();
await page.waitForSelector('li:has-text("نون") >> text=مدفوعة');
await page.click('button:has-text("🧾 الأقساط")');
assert.match(await dialog.textContent(), /دفعة 2 من 4/);
assert.match(await dialog.textContent(), /375/);
await closeSheet();

// a Tabby message closes the next payment of the plan in one tap
await page.click('button[aria-label="الإعدادات"]');
await page.click('button:has-text("📩 رسائل البنك")');
await page.fill("#paste", "تابي: تم خصم 125.00 ر.س كدفعة 2 من 4 لطلبك من Noon");
await page.click('button:has-text("حلّل وسجّل")');
const card = dialog.locator("article", { hasText: "Noon" });
await card.getByRole("button", { name: /دفعة نون \(2\/4\)/ }).click();
await page.waitForSelector("article:has-text('Noon')", { state: "detached" });
await closeSheet();
await page.click('button:has-text("🧾 الأقساط")');
assert.match(await dialog.textContent(), /دفعة 3 من 4/);
await closeSheet();

// ---------- goals
await page.click('button:has-text("🎯 الأهداف")');
await page.click('button:has-text("＋ أضف هدف")');
await page.fill("#g-name", "سفر الصيف");
await page.fill("#g-target", "12000");
await page.fill("#g-monthly", "500");
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("text=سفر الصيف");
assert.match(await dialog.textContent(), /بمعدل 500 ر\.س شهرياً توصل بعد 24/);
await page.fill('input[placeholder="المبلغ"]', "2000");
await page.click('button:has-text("＋ أضف")');
await page.waitForSelector("text=17%");
assert.match(await dialog.textContent(), /بعد 20 أشهر/);
assert.match(await dialog.textContent(), /لو زدت 100 ر\.س شهرياً/);
await page.fill('input[placeholder="المبلغ"]', "5000");
await page.click('button:has-text("− اسحب")');
await page.waitForSelector("text=المبلغ أكبر من اللي ادخرته");
await closeSheet();

// ---------- recurring charges and the price-rise alert
await page.evaluate((today) => {
  const s = JSON.parse(localStorage.getItem("khaled-finance-demo"));
  const d = (m) => { const x = new Date(`${today}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() - m); x.setUTCDate(5); return x.toISOString().slice(0, 10); };
  [[4, 20], [3, 20], [2, 20], [1, 25]].forEach(([m, a], i) =>
    s.txs.push({ id: `rec${i}`, amount_halalas: a * 100, kind: "expense", category_id: null, merchant: "Spotify", note: null, occurred_on: d(m), source: "manual" }));
  localStorage.setItem("khaled-finance-demo", JSON.stringify(s));
}, riyadh());
await page.reload();
await page.waitForSelector("text=تقدر تصرف اليوم");
const rise = page.locator('[role="status"]', { hasText: "Spotify ارتفع" });
assert.match(await rise.textContent(), /من 20 ر\.س إلى 25 ر\.س \(\+25%\)/);
await rise.getByRole("button", { name: "عرض" }).click();
assert.match(await dialog.textContent(), /Spotify/);
assert.match(await dialog.textContent(), /\+25%/);
await closeSheet();

// dismissing hides it, and it stays hidden after a reload
await rise.getByRole("button", { name: "إخفاء التنبيه" }).click();
assert.equal(await page.locator('[role="status"]', { hasText: "Spotify ارتفع" }).count(), 0);
await page.reload();
await page.waitForSelector("text=تقدر تصرف اليوم");
assert.equal(await page.locator('[role="status"]', { hasText: "Spotify ارتفع" }).count(), 0);

// ---------- duplicate entry alert
for (let i = 0; i < 2; i++) {
  await page.click('button[aria-label="إضافة عملية"]');
  await page.fill("#quick", "ستاربكس 45");
  await page.press("#quick", "Enter");
  await page.waitForSelector("#quick", { state: "detached" });
}
assert.match(await page.locator('[role="status"]', { hasText: "عملية مكررة" }).textContent(), /45 ر\.س عند ستاربكس/);

assert.deepEqual(errors, [], "no console errors");
await browser.close();
console.log("phase5 ok");
