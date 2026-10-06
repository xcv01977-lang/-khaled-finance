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
  assert.strictEqual(sp.budget, 1800);           // المصروف الشخصي فقط
  assert.strictEqual(sp.flexRemaining, 1100);
  assert.strictEqual(sp.daysLeft, 21);
  assert.strictEqual(sp.daily, C.round2(1100 / 21));
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
  assert.deepStrictEqual(fresh.revisions, ['plan-2026-10-04b', 'plan-2026-10-04c', 'plan-2026-10-04d', 'plan-2026-10-05e', 'plan-2026-10-05f']);
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

t('رسائل الحوالات بصيغة SR وغيرها', () => {
  const s = C.normalize(C.applyRevision(seed()));
  const now = new Date('2026-10-05T10:00:00');
  const run = m => C.parseSms(m, now, '', s.settings.cardMap);
  const rows = [
    ['حوالة واردة\nمبلغ: 500 SR\nمن: محمد\nالأهلي', 500, 'income'],
    ['حوالة صادرة\nإلى: Maria\nالمبلغ SR 600\nبتاريخ 05/10/2026', 600, 'out'],
    ['تم تحويل 1,200.50SR إلى حسابك', 1200.5, 'income'],
    ['إيداع SR500 في حسابك', 500, 'income'],
    ['تم خصم 75 SR من بطاقتك مدى*8398', 75, 'out'],
    ['حوالة واردة بمبلغ ٣٥٠ ر.س', 350, 'income']
  ];
  for (const [m, amt, type] of rows) { const p = run(m); assert.deepStrictEqual([p.amount, p.type], [amt, type], m); }
  assert.strictEqual(run('تم خصم 75 SR من بطاقتك مدى*8398').merchant, '');
});

t('فحص الخطة يكشف المكرر والزائد والمتغير ويصلحها', () => {
  const s = C.normalize(C.applyRevision(seed()));
  assert.strictEqual(C.auditPlan(s).length, 0);                         // البيانات المعتمدة نظيفة
  s.fixed.push(Object.assign({}, s.fixed.find(x => x.id === 'f-house'), { id: 'zz1' })); // مكرر
  s.fixed.push({ id: 'zz2', name: 'بند غريب', amount: 5250, startCycle: '2026-10', endCycle: '', flexible: false, bank: '', note: '' });
  s.fixed.find(x => x.id === 'f-kids').amount = 2000;                    // متغير
  s.entries.push({ id: 'e1', kind: 'fixed', ref: 'zz1', amount: 100, date: '2026-10-28', note: '' });
  const before = C.summarize(s, '2026-10', today).planSurplus;
  const f = C.auditPlan(s);
  assert.deepStrictEqual(f.map(x => x.type).sort(), ['changed', 'dup', 'extra']);
  C.applyAudit(s, f.filter(x => x.checked));
  assert.strictEqual(C.summarize(s, '2026-10', today).planSurplus, 297.94);
  assert.ok(before < 0);
  assert.strictEqual(s.entries.find(e => e.id === 'e1').kind, 'variable');   // الحركة ما ضاعت
  assert.strictEqual(C.auditPlan(s).length, 0);
});

t('راتب سبتمبر: نفس البنود + التسجيل بالباقي + مصروفي اليوم', () => {
  const s = C.normalize(C.applyRevision(seed()));
  const now = new Date('2026-10-05T10:00:00');            // سبتمبر هي الدورة الحالية (27 سبتمبر – 26 أكتوبر)
  const sm = C.summarize(s, '2026-09', now);
  assert.strictEqual(sm.current, '2026-09');
  assert.strictEqual(sm.totals.fixed.planned, 6950);
  assert.strictEqual(sm.totals.income.confirmedPlanned, 13778);
  assert.strictEqual(sm.totalDays, 30);
  const house = s.fixed.find(x => x.id === 'f-house');
  assert.deepStrictEqual(C.remainingToSpend(s, 'fixed', house, '2026-09', 780), { planned: 1000, recorded: 0, spent: 220, add: 220 });
  s.entries.push({ id: 'h1', kind: 'fixed', ref: 'f-house', amount: 220, date: '2026-10-04', note: '' });
  assert.strictEqual(C.remainingToSpend(s, 'fixed', house, '2026-09', 700, false).add, 80);  // الباقي نزل لـ700: يضاف 80 بس
  // مصروفي: 1800 ÷ 30 = 60 يوميًا، صرفت 70 اليوم = زيادة 10
  s.entries.push({ id: 'p1', kind: 'fixed', ref: 'f-personal', amount: 70, date: '2026-10-05', note: '' });
  const b = C.budgetPace(s, C.summarize(s, '2026-09', now), 'f-personal');
  assert.deepStrictEqual([b.daily, b.spentToday, b.todayLeft], [60, 70, -10]);
});

