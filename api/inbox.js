// صندوق وارد رسائل البنوك لمالي (Vercel Function).
// اختصار الآيفون يرسل الرسالة هنا في الخلفية (POST)، والتطبيق يسحبها أول ما ينفتح (GET) ثم يؤكد الحذف (GET ?ack=N).
// التخزين: Upstash Redis عبر REST — يُفعّل من Vercel ← Storage/Marketplace ← Upstash Redis (يضبط المتغيرات تلقائيًا).
// كل مستخدم له مفتاح سري (يولّده التطبيق)، ونحفظ تحت بصمة المفتاح وليس المفتاح نفسه.
const crypto = require('crypto');

// نلقط متغيرات Upstash بأي بادئة (KV_ أو UPSTASH_REDIS_ أو بادئة مخصصة عند الربط في Vercel)
function findCreds(env) {
  const keys = Object.keys(env);
  const pick = re => { const k = keys.find(k => re.test(k) && env[k] && !/READ_ONLY/i.test(k)); return k ? env[k] : ''; };
  let url = pick(/REST_API_URL$|REDIS_REST_URL$/i);
  let token = pick(/REST_API_TOKEN$|REDIS_REST_TOKEN$/i);
  if (!url || !token) {
    // بديل: رابط redis(s)://default:TOKEN@HOST:PORT — في Upstash التوكن نفسه يشتغل مع REST على https://HOST
    const raw = pick(/(^|_)(REDIS_URL|KV_URL)$/i);
    const m = raw.match(/^rediss?:\/\/[^:]*:([^@]+)@([^:/]+)/);
    if (m && /upstash\.io$/i.test(m[2])) { url = url || 'https://' + m[2]; token = token || decodeURIComponent(m[1]); }
  }
  return { url, token, names: keys.filter(k => /REDIS|KV_|UPSTASH/i.test(k)) };
}
const CREDS = findCreds(process.env);
const REDIS_URL = CREDS.url;
const REDIS_TOKEN = CREDS.token;
const MAX_ITEMS = 300;          // أقصى عدد رسائل بانتظار السحب
const MAX_TEXT = 2000;          // أقصى طول للرسالة
const TTL_SECONDS = 60 * 60 * 24 * 45; // تنحذف تلقائيًا بعد 45 يوم لو ما انسحبت

async function redis(commands) {
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/multi-exec', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error('storage ' + r.status);
  return r.json();
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(parse(req.body));
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 20000) req.destroy(); });
    req.on('end', () => resolve(parse(data)));
    req.on('error', () => resolve({}));
  });
  function parse(t) { try { return JSON.parse(t); } catch (e) { return { text: t }; } }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };

  if (!REDIS_URL || !REDIS_TOKEN) return send(503, {
    ok: false, error: 'not_configured',
    message: CREDS.names.length
      ? 'لقيت متغيرات تخزين لكن ناقصها الرابط أو التوكن: ' + CREDS.names.join('، ')
      : 'الربط غير مفعّل: ما لقيت متغيرات Upstash في المشروع — اربط قاعدة البيانات بمشروع mali_v1 ثم Redeploy',
    found: CREDS.names // أسماء فقط، بدون القيم
  });

  const body = req.method === 'POST' ? await readBody(req) : {};
  const url = new URL(req.url, 'http://x');
  const key = String(req.headers['x-mali-key'] || body.key || url.searchParams.get('key') || '').trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return send(401, { ok: false, error: 'bad_key', message: 'مفتاح الربط غير صحيح' });
  const list = 'mali:inbox:' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);

  try {
    if (req.method === 'POST') {
      const text = String(body.text || body.sms || body.message || '').slice(0, MAX_TEXT).trim();
      if (!text) return send(400, { ok: false, error: 'empty', message: 'ما وصلت رسالة' });
      const item = {
        id: crypto.randomBytes(8).toString('hex'),
        text,
        item: String(body.item || body.category || '').slice(0, 60).trim(),
        sender: String(body.sender || '').slice(0, 60).trim(),
        at: new Date().toISOString()
      };
      await redis([['RPUSH', list, JSON.stringify(item)], ['LTRIM', list, -MAX_ITEMS, -1], ['EXPIRE', list, TTL_SECONDS]]);
      return send(200, { ok: true, message: 'وصلت ✓' });
    }
    if (req.method === 'GET') {
      // ?ack=N: التطبيق حفظ أول N رسالة — نحذفها (الجديدة تنضاف آخر القائمة فما تنحذف بالغلط)
      const ack = parseInt(url.searchParams.get('ack') || '', 10);
      if (ack > 0) { await redis([['LTRIM', list, ack, -1]]); return send(200, { ok: true, removed: ack }); }
      const out = await redis([['LRANGE', list, 0, -1]]);
      const raw = (out[0] && out[0].result) || [];
      const items = raw.map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
      return send(200, { ok: true, items });
    }
    res.setHeader('Allow', 'GET, POST');
    return send(405, { ok: false, error: 'method' });
  } catch (e) {
    return send(502, { ok: false, error: 'storage', message: 'تعذر الوصول للتخزين' });
  }
};
