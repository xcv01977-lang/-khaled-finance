// أدوات Web Push لمالي بدون مكتبات خارجية (RFC 8291 تشفير الرسالة + RFC 8292 مفاتيح VAPID).
// الملف يبدأ بـ «_» فـ Vercel ما يعتبره رابط؛ تستخدمه api/push.js و api/weekly.js.
const crypto = require('crypto');

const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

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
function makeRedis(creds) {
  return async commands => {
    const r = await fetch(creds.url.replace(/\/$/, '') + '/multi-exec', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error('storage ' + r.status);
    return r.json();
  };
}
// نفس بصمة صندوق الوارد والنسخ السحابي (sha256 للمفتاح، أول 32 حرف)
const fingerprint = key => crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);

/* مفاتيح VAPID: تتولد مرة وحدة وتنحفظ في نفس التخزين — ما تحتاج إعداد في Vercel */
const VAPID_KEY = 'mali:push:vapid';
function newVapid() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]);
  return { pub: b64u(raw), priv: privateKey.export({ format: 'jwk' }) };
}
async function getVapid(redis) {
  const out = await redis([['GET', VAPID_KEY]]);
  if (out[0] && out[0].result) return JSON.parse(out[0].result);
  const v = newVapid();
  await redis([['SET', VAPID_KEY, JSON.stringify(v), 'NX']]);
  const again = await redis([['GET', VAPID_KEY]]);       // لو طلبين تسابقوا، الكل ياخذ نفس المفتاح
  return again[0] && again[0].result ? JSON.parse(again[0].result) : v;
}

function vapidHeader(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject || 'mailto:mali@maliv1.vercel.app' }));
  const key = crypto.createPrivateKey({ key: vapid.priv, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.pub}`;
}

/* تشفير aes128gcm (RFC 8291) */
function encrypt(sub, payload, opts = {}) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const salt = opts.salt || crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ct]);
}

async function sendPush(sub, data, vapid, fetchImpl = fetch) {
  const body = encrypt(sub, JSON.stringify(data));
  const r = await fetchImpl(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '86400', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidHeader(sub.endpoint, vapid) },
    body
  });
  return { status: r.status, gone: r.status === 404 || r.status === 410 };
}

function validSub(sub) {
  return sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 1000
    && sub.keys && /^[A-Za-z0-9_-]{80,100}$/.test(sub.keys.p256dh || '') && /^[A-Za-z0-9_-]{16,30}$/.test(sub.keys.auth || '');
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
  function parse(t) { try { return JSON.parse(t); } catch (e) { return {}; } }
}

module.exports = { b64u, unb64u, findCreds, makeRedis, fingerprint, getVapid, newVapid, vapidHeader, encrypt, sendPush, validSub, readBody };
