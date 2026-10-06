// نسخ احتياطي سحابي لمالي (Vercel Function) — نفس تخزين Upstash ونفس مفتاح الربط حق رسائل البنك.
// POST {key, at, count, fmt, data}: يحفظ «آخر نسخة» + نسخة لليوم (تبقى 60 يوم).
// GET ?key=…            → معلومات آخر نسخة وقائمة الأيام المحفوظة (بدون البيانات).
// GET ?key=…&get=latest  أو &get=YYYY-MM-DD → النسخة نفسها.
// نحفظ تحت بصمة المفتاح، مو المفتاح نفسه. البيانات مضغوطة من الجوال (gzip) قبل ما توصل.
const crypto = require('crypto');

function findCreds(env) {
  const keys = Object.keys(env);
  const pick = re => { const k = keys.find(k => re.test(k) && env[k] && !/READ_ONLY/i.test(k)); return k ? env[k] : ''; };
  let url = pick(/REST_API_URL$|REDIS_REST_URL$/i);
  let token = pick(/REST_API_TOKEN$|REDIS_REST_TOKEN$/i);
  if (!url || !token) {
    const raw = pick(/(^|_)(REDIS_URL|KV_URL)$/i);
    const m = raw.match(/^rediss?:\/\/[^:]*:([^@]+)@([^:/]+)/);
    if (m && /upstash\.io$/i.test(m[2])) { url = url || 'https://' + m[2]; token = token || decodeURIComponent(m[1]); }
  }
  return { url, token };
}
const MAX_DATA = 900000;                 // حد Upstash للطلب الواحد تقريبًا 1MB
const DAY_TTL = 60 * 60 * 24 * 60;       // النسخ اليومية تبقى 60 يوم
const LATEST_TTL = 60 * 60 * 24 * 400;   // آخر نسخة تبقى سنة وزيادة حتى لو ما انفتح التطبيق

module.exports = async (req, res, deps = {}) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  const CREDS = deps.creds || findCreds(process.env);
  const redis = deps.redis || (async commands => {
    const r = await fetch(CREDS.url.replace(/\/$/, '') + '/multi-exec', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + CREDS.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error('storage ' + r.status);
    return r.json();
  });
  if (!CREDS.url || !CREDS.token) return send(503, { ok: false, error: 'not_configured', message: 'التخزين السحابي غير مربوط بالمشروع' });

  const body = req.method === 'POST' ? await readBody(req) : {};
  const url = new URL(req.url, 'http://x');
  const key = String(req.headers['x-mali-key'] || body.key || url.searchParams.get('key') || '').trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return send(401, { ok: false, error: 'bad_key', message: 'المفتاح غير صحيح' });
  const base = 'mali:bk:' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);

  try {
    if (req.method === 'POST') {
      const data = String(body.data || '');
      if (!data) return send(400, { ok: false, error: 'empty', message: 'ما وصلت بيانات' });
      if (data.length > MAX_DATA) return send(413, { ok: false, error: 'too_big', message: 'النسخة أكبر من الحد' });
      const at = /^\d{4}-\d{2}-\d{2}T/.test(String(body.at || '')) ? String(body.at) : new Date().toISOString();
      const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.day || '')) ? String(body.day) : at.slice(0, 10);   // اليوم بتوقيت الجوال
      const rec = JSON.stringify({ at, day, count: Math.max(0, Number(body.count) || 0), fmt: body.fmt === 'gz64' ? 'gz64' : 'json', size: data.length, data });
      await redis([
        ['SET', base + ':latest', rec, 'EX', LATEST_TTL],
        ['SET', base + ':d:' + day, rec, 'EX', DAY_TTL],
        ['SADD', base + ':days', day],
        ['EXPIRE', base + ':days', LATEST_TTL]
      ]);
      return send(200, { ok: true, at, day });
    }
    if (req.method === 'GET') {
      const get = url.searchParams.get('get') || '';
      if (get) {
        const k = get === 'latest' ? base + ':latest' : /^\d{4}-\d{2}-\d{2}$/.test(get) ? base + ':d:' + get : '';
        if (!k) return send(400, { ok: false, error: 'bad_get' });
        const out = await redis([['GET', k]]);
        const raw = out[0] && out[0].result;
        if (!raw) return send(404, { ok: false, error: 'none', message: 'ما فيه نسخة' });
        return send(200, Object.assign({ ok: true }, JSON.parse(raw)));
      }
      const out = await redis([['GET', base + ':latest'], ['SMEMBERS', base + ':days']]);
      const latest = out[0] && out[0].result ? JSON.parse(out[0].result) : null;
      let days = ((out[1] && out[1].result) || []).sort().reverse();
      // الأيام اللي انتهت صلاحيتها نشيلها من القائمة
      if (days.length) {
        const ex = await redis(days.map(d => ['EXISTS', base + ':d:' + d]));
        const gone = days.filter((d, i) => !(ex[i] && ex[i].result));
        if (gone.length) await redis([['SREM', base + ':days', ...gone]]);
        days = days.filter(d => !gone.includes(d));
      }
      const meta = latest ? { at: latest.at, count: latest.count, size: latest.size } : null;
      return send(200, { ok: true, latest: meta, days });
    }
    res.setHeader('Allow', 'GET, POST');
    return send(405, { ok: false, error: 'method' });
  } catch (e) {
    return send(502, { ok: false, error: 'storage', message: 'تعذر الوصول للتخزين' });
  }
};

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(parse(req.body));
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1200000) req.destroy(); });
    req.on('end', () => resolve(parse(data)));
    req.on('error', () => resolve({}));
  });
  function parse(t) { try { return JSON.parse(t); } catch (e) { return {}; } }
}