t('الحساب اليومي للمصروف الشخصي فقط، وعدد الأيام من الراتب للراتب', () => {
  const s = C.normalize(C.applyRevision(seed()));
  assert.deepStrictEqual(s.fixed.filter(x => x.flexible).map(x => x.id), ['f-personal']);
  const now = new Date('2026-10-05T10:00:00');
  const days = c => C.summarize(s, c, now).totalDays;
  assert.deepStrictEqual([days('2026-09'), days('2026-10'), days('2026-11')], [30, 31, 30]); // 27→26 لكل دورة
  const per = c => C.budgetPace(s, C.summarize(s, c, now), 'f-personal').daily;
  assert.deepStrictEqual([per('2026-09'), per('2026-11')], [60, 60]);
  assert.strictEqual(per('2026-10'), 58);   // 1800 ÷ 31 = 58.06 → رقم صحيح بدون هللات
  assert.strictEqual(C.auditPlan(s).length, 0);                            // الفحص يتفق مع المراجعات
  // جهاز قديم طبّق المراجعات السابقة وفيه البيت «مرن»: المراجعة (و) تصلحه مرة وحدة
  const old = C.normalize(C.seedState()); old.revisions = ['plan-2026-10-04b', 'plan-2026-10-04c', 'plan-2026-10-04d', 'plan-2026-10-05e'];
  old.fixed.find(x => x.id === 'f-house').flexible = true;
  C.applyRevision(old);
  assert.strictEqual(old.fixed.find(x => x.id === 'f-house').flexible, false);
});

/* قائمة المهام */
t('المهام: المتأخر والمنجز', () => {
  const s = C.normalize(C.applyRevision(C.normalize(C.seedState())));
  const t = new Date('2026-10-05T10:00');
  const sm = C.summarize(s, '2026-09', t);
  assert.ok(sm.tasks.open.length > 0 && sm.tasks.overdue.length === sm.tasks.open.length);
  const first = sm.tasks.open.find(i => i.kind !== 'income');
  s.entries.push({ id: 'x1', kind: first.kind, ref: first.id, amount: first.remaining, date: '2026-09-28', note: '' });
  const sm2 = C.summarize(s, '2026-09', t);
  assert.ok(sm2.tasks.done.some(i => i.id === first.id));
  s.entries.push({ id: 'x2', kind: sm.tasks.open[2].kind, ref: sm.tasks.open[2].id, amount: 1, date: '2026-09-28', note: '' });
  const partial = C.summarize(s, '2026-09', t).tasks.open.find(i => i.id === sm.tasks.open[2].id);
  assert.ok(partial && partial.actual === 1 && partial.remaining === sm.tasks.open[2].planned - 1);
  assert.equal(C.dueDate(s, { dueDay: 5 }, '2026-09'), '2026-10-05');
  const cur = C.summarize(s, '2026-10', new Date('2026-10-05T10:00'));
  assert.equal(cur.tasks.overdue.length, 0);
});

t('المحافظ: مشتريات البنك تنخصم من محفظته وتتلون وتطلع من المهام', () => {
  const s = C.normalize(C.applyRevision(C.normalize(C.seedState())));
  for (const [bank, ref] of [['urpay', 'f-house'], ['vision', 'f-kids'], ['snb', 'f-personal']]) {
    const p = C.parseSms('شراء مبلغ SAR 50 لدى ماركت', new Date('2026-11-10T10:00')); p.bank = bank; p.type = 'out';
    assert.strictEqual(C.suggestForSms(s, p, '2026-10').ref, ref);
  }
  const tt = new Date('2026-11-10T10:00');
  s.entries = [{ id: 'w1', kind: 'fixed', ref: 'f-house', amount: 800, date: '2026-11-05', note: '' }];
  let sm = C.summarize(s, '2026-10', tt);
  assert.strictEqual(sm.wallets.find(w => w.id === 'f-house').level, 'low');
  assert.ok(!sm.tasks.open.some(i => C.WALLETS.includes(i.id)) && !sm.tasks.done.some(i => C.WALLETS.includes(i.id)));
  s.entries[0].amount = 1100;
  sm = C.summarize(s, '2026-10', tt);
  assert.strictEqual(sm.wallets.find(w => w.id === 'f-house').level, 'over');
  assert.strictEqual(C.walletLevel(1000, 1000).level, 'empty');
  assert.strictEqual(C.walletLevel(1000, 300).level, 'ok');
});

