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
    const expected = { '2026-10': 245.76, '2026-11': 404.76, '2026-12': 977.76, '2027-01': 1672.76, '2027-02': 2455.76 };
    for (const [c, v] of Object.entries(expected)) assert.strictEqual(C.summarize(s, c, today).planSurplus, v, c);
    assert.ok(!s.goals.some(g => g.id === 'g-house'));
    assert.strictEqual(s.goals.filter(g => /سفر/.test(g.name)).length, 1);
    s.fixed.find(x => x.id === 'f-charity').amount = 200; // تعديل المستخدم بعد التحديث لا يُلغى
    assert.strictEqual(C.applyRevision(s).fixed.find(x => x.id === 'f-charity').amount, 200);
  }
});

console.log(`\n${n} اختبار ناجح`);
