// node tests/core.test.cjs — يختبر محرك الحسابات (core.js)
const assert = require('assert');
const C = require('../mali9-core.js');
const today = new Date('2026-10-04T10:00:00');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('✓', name); };
const seed = () => C.normalize(C.seedState());

t('دورة الراتب تبدأ يوم 27', () => {
  assert.strictEqual(C.cycleOf('2026-10-04', 27), '2026-09');
  assert.strictEqual(C.cycleOf('2026-10-27', 27), '2026-10');
  assert.strictEqual(C.cycleOf('2027-02-28', 31), '2027-02'); // فبراير قصير: يبدأ آخر يوم
});

t('فائض الخطة يطابق المراجعة المالية المعتمدة', () => {
  const s = seed();
  const expected = { '2026-10': 197.76, '2026-11': 356.76, '2026-12': 929.76, '2027-01': 1624.76, '2027-02': 2407.76, '2027-03': 2407.76 };
  for (const [c, v] of Object.entries(expected)) assert.strictEqual(C.summarize(s, c, today).planSurplus, v, c);
});

t('صرف أقل من الميزانية مع إقفال البند = توفير أخضر يزيد الفائض', () => {
  const s = seed();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 900, date: '2026-10-28' });
  s.closed['2026-10'] = { 'f-house': true };
  const sm = C.summarize(s, '2026-10', today);
  const l = sm.lines.fixed.find(l => l.id === 'f-house');
  assert.strictEqual(l.state, 'saved'); assert.strictEqual(l.diff, 100);
  assert.strictEqual(sm.projectedSurplus, 297.76);
});

t('صرف أكثر من الميزانية = تجاوز وتنبيه', () => {
  const s = seed();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 1100, date: '2026-10-28' });
  const sm = C.summarize(s, '2026-10', today);
  assert.deepStrictEqual(sm.overs.map(o => [o.id, o.amount]), [['f-house', 100]]);
  assert.strictEqual(sm.projectedSurplus, 97.76);
  assert.ok(sm.insights.some(i => i.title.includes('مصروف البيت')));
});

t('تعديل المخطط لشهر واحد فقط', () => {
  const s = seed();
  s.overrides['2026-11'] = { 'f-house': 1200 };
  assert.strictEqual(C.summarize(s, '2026-11', today).planSurplus, 156.76);
  assert.strictEqual(C.summarize(s, '2026-12', today).planSurplus, 929.76);
});

t('العجز يجعل الوضع ضغط، والهامش الضعيف ما يكون مريح', () => {
  const s = seed();
  s.entries.push({ id: 'v', kind: 'variable', ref: '', amount: 500, date: '2026-10-28' });
  assert.strictEqual(C.summarize(s, '2026-10', today).health.level, 'bad');
  assert.notStrictEqual(C.summarize(seed(), '2026-10', today).health.level, 'good');
  assert.strictEqual(C.summarize(seed(), '2027-02', today).health.level, 'good');
});

t('سداد قسط ينقص المتبقي', () => {
  const s = seed();
  const d = s.debts.find(d => d.id === 'dt193');
  s.entries.push({ id: 'p', kind: 'debt', ref: 'dt193', amount: 195, date: '2026-10-27' });
  assert.strictEqual(C.debtRemaining(s, d), 390);
});

t('الهدف يتوقف بعد اكتمال المستهدف', () => {
  const s = seed();
  const majlis = s.goals.find(g => g.id === 'g-majlis');
  assert.strictEqual(C.plannedFor(s, 'goal', majlis, '2027-01'), 0);
});

t('ترحيل بيانات النسخة القديمة بدون فقد', () => {
  const old = require('./legacy-sample.json');
  const s = C.normalize(C.migrateLegacy(old));
  assert.strictEqual(s.fixed.length, old.fixed.length);
  assert.strictEqual(s.debts.length, old.debts.length);
  assert.strictEqual(s.goals.length, old.goals.length);
  const moved = old.transactions.filter(x => Number(x.amount) > 0).length;
  assert.strictEqual(s.entries.length, moved);
  assert.strictEqual(s.fixed.find(x => x.id === 'f-house').bank, 'urpay');
  assert.strictEqual(s.debts.find(x => x.id === 'd1').kind, 'fixed');
  assert.strictEqual(s.debts.find(x => x.id === 'dt193').kind, 'temp');
  // دفعات قديمة لا تنقص المتبقي مرة ثانية
  assert.strictEqual(C.debtRemaining(s, s.debts.find(x => x.id === 'd1')), 98000);
});