t('أي بند يتحول متغير (محفظة) ويتحول معه الربط والمهام', () => {
  const s = C.normalize(C.applyRevision(C.normalize(C.seedState())));
  const el = s.fixed.find(x => x.id === 'f-electric');
  const tt = new Date('2026-11-10T10:00');
  assert.ok(C.summarize(s, '2026-10', tt).tasks.open.some(i => i.id === 'f-electric'));
  el.wallet = true;
  const sm = C.summarize(s, '2026-10', tt);
  assert.ok(!sm.tasks.open.some(i => i.id === 'f-electric') && sm.wallets.some(w => w.id === 'f-electric'));
  const p = C.parseSms('شراء مبلغ SAR 50 لدى ماركت', tt); p.bank = el.bank; p.type = 'out';
  assert.strictEqual(C.suggestForSms(s, p, '2026-10').ref, 'f-electric');
  s.fixed.find(x => x.id === 'f-house').wallet = false;
  assert.ok(C.summarize(s, '2026-10', tt).tasks.open.some(i => i.id === 'f-house'));
});

t('الثيم الافتراضي محيطي والبيانات القديمة تنقرأ كما هي', () => {
  assert.strictEqual(C.THEMES[0].id, 'lagoon');
  assert.strictEqual(C.defaultSettings().theme, 'lagoon');
  const s = seed(); const before = JSON.stringify({ i: s.income, f: s.fixed, d: s.debts, g: s.goals });
  const again = C.normalize(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(JSON.stringify({ i: again.income, f: again.fixed, d: again.debts, g: again.goals }), before);
});

t('تجاهل الرسائل: بالنص نفسه وبكلمة مفتاحية، ويبقى بعد التطبيع', () => {
  const s = seed();
  const p = C.parseSms('حوالة واردة من أحمد مبلغ 500 ريال', today, '', {});
  assert.strictEqual(C.ignoreMatch(s, p.raw, p.hash), '');
  C.addIgnore(s, p.hash);
  assert.strictEqual(C.ignoreMatch(s, p.raw, p.hash), 'hash');
  assert.ok(C.addIgnoreRule(s, 'حوالة واردة من أحمد'));
  assert.ok(!C.addIgnoreRule(s, 'حوالة واردة من أحمد'), 'لا تتكرر القاعدة');
  assert.ok(!C.addIgnoreRule(s, 'ab'), 'قصيرة جدًا');
  assert.ok(C.ignoreMatch(s, 'حوالة واردة من أحمد مبلغ 900', 'x'));
  assert.strictEqual(C.ignoreMatch(s, 'شراء من ALDREES 85 ريال', 'y'), '');
  const again = C.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(again.ignored, s.ignored);
  assert.strictEqual(again.settings.ignoreRules.length, 1);
  const old = JSON.parse(JSON.stringify(seed())); delete old.ignored; delete old.settings.ignoreRules;
  const m = C.normalize(old); assert.deepStrictEqual(m.ignored, []); assert.deepStrictEqual(m.settings.ignoreRules, []);
});

t('المراقب: يلتقط التجاوز والتكرار والمتأخر ويرتب الأهم أولًا', () => {
  const s = seed(); const now = new Date('2026-11-05T12:00:00');   // دورة 2026-10 جارية
  const e = (kind, ref, amount, date, note) => s.entries.push({ id: C.uid(), kind, ref, amount, date, note, bank: 'snb' });
  for (const [a, d, n2] of [[60, '2026-10-30', 'بقالة'], [70, '2026-10-31', 'مطعم'], [55, '2026-11-01', 'بقالة'], [80, '2026-11-02', 'مطعم'], [900, '2026-11-04', 'جوال']]) e('variable', '', a, d, n2);
  e('variable', '', 40, '2026-11-05', 'قهوة'); e('variable', '', 40, '2026-11-05', 'قهوة');
  const sm = C.summarize(s, '2026-10', now), m = C.monitor(s, sm, now);
  assert.ok(m.alerts.length > 0 && m.alerts.every((a, i, arr) => !i || arr[i - 1].w >= a.w), 'مرتبة بالأهمية');
  assert.ok(m.anomalies.some(a => a.type === 'big' && /900/.test(a.text)), 'عملية كبيرة');
  assert.ok(m.anomalies.some(a => a.type === 'dup'), 'عملية مكررة');
  assert.strictEqual(m.spentTotal, 1245);
  assert.strictEqual(m.byKind[0].key, 'variable');
  assert.strictEqual(m.days.length, 14);
  assert.strictEqual(m.todaySpent, 80);
  assert.ok(['good', 'warn', 'bad'].includes(m.level));
  assert.ok(m.summary.lead && typeof m.summary.text === 'string');
});

t('المراقب: بدون دخل يطلب الراتب ولا ينهار، والبيانات الفارغة تمر', () => {
  const s = seed(); s.income = [];
  const sm = C.summarize(s, '2026-10', today), m = C.monitor(s, sm, today);
  assert.strictEqual(m.level, 'unknown');
  const e = C.normalize(C.emptyState()); const sm2 = C.summarize(e, '2026-10', today);
  assert.doesNotThrow(() => C.monitor(e, sm2, today));
});

t('الاختصار: مشتريات بطاقة مربوطة بمحفظة تُسجَّل تلقائيًا، وغير الواثق يروح للتصنيف', () => {
  const s = seed();
  const cyc = '2026-09';
  const buy = C.parseSms('شراء عبر نقاط البيع\nمبلغ: 45.00 ريال\nلدى: STARBUCKS\nبطاقة ****4800', today, '', s.settings.cardMap);
  const tg = C.autoTarget(s, buy, cyc);
  assert.ok(tg && tg.kind === 'fixed' && tg.ref === 'f-kids', 'فيجن (4800) = العيال');
  const weird = C.parseSms('تنبيه: عملية بمبلغ 77 ريال', today, '', s.settings.cardMap);
  assert.strictEqual(C.autoTarget(s, weird, cyc), null, 'بدون بنك معروف = تصنيف');
  const inc = C.parseSms('إيداع راتب مبلغ 13780 ريال إلى حسابك', today, '', s.settings.cardMap);
  assert.strictEqual(C.autoTarget(s, inc, cyc), null, 'الدخل لا يُسجَّل تلقائيًا');
  const transfer = C.parseSms('حوالة صادرة مبلغ 500 ريال من حسابك بطاقة ****4800', today, '', s.settings.cardMap);
  assert.strictEqual(C.autoTarget(s, transfer, cyc), null, 'التحويلات لا تنخصم من المحفظة تلقائيًا');
});

t('أسماء الاختصار: «المصروف الشخصي» و«المصروف اليومي» و«مصروف البيت»', () => {
  const s = seed();
  assert.deepStrictEqual(C.resolveTarget(s, 'المصروف الشخصي'), { kind: 'fixed', ref: 'f-personal' });
  assert.deepStrictEqual(C.resolveTarget(s, 'مصروفي الشخصي'), { kind: 'fixed', ref: 'f-personal' });
  assert.deepStrictEqual(C.resolveTarget(s, 'المصروف اليومي'), { kind: 'fixed', ref: s.settings.pinnedBudget });
  assert.deepStrictEqual(C.resolveTarget(s, 'مصروف البيت'), { kind: 'fixed', ref: 'f-house' });
});

/* ───────── تقسيمة الراتب ───────── */
const plan = () => C.applyRevision(seed());
const nov5 = new Date('2026-11-05T12:00:00');
const bk = (sm, id) => sm.split.buckets.find(b => b.id === id);

t('التقسيمة: كل بند في قسم واحد والمجموع يطابق المخطط', () => {
  const s = plan(), sm = C.summarize(s, '2026-10', nov5);
  assert.strictEqual(C.bucketOf(s, 'fixed', s.fixed.find(x => x.id === 'f-charity')), 'give');
  assert.strictEqual(C.bucketOf(s, 'fixed', s.fixed.find(x => x.id === 'f-uni')), 'commit');
  assert.strictEqual(C.bucketOf(s, 'goal', s.goals.find(x => x.id === 'g-emergency')), 'safety');
  assert.strictEqual(C.bucketOf(s, 'goal', s.goals.find(x => x.id === 'g-investment')), 'invest');
  assert.strictEqual(sm.split.plannedTotal, sm.outPlanned);
  assert.strictEqual(C.round2(sm.split.income - sm.split.plannedTotal), sm.split.free);
  const ids = sm.split.buckets.flatMap(b => b.items.map(i => i.kind + i.id));
  assert.strictEqual(new Set(ids).size, ids.length);
});

t('التقسيمة: المرحلة تتغير تلقائيًا لما تخلص المؤقتة والجامعة', () => {
  const s = plan();
  assert.strictEqual(C.summarize(s, '2026-10', nov5).split.phase, 1);
  assert.strictEqual(C.summarize(s, '2027-04', nov5).split.phase, 2);
  s.settings.split.phase = 3;
  const sm = C.summarize(s, '2026-10', nov5);
  assert.strictEqual(sm.split.phase, 3); assert.strictEqual(sm.split.manualPhase, true);
});

t('التقسيمة: نقل بند لقسم ثاني ونسب مستهدفة خاصة', () => {
  const s = plan();
  s.settings.split.map['fixed:f-house'] = 'life';
  s.settings.split.targets[1] = { basics: 30, commit: 35, life: 13, safety: 21, invest: 0, give: 1 };
  const sm = C.summarize(s, '2026-10', nov5);
  assert.ok(bk(sm, 'life').items.some(i => i.id === 'f-house'));
  assert.ok(!bk(sm, 'basics').items.some(i => i.id === 'f-house'));
  assert.strictEqual(bk(sm, 'life').target, 13);
});

t('التقسيمة: تنبيه تجاوز القسم، والتكرار، والمتغير اللي هو نفس بند مخطط', () => {
  const s = plan();
  s.entries.push({ id: 'v1', kind: 'variable', ref: '', amount: 725, date: '2026-10-28', note: 'الجامعة' });
  s.entries.push({ id: 'd1', kind: 'debt', ref: 'dt193', amount: 194.8, date: '2026-10-27' }, { id: 'd2', kind: 'debt', ref: 'dt193', amount: 194.8, date: '2026-10-27' });
  s.entries.push({ id: 'p1', kind: 'fixed', ref: 'f-personal', amount: 1950, date: '2026-11-02' });
  const sm = C.summarize(s, '2026-10', nov5), A = sm.split.alerts;
  assert.strictEqual(bk(sm, 'life').level, 'over');
  assert.ok(A.some(a => a.level === 'bad' && a.bucket === 'life'));
  assert.ok(A.some(a => a.title.includes('عملية مكررة')));
  assert.ok(A.some(a => a.title.includes('«الجامعة» مسجل متغير')));
  assert.ok(A.some(a => a.bucket === 'basics' && a.title.includes('مصروفي الشخصي') && a.noBell));
  assert.ok(sm.insights.some(i => i.src === 'split' && i.title.includes('عملية مكررة')));
  assert.ok(!sm.insights.some(i => i.src === 'split' && i.title.startsWith('داخل')));
});

t('التقسيمة: اسم مكرر في بندين = تنبيه ممكن ينحسب مرتين', () => {
  const s = plan();
  s.debts.push({ id: 'dx', name: 'الجامعة', kind: 'temp', total: 725, remaining: 725, monthly: 725, bank: '', startCycle: '2026-10', schedule: [{ cycle: '2026-10', amount: 725 }], note: '' });
  const A = C.summarize(s, '2026-10', nov5).split.alerts;
  assert.ok(A.some(a => a.title.includes('«الجامعة» موجود 2 مرات')));
});

t('عدّاد المواسم: رمضان والعيد والأضحية بمواعيدها وتنبيه إذا المبلغ يكتمل متأخر', () => {
  const s = plan(), sm = C.summarize(s, '2026-10', nov5), se = sm.split.seasons;
  const r = se.find(x => x.id === 'g-ramadan'), a = se.find(x => x.id === 'g-adha');
  assert.strictEqual(r.targetDate, '2027-02-08'); assert.strictEqual(a.targetDate, '2027-05-16');
  assert.strictEqual(r.readyDate, '2027-01-27'); assert.strictEqual(r.leadDays, 12); assert.strictEqual(r.status, 'late');
  s.goals.find(g => g.id === 'g-ramadan').schedule = [{ cycle: '2026-10', amount: 700 }, { cycle: '2026-11', amount: 700 }, { cycle: '2026-12', amount: 600 }];
  const r2 = C.summarize(s, '2026-10', nov5).split.seasons.find(x => x.id === 'g-ramadan');
  assert.strictEqual(r2.status, 'ok'); assert.strictEqual(r2.leadDays, 43);
});

t('التقسيمة: إعدادات قديمة بدون split ما تكسر شيء', () => {
  const s = plan(); delete s.settings.split;
  const s2 = C.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(s2.settings.split, { map: {}, phase: 0, targets: {} });
  assert.ok(C.summarize(s2, '2026-10', nov5).split.buckets.length === 6);
});

/* ───────── الفائض المتراكم لكل بند ───────── */
const dec30 = new Date('2026-12-30T10:00:00');   // الدورة الحالية 2026-12، و10 و11 مقفلة
const ledgerOf = (s, today) => C.summarize(s, C.cycleOf(today, 27), today).split.surplus;
const it = (L, id) => L.items.find(x => x.id === id);
const seedL = () => { const s = seed(); s.settings.split.surplusStart = '2026-10'; return s; };   // كأن التطبيق انفتح أول مرة قبل بداية الخطة

t('الفائض: يبدأ من أول دورة في الخطة ولا يحسب قبلها', () => {
  const s = seed();
  assert.strictEqual(C.surplusStartOf(s, today), '2026-10');
  const L = C.summarize(s, '2026-10', today).split.surplus;   // اليوم قبل بداية الخطة
  assert.strictEqual(L.upTo, '2026-09'); assert.strictEqual(L.active, false); assert.strictEqual(L.pool, 0);
  assert.strictEqual(C.surplusStartOf(s, dec30), '2026-12');   // بدون نقطة محفوظة: من الدورة الحالية
  s.settings.split.surplusStart = '2026-10';
  assert.strictEqual(C.surplusStartOf(C.normalize(JSON.parse(JSON.stringify(s))), dec30), '2026-10');   // المحفوظة تبقى بعد الحفظ والتحميل
});

t('الفائض: يتراكم لكل بند عبر الدورات المقفلة', () => {
  const s = seedL();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 900, date: '2026-10-28' });
  s.entries.push({ id: 'b', kind: 'fixed', ref: 'f-house', amount: 950, date: '2026-11-28' });
  s.entries.push({ id: 'c', kind: 'fixed', ref: 'f-electric', amount: 420, date: '2026-11-05' });
  const L = ledgerOf(s, dec30);
  assert.strictEqual(it(L, 'f-house').balance, 150);
  assert.strictEqual(it(L, 'f-electric').balance, 80);
  assert.strictEqual(L.pool, 230);
});

