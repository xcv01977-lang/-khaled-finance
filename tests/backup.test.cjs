// node tests/backup.test.cjs — يختبر خادم النسخ السحابي بتخزين وهمي
const assert = require('assert');
const handler = require('../api/backup.js');
const db = new Map(), sets = new Map();
const redis = async cmds => cmds.map(([c, k, ...a]) => {
  if (c === 'SET') { db.set(k, a[0]); return { result: 'OK' }; }
  if (c === 'GET') return { result: db.has(k) ? db.get(k) : null };
  if (c === 'SADD') { const s = sets.get(k) || new Set(); a.forEach(x => s.add(x)); sets.set(k, s); return { result: 1 }; }
  if (c === 'SMEMBERS') return { result: [...(sets.get(k) || [])] };
  if (c === 'SREM') { const s = sets.get(k); a.forEach(x => s && s.delete(x)); return { result: 1 }; }
  if (c === 'EXISTS') return { result: db.has(k) ? 1 : 0 };
  return { result: 1 };
});
const call = (method, url, body) => new Promise(resolve => {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { resolve({ code: this.statusCode, json: JSON.parse(t) }); } };
  handler({ method, url, headers: {}, body }, res, { redis, creds: { url: 'x', token: 'y' } });
});
const KEY = 'abcdefghijklmnopqrstuv';
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('✓', name); };
(async () => {
  await t('مفتاح غلط = 401', async () => { assert.strictEqual((await call('GET', '/api/backup?key=short')).code, 401); });
  await t('ما فيه نسخة', async () => { const r = await call('GET', '/api/backup?key=' + KEY); assert.strictEqual(r.json.latest, null); assert.deepStrictEqual(r.json.days, []); });
  await t('رفع واسترجاع آخر نسخة', async () => {
    const r = await call('POST', '/api/backup', { key: KEY, at: '2026-10-07T01:00:00.000Z', count: 12, fmt: 'json', data: '{"v":9}' });
    assert.strictEqual(r.code, 200);
    const m = await call('GET', '/api/backup?key=' + KEY);
    assert.deepStrictEqual(m.json.latest, { at: '2026-10-07T01:00:00.000Z', count: 12, size: 7 }); assert.deepStrictEqual(m.json.days, ['2026-10-07']);
    const g = await call('GET', '/api/backup?key=' + KEY + '&get=latest');
    assert.strictEqual(g.json.data, '{"v":9}'); assert.strictEqual(g.json.fmt, 'json');
  });
  await t('نسخة لكل يوم، والأحدث أول', async () => {
    await call('POST', '/api/backup', { key: KEY, at: '2026-10-08T09:00:00.000Z', count: 15, fmt: 'gz64', data: 'H4sI' });
    const m = await call('GET', '/api/backup?key=' + KEY);
    assert.deepStrictEqual(m.json.days, ['2026-10-08', '2026-10-07']);
    assert.strictEqual((await call('GET', '/api/backup?key=' + KEY + '&get=2026-10-07')).json.data, '{"v":9}');
  });
  await t('اليوم المنتهي ينشال من القائمة', async () => {
    db.delete('mali:bk:' + require('crypto').createHash('sha256').update(KEY).digest('hex').slice(0, 32) + ':d:2026-10-07');
    assert.deepStrictEqual((await call('GET', '/api/backup?key=' + KEY)).json.days, ['2026-10-08']);
  });
  await t('مفتاح ثاني ما يشوف نسخ غيره', async () => { assert.strictEqual((await call('GET', '/api/backup?key=zzzzzzzzzzzzzzzzzzzz')).json.latest, null); });
  await t('بيانات فاضية أو كبيرة ترفض', async () => {
    assert.strictEqual((await call('POST', '/api/backup', { key: KEY, data: '' })).code, 400);
    assert.strictEqual((await call('POST', '/api/backup', { key: KEY, data: 'x'.repeat(900001) })).code, 413);
  });
  console.log(`\n${n} اختبار ناجح`);
})().catch(e => { console.error(e); process.exit(1); });
