/* مالي V9 — محرك الحسابات (بدون واجهة). يعمل في المتصفح وفي Node للاختبار. */
(function (root) {
  'use strict';

  const VERSION = '12.2.0';
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
    { id: 'lagoon', name: 'نيون', accent: '#7B61FF' },
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
      theme: 'lagoon',
      accent: '',
      mode: 'auto',
      hideAmounts: false,
      hijri: true,
      planStart: '',
      customBanks: [],
      merchantMap: {},
      pinnedBudget: 'f-personal',
      cardMap: { '8398': 'snb', '0679': 'urpay', '4800': 'vision' },
      walletBanks: { urpay: 'f-house', vision: 'f-kids', snb: 'f-personal' },
      syncKey: '',
      split: { map: {}, phase: 0, targets: {} },   // تقسيمة الراتب: قسم كل بند، والمرحلة (0 = تلقائي)، ونسب مستهدفة معدلة
      showMonitor: true,                // شريط المراقب في الرئيسية
      ignoreRules: [],                  // كلمات: أي رسالة تحتويها تُتجاهل تلقائيًا (مثل: حوالة واردة من فلان)
      colors: { light: {}, dark: {} },   // ألوان مخصصة لكل مظهر (فارغ = الافتراضي)
      // حدود تقييم الوضع (قابلة للتعديل). القيم مأخوذة من قواعد الميزانية الشائعة.
      rules: { savingsGood: 20, savingsOk: 10, dtiGood: 33, dtiBad: 45, emergencyMonths: 3, bufferGood: 5 }
    };
  }

  function emptyState() {
    return { v: 9, settings: defaultSettings(), income: [], fixed: [], debts: [], goals: [], entries: [], ignored: [], overrides: {}, closed: {}, migratedFrom: '' };
  }

  // بنود تُصرف على دفعات خلال الشهر (ميزانية مرنة) — تُراقب سرعة الصرف فيها
  // محافظ الصرف: بنود تسحب منها طول الشهر (البيت والعيال والشخصي). تظهر «باقي كم» وتتلون، وما تدخل قائمة المهام.
  const WALLETS = ['f-house', 'f-kids', 'f-personal'];
  const WALLET_WARN = 0.30;                       // أقل من 30٪ باقي = تحذير
  const DEFAULT_WALLET_BANKS = { urpay: 'f-house', vision: 'f-kids', snb: 'f-personal' };   // مشتريات هالبنك تنخصم من محفظته
  // البند محفظة إذا اختار المستخدم «متغير» (wallet: true)، وقبل ما يختار نمشي على الافتراضي
  const isWallet = x => !!x && (x.wallet !== undefined ? !!x.wallet : WALLETS.includes(x.id));
  function walletLevel(planned, actual) {
    const left = round2(planned - actual);
    const pctLeft = planned > 0 ? left / planned : 0;
    const level = planned <= 0 ? 'none' : left < -0.009 ? 'over' : left <= 0.009 ? 'empty' : pctLeft <= WALLET_WARN ? 'low' : 'ok';
    return { left, pctLeft, level };
  }
  const FLEXIBLE = ['f-personal'];   // الميزانية اليومية للمصروف الشخصي فقط

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
    s.settings.colors = { light: Object.assign({}, (s.settings.colors || {}).light), dark: Object.assign({}, (s.settings.colors || {}).dark) };
    for (const k of ['income', 'fixed', 'debts', 'goals', 'entries', 'customBanks']) if (k !== 'customBanks' && !Array.isArray(s[k])) s[k] = [];
    if (!Array.isArray(s.settings.customBanks)) s.settings.customBanks = [];
    if (!s.overrides || typeof s.overrides !== 'object') s.overrides = {};
    if (!s.closed || typeof s.closed !== 'object') s.closed = {};
    if (!Array.isArray(s.revisions)) s.revisions = [];
    if (!Array.isArray(s.pending)) s.pending = [];
    if (!Array.isArray(s.ignored)) s.ignored = [];
    if (!Array.isArray(s.settings.ignoreRules)) s.settings.ignoreRules = [];
    if (!s.settings.cardMap || typeof s.settings.cardMap !== 'object') s.settings.cardMap = {};
    s.settings.split = splitSettings(s);
    for (const [k, v] of Object.entries(defaultSettings().cardMap)) if (!(k in s.settings.cardMap)) s.settings.cardMap[k] = v;
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

  const REVISIONS = [['plan-2026-10-04b', revB], ['plan-2026-10-04c', revC], ['plan-2026-10-04d', revD], ['plan-2026-10-05e', revE], ['plan-2026-10-05f', revF]];
  const REVISION = REVISIONS[REVISIONS.length - 1][0];
  function applyRevision(s) {
    s.revisions = s.revisions || [];
    for (const [id, fn] of REVISIONS) {
      if (s.revisions.includes(id)) continue;
      fn(s);
      s.revisions = [...s.revisions, id];
    }
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
    sm.spend = spendInfo(s, sm, today);
    sm.tasks = taskList(s, sm, today);
    sm.wallets = sm.lines.fixed.filter(l => isWallet(l.item)).map(l => { const id = l.id; return l ? Object.assign({ id, name: l.name, planned: l.planned, actual: l.actual }, walletLevel(l.planned, l.actual)) : null; }).filter(w => w && w.planned > 0);
    sm.health = health(s, sm);
    sm.insights = insights(s, sm, today);
    sm.banks = bankDistribution(s, sm);
    sm.split = splitPlan(s, sm, today);
    // تنبيهات التقسيمة المهمة تظهر مع باقي التنبيهات (الجرس)
    const rank = { bad: 0, warn: 1, good: 2 };
    for (const a of sm.split.alerts) if ((a.level === 'bad' || a.level === 'warn') && !a.noBell) sm.insights.push({ level: a.level, icon: a.icon, title: a.title, text: a.text, src: 'split', action: { type: 'split', bucket: a.bucket || '', goal: a.goal || '', entry: a.entry || '' } });
    sm.insights.sort((a, b) => rank[a.level] - rank[b.level]);
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

  /* ───────── قائمة المهام: اللي لازم يُدفع أو يُستلم أو يُحوَّل في الدورة ─────────
     يوم الاستحقاق الافتراضي = يوم الراتب (البنوك وتابي وتمارا تخصم معه). ومهلة 2 يوم قبل ما تُحسب متأخرة. */
  const GRACE_DAYS = 2;
  function dueDate(s, item, cycle) {
    const sd = s.settings.salaryDay, start = cycleStart(cycle, sd);
    const d = Number(item && item.dueDay) || sd;
    const first = d >= sd;                       // اليوم قبل يوم الراتب يعني الشهر اللي بعده
    const y = start.getFullYear(), m = start.getMonth() + (first ? 0 : 1);
    return isoDate(new Date(y, m, Math.min(d, daysInMonth(y, m))));
  }
  function taskList(s, sm, today) {
    today = today || new Date();
    const todayStr = isoDate(today);
    const L = sm.lines, verbs = { income: 'استلام', fixed: 'دفع', debt: 'سداد', goal: 'تحويل' };
    const src = [...L.fixed.filter(l => !l.item.flexible && !isWallet(l.item)), ...L.debtsFixed, ...L.debtsTemp, ...L.goals];
    const items = src.filter(l => l.planned > 0).map(l => {
      const remaining = round2(Math.max(0, l.planned - l.actual));
      const done = l.closed || remaining <= 0.009;
      const due = dueDate(s, l.item, sm.cycle);
      const graceEnd = isoDate(new Date(new Date(due + 'T12:00:00').getTime() + GRACE_DAYS * 864e5));
      const overdue = !done && !sm.future && (sm.past || todayStr > graceEnd);
      return { kind: l.kind, id: l.id, item: l.item, name: l.name, icon: l.item.icon || '', bank: l.bank, planned: l.planned, actual: l.actual, remaining, done, due, overdue, verb: verbs[l.kind], dueSoon: !done && !overdue && !sm.future && !sm.past && todayStr >= due };
    });
    const open = items.filter(i => !i.done).sort((a, b) => (b.overdue - a.overdue) || a.due.localeCompare(b.due) || b.remaining - a.remaining);
    return { open, done: items.filter(i => i.done), overdue: open.filter(i => i.overdue), remainingTotal: round2(sum(open, i => i.remaining)), total: items.length };
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
    for (const w of (sm.wallets || [])) {
      if (w.level === 'empty') out.push({ level: 'bad', icon: '🪫', title: `«${w.name}» خلص`, text: `صرفت كل الـ ${fmtN(w.planned)} ر.س. أي صرف زيادة يصير تجاوز.`, action: { type: 'open', kind: 'fixed', id: w.id } });
      else if (w.level === 'low' && !sm.past && !sm.future) out.push({ level: 'warn', icon: '🟠', title: `«${w.name}» باقي منه ${fmtN(w.left)} فقط`, text: `صرفت ${fmtN(w.actual)} من ${fmtN(w.planned)}.`, action: { type: 'open', kind: 'fixed', id: w.id } });
    }
    if (sm.tasks && sm.tasks.overdue.length) {
      const od = sm.tasks.overdue;
      out.push({ level: 'bad', icon: '⏰', title: `${od.length} ${od.length === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'}`, text: od.slice(0, 4).map(i => `${i.name} ${fmtN(i.remaining)}`).join('، ') + (od.length > 4 ? '…' : '') + '. إذا دفعتها علّمها تم، وإذا نسيتها ادفعها.', action: { type: 'tasks' } });
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

  /* ───────── قراءة رسائل البنوك (SMS) ─────────
     يقرأ المبلغ ونوع الحركة والبنك والتاجر والتاريخ، ويقترح البند. ما يسجل شيء بنفسه. */
  const AR_DIGITS = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/٬/g, ',');
  const BANK_HINTS = [
    ['snb', /الأهلي|الاهلي|\bSNB\b|AlAhli|Al Ahli|NCB/i], ['rajhi', /الراجحي|Al ?Rajhi/i], ['vision', /فيجن|فيجين|Vision ?Bank/i],
    ['urpay', /يوربي|يورباي|ur ?pay/i], ['bilad', /البلاد|Bank ?Albilad|Albilad/i], ['tabby', /تابي|tabby/i], ['tamara', /تمارا|tamara/i],
    ['stc', /stc ?bank|stc ?pay|إس ?تي ?سي/i], ['jazira', /الجزيرة|Al ?Jazira|BAJ\b/i], ['emkan', /إمكان|امكان|emkan/i],
    ['d360', /D360|دي ?360/i], ['ehsan', /إحسان|احسان|ehsan/i], ['mobilypay', /موبايلي ?(باي|pay)|mobily ?pay/i]
  ];
  const TYPE_RULES = [
    ['income', /إيداع|ايداع|راتب|حوالة واردة|تحويل وارد|وارد|استلام|مسترد|استرداد|Deposit|Salary|Credit(?:ed)?\b|Incoming|Received|Refund/i],
    ['out', /شراء|مشتريات|نقاط البيع|مدى|أبل ?باي|Apple ?Pay|سداد|دفع|خصم|سحب|صراف|تحويل صادر|حوالة صادرة|تحويل|قسط|Purchase|POS|Payment|Paid|Debit(?:ed)?|Withdraw|ATM|Transfer|Installment|SADAD/i]
  ];
  const MERCHANT_RULES = [
    ['f-personal', /بنزين|وقود|محطة|ساسكو|الدريس|نفط|بترومين|PETRO|ALDREES|SASCO|NAFT|FUEL|GAS ?STATION|محطات/i],
    ['f-electric', /كهرباء|الكهرباء|\bSEC\b|Saudi Electricity/i],
    ['f-water', /مياه|المياه|وايت|NWC|Water/i],
    ['f-mobile', /\bstc\b|موبايلي|Mobily|زين|\bZain\b|سلام|Salam|فاتورة جوال/i],
    ['f-uni', /جامعة|University|رسوم دراسية/i],
    ['f-charity', /إحسان|احسان|صدقة|تبرع|Ehsan|Donation/i],
    ['f-entertainment', /سينما|Cinema|VOX|ترفيه|ملاهي|Netflix|Shahid|شاهد|Spotify|PlayStation|Steam/i],
    ['f-house', /بنده|بندة|Panda|العثيم|Othaim|الدانوب|Danube|كارفور|Carrefour|لولو|Lulu|تميمي|Tamimi|سوبرماركت|Supermarket|هايبر|Hyper|بقالة|Grocery|نستو|Nesto/i]
  ];
  // أرقام المفوترين في سداد
  const BILLERS = { '002': ['الكهرباء', 'f-electric'] };
  function smsHash(text) {
    let h = 5381; const t = String(text).replace(/\s+/g, ' ').trim();
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return 'sms' + (h >>> 0).toString(36);
  }
  function parseSms(raw, today, sender, cardMap) {
    const text = AR_DIGITS(raw).replace(/‏|‎/g, '');
    const num = v => Number(String(v).replace(/,/g, ''));
    // المبلغ: بجانب كلمة مبلغ/بـ أو رمز العملة
    const amtRes = [
      /(?:مبلغ|بمبلغ|المبلغ|Amount|Amt)\s*[:：]?\s*(?:SAR|SR|ر\.?\s?س|ريال)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:SAR|SR|ر\.?\s?س\.?)\s*[:：]?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /([\d,]+(?:\.\d{1,2})?)\s*(?:SAR|SR|ر\.?\s?س|ريال|ر\.س)/i,
      /بـ\s*([\d,]+(?:\.\d{1,2})?)/
    ];
    let amount = 0;
    for (const re of amtRes) { const m = text.match(re); if (m && num(m[1]) > 0) { amount = round2(num(m[1])); break; } }
    let type = '';
    const inc = TYPE_RULES[0][1].test(text), out = TYPE_RULES[1][1].test(text);
    type = inc && !/شراء|Purchase|POS|سداد|خصم/i.test(text) ? 'income' : out ? 'out' : inc ? 'income' : 'out';
    // اتجاه الحوالة من صياغتها: «إلى حسابك» = دخل، «من حسابك» = خصم
    if (/(?:إلى|الى|الي)\s*(?:حسابك|حسابكم|بطاقتك)|to\s+your\s+account|credited\s+to/i.test(text)) type = 'income';
    else if (/(?:من)\s*(?:حسابك|حسابكم|بطاقتك)|from\s+your\s+account|debited\s+from/i.test(text)) type = 'out';
    // البنك اللي انخصم منه: من رقم البطاقة أولًا، ثم اسم المرسل، ثم ذكره في النص
    // والجهة (provider): تابي/تمارا/… لو مذكورة كتاجر
    const findBank = t => { for (const [id, re] of BANK_HINTS) if (re.test(t)) return id; return ''; };
    let provider = findBank(text);
    let bank = findBank(String(sender || ''));
    // التاجر/الجهة
    let merchant = '';
    const mm = text.match(/(?:لدى|من عند|عند|التاجر|المستفيد|إلى|الى|At|Merchant|To|from)\s*[:：]\s*([^\n\r:،;]{2,60})/i)
      || text.match(/(?:^|\n)\s*من\s*[:：]\s*(?!حساب|بطاق|رصيد|جوال)([^\n\r:،;]{2,60})/)
      || text.match(/(?:لدى|من عند|عند|At|Merchant)\s+([^\n\r:،;]{2,60})/i)
      || text.match(/(?:^|\s)من\s+(?!حساب|بطاق|رصيد|جوال)([^\n\r:،,\d]{2,40})/);
    if (mm) merchant = mm[1].replace(/\s+(?:بمبلغ|مبلغ|بتاريخ|في|on|SAR|ر\.س).*$/i, '').replace(/[.\s]+$/, '').trim();
    // التاريخ
    let date = '';
    const d1 = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/), d2 = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
    const ok = (y, m, d) => y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
    if (d1 && ok(+d1[1], +d1[2], +d1[3])) date = `${d1[1]}-${pad(d1[2])}-${pad(d1[3])}`;
    else if (d2) { let y = +d2[3]; if (y < 100) y += 2000; if (ok(y, +d2[2], +d2[1])) date = `${y}-${pad(d2[2])}-${pad(d2[1])}`; }
    if (!date || date > isoDate(new Date((today || new Date()).getTime() + 864e5))) date = isoDate(today || new Date());
    const card = (text.match(/(?:\*+|x{2,}|•{2,}|بطاقة[^\d\n]*|card[^\d\n]*)(\d{4})\b/i) || [])[1] || '';
    if (card && cardMap && cardMap[card]) bank = cardMap[card];
    if (!bank) bank = provider;
    // سداد: رقم المفوتر يحدد الجهة (002 = الكهرباء)
    const biller = (text.match(/مفوتر\s*[:：]?\s*(\d{2,4})/) || text.match(/Biller\s*[:：]?\s*(\d{2,4})/i) || [])[1] || '';
    if (biller) merchant = 'مفوتر ' + biller + (BILLERS[biller] ? ' — ' + BILLERS[biller][0] : '');
    return { amount, type, bank, provider, merchant, biller, date, card, hash: smsHash(raw), raw: String(raw).trim() };
  }
  function splitSms(raw) {
    return String(raw || '').split(/\n\s*\n+/).map(t => t.trim()).filter(t => t.length > 8);
  }
  /* يقترح البند: الدخل، القسط المطابق، البند الثابت، تعلم سابق للتاجر، ثم كلمات التاجر */
  function suggestForSms(s, p, cycle) {
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    const learned = (s.settings.merchantMap || {})[(p.merchant || '').toLowerCase()];
    if (p.type === 'income') {
      const sal = s.income.find(x => x.id === 'i-salary');
      if (/حساب المواطن|Citizen/i.test(p.raw)) return { kind: 'income', ref: 'i-citizen', why: 'حساب المواطن' };
      if (sal && near(p.amount, plannedFor(s, 'income', sal, cycle) || sal.amount, Math.max(50, sal.amount * 0.1)) && /راتب|Salary|رواتب|Payroll/i.test(p.raw) || (sal && near(p.amount, sal.amount, 1))) return { kind: 'income', ref: 'i-salary', why: 'مبلغ الراتب' };
      return { kind: 'income', ref: '', why: 'دخل آخر' };
    }
    if (learned) return Object.assign({ why: 'تعلمته من تسجيل سابق' }, learned);
    if (p.biller && BILLERS[p.biller] && s.fixed.some(x => x.id === BILLERS[p.biller][1])) return { kind: 'fixed', ref: BILLERS[p.biller][1], why: 'فاتورة ' + BILLERS[p.biller][0] };
    const prov = p.provider || p.bank;
    const debts = s.debts.map(d => ({ d, p: plannedFor(s, 'debt', d, cycle) })).filter(x => x.p > 0);
    const byAmt = debts.filter(x => near(x.p, p.amount, 1));
    const sameBank = byAmt.find(x => prov && x.d.bank === prov) || (byAmt.length === 1 ? byAmt[0] : null);
    if (sameBank) return { kind: 'debt', ref: sameBank.d.id, why: 'مبلغ القسط' };
    // خارج جدول هذه الدورة: نطابق مع القسط الشهري أو أي مبلغ في جدول الدين
    const amounts = d => [d.monthly, ...(d.schedule || []).map(r => r.amount)].map(Number).filter(Boolean);
    const anyAmt = s.debts.filter(d => debtRemaining(s, d) > 0 && amounts(d).some(a => near(a, p.amount, 1)));
    const anyPick = anyAmt.find(d => prov && d.bank === prov) || (anyAmt.length === 1 ? anyAmt[0] : null);
    if (anyPick) return { kind: 'debt', ref: anyPick.id, why: 'مبلغ القسط' };
    if (prov === 'tabby' || prov === 'tamara') {
      const pool = s.debts.filter(d => d.bank === prov && debtRemaining(s, d) > 0);
      const pick = pool.sort((a, b) => Math.min(...amounts(a).map(x => Math.abs(x - p.amount))) - Math.min(...amounts(b).map(x => Math.abs(x - p.amount))))[0];
      if (pick) return { kind: 'debt', ref: pick.id, why: 'قسط ' + (prov === 'tabby' ? 'تابي' : 'تمارا') };
    }
    for (const [ref, re] of MERCHANT_RULES) if (re.test(p.merchant + ' ' + p.raw) && s.fixed.some(x => x.id === ref)) return { kind: 'fixed', ref, why: 'من اسم التاجر' };
    // مشتريات بطاقة بنك له محفظة (يوربي = البيت، فيجن = العيال، الأهلي = الشخصي) تنخصم من محفظته
    const byBank = s.fixed.filter(x => isWallet(x) && x.bank && x.bank === p.bank);
    const wid = byBank.length === 1 ? byBank[0].id : byBank.length > 1 ? '' : ((s.settings.walletBanks || DEFAULT_WALLET_BANKS)[p.bank]) || '';
    if (wid && p.type === 'out' && !p.biller && !/تحويل|حوالة|Transfer|سداد|Sadad/i.test(p.raw) && s.fixed.some(x => x.id === wid)) return { kind: 'fixed', ref: wid, why: 'مشتريات من بطاقة هذا البنك' };
    const fx = s.fixed.filter(x => !x.flexible && near(plannedFor(s, 'fixed', x, cycle), p.amount, 1));
    if (fx.length === 1) return { kind: 'fixed', ref: fx[0].id, why: 'مبلغ البند' };
    const goal = s.goals.find(g => near(plannedFor(s, 'goal', g, cycle), p.amount, 1) && /تحويل|Transfer/i.test(p.raw));
    if (goal) return { kind: 'goal', ref: goal.id, why: 'تحويل بمبلغ الهدف' };
    return { kind: 'variable', ref: '', why: 'ما طابق بند' };
  }


  /* رسائل الاختصار بدون بند محدد: نسجل تلقائيًا فقط لو الاقتراح واثق (محفظة البنك، تاجر تعلمناه، فاتورة، قسط)، وغير ذلك يروح لقائمة التصنيف */
  const AUTO_WHY = /^(مشتريات من بطاقة هذا البنك|تعلمته من تسجيل سابق|فاتورة |مبلغ القسط|قسط |من اسم التاجر)/;
  function autoTarget(s, p, cycle) {
    if (!(p.amount > 0) || p.type === 'income') return null;
    const g = suggestForSms(s, p, cycle);
    return g && g.kind !== 'variable' && g.kind !== 'income' && AUTO_WHY.test(g.why || '') ? { kind: g.kind, ref: g.ref, why: g.why } : null;
  }
  /* ───────── فحص الخطة ومقارنتها بالخطة المعتمدة ─────────
     المرجع = البيانات الأساسية + كل المراجعات المعتمدة. نكشف: بنود مكررة بالاسم، بنود زائدة،
     بنود تغيّرت قيمها، وتعديلات الأشهر (overrides). الإصلاح يتم بعد اختيار المستخدم فقط. */
  const normName = t => String(t || '').replace(/^ال/, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
  const AUDIT_SETS = { fixed: ['fixed', 'مصروف ثابت', ['amount', 'startCycle', 'endCycle', 'flexible']], debt: ['debts', 'دين', ['monthly', 'kind', 'startCycle', 'schedule']], goal: ['goals', 'هدف', ['monthly', 'target', 'active', 'startCycle', 'targetDate', 'schedule']], income: ['income', 'دخل', ['amount', 'confirmed', 'startCycle']] };
  const sameVal = (a, b) => JSON.stringify(a === undefined ? '' : a) === JSON.stringify(b === undefined ? '' : b);
  function referenceState() { return applyRevision(normalize(seedState())); }
  function auditPlan(s) {
    const ref = referenceState(), out = [];
    for (const [kind, [key, label, fields]] of Object.entries(AUDIT_SETS)) {
      const cur = s[key], base = ref[key];
      const hasEntries = x => s.entries.some(e => e.kind === kind && e.ref === x.id);
      const groups = new Map();
      for (const x of cur) { const k = normName(x.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
      const flagged = new Set();
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const keep = list.find(x => base.some(b => b.id === x.id)) || list.find(hasEntries) || list[0];
        for (const x of list) if (x !== keep) { flagged.add(x.id); out.push({ type: 'dup', kind, label, id: x.id, name: x.name, detail: `مكرر مع «${keep.name}»`, value: Number(x.amount ?? x.monthly) || 0, checked: true }); }
      }
      for (const x of cur) {
        if (flagged.has(x.id)) continue;
        const b = base.find(v => v.id === x.id);
        if (!b) { out.push({ type: 'extra', kind, label, id: x.id, name: x.name, detail: 'بند غير موجود في الخطة المعتمدة', value: Number(x.amount ?? x.monthly) || 0, checked: true }); continue; }
        const diffs = fields.filter(f => !sameVal(x[f], b[f]));
        if (diffs.length) out.push({ type: 'changed', kind, label, id: x.id, name: x.name, detail: diffs.map(f => f === 'schedule' ? 'الجدول' : `${f}: ${typeof x[f] === 'object' ? '…' : x[f]} ← ${typeof b[f] === 'object' ? '…' : b[f]}`).join(' · '), fields: diffs, checked: true });
      }
      // بنود الخطة الناقصة
      for (const b of base) if (!cur.some(x => x.id === b.id) && !cur.some(x => normName(x.name) === normName(b.name))) out.push({ type: 'missing', kind, label, id: b.id, name: b.name, detail: 'بند من الخطة المعتمدة غير موجود', value: Number(b.amount ?? b.monthly) || 0, checked: false });
    }
    for (const [cycle, o] of Object.entries(s.overrides || {})) for (const [id, v] of Object.entries(o)) {
      const item = [...s.fixed, ...s.debts, ...s.goals, ...s.income].find(x => x.id === id);
      out.push({ type: 'override', kind: 'override', label: 'تعديل شهر', id, cycle, name: item ? item.name : id, detail: `مبلغ ${cycle} معدّل إلى ${v}`, value: Number(v) || 0, checked: false });
    }
    return out;
  }
  function applyAudit(s, picks) {
    const ref = referenceState();
    for (const f of picks) {
      if (f.type === 'override') { if (s.overrides[f.cycle]) { delete s.overrides[f.cycle][f.id]; if (!Object.keys(s.overrides[f.cycle]).length) delete s.overrides[f.cycle]; } continue; }
      const [key, , fields] = [AUDIT_SETS[f.kind][0], 0, AUDIT_SETS[f.kind][2]];
      if (f.type === 'dup' || f.type === 'extra') {
        s[key] = s[key].filter(x => x.id !== f.id);
        for (const e of s.entries) if (e.kind === f.kind && e.ref === f.id) { e.kind = f.kind === 'income' ? 'income' : 'variable'; e.ref = ''; e.note = e.note || f.name; }
      } else if (f.type === 'changed') {
        const x = s[key].find(v => v.id === f.id), b = ref[key].find(v => v.id === f.id);
        if (x && b) for (const k of f.fields) x[k] = JSON.parse(JSON.stringify(b[k] === undefined ? '' : b[k]));
      } else if (f.type === 'missing') {
        const b = ref[key].find(v => v.id === f.id); if (b) s[key].push(JSON.parse(JSON.stringify(b)));
      }
    }
    return s;
  }

  /* ───────── المصروف اليومي الآمن وسرعة الصرف ─────────
     الميزانيات المرنة (البيت، العيال، الشخصي، الترفيه) + المصاريف المتغيرة.
     اليومي الآمن = (الباقي من الميزانيات المرنة − أي عجز متوقع) ÷ الأيام الباقية. */
  /* ميزانية بند مرن مقسومة على الأيام: كم لك يوميًا، كم المفروض صرفت لليوم، وهل سحبت زيادة أو وفرت */
  function budgetPace(s, sm, id) {
    const l = sm.lines.fixed.find(x => x.id === id);
    const item = s.fixed.find(x => x.id === id);
    if (!item) return null;
    const planned = l ? l.planned : 0, actual = l ? l.actual : 0;
    const live = !sm.past && !sm.future;
    const days = sm.totalDays, elapsed = live ? sm.elapsed : sm.past ? days : 0;
    const daily = planned ? round2(planned / days) : 0;
    const expected = round2(daily * elapsed);
    const diff = round2(expected - actual);              // موجب = وفّرت، سالب = سحبت زيادة
    const daysLeft = live ? Math.max(1, days - elapsed + 1) : days;
    const remaining = round2(planned - actual);
    const dailyLeft = round2(Math.max(0, remaining) / daysLeft);
    const todayISO = isoDate(s._now || new Date());
    const spentToday = l ? sum(l.entries.filter(e => e.date === todayISO), e => e.amount) : 0;
    const tol = Math.max(5, daily * 0.5);                 // نصف يوم سماحية
    const state = !planned ? 'none' : remaining < 0 ? 'over' : diff < -tol ? 'ahead' : diff > tol ? 'saving' : 'ok';
    const todayLeft = round2(daily - spentToday);
    return { todayLeft, id, name: item.name, planned, actual, daily, expected, diff, daysLeft, remaining, dailyLeft, spentToday, state, elapsed, days, live, overridden: !!(s.overrides[sm.cycle] && id in s.overrides[sm.cycle]) };
  }

  /* تسجيل بالباقي: المستخدم يكتب كم باقي من البند، ونحسب المصروف = المخطط − الباقي، ونضيف الفرق عن المسجل */
  function remainingToSpend(s, kind, x, cycle, remaining, past) {
    const l = itemLine(s, kind, x, cycle, !!past);
    const spent = round2(l.planned - (Number(remaining) || 0));
    return { planned: l.planned, recorded: l.actual, spent, add: round2(spent - l.actual) };
  }

  /* اختصار الآيفون: «مالي|البند|نص الرسالة» — البند اختاره المستخدم من القائمة */
  function resolveTarget(s, key) {
    const k = String(key || '').trim();
    if (!k) return null;
    if (/^(تجاهل|ignore|skip)$/i.test(k)) return { kind: 'ignore', ref: '' };
    if (/^(متغير|متغيرة|أخرى|اخرى|other|variable)$/i.test(k)) return { kind: 'variable', ref: '' };
    const norm = t => String(t).replace(/^ال/, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
    const nk = norm(k);
    // أسماء مختصرة معروفة: «المصروف الشخصي» (المحفظة الأساسية) و«المصروف اليومي» (البند المثبّت في الرئيسية)
    if (/^مصروفي? (ال)?شخصي/.test(nk) && s.fixed.some(x => x.id === 'f-personal')) return { kind: 'fixed', ref: 'f-personal' };
    if (/^مصروفي? (ال)?يومي/.test(nk) && s.settings.pinnedBudget && s.fixed.some(x => x.id === s.settings.pinnedBudget)) return { kind: 'fixed', ref: s.settings.pinnedBudget };
    const pools = [['fixed', s.fixed], ['debt', s.debts], ['goal', s.goals], ['income', s.income]];
    for (const [kind, arr] of pools) { const x = arr.find(x => x.id === k || norm(x.name) === nk); if (x) return { kind, ref: x.id }; }
    for (const [kind, arr] of pools) { const x = arr.find(x => norm(x.name).includes(nk) || nk.includes(norm(x.name))); if (x) return { kind, ref: x.id }; }
    return null;
  }
  function parseMaliClip(text) {
    const m = String(text || '').match(/^\s*(?:مالي|mali)\s*\|\s*([^|\n]+?)\s*\|([\s\S]*)$/i);
    return m ? { key: m[1].trim(), sms: m[2].trim() } : null;
  }

  function spendInfo(s, sm, today) {
    const sd = s.settings.salaryDay;
    const flex = sm.lines.fixed.filter(l => l.item.flexible);
    const budget = sum(flex, l => l.planned);
    const flexRemaining = sum(flex.filter(l => !l.closed), l => Math.max(0, l.planned - l.actual));
    const live = !sm.past && !sm.future;
    const daysLeft = live ? Math.max(1, sm.totalDays - sm.elapsed + 1) : sm.totalDays;
    const deficit = Math.min(0, sm.projectedSurplus);
    const pool = sm.past ? 0 : sm.future ? budget : Math.max(0, flexRemaining + deficit);
    const daily = round2(pool / daysLeft);
    // تراكمي يومي: الصرف الفعلي على المرن + المتغير، مقابل المسموح خطيًا
    const flexIds = new Set(flex.map(l => l.id));
    const spendEntries = s.entries.filter(e => ((e.kind === 'fixed' && flexIds.has(e.ref)) || e.kind === 'variable') && cycleOf(e.date, sd) === sm.cycle);
    const byDay = new Array(sm.totalDays).fill(0);
    for (const e of spendEntries) {
      const idx = Math.round((new Date(e.date + 'T12:00:00') - sm.start) / 864e5);
      if (idx >= 0 && idx < sm.totalDays) byDay[idx] += e.amount;
    }
    const actualCum = []; let acc = 0;
    const upto = sm.past ? sm.totalDays : sm.future ? 0 : sm.elapsed;
    for (let i = 0; i < upto; i++) { acc += byDay[i]; actualCum.push(round2(acc)); }
    const allowedCum = Array.from({ length: sm.totalDays }, (_, i) => round2(budget * (i + 1) / sm.totalDays));
    const spent = acc;
    const expectedNow = upto ? allowedCum[upto - 1] : 0;
    const paceRatio = expectedNow ? spent / expectedNow : 0; // 1 = على المسار
    const todayISO = isoDate(today);
    const spentToday = sum(spendEntries.filter(e => e.date === todayISO), e => e.amount);
    // توقع نهاية الدورة بنفس السرعة الحالية
    const projectedEnd = live && sm.elapsed > 2 ? round2(spent / sm.elapsed * sm.totalDays) : null;
    return { budget, flexRemaining, daysLeft, daily, spent: round2(spent), spentToday, actualCum, allowedCum, paceRatio, projectedEnd, live };
  }

  /* ───────── عدّاد التخلص من الديون ───────── */
  function debtFreedom(s, fromCycle, today) {
    const sd = s.settings.salaryDay;
    if (today) Object.defineProperty(s, '_now', { value: today, writable: true, configurable: true, enumerable: false });
    const items = s.debts.map(d => {
      const remaining = debtRemaining(s, d);
      let last = '', months = 0, freed = 0;
      if ((d.schedule || []).length) {
        for (let i = 0, c = fromCycle; i < 60; i++, c = shiftCycle(c, 1)) {
          const p = plannedFor(s, 'debt', d, c);
          if (p > 0) { last = c; months++; freed = p; }
        }
      } else if (d.monthly > 0 && remaining > 0) {
        // قرض بدون جدول: المدة = المتبقي ÷ القسط (تقديرية لأن الرصيد قد يكون قديم)
        months = Math.ceil(remaining / d.monthly);
        const start = d.startCycle && d.startCycle > fromCycle ? d.startCycle : fromCycle;
        last = shiftCycle(start, months - 1); freed = d.monthly;
      }
      return { id: d.id, name: d.name, kind: d.kind, remaining, last, months, freed: round2(freed), estimated: !(d.schedule || []).length };
    }).filter(x => x.months > 0).sort((a, b) => a.last.localeCompare(b.last));
    const tempEnd = items.filter(x => x.kind === 'temp').map(x => x.last).sort().pop() || '';
    const freeDate = items.map(x => x.last).sort().pop() || '';
    return { items, tempEnd, freeDate, totalRemaining: round2(sum(s.debts, d => debtRemaining(s, d))) };
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


  /* ───────── تقسيمة الراتب (العجلة) ─────────
     كل بند (ثابت/دين/هدف) والمصاريف المتغيرة تنتمي لقسم واحد من ستة. خالد يغيّر القسم من «رتّب الأقسام».
     القاعدة اللي تقارن عليها: مخطط البنود نفسه (اللي في التطبيق) مقابل المسجل فعليًا، ونسب مستهدفة لكل مرحلة. */
  const SPLIT_BUCKETS = [
    { id: 'basics', name: 'الأساسيات', icon: '🏠', color: '#2a78d6', hint: 'البيت والعيال والفواتير والجوالات والمصروف' },
    { id: 'commit', name: 'الالتزامات', icon: '🏦', color: '#e34948', hint: 'القروض وتابي وتمارا والجامعة' },
    { id: 'life', name: 'جودة الحياة', icon: '🛍️', color: '#e87ba4', hint: 'الترفيه والأثاث والسفر والمتغير' },
    { id: 'safety', name: 'الأمان المالي', icon: '🛟', color: '#eda100', hint: 'الطوارئ ورمضان والعيد والأضحية' },
    { id: 'invest', name: 'الاستثمار', icon: '📈', color: '#1baf7a', hint: 'رأس مال المشروع والاستثمار' },
    { id: 'give', name: 'العطاء', icon: '🤲', color: '#6250d6', hint: 'الصدقة' }
  ];
  const SPLIT_IDS = SPLIT_BUCKETS.map(b => b.id);
  // النسب المستهدفة من الدخل لكل مرحلة (تتعدل من الإعدادات). المجموع 100.
  const SPLIT_PHASES = [
    { id: 1, name: 'مرحلة السداد', note: 'الأقساط المؤقتة أو الجامعة شغالة', targets: { basics: 39, commit: 35, life: 4, safety: 21, invest: 0, give: 1 } },
    { id: 2, name: 'مرحلة البناء', note: 'خلصت المؤقتة وبقت القروض', targets: { basics: 39, commit: 24, life: 22, safety: 10, invest: 3, give: 2 } },
    { id: 3, name: 'مرحلة الثروة', note: 'خلص القرض الرئيسي', targets: { basics: 39, commit: 1, life: 25, safety: 10, invest: 20, give: 5 } }
  ];
  const SPLIT_TARGET_GAP = 5;      // فرق النسبة (نقاط) اللي يستاهل تنبيه
  const SPLIT_PACE_WARN = 0.8;     // صرف 80٪ من القسم قبل ما يمضي 80٪ من الدورة
  const SEASON_LEAD_DAYS = 21;     // المبلغ الموسمي لازم يكتمل قبل موعده بثلاث أسابيع على الأقل
  const splitKey = (kind, id) => kind + ':' + id;
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const arDate = iso => { const [y, m, d] = String(iso).split('-').map(Number); return d + ' ' + AR_MONTHS[m - 1] + ' ' + y; };
  const splitNorm = t => String(t || '').replace(/^ال/, '').replace(/\sال/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();

  function defaultBucket(kind, x) {
    const n = String((x && x.name) || '');
    if (kind === 'variable') return 'life';
    if (kind === 'debt') return 'commit';
    if (kind === 'fixed') {
      if (x.id === 'f-charity' || /صدق|تبرع|زكا|إحسان|احسان/.test(n)) return 'give';
      if (x.id === 'f-uni' || /جامع|قسط|قرض/.test(n)) return 'commit';
      if (x.id === 'f-entertainment' || /ترفيه|سفر|هدايا|هدية|أثاث|اثاث|تأثيث|تاثيث/.test(n)) return 'life';
      return 'basics';
    }
    if (kind === 'goal') {
      if (x.emergency) return 'safety';
      if (x.id === 'g-investment' || /استثمار|مشروع|رأس ?مال|راس ?مال|أسهم|اسهم|صندوق/.test(n)) return 'invest';
      if (/سفر|أثاث|اثاث|تأثيث|تاثيث|ترفيه|جوال/.test(n) || x.id === 'g-travel' || x.id === 'g-istanbul') return 'life';
      if (/صدق|تبرع|زكا/.test(n)) return 'give';
      return 'safety';
    }
    return 'basics';
  }
  function splitSettings(s) {
    const sp = s.settings.split && typeof s.settings.split === 'object' ? s.settings.split : {};
    return { map: sp.map && typeof sp.map === 'object' ? sp.map : {}, phase: [1, 2, 3].includes(Number(sp.phase)) ? Number(sp.phase) : 0, targets: sp.targets && typeof sp.targets === 'object' ? sp.targets : {} };
  }
  function bucketOf(s, kind, x) {
    const m = splitSettings(s).map[kind === 'variable' ? 'variable' : splitKey(kind, x.id)];
    return SPLIT_IDS.includes(m) ? m : defaultBucket(kind, x);
  }
  function splitTargets(s, phase) {
    const base = (SPLIT_PHASES.find(p => p.id === phase) || SPLIT_PHASES[0]).targets;
    const own = splitSettings(s).targets[phase] || {};
    const out = {};
    for (const id of SPLIT_IDS) out[id] = Number.isFinite(Number(own[id])) && own[id] !== '' && own[id] !== null ? Number(own[id]) : base[id];
    return out;
  }
  // المرحلة: 1 طول ما فيه أقساط مؤقتة أو التزام ثابت مؤقت (الجامعة)، 2 طول ما فيه قرض كبير، 3 بعدها
  function splitPhaseFor(s, cycle, income) {
    const commitTemp = s.debts.some(d => d.kind === 'temp' && plannedFor(s, 'debt', d, cycle) > 0)
      || s.fixed.some(x => x.endCycle && bucketOf(s, 'fixed', x) === 'commit' && plannedFor(s, 'fixed', x, cycle) > 0);
    if (commitTemp) return 1;
    const big = s.debts.some(d => d.kind !== 'temp' && plannedFor(s, 'debt', d, cycle) >= Math.max(500, (income || 0) * 0.05));
    return big ? 2 : 3;
  }

  function splitPlan(s, sm, today) {
    today = today || new Date();
    const sd = s.settings.salaryDay;
    const T = sm.totals;
    const income = T.income.projected || T.income.confirmedPlanned || 0;
    const set = splitSettings(s);
    const phaseAuto = splitPhaseFor(s, sm.cycle, income);
    const phase = set.phase || phaseAuto;
    const targets = splitTargets(s, phase);
    const live = !sm.past && !sm.future;
    const B = {};
    for (const b of SPLIT_BUCKETS) B[b.id] = Object.assign({}, b, { planned: 0, actual: 0, projected: 0, flexPlanned: 0, flexActual: 0, items: [], target: targets[b.id] });
    const addLine = (l, kind) => {
      const b = B[bucketOf(s, kind, l.item)];
      b.planned += l.planned; b.actual += l.actual; b.projected += l.projected;
      const flex = kind === 'fixed' && (l.item.flexible || isWallet(l.item));
      if (flex) { b.flexPlanned += l.planned; b.flexActual += l.actual; }
      b.items.push({ kind, id: l.id, name: l.name, icon: l.item.icon || '', planned: l.planned, actual: l.actual, state: l.state, flex });
    };
    sm.lines.fixed.forEach(l => addLine(l, 'fixed'));
    [...sm.lines.debtsTemp, ...sm.lines.debtsFixed].forEach(l => addLine(l, 'debt'));
    sm.lines.goals.forEach(l => addLine(l, 'goal'));
    if (T.variable.actual > 0) {
      const b = B[bucketOf(s, 'variable', {})];
      b.actual += T.variable.actual; b.projected += T.variable.actual; b.flexActual += T.variable.actual;
      b.items.push({ kind: 'variable', id: '', name: 'المصاريف المتغيرة', icon: '🧾', planned: 0, actual: T.variable.actual, state: 'extra', flex: true });
    }
    const pctOf = v => income > 0 ? round2(v / income * 100) : 0;
    const buckets = SPLIT_BUCKETS.map(x => {
      const b = B[x.id];
      for (const k of ['planned', 'actual', 'projected', 'flexPlanned', 'flexActual']) b[k] = round2(b[k]);
      b.share = pctOf(b.planned);
      b.actualShare = pctOf(b.actual);
      b.left = round2(b.planned - b.actual);
      b.pct = b.planned > 0 ? b.actual / b.planned : (b.actual > 0 ? 2 : 0);
      b.targetAmount = round2(income * b.target / 100);
      b.gap = round2(b.share - b.target);   // موجب = الخطة أعلى من المستهدف
      const flexRatio = b.flexPlanned > 0 ? b.flexActual / b.flexPlanned : 0;
      b.level = b.planned <= 0 && b.actual <= 0 ? 'none'
        : b.actual > b.planned + 0.009 ? 'over'
        : live && b.flexPlanned > 0 && flexRatio >= SPLIT_PACE_WARN && sm.timePct < SPLIT_PACE_WARN ? 'fast'
        : 'ok';
      b.items.sort((p, q) => q.planned - p.planned || q.actual - p.actual);
      return b;
    });
    const plannedTotal = sum(buckets, b => b.planned), actualTotal = sum(buckets, b => b.actual);
    const free = round2(income - plannedTotal);

    /* التنبيهات */
    const alerts = [];
    const fmtN = n => (Math.round(n * 100) / 100).toLocaleString('en-US');
    const add = (level, icon, title, text, extra) => alerts.push(Object.assign({ level, icon, title, text }, extra || {}));
    for (const b of buckets) {
      if (b.level === 'over') {
        const top = b.items.filter(i => i.actual > i.planned + 0.009).sort((p, q) => (q.actual - q.planned) - (p.actual - p.planned)).slice(0, 3);
        add('bad', '🔺', `«${b.name}» تعدّى خطته بـ ${fmtN(b.actual - b.planned)} ر.س`, top.length ? 'السبب: ' + top.map(i => `${i.name} (+${fmtN(i.actual - i.planned)})`).join('، ') : 'المسجل أكثر من المخطط لهذا القسم.', { bucket: b.id });
      } else {
        // القسم ككل ضمن الخطة، لكن فيه بند ثابت تعدّى (الفرق ماكل من بنود ثانية بنفس القسم)
        const ov = b.items.filter(i => i.kind === 'fixed' && i.actual > i.planned + 0.009);
        if (ov.length) add('warn', '🔸', `داخل «${b.name}»: ${ov.map(i => `«${i.name}»`).join(' و')} تعدّى`, `${ov.map(i => `${i.name} +${fmtN(i.actual - i.planned)}`).join('، ')}. القسم ككل باقي فيه ${fmtN(b.left)} ر.س، بس الزيادة بتاكل من بنوده الثانية.`, { bucket: b.id, noBell: true });
      }
      if (b.level === 'fast') {
        add('warn', '⏱️', `«${b.name}» يصرف أسرع من الدورة`, `صرفت ${Math.round(b.flexActual / b.flexPlanned * 100)}٪ من الصرف المرن، والدورة ماشية ${Math.round(sm.timePct * 100)}٪ بس.`, { bucket: b.id });
      }
    }
    if (income > 0 && !sm.past) {
      for (const b of buckets) {
        if (b.id === 'commit') continue;   // الالتزامات ما تتغير بقرار شهري
        const up = ['basics', 'life'].includes(b.id);
        if (up && b.gap >= SPLIT_TARGET_GAP) add('warn', '⚖️', `«${b.name}» أعلى من المستهدف`, `خطتك تعطيه ${Math.round(b.share)}٪ من الدخل والمستهدف ${b.target}٪ (فرق ${fmtN(b.planned - b.targetAmount)} ر.س).`, { bucket: b.id });
        if (!up && b.gap <= -SPLIT_TARGET_GAP) add('info', '⚖️', `«${b.name}» أقل من المستهدف`, `خطتك تعطيه ${Math.round(b.share)}٪ والمستهدف ${b.target}٪ (ينقصه ${fmtN(b.targetAmount - b.planned)} ر.س).`, { bucket: b.id });
      }
      if (free < -0.009) add('bad', '⛔', `الأقسام أكثر من الدخل بـ ${fmtN(-free)} ر.س`, 'مجموع المخطط في الأقسام الستة أكبر من الدخل المتوقع.');
      else if (income && free / income * 100 >= SPLIT_TARGET_GAP) add('info', '🧩', `${fmtN(free)} ر.س بدون قسم`, 'جزء من الراتب ما له مكان في الخطة. حطه في هدف (الطوارئ أو الأثاث) عشان ما يضيع في المصروف.');
    }
    // تداخل: نفس البند مكرر، أو عملية متكررة، أو مصروف متغير هو نفسه بند مخطط
    const named = new Map();
    for (const b of buckets) for (const i of b.items) {
      if (i.kind === 'variable' || !(i.planned > 0)) continue;
      const k = splitNorm(i.name);
      if (k.length < 2) continue;
      if (!named.has(k)) named.set(k, []);
      named.get(k).push(Object.assign({ bucket: b.id }, i));
    }
    const kindName = { fixed: 'بند ثابت', debt: 'دين', goal: 'هدف' };
    for (const [, list] of named) {
      if (list.length < 2) continue;
      add('warn', '🔁', `«${list[0].name}» موجود ${list.length} مرات`, `مسجل ك${list.map(i => kindName[i.kind] || i.kind).join(' و')} — ممكن ينحسب مرتين. احذف واحد أو غيّر اسمه.`, { bucket: list[0].bucket });
    }
    const cyc = s.entries.filter(e => !e.legacy && cycleOf(e.date, sd) === sm.cycle);
    const dup = new Map();
    for (const e of cyc) {
      if (e.kind === 'income') continue;
      const k = [e.kind, e.ref || splitNorm(e.note), round2(e.amount), e.date].join('|');
      dup.set(k, (dup.get(k) || []).concat(e));
    }
    for (const [, list] of dup) {
      if (list.length < 2) continue;
      const e = list[0];
      add('warn', '👯', `عملية مكررة: ${fmtN(e.amount)} ر.س`, `${list.length} مرات على «${e.note || itemName(s, e.kind, e.ref)}» بنفس اليوم (${arDate(e.date)}). إذا مو مقصودة احذف الزايدة.`, { entry: e.id });
    }
    const plannedLines = [...sm.lines.fixed.filter(l => !isWallet(l.item) && !l.item.flexible), ...sm.lines.debtsTemp, ...sm.lines.debtsFixed, ...sm.lines.goals].filter(l => l.planned > 0);
    for (const e of sm.variable) {
      const nk = splitNorm(e.note);
      if (nk.length < 3) continue;
      const l = plannedLines.find(l => { const ln = splitNorm(l.name); return ln.length >= 3 && (nk.includes(ln) || ln.includes(nk)); });
      if (l && l.actual < l.planned - 0.009) add('warn', '🔀', `«${e.note}» مسجل متغير`, `وهو نفس بند «${l.name}» اللي لسا ما انسجل له دفع. لو هو نفسه، انقله للبند عشان ما ينحسب مرتين.`, { entry: e.id });
    }
    // الشهر الجاي: فلوس تتحرر من الالتزامات، أو تغيّر المرحلة
    const next = shiftCycle(sm.cycle, 1);
    if (!sm.past) {
      const commitNext = sum([...s.debts.map(d => ['debt', d]), ...s.fixed.map(x => ['fixed', x])].filter(([k, x]) => bucketOf(s, k, x) === 'commit'), ([k, x]) => plannedFor(s, k, x, next));
      const freed = round2(B.commit.planned - commitNext);
      if (freed >= 50) add('good', '🎉', `يتحرر ${fmtN(freed)} ر.س من الشهر الجاي`, 'أقساط تخلص هالدورة. حدد من الحين وين يروح المبلغ (طوارئ، أثاث، أضحية) قبل ما يذوب في المصروف.');
      const pn = set.phase ? set.phase : splitPhaseFor(s, next, income);
      if (!set.phase && pn !== phaseAuto) add('good', '🚀', `الشهر الجاي تنتقل لـ«${SPLIT_PHASES.find(p => p.id === pn).name}»`, 'النسب المستهدفة بتتغير تلقائيًا.');
    }

    /* عدّاد المواسم: الأهداف اللي لها موعد */
    const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const seasons = s.goals.filter(g => g.active !== false && g.target > 0 && g.targetDate).map(g => {
      const saved = goalSaved(s, g);
      const due = new Date(g.targetDate + 'T12:00:00');
      const daysLeft = Math.ceil((new Date(due.getFullYear(), due.getMonth(), due.getDate()) - todayD) / 864e5);
      const deadline = cycleOf(g.targetDate, sd);
      let lastCycle = '';
      for (let c = sm.current, i = 0; c <= deadline && i < 36; c = shiftCycle(c, 1), i++) if (plannedFor(s, 'goal', g, c) > 0) lastCycle = c;
      const readyDate = lastCycle ? isoDate(cycleStart(lastCycle, sd)) : '';
      const leadDays = readyDate ? Math.round((due - new Date(readyDate + 'T12:00:00')) / 864e5) : null;
      const done = saved >= g.target - 0.009;
      const status = done ? 'done' : daysLeft < 0 ? 'past' : leadDays !== null && leadDays < SEASON_LEAD_DAYS ? 'late' : 'ok';
      return { id: g.id, name: g.name, icon: g.icon || '🎯', target: g.target, saved, pct: Math.min(1, saved / g.target), targetDate: g.targetDate, daysLeft, readyDate, leadDays, status, bucket: bucketOf(s, 'goal', g) };
    }).filter(x => x.daysLeft >= -3).sort((a, b) => a.daysLeft - b.daysLeft);
    for (const x of seasons) if (x.status === 'late' && !sm.past) add('warn', x.icon, `«${x.name}» يكتمل متأخر`, `آخر دفعة مع راتب ${arDate(x.readyDate)}، يعني قبل الموعد بـ ${x.leadDays} يوم بس. قدّم جزء منها لراتب أبكر.`, { goal: x.id });

    const rank = { bad: 0, warn: 1, info: 2, good: 3 };
    alerts.sort((a, b) => rank[a.level] - rank[b.level]);
    return { income, phase, phaseAuto, phaseInfo: SPLIT_PHASES.find(p => p.id === phase), manualPhase: !!set.phase, targets, buckets, plannedTotal, actualTotal, free, alerts, seasons };
  }

  /* ───────── تجاهل الرسائل ───────── */
  // رسائل ما لها علاقة بالصرف (حوالات بين حساباتك، تنبيهات…): تُتجاهل بالنص نفسه أو بكلمة مفتاحية
  const IGNORE_CAP = 400;
  function ignoreMatch(s, text, hash) {
    if (hash && (s.ignored || []).includes(hash)) return 'hash';
    const t = String(text || '').toLowerCase();
    for (const r of (s.settings.ignoreRules || [])) if (r.key && t.includes(String(r.key).toLowerCase())) return r.key;
    return '';
  }
  function addIgnore(s, hash) {
    if (!hash || (s.ignored || []).includes(hash)) return;
    s.ignored = (s.ignored || []).concat(hash).slice(-IGNORE_CAP);
  }
  function addIgnoreRule(s, key) {
    key = String(key || '').trim().slice(0, 60);
    if (key.length < 3) return false;
    const rules = s.settings.ignoreRules = s.settings.ignoreRules || [];
    if (rules.some(r => r.key.toLowerCase() === key.toLowerCase())) return false;
    rules.push({ id: uid(), key, at: isoDate(new Date()) });
    return true;
  }
  // اقتراح كلمة التجاهل من الرسالة: الجهة/التاجر أو أول عبارة مميزة
  function suggestIgnoreKey(p) {
    if (p.merchant && p.merchant.length >= 3) return p.merchant.slice(0, 40);
    const m = String(p.raw || '').match(/(حوالة[^\n\r.،:]{0,25}|تحويل[^\n\r.،:]{0,25}|Transfer[^\n\r.,:]{0,25})/i);
    return m ? m[1].trim() : '';
  }

  /* ───────── المراقب: محلل مالي ───────── */
  function itemName(s, kind, ref) {
    const list = kind === 'fixed' ? s.fixed : kind === 'debt' ? s.debts : kind === 'goal' ? s.goals : kind === 'income' ? s.income : [];
    const it = (list || []).find(x => x.id === ref);
    return it ? it.name : (kind === 'variable' ? 'مصروف متغير' : '—');
  }
  const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  function monitor(s, sm, today) {
    today = today || new Date();
    const todayStr = isoDate(today), sd = s.settings.salaryDay;
    const fmtN = n => (Math.round(Math.abs(n) * 100) / 100).toLocaleString('en-US');
    const inCycle = s.entries.filter(e => cycleOf(e.date, sd) === sm.cycle);
    const spend = inCycle.filter(e => e.kind !== 'income');
    const spentTotal = sum(spend, e => e.amount);
    const out = { cycle: sm.cycle, todayStr };

    // ① آخر الحركات + أيام الصرف
    const day = n => isoDate(new Date(today.getTime() - n * 864e5));
    out.days = []; for (let i = 13; i >= 0; i--) { const d = day(i), es = s.entries.filter(e => e.date === d && e.kind !== 'income'); out.days.push({ date: d, total: sum(es, e => e.amount), count: es.length }); }
    out.recent = s.entries.slice().sort((a, b) => b.date.localeCompare(a.date) || 0).slice(0, 8).map(e => ({ id: e.id, date: e.date, amount: e.amount, kind: e.kind, income: e.kind === 'income', note: e.note || '', bank: e.bank || '', name: itemName(s, e.kind, e.ref), source: e.source || '' }));
    const wk = out.days.slice(7), pw = out.days.slice(0, 7);
    out.week = { now: sum(wk, d => d.total), prev: sum(pw, d => d.total) };
    out.week.deltaPct = out.week.prev > 0 ? Math.round((out.week.now - out.week.prev) / out.week.prev * 100) : null;
    out.todaySpent = (out.days[13] || {}).total || 0;

    // ② توزيع الصرف
    const kindLbl = { fixed: 'مصاريف ثابتة', debt: 'ديون وأقساط', goal: 'أهداف وادخار', variable: 'مصاريف متغيرة' };
    out.byKind = Object.keys(kindLbl).map(k => ({ key: k, label: kindLbl[k], amount: sum(spend.filter(e => e.kind === k), e => e.amount) })).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);
    const grp = (rows, keyf) => { const m = new Map(); for (const e of rows) { const k = keyf(e); if (!k) continue; const o = m.get(k) || { label: k, amount: 0, count: 0 }; o.amount = round2(o.amount + e.amount); o.count++; m.set(k, o); } return [...m.values()].sort((a, b) => b.amount - a.amount); };
    out.byBank = grp(spend, e => { const b = BANKS.find(x => x.id === e.bank); return b ? b.name : (e.bank || ''); }).slice(0, 5);
    const flex = spend.filter(e => e.kind === 'variable' || isWallet(s.fixed.find(f => f.id === e.ref)) || (s.fixed.find(f => f.id === e.ref) || {}).flexible);
    out.topMerchants = grp(flex, e => (e.note || '').trim().toLowerCase() ? e.note.trim() : '').slice(0, 5);
    out.biggest = spend.slice().sort((a, b) => b.amount - a.amount).slice(0, 3).map(e => ({ date: e.date, amount: e.amount, name: e.note || itemName(s, e.kind, e.ref) }));
    out.spentTotal = spentTotal; out.entriesCount = spend.length;

    // ③ المقارنة بالدورة السابقة
    let prev = null;
    try { const ps = summarize(s, shiftCycle(sm.cycle, -1), today); prev = { out: ps.outActual, flex: sum(s.entries.filter(e => cycleOf(e.date, sd) === ps.cycle && e.kind === 'variable'), e => e.amount) }; } catch (e) { /* لا شيء */ }
    out.prev = prev;

    // ④ شذوذ
    out.anomalies = [];
    const varAmts = s.entries.filter(e => e.kind === 'variable').map(e => e.amount);
    const med = median(varAmts), thr = Math.max(300, med * 4);
    if (varAmts.length >= 4) for (const e of spend.filter(x => x.kind === 'variable' && x.amount >= thr).slice(0, 3)) out.anomalies.push({ type: 'big', text: `عملية كبيرة غير معتادة: ${e.note || 'مصروف'} ${fmtN(e.amount)} ر.س في \u2066${e.date}\u2069 (المعتاد حوالي ${fmtN(med)})` });
    const seen = new Map();
    for (const e of spend) { const k = [e.kind, e.ref, e.amount, e.date, (e.note || '').toLowerCase()].join('|'); seen.set(k, (seen.get(k) || 0) + 1); }
    for (const [k, c] of seen) if (c > 1) { const [, , amt, date, note] = k.split('|'); out.anomalies.push({ type: 'dup', text: `عملية مكررة ${c} مرات: ${note || 'بدون وصف'} ${fmtN(+amt)} ر.س بتاريخ \u2066${date}\u2069. تأكد أنها مو مسجلة مرتين` }); }

    // ⑤ المهام
    const T = sm.tasks || { open: [], overdue: [] };
    out.overdue = { count: T.overdue.length, total: sum(T.overdue, i => i.remaining), top: T.overdue.slice(0, 3).map(i => i.name) };
    const soon = T.open.filter(i => !i.overdue && i.due >= todayStr && i.due <= isoDate(new Date(today.getTime() + 7 * 864e5)));
    out.upcoming = { count: soon.length, total: sum(soon, i => i.remaining), items: soon.slice(0, 4).map(i => ({ name: i.name, due: i.due, amount: i.remaining })) };

    // ⑥ الوضع العام والسرعة
    const sp = sm.spend || {};
    const live = sm.cycle === sm.current && !sm.past && !sm.future;
    out.live = live; out.surplus = sm.past ? sm.recordedNet : sm.projectedSurplus;
    out.health = sm.health; out.pace = { ratio: sp.paceRatio || 0, daily: sp.daily || 0, daysLeft: sp.daysLeft || 0, flexRemaining: sp.flexRemaining || 0, budget: sp.budget || 0, spent: sp.spent || 0, projectedEnd: sp.projectedEnd };
    out.income = { planned: sm.totals.income.confirmedPlanned, actual: sm.totals.income.actual };
    out.daysToSalary = sm.daysToSalary;

    // ⑦ تنبيهات + نصائح مرتبة بالأهمية
    const L = [];   // {level, title, text, w}
    const add = (level, title, text, w) => L.push({ level, title, text, w });
    const noIncome = !out.income.planned && !out.income.actual;
    if (noIncome) add('bad', 'ما أقدر أحلل بدون دخل', 'أدخل راتبك المتوقع عشان أحسب لك كل شيء.', 100);
    else {
      if (out.surplus < 0) add('bad', `الدورة متجهة لعجز ${fmtN(out.surplus)} ر.س`, 'المصروف المتوقع أكبر من دخلك. أوقف الصرف غير الضروري وراجع البنود المرنة.', 95);
      if (out.overdue.count) add('bad', `${out.overdue.count} مهام متأخرة بمجموع ${fmtN(out.overdue.total)} ر.س`, `ابدأ بـ ${out.overdue.top.join('، ')}. التأخير يعرضك لرسوم أو إزعاج، والفائض الحقيقي أقل مما يظهر.`, 90);
      for (const w of sm.wallets || []) {
        if (w.level === 'over') add('bad', `تجاوزت محفظة «${w.name}» بـ ${fmtN(w.left)} ر.س`, 'الزيادة تخصم من الفائض مباشرة.', 85);
        else if (w.level === 'empty') add('bad', `محفظة «${w.name}» خلصت`, 'أي صرف إضافي منها يعتبر تجاوز.', 80);
        else if (w.level === 'low' && live) add('warn', `محفظة «${w.name}» باقي منها ${fmtN(w.left)} فقط`, `تكفي ${sp.daysLeft || 0} يوم بمعدل ${fmtN(w.left / Math.max(1, sp.daysLeft || 1))} ر.س يوميًا.`, 70);
      }
      if (live && out.pace.ratio > 1.15 && out.pace.spent > 0) add('warn', `صرفك أسرع من المخطط بـ ${Math.round((out.pace.ratio - 1) * 100)}٪`, `بنفس السرعة تصرف ${fmtN(out.pace.projectedEnd || 0)} من ${fmtN(out.pace.budget)}. للرجوع للمعدل لا تتعدى ${fmtN(out.pace.flexRemaining / Math.max(1, out.pace.daysLeft))} ر.س يوميًا.`, 75);
      else if (live && out.pace.spent > 0 && out.pace.ratio < 0.8) add('good', 'صرفك أقل من المخطط', `توفر تقريبًا ${fmtN(out.pace.budget - (out.pace.projectedEnd || out.pace.spent))} ر.س لو كملت كذا.`, 40);
      if (live && out.todaySpent > out.pace.daily + 0.009 && out.pace.daily > 0) add('warn', `صرفت اليوم ${fmtN(out.todaySpent)} والمسموح ${fmtN(out.pace.daily)}`, `الزيادة ${fmtN(out.todaySpent - out.pace.daily)} ر.س تنخصم من أيام الباقي.`, 65);
      if (out.week.deltaPct !== null && out.week.deltaPct >= 30 && out.week.now > 200) add('warn', `صرف هذا الأسبوع أعلى بـ ${out.week.deltaPct}٪ من الأسبوع اللي قبله`, `${fmtN(out.week.now)} مقابل ${fmtN(out.week.prev)} ر.س.`, 55);
      if (out.prev && out.prev.flex > 0) { const cur = sum(spend.filter(e => e.kind === 'variable'), e => e.amount); if (sm.cycle === sm.current && cur > out.prev.flex * 1.0 && cur > 300) add('warn', 'المتغير تجاوز ما صرفته الدورة الماضية', `${fmtN(cur)} مقابل ${fmtN(out.prev.flex)} ر.س لكل الدورة السابقة.`, 50); }
      const mTop = out.topMerchants[0], flexTotal = sum(flex, e => e.amount);
      if (mTop && flexTotal > 300 && mTop.amount / flexTotal >= 0.35 && mTop.count >= 2) add('warn', `«${mTop.label}» يستهلك ${Math.round(mTop.amount / flexTotal * 100)}٪ من مصروفك المرن`, `${fmtN(mTop.amount)} ر.س في ${mTop.count} عمليات. هل هذا مقصود؟`, 45);
      for (const a of out.anomalies) add('warn', a.type === 'dup' ? 'عملية مكررة محتملة' : 'عملية غير معتادة', a.text, 60);
      if (out.upcoming.count) add('info', `${out.upcoming.count} استحقاقات خلال 7 أيام بمجموع ${fmtN(out.upcoming.total)} ر.س`, out.upcoming.items.map(i => `${i.name} ${fmtN(i.amount)}`).join(' · '), 35);
      const unconf = s.income.filter(x => x.confirmed === false && x.id !== 'i-salary');
      if (unconf.length) add('info', 'دخل غير مؤكد ما يدخل في الحساب', `${unconf.map(x => x.name).join('، ')}. لو وصل علّمه مؤكد.`, 20);
      try {
        const fc = forecast(s, sm.cycle, 6, today).slice(1), neg = fc.find(f => f.surplus < 0);
        if (neg) add('warn', `عجز متوقع في دورة ${neg.cycle}`, `الفائض المتوقع ${fmtN(neg.surplus)} ر.س سالب. راجع الأقساط أو الأهداف قبلها.`, 62);
      } catch (e) { /* لا شيء */ }
      const weak = ((sm.health || {}).factors || []).slice().sort((a, b) => a.score - b.score)[0];
      if (weak && weak.score < 60) add('info', `أضعف نقطة: ${weak.label}`, weak.note, 30);
      if (!L.some(x => x.level === 'bad' || x.level === 'warn')) add('good', 'ما فيه شيء يستدعي القلق', 'الدورة ماشية على الخطة. استمر.', 10);
    }
    L.sort((a, b) => b.w - a.w);
    out.alerts = L;
    const bad = L.filter(x => x.level === 'bad').length, warn = L.filter(x => x.level === 'warn').length;
    out.level = noIncome ? 'unknown' : bad ? 'bad' : warn ? 'warn' : 'good';
    const lead = noIncome ? 'أدخل راتبك المتوقع عشان أبدأ.' : out.level === 'bad' ? 'تحتاج تدخل الحين: ' + L[0].title + '.' : out.level === 'warn' ? 'الوضع مقبول لكن فيه ملاحظات: ' + L[0].title + '.' : 'الوضع ممتاز ومستقر.';
    const bits = [];
    if (!noIncome) {
      bits.push(`الفائض المتوقع ${out.surplus < 0 ? 'عجز ' : ''}${fmtN(out.surplus)} ر.س`);
      if (live) bits.push(`صرفت ${fmtN(out.pace.spent)} من ميزانيتك المرنة ${fmtN(out.pace.budget)}، وباقي ${out.daysToSalary} يوم للراتب`);
      if (out.entriesCount) bits.push(`سجلت ${out.entriesCount} عملية بمجموع ${fmtN(spentTotal)} ر.س هذي الدورة`);
    }
    out.summary = { lead, text: bits.join('. ') + (bits.length ? '.' : '') };
    return out;
  }

  const api = { splitPlan, SPLIT_BUCKETS, SPLIT_PHASES, bucketOf, defaultBucket, splitTargets, splitKey, autoTarget, ignoreMatch, addIgnore, addIgnoreRule, suggestIgnoreKey, monitor, itemName, VERSION, REVISION, applyRevision, taskList, dueDate, WALLETS, isWallet, walletLevel, DEFAULT_WALLET_BANKS, remainingToSpend, auditPlan, applyAudit, spendInfo, debtFreedom, budgetPace, resolveTarget, parseMaliClip, parseSms, splitSms, suggestForSms, smsHash, STORE_KEY, LEGACY_KEY, BANKS, THEMES, uid, round2, sum, isoDate, cycleStart, cycleEnd, shiftCycle, cycleOf, cyclesBetween, defaultSettings, emptyState, seedState, migrateLegacy, normalize, loadState, plannedFor, debtRemaining, goalSaved, itemLine, summarize, health, insights, forecast, KIND_LIST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