t('الفائض: دورة ماضية بدون تسجيل = انصرف كما خُطط (ما يطلع فائض وهمي)', () => {
  const s = seedL();
  const L = ledgerOf(s, dec30);
  assert.strictEqual(L.pool, 0);
  assert.ok(L.items.every(x => x.balance === 0));
});

t('الفائض: الدورة المفتوحة ما تضيف فائض لين يتقفل البند', () => {
  const s = seedL();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 600, date: '2026-12-28' });
  let L = ledgerOf(s, dec30);
  assert.strictEqual(it(L, 'f-house').balance, 0);
  assert.strictEqual(L.pending, 400);
  s.closed['2026-12'] = { 'f-house': true };
  L = ledgerOf(s, dec30);
  assert.strictEqual(it(L, 'f-house').balance, 400);
  assert.strictEqual(L.pending, 0);
});

t('الفائض: التجاوز ينخصم من رصيد البند فورًا حتى والدورة مفتوحة', () => {
  const s = seedL();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 800, date: '2026-10-28' });    // +200
  s.entries.push({ id: 'b', kind: 'fixed', ref: 'f-house', amount: 1150, date: '2026-12-28' });   // −150 (مفتوحة)
  const L = ledgerOf(s, dec30);
  assert.strictEqual(it(L, 'f-house').balance, 50);
});

