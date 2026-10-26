// node tests/push.test.cjs — يختبر إشعارات ملخص الخميس بتخزين وهمي وخادم دفع وهمي يفك التشفير
const assert = require('assert');
const crypto = require('crypto');
const zlib = require('zlib');
const P = require('../api/_push.js');
const push = require('../api/push.js');
const weekly = require('../api/weekly.js');
const C = require('../mali9-core.js');

const db = new Map(), sets = new Map();
const redis = async cmds => cmds.map(([c, k, ...a]) => {
  if (c === 'SET') { if (a.includes('NX') && db.has(k)) return { result: null }; db.set(k, a[0]); return { result: 'OK' }; }
  if (c === 'GET') return { result: db.has(k) ? db.get(k) : null };
  if (c === 'DEL') { db.delete(k); return { result: 1 }; }
  if (c === 'SADD') { const s = sets.get(k) || new Set(); a.forEach(x => s.add(x)); sets.set(k, s); return { result: 1 }; }
  if (c === 'SREM') { const s = sets.get(k); a.forEach(x => s && s.delete(x)); return { result: 1 }; }
  if (c === 'SMEMBERS') return { result: [...(sets.get(k) || [])] };
  return { result: 1 };
});
// جوال وهمي: مفاتيحه، وخادم دفع يفك الرسالة
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const auth = crypto.randomBytes(16);
const SUB = { endpoint: 'https://web.push.apple.com/QXYZ', keys: { p256dh: P.b64u(ua.getPublicKey()), auth: P.b64u(auth) } };
function decrypt(body) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const secret = ua.computeSecret(asPub);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.strictEqual(pt[pt.length - 1], 2);
  return JSON.parse(pt.subarray(0, pt.length - 1).toString('utf8'));
}
let delivered = [], nextStatus = 201;
const fakeFetch = async (url, opt) => {
  assert.strictEqual(opt.headers['Content-Encoding'], 'aes128gcm');
  assert.ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/.test(opt.headers.Authorization));
  delivered.push({ url, msg: decrypt(opt.body) });
  return { status: nextStatus };
};
const call = (h, method, url, body, headers = {}, extra = {}) => new Promise(resolve => {
  const res = { statusCode: 200, setHeader() {}, end(t) { resolve({ code: this.statusCode, json: JSON.parse(t) }); } };
  h({ method, url, headers, body }, res, Object.assign({ redis, creds: { url: 'x', token: 'y' }, fetch: fakeFetch }, extra));
});
const KEY = 'abcdefghijklmnopqrstuv';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('✓', name); };
(async () => {
  await t('مفتاح VAPID يتولد مرة وحدة ويثبت', async () => {
    const a = await call(push, 'GET', '/api/push?vapid=1'), b = await call(push, 'GET', '/api/push?vapid=1');
    assert.strictEqual(a.json.key.length, 87); assert.strictEqual(a.json.key, b.json.key);
  });
  await t('اشتراك + إشعار تجربة يوصل ويتفك', async () => {
    const r = await call(push, 'POST', '/api/push', { key: KEY, sub: SUB, test: true });
    assert.strictEqual(r.code, 200);
    assert.strictEqual(delivered.length, 1); assert.ok(delivered[0].msg.body.includes('ملخص الخميس'));
  });
  await t('مفتاح غلط واشتراك غلط مرفوضين', async () => {
    assert.strictEqual((await call(push, 'POST', '/api/push', { key: 'x', sub: SUB })).code, 401);
    assert.strictEqual((await call(push, 'POST', '/api/push', { key: KEY, sub: { endpoint: 'http://x', keys: {} } })).code, 400);
  });
  await t('الملخص الأسبوعي من النسخة السحابية المضغوطة', async () => {
    const s = C.applyRevision(C.normalize(C.seedState()));
    s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-personal', amount: 300, date: '2026-10-28' });
    s.entries.push({ id: 'b', kind: 'variable', ref: '', amount: 40, date: '2026-10-29' });
    s.entries.push({ id: 'c', kind: 'debt', ref: 'd1', amount: 2887.24, date: '2026-10-28' });   // القسط مو صرف
    s.entries.push({ id: 'd', kind: 'variable', ref: '', amount: 999, date: '2026-10-20' });     // قبل الأسبوع
    const data = zlib.gzipSync(Buffer.from(JSON.stringify(s))).toString('base64');
    db.set('mali:bk:' + P.fingerprint(KEY) + ':latest', JSON.stringify({ fmt: 'gz64', data }));
    delivered = [];
    const now = new Date('2026-10-29T06:00:00Z');
    const r = await call(weekly, 'GET', '/api/weekly', null, { 'user-agent': 'vercel-cron/1.0' }, { now });
    assert.deepStrictEqual(r.json, { ok: true, sent: 1, skipped: 0, failed: 0 });
    const m = delivered[0].msg;
    assert.strictEqual(m.title, 'ملخص الأسبوع — مالي');
    assert.ok(m.body.startsWith('صرفت 340 هالأسبوع · باقي من مصروفك 1,500'), m.body);
  });
  await t('بدون كرون ولا مفتاح = مرفوض', async () => {
    assert.strictEqual((await call(weekly, 'GET', '/api/weekly', null, {})).code, 401);
  });
  await t('اشتراك منتهي (410) ينشال', async () => {
    nextStatus = 410;
    await call(weekly, 'GET', '/api/weekly?key=' + KEY, null, {}, { now: new Date('2026-10-29T06:00:00Z') });
    assert.strictEqual(db.has('mali:push:sub:' + P.fingerprint(KEY)), false);
    assert.strictEqual([...(sets.get('mali:push:all') || [])].length, 0);
    nextStatus = 201;
  });
  await t('إيقاف الاشتراك', async () => {
    await call(push, 'POST', '/api/push', { key: KEY, sub: SUB });
    await call(push, 'POST', '/api/push', { key: KEY, off: true });
    assert.strictEqual(db.has('mali:push:sub:' + P.fingerprint(KEY)), false);
  });
  console.log(`\n${n} اختبار ناجح`);
})().catch(e => { console.error(e); process.exitCode = 1; });
