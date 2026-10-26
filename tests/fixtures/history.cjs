// سجل خطة خالد القديم (البيانات الأساسية + المراجعات ب–ز) — للاختبارات بس.
// انتقل من mali9-core.js عشان أرقام خالد ما تنشر في الملفات العامة. ما ينسحب للموقع (.vercelignore).
const C = require('../../mali9-core.js');
const { emptyState, round2, sum } = C;
const FLEXIBLE = ['f-personal'];

/* بيانات خالد المعتمدة (تستخدم فقط إذا ما فيه بيانات سابقة على الجهاز). */
function seedState() {
  const s = emptyState();
  s.settings.planStart = '2026-10';
  s.settings.name = 'خالد';
  s.settings.cardMap = { '8398': 'snb', '0679': 'urpay', '4800': 'vision' };
  s.income = [
    { id: 'i-salary', name: 'الراتب', amount: 13780, confirmed: true, bank: '', startCycle: '2026-10' },
    { id: 'i-citizen', name: 'حساب المواطن', amount: 400, confirmed: false, bank: '', startCycle: '2026-10' }
  ];
  s.fixed = [
    ['f-house', 'مصروف البيت', 1000, 'urpay'], ['f-kids', 'مصروف العيال', 900, 'vision'], ['f-wife', 'الزوجة', 400, 'rajhi'],
    ['f-mobile', 'الجوال', 500, ''], ['f-wife-mobile', 'جوال الزوجة', 200, 'stc'], ['f-electric', 'الكهرباء', 500, 'jazira'],
    ['f-water', 'الماء', 125, 'jazira'], ['f-uni', 'الجامعة', 725, 'sadad'], ['f-personal', 'مصروفي الشخصي والبنزين', 1800, 'snb'],
    ['f-charity', 'الصدقة', 200, 'ehsan'], ['f-entertainment', 'الترفيه', 500, 'snb']
  ].map(([id, name, amount, bank]) => ({ id, name, amount, bank, flexible: FLEXIBLE.includes(id), startCycle: '2026-10', endCycle: '', note: '' }));
  s.debts = [
    { id: 'd1', name: 'القرض الرئيسي', kind: 'fixed', total: 98000, remaining: 98000, monthly: 2887.24, bank: '', startCycle: '2026-10', schedule: [] },
    { id: 'd2', name: 'القرض الثاني', kind: 'fixed', total: 5000, remaining: 5000, monthly: 98, bank: '', startCycle: '2026-10', schedule: [] },
    { id: 'd3', name: 'القرض الثالث', kind: 'fixed', total: 2880, remaining: 2880, monthly: 237, bank: 'emkan', startCycle: '2026-10', schedule: [] },
    { id: 'dt193', name: 'تابي', kind: 'temp', total: 585, remaining: 585, monthly: 195, bank: 'tabby', startCycle: '2026-10', schedule: [{ cycle: '2026-10', amount: 195 }, { cycle: '2026-11', amount: 195 }, { cycle: '2026-12', amount: 195 }] },
    { id: 'dtickets', name: 'التذاكر', kind: 'temp', total: 1410, remaining: 1132, monthly: 283, bank: '', startCycle: '2026-10', schedule: [{ cycle: '2026-10', amount: 283 }, { cycle: '2026-11', amount: 283 }, { cycle: '2026-12', amount: 283 }, { cycle: '2027-01', amount: 283 }] },
    { id: 'dtamara152', name: 'تمارا 159', kind: 'temp', total: 456, remaining: 159, monthly: 159, bank: 'tamara', startCycle: '2026-10', schedule: [{ cycle: '2026-10', amount: 159 }] },
    { id: 'dtamara73', name: 'تمارا 73', kind: 'temp', total: 146, remaining: 146, monthly: 73, bank: 'tamara', startCycle: '2026-10', schedule: [{ cycle: '2026-10', amount: 73 }, { cycle: '2026-11', amount: 73 }] }
  ].map(d => Object.assign({ note: '' }, d));
  s.goals = [
    { id: 'g-emergency', name: 'الطوارئ', icon: '🛟', target: 15000, saved: 1000, monthly: 1000, startCycle: '2026-10', targetDate: '', active: true, emergency: true, bank: '', schedule: [] },
    { id: 'g-majlis', name: 'المجلس', icon: '🛋️', target: 3500, saved: 0, monthly: 1500, startCycle: '2026-10', targetDate: '', active: true, bank: 'bilad', schedule: [{ cycle: '2026-10', amount: 1500 }, { cycle: '2026-11', amount: 1500 }, { cycle: '2026-12', amount: 500 }] },
    { id: 'g-ramadan', name: 'رمضان والعيد', icon: '🌙', target: 2000, saved: 0, monthly: 300, startCycle: '2026-10', targetDate: '2027-02-08', active: true, bank: '', schedule: [{ cycle: '2026-10', amount: 300 }, { cycle: '2026-11', amount: 300 }, { cycle: '2026-12', amount: 700 }, { cycle: '2027-01', amount: 700 }] },
    { id: 'g-adha', name: 'الأضحية', icon: '🐑', target: 1500, saved: 0, monthly: 0, startCycle: '2026-10', targetDate: '2027-05-16', active: true, bank: '', schedule: [] },
    { id: 'g-investment', name: 'الاستثمار', icon: '📈', target: 0, saved: 0, monthly: 300, startCycle: '2026-12', targetDate: '', active: true, bank: '', schedule: [{ cycle: '2026-12', amount: 100 }, { cycle: '2027-01', amount: 100 }] },
    { id: 'g-travel', name: 'السفر', icon: '✈️', target: 12000, saved: 0, monthly: 0, startCycle: '', targetDate: '', active: false, bank: '', schedule: [], note: 'نراجعه بعد عيد الأضحى' }
  ].map(g => Object.assign({ note: '', emergency: false }, g));
  return s;
}

