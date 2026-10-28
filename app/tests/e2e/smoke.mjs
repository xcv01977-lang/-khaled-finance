// Browser smoke test against a running demo build:
//   NEXT_PUBLIC_DEMO=1 npx next build && NEXT_PUBLIC_DEMO=1 npx next start -p 3111
//   BASE=http://localhost:3111 node tests/e2e/smoke.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Playwright is not a project dependency; it resolves from a global install (NODE_PATH) or local node_modules.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const num = async (loc) => Number((await loc.textContent()).replace(/[^\d.\-−]/g, "").replace("−", "-"));
const allowed = () => num(page.locator('[role="img"] .text-6xl'));

await page.goto(BASE);
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(900);
const before = await allowed();

// 1. adding an expense lowers today's allowance by that amount
await page.click('button[aria-label="إضافة عملية"]');
await page.fill("#amount", "٢٥"); // Arabic-Indic digits are accepted
await page.click('button[aria-pressed]:has-text("قهوة")');
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("#amount", { state: "detached" });
assert.equal(await allowed(), before - 25, "allowance drops by the amount spent");

// 2. empty / invalid amount is rejected with a message
await page.click('button[aria-label="إضافة عملية"]');
await page.fill("#amount", "abc");
await page.click('form button:has-text("حفظ")');
await page.waitForSelector("text=اكتب مبلغ صحيح");
await page.keyboard.press("Escape");

// 3. editing then deleting a transaction restores the allowance
await page.locator("li button", { hasText: "قهوة" }).first().click();
await page.waitForSelector("text=تعديل عملية");
await page.click('button:has-text("حذف")');
await page.click('button:has-text("تأكيد الحذف")');
await page.waitForSelector("text=تعديل عملية", { state: "detached" });
assert.equal(await allowed(), before, "deleting restores the allowance");

// 4. paying a commitment marks it paid and can be undone
await page.click('summary:has-text("المدفوعات القادمة")');
await page.locator("li", { hasText: "تابي" }).getByRole("button", { name: "دفعت" }).click();
await page.waitForSelector('li:has-text("تابي") >> text=مدفوعة');
await page.locator("li", { hasText: "تابي" }).getByRole("button", { name: "تراجع" }).click();
await page.waitForSelector('li:has-text("تابي") >> button:has-text("دفعت")');

// 5. settings: a bigger salary raises the allowance; the choice survives a reload
await page.click('button[aria-label="الإعدادات"]');
await page.fill("#salary", "20000");
await page.click('button:has-text("حفظ")');
await page.waitForSelector("#salary", { state: "detached" });
assert.ok((await allowed()) > before, "higher salary raises the allowance");
await page.reload();
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForTimeout(900);
assert.ok((await allowed()) > before, "settings persisted");

// 6. theme choice persists
await page.click('button[aria-label="الإعدادات"]');
await page.click('button:has-text("نهاري")');
await page.keyboard.press("Escape");
await page.reload();
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");

assert.deepEqual(errors, [], "no console errors");
await browser.close();
console.log("smoke ok");
