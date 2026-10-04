/* مالي V9 — محرك الحسابات (بدون واجهة). يعمل في المتصفح وفي Node للاختبار. */
(function (root) {
  'use strict';

  const VERSION = '9.1.0';
  const STORE_KEY = 'mali-v9';
  const LEGACY_KEY = 'mali-v4';

  /* ───────── البنوك والجهات ───────── */
  const BANKS = [
    { id: 'urpay', name: 'يوربي', color: '#6d28d9' },
    { id: 'vision', name: 'بنك فيجن', color: '#0ea5e9' },
    { id: 'rajhi', name: 'الراجحي', color: '#1d4ed8' },
    { id: 'stc', name: 'STC Bank', color: '#7c3aed' },
    { id: 'jazira', name: 'بنك الجزيرة', color: '#0f766e' },
    { id: 'sadad', name: 'سداد / تحويل', color: '#64748b' },
    { id: 'snb', name: 'الأهلي', color: '#047857' },
    { id: 'ehsan', name: 'إحسان', color: '#15803d' },
    { id: 'emkan', name: 'إمكان', color: '#b45309' },
    { id: 'tabby', name: 'تابي', color: '#16a34a' },
    { id: 'tamara', name: 'تمارا', color: '#db2777' },
    { id: 'bilad', name: 'بنك البلاد', color: '#c2410c' },
    { id: 'mobilypay', name: 'موبايلي باي', color: '#0891b2' },
    { id: 'd360', name: 'D360', color: '#111827' }
  ];
  const LEGACY_BANK_MAP = { urpay: 'urpay', vision: 'vision', rajhiTransfer: 'rajhi', stc: 'stc', jazira: 'jazira', sadad: 'sadad', snb: 'snb', ehsan: 'ehsan', emkan: 'emkan', tabby: 'tabby', tamara: 'tamara', bilad: 'bilad', mobilyPay: 'mobilypay' };

  /* ───────── الثيمات ───────── */
  const THEMES = [
    { id: 'emerald', name: 'زمردي', accent: '#10b981' },
    { id: 'gold', name: 'ذهبي', accent: '#d4a017' },
    { id: 'ocean', name: 'أزرق', accent: '#3b82f6' },
    { id: 'violet', name: 'بنفسجي', accent: '#8b5cf6' },
    { id: 'rose', name: 'وردي', accent: '#e11d74' },
    { id: 'sunset', name: 'برتقالي', accent: '#f97316' }
  ];

  /* ───────── أدوات ───────── */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const sum = (arr, f) => round2(arr.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0));
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-based

  /* ───────── دورة الراتب ─────────
     الدورة "YYYY-MM" تبدأ يوم الراتب من ذلك الشهر وتنتهي قبل يوم الراتب التالي. */
  function cycleStart(cycle, salaryDay) {
    const [y, m] = cycle.split('-').map(Number);
    return new Date(y, m - 1, Math.min(salaryDay, daysInMonth(y, m - 1)));
  }
  function cycleEnd(cycle, salaryDay) {
    const next = cycleStart(shiftCycle(cycle, 1), salaryDay);
    next.setDate(next.getDate() - 1);
    return next;
  }
  function shiftCycle(cycle, n) {
    const [y, m] = cycle.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function cycleOf(date, salaryDay) {
    const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
    const c = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    return d < cycleStart(c, salaryDay) ? shiftCycle(c, -1) : c;
  }
  function cyclesBetween(a, b) { // عدد الدورات من a إلى b (b بعد a)
    const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }

  /* ───────── الحالة الافتراضية ───────── */
  function defaultSettings() {
    return {
      name: 'خالد',
      salaryDay: 27,
      theme: 'emerald',
      accent: '',
      mode: 'auto',
      hideAmounts: false,
      hijri: true,
      planStart: '',
      customBanks: [],
      // حدود تقييم الوضع (قابلة للتعديل). القيم مأخوذة من قواعد الميزانية الشائعة.
      rules: { savingsGood: 20, savingsOk: 10, dtiGood: 33, dtiBad: 45, emergencyMonths: 3, bufferGood: 5 }
    };
  }

  function emptyState() {
    return { v: 9, settings: defaultSettings(), income: [], fixed: [], debts: [], goals: [], entries: [], overrides: {}, closed: {}, migratedFrom: '' };
  }

  // بنود تُصرف على دفعات خلال الشهر (ميزانية مرنة) — تُراقب سرعة الصرف فيها
  const FLEXIBLE = ['f-house', 'f-kids', 'f-personal', 'f-entertainment'];

  /* بيانات خالد المعتمدة (تستخدم فقط إذا ما فيه بيانات سابقة على الجهاز). */
  function seedState() {
    const s = emptyState();
    s.settings.planStart = '2026-10';
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

  /* ───────── الترحيل من النسخة القديمة (mali-v4) ───────── */
  function migrateLegacy(old) {
    const s = emptyState();
    const salaryDay = Number(old.settings && old.settings.salaryDay) || 27;
    s.settings.salaryDay = salaryDay;
    s.settings.hijri = old.settings ? old.settings.hijri !== false : true;
    s.migratedFrom = 'mali-v4 ' + (old.version || '');
    const custom = new Map();
    const bankOf = x => {
      if (!x || !x.bankProvider) return '';
      if (x.bankProvider === 'custom') {
        const name = String(x.bankName || 'جهة أخرى').slice(0, 40);
        if (!custom.has(name)) custom.set(name, 'c-' + (custom.size + 1));
        return custom.get(name);
      }
      return LEGACY_BANK_MAP[x.bankProvider] || '';
    };
    const cyc = date => date ? cycleOf(date, salaryDay) : '';
    const planStart = cyc(old.settings && old.settings.planStartDate);
    s.settings.planStart = planStart;
    const fromPlan = c => (planStart && (!c || c < planStart) ? planStart : c); // الخطة القديمة تبدأ من راتب محدد
    const ip = old.incomePlan || {};
    s.income = [
      { id: 'i-salary', name: 'الراتب', amount: Number(ip.salary) || 0, confirmed: true, bank: '', startCycle: planStart },
      { id: 'i-citizen', name: 'حساب المواطن', amount: Number(ip.citizen) || 0, confirmed: false, bank: '', startCycle: planStart }
    ];
    s.fixed = (old.fixed || []).map(x => ({ id: x.id, name: x.name, amount: Number(x.amount) || 0, bank: bankOf(x), flexible: FLEXIBLE.includes(x.id) || x.budgetKind === 'personal', startCycle: fromPlan(cyc(x.startDate)), endCycle: '', note: x.note || x.estimateNote || '' }));
    s.debts = (old.debts || []).map(x => {
      const schedule = Array.isArray(x.cycleSchedule) ? x.cycleSchedule.map(r => ({ cycle: r.cycle, amount: Number(r.amount) || 0 })) : [];
      const temp = schedule.length > 0 || (x.installments > 0 && x.installments <= 12 && !/قرض/.test(x.name));
      return { id: x.id, name: x.name, kind: temp ? 'temp' : 'fixed', total: Number(x.total) || 0, remaining: Number(x.remaining) || 0, monthly: Number(x.monthly) || 0, bank: bankOf(x), startCycle: cyc(x.dueDate) || cyc(old.settings && old.settings.planStartDate) || '', schedule, note: x.scheduleNote || '' };
    });
    const icons = { 'g-emergency': '🛟', 'g-house': '🏠', 'g-istanbul': '✈️', 'g-majlis': '🛋️', 'g-ramadan': '🌙', 'g-adha': '🐑', 'g-investment': '📈' };
    s.goals = (old.goals || []).map(g => ({
      id: g.id, name: g.name, icon: icons[g.id] || '🎯', target: Number(g.target) || 0, saved: Number(g.initial) || 0,
      monthly: Number(g.monthlyPlan) || 0, startCycle: cyc(g.planStartDate), targetDate: g.targetDate || '',
      active: g.fundingStatus !== 'paused', emergency: g.id === 'g-emergency', bank: bankOf(g),
      schedule: Array.isArray(g.cycleSchedule) ? g.cycleSchedule.map(r => ({ cycle: r.cycle, amount: Number(r.amount) || 0 })) : [],
      note: g.note || ''
    }));
    const fixedByName = new Map(s.fixed.map(x => [x.name, x.id]));
    for (const t of old.transactions || []) {
      const amount = Number(t.amount) || 0;
      if (!amount || !t.date) continue;
      const e = { id: t.id || uid(), date: t.date, amount, note: t.name || '', legacy: true };
      if (t.type === 'income') Object.assign(e, { kind: 'income', ref: t.incomeKind === 'salary' || t.name === 'الراتب' ? 'i-salary' : '' });
      else if (t.type === 'fixed_payment') Object.assign(e, { kind: 'fixed', ref: t.fixedId || fixedByName.get(t.name) || '' });
      else if (t.type === 'debt_payment') Object.assign(e, { kind: 'debt', ref: t.debtId && s.debts.some(d => d.id === t.debtId) ? t.debtId : '' });
      else if (t.type === 'vault') Object.assign(e, { kind: 'goal', ref: t.goalId || '' });
      else if (t.type === 'expense') Object.assign(e, t.budgetId || t.fixedId ? { kind: 'fixed', ref: t.budgetId || t.fixedId } : { kind: 'variable', ref: '' });
      else continue;
      // حركة بلا بند معروف تتحول لمصروف متغير حتى لا تضيع من الحساب
      if (e.kind !== 'income' && e.kind !== 'variable' && !e.ref) e.kind = 'variable';
      s.entries.push(e);
    }
    s.settings.customBanks = [...custom].map(([name, id]) => ({ id, name, color: '#64748b' }));
    return s;
  }

  function normalize(s) {
    const base = emptyState();
    s = Object.assign(base, s || {});
    s.settings = Object.assign(defaultSettings(), s.settings || {});
    s.settings.rules = Object.assign(defaultSettings().rules, s.settings.rules || {});
    for (const k of ['income', 'fixed', 'debts', 'goals', 'entries', 'customBanks']) if (k !== 'customBanks' && !Array.isArray(s[k])) s[k] = [];
    if (!Array.isArray(s.settings.customBanks)) s.settings.customBanks = [];
    if (!s.overrides || typeof s.overrides !== 'object') s.overrides = {};
    if (!s.closed || typeof s.closed !== 'object') s.closed = {};
    if (!Array.isArray(s.revisions)) s.revisions = [];
    return s;
  }

  /* ───────── تحديث الخطة بتعليمات خالد (يُطبَّق مرة وحدة، ويحفظ ما سُجّل فعليًا) ───────── */
  const REVISION = 'plan-2026-10-04b';
  function applyRevision(s) {
    if ((s.revisions || []).includes(REVISION)) return s;
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
    s.revisions = [...(s.revisions || []), REVISION];
    return s;
  }

  function loadState(storage) {
    try {
      const raw = storage.getItem(STORE_KEY);
      if (raw) return applyRevision(normalize(JSON.parse(raw)));
    } catch (e) { /* يكمل للترحيل */ }
    try {
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy) return applyRevision(normalize(migrateLegacy(JSON.parse(legacy))));
    } catch (e) { /* يكمل للبيانات الافتراضية */ }
    return applyRevision(normalize(seedState()));
  }

  /* ───────── حساب البنود للدورة ───────── */
  function inRange(x, cycle) {
    if (x.startCycle && cycle < x.startCycle) return false;
    if (x.endCycle && cycle > x.endCycle) return false;
    return true;
  }
  const override = (s, cycle, id) => {
    const o = s.overrides[cycle];
    return o && Object.prototype.hasOwnProperty.call(o, id) ? Number(o[id]) || 0 : null;
  };
  const scheduleAmount = (x, cycle) => {
    const r = (x.schedule || []).find(r => r.cycle === cycle);
    return r ? Number(r.amount) || 0 : null;
  };
  const entriesFor = (s, cycle, kind, ref) => s.entries.filter(e => e.kind === kind && (ref === undefined || e.ref === ref) && cycleOf(e.date, s.settings.salaryDay) === cycle);

  function debtRemaining(s, d) {
    const paid = sum(s.entries.filter(e => e.kind === 'debt' && e.ref === d.id && !e.legacy), e => e.amount);
    return Math.max(0, round2(d.remaining - paid));
  }
  function goalSaved(s, g) {
    return round2((Number(g.saved) || 0) + sum(s.entries.filter(e => e.kind === 'goal' && e.ref === g.id && !e.legacy), e => e.amount));
  }

  function plannedFor(s, kind, x, cycle) {
    const o = override(s, cycle, x.id);
    if (o !== null) return o;
    if (kind === 'income') return inRange(x, cycle) ? Number(x.amount) || 0 : 0;
    if (kind === 'fixed') return inRange(x, cycle) ? Number(x.amount) || 0 : 0;
    if (kind === 'debt') {
      const sc = scheduleAmount(x, cycle);
      if (sc !== null) return sc;
      if ((x.schedule || []).length) return 0; // الدين المجدول يتبع جدوله فقط
      if (!inRange(x, cycle)) return 0;
      // تقدير المتبقي بداية هذه الدورة: المتبقي الحالي + ما دُفع من هذه الدورة فصاعدًا
      const paidFromHere = sum(s.entries.filter(e => e.kind === 'debt' && e.ref === x.id && !e.legacy && cycleOf(e.date, s.settings.salaryDay) >= cycle), e => e.amount);
      const left = debtRemaining(s, x) + paidFromHere;
      return round2(Math.min(Number(x.monthly) || 0, Math.max(0, left)));
    }
    if (kind === 'goal') {
      if (!x.active) return 0;
      const sd = s.settings.salaryDay;
      if (x.targetDate && cycle > cycleOf(x.targetDate, sd)) return 0; // لا تمويل بعد الموعد
      const sc = scheduleAmount(x, cycle);
      if (sc !== null) return sc;
      if (!inRange(x, cycle)) return 0;
      if (x.target > 0) {
        // المدخر قبل هذه الدورة = الفعلي المسجل + ما يُفترض تحويله في الدورات القادمة قبلها
        let savedBefore = (Number(x.saved) || 0) + sum(s.entries.filter(e => e.kind === 'goal' && e.ref === x.id && !e.legacy && cycleOf(e.date, sd) < cycle), e => e.amount);
        for (let k = cycleOf(s._now || new Date(), sd); k < cycle; k = shiftCycle(k, 1)) {
          savedBefore += Math.max(0, plannedFor(s, 'goal', x, k) - sum(entriesFor(s, k, 'goal', x.id), e => e.amount));
        }
        savedBefore = round2(savedBefore);
        if (savedBefore >= x.target) return 0;
        return round2(Math.min(Number(x.monthly) || 0, x.target - savedBefore));
      }
      return Number(x.monthly) || 0;
    }
    return 0;
  }

  const KIND_LIST = { income: 'income', fixed: 'fixed', debt: 'debts', goal: 'goals' };

  function itemLine(s, kind, x, cycle, past) {
    const planned = round2(plannedFor(s, kind, x, cycle));
    const list = entriesFor(s, cycle, kind, x.id);
    const actual = sum(list, e => e.amount);
    const closed = past || !!(s.closed[cycle] && s.closed[cycle][x.id]);
    const recorded = list.length > 0;
    // المتوقع: البند المقفل يعتمد الفعلي، والمفتوح يأخذ الأكبر بين المخطط والفعلي
    let projected;
    if (kind === 'income') projected = recorded ? (closed || actual >= planned ? actual : planned) : (x.confirmed === false ? 0 : planned);
    else if (recorded) projected = closed ? actual : Math.max(planned, actual);
    else projected = closed && !past ? 0 : planned; // إقفال بدون صرف = تم تخطيه
    const diff = round2(planned - actual); // موجب = أقل من المخطط
    const pct = planned > 0 ? actual / planned : (actual > 0 ? 2 : 0);
    let state = 'pending';
    if (kind === 'income') state = recorded ? (actual >= planned ? 'good' : 'warn') : 'pending';
    else if (actual > planned + 0.009) state = kind === 'fixed' ? 'over' : 'extra';
    else if (closed && recorded) state = actual < planned ? 'saved' : 'done';
    else if (recorded) state = pct >= 0.85 ? 'near' : 'partial';
    return { kind, item: x, id: x.id, name: x.name, bank: x.bank || '', planned, actual, projected: round2(projected), diff, pct, closed, recorded, state, entries: list };
  }

  /* ───────── ملخص الدورة ───────── */
  function summarize(s, cycle, today) {
    today = today || new Date();
    Object.defineProperty(s, '_now', { value: today, writable: true, configurable: true, enumerable: false });
    const sd = s.settings.salaryDay;
    const current = cycleOf(today, sd);
    const past = cycle < current;
    const lines = {
      income: s.income.map(x => itemLine(s, 'income', x, cycle, past)),
      fixed: s.fixed.map(x => itemLine(s, 'fixed', x, cycle, past)).filter(l => l.planned > 0 || l.recorded),
      debtsTemp: s.debts.filter(d => d.kind === 'temp').map(x => itemLine(s, 'debt', x, cycle, past)).filter(l => l.planned > 0 || l.recorded),
      debtsFixed: s.debts.filter(d => d.kind !== 'temp').map(x => itemLine(s, 'debt', x, cycle, past)).filter(l => l.planned > 0 || l.recorded),
      goals: s.goals.map(x => itemLine(s, 'goal', x, cycle, past)).filter(l => l.planned > 0 || l.recorded)
    };
    const variable = entriesFor(s, cycle, 'variable');
    const tot = k => ({ planned: sum(lines[k], l => l.planned), actual: sum(lines[k], l => l.actual), projected: sum(lines[k], l => l.projected) });
    const T = { income: tot('income'), fixed: tot('fixed'), debtsTemp: tot('debtsTemp'), debtsFixed: tot('debtsFixed'), goals: tot('goals') };
    T.income.confirmedPlanned = sum(lines.income.filter(l => l.item.confirmed !== false), l => l.planned);
    T.variable = { planned: 0, actual: sum(variable, e => e.amount), projected: sum(variable, e => e.amount) };
    const outKeys = ['fixed', 'debtsTemp', 'debtsFixed', 'goals', 'variable'];
    const outPlanned = sum(outKeys, k => T[k].planned);
    const outActual = sum(outKeys, k => T[k].actual);
    const outProjected = sum(outKeys, k => T[k].projected);
    const planSurplus = round2(T.income.confirmedPlanned - outPlanned);
    const projectedSurplus = round2(T.income.projected - outProjected);
    const recordedNet = round2(T.income.actual - outActual);

    // التجاوزات
    const overs = lines.fixed
      .filter(l => l.state === 'over').map(l => ({ name: l.name, id: l.id, kind: l.kind, amount: round2(l.actual - l.planned) }))
      .sort((a, b) => b.amount - a.amount);
    const savedLines = lines.fixed.filter(l => l.state === 'saved').map(l => ({ name: l.name, amount: l.diff }));

    // الوقت داخل الدورة
    const start = cycleStart(cycle, sd), end = cycleEnd(cycle, sd);
    const totalDays = Math.round((end - start) / 864e5) + 1;
    let elapsed = Math.floor((today - start) / 864e5) + 1;
    elapsed = Math.max(0, Math.min(totalDays, elapsed));
    const nextSalary = cycleStart(shiftCycle(current, 1), sd);
    const daysToSalary = Math.max(0, Math.ceil((nextSalary - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5));

    const sm = { cycle, current, past, future: cycle > current, lines, variable, totals: T, outPlanned, outActual, outProjected, planSurplus, projectedSurplus, recordedNet, overs, savedLines, start, end, totalDays, elapsed, timePct: totalDays ? elapsed / totalDays : 0, daysToSalary };
    sm.health = health(s, sm);
    sm.insights = insights(s, sm, today);
    sm.banks = bankDistribution(s, sm);
    return sm;
  }

  /* ───────── تقييم الوضع المالي ─────────
     يعتمد على مؤشرات معروفة في التخطيط المالي الشخصي:
     • نسبة الادخار (الأهداف + الفائض) من الدخل — قاعدة 50/30/20 تستهدف 20٪.
     • نسبة أقساط الديون من الدخل (DTI) — ساما تحدد سقف الاستقطاع للأفراد بثلث الراتب تقريبًا،
       وفوق 43–45٪ يعتبر ضغطًا عاليًا عالميًا.
     • الالتزام بالميزانية — نسبة التجاوز على البنود المخطط لها.
     • صندوق الطوارئ — 3 إلى 6 أشهر من المصاريف الأساسية.
     • الفائض المتوقع — العجز يحوّل الحالة مباشرة إلى «ضغط». */
  function health(s, sm) {
    const R = s.settings.rules;
    const T = sm.totals;
    const income = T.income.projected || T.income.confirmedPlanned;
    const factors = [];
    if (!income) {
      return { score: 0, level: 'unknown', label: 'أكمل بياناتك', color: 'muted', factors: [{ key: 'income', label: 'الدخل', note: 'أدخل الدخل المتوقع حتى أقدر أقيّم وضعك', score: 0, weight: 1 }] };
    }
    const clamp = n => Math.max(0, Math.min(100, n));
    // 1) الادخار: الأهداف + الفائض الموجب
    const savings = (T.goals.projected + Math.max(0, sm.projectedSurplus)) / income * 100;
    const fSav = clamp(savings >= R.savingsGood ? 100 : savings >= R.savingsOk ? 60 + (savings - R.savingsOk) / (R.savingsGood - R.savingsOk) * 40 : savings / R.savingsOk * 60);
    factors.push({ key: 'savings', label: 'نسبة الادخار', value: savings, note: `${savings.toFixed(0)}٪ من الدخل يروح للأهداف والفائض (المستهدف ${R.savingsGood}٪)`, score: fSav, weight: 0.3 });
    // 2) الديون
    const dti = (T.debtsTemp.projected + T.debtsFixed.projected) / income * 100;
    const fDti = clamp(dti <= R.dtiGood ? 100 - dti / R.dtiGood * 20 : dti >= R.dtiBad ? 20 - Math.min(20, dti - R.dtiBad) : 80 - (dti - R.dtiGood) / (R.dtiBad - R.dtiGood) * 60);
    factors.push({ key: 'dti', label: 'أقساط الديون', value: dti, note: `${dti.toFixed(0)}٪ من الدخل أقساط (الصحي أقل من ${R.dtiGood}٪)`, score: fDti, weight: 0.25 });
    // 3) الالتزام بالميزانية
    const overTotal = sum(sm.overs, o => o.amount); // المتغير يُقاس في الفائض
    const budgetBase = sm.outPlanned || 1;
    const overPct = overTotal / budgetBase * 100;
    const fBud = clamp(100 - overPct * 12);
    factors.push({ key: 'budget', label: 'الالتزام بالميزانية', value: overPct, note: sm.overs.length ? `تجاوز في ${sm.overs.length} بند بمجموع ${round2(overTotal)} ر.س` : 'ما فيه تجاوز على البنود', score: fBud, weight: 0.25 });
    // 4) الطوارئ
    const essentials = T.fixed.planned + T.debtsFixed.planned + T.debtsTemp.planned || 1;
    const em = s.goals.filter(g => g.emergency).reduce((a, g) => a + goalSaved(s, g), 0);
    const months = em / essentials;
    const fEm = clamp(months / R.emergencyMonths * 100);
    factors.push({ key: 'emergency', label: 'صندوق الطوارئ', value: months, note: `يغطي ${months.toFixed(1)} شهر من المصاريف الأساسية (المستهدف ${R.emergencyMonths})`, score: fEm, weight: 0.2 });

    let score = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0));
    const surplusPct = sm.projectedSurplus / income * 100;
    if (sm.projectedSurplus < 0) score = Math.min(score, 35);          // عجز = ضغط مباشرة
    else if (surplusPct < R.bufferGood) score = Math.min(score, 64);   // هامش أمان أقل من المطلوب = لا يمكن يكون مريح
    let level, label, color;
    if (score >= 70) { level = 'good'; label = 'مريح'; color = 'good'; }
    else if (score >= 45) { level = 'ok'; label = 'متوسط'; color = 'warn'; }
    else { level = 'bad'; label = sm.projectedSurplus < 0 ? 'عجز — ضغط' : 'ضغط'; color = 'bad'; }
    return { score, level, label, color, factors, surplusPct };
  }

  /* ───────── تنبيهات ذكية ───────── */
  function insights(s, sm, today) {
    const out = [];
    const T = sm.totals;
    const fmtN = n => (Math.round(n * 100) / 100).toLocaleString('en-US');
    const noIncome = !T.income.confirmedPlanned && !T.income.actual;
    if (noIncome) out.push({ level: 'bad', icon: '💰', title: 'أدخل دخلك المتوقع', text: 'بدون الدخل ما أقدر أحسب الفائض أو أقيّم الوضع.', action: { type: 'edit', kind: 'income', id: 'i-salary' } });
    if (!noIncome && sm.projectedSurplus < 0) out.push({ level: 'bad', icon: '⛔', title: `عجز متوقع ${fmtN(-sm.projectedSurplus)} ر.س`, text: 'المصروف المتوقع أكبر من الدخل في هذه الدورة. خفف المصروف المتغير أو أجّل مخصص هدف.' });
    for (const o of sm.overs.slice(0, 3)) out.push({ level: 'bad', icon: '🔺', title: `تجاوزت «${o.name}» بـ ${fmtN(o.amount)} ر.س`, text: 'الزيادة تنخصم من الفائض مباشرة.', action: { type: 'open', kind: o.kind, id: o.id } });
    // سرعة الصرف على الميزانيات المتغيرة (مثل الشخصي والبيت) مقابل الوقت
    if (!sm.past && !sm.future && sm.timePct > 0.1) {
      for (const l of sm.lines.fixed) {
        if (!l.item.flexible || l.closed || !l.recorded || l.state === 'over' || l.planned <= 0) continue;
        if (l.pct - sm.timePct > 0.2 && l.pct >= 0.5) out.push({ level: 'warn', icon: '⏱️', title: `«${l.name}» يصرف أسرع من الوقت`, text: `صرفت ${Math.round(l.pct * 100)}٪ ومضى ${Math.round(sm.timePct * 100)}٪ من الدورة. الباقي ${fmtN(l.diff)} ر.س لـ ${sm.totalDays - sm.elapsed} يوم.`, action: { type: 'open', kind: 'fixed', id: l.id } });
      }
    }
    if (T.variable.actual > 0 && sm.planSurplus > 0 && T.variable.actual > sm.planSurplus * 0.6) out.push({ level: 'warn', icon: '🧾', title: 'المصاريف المتغيرة أكلت الفائض', text: `صرفت ${fmtN(T.variable.actual)} خارج الخطة من فائض مخطط ${fmtN(sm.planSurplus)}.` });
    // أهداف بموعد وتمويل غير كافٍ
    for (const g of s.goals) {
      if (!g.active || !g.target || !g.targetDate) continue;
      const saved = goalSaved(s, g);
      if (saved >= g.target) continue;
      const deadlineCycle = cycleOf(g.targetDate, s.settings.salaryDay);
      // التمويل يكون من رواتب قبل الموعد
      let planned = 0;
      for (let c = sm.current; c <= deadlineCycle; c = shiftCycle(c, 1)) {
        const p = plannedFor(s, 'goal', g, c);
        planned += c === sm.current ? Math.max(0, p - sum(entriesFor(s, c, 'goal', g.id), e => e.amount)) : p;
      }
      const gap = round2(g.target - saved - planned);
      const left = Math.max(1, cyclesBetween(sm.current, deadlineCycle) + 1);
      if (gap > 0) out.push({ level: 'warn', icon: g.icon || '🎯', title: `«${g.name}» ناقصه ${fmtN(gap)} ر.س`, text: `للوصول قبل ${g.targetDate} تحتاج تقريبًا ${fmtN(Math.ceil((g.target - saved) / left))} ر.س شهريًا من ${left} راتب.`, action: { type: 'edit', kind: 'goal', id: g.id } });
    }
    // أقساط مؤقتة تخلص قريب = سيولة تتحرر
    for (const d of s.debts.filter(d => d.kind === 'temp')) {
      const now = plannedFor(s, 'debt', d, sm.cycle), next = plannedFor(s, 'debt', d, shiftCycle(sm.cycle, 1));
      if (now > 0 && next === 0) out.push({ level: 'good', icon: '🎉', title: `«${d.name}» آخر دفعة هذا الشهر`, text: `من الدورة الجاية يتحرر ${fmtN(now)} ر.س شهريًا.` });
    }
    for (const sv of sm.savedLines.slice(0, 2)) out.push({ level: 'good', icon: '✅', title: `وفّرت ${fmtN(sv.amount)} ر.س في «${sv.name}»`, text: 'المبلغ يضاف للفائض.' });
    if (!out.some(x => x.level === 'bad') && sm.projectedSurplus > 0 && !sm.past) out.push({ level: 'good', icon: '💚', title: `فائض متوقع ${fmtN(sm.projectedSurplus)} ر.س`, text: 'إذا التزمت بالخطة لنهاية الدورة.' });
    const rank = { bad: 0, warn: 1, good: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }

  /* ───────── التوزيع حسب البنك ───────── */
  function bankDistribution(s, sm) {
    const all = [...sm.lines.fixed, ...sm.lines.debtsTemp, ...sm.lines.debtsFixed, ...sm.lines.goals];
    const m = new Map();
    for (const l of all) {
      const k = l.bank || '';
      if (!m.has(k)) m.set(k, { bank: k, planned: 0, actual: 0, count: 0 });
      const b = m.get(k);
      b.planned = round2(b.planned + l.planned); b.actual = round2(b.actual + l.actual); b.count++;
    }
    return [...m.values()].sort((a, b) => b.planned - a.planned);
  }

  /* ───────── توقع الأشهر القادمة ───────── */
  function forecast(s, fromCycle, n, today) {
    const res = [];
    for (let i = 0; i < n; i++) {
      const c = shiftCycle(fromCycle, i);
      const sm = summarize(s, c, today);
      res.push({ cycle: c, income: sm.totals.income.confirmedPlanned, out: sm.outPlanned, surplus: sm.planSurplus, debts: round2(sm.totals.debtsTemp.planned + sm.totals.debtsFixed.planned), goals: sm.totals.goals.planned });
    }
    return res;
  }

  const api = { VERSION, REVISION, applyRevision, STORE_KEY, LEGACY_KEY, BANKS, THEMES, uid, round2, sum, isoDate, cycleStart, cycleEnd, shiftCycle, cycleOf, cyclesBetween, defaultSettings, emptyState, seedState, migrateLegacy, normalize, loadState, plannedFor, debtRemaining, goalSaved, itemLine, summarize, health, insights, forecast, KIND_LIST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