/* ───────── تحديث الخطة بتعليمات خالد (يُطبَّق مرة وحدة، ويحفظ ما سُجّل فعليًا) ───────── */
function revB(s) {
  const up = (arr, id, data, defaults) => {
    let x = arr.find(v => v.id === id);
    if (!x) { x = Object.assign({ id }, defaults || {}); arr.push(x); }
    Object.assign(x, data);
    return x;
  };
  const start = '2026-10';
  s.settings.planStart = start;
  up(s.income, 'i-salary', { name: 'الراتب', amount: 13378, confirmed: true, startCycle: start }, { bank: 'snb' });
  up(s.income, 'i-citizen', { name: 'حساب المواطن', amount: 400, confirmed: true, startCycle: start, note: 'مصروف العيال يعتمد عليه (400 من 900)' }, { bank: '' });
  const fx = { startCycle: start, endCycle: '' };
  const F = (id, name, amount, extra = {}) => up(s.fixed, id, Object.assign({ name, amount, note: '', confirm: false, endCycle: '' }, extra), Object.assign({ bank: '', flexible: false }, fx));
  F('f-house', 'البيت', 1000, { flexible: true });
  F('f-kids', 'العيال', 900, { flexible: true, note: '500 من الراتب + 400 من حساب المواطن' });
  F('f-wife', 'الزوجة', 400);
  F('f-mobile', 'جوالي', 500);
  F('f-wife-mobile', 'جوال الزوجة', 200);
  F('f-electric', 'الكهرباء', 500);
  F('f-water', 'الماء / الوايت', 125);
  F('f-uni', 'الجامعة', 725, { endCycle: '2027-04', note: 'نحو 7 دفعات (أكتوبر–أبريل) — تقديري' });
  F('f-personal', 'مصروفي الشخصي والبنزين', 1800, { flexible: true });
  F('f-entertainment', 'الترفيه', 500, { flexible: true });
  F('f-charity', 'الصدقة', 150);
  for (const x of s.fixed) if (!x.startCycle || x.startCycle < start) x.startCycle = start;
  // الأرصدة الفعلية للأهداف صفر حسب تأكيد خالد (التحويلات القديمة تبقى في السجل بدون ما تُحسب)
  for (const g of s.goals) g.saved = 0;
  s.debts = s.debts.filter(d => d.id !== 'dac');
  const D = (id, data, def) => up(s.debts, id, data, Object.assign({ total: 0, remaining: 0, bank: '', startCycle: start, schedule: [], note: '' }, def));
  D('d1', { name: 'القرض الرئيسي', kind: 'fixed', monthly: 2887.24, note: 'الرصيد قديم (نحو 98,000) — يحتاج تحديث' }, { total: 98000, remaining: 98000 });
  D('d2', { name: 'القرض الثاني', kind: 'fixed', monthly: 98, note: 'الرصيد قديم — يحتاج تحديث' }, { total: 5000, remaining: 5000 });
  D('d3', { name: 'القرض الثالث', kind: 'fixed', monthly: 237, note: 'الرصيد قديم — يحتاج تحديث' }, { total: 2880, remaining: 2880 });
  for (const id of ['d1', 'd2', 'd3']) { const d = s.debts.find(x => x.id === id); if (d && !d.bank) d.bank = 'snb'; }
  const sch = (cycles, amount) => cycles.map(cycle => ({ cycle, amount }));
  D('dt193', { name: 'تابي', kind: 'temp', monthly: 195, schedule: sch(['2026-10', '2026-11', '2026-12'], 195) }, { total: 585, remaining: 585, bank: 'tabby' });
  D('dtamara152', { name: 'تمارا 159', kind: 'temp', monthly: 159, schedule: sch(['2026-10'], 159) }, { total: 159, remaining: 159, bank: 'tamara' });
  D('dtamara73', { name: 'تمارا 73', kind: 'temp', monthly: 73, schedule: sch(['2026-10', '2026-11'], 73) }, { total: 146, remaining: 146, bank: 'tamara' });
  D('dtickets', { name: 'التذاكر', kind: 'temp', monthly: 283, schedule: sch(['2026-10', '2026-11', '2026-12', '2027-01'], 283) }, { total: 1132, remaining: 1132 });
  const G = (id, data, def) => up(s.goals, id, data, Object.assign({ icon: '🎯', saved: 0, bank: '', schedule: [], targetDate: '', emergency: false, note: '' }, def));
  G('g-emergency', { name: 'الطوارئ', target: 15000, monthly: 1000, startCycle: start, active: true, emergency: true, schedule: [], note: '' }, { icon: '🛟', bank: 'bilad' });
  G('g-majlis', { name: 'مجلس النساء', target: 3500, monthly: 1500, startCycle: start, active: true, schedule: [{ cycle: '2026-10', amount: 1500 }, { cycle: '2026-11', amount: 1500 }, { cycle: '2026-12', amount: 500 }], note: '' }, { icon: '🛋️', bank: 'bilad' });
  G('g-ramadan', { name: 'رمضان وعيد الفطر', target: 2000, monthly: 0, startCycle: start, targetDate: '2027-02-08', active: true, schedule: [{ cycle: '2026-10', amount: 300 }, { cycle: '2026-11', amount: 300 }, { cycle: '2026-12', amount: 700 }, { cycle: '2027-01', amount: 700 }], note: 'التمويل ينتهي قبل رمضان' }, { icon: '🌙' });
  G('g-investment', { name: 'الاستثمار', target: 0, monthly: 300, startCycle: '2026-12', active: true, schedule: [{ cycle: '2026-12', amount: 100 }, { cycle: '2027-01', amount: 100 }], note: 'مساهمات فقط بدون افتراض أرباح' }, { icon: '📈' });
  // يبدأ بعد انتهاء تمويل رمضان (فبراير) لما يرتفع الفائض، ويكتمل قبل العيد براتب أبريل
  G('g-adha', { name: 'الأضحية', target: 1500, monthly: 0, active: true, startCycle: '2027-02', targetDate: '2027-05-16', schedule: [{ cycle: '2027-02', amount: 500 }, { cycle: '2027-03', amount: 500 }, { cycle: '2027-04', amount: 500 }], note: 'اخترنا فبراير–أبريل لأن الفائض فيها أعلى' }, { icon: '🐑' });
  G(s.goals.some(g => g.id === 'g-istanbul') ? 'g-istanbul' : 'g-travel', { name: 'السفر', target: 12000, monthly: 0, active: false, schedule: [], note: 'مؤجل للمراجعة بعد عيد الأضحى' }, { icon: '✈️', startCycle: '' });
  s.goals = s.goals.filter(g => g.id !== 'g-house'); // هدف البيت القديم غير معرّف — ألغي بطلب خالد
  return s;
}