t('الفائض: عجز بند يغطيه الصندوق، وإذا الصندوق سالب ينبه', () => {
  const s = seedL();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 700, date: '2026-10-28' });     // +300
  s.entries.push({ id: 'b', kind: 'fixed', ref: 'f-electric', amount: 600, date: '2026-11-05' });  // −100
  let P = C.summarize(s, '2026-12', dec30).split;
  assert.strictEqual(P.surplus.pool, 200); assert.strictEqual(P.surplus.covered, true);
  assert.strictEqual(it(P.surplus, 'f-electric').level, 'neg');
  assert.ok(P.alerts.some(a => a.level === 'info' && a.title.includes('غطّى')));
  s.entries.push({ id: 'c', kind: 'fixed', ref: 'f-water', amount: 525, date: '2026-11-06' });     // −400
  P = C.summarize(s, '2026-12', dec30).split;
  assert.strictEqual(P.surplus.pool, -200); assert.strictEqual(P.surplus.covered, false);
  assert.ok(P.alerts.some(a => a.level === 'bad' && a.title.includes('بالسالب')));
});

t('الفائض: الالتزامات (الجامعة) والأهداف والديون ما لها فائض', () => {
  const s = seedL();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-uni', amount: 0.01, date: '2026-10-28' });
  const L = ledgerOf(s, dec30);
  assert.ok(!it(L, 'f-uni'));
  assert.ok(L.items.every(x => s.fixed.some(f => f.id === x.id)));
});

