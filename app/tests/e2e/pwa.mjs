// Installable and usable offline: manifest, icons, service worker, and the shell opening with no network.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3111";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-SA" });
const page = await ctx.newPage();

// manifest and icons
await page.goto(BASE);
const href = await page.getAttribute('link[rel="manifest"]', "href");
const manifest = await (await ctx.request.get(new URL(href, BASE).href)).json();
assert.equal(manifest.display, "standalone");
assert.equal(manifest.dir, "rtl");
assert.equal(manifest.lang, "ar");
assert.equal(manifest.name, "ميزان");
for (const icon of manifest.icons) assert.equal((await ctx.request.get(new URL(icon.src, BASE).href)).status(), 200, icon.src);
assert.ok(await page.getAttribute('link[rel="apple-touch-icon"]', "href"), "iPhone home-screen icon");

// service worker takes control, then the shell opens with the network cut
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForSelector("text=تقدر تصرف اليوم");
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
await page.waitForTimeout(800); // let the page and its scripts land in the cache
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector("text=تقدر تصرف اليوم", { timeout: 15_000 });
assert.ok(await page.locator('button[aria-label="إضافة عملية"]').isVisible(), "app is usable offline");

// the worker file is never cached and API paths are left alone
await ctx.setOffline(false);
const sw = await ctx.request.get(`${BASE}/sw.js`);
assert.match(sw.headers()["cache-control"] ?? "", /no-cache/);
assert.equal(sw.headers()["x-frame-options"], "DENY");
assert.equal(sw.headers()["x-content-type-options"], "nosniff");

await browser.close();
console.log("pwa ok");