/* مراجعة 4 أكتوبر (ج): أرقام خالد المؤكدة من الصراف والتطبيقات + خطة الموسميات والطوارئ */
function revC(s) {
  const up = (arr, id, data, defaults) => {
    let x = arr.find(v => v.id === id);
    if (!x) { x = Object.assign({ id }, defaults || {}); arr.push(x); }
    Object.assign(x, data);
    return x;
  };
  const start = '2026-10';
  const sch = list => list.map(([cycle, amount]) => ({ cycle, amount }));
  // المتبقي المؤكد اليوم؛ نضيف ما سُجل من دفعات حتى لا تنخصم مرة ثانية
  const paid = id => sum(s.entries.filter(e => e.kind === 'debt' && e.ref === id && !e.legacy), e => e.amount);
  up(s.income, 'i-salary', { name: 'الراتب', amount: 13378, confirmed: true, note: 'كما ينزل في الصراف' }, { bank: 'snb', startCycle: start });
  up(s.income, 'i-citizen', { name: 'حساب المواطن', amount: 400, confirmed: true, note: 'يروح لمصروف العيال (400 من 900)' }, { bank: '', startCycle: start });
  const F = (id, data, def) => up(s.fixed, id, data, Object.assign({ bank: '', flexible: false, startCycle: start, endCycle: '', note: '' }, def));
  F('f-mobile', { name: 'جوالي', amount: 650, note: 'الأساسي 264.5 + أقساط جوالين وساعة' });
  F('f-uni', { name: 'الجامعة', amount: 725, endCycle: '2027-03', note: 'باقي 6 دفعات (أكتوبر–مارس)' });
  F('f-kids', { name: 'العيال', amount: 900, note: '500 من الراتب + 400 من حساب المواطن' }, { flexible: true });
  F('f-charity', { name: 'الصدقة', amount: 150 });
  F('f-entertainment', { name: 'الترفيه', amount: 500 }, { flexible: true });
  const D = (id, data, def) => {
    const d = up(s.debts, id, data, Object.assign({ bank: '', startCycle: start, schedule: [], note: '' }, def));
    d.remaining = round2(data.remaining + paid(id));
    return d;
  };
  D('d1', { name: 'القرض الرئيسي', kind: 'fixed', monthly: 2887.24, remaining: 95278.75, total: 98000, note: 'المتبقي محدث 4 أكتوبر' });
  D('d2', { name: 'القرض الثاني', kind: 'fixed', monthly: 97.36, remaining: 4380, total: 5000, note: 'المتبقي محدث 4 أكتوبر' });
  D('d3', { name: 'القرض الثالث', kind: 'fixed', monthly: 237, remaining: 2880, total: 2880, note: 'المتبقي تقريبي — يخلص بعد سنة تقريبًا' });
  D('dt193', { name: 'تابي 195', kind: 'temp', monthly: 194.8, remaining: 584.4, total: 584.4, bank: 'tabby', schedule: sch([['2026-10', 194.8], ['2026-11', 194.8], ['2026-12', 194.8]]) });
  D('dtickets', { name: 'تابي 283', kind: 'temp', monthly: 282.51, remaining: 1130.04, total: 1130.04, bank: 'tabby', schedule: sch([['2026-10', 282.51], ['2026-11', 282.51], ['2026-12', 282.51], ['2027-01', 282.51]]) });
  D('dtamara152', { name: 'تمارا 158', kind: 'temp', monthly: 158.48, remaining: 158.48, total: 158.48, bank: 'tamara', schedule: sch([['2026-10', 158.48]]) });
  D('dtamara73', { name: 'تمارا 73', kind: 'temp', monthly: 72.67, remaining: 145.34, total: 145.34, bank: 'tamara', schedule: sch([['2026-10', 72.67], ['2026-11', 72.67]]) });
  D('d-maid', { name: 'راتب الشغالة المتأخر', kind: 'temp', monthly: 600, remaining: 600, total: 600, schedule: sch([['2026-10', 600]]), note: 'أول شي يتسدد من راتب أكتوبر' });
  const G = (id, data, def) => up(s.goals, id, Object.assign({ active: true }, data), Object.assign({ icon: '🎯', saved: 0, bank: '', emergency: false, note: '', startCycle: start, targetDate: '' }, def));
  // التقسيمة: المجلس يتوزع على راتبين لأن راتب أكتوبر ما يغطي 3,000 مع الشغالة والجامعة
  G('g-majlis', { name: 'مجلس النساء', target: 3000, monthly: 0, targetDate: '', schedule: sch([['2026-10', 2250], ['2026-11', 750]]), note: 'التكلفة 3,000 — 2,250 من راتب أكتوبر و750 من نوفمبر' }, { icon: '🛋️' });
  G('g-ramadan', { name: 'رمضان', target: 2000, monthly: 0, targetDate: '2027-02-08', schedule: sch([['2026-11', 700], ['2026-12', 700], ['2027-01', 600]]), note: 'فوق مصروف البيت — يكتمل قبل رمضان' }, { icon: '🌙' });
  G('g-eid', { name: 'ملابس العيد', target: 2000, monthly: 0, targetDate: '2027-03-09', schedule: sch([['2027-01', 1000], ['2027-02', 1000]]), note: 'للعيال والزوجة — راتب فبراير ينزل قبل العيد' }, { icon: '👗' });
  G('g-adha', { name: 'الأضحية', target: 1500, monthly: 0, startCycle: '2027-03', targetDate: '2027-05-16', schedule: sch([['2027-03', 750], ['2027-04', 750]]), note: 'تبدأ بعد رمضان' }, { icon: '🐑' });
  G('g-emergency', { name: 'الطوارئ', target: 23000, monthly: 1790, emergency: true, schedule: sch([['2026-10', 0], ['2026-11', 1600], ['2026-12', 2400], ['2027-01', 1700], ['2027-02', 2600], ['2027-03', 2850]]), note: 'أول محطة 10,000 (مارس) ثم نكمل لـ 3 شهور مصاريف — حساب منفصل بدون بطاقة' }, { icon: '🛟', bank: 'bilad' });
  G('g-investment', { name: 'رأس مال المشروع', target: 3000, monthly: 1790, startCycle: '2027-04', schedule: [], note: 'يبدأ بعد ما تتعدى الطوارئ 10,000 — لتجربة الاستيراد' }, { icon: '📈' });
  return s;
}