t('الفائض: ما ينضاف لأي هدف — مدخرات الطوارئ والاستثمار ما تتغير', () => {
  const s = seedL();
  const before = s.goals.map(g => C.goalSaved(s, g));
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 500, date: '2026-10-28' });
  ledgerOf(s, dec30);
  assert.deepStrictEqual(s.goals.map(g => C.goalSaved(s, g)), before);
});

t('الفائض: رصيد كل قسم = مجموع أرصدة بنوده، ودورة البداية تتعدل', () => {
  const s = seedL();
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-house', amount: 900, date: '2026-10-28' });
  s.entries.push({ id: 'b', kind: 'fixed', ref: 'f-entertainment', amount: 300, date: '2026-11-28' });
  let P = C.summarize(s, '2026-12', dec30).split;
  assert.strictEqual(P.buckets.find(b => b.id === 'basics').surplus, 100);
  assert.strictEqual(P.buckets.find(b => b.id === 'life').surplus, 200);
  assert.strictEqual(P.buckets.find(b => b.id === 'commit').surplus, null);
  s.settings.split.surplusStart = '2026-11';
  P = C.summarize(s, '2026-12', dec30).split;
  assert.strictEqual(P.surplus.pool, 200);
  // عرض دورة ماضية = الرصيد لين نهايتها
  assert.strictEqual(C.summarize(s, '2026-11', dec30).split.surplus.upTo, '2026-11');
});

