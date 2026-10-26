// اشتراك إشعارات مالي (ملخص الخميس).
// GET  ?vapid=1                      → المفتاح العام (يتولد أول مرة وينحفظ)
// POST {key, sub}                    → يحفظ اشتراك هالجوال تحت بصمة مفتاح الربط
// POST {key, off: true}              → يلغي الاشتراك
// POST {key, test: true}             → يرسل إشعار تجربة الحين
const P = require('./_push.js');
const SET = 'mali:push:all';
const subKey = fp => 'mali:push:sub:' + fp;

module.exports = async (req, res, deps = {}) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  const creds = deps.creds || P.findCreds(process.env);
  if (!creds.url || !creds.token) return send(503, { ok: false, error: 'not_configured', message: 'التخزين السحابي غير مربوط بالمشروع' });
  const redis = deps.redis || P.makeRedis(creds);
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.searchParams.get('vapid')) {
      const v = await P.getVapid(redis);
      return send(200, { ok: true, key: v.pub });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { ok: false, error: 'method' }); }
    const body = await P.readBody(req);
    const key = String(req.headers['x-mali-key'] || body.key || '').trim();
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return send(401, { ok: false, error: 'bad_key', message: 'مفتاح الربط غير صحيح' });
    const fp = P.fingerprint(key);
    if (body.off) {
      await redis([['DEL', subKey(fp)], ['SREM', SET, fp]]);
      return send(200, { ok: true, off: true });
    }
    if (body.sub) {
      if (!P.validSub(body.sub)) return send(400, { ok: false, error: 'bad_sub', message: 'اشتراك غير صالح' });
      const sub = { endpoint: body.sub.endpoint, keys: { p256dh: body.sub.keys.p256dh, auth: body.sub.keys.auth } };
      await redis([['SET', subKey(fp), JSON.stringify(sub)], ['SADD', SET, fp]]);
    }
    if (body.test) {
      const out = await redis([['GET', subKey(fp)]]);
      const sub = out[0] && out[0].result ? JSON.parse(out[0].result) : null;
      if (!sub) return send(404, { ok: false, error: 'no_sub', message: 'الإشعارات مو مفعّلة على هالجوال' });
      const v = await P.getVapid(redis);
      const r = await P.sendPush(sub, { title: 'مالي', body: 'تم تفعيل ملخص الخميس ✓ بيوصلك كل خميس الصبح.', tag: 'mali-test' }, v, deps.fetch);
      if (r.gone) await redis([['DEL', subKey(fp)], ['SREM', SET, fp]]);
      return send(r.status < 300 ? 200 : 502, { ok: r.status < 300, status: r.status });
    }
    return send(200, { ok: true });
  } catch (e) {
    return send(502, { ok: false, error: 'storage', message: 'تعذر الوصول للتخزين' });
  }
};