t('تحديث الخطة (13,378 + 400) يعطي الفوائض الصحيحة ويطبّق مرة وحدة', () => {
  const old = require('./legacy-sample.json');
  for (const base of [seed(), C.normalize(C.migrateLegacy(old))]) {
    const s = C.applyRevision(base);
    const expected = { '2026-10': 297.94, '2026-11': 6.42, '2026-12': 29.09, '2027-01': 23.89, '2027-02': 6.4, '2027-03': 6.4, '2027-04': 1.4, '2027-05': 1331.4 };
    for (const [c, v] of Object.entries(expected)) assert.strictEqual(C.summarize(s, c, today).planSurplus, v, c);
    assert.ok(!s.goals.some(g => g.id === 'g-house'));
    assert.ok(s.goals.every(g => C.goalSaved(s, g) === 0)); // الأرصدة صفر بتأكيد خالد
    assert.strictEqual(s.goals.filter(g => /سفر/.test(g.name)).length, 1);
    s.fixed.find(x => x.id === 'f-charity').amount = 200; // تعديل المستخدم بعد التحديث لا يُلغى
    assert.strictEqual(C.applyRevision(s).fixed.find(x => x.id === 'f-charity').amount, 200);
  }
});

t('المصروف اليومي الآمن وعدّاد الديون', () => {
  const s = C.applyRevision(seed());
  const now = new Date('2026-11-06T10:00:00');
  s.entries.push({ id: 'p', kind: 'fixed', ref: 'f-personal', amount: 700, date: '2026-10-28' });
  const sp = C.summarize(s, '2026-10', now).spend;
  assert.strictEqual(sp.budget, 4200);           // البيت + العيال + الشخصي + الترفيه
  assert.strictEqual(sp.flexRemaining, 3500);
  assert.strictEqual(sp.daysLeft, 21);
  assert.strictEqual(sp.daily, C.round2(3500 / 21));
  const df = C.debtFreedom(s, '2026-10', now);
  assert.strictEqual(df.tempEnd, '2027-01');
  assert.strictEqual(df.items.find(x => x.id === 'd1').last, '2029-06'); // 95,278.75 ÷ 2,887.24 = 33 شهر
});

t('مراجعة (ج) على جهاز طبّق (ب) وسجّل دفعة: ما تنخصم الدفعة مرتين', () => {
  const s = seed();
  s.revisions = [];
  C.applyRevision(s); // يطبق ب ثم ج
  const fresh = C.normalize(C.seedState());
  fresh.revisions = ['plan-2026-10-04b'];
  fresh.entries.push({ id: 'p1', kind: 'debt', ref: 'd1', amount: 2887.24, date: '2026-09-28' });
  C.applyRevision(fresh);
  assert.strictEqual(C.debtRemaining(fresh, fresh.debts.find(d => d.id === 'd1')), 95278.75);
  assert.strictEqual(fresh.fixed.find(x => x.id === 'f-uni').endCycle, '2027-03');
  assert.strictEqual(C.summarize(fresh, '2027-04', today).lines.fixed.some(l => l.id === 'f-uni'), false);
  const goals = Object.fromEntries(['g-majlis', 'g-ramadan', 'g-eid', 'g-adha'].map(id => [id, fresh.goals.find(g => g.id === id).target]));
  assert.deepStrictEqual(goals, { 'g-majlis': 3000, 'g-ramadan': 2000, 'g-eid': 2000, 'g-adha': 1500 });
  assert.strictEqual(C.plannedFor(fresh, 'debt', fresh.debts.find(d => d.id === 'd-maid'), '2026-10'), 600);
  assert.deepStrictEqual(fresh.revisions, ['plan-2026-10-04b', 'plan-2026-10-04c', 'plan-2026-10-04d']);
  const m = fresh.goals.find(g => g.id === 'g-majlis');
  assert.deepStrictEqual(['2026-10', '2026-11'].map(c => C.plannedFor(fresh, 'goal', m, c)), [1500, 1500]);
});

t('قراءة رسائل البنوك واقتراح البند', () => {
  const s = C.applyRevision(seed());
  const now = new Date('2026-10-30T10:00:00');
  const cases = [
    ['شراء عبر نقاط البيع\nمبلغ: SAR 85.50\nلدى: ALDREES PETROLEUM\nفي: 2026-10-29', 85.5, 'out', 'fixed', 'f-personal'],
    ['Purchase\nAmount: 230.00 SAR\nAt: PANDA RIYADH\nDate: 30/10/26', 230, 'out', 'fixed', 'f-house'],
    ['إيداع راتب\nمبلغ: 13,378.00 ريال\nالأهلي', 13378, 'income', 'income', 'i-salary'],
    ['تم سداد قسط تابي بمبلغ 194.80 ر.س', 194.8, 'out', 'debt', 'dt193'],
    ['خصم قسط تمويل\nمبلغ 2,887.24 ر.س\nالبنك الأهلي', 2887.24, 'out', 'debt', 'd1'],
    ['عملية شراء بـ ١٢٠٫٥٠ ريال من مطعم البيك', 120.5, 'out', 'variable', '']
  ];
  for (const [msg, amt, type, kind, ref] of cases) {
    const p = C.parseSms(msg, now), g = C.suggestForSms(s, p, '2026-10');
    assert.strictEqual(p.amount, amt, msg); assert.strictEqual(p.type, type, msg);
    assert.deepStrictEqual([g.kind, g.ref], [kind, ref], msg);
  }
  assert.strictEqual(C.parseSms('شراء\nمبلغ: 10 ريال\nفي: 2026-10-29', now).date, '2026-10-29');
  assert.strictEqual(C.splitSms('رسالة أولى مبلغ 5 ريال\n\nرسالة ثانية مبلغ 7 ريال').length, 2);
  // التعلم: نفس التاجر يروح لنفس البند
  s.settings.merchantMap = { 'مطعم البيك': { kind: 'fixed', ref: 'f-entertainment' } };
  const g = C.suggestForSms(s, C.parseSms('عملية شراء بـ 40 ريال من مطعم البيك', now), '2026-10');
  assert.deepStrictEqual([g.kind, g.ref], ['fixed', 'f-entertainment']);
});