/* ───────── المصروف اليومي ───────── */
t('اليومي: الشخصي ÷ أيام الدورة رقم صحيح، والصرف ينخصم من نفس المحفظة', () => {
  const s = C.applyRevision(seed());
  const now = new Date('2026-10-30T12:00:00');   // الدورة 2026-10: 31 يوم، اليوم الرابع
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-personal', amount: 100, date: '2026-10-28' });
  s.entries.push({ id: 'b', kind: 'fixed', ref: 'f-personal', amount: 20, date: '2026-10-30' });
  const sm = C.summarize(s, '2026-10', now);
  const d = sm.dailies.find(x => x.id === 'f-personal');
  assert.strictEqual(d.daily, 58); assert.strictEqual(d.spentToday, 20); assert.strictEqual(d.todayLeft, 38);
  assert.strictEqual(d.saved, 58 * 3 - 100);                                    // الباقي من الأيام اللي فاتت = فائض
  assert.strictEqual(sm.lines.fixed.find(l => l.id === 'f-personal').actual, 120);   // نفس الفلوس، ما ينحسب مرتين
  assert.strictEqual(sm.dailies.length, 1);
});
t('اليومي: يتغير تلقائيًا مع المبلغ الشهري، ويتفعّل ويتوقف لأي محفظة', () => {
  const s = C.applyRevision(seed());
  const now = new Date('2026-10-30T12:00:00');
  s.fixed.find(x => x.id === 'f-personal').amount = 1000;
  assert.strictEqual(C.summarize(s, '2026-10', now).dailies[0].daily, 32);      // 1000 ÷ 31
  s.fixed.find(x => x.id === 'f-house').daily = true;
  assert.deepStrictEqual(C.summarize(s, '2026-10', now).dailies.map(d => [d.id, d.daily]), [['f-personal', 32], ['f-house', 32]]);
  s.fixed.find(x => x.id === 'f-personal').daily = false;
  assert.deepStrictEqual(C.summarize(s, '2026-10', now).dailies.map(d => d.id), ['f-house']);
  assert.deepStrictEqual(C.summarize(s, '2026-11', now).dailies, []);           // الدورات الجاية ما لها يومي
});
t('اليومي: تعدّي اليوم يطلع أحمر', () => {
  const s = C.applyRevision(seed());
  const now = new Date('2026-10-30T12:00:00');
  s.entries.push({ id: 'a', kind: 'fixed', ref: 'f-personal', amount: 70, date: '2026-10-30' });
  const d = C.summarize(s, '2026-10', now).dailies[0];
  assert.strictEqual(d.todayLeft, -12); assert.strictEqual(d.level, 'over');
});

/* ───────── أقدر أصرفها؟ ───────── */
const csNow = new Date('2026-10-06T20:00:00');   // الدورة 2026-09 (30 يوم)، اليوم العاشر
const csState = () => { const s = C.applyRevision(seed()); s.entries.push({ id: 'p', kind: 'fixed', ref: 'f-personal', amount: 500, date: '2026-10-02' }); return s; };
t('أقدر أصرفها: داخل اليومي = اصرفها', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const v = C.canSpend(s, sm, 40, { kind: 'fixed', id: 'f-personal', daily: true }, csNow);
  assert.strictEqual(v.level, 'yes'); assert.strictEqual(v.excess, 0);
  assert.ok(v.notes[0].text.includes('يبقى لك اليوم 20'));
});
t('أقدر أصرفها: فوق اليومي = انتبه، ويحسب يومك الجديد', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const v = C.canSpend(s, sm, 100, { kind: 'fixed', id: 'f-personal', daily: true }, csNow);
  assert.strictEqual(v.level, 'careful');
  assert.ok(v.notes.some(n => n.text.includes('بدل 60')));
  assert.strictEqual(v.surplusAfter, v.surplusBefore);   // داخل الشهري، الفائض ما يتأثر
});
t('أقدر أصرفها: يتعدى المحفظة = لا، والفائض ينزل', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const v = C.canSpend(s, sm, 1500, { kind: 'fixed', id: 'f-personal', daily: true }, csNow);
  assert.strictEqual(v.level, 'no'); assert.strictEqual(v.excess, 200);
  assert.strictEqual(v.surplusAfter, C.round2(v.surplusBefore - 200));
});
t('أقدر أصرفها: متغير كبير يدخل عجز = لا، وصغير = اصرفها', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const big = C.canSpend(s, sm, sm.projectedSurplus + 100, { kind: 'variable' }, csNow);
  assert.strictEqual(big.level, 'no'); assert.ok(big.notes.some(n => n.text.includes('عجز 100')));
  const small = C.canSpend(s, sm, 20, { kind: 'variable' }, csNow);
  assert.strictEqual(small.level, 'yes');
  assert.strictEqual(C.canSpend(s, sm, 0, { kind: 'variable' }, csNow), null);
});
t('أقدر أصرفها: يذكّرك بصرف «رغبة» هالدورة، والرغبات تبقى بعد الحفظ', () => {
  const s = csState();
  s.entries.push({ id: 'w', kind: 'variable', ref: '', amount: 80, date: '2026-10-05', reason: 'want' });
  s.wishes.push({ id: 'x', amount: 150, note: 'سماعة', src: { kind: 'variable' }, created: '2026-10-06', remindAt: '2026-10-08', status: 'wait' });
  const v = C.canSpend(s, C.summarize(s, '2026-09', csNow), 20, { kind: 'variable' }, csNow);
  assert.ok(v.notes.some(n => n.text.includes('رغبة') && n.text.includes('80')));
  assert.strictEqual(C.normalize(JSON.parse(JSON.stringify(s))).wishes.length, 1);
  assert.deepStrictEqual(C.normalize({}).wishes, []);
});