/* مراجعة (د): المجلس بالتساوي على راتبين حتى ما يضغط راتب أكتوبر، وبداية طوارئ من أكتوبر */
function revD(s) {
  const sch = list => list.map(([cycle, amount]) => ({ cycle, amount }));
  const majlis = s.goals.find(g => g.id === 'g-majlis');
  if (majlis) Object.assign(majlis, { schedule: sch([['2026-10', 1500], ['2026-11', 1500]]), note: 'التكلفة 3,000 — 1,500 من راتب أكتوبر و1,500 من نوفمبر' });
  const em = s.goals.find(g => g.id === 'g-emergency');
  if (em) {
    const rest = (em.schedule || []).filter(r => r.cycle !== '2026-10' && r.cycle !== '2026-11');
    em.schedule = [...sch([['2026-10', 500], ['2026-11', 850]]), ...rest].sort((a, b) => a.cycle.localeCompare(b.cycle));
  }
  return s;
}

/* مراجعة (هـ): نبدأ الشغل على راتب سبتمبر الحالي بنفس البنود الشهرية (الديون والأهداف تبقى من أكتوبر) */
function revE(s) {
  const start = '2026-09';
  const ids = ['f-house', 'f-kids', 'f-wife', 'f-mobile', 'f-wife-mobile', 'f-electric', 'f-water', 'f-uni', 'f-personal', 'f-charity', 'f-entertainment'];
  for (const x of s.fixed) if (ids.includes(x.id) && (!x.startCycle || x.startCycle > start)) x.startCycle = start;
  for (const x of s.income) if (!x.startCycle || x.startCycle > start) x.startCycle = start;
  s.settings.planStart = start;
  return s;
}

