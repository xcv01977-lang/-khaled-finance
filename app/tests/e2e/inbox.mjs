// Bank-message inbox end to end in the demo build: paste, classify, learn, duplicate, ignore, transfer.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const dialog = page.locator('[role="dialog"]');
await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(600);

const openInbox = async () => {
  await page.click('button[aria-label="الإعدادات"]');
  await page.click('button:has-text("📩 رسائل البنك")');
  await page.waitForSelector("#paste");
};
const paste = async (text) => {
  await page.fill("#paste", text);
  await page.click('button:has-text("حلّل وسجّل")');
  await page.waitForSelector('[role="status"]');
  return (await page.locator('[role="status"]').textContent()).trim();
};
const closeSheet = () => page.keyboard.press("Escape");

await openInbox();

// 1. a purchase is recorded at once, with a guessed category, and waits for confirmation
const rajhi = "عملية شراء عبر مدى\nبمبلغ: SAR 45.50\nلدى: STARBUCKS RIYADH\nبطاقة: **1234\nفي: " + new Date().toISOString().slice(0, 10) + " 14:32\nالرصيد: SAR 3,200.00";
assert.match(await paste(rajhi), /سجّلتها، وتنتظر/);
const card = dialog.locator("article", { hasText: "STARBUCKS" });
assert.equal(await card.locator('button[aria-pressed="true"]').textContent().then((t) => t.includes("قهوة")), true, "guessed category is pre-selected");

// 2. choosing another category confirms it and teaches the app
await card.locator('button:has-text("مطاعم")').click();
await page.waitForSelector("article:has-text('STARBUCKS')", { state: "detached" });

// 3. the same merchant next time is classified without asking
const second = rajhi.replace("45.50", "20.00").replace("14:32", "18:05");
assert.match(await paste(second), /تلقائياً/);
assert.equal(await dialog.locator("article").count(), 0, "nothing to review for a learned merchant");
await closeSheet();
await page.waitForSelector("text=STARBUCKS RIYADH");
const rows = page.locator("li", { hasText: "STARBUCKS RIYADH" });
assert.equal(await rows.count(), 2);
assert.match(await rows.first().textContent(), /مطاعم/);

// 4. the same message twice in a row is not counted twice
await openInbox();
assert.match(await paste(second), /قبل شوي/);
await closeSheet();
assert.equal(await page.locator("li", { hasText: "STARBUCKS RIYADH" }).count(), 2);

// 5. deposits are not spending, transfers wait for a person
await openInbox();
assert.match(await paste("إيداع راتب بمبلغ 10,000.00 SAR الرصيد 13,200.00"), /إيداع|تجاهل/);
await paste("حوالة صادرة بمبلغ 500.00 SAR إلى محمد");
const transfer = dialog.locator("article", { hasText: "حوالة صادرة" });
assert.equal(await transfer.count(), 1, "outgoing transfer is held for review, not recorded");
await transfer.locator('button:has-text("تجاهل")').click();
await page.waitForSelector("article:has-text('حوالة صادرة')", { state: "detached" });

// 6. "not an expense" removes the transaction that was recorded
await paste("شراء بمبلغ 30 SAR لدى TESTSHOP QWERTY");
await dialog.locator("article", { hasText: "TESTSHOP" }).locator('button:has-text("ليست مصروفاً")').click();
await page.waitForSelector("article:has-text('TESTSHOP')", { state: "detached" });
await closeSheet();
assert.equal(await page.locator("li", { hasText: "TESTSHOP" }).count(), 0, "ignored message leaves no transaction");

// 7. correcting a category by hand teaches the app too
await page.locator("li button", { hasText: "غداء" }).first().click();
await page.click('button[aria-pressed]:has-text("بقالة")');
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("#amount", { state: "detached" });
await openInbox();
assert.match(await paste("شراء بمبلغ 12 SAR لدى غداء"), /تلقائياً/);
await closeSheet();
assert.match(await page.locator("li", { hasText: "غداء" }).first().textContent(), /بقالة/);

// 8. setup sheet creates a key, shows it once, and keeps only its hash
await openInbox();
await page.click('button:has-text("ربط الاختصار")');
await page.click('button:has-text("أنشئ مفتاح الربط")');
const key = await page.locator('input[aria-label="مفتاح الربط"]').inputValue();
assert.match(key, /^[0-9a-f]{64}$/);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("khaled-finance-demo")).settings.ingest_token_hash);
assert.match(stored, /^[0-9a-f]{64}$/);
assert.notEqual(stored, key, "only the hash is stored");
assert.match(await page.locator('input[aria-label="رابط الاستقبال"]').inputValue(), /\/api\/ingest$/);

assert.deepEqual(errors, [], "no console errors");
await browser.close();
console.log("inbox ok");
