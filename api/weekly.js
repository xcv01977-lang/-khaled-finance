// ملخص الخميس: Vercel Cron يناديه كل خميس الصبح (vercel.json)، ويرسل لكل جوال مشترك ملخص أسبوعه.
// يحسب من آخر نسخة سحابية (نفس اللي يرفعها التطبيق بعد كل تعديل) بنفس محرك الحسابات.
const zlib = require('zlib');
const P = require('./_push.js');
const C = require('../mali9-core.js');
const SET = 'mali:push:all';
const fmt = n => Math.round(Math.abs(Number(n) || 0)).toLocaleString('en-US');
// تاريخ الرياض (UTC+3) بصيغة YYYY-MM-DD
const riyadhDay = (d, back = 0) => new Date(d.getTime() + 3 * 3600e3 - back * 864e5).toISOString().slice(0, 10);

function unpack(rec) {
  if (!rec || !rec.data) return null;
  const json = rec.fmt === 'gz64' ? zlib.gunzipSync(Buffer.from(rec.data, 'base64')).toString('utf8') : rec.data;
  return JSON.parse(json);
}

function summaryFor(raw, now) {
  const s = C.normalize(raw);
  const sd = s.settings.salaryDay;
  const cycle = C.cycleOf(riyadhDay(now), sd);
  const sm = C.summarize(s, cycle, now);
  const from = riyadhDay(now, 6), to = riyadhDay(now);
  // الصرف = المحافظ (البيت والعيال والشخصي…) + المصاريف المتغيرة خلال آخر 7 أيام
  const walletIds = new Set(s.fixed.filter(x => C.isWallet(x)).map(x => x.id));
  const spent = C.sum(s.entries.filter(e => e.date >= from && e.date <= to && (e.kind === 'variable' || (e.kind === 'fixed' && walletIds.has(e.ref)))), e => e.amount);
  const mine = (sm.wallets || []).find(w => w.id === s.settings.pinnedBudget);
  const late = sm.tasks ? sm.tasks.overdue.length : 0;
  const sv = sm.projectedSurplus;
  const line1 = `صرفت ${fmt(spent)} هالأسبوع` + (mine ? ` · باقي من مصروفك ${mine.left < 0 ? '-' : ''}${fmt(mine.left)}` : '');
  const line2 = (late ? `⚠️ ${late} ${late === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'}` : 'كل المهام مدفوعة ✓') + ' · ' + (sv < -0.009 ? `⛔ عجز متوقع ${fmt(sv)}` : `الفائض ${fmt(sv)} ✅`);
  return { title: 'ملخص الأسبوع — مالي', body: line1 + '\n' + line2, tag: 'mali-weekly', url: './' };
}

// النسخة المشفرة: نحسب من الأرقام المختصرة اللي يرفعها الجوال مع كل نسخة
function summaryFromDigest(d, now) {
  const from = riyadhDay(now, 6), to = riyadhDay(now);
  const spent = Object.entries(d.days || {}).filter(([k]) => k >= from && k <= to).reduce((a, [, v]) => a + (Number(v) || 0), 0);
  const today = to, grace = 2;
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const late = (d.due || []).filter(x => typeof x === 'string' && today > addDays(x, grace)).length;
  const sv = Number(d.surplus) || 0, mine = d.mineLeft;
  const line1 = `صرفت ${fmt(spent)} هالأسبوع` + (mine !== null && mine !== undefined ? ` · باقي من مصروفك ${mine < 0 ? '-' : ''}${fmt(mine)}` : '');
  const line2 = (late ? `⚠️ ${late} ${late === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'}` : 'كل المهام مدفوعة ✓') + ' · ' + (sv < -0.009 ? `⛔ عجز متوقع ${fmt(sv)}` : `الفائض ${fmt(sv)} ✅`);
  return { title: 'ملخص الأسبوع — مالي', body: line1 + '\n' + line2, tag: 'mali-weekly', url: './' };
}
const isEnc = rec => rec && (rec.fmt === 'gzenc1' || rec.fmt === 'enc1');

module.exports = async (req, res, deps = {}) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)); };
  const creds = deps.creds || P.findCreds(process.env);
  if (!creds.url || !creds.token) return send(503, { ok: false, error: 'not_configured' });
  const redis = deps.redis || P.makeRedis(creds);
  const url = new URL(req.url, 'http://x');
  // تشغيل من الجوال لنفس المستخدم بس (زر «أرسل الملخص الحين»)، أو من Vercel Cron للكل
  const key = String(req.headers['x-mali-key'] || url.searchParams.get('key') || '').trim();
  const secret = process.env.CRON_SECRET;
  const isCron = secret ? req.headers.authorization === 'Bearer ' + secret : /vercel-cron/i.test(String(req.headers['user-agent'] || ''));
  let fps;
  if (/^[A-Za-z0-9_-]{16,64}$/.test(key)) fps = [P.fingerprint(key)];
  else if (isCron) { const out = await redis([['SMEMBERS', SET]]); fps = (out[0] && out[0].result) || []; }
  else return send(401, { ok: false, error: 'unauthorized' });

  const now = deps.now || new Date();
  let sent = 0, skipped = 0, failed = 0;
  try {
    const vapid = await P.getVapid(redis);
    for (const fp of fps) {
      const out = await redis([['GET', 'mali:push:sub:' + fp], ['GET', 'mali:bk:' + fp + ':latest']]);
      const sub = out[0] && out[0].result ? JSON.parse(out[0].result) : null;
      const rec = out[1] && out[1].result ? JSON.parse(out[1].result) : null;
      if (!sub || !rec) { skipped++; continue; }
      try {
        if (isEnc(rec) && !rec.digest) { skipped++; continue; }
        const msg = isEnc(rec) ? summaryFromDigest(rec.digest, now) : summaryFor(unpack(rec), now);
        const r = await P.sendPush(sub, msg, vapid, deps.fetch);
        if (r.gone) await redis([['DEL', 'mali:push:sub:' + fp], ['SREM', SET, fp]]);
        if (r.status < 300) sent++; else failed++;
      } catch (e) { failed++; }
    }
    return send(200, { ok: true, sent, skipped, failed });
  } catch (e) {
    return send(502, { ok: false, error: 'storage' });
  }
};
module.exports.summaryFor = summaryFor;
module.exports.summaryFromDigest = summaryFromDigest;
module.exports.unpack = unpack;