/* مراجعة (و): الحساب اليومي للمصروف الشخصي فقط؛ البيت والعيال والترفيه مبالغ شهرية عادية */
function revF(s) {
  for (const x of s.fixed) {
    if (x.id === 'f-personal') x.flexible = true;
    else if (['f-house', 'f-kids', 'f-entertainment'].includes(x.id)) x.flexible = false;
  }
  return s;
}

/* مراجعة (ز) 26 أكتوبر: القرض الثالث (237) انسدد وجاه قرض جديد 447 × 60 دفعة من راتب أكتوبر.
 ملابس العيد تنشرى قبل رمضان فتكتمل من راتب ديسمبر، ورمضان يكتمل من راتب يناير.
 زيادة القسط (210) تنخصم من الطوارئ، والجداول كلها تتعدل من التطبيق. */
function revG(s) {
  const sch = list => list.map(([cycle, amount]) => ({ cycle, amount }));
  const start = '2026-10';
  const d3 = s.debts.find(d => d.id === 'd3');
  if (d3) {
    // المتبقي = اللي انسجل من دفعاته، فيصير الباقي صفر بدون ما نلمس السجل
    const paid = sum(s.entries.filter(e => e.kind === 'debt' && e.ref === 'd3' && !e.legacy), e => e.amount);
    Object.assign(d3, { remaining: paid, endCycle: '2026-09', note: 'انسدد بالكامل — أكتوبر 2026' });
  }
  if (!s.debts.some(d => d.id === 'd4')) {
    s.debts.push({ id: 'd4', name: 'القرض الجديد', kind: 'fixed', total: 26820, remaining: 26820, monthly: 447, bank: '', startCycle: start, endCycle: '', schedule: [], note: '60 دفعة × 447 تبدأ مع راتب أكتوبر 2026' });
  }
  const goal = id => s.goals.find(g => g.id === id);
  const ram = goal('g-ramadan');
  if (ram) Object.assign(ram, { active: true, targetDate: '2027-02-08', schedule: sch([['2026-11', 700], ['2026-12', 700], ['2027-01', 600]]), note: 'المقاضي دفعة وحدة — يكتمل 19 شعبان وتشتري آخر شعبان' });
  const eid = goal('g-eid');
  if (eid) Object.assign(eid, { active: true, targetDate: '2027-02-08', schedule: sch([['2026-12', 2000]]), note: 'للعيال والزوجة — تنشرى قبل رمضان، تكتمل 18 رجب' });
  const em = goal('g-emergency');
  if (em) {
    const mine = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
    const rest = (em.schedule || []).filter(r => !mine.includes(r.cycle));
    em.schedule = [...sch([['2026-10', 290], ['2026-11', 640], ['2026-12', 190], ['2027-01', 2490], ['2027-02', 3390], ['2027-03', 2640]]), ...rest].sort((a, b) => a.cycle.localeCompare(b.cycle));
    em.monthly = 1580;
    em.note = 'زيادة القسط (210) تنخصم من هنا — أول محطة 10,000 تقريبًا أبريل';
  }
  return s;
}

const REVISIONS = [['plan-2026-10-04b', revB], ['plan-2026-10-04c', revC], ['plan-2026-10-04d', revD], ['plan-2026-10-05e', revE], ['plan-2026-10-05f', revF], ['plan-2026-10-26g', revG]];
// يطبق المراجعات القديمة مثل ما كانت تنطبق على جوال خالد
const apply = s => C.applyRevision(s, REVISIONS);
module.exports = { seedState, REVISIONS, apply };