t('مصروفي الشهري مقسوم على الأيام + اختصار الآيفون', () => {
  const s = C.applyRevision(seed());
  const now = new Date('2026-11-06T10:00:00'); // اليوم 11 من دورة 31 يوم
  s.overrides['2026-10'] = { 'f-personal': 1860 };  // مبلغ هذا الشهر
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-personal', amount: 800, date: '2026-11-01' });
  let b = C.budgetPace(s, C.summarize(s, '2026-10', now), 'f-personal');
  assert.strictEqual(b.daily, 60); assert.strictEqual(b.expected, 660);
  assert.strictEqual(b.diff, -140); assert.strictEqual(b.state, 'ahead');   // سحب زيادة 140
  assert.strictEqual(b.dailyLeft, C.round2(1060 / 21));
  s.entries[s.entries.length - 1].amount = 400;
  b = C.budgetPace(s, C.summarize(s, '2026-10', now), 'f-personal');
  assert.strictEqual(b.state, 'saving'); assert.strictEqual(b.diff, 260);   // وفّر 260
  assert.deepStrictEqual(C.resolveTarget(s, 'البيت'), { kind: 'fixed', ref: 'f-house' });
  assert.deepStrictEqual(C.resolveTarget(s, 'متغير'), { kind: 'variable', ref: '' });
  assert.deepStrictEqual(C.parseMaliClip('مالي|البيت|شراء مبلغ 50 ريال'), { key: 'البيت', sms: 'شراء مبلغ 50 ريال' });
  assert.strictEqual(C.parseMaliClip('شراء مبلغ 50 ريال'), null);
});

t('رسائل خالد الحقيقية: الأهلي ويوربي وفيجن', () => {
  const s = C.applyRevision(seed());
  const map = C.normalize(s).settings.cardMap;
  const now = new Date('2026-10-05T10:00:00');
  const snb = C.parseSms('شراء-POS\nبـ11 SAR\nمن Business\nمدى-ابل*8398\nفي 04/10/26 20:16', now, '', map);
  assert.deepStrictEqual([snb.amount, snb.type, snb.merchant, snb.date, snb.card, snb.bank], [11, 'out', 'Business', '2026-10-04', '8398', 'snb']);
  const ur = C.parseSms('شراء PoS\nبطاقة:0679;Apple Pay;مدى\nمبلغ:SAR 150.0\nمن:Business..\n03-10-2026 16:58', now, '', map);
  assert.deepStrictEqual([ur.amount, ur.merchant, ur.date, ur.card, ur.bank], [150, 'Business', '2026-10-03', '0679', 'urpay']);
  const vi = C.parseSms('شراء عبر الإنترنت \nمن: www landmarkgroup com\nبمبلغ: 376.00 SAR\nنوع البطاقة: مدى\nرقم البطاقة: ****4800\nرقم حساب البطاقة:  ****2000\nالتاريخ: 03/10/2026 22:42:34\nالموقع: SAU, Riyadh', now, '', map);
  assert.deepStrictEqual([vi.amount, vi.merchant, vi.date, vi.card, vi.bank], [376, 'www landmarkgroup com', '2026-10-03', '4800', 'vision']);
});

t('سداد فاتورة الكهرباء وأقساط تابي وتمارا من بطاقة الأهلي', () => {
  const s = C.normalize(C.applyRevision(seed()));
  const now = new Date('2026-09-28T10:00:00');
  const run = msg => { const p = C.parseSms(msg, now, '', s.settings.cardMap); return [p, C.suggestForSms(s, p, C.cycleOf(p.date, 27))]; };
  let [p, g] = run('سداد فاتورة\nمبلغ 323.63 SAR\nمن 406*332\nمفوتر 002\nفاتورة 30159843276\nفي 27/09/26 09:21');
  assert.deepStrictEqual([p.amount, p.date, g.kind, g.ref], [323.63, '2026-09-27', 'fixed', 'f-electric']);
  [p, g] = run('شراء انترنت\nبـ158.48 SAR\nمن 5406*\nمن Tamara\nمدى-ابل *8398\nفي 27/09/26 09:06');
  assert.deepStrictEqual([p.amount, p.bank, p.provider, g.kind, g.ref], [158.48, 'snb', 'tamara', 'debt', 'dtamara152']);
  [p, g] = run('شراء انترنت\nبـ282.51 SAR\nمن 5406*\nمن TABBY\nمدى *8398\nفي 27/09/26 09:06');
  assert.deepStrictEqual([p.amount, p.bank, g.kind, g.ref], [282.51, 'snb', 'debt', 'dtickets']);
});

console.log(`\n${n} اختبار ناجح`);