t('أقدر أصرفها: من الادخار — الطوارئ = لا، والسحب ينقص المدخر', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const g = s.goals.find(x => x.emergency), saved = C.goalSaved(s, g);
  const v = C.canSpend(s, sm, 300, { kind: 'goal', id: g.id }, csNow);
  assert.strictEqual(v.level, 'no'); assert.ok(v.notes.some(n => n.text.includes('الطوارئ')));
  s.entries.push({ id: 'w1', kind: 'withdraw', from: 'goal', ref: g.id, amount: 300, date: '2026-10-06' });
  assert.strictEqual(C.goalSaved(s, g), C.round2(saved - 300));
  assert.strictEqual(C.itemName(s, 'withdraw', g.id), 'سحب من «' + g.name + '»');
});
t('أقدر أصرفها: هدف له موعد يحسب كم تعوّض مع كل راتب', () => {
  const s = csState();
  const g = s.goals.find(x => x.id === 'g-ramadan');
  s.entries.push({ id: 'r', kind: 'goal', ref: g.id, amount: 600, date: '2026-10-01' });
  const v = C.canSpend(s, C.summarize(s, '2026-09', csNow), 300, { kind: 'goal', id: g.id }, csNow);
  assert.ok(['careful', 'no'].includes(v.level));
  assert.ok(v.notes.some(n => n.text.includes('تعوّض 300')));
});
t('أقدر أصرفها: صندوق الفوائض مصدر، والسحب منه ينقص الصندوق', () => {
  const s = csState(); s.settings.split.surplusStart = '2026-08';
  s.fixed.find(x => x.id === 'f-house').startCycle = '2026-08';
  s.entries.push({ id: 'h', kind: 'fixed', ref: 'f-house', amount: 400, date: '2026-08-28' });   // +600 في الصندوق
  let sm = C.summarize(s, '2026-09', csNow);
  assert.strictEqual(sm.split.surplus.pool, 600);
  assert.strictEqual(C.canSpend(s, sm, 300, { kind: 'fund' }, csNow).level, 'yes');
  assert.strictEqual(C.canSpend(s, sm, 700, { kind: 'fund' }, csNow).level, 'no');
  s.entries.push({ id: 'f', kind: 'withdraw', from: 'fund', ref: '', amount: 300, date: '2026-10-06' });
  sm = C.summarize(s, '2026-09', csNow);
  assert.strictEqual(sm.split.surplus.pool, 300); assert.strictEqual(sm.split.surplus.drawn, 300);
  assert.strictEqual(sm.totals.variable.actual, 0);   // السحب من الصندوق ما ينخصم من راتب هالشهر
});
t('أقدر أصرفها: لما الحكم مو «اصرفها» يعطي حلول وخطة', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const v = C.canSpend(s, sm, 1500, { kind: 'fixed', id: 'f-personal', daily: true }, csNow);
  assert.strictEqual(v.level, 'no');
  assert.ok(v.plans.length >= 1 && v.plans.length <= 3);
  assert.ok(v.plans.every(p => p.title && p.text && p.action));
  assert.ok(v.plans.some(p => p.key === 'swap'));   // الخطة ضيقة: يبدّلها بالترفيه
  assert.deepStrictEqual(C.canSpend(s, sm, 20, { kind: 'variable' }, csNow).plans, []);
});
t('خطة «بدّلها»: هدف بجدول، والترفيه ينقص بنفس المبلغ، والفائض ما يتغير', () => {
  const s = csState(), sm = C.summarize(s, '2026-09', csNow);
  const before = ['2026-10', '2026-11'].map(c => C.summarize(s, c, csNow).planSurplus);
  const plan = C.canSpend(s, sm, 1500, { kind: 'variable' }, csNow).plans.find(p => p.key === 'swap');
  assert.ok(plan, 'فيه خطة بدّلها');
  const g = C.applySpendPlan(s, plan, 'سماعة', csNow);
  assert.strictEqual(g.target, C.round2(plan.action.schedule.reduce((a, r) => a + r.amount, 0)));
  assert.strictEqual(C.bucketOf(s, 'goal', g), 'life');
  const after = ['2026-10', '2026-11'].map(c => C.summarize(s, c, csNow).planSurplus);
  assert.deepStrictEqual(after, before);   // نقص الترفيه = دفعة الهدف
  const first = plan.action.schedule[0];
  assert.strictEqual(C.plannedFor(s, 'fixed', s.fixed.find(x => x.id === plan.action.id), first.cycle), 500 - first.amount);
});

console.log(`\n${n} اختبار ناجح`);
