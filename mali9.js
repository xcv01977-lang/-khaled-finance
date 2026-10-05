/* مالي V9 — الواجهة */
(function () {
  'use strict';
  const C = window.Core;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };

  // أيقونات خطية موحدة (24×24)
  const ICON = {
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 5.1A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2',
    bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 19a2 2 0 0 0 4 0',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    auto: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18',
    home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    check: 'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h2',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    grid: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
    plus: 'M12 5v14M5 12h14',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'
  };
  const svg = (d, size = 20, w = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;

  let S = C.loadState({ getItem: k => store.get(k) });
  let viewCycle = C.cycleOf(new Date(), S.settings.salaryDay);
  let undoSnap = null;
  // قبل بداية الخطة نفتح على أول دورة فيها، وإلا إذا الدورة الحالية فاضية نفتح على التالية
  if (S.settings.planStart && viewCycle < S.settings.planStart) viewCycle = S.settings.planStart;
  else {
    const first = C.summarize(S, viewCycle, new Date());
    if (!first.outPlanned && !first.totals.income.confirmedPlanned && !first.outActual && !first.totals.income.actual) viewCycle = C.shiftCycle(viewCycle, 1);
  }
  if (!store.get(C.STORE_KEY)) persist(); // أول تشغيل: نحفظ البيانات المرحّلة أو الافتراضية

  /* ───────── أدوات العرض ───────── */
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const money = (n, opt = {}) => `<span class="num money">${opt.sign && n > 0 ? '+' : ''}${nf.format(C.round2(n))}</span>${opt.cur === false ? '' : ' <span class="cur">ر.س</span>'}`;
  const plain = n => nf.format(C.round2(n));
  const toNum = v => Number(String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.').replace(/[^\d.\-]/g, '')) || 0;
  const monthName = (cycle, opts = { month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', opts).format(C.cycleStart(cycle, 1));
  const dayFmt = d => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' }).format(d);
  const hijriFmt = d => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { month: 'long', year: 'numeric' }).format(d);
  const allBanks = () => [...C.BANKS, ...S.settings.customBanks];
  const bankById = id => allBanks().find(b => b.id === id);
  const bankTag = id => { const b = bankById(id); return b ? `<span class="bank" style="--bc:${esc(b.color)}">${esc(b.name)}</span>` : ''; };
  const arrOf = kind => ({ income: S.income, fixed: S.fixed, debt: S.debts, goal: S.goals })[kind];
  const findItem = (kind, id) => (arrOf(kind) || []).find(x => x.id === id);
  const STATUS_COLOR = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', muted: 'var(--muted)' };

  function persist() { store.set(C.STORE_KEY, JSON.stringify(S)); }
  function commit(msg, opts = {}) {
    persist(); render();
    if (msg) toast(msg, opts.undo !== false && undoSnap);
  }
  function snapshot() { undoSnap = JSON.stringify(S); store.set('mali-v9-undo', undoSnap); }
  function undo() {
    const snap = undoSnap || store.get('mali-v9-undo');
    if (!snap) return;
    S = C.normalize(JSON.parse(snap)); undoSnap = null; persist(); render(); toast('تم التراجع');
  }

  let toastTimer;
  function toast(msg, canUndo) {
    const t = $('toast');
    t.innerHTML = `<span>${esc(msg)}</span>${canUndo ? '<button type="button" id="undoBtn">تراجع</button>' : ''}`;
    t.classList.add('show');
    if (canUndo) $('undoBtn').onclick = () => { t.classList.remove('show'); undo(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), canUndo ? 4500 : 2200);
  }

  /* ───────── التحكم بالألوان ───────── */
  // كل لون: [المفتاح، الاسم، متغيرات CSS، الافتراضي نهاري، الافتراضي ليلي]
  const COLOR_KEYS = [
    ['hero', 'التوهج (الخلفية)', ['--hero'], '#7B61FF', '#7B61FF'],
    ['accent', 'اللون المميز', ['--accent'], '#6D4FF0', '#7B61FF'],
    ['cta', 'اللون الثانوي (التدرج)', ['--cta'], '#0E9F76', '#1FD6A3'],
    ['bg', 'الخلفية', ['--bg', '--bg2'], '#EEF1F8', '#060A13'],
    ['card', 'البطاقات', ['--card'], '#FFFFFF', '#0F1626'],
    ['text', 'النص', ['--text'], '#0E1424', '#F2F5FB'],
    ['muted', 'النص الخافت', ['--muted'], '#5B6479', '#8A94AD'],
    ['good', 'أخضر (جيد)', ['--good'], '#0E9F76', '#1FD6A3'],
    ['warn', 'برتقالي (تنبيه)', ['--warn'], '#B7791F', '#F6C945'],
    ['bad', 'أحمر (متأخر)', ['--bad'], '#D6455A', '#FF6B6B']
  ];
  const COLOR_PRESETS = [
    { name: 'نيون (الافتراضي)', c: '#7B61FF', l: {}, d: {} },
    { name: 'محيطي', c: '#1C6B86', l: { hero: '#1C6B86', accent: '#1C6B86', cta: '#0E9F76', bg: '#F3F7F9' }, d: { hero: '#1F7C9B', accent: '#3AA0C4', cta: '#5FC59A', bg: '#0B1A20', card: '#122730' } },
    { name: 'ذهبي', c: '#D4A017', l: { hero: '#D4A017', accent: '#B7791F', cta: '#D4A017', bg: '#FAF7F0' }, d: { hero: '#D4A017', accent: '#F6C945', cta: '#F6C945', bg: '#0C0A06', card: '#17130A' } },
    { name: 'وردي', c: '#E11D74', l: { hero: '#E11D74', accent: '#C2185B', cta: '#E11D74', bg: '#FDF4F8' }, d: { hero: '#E11D74', accent: '#FF6FAE', cta: '#FF6FAE', bg: '#12060C', card: '#1D0C14' } }
  ];
  let appliedColors = [];
  function applyColors(dark) {
    const root = document.documentElement, set = (S.settings.colors || {})[dark ? 'dark' : 'light'] || {};
    appliedColors.forEach(v => { if (v !== '--accent') root.style.removeProperty(v); });
    appliedColors = [];
    for (const [k, , vars] of COLOR_KEYS) {
      const v = set[k];
      if (!/^#[0-9a-fA-F]{6}$/.test(v || '')) continue;
      vars.forEach(n => { root.style.setProperty(n, v); appliedColors.push(n); });
    }
  }
  const isDarkNow = () => S.settings.mode === 'dark' || (S.settings.mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

  /* ───────── الثيم ───────── */
  function applyTheme() {
    const st = S.settings, root = document.documentElement;
    const theme = C.THEMES.find(t => t.id === st.theme) || C.THEMES[0];
    root.style.setProperty('--accent', st.theme === 'custom' && st.accent ? st.accent : theme.accent);
    if (st.mode === 'light' || st.mode === 'dark') root.dataset.theme = st.mode; else delete root.dataset.theme;
    const dark = st.mode === 'dark' || (st.mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    applyColors(dark);
    document.querySelector('meta[name=theme-color]').content = dark ? '#1F7C9B' : '#1C6B86';
    document.body.classList.toggle('privacy', !!st.hideAmounts);
    $('eyeBtn').innerHTML = svg(st.hideAmounts ? ICON.eyeOff : ICON.eye, 20);
    $('settingsBtn').innerHTML = svg(ICON.gear, 20);
    $('eyeBtn').setAttribute('aria-pressed', st.hideAmounts ? 'true' : 'false');
    const md = st.mode === 'light' ? 'light' : st.mode === 'dark' ? 'dark' : 'auto';
    $('modeBtn').innerHTML = svg(md === 'light' ? ICON.sun : md === 'dark' ? ICON.moon : ICON.auto, 20);
    $('modeBtn').title = md === 'light' ? 'نهاري' : md === 'dark' ? 'ليلي' : 'تلقائي';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  /* ───────── الرسم الرئيسي ───────── */
  let sm;
  function render() {
    applyTheme();
    sm = C.summarize(S, viewCycle, new Date());
    const h = new Date().getHours();
    $('greet').textContent = h < 12 ? 'صباح الخير' : 'مساء الخير';
    $('who').textContent = S.settings.name ? `يا ${S.settings.name}` : 'وضعك المالي';
    renderCycle(); renderHero(); renderInsights(); renderSections(); renderTabbar(); renderBell();
    $('foot').innerHTML = `مالي V${C.VERSION} · البيانات على جهازك فقط · <a href="./old.html">النسخة السابقة</a>`;
  }

  function renderCycle() {
    const tag = sm.cycle === sm.current ? '<span class="tag">الحالية</span>' : sm.past ? '<span class="tag">سابقة</span>' : '<span class="tag">قادمة</span>';
    const hij = S.settings.hijri ? ' · ' + hijriFmt(sm.start) : '';
    $('cycleName').innerHTML = `<b>راتب ${monthName(sm.cycle)} ${tag}</b><small>${dayFmt(sm.start)} – ${dayFmt(sm.end)}${hij}</small>`;
  }

  /* ───────── الداشبورد: ملخص ذكي + بطاقات تسحبها ───────── */
  function briefSentence() {
    const H = sm.health, sp = sm.spend, f = n => plain(Math.abs(n));
    if (H.level === 'unknown') return 'أدخل راتبك المتوقع عشان أبدأ أحسب لك كل شيء.';
    if (sm.past) return `دورة منتهية. الصافي حسب المسجل ${sm.recordedNet < 0 ? 'عجز' : 'فائض'} ${f(sm.recordedNet)} ر.س.`;
    if (sm.future) return `خطة هذا الراتب: فائض ${f(sm.planSurplus)} ر.س، وميزانيتك المرنة ${f(sp.budget)} ر.س.`;
    if (sm.projectedSurplus < 0) return `انتبه: الدورة متجهة لعجز ${f(sm.projectedSurplus)} ر.س. خفّف الصرف غير الضروري لين الراتب.`;
    if (sp.paceRatio > 1.2 && sp.spent > 0) return `صرفك أسرع من المخطط بـ ${Math.round((sp.paceRatio - 1) * 100)}٪. بنفس السرعة بتصرف ${f(sp.projectedEnd || 0)} من ${f(sp.budget)}.`;
    if (sp.spent > 0 && sp.paceRatio < 0.8) return `ممتاز، صرفك أقل من المخطط. لو كملت كذا بتوفر تقريبًا ${f(sp.budget - (sp.projectedEnd || sp.spent))} ر.س.`;
    if (sm.overs.length) return `ماشي، بس «${sm.overs[0].name}» تجاوز ميزانيته بـ ${f(sm.overs[0].amount)} ر.س.`;
    return `ماشي على الخطة. الفائض المتوقع ${f(sm.projectedSurplus)} ر.س.`;
  }

  /* مقياس نصف دائري: قطاعات (نسبة٪، لون) */
  function gaugeSVG(segs) {
    const w = 300, r = 104, cx = w / 2, cy = 124, L = Math.PI * r, arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
    let off = 0, out = `<path d="${arc}" stroke="var(--gTrack)" stroke-width="16" fill="none" stroke-linecap="round"/>`;
    for (const [pct, col] of segs) {
      if (!(pct > 0)) continue;
      const len = Math.max(1, L * pct / 100 - 5);
      out += `<path d="${arc}" stroke="${col}" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${L.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`;
      off += L * pct / 100;
    }
    return `<svg viewBox="0 0 ${w} 140" class="gSvg" aria-hidden="true">${out}</svg>`;
  }
  function sparkSVG(pts, w = 120, h = 54) {
    if (!pts.length) return '';
    if (pts.length === 1) pts = [pts[0], pts[0]];
    const mx = Math.max(...pts), mn = Math.min(...pts), rng = mx - mn || 1;
    const xs = pts.map((_, i) => i * w / (pts.length - 1)), ys = pts.map(p => h - 6 - (p - mn) / rng * (h - 14));
    const d = 'M' + xs.map((x, i) => `${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' L');
    return `<svg viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--good)" stop-opacity=".35"/><stop offset="1" stop-color="var(--good)" stop-opacity="0"/></linearGradient></defs><path d="${d} L${w} ${h} L0 ${h}Z" fill="url(#spg)"/><path d="${d}" fill="none" stroke="var(--good)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const BASE_WALLET_ICON = { 'f-house': '🏠', 'f-kids': '👨‍👩‍👧', 'f-personal': '⛽' };
  const wIcon = id => { const it = findItem('fixed', id); return (it && it.icon) || BASE_WALLET_ICON[id] || '👛'; };
  const wName = w => w.id === 'f-personal' ? 'المصروف الشخصي' : w.name;
  const wOpen = () => store.get('mali-v9-wopen') !== '0';
  const rOpen = () => store.get('mali-v9-ropen') !== '0';
  const mOpen = () => store.get('mali-v9-mopen') === '1';
  const wLevelCls = lv => lv === 'over' || lv === 'empty' ? 'c' : lv === 'low' ? 'a' : '';

  function renderHero() {
    const H = sm.health, T = sm.totals, sp = sm.spend;
    const surplus = sm.past ? sm.recordedNet : sm.projectedSurplus;
    const inc = T.income.projected || T.income.confirmedPlanned || T.income.actual || 0;
    const live = sm.cycle === sm.current && !sm.past && !sm.future;
    const colors = { free: 'var(--good)', goals: 'var(--accent)', commit: 'var(--bad)' };
    const commit = T.fixed.projected + T.debtsFixed.projected + T.debtsTemp.projected + T.variable.actual;
    const pc = v => inc > 0 ? Math.max(0, Math.min(100, v / inc * 100)) : 0;
    const segs = [[pc(Math.max(0, surplus)), colors.free], [pc(T.goals.projected), colors.goals], [pc(commit), colors.commit]];
    const sparkPts = (() => { try { return C.forecast(S, sm.cycle, 6, new Date()).filter(f => f.income > 0).map(f => f.surplus); } catch (e) { return []; } })();
    const stLabel = H.level === 'unknown' ? 'أدخل راتبك' : `وضع ${esc(H.label)} · ${H.score}`;
    const stCls = { good: 'g', warn: 'a', bad: 'c' }[H.color] || '';
    const od = sm.tasks ? sm.tasks.overdue.length : 0, odSum = sm.tasks ? C.sum(sm.tasks.overdue, i => i.remaining) : 0;
    $('hero').style.setProperty('--status', STATUS_COLOR[H.color] || 'var(--muted)');
    if (H.level === 'unknown') {
      $('hero').innerHTML = `<div class="gl glow"><b>ابدأ من هنا</b><p class="mut" style="margin:6px 0 12px">بدون الدخل ما أقدر أحسب الفائض أو أقيّم الوضع.</p><button class="btn primary block" id="setIncome">أدخل راتبك المتوقع</button></div>`;
      $('setIncome').onclick = () => openEdit('income', 'i-salary');
      renderTasks(document.createElement('div')); renderBudget(); renderExtras(); renderPending(); renderRecent();
      return;
    }
    const M = monitorData();
    const nm = S.settings.name ? S.settings.name + '، ' : '';
    const bubbleTxt = `${esc(nm)}${esc(M.summary.lead)}${live && sp.daily > 0 ? ` تقدر تصرف <b class="num money">${plain(sp.daily)}</b> ر.س اليوم.` : ''}`;
    const monStrip = S.settings.showMonitor === false ? '' : `<div class="monStrip ${M.level}"><button class="monHead" id="monHead" aria-expanded="${mOpen()}"><span class="monDot"></span><b>المراقب</b>${M.alerts.filter(a => a.level === 'bad' || a.level === 'warn').length ? `<span class="monCnt">${M.alerts.filter(a => a.level === 'bad' || a.level === 'warn').length}</span>` : ''}<span class="monLead"></span><span class="chev">${mOpen() ? '▴' : '▾'}</span></button>${mOpen() ? `<div class="monBody"><b class="monLeadB">${esc(M.summary.lead)}</b><p>${bubbleTxt}</p><button class="btn mini" id="monOpen">افتح المراقب ‹</button></div>` : ''}</div>`;
    // بلاطات: المتأخر ثم كل المحافظ (تتحرك يمين ويسار) وزر إضافة
    const pin = S.settings.pinnedBudget, bp = pin ? C.budgetPace(S, sm, pin) : null;
    const hasDaily = !!(bp && bp.planned && bp.live && !sm.future);
    const ws = (sm.wallets || []).filter(w => !(hasDaily && w.id === pin));
    const dailyTile = !hasDaily ? '' : (() => {
      const over = bp.spentToday > bp.daily + 0.009, pct = bp.daily ? Math.min(100, bp.spentToday / bp.daily * 100) : 0, cls = over ? 'c' : pct >= 70 ? 'a' : '';
      return `<button class="tile ${cls}" id="dailyTile" aria-label="المصروف اليومي"><i class="tIc">☀️</i><b>المصروف اليومي</b><span class="num money">${over ? '-' : ''}${plain(Math.abs(bp.todayLeft))}</span><small class="tSub">${over ? 'تجاوزت اليوم' : 'باقي لك اليوم من ' + plain(bp.daily)}</small><div class="bar ${cls}"><i style="width:${Math.max(0, 100 - pct)}%"></i></div></button>`;
    })();
    const wTile = w => `<button class="tile ${wLevelCls(w.level)}" data-go="wallets"><i class="tIc">${wIcon(w.id)}</i><b>${esc(wName(w))}</b><span class="num money">${plain(Math.max(0, w.left))}</span><div class="bar ${wLevelCls(w.level)}"><i style="width:${Math.max(0, Math.min(100, w.planned ? w.left / w.planned * 100 : 0))}%"></i></div></button>`;
    const t1 = od ? `<button class="tile c" data-go="tasks"><i class="tIc">⏰</i><b>متأخرة · ${od}</b><span class="num money">${plain(odSum)}</span><div class="bar c"><i style="width:100%"></i></div></button>`
      : `<button class="tile g" data-go="tasks"><i class="tIc">✅</i><b>المهام</b><span class="num money">${plain(sm.tasks ? sm.tasks.remainingTotal : 0)}</span><div class="bar g"><i style="width:${sm.tasks && sm.tasks.total ? Math.round(sm.tasks.done.length / sm.tasks.total * 100) : 0}%"></i></div></button>`;
    const tiles = [t1, dailyTile, ...ws.map(wTile), '<button class="tile add" id="addWalletTile" aria-label="إضافة محفظة"><i class="tIc">＋</i><b>محفظة جديدة</b></button>'].join('');
    const predTxt = surplus >= 0 ? `متوقع يبقى معك <b class="num money">${plain(surplus)}</b> ر.س بنهاية الدورة` : `متوقع عجز <b class="num money">${plain(-surplus)}</b> ر.س بنهاية الدورة`;
    $('hero').innerHTML = `
      <div class="gaugeBox"><div class="gWrap">${gaugeSVG(segs)}<div class="gMid"><small>${sm.past ? 'صافي الدورة' : 'الراتب المتبقي'}</small><b class="num money">${plain(surplus)}</b></div></div>
        <div class="gLeg"><span><i style="background:${colors.free}"></i>متاح ${Math.round(pc(Math.max(0, surplus)))}٪</span><span><i style="background:${colors.goals}"></i>أهداف ${Math.round(pc(T.goals.projected))}٪</span><span><i style="background:${colors.commit}"></i>التزامات ${Math.round(pc(commit))}٪</span></div></div>
      <div class="gl surplus ${surplus < 0 ? 'r' : 'g'}">
        <div class="sTop"><b>${sm.past ? 'صافي الدورة' : sm.future ? 'فائض الخطة' : 'الفائض المتوقع هذي الدورة'}</b><button class="chip ${stCls}" id="whyBtn" aria-label="مؤشر الوضع ${H.score} من 100 — اضغط للتفاصيل">${stLabel}</button></div>
        <div class="sMain"><div><span class="sBig ${surplus < 0 ? 'neg' : ''}">${money(surplus, { cur: false, sign: true })}</span> <small>ر.س</small>
          <div class="mut">${live ? `الدخل ${plain(inc)} · باقي ${sm.daysToSalary} يوم` : `الدخل ${plain(inc)}`}</div></div>${sparkSVG(sparkPts)}</div></div>
      ${monStrip}
      <details class="wSec" id="wSec" ${wOpen() ? 'open' : ''}><summary><b>المحافظ</b><small>${(sm.wallets || []).length} محافظ</small><span class="chev">‹</span></summary><div class="tiles scroller">${tiles}</div></details>
      <button class="gl pred" id="predBtn"><span class="pIc">🔮</span><span><b>تنبؤ ذكي</b><small>${predTxt}</small></span><span class="chev">‹</span></button>`;
    $('whyBtn').onclick = openHealth;
    if ($('monHead')) $('monHead').onclick = () => { store.set('mali-v9-mopen', mOpen() ? '0' : '1'); renderHero(); };
    if ($('monOpen')) $('monOpen').onclick = () => openPage('monitor');
    if ($('dailyTile')) $('dailyTile').onclick = () => { store.set('mali-v9-bopen', '1'); renderBudget(); const d = $('budget').querySelector('details'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'center' }); const q = $('qlAmt'); if (q) setTimeout(() => q.focus(), 350); } };
    $('wSec').addEventListener('toggle', () => store.set('mali-v9-wopen', $('wSec').open ? '1' : '0'));
    $('addWalletTile').onclick = () => openWalletEdit();
    $('predBtn').onclick = () => openPage('monitor');
    $('hero').querySelectorAll('[data-go]').forEach(b => b.onclick = () => openPage(b.dataset.go));
    renderTasks(document.createElement('div'));   // يحدّث شارة المتأخر؛ القائمة نفسها في تبويب المهام
    renderBudget();
    renderExtras();
    renderPending();
    renderRecent();
  }
  function renderRecent() {
    const list = S.entries.map((e, i) => ({ e, i })).sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i).slice(0, 3).map(x => x.e);
    if (!list.length || sm.future) { $('recent').innerHTML = ''; return; }
    $('recent').innerHTML = `<details class="recD" id="recD" ${rOpen() ? 'open' : ''}><summary class="secLbl rowLbl"><span>آخر العمليات <small class="mut">(${list.length})</small></span><span class="rActs"><button type="button" class="linkBtn" id="recAll">الكل</button><span class="chev">‹</span></span></summary>` + list.map(e => {
      const inc = e.kind === 'income', k = inc ? 'g' : e.kind === 'variable' ? 'p' : e.kind === 'goal' ? 'g' : 'c';
      const nm = e.note || C.itemName(S, e.kind, e.ref);
      const sub = [monDay(e.date), (bankById(e.bank) || {}).name || '', e.source === 'sms' || e.source === 'inbox' ? 'من البنك' : ''].filter(Boolean).join(' · ');
      return `<button class="op ${k}" data-en="${esc(e.id)}"><span class="opIc">${inc ? '⬇︎' : e.kind === 'variable' ? '🛒' : '⇄'}</span><span class="opT"><b>${esc(nm)}</b><small>${esc(sub)}</small></span><span class="num opV ${inc ? 'goodTxt' : ''}">${inc ? '+' : '-'}${plain(e.amount)}</span></button>`;
    }).join('') + '</details>';
    $('recD').addEventListener('toggle', () => store.set('mali-v9-ropen', $('recD').open ? '1' : '0'));
    $('recent').querySelectorAll('[data-en]').forEach(b => b.onclick = () => openEntryEdit(b.dataset.en));
    $('recAll').onclick = e => { e.preventDefault(); e.stopPropagation(); openPage('monitor'); };
  }

  /* بطاقة «مصروفي»: الميزانية الشهرية مقسومة على الأيام */
  function paceBlock(b, compact) {
    if (!b || !b.planned) return '';
    const f = n => plain(Math.abs(n));
    const msg = b.state === 'over' ? `<span class="chip bad">تعديت الميزانية بـ ${f(b.remaining)}</span>`
      : b.state === 'ahead' ? `<span class="chip bad">سحبت زيادة ${f(b.diff)} ر.س</span>`
      : b.state === 'saving' ? `<span class="chip good">وفّرت ${f(b.diff)} ر.س 👏</span>`
      : '<span class="chip accent">مضبوط على المعدل</span>';
    const pct = Math.min(100, b.actual / b.planned * 100), mark = Math.min(100, b.expected / b.planned * 100);
    const tip = !b.live ? '' : b.state === 'over' ? 'وقف الصرف من هذا البند لين الراتب، أو عدّل مبلغ الشهر.'
      : b.state === 'ahead' ? `عشان ترجع للمعدل: لا تتعدى <b class="num money">${plain(b.dailyLeft)}</b> ر.س يوميًا لـ ${b.daysLeft} يوم.`
      : `باقي لك <b class="num money">${plain(b.dailyLeft)}</b> ر.س يوميًا لـ ${b.daysLeft} يوم.`;
    return `<div class="bp">
      <div class="bpTop"><div><small>لك يوميًا</small><b class="num money">${plain(b.daily)}</b><small> ر.س</small></div>${msg}</div>
      <div class="bpBar"><i style="width:${pct}%" class="${b.state === 'over' || b.state === 'ahead' ? 'bad' : 'ok'}"></i>${b.live ? `<em style="inset-inline-start:${mark}%" title="المفروض لحد اليوم"></em>` : ''}</div>
      <div class="bpRow"><span>صرفت <b class="num money">${plain(b.actual)}</b></span>${b.live ? `<span>المفروض لحد اليوم <b class="num money">${plain(b.expected)}</b></span>` : ''}<span>من <b class="num money">${plain(b.planned)}</b></span></div>
      ${tip ? `<p class="cNote">${tip}${b.spentToday ? ` · صرفت اليوم ${plain(b.spentToday)}` : ''}</p>` : ''}
    </div>`;
  }
  // بطاقة «مصروفي»: تفتح وتسكر، فيها المسموح اليوم وتسجيل سريع وتنبيه الزيادة
  const bOpen = () => store.get('mali-v9-bopen') === '1';
  function renderBudget() {
    const id = S.settings.pinnedBudget;
    const b = id ? C.budgetPace(S, sm, id) : null;
    if (!b || !b.planned) { $('budget').innerHTML = ''; return; }
    const f = n => plain(Math.abs(n));
    const live = b.live;
    const over = live && b.spentToday > b.daily + 0.009;
    const sumTxt = !live ? `صرفت ${plain(b.actual)} من ${plain(b.planned)}`
      : over ? `صرفت اليوم زيادة ${f(b.spentToday - b.daily)}`
      : b.spentToday ? `باقي لك اليوم ${f(b.todayLeft)}` : `مسموح لك اليوم ${f(b.daily)}`;
    const sumCls = over ? 'bad' : b.state === 'over' ? 'bad' : b.state === 'ahead' ? 'warn' : 'good';
    const pct = Math.min(100, b.actual / b.planned * 100), mark = Math.min(100, b.expected / b.planned * 100);
    const todayPct = b.daily ? Math.min(100, b.spentToday / b.daily * 100) : 0;
    const dayList = S.entries.filter(e => e.kind === 'fixed' && e.ref === id && C.cycleOf(e.date, S.settings.salaryDay) === sm.cycle).sort((a, c) => c.date.localeCompare(a.date) || 0).slice(0, 4);
    const status = b.state === 'over' ? `<span class="chip bad">تعديت الميزانية بـ ${f(b.remaining)}</span>`
      : b.state === 'ahead' ? `<span class="chip bad">سحبت زيادة ${f(b.diff)} عن المعدل</span>`
      : b.state === 'saving' ? `<span class="chip good">وفّرت ${f(b.diff)} عن المعدل 👏</span>`
      : '<span class="chip accent">مضبوط على المعدل</span>';
    $('budget').innerHTML = `<details class="myB" ${bOpen() ? 'open' : ''}>
      <summary><span class="secIcon">💳</span><span class="secTitle"><b>مصروفي الشخصي</b><small class="${sumCls}Txt">${sumTxt}</small></span><span class="chev">‹</span></summary>
      <div class="myBody">
        ${live ? `<div class="todayBox ${over ? 'overBox' : ''}">
          <div class="todayRow"><div><small>المسموح اليوم</small><b class="num money">${plain(b.daily)}</b></div><div><small>صرفت اليوم</small><b class="num money" style="color:${over ? 'var(--bad)' : 'inherit'}">${plain(b.spentToday)}</b></div><div><small>${over ? 'الزيادة' : 'الباقي اليوم'}</small><b class="num money" style="color:${over ? 'var(--bad)' : 'var(--good)'}">${plain(Math.abs(b.todayLeft))}</b></div></div>
          <div class="bar ${over ? 'bad' : ''}"><i style="width:${todayPct}%"></i></div>
          ${over ? `<p class="warnLine">⚠️ صرفت اليوم زيادة ${f(b.spentToday - b.daily)} ر.س عن المسموح</p>` : ''}
        </div>
        <div class="quickLog"><input class="input" id="qlAmt" inputmode="decimal" placeholder="كم صرفت؟"><button class="btn primary" id="qlAdd">سجّل</button></div>
        <div id="qlDate">${dateChips()}</div>
        <div id="qlImpact"></div>` : ''}
        <div class="quickLog" style="margin-top:8px"><input class="input" id="qlRem" inputmode="decimal" placeholder="باقي معي من الشهر كم؟"><button class="btn good" id="qlRemGo">حدّث</button></div>
        <p class="cNote" style="margin-top:4px">اكتب الباقي الفعلي، والتطبيق يحسب كم صرفت لحد الحين ويسجل الفرق.</p>
        <div class="bpBar"><i style="width:${pct}%" class="${b.state === 'over' || b.state === 'ahead' ? 'bad' : 'ok'}"></i>${live ? `<em style="inset-inline-start:${mark}%" title="المفروض لحد اليوم"></em>` : ''}</div>
        <div class="bpRow"><span>صرفت <b class="num money">${plain(b.actual)}</b></span>${live ? `<span>المفروض لحد اليوم <b class="num money">${plain(b.expected)}</b></span>` : ''}<span>من <b class="num money">${plain(b.planned)}</b></span></div>
        <div style="margin-top:8px">${status}</div>
        <p class="cNote" style="margin-top:4px">الدورة ${sm.totalDays} يوم (${dayFmt(sm.start)} ← ${dayFmt(sm.end)}) · ${plain(b.planned)} ÷ ${sm.totalDays} = ${plain(b.daily)} يوميًا</p>
        ${live ? `<p class="cNote">باقي من الشهر <b class="num money">${plain(b.remaining)}</b> ر.س · يعني <b class="num money">${plain(b.dailyLeft)}</b> يوميًا لـ ${b.daysLeft} يوم.</p>` : ''}
        ${dayList.length ? `<div class="miniList">${dayList.map(e => `<div class="entry"><div><b>${money(e.amount)}</b><small>${esc(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</small></div><div class="eBtns"><button class="x edit" data-bedit="${esc(e.id)}" aria-label="تعديل">${svg(ICON.edit, 15)}</button><button class="x" data-bdel="${esc(e.id)}" aria-label="حذف">✕</button></div></div>`).join('')}</div>` : ''}
        <div class="btnRow" style="margin-top:8px"><button class="btn mini" id="bEdit">${b.overridden ? 'معدّل' : 'حدد'} مبلغ الشهر</button><button class="btn mini" id="bAdd">سجّل بالباقي / تفاصيل</button></div>
      </div></details>`;
    const det = $('budget').querySelector('details');
    det.addEventListener('toggle', () => store.set('mali-v9-bopen', det.open ? '1' : '0'));
    const add = () => {
      const amt = toNum($('qlAmt').value);
      if (!(amt > 0)) return toast('اكتب كم صرفت');
      snapshot();
      S.entries.push({ id: C.uid(), kind: 'fixed', ref: id, amount: C.round2(amt), date: readDate($('qlDate')), note: '' });
      const nb = (C.budgetPace(S, C.summarize(S, viewCycle, new Date()), id) || {});
      commit(nb.spentToday > nb.daily + 0.009 ? `⚠️ صرفت اليوم زيادة ${plain(nb.spentToday - nb.daily)} ر.س` : `تم تسجيل ${plain(amt)} ر.س`);
    };
    if ($('qlDate')) wireDateChips($('qlDate'));
    if ($('qlAmt')) { const qh = () => { $('qlImpact').innerHTML = impactHTML('fixed', id, toNum($('qlAmt').value), readDate($('qlDate')), false); }; $('qlAmt').addEventListener('input', qh); $('qlDate').addEventListener('click', () => setTimeout(qh, 0)); }
    if ($('qlAdd')) { $('qlAdd').onclick = add; $('qlAmt').addEventListener('keydown', e => { if (e.key === 'Enter') add(); }); }
    $('qlRemGo').onclick = () => setRemaining(id, $('qlRem').value);
    $('budget').querySelectorAll('[data-bedit]').forEach(x => x.onclick = () => openEntryEdit(x.dataset.bedit));
    $('budget').querySelectorAll('[data-bdel]').forEach(x => x.onclick = () => { snapshot(); S.entries = S.entries.filter(e => e.id !== x.dataset.bdel); commit('تم الحذف'); });
    $('bEdit').onclick = () => editMonthAmount(id);
    $('bAdd').onclick = () => openItem('fixed', id);
  }
  function editMonthAmount(id) {
    const x = findItem('fixed', id); if (!x) return;
    const cur = C.plannedFor(S, 'fixed', x, viewCycle);
    openSheet(`مبلغ ${x.name} — ${monthName(viewCycle)}`, `
      <p class="note" style="margin-top:0">حدد كم تبي مصروفك هذا الشهر. ينقسم تلقائيًا على ${sm.totalDays} يوم، ويتغير فائض الخطة بنفس الفرق.</p>
      <input class="input bigInput" id="mAmt" inputmode="decimal" value="${cur}">
      <p class="note" id="mHint"></p>
      <button class="btn primary block" id="mSave">حفظ لهذا الشهر</button>
      <div style="height:8px"></div><button class="btn block" id="mAlways">اعتمده لكل الأشهر</button>`, () => {
      const hint = () => { const v = toNum($('mAmt').value); $('mHint').innerHTML = `يوميًا: <b class="num money">${plain(v / sm.totalDays)}</b> ر.س · الفرق على الفائض: <b class="num money">${plain(cur - v)}</b>`; };
      $('mAmt').oninput = hint; hint();
      $('mSave').onclick = () => { snapshot(); S.overrides[viewCycle] = S.overrides[viewCycle] || {}; S.overrides[viewCycle][id] = C.round2(toNum($('mAmt').value)); closeSheet(); commit('تم تحديد مبلغ هذا الشهر'); };
      $('mAlways').onclick = () => { snapshot(); x.amount = C.round2(toNum($('mAmt').value)); if (S.overrides[viewCycle]) delete S.overrides[viewCycle][id]; closeSheet(); commit('تم اعتماد المبلغ لكل الأشهر'); };
    });
  }

  function flowCard() {
    const T = sm.totals, inc = T.income.projected || T.income.confirmedPlanned || 1;
    const rows = [
      ['المصاريف الثابتة', T.fixed.projected, '#64748b', 'fixed'],
      ['القروض', T.debtsFixed.projected, '#b91c1c', 'debtsFixed'],
      ['الديون المؤقتة', T.debtsTemp.projected, '#f87171', 'debtsTemp'],
      ['الأهداف', T.goals.projected, 'var(--accent)', 'goals'],
      ['المتغيرة', T.variable.actual, '#f59e0b', 'variable'],
      [sm.projectedSurplus < 0 ? 'العجز' : 'الفائض', Math.abs(sm.projectedSurplus), sm.projectedSurplus < 0 ? 'var(--bad)' : 'var(--good)', '']
    ].filter(r => r[1] > 0);
    return `<h3>وين يروح الراتب</h3><small class="cSub">من ${plain(inc)} ر.س</small>
      <div class="flow">${rows.map(r => `<button class="flowRow" ${r[3] ? `data-page="${r[3]}"` : ''}><span class="fl">${r[0]}</span><span class="fb"><i style="width:${Math.max(2, r[1] / inc * 100)}%;background:${r[2]}"></i></span><span class="fv"><b class="num money">${plain(r[1])}</b><small>${Math.round(r[1] / inc * 100)}٪</small></span></button>`).join('')}</div>`;
  }

  function debtCard() {
    const df = C.debtFreedom(S, sm.current, new Date());
    if (!df.items.length) return '<h3>عدّاد الديون</h3><div class="empty">ما عليك ديون 🎉</div>';
    const mLeft = c => Math.max(0, C.cyclesBetween(sm.current, c) + 1);
    const temp = df.items.filter(x => x.kind === 'temp');
    const tempFreed = C.sum(temp, x => x.freed);
    const maxM = Math.max(...df.items.map(x => mLeft(x.last)), 1);
    const head = df.tempEnd ? `<div class="countBig"><b>${mLeft(df.tempEnd)}</b><span>شهر وتخلص الأقساط المؤقتة<br><small>آخرها ${monthName(df.tempEnd)}</small></span></div>` : '';
    return `<h3>عدّاد الديون</h3><small class="cSub">المتبقي ${plain(df.totalRemaining)} ر.س</small>${head}
      <div class="dlist">${df.items.map(x => `<button class="dRow" data-page="${x.kind === 'temp' ? 'debtsTemp' : 'debtsFixed'}"><span class="dn">${esc(x.name)}</span><span class="db"><i style="width:${mLeft(x.last) / maxM * 100}%"></i></span><span class="dv">${monthName(x.last, { month: 'short', year: '2-digit' })}${x.estimated ? '*' : ''}</span></button>`).join('')}</div>
      <p class="cNote">${tempFreed ? `بعد المؤقتة يتحرر لك تدريجيًا حتى <b class="num money">${plain(tempFreed)}</b> ر.س شهريًا. ` : ''}* تقدير من رصيد القرض الحالي.</p>`;
  }

  /* ───────── قائمة المهام: دفع/تحويل/استلام مباشرة من الرئيسية ───────── */
  // شارة رقم المتأخر على أيقونة التطبيق (آيفون 16.4+ بعد السماح بالإشعارات)
  function setBadge(n) { try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {} }
  const tOpen = () => store.get('mali-v9-topen') !== '0';
  let tExpand = null, tDay = '';
  const dueLabel = i => {
    const t = todayISO();
    if (i.overdue) return `<span class="chip bad">متأخر · ${dayFmt(new Date(i.due + 'T12:00:00'))}</span>`;
    if (i.due === t) return '<span class="chip warn">اليوم</span>';
    return `<span class="chip muted">${dayFmt(new Date(i.due + 'T12:00:00'))}</span>`;
  };
  function renderTasks(box = $('tasks'), page = false) {
    const boxIn = box;
    const T = sm.tasks;
    if (!page) setBadge(sm.cycle === sm.current && T ? T.overdue.length : 0);
    if (!T || !T.total || sm.future) { box.innerHTML = page ? '<div class="empty">ما فيه مهام في هذي الدورة</div>' : ''; return; }
    const od = T.overdue.length;
    const sub = !T.open.length ? 'خلصت كل المهام' : `${T.open.length} باقية · ${plain(T.remainingTotal)} ر.س`;
    const taskIcon = i => {
      if (i.icon) return esc(i.icon);
      const n = i.name || '';
      const map = [[/جامع/, '🎓'], [/كهرب/, '⚡'], [/ماء|وايت/, '💧'], [/جوال|اتصال|STC/i, '📱'], [/ترفيه/, '🎭'], [/زوج/, '👩'], [/صدق/, '🤲'], [/قرض/, '🏦'], [/تابي|تمارا|tabby|tamara/i, '🛍'], [/طوارئ/, '🛟'], [/مجلس/, '🛋'], [/رمضان|عيد/, '🌙'], [/سفر|تذاكر/, '✈️'], [/أضح/, '🐑'], [/استثمار/, '📈']];
      for (const [re, e] of map) if (re.test(n)) return e;
      return { fixed: '🏠', debt: '🏦', goal: '🎯', income: '💰' }[i.kind] || '🧾';
    };
    const row = i => {
      const ex = tExpand === i.kind + ':' + i.id, part = i.actual > 0 && i.actual < i.planned;
      return `<div class="task ${i.overdue ? 'late' : ''} ${ex ? 'ex' : ''}" data-k="${i.kind}" data-id="${esc(i.id)}">
        <span class="swipeBg" aria-hidden="true">✓ ${i.verb} كامل</span>
        <div class="tMain">
          <button class="tick" data-full aria-label="${i.verb} كامل"><i></i></button>
          <span class="tIco" aria-hidden="true">${taskIcon(i)}</span>
          <button class="tBody" data-ex><b>${esc(i.name)}</b><small>${part ? `مدفوع ${plain(i.actual)} · ` : ''}${bankTag(i.bank) || 'بدون جهة'}</small></button>
          <div class="tSide"><b class="num money">${plain(i.remaining)}</b>${dueLabel(i)}<small class="swHint">اسحب للدفع ‹‹</small></div>
        </div>
        ${ex ? `<div class="tMore">
          <div class="tNums"><span>المخطط <b class="num money">${plain(i.planned)}</b></span><span>${i.kind === 'income' ? 'المستلم' : 'المدفوع'} <b class="num money">${plain(i.actual)}</b></span><span>باقي <b class="num money">${plain(i.remaining)}</b></span></div>
          <label class="field"><span>${i.kind === 'income' ? 'كم استلمت؟' : 'كم سدّدت؟'}</span><input class="input bigInput" inputmode="decimal" data-amt value="${i.remaining}"></label>
          <button class="btn good block" data-final>${i.kind === 'income' ? 'استلمت' : 'سدّدت'}</button>
          <div data-timp>${impactHTML(i.kind, i.id, i.remaining, defaultDate(), true)}</div>
          <p class="note" style="margin:6px 0 10px">سواء دفعت كامل أو أقل، المهمة تتقفل. الفرق عن المخطط يصير توفير أو زيادة لهذا الشهر فقط، والمبلغ الأساسي ما يتغير.</p>
          <div class="two"><label class="field"><span>البنك</span><select class="input" data-bank>${bankOptions(i.bank)}</select></label><label class="field"><span>يوم الاستحقاق</span><input class="input" inputmode="numeric" data-due value="${Number(i.item.dueDay) || ''}" placeholder="${S.settings.salaryDay}"></label></div>
          <button class="btn block mini" data-more style="margin-top:8px">⋯ تفاصيل وسجل</button>
        </div>` : ''}</div>`;
    };
    const doneRows = T.done.map(i => `<div class="tDoneRow" data-k="${i.kind}" data-id="${esc(i.id)}"><button class="tDone" data-k="${i.kind}" data-id="${esc(i.id)}"><span>✓</span><b>${esc(i.name)}</b><small class="num money">${plain(i.actual)}${i.planned - i.actual > 0.009 ? ` · وفّرت ${plain(i.planned - i.actual)}` : i.actual - i.planned > 0.009 ? ` · زيادة ${plain(i.actual - i.planned)}` : ''}</small></button><button class="tUndo" data-undo aria-label="إرجاع للقائمة">↩ إرجاع</button></div>`).join('');
    // صفحة المهام: شريط أيام + مجموعات حسب الاستحقاق (المتأخر أولًا)
    const pageList = () => {
      const t0 = todayISO(), odl = T.open.filter(i => i.overdue);
      const dayCnt = new Map(); T.open.filter(i => !i.overdue).forEach(i => dayCnt.set(i.due, (dayCnt.get(i.due) || 0) + 1));
      const wd = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
      const cells = []; for (let k = 0; k < 7; k++) { const d = new Date(Date.now() + k * 864e5), iso = C.isoDate(d); cells.push([iso, wd[d.getDay()], d.getDate(), (dayCnt.get(iso) || 0) + (k === 0 ? odl.length : 0)]); }
      const strip = `<div class="dStrip week">${cells.map(c => `<button class="dCell ${tDay === c[0] ? 'on' : ''} ${c[0] === t0 ? 'today' : ''}" data-tday="${c[0]}"><small>${c[1]}</small><b class="num">${c[2]}</b>${c[3] ? '<i></i>' : ''}</button>`).join('')}</div>`;
      let items = T.open;
      if (tDay) items = T.open.filter(i => i.due === tDay || (tDay === t0 && i.overdue));
      const groups = [];
      const late = items.filter(i => i.overdue); if (late.length) groups.push(['late', `اليوم · ${dayFmt(new Date(t0 + 'T12:00:00'))} <span class="chip bad">${late.length} متأخرة</span>`, late]);
      const byDue = new Map(); items.filter(i => !i.overdue).forEach(i => { if (!byDue.has(i.due)) byDue.set(i.due, []); byDue.get(i.due).push(i); });
      [...byDue.keys()].sort().forEach(d => groups.push([d === t0 ? 'today' : 'next', `${d === t0 ? 'اليوم · ' : ''}${dayFmt(new Date(d + 'T12:00:00'))}${d > t0 ? ' · قادم' : ''}`, byDue.get(d)]));
      const body = groups.length ? groups.map(([k, label, rows]) => `<div class="tGrp ${k}"><span>${label}</span><b class="num money">${plain(C.sum(rows, i => i.remaining))}</b></div>${rows.map(row).join('')}`).join('') : '<div class="empty">ما فيه مهام في هذا اليوم</div>';
      return strip + body;
    };
    box.innerHTML = page ? `<div class="tBox pageTasks">${pageList()}${T.done.length ? `<details class="tDoneBox" open><summary>تمت (${T.done.length})</summary>${doneRows}<button class="btn mini block" id="tReopenAll" style="margin-top:8px">↩ إرجاع الكل للقائمة</button></details>` : ''}</div>` : `<details class="tasksD ${od ? 'hasLate' : ''}" ${tOpen() ? 'open' : ''}>
      <summary><span class="secIcon">${svg(ICON.check, 20)}</span><span class="secTitle"><b>المهام ${od ? `<em class="badge">${od}</em>` : ''}</b><small class="${od ? 'badTxt' : ''}">${od ? `${od} متأخرة · ${plain(C.sum(T.overdue, i => i.remaining))} ر.س — ${esc(T.overdue[0].name)}${od > 1 ? '…' : ''}` : sub}</small></span><span class="chev">‹</span></summary>
      <div class="tBox">${T.open.map(row).join('') || '<div class="empty">كل شيء مسجل ✓</div>'}
        ${T.done.length ? `<details class="tDoneBox"><summary>تمت (${T.done.length})</summary>${doneRows}<button class="btn mini block" id="tReopenAll" style="margin-top:8px">↩ إرجاع الكل للقائمة</button></details>` : ''}</div></details>`;
    box.querySelectorAll('[data-tday]').forEach(b => b.onclick = () => { tDay = tDay === b.dataset.tday ? '' : b.dataset.tday; renderTasks(boxIn, page); });
    const det = page ? null : box.querySelector('details');
    if (det) det.addEventListener('toggle', () => store.set('mali-v9-topen', det.open ? '1' : '0'));
    const ctx = el => { const t = el.closest('[data-k]'); return { kind: t.dataset.k, id: t.dataset.id, x: findItem(t.dataset.k, t.dataset.id), t }; };
    const find = (k, id) => T.open.find(i => i.kind === k && i.id === id);
    const pay = (kind, id, amt, full) => {
      snapshot();
      if (full && kind !== 'income') { S.closed[viewCycle] = S.closed[viewCycle] || {}; S.closed[viewCycle][id] = true; }
      S.entries.push({ id: C.uid(), kind, ref: id, amount: C.round2(amt), date: defaultDate(), note: '' });
      tExpand = null;
      commit(`تم تسجيل ${plain(amt)} ر.س`);
    };
    box.querySelectorAll('[data-full]').forEach(b => b.onclick = () => { const c = ctx(b), i = find(c.kind, c.id); if (i && confirm(`تأكيد: «${i.name}» ${i.verb === 'استلام' ? 'استلمته' : 'اندفع'} كامل (${plain(i.remaining)} ر.س)؟`)) pay(c.kind, c.id, i.remaining, true); });
    // اسحب البطاقة لليسار للدفع الكامل (مع «تراجع» بعدها)
    if (page) box.querySelectorAll('.task:not(.ex)').forEach(card => {
      const main = card.querySelector('.tMain'); let x0 = null, y0 = 0, dx = 0, moved = false;
      const reset = () => { main.style.transition = 'transform .2s'; main.style.transform = ''; card.classList.remove('swiping', 'go'); };
      main.addEventListener('pointerdown', e => { if (e.target.closest('.tick') || e.button > 0) return; x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; main.style.transition = 'none'; });
      main.addEventListener('pointermove', e => {
        if (x0 === null) return;
        dx = e.clientX - x0;
        if (!moved && Math.abs(e.clientY - y0) > Math.abs(dx) + 4) { x0 = null; return; }   // تمرير عمودي
        if (Math.abs(dx) > 8) { moved = true; try { main.setPointerCapture(e.pointerId); } catch (er) {} }
        if (moved) { const t = Math.min(0, dx); main.style.transform = `translateX(${t}px)`; card.classList.add('swiping'); card.classList.toggle('go', t < -110); }
      });
      const end = () => {
        if (x0 === null) return; const go = moved && dx < -110; x0 = null;
        if (moved) card.dataset.drag = '1', setTimeout(() => delete card.dataset.drag, 60);
        if (!go) return reset();
        const c = ctx(main), i = find(c.kind, c.id); reset();
        if (i) pay(c.kind, c.id, i.remaining, true);
      };
      main.addEventListener('pointerup', end); main.addEventListener('pointercancel', () => { x0 = null; reset(); });
      card.addEventListener('click', e => { if (card.dataset.drag) { e.stopPropagation(); e.preventDefault(); } }, true);
    });
    box.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { const c = ctx(b), key = c.kind + ':' + c.id; tExpand = tExpand === key ? null : key; renderTasks(boxIn, page); });
    box.querySelectorAll('[data-amt]').forEach(inp => inp.addEventListener('input', () => { const c = ctx(inp); c.t.querySelector('[data-timp]').innerHTML = impactHTML(c.kind, c.id, toNum(inp.value), defaultDate(), true); }));
    box.querySelectorAll('[data-final]').forEach(b => b.onclick = () => {
      const c = ctx(b), amt = toNum(c.t.querySelector('[data-amt]').value), i = find(c.kind, c.id);
      if (!(amt > 0)) return toast('اكتب المبلغ اللي دفعته');
      snapshot();
      S.closed[viewCycle] = S.closed[viewCycle] || {}; S.closed[viewCycle][c.id] = true;
      S.entries.push({ id: C.uid(), kind: c.kind, ref: c.id, amount: C.round2(amt), date: defaultDate(), note: '' });
      tExpand = null;
      const diff = C.round2((i ? i.remaining : 0) - amt);
      commit(diff > 0.009 ? `تم، وفّرت ${plain(diff)} ر.س هذا الشهر` : diff < -0.009 ? `تم، زيادة ${plain(-diff)} ر.س عن المخطط` : `تم تسجيل ${plain(amt)} ر.س`);
    });
    box.querySelectorAll('[data-bank]').forEach(sel => { wireBankSelect(sel); sel.addEventListener('change', () => { if (sel.value === '__new') return; const c = ctx(sel); snapshot(); c.x.bank = sel.value; commit('تم تغيير البنك'); }); });
    box.querySelectorAll('[data-due]').forEach(inp => inp.onchange = () => { const c = ctx(inp), d = Math.round(toNum(inp.value)); snapshot(); if (d >= 1 && d <= 31) c.x.dueDay = d; else delete c.x.dueDay; commit('تم حفظ يوم الاستحقاق'); });
    box.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { const c = ctx(b); openItem(c.kind, c.id); });
    const reopen = items => {
      snapshot();
      for (const i of items) {
        S.entries = S.entries.filter(e => !(e.kind === i.kind && e.ref === i.id && C.cycleOf(e.date, S.settings.salaryDay) === viewCycle));
        if (S.closed[viewCycle]) delete S.closed[viewCycle][i.id];
      }
      commit(items.length > 1 ? 'رجعت كل المهام للقائمة' : 'رجع البند للقائمة');
    };
    box.querySelectorAll('[data-undo]').forEach(b => b.onclick = () => { const c = ctx(b); reopen([{ kind: c.kind, id: c.id }]); });
    if ($('tReopenAll')) $('tReopenAll').onclick = () => { if (confirm('ترجع كل المهام المنتهية للقائمة؟ يمسح تسجيلها في هذه الدورة.')) reopen(T.done); };
    box.querySelectorAll('.tDone').forEach(b => b.onclick = () => openItem(b.dataset.k, b.dataset.id));
  }
  // محافظ الصرف: البيت والعيال — باقي كم، وتتلون
  // اختيار تاريخ الصرف بسهولة: اليوم / أمس / قبل أمس / أي تاريخ
  const dateChips = () => `<div class="dChips"><button type="button" data-off="0" class="on">اليوم</button><button type="button" data-off="1">أمس</button><button type="button" data-off="2">قبل أمس</button><input type="date" class="input" data-dd aria-label="تاريخ آخر"></div>`;
  function wireDateChips(root) {
    root.querySelectorAll('.dChips').forEach(c => {
      c.querySelectorAll('[data-off]').forEach(b => b.onclick = () => { c.querySelectorAll('[data-off]').forEach(x => x.classList.toggle('on', x === b)); c.querySelector('[data-dd]').value = ''; });
      c.querySelector('[data-dd]').onchange = e => { if (e.target.value) c.querySelectorAll('[data-off]').forEach(x => x.classList.remove('on')); };
    });
  }
  function readDate(c) {
    if (!c) return defaultDate();
    const dd = c.querySelector('[data-dd]').value;
    if (dd) return dd;
    const on = c.querySelector('[data-off].on'); if (!on) return defaultDate();
    const d = new Date(); d.setDate(d.getDate() - Number(on.dataset.off));
    const iso = C.isoDate(d);
    return C.cycleOf(iso, S.settings.salaryDay) === viewCycle ? iso : defaultDate();
  }
  /* أثر التسجيل قبل الحفظ: نحسبه على نسخة مؤقتة، وبياناتك ما تتغير */
  function previewState(mutate) { const S2 = C.normalize(JSON.parse(JSON.stringify(S))); mutate(S2); return C.summarize(S2, viewCycle, new Date()); }
  const lineIn = (m, kind, id) => [...m.lines.income, ...m.lines.fixed, ...m.lines.debtsFixed, ...m.lines.debtsTemp, ...m.lines.goals].find(l => l.kind === kind && l.id === id);
  function impactHTML(kind, id, amt, date, close, replaceId) {
    if (!(amt > 0)) return '';
    const m2 = previewState(S2 => {
      if (replaceId) { const e = S2.entries.find(x => x.id === replaceId); if (e) { e.amount = C.round2(amt); if (date) e.date = date; } }
      else S2.entries.push({ id: '__preview', kind, ref: id, amount: C.round2(amt), date: date || defaultDate(), note: '' });
      if (close && kind !== 'income') { S2.closed[viewCycle] = S2.closed[viewCycle] || {}; S2.closed[viewCycle][id] = true; }
    });
    const l = lineIn(m2, kind, id); if (!l) return '';
    const rem = C.round2(l.planned - l.actual);
    const a = sm.past ? sm.recordedNet : sm.projectedSurplus, b = m2.past ? m2.recordedNet : m2.projectedSurplus;
    const dlt = C.round2(b - a);
    const state = close && kind !== 'income' ? (rem > 0.009 ? `وفّرت ${plain(rem)}` : rem < -0.009 ? `زيادة ${plain(-rem)}` : 'مطابق للمخطط')
      : rem > 0.009 ? `باقي ${plain(rem)}` : rem < -0.009 ? `زيادة ${plain(-rem)}` : 'مكتمل';
    return `<div class="impact ${b < 0 ? 'bad' : ''}">بعد التسجيل: <b>${state}</b> · الفائض المتوقع <b class="num">${plain(b)}</b>${dlt ? ` <small>(${dlt > 0 ? '+' : ''}${plain(dlt)})</small>` : ''}</div>`;
  }
  // تعديل عملية مسجلة: المبلغ والتاريخ والملاحظة فقط
  function openEntryEdit(entryId, back) {
    const e = S.entries.find(x => x.id === entryId); if (!e) return;
    openSheet('تعديل العملية', `<div class="card">
      <label class="field"><span>المبلغ</span><input class="input bigInput" id="enAmt" inputmode="decimal" value="${e.amount}"></label>
      <div class="two"><label class="field"><span>التاريخ</span><input class="input" type="date" id="enDate" value="${esc(e.date)}"></label><label class="field"><span>ملاحظة</span><input class="input" id="enNote" value="${esc(e.note || '')}" maxlength="80"></label></div>
      <div id="enImpact"></div>
      <div class="btnRow"><button class="btn primary" id="enSave">حفظ التعديل</button><button class="btn" id="enCancel">إلغاء</button></div></div>`, () => {
      const hint = () => { $('enImpact').innerHTML = impactHTML(e.kind, e.ref, toNum($('enAmt').value), $('enDate').value, false, e.id); };
      $('enAmt').oninput = hint; $('enDate').onchange = hint; hint();
      $('enCancel').onclick = () => { closeSheet(); if (back) back(); };
      $('enSave').onclick = () => {
        const amt = toNum($('enAmt').value);
        if (!(amt > 0)) return toast('اكتب مبلغ صحيح');
        snapshot();
        e.amount = C.round2(amt); e.date = $('enDate').value || e.date; e.note = $('enNote').value.trim().slice(0, 80);
        closeSheet(); commit('تم تعديل العملية'); if (back) back();
      };
    });
  }
  // «باقي معي»: تكتب كم باقي فعليًا ونحسب المصروف ونسجل الفرق (بدل ما تدخل كل عملية)
  function setRemaining(id, val) {
    const x = findItem('fixed', id); if (!x) return false;
    const v = toNum(val);
    if (String(val).trim() === '' || !(v >= 0)) { toast('اكتب كم باقي معك'); return false; }
    const r = C.remainingToSpend(S, 'fixed', x, viewCycle, v, sm.past);
    if (r.add === 0) { toast('مطابق للمسجل'); return false; }
    if (r.add < 0) { toast(`الباقي أكبر من المتوقع (مسجل صرف ${plain(r.recorded)}). احذف حركة أو عدّل المبلغ`); return false; }
    snapshot();
    // التحديث بالباقي يرحّل الفرق لأمس (أو أول الدورة) عشان ما يُحسب «صرفته اليوم» ويطلع تنبيه زيادة كذب
    let day = defaultDate();
    if (viewCycle === sm.current) { const y = new Date(); y.setDate(y.getDate() - 1); const yi = C.isoDate(y), st = C.isoDate(C.cycleStart(viewCycle, S.settings.salaryDay)); day = yi < st ? st : yi; }
    S.entries.push({ id: C.uid(), kind: 'fixed', ref: id, amount: r.add, date: day, note: 'حسب الباقي ' + plain(v) });
    commit(`تم: صرفت لحد الحين ${plain(r.spent)} من ${plain(r.planned)}`);
    return true;
  }
  let wExpand = null;
  // محافظ الصرف: كل بند «متغير» — باقي كم، ويتلون
  function renderWallets(box = $('wallets'), all = false) {
    const boxIn = box;
    const ws = (sm.wallets || []).filter(w => all || w.id !== S.settings.pinnedBudget);
    if (!ws.length || sm.future) { box.innerHTML = all ? '<div class="empty">ما فيه محافظ. فعّل «متغير (محفظة)» من تعديل أي بند ثابت.</div>' : ''; return; }
    const bad = ws.filter(w => w.level === 'over' || w.level === 'empty'), warn = ws.filter(w => w.level === 'low');
    const cls = w => w.level === 'over' || w.level === 'empty' ? 'bad' : w.level === 'low' ? 'warn' : 'good';
    const sp = sm.spend || {}, live = sm.cycle === sm.current && !sm.past;
    const icon = id => wIcon(id);
    const ringSVG = (p, col) => { const r = 38, c = 2 * Math.PI * r; return `<span class="wRing"><svg viewBox="0 0 92 92" aria-hidden="true"><circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--gTrack)" stroke-width="9"/><circle cx="46" cy="46" r="${r}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(c * Math.max(0, Math.min(100, p)) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 46 46)"/></svg><b class="num money">${Math.round(Math.max(0, Math.min(100, p)))}٪</b></span>`; };
    const ringCol = w => w.level === 'over' || w.level === 'empty' ? 'var(--bad)' : w.level === 'low' ? 'var(--warn)' : w.id === S.settings.pinnedBudget ? 'var(--accent)' : 'var(--good)';
    const note = w => w.level === 'over' ? 'تجاوزت الميزانية' : w.level === 'empty' ? 'المحفظة خلصت' : w.level === 'low' ? `⚠︎ باقي أقل من ٣٠٪${live && sp.daysLeft ? ' · ' + plain(w.left / Math.max(1, sp.daysLeft)) + ' ر.س يوميًا' : ''}` : w.actual ? `صرفت ${plain(w.actual)}${live && sp.daysLeft ? ' · ' + plain(w.left / Math.max(1, sp.daysLeft)) + ' ر.س يوميًا' : ''}` : 'لم يُصرف شيء';
    box.innerHTML = (all ? '<button class="btn primary block wAddBtn" id="wAddBtn">＋ إضافة محفظة</button>' : '<div class="secLbl">المحافظ</div>') + `<div class="walletsCard${all ? ' wPage' : ''}">
      ${ws.map(w => `<div class="wRow ${cls(w)} ${wExpand === w.id ? 'ex' : ''}" data-w="${esc(w.id)}" style="--wc:${ringCol(w)}">
        <button class="wHead" data-wx>${ringSVG(w.planned ? w.left / w.planned * 100 : 0, ringCol(w))}
          <span class="wTxt"><b>${icon(w.id)} ${esc(wName(w))}${C.WALLETS.includes(w.id) ? ' <i class="lockI" title="محفظة أساسية">🔒</i>' : ''}</b><span class="wAmt"><b class="num money">${w.level === 'over' ? '-' + plain(-w.left) : plain(w.left)}</b> <small>من ${plain(w.planned)}</small></span><small class="wNote ${cls(w)}Txt">${note(w)}</small></span></button>
        ${wExpand === w.id ? `<div class="wMore">
          <div class="btnRow"><input class="input" inputmode="decimal" data-wrem placeholder="باقي معي الحين كم؟"><button class="btn good" data-wremgo>حدّث</button></div>
          <div class="btnRow" style="margin-top:8px"><input class="input" inputmode="decimal" data-wadd placeholder="أو: صرفت كم؟"><button class="btn" data-waddgo>سجّل</button></div>
          ${dateChips()}
          <div data-wimp></div>
          <div class="btnRow" style="margin-top:8px"><button class="btn mini" data-wmore>⋯ تفاصيل وسجل</button><button class="btn mini" data-wedit>✎ تعديل</button>${C.WALLETS.includes(w.id) ? '' : '<button class="btn mini danger" data-wdel>🗑 حذف</button>'}</div></div>` : ''}</div>`).join('')}</div>${all ? '<div class="gl wTip"><span>💡</span><small>مشتريات يوربي تنخصم من البيت، فيجن من العيال، الأهلي من الشخصي (حسب ربط البنوك).</small></div>' : ''}`;
    const wid = el => el.closest('[data-w]').dataset.w;
    box.querySelectorAll('[data-wx]').forEach(b => b.onclick = () => { const id = wid(b); wExpand = wExpand === id ? null : id; renderWallets(boxIn, all); });
    box.querySelectorAll('[data-wremgo]').forEach(b => b.onclick = () => { const id = wid(b), val = b.closest('.wMore').querySelector('[data-wrem]').value; wExpand = null; if (!setRemaining(id, val)) { wExpand = id; } });
    box.querySelectorAll('[data-waddgo]').forEach(b => b.onclick = () => {
      const id = wid(b), amt = toNum(b.closest('.wMore').querySelector('[data-wadd]').value);
      if (!(amt > 0)) return toast('اكتب كم صرفت');
      snapshot(); S.entries.push({ id: C.uid(), kind: 'fixed', ref: id, amount: C.round2(amt), date: readDate(b.closest('.wMore').querySelector('.dChips')), note: '' }); wExpand = null; commit(`تم تسجيل ${plain(amt)} ر.س`);
    });
    wireDateChips(box);
    box.querySelectorAll('[data-wadd]').forEach(inp => { const mo = inp.closest('.wMore'), id = inp.closest('[data-w]').dataset.w; const h = () => { mo.querySelector('[data-wimp]').innerHTML = impactHTML('fixed', id, toNum(inp.value), readDate(mo.querySelector('.dChips')), false); }; inp.addEventListener('input', h); mo.querySelector('.dChips').addEventListener('click', () => setTimeout(h, 0)); });
    box.querySelectorAll('[data-wmore]').forEach(b => b.onclick = () => openItem('fixed', wid(b)));
    box.querySelectorAll('[data-wedit]').forEach(b => b.onclick = () => openWalletEdit(wid(b)));
    box.querySelectorAll('[data-wdel]').forEach(b => b.onclick = () => deleteWallet(wid(b)));
    if ($('wAddBtn')) $('wAddBtn').onclick = () => openWalletEdit();
  }

  /* ───────── إضافة وتعديل وحذف المحافظ (الأساسية ثابتة) ───────── */
  function deleteWallet(id) {
    const x = findItem('fixed', id);
    if (!x || C.WALLETS.includes(id)) return toast('المحافظ الأساسية ثابتة وما تنحذف');
    if (!confirm(`حذف محفظة «${x.name}»؟\nعملياتها المسجلة ما تضيع: تتحول إلى مصروف متغير.`)) return;
    snapshot();
    S.entries.forEach(e => { if (e.kind === 'fixed' && e.ref === id) { e.kind = 'variable'; e.ref = ''; e.note = e.note || x.name; } });
    S.fixed.splice(S.fixed.indexOf(x), 1);
    Object.keys(S.settings.walletBanks || {}).forEach(b => { if (S.settings.walletBanks[b] === id) delete S.settings.walletBanks[b]; });
    if (S.settings.pinnedBudget === id) S.settings.pinnedBudget = 'f-personal';
    wExpand = null; closeSheet(); commit('تم حذف المحفظة');
  }
  function openWalletEdit(id) {
    const x = id ? findItem('fixed', id) : null, base = !!x && C.WALLETS.includes(x.id), isNew = !x;
    const v = (k, d = '') => esc(x && x[k] !== undefined && x[k] !== null ? x[k] : d);
    const html = `
      <label class="field"><span>اسم المحفظة</span><input class="input" id="wName" maxlength="30" value="${esc(x ? (base ? wName({ id: x.id, name: x.name }) : x.name) : '')}" ${base ? 'readonly' : ''} placeholder="مثلاً: السفرة، الهدايا، المقاضي"></label>
      <div class="two"><label class="field"><span>رمز</span><input class="input" id="wIconIn" maxlength="4" value="${esc(x ? wIcon(x.id) : '👛')}"></label>
      <label class="field"><span>المبلغ الشهري</span><input class="input" id="wAmount" inputmode="decimal" value="${v('amount', '')}" placeholder="0"></label></div>
      <label class="field"><span>البنك (اختياري)</span><select class="input" id="wBank">${bankOptions(x ? x.bank : '')}</select></label>
      <p class="note">مشتريات هذا البنك (من رسائل البنك) تنخصم من المحفظة تلقائيًا.</p>
      <p class="note">المبلغ الشهري يدخل في مصاريف الخطة ويُخصم من الفائض المتوقع.</p>
      <button class="btn primary block" id="wSave">${isNew ? 'إضافة المحفظة' : 'حفظ'}</button>
      ${isNew || base ? '' : '<div style="height:8px"></div><button class="btn danger block" id="wDelBtn">حذف المحفظة</button>'}
      ${base ? '<p class="note" style="margin-top:10px">🔒 محفظة أساسية: تقدر تعدّل مبلغها وبنكها، لكن ما تنحذف.</p>' : ''}`;
    openSheet(isNew ? 'محفظة جديدة' : 'تعديل المحفظة', html, () => {
      wireBankSelect($('wBank'));
      $('wSave').onclick = () => {
        const name = $('wName').value.trim();
        if (!name) return toast('اكتب اسم المحفظة');
        const amount = C.round2(toNum($('wAmount').value));
        if (!(amount > 0)) return toast('اكتب المبلغ الشهري');
        snapshot();
        const o = x || { id: 'f-' + C.uid(), flexible: false, wallet: true, startCycle: viewCycle, endCycle: '', note: '' };
        if (!base) o.name = name;
        o.icon = ($('wIconIn').value.trim() || '👛').slice(0, 4);
        o.amount = amount; o.wallet = true;
        o.bank = $('wBank').value === '__new' ? '' : $('wBank').value;
        if (isNew) S.fixed.push(o);
        closeSheet(); commit(isNew ? 'تمت إضافة المحفظة' : 'تم الحفظ');
      };
      if ($('wDelBtn')) $('wDelBtn').onclick = () => deleteWallet(x.id);
    });
  }
  // التحليلات (وين يروح الراتب + عدّاد الديون) مطوية بعد المهام
  const xOpen = () => store.get('mali-v9-xopen') === '1';
  function renderExtras() {
    $('extras').innerHTML = `<details class="extrasD" ${xOpen() ? 'open' : ''}><summary><span class="secIcon">📊</span><span class="secTitle"><b>تحليل الراتب والديون</b><small>وين يروح الراتب · متى تخلص الديون</small></span><span class="chev">‹</span></summary>
      <div class="exBody"><article class="cCard">${flowCard()}</article><article class="cCard">${debtCard()}</article></div></details>`;
    const det = $('extras').querySelector('details');
    det.addEventListener('toggle', () => store.set('mali-v9-xopen', det.open ? '1' : '0'));
    $('extras').querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
  }

  // الرئيسية: تنبيه واحد فقط، والباقي في صفحة التنبيهات
  // الرئيسية: التنبيهات صارت في فقاعة المحلل وصفحة المراقب؛ الجرس يفتح كل التنبيهات
  function renderInsights() { $('insights').innerHTML = ''; }
  function runAction(a) {
    if (!a) return false;
    if (a.type === 'sms') { openSms(); return true; }
    if (a.type === 'tasks') { const d = $('tasks').querySelector('details'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return true; }
    if (a.type === 'open') openItem(a.kind, a.id); else openEdit(a.kind, a.id);
    return true;
  }

  /* ───────── الأقسام (صفحات جانبية) ───────── */
  function diffChip(l) {
    const d = Math.abs(l.diff);
    if (l.kind === 'income') {
      if (!l.recorded) return l.item.confirmed === false ? '<span class="chip muted">غير مؤكد</span>' : '<span class="chip muted">لم يُسجّل</span>';
      return l.actual >= l.planned ? `<span class="chip good">${l.actual > l.planned ? '+' + plain(-l.diff) : 'وصل كامل'}</span>` : `<span class="chip warn">ناقص ${plain(d)}</span>`;
    }
    if (l.kind === 'fixed' && C.isWallet(l.item) && l.planned > 0) {
      const w = C.walletLevel(l.planned, l.actual);
      if (w.level === 'over') return `<span class="chip bad">تعدّيت بـ ${plain(-w.left)}</span>`;
      if (w.level === 'empty') return '<span class="chip bad">خلص</span>';
      if (w.level === 'low') return `<span class="chip warn">باقي ${plain(w.left)} فقط</span>`;
      return `<span class="chip good">باقي ${plain(w.left)}</span>`;
    }
    switch (l.state) {
      case 'over': return `<span class="chip bad">زيادة ${plain(d)}</span>`;
      case 'extra': return `<span class="chip accent">زيادة ${plain(d)}</span>`;
      case 'saved': return `<span class="chip good">وفّرت ${plain(d)}</span>`;
      case 'done': return '<span class="chip good">✓ مكتمل</span>';
      case 'near': return `<span class="chip warn">باقي ${plain(d)}</span>`;
      case 'partial': return `<span class="chip muted">باقي ${plain(d)}</span>`;
      default: return l.closed ? '<span class="chip muted">تم تخطيه</span>' : '<span class="chip muted">لم يُسجّل</span>';
    }
  }
  function rowHTML(l, extra = '') {
    const pct = Math.min(100, l.planned > 0 ? l.actual / l.planned * 100 : (l.actual > 0 ? 100 : 0));
    const wl = l.kind === 'fixed' && C.isWallet(l.item) && l.planned > 0 ? C.walletLevel(l.planned, l.actual).level : '';
    const cls = wl ? (wl === 'over' || wl === 'empty' ? 'bad' : wl === 'low' ? 'warn' : 'good') : l.state === 'over' ? 'bad' : (l.state === 'saved' || l.state === 'done' || l.state === 'good') ? 'good' : l.state === 'near' || l.state === 'warn' ? 'warn' : '';
    return `<button class="row" data-kind="${l.kind}" data-id="${esc(l.id)}">
      <div class="rowTop"><div class="rowName"><b>${esc(l.item.icon ? l.item.icon + ' ' : '')}${esc(l.name)}</b>${bankTag(l.bank)}</div>
      <div class="rowAmt"><b>${money(l.actual, { cur: false })}</b> <small>/ ${money(l.planned, { cur: false })}</small></div></div>
      <div class="bar ${cls}"><i style="width:${pct}%"></i></div>
      <div class="rowFoot"><small>${extra}</small>${diffChip(l)}</div></button>`;
  }
  const sumLine = (a, p, label = 'المسجل') => `<div class="pageSum"><div><small>${label}</small><b>${money(a, { cur: false })}</b></div><div><small>المخطط</small><b>${money(p, { cur: false })}</b></div><div><small>${a > p ? 'الزيادة' : 'الباقي'}</small><b style="color:${a > p ? 'var(--bad)' : 'inherit'}">${money(Math.abs(p - a), { cur: false })}</b></div></div>`;
  // حالة البلاطة: أحمر عند تجاوز، أخضر إذا مكتمل، وإلا محايد
  const tileState = lines => lines.some(l => l.state === 'over') ? 'bad' : lines.length && lines.every(l => ['done', 'saved', 'extra', 'good'].includes(l.state)) ? 'good' : lines.some(l => l.recorded) ? 'warn' : '';

  function buildSecs() {
    const L = sm.lines, T = sm.totals;
    const debtExtra = l => { const rem = C.debtRemaining(S, l.item); const sch = l.item.schedule || []; const last = sch.length ? sch.map(r => r.cycle).sort().pop() : ''; return `المتبقي ${plain(rem)}${last ? ' · ينتهي ' + monthName(last, { month: 'short', year: 'numeric' }) : ''}`; };
    const goalExtra = l => { const g = l.item, saved = C.goalSaved(S, g); return g.target ? `المدخر ${plain(saved)} من ${plain(g.target)} (${Math.min(100, Math.round(saved / g.target * 100))}٪)${g.targetDate ? ' · موعده ' + g.targetDate : ''}` : `المدخر ${plain(saved)}`; };
    const idle = S.goals.filter(g => !L.goals.some(l => l.id === g.id));
    const vlist = sm.variable.slice().sort((a, b) => b.date.localeCompare(a.date));
    const fc = C.forecast(S, sm.current, 8, new Date());
    const maxAbs = Math.max(1, ...fc.map(f => Math.abs(f.surplus)));
    const noCitizen = S.income.filter(x => x.id !== 'i-salary' && x.confirmed !== false);
    return [
      { key: 'monitor', icon: '🔭', title: 'المراقب', sub: 'محلل مالي لوضعك', menuOnly: true, mount: renderMonitor },
      { key: 'tasks', icon: '✅', title: 'المهام', sub: sm.tasks && sm.tasks.overdue.length ? sm.tasks.overdue.length + ' متأخرة' : (sm.tasks ? sm.tasks.open.length + ' باقية' : ''), menuOnly: true, mount: b => renderTasks(b, true) },
      { key: 'wallets', icon: '👛', title: 'المحافظ', sub: (sm.wallets || []).length + ' محافظ', menuOnly: true, mount: b => renderWallets(b, true) },
      { key: 'income', icon: '💰', title: 'الدخل', a: T.income.actual, p: T.income.confirmedPlanned, state: tileState(L.income),
        body: () => sumLine(T.income.actual, T.income.confirmedPlanned, 'المستلم') + L.income.map(l => rowHTML(l, l.item.confirmed === false ? 'غير مؤكد — ما يدخل في حساب الفائض' : '')).join('')
          + (noCitizen.length && sm.planSurplus ? `<p class="note">بدون ${noCitizen.map(x => esc(x.name)).join(' و')} يصير فائض الخطة <b class="num money" style="color:${sm.planSurplus - C.sum(noCitizen, x => C.plannedFor(S, 'income', x, sm.cycle)) < 0 ? 'var(--bad)' : 'inherit'}">${plain(sm.planSurplus - C.sum(noCitizen, x => C.plannedFor(S, 'income', x, sm.cycle)))}</b> ر.س.</p>` : '')
          + addBtn('income', '+ مصدر دخل') },
      { key: 'fixed', icon: '🏠', title: 'المصاريف الثابتة', a: T.fixed.actual, p: T.fixed.planned, state: tileState(L.fixed), badge: sm.overs.length,
        body: () => sumLine(T.fixed.actual, T.fixed.planned) + (L.fixed.map(l => rowHTML(l, [l.item.flexible ? 'ميزانية يومية' : '', l.item.note && l.item.confirm ? '⚠︎ ' + esc(l.item.note) : ''].filter(Boolean).join(' · '))).join('') || '<div class="empty">ما فيه بنود لهذه الدورة</div>') + addBtn('fixed', '+ بند ثابت') },
      { key: 'debtsTemp', icon: '⏳', title: 'الديون المؤقتة', a: T.debtsTemp.actual, p: T.debtsTemp.planned, state: tileState(L.debtsTemp),
        body: () => sumLine(T.debtsTemp.actual, T.debtsTemp.planned, 'المسدد') + (L.debtsTemp.map(l => rowHTML(l, debtExtra(l))).join('') || '<div class="empty">ما عليك أقساط مؤقتة هذه الدورة 🎉</div>') + addBtn('debt', '+ دين مؤقت', 'temp') },
      { key: 'debtsFixed', icon: '🏦', title: 'القروض', a: T.debtsFixed.actual, p: T.debtsFixed.planned, state: tileState(L.debtsFixed),
        body: () => sumLine(T.debtsFixed.actual, T.debtsFixed.planned, 'المسدد') + (L.debtsFixed.map(l => rowHTML(l, debtExtra(l))).join('') || '<div class="empty">لا توجد قروض</div>') + addBtn('debt', '+ قرض', 'fixed') },
      { key: 'goals', icon: '🎯', title: 'الأهداف', a: T.goals.actual, p: T.goals.planned, state: tileState(L.goals),
        body: () => sumLine(T.goals.actual, T.goals.planned, 'المحوّل') + (L.goals.map(l => rowHTML(l, goalExtra(l))).join('') || '<div class="empty">ما فيه مخصصات أهداف هذه الدورة</div>')
          + (idle.length ? `<div class="subHead">بدون مخصص هذه الدورة</div>` + idle.map(g => { const saved = C.goalSaved(S, g); return `<button class="row" data-kind="goal" data-id="${esc(g.id)}" data-edit="1"><div class="rowTop"><div class="rowName"><b>${esc(g.icon || '🎯')} ${esc(g.name)}</b>${bankTag(g.bank)}</div><div class="rowAmt"><small>${g.active ? '' : 'متوقف · '}${money(saved, { cur: false })}${g.target ? ' / ' + plain(g.target) : ''}</small></div></div>${g.note ? `<div class="rowFoot"><small>${esc(g.note)}</small></div>` : ''}</button>`; }).join('') : '')
          + addBtn('goal', '+ هدف جديد') },
      { key: 'variable', icon: '🧾', title: 'المصاريف المتغيرة', a: T.variable.actual, p: null, state: T.variable.actual ? 'warn' : '',
        body: () => (vlist.map(e => `<div class="entry"><div><b>${esc(e.note || 'مصروف')}</b><small>${esc(e.date)} ${bankTag(e.bank)}</small></div><div class="btnRow" style="flex:none;align-items:center"><b>${money(e.amount, { cur: false })}</b><div class="eBtns"><button class="x edit" data-edit="${esc(e.id)}" aria-label="تعديل">${svg(ICON.edit, 15)}</button><button class="x" data-del="${esc(e.id)}" aria-label="حذف">✕</button></div></div></div>`).join('') || '<div class="empty">ما سجلت مصروف متغير هذه الدورة</div>')
          + `<button class="addLine" data-quick="variable">+ مصروف متغير</button>` },
      { key: 'banks', icon: '🏛️', title: 'التوزيع حسب البنك', menuOnly: true,
        body: () => sm.banks.map(b => { const bk = bankById(b.bank); const pct = b.planned ? Math.min(100, b.actual / b.planned * 100) : 0; return `<div class="row" style="cursor:default"><div class="rowTop"><div class="rowName"><b>${bk ? bankTag(b.bank) : '<span class="bank">غير محدد</span>'}</b><small style="color:var(--muted);font-size:12px">${b.count} بند</small></div><div class="rowAmt"><b>${money(b.actual, { cur: false })}</b> <small>/ ${money(b.planned, { cur: false })}</small></div></div><div class="bar"><i style="width:${pct}%;background:${bk ? esc(bk.color) : 'var(--muted)'}"></i></div></div>`; }).join('')
          + '<p class="note">مجموع المخصصات من كل جهة، وليس رصيد البنك. غيّر الجهة من تعديل البند.</p>' },
      { key: 'forecast', icon: '📈', title: 'الأشهر القادمة', menuOnly: true,
        body: () => fc.map(f => `<div class="fc"><span>${monthName(f.cycle, { month: 'short', year: '2-digit' })}</span><div class="fbar"><i style="width:${Math.abs(f.surplus) / maxAbs * 100}%;background:${f.surplus < 0 ? 'var(--bad)' : f.surplus / (f.income || 1) * 100 >= S.settings.rules.bufferGood ? 'var(--good)' : 'var(--warn)'}"></i></div><b style="color:${f.surplus < 0 ? 'var(--bad)' : 'inherit'}">${money(f.surplus, { cur: false })}</b></div>`).join('')
          + '<p class="note">الأخضر: فائض مريح · البرتقالي: فائض ضعيف · الأحمر: عجز. الأرقام تتغير لما تنتهي الأقساط أو تكتمل الأهداف.</p>' },
      { key: 'alerts', icon: '🔔', title: 'التنبيهات', menuOnly: true, badge: sm.insights.filter(i => i.level === 'bad').length,
        body: () => sm.insights.map((x, i) => `<button class="insight ${x.level}" data-ins="${i}"><span class="ic">${x.icon}</span><span><b>${esc(x.title)}</b><small>${esc(x.text)}</small></span></button>`).join('<div style="height:8px"></div>') || '<div class="empty">ما فيه تنبيهات 👌</div>' }
    ];
  }

  /* شريط التنقل السفلي */
  const TABS = [['home', 'الرئيسية', ICON.home], ['tasks', 'المهام', ICON.check], ['fab'], ['wallets', 'المحافظ', ICON.wallet], ['more', 'المزيد', ICON.grid]];
  function renderTabbar() {
    if (!sm) return;
    const drawerOn = $('drawer').classList.contains('show');
    const act = drawerOn ? 'more' : curPage ? (['tasks', 'wallets'].includes(curPage) ? curPage : 'more') : 'home';
    const od = sm.tasks ? sm.tasks.overdue.length : 0;
    const wo = sm.future ? 0 : (sm.wallets || []).filter(w => w.level === 'over' || w.level === 'empty').length;
    $('tabbar').innerHTML = TABS.map(([k, l, d]) => k === 'fab'
      ? `<div class="fabSlot"><button class="dFab" id="fab" aria-label="تسجيل صرف">${svg(ICON.plus, 26, 2.4)}</button></div>`
      : `<button class="${k === act ? 'on' : ''}" data-tab="${k}" aria-label="${l}"${k === act ? ' aria-current="page"' : ''}><span class="tPo">${svg(d, 22)}${k === 'tasks' && od ? `<i class="tBadge">${od}</i>` : ''}${k === 'wallets' && wo ? `<i class="tBadge">${wo}</i>` : ''}</span>${l}</button>`).join('');
    $('tabbar').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => goTab(b.dataset.tab));
    $('fab').onclick = openQuick;
  }
  function goTab(k) {
    if (k === 'more') { closePage(); openDrawer(); return; }
    closeDrawer();
    if (k === 'home') { closePage(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    openPage(k);
  }
  function renderBell() {
    const bad = (sm.insights || []).filter(i => i.level === 'bad').length;
    $('bellBtn').innerHTML = svg(ICON.bell, 20) + (bad ? `<i class="dot">${bad}</i>` : '');
  }
  function renderSections() { renderDrawer(); if (curPage) fillPage(); }

  /* القائمة الجانبية (من اليمين) */
  function renderDrawer() {
    const secs = buildSecs();
    $('drawerList').innerHTML = secs.map(x => `<button class="dItem" data-page="${x.key}"><span class="secIcon">${x.icon}</span><span class="secTitle"><b>${x.title}</b>${x.sub ? `<small>${x.sub}</small>` : ''}${x.a !== undefined ? `<small class="num money">${plain(x.a)}${x.p ? ' / ' + plain(x.p) : ''}</small>` : ''}</span>${x.badge ? `<i class="dot">${x.badge}</i>` : ''}<span class="chev">‹</span></button>`).join('')
      + `<button class="dItem" id="dSms"><span class="secIcon">📩</span><span class="secTitle"><b>رسالة بنك</b><small>الصق وتنسجل بعد تأكيدك</small></span></button>`
      + `<button class="dItem" id="dPaste"><span class="secIcon">📋</span><span class="secTitle"><b>من الحافظة</b><small>انسخ الرسالة واضغط</small></span></button>`
      + `<button class="dItem" id="dShortcut"><span class="secIcon">⚡️</span><span class="secTitle"><b>اختصار الآيفون</b><small>ربط تلقائي</small></span></button>`
      + `<button class="dItem" id="dHealth"><span class="secIcon">🩺</span><span class="secTitle"><b>تقييم الوضع</b><small>${esc(sm.health.label)} · ${sm.health.level === 'unknown' ? '—' : sm.health.score}/100</small></span></button>`
      + `<button class="dItem" id="dSettings"><span class="secIcon">⚙︎</span><span class="secTitle"><b>الإعدادات</b><small>الألوان والنسخ الاحتياطي</small></span></button>`;
    $('drawerList').querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
    $('dHealth').onclick = () => { closeDrawer(); openHealth(); };
    $('dSms').onclick = () => { closeDrawer(); openSms(); };
    $('dPaste').onclick = () => { closeDrawer(); pasteQuick(); };
    $('dShortcut').onclick = () => { closeDrawer(); openShortcutGuide(); };
    $('dSettings').onclick = () => { closeDrawer(); openSettings(); };
  }
  function openDrawer() { renderDrawer(); $('drawer').classList.add('show'); $('drawer').setAttribute('aria-hidden', 'false'); renderTabbar(); }
  function closeDrawer() { $('drawer').classList.remove('show'); $('drawer').setAttribute('aria-hidden', 'true'); renderTabbar(); }

  /* صفحة القسم */
  let curPage = null;
  function openPage(key) { curPage = key; closeDrawer(); fillPage(); $('page').classList.add('show'); $('page').setAttribute('aria-hidden', 'false'); $('pageBody').scrollTop = 0; renderTabbar(); }
  function closePage() { curPage = null; $('page').classList.remove('show'); $('page').setAttribute('aria-hidden', 'true'); renderTabbar(); }
  function fillPage() {
    const sec = buildSecs().find(x => x.key === curPage);
    if (!sec) return closePage();
    $('pageTitle').textContent = sec.title;
    $('pageCycle').textContent = 'راتب ' + monthName(sm.cycle);
    const body = $('pageBody');
    if (sec.mount) { body.innerHTML = ''; sec.mount(body); return; }
    body.innerHTML = sec.body();
    body.querySelectorAll('.row[data-kind]').forEach(b => b.onclick = () => b.dataset.edit ? openEdit(b.dataset.kind, b.dataset.id) : openItem(b.dataset.kind, b.dataset.id));
    body.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openEdit(b.dataset.add, null, b.dataset.sub));
    body.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => openQuick());
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { snapshot(); S.entries = S.entries.filter(e => e.id !== b.dataset.del); commit('تم حذف المصروف'); });
    body.querySelectorAll('[data-ins]').forEach(b => b.onclick = () => runAction(sm.insights[+b.dataset.ins].action));
  }
  const addBtn = (kind, label, sub = '') => `<button class="addLine" data-add="${kind}" data-sub="${sub}">${label}</button>`;

  /* ───────── الورقة السفلية ───────── */
  function openSheet(title, html, onMount) {
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = html;
    $('sheetBody').scrollTop = 0;
    $('sheetWrap').classList.add('show'); $('sheetWrap').setAttribute('aria-hidden', 'false');
    if (onMount) onMount($('sheetBody'));
  }
  function closeSheet() { $('sheetWrap').classList.remove('show'); $('sheetWrap').setAttribute('aria-hidden', 'true'); }
  $('sheetWrap').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if ($('sheetWrap').classList.contains('show')) closeSheet(); else if (curPage) closePage(); else closeDrawer(); });

  const todayISO = () => C.isoDate(new Date());
  const defaultDate = () => { const t = todayISO(); return C.cycleOf(t, S.settings.salaryDay) === viewCycle ? t : C.isoDate(C.cycleStart(viewCycle, S.settings.salaryDay)); };
  const bankOptions = sel => `<option value="">— بدون —</option>` + allBanks().map(b => `<option value="${esc(b.id)}" ${b.id === sel ? 'selected' : ''}>${esc(b.name)}</option>`).join('') + '<option value="__new">+ جهة أخرى…</option>';
  function wireBankSelect(sel) {
    sel.addEventListener('change', () => {
      if (sel.value !== '__new') return;
      const name = (prompt('اسم الجهة / البنك') || '').trim().slice(0, 40);
      if (!name) { sel.value = ''; return; }
      const b = { id: 'c-' + C.uid(), name, color: '#64748b' };
      S.settings.customBanks.push(b); persist();
      sel.innerHTML = bankOptions(b.id);
    });
  }

  /* تفاصيل بند: المخطط والفعلي وسجل الصرف */
  function openItem(kind, id) {
    const x = findItem(kind, id); if (!x) return;
    const l = C.itemLine(S, kind, x, viewCycle, sm.past);
    const isInc = kind === 'income';
    const verb = isInc ? 'استلمت' : kind === 'goal' ? 'حوّلت' : kind === 'debt' ? 'سددت' : 'صرفت';
    const remain = C.round2(l.planned - l.actual);
    const hasOv = S.overrides[viewCycle] && Object.prototype.hasOwnProperty.call(S.overrides[viewCycle], id);
    const html = `
      <div class="card">
        <div class="rowTop" style="margin-bottom:10px"><span>${bankTag(x.bank) || '<span class="bank">بدون جهة</span>'}</span>${diffChip(l)}</div>
        <div class="stats">
          <div><small>المخطط${hasOv ? ' (معدّل)' : ''}</small><b>${money(l.planned, { cur: false })}</b></div>
          <div><small>${isInc ? 'المستلم' : 'الفعلي'}</small><b>${money(l.actual, { cur: false })}</b></div>
          <div><small>${remain >= 0 ? (isInc ? 'الباقي' : l.closed ? 'التوفير' : 'المتبقي') : 'الزيادة'}</small><b style="color:${remain < 0 ? (isInc ? 'var(--good)' : 'var(--bad)') : l.closed && !isInc ? 'var(--good)' : 'inherit'}">${money(Math.abs(remain), { cur: false })}</b></div>
        </div>
      </div>
      ${isInc ? '' : `<div class="card"><b>سجّل بالباقي</b><p class="note" style="margin:4px 0 8px">اكتب كم باقي لك من هذا البند، وأنا أحسب كم انصرف وأسجله.</p>
        <div class="btnRow"><input class="input" id="rAmt" inputmode="decimal" placeholder="الباقي (مثلاً 780)" style="flex:2"><button class="btn good" id="rSave">سجّل الفرق</button></div><p class="note" id="rHint" style="margin:6px 0 0"></p></div>`}
      <div class="card">
        <div class="field"><span>سجّل مبلغ ${verb}ه</span><input class="input bigInput" id="eAmt" inputmode="decimal" placeholder="0" value=""></div>
        <div id="eImpact"></div>
        <div class="two"><label class="field"><span>التاريخ</span><input class="input" type="date" id="eDate" value="${defaultDate()}"></label><label class="field"><span>ملاحظة</span><input class="input" id="eNote" placeholder="اختياري"></label></div>
        <div class="btnRow">
          <button class="btn primary" id="eAdd">إضافة</button>
          ${remain > 0 ? `<button class="btn good" id="eFull">${isInc ? 'استلمته' : 'دفعته'} كامل (${plain(remain)})</button>` : ''}
        </div>
        ${!isInc ? `<div class="toggle" style="margin-top:8px"><span><b>اكتمل البند لهذه الدورة</b><br><small style="color:var(--muted)">فعّلها إذا خلص صرفه، عشان يُحسب التوفير ضمن الفائض</small></span><input type="checkbox" id="eClosed" ${l.closed ? 'checked' : ''} ${sm.past ? 'disabled' : ''}></div>` : ''}
      </div>
      <div class="card"><b>سجل ${monthName(viewCycle, { month: 'long' })}</b>${l.entries.length ? l.entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `<div class="entry"><div><b>${money(e.amount)}</b><small>${esc(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</small></div><div class="eBtns"><button class="x edit" data-edit="${esc(e.id)}" aria-label="تعديل">${svg(ICON.edit, 15)}</button><button class="x" data-del="${esc(e.id)}" aria-label="حذف">✕</button></div></div>`).join('') : '<div class="empty">ما فيه تسجيل بعد</div>'}</div>
      <div class="card">
        <div class="field"><span>تعديل المخطط لهذا الشهر فقط</span><div class="btnRow"><input class="input" id="ovAmt" inputmode="decimal" value="${l.planned}" style="flex:2"><button class="btn" id="ovSave">حفظ</button></div></div>
        ${hasOv ? '<button class="btn block" id="ovReset">رجّعه للمبلغ الأساسي</button>' : ''}
        <p class="note">التعديل هنا يخص ${monthName(viewCycle)} فقط. لتغيير المبلغ دائمًا استخدم «تعديل البند».</p>
        <button class="btn block" id="eEdit">✎ تعديل البند (الاسم، المبلغ، البنك…)</button>
      </div>`;
    const pace = kind === 'fixed' && x.flexible ? paceBlock(C.budgetPace(S, sm, id)) : '';
    openSheet(x.name, (pace ? `<div class="card">${pace}</div>` : '') + html, body => {
      const addEntry = amt => {
        if (!(amt > 0)) return toast('اكتب مبلغ صحيح');
        const date = $('eDate').value || defaultDate();
        snapshot();
        S.entries.push({ id: C.uid(), kind, ref: id, amount: C.round2(amt), date, note: $('eNote').value.trim().slice(0, 80) });
        commit(`تم تسجيل ${plain(amt)} ر.س`); openItem(kind, id);
      };
      $('eAdd').onclick = () => addEntry(toNum($('eAmt').value));
      const eHint = () => { $('eImpact').innerHTML = impactHTML(kind, id, toNum($('eAmt').value), $('eDate').value, false); };
      $('eAmt').oninput = eHint; $('eDate').onchange = eHint;
      if ($('rAmt')) {
        const calc = () => { const v = $('rAmt').value; if (v === '') { $('rHint').textContent = ''; return null; } return C.remainingToSpend(S, kind, x, viewCycle, toNum(v), sm.past); };
        $('rAmt').oninput = () => { const r = calc(); if (!r) return; $('rHint').innerHTML = r.add > 0 ? `يعني صرفت <b class="num money">${plain(r.spent)}</b> من ${plain(r.planned)}، ومسجل ${plain(r.recorded)} ← يضاف <b class="num money">${plain(r.add)}</b>` : r.add === 0 ? 'مطابق للمسجل، ما فيه شيء يضاف.' : `الباقي أكبر من المتوقع (مسجل صرف ${plain(r.recorded)}). احذف حركة أو عدّل المخطط.`; };
        $('rSave').onclick = () => {
          const r = calc(); if (!r) return toast('اكتب الباقي');
          if (r.add <= 0) return toast(r.add === 0 ? 'مطابق للمسجل' : 'الباقي أكبر من المتوقع');
          snapshot();
          S.entries.push({ id: C.uid(), kind, ref: id, amount: r.add, date: $('eDate').value || defaultDate(), note: 'حسب الباقي ' + plain(toNum($('rAmt').value)) });
          commit(`تم تسجيل ${plain(r.add)} ر.س (الباقي ${plain(toNum($('rAmt').value))})`); openItem(kind, id);
        };
      }
      if ($('eFull')) $('eFull').onclick = () => {
        if (!isInc) { S.closed[viewCycle] = S.closed[viewCycle] || {}; S.closed[viewCycle][id] = true; }
        addEntry(remain);
      };
      if ($('eClosed')) $('eClosed').onchange = e => setClosed(e.target.checked);
      function setClosed(on) {
        S.closed[viewCycle] = S.closed[viewCycle] || {};
        if (on) S.closed[viewCycle][id] = true; else delete S.closed[viewCycle][id];
        commit(on ? 'تم إقفال البند لهذه الدورة' : 'البند مفتوح', { undo: false }); openItem(kind, id);
      }
      body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { snapshot(); S.entries = S.entries.filter(e => e.id !== b.dataset.del); commit('تم الحذف'); openItem(kind, id); });
      body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEntryEdit(b.dataset.edit, () => openItem(kind, id)));
      $('ovSave').onclick = () => { snapshot(); S.overrides[viewCycle] = S.overrides[viewCycle] || {}; S.overrides[viewCycle][id] = C.round2(toNum($('ovAmt').value)); commit('تم تعديل مخطط هذا الشهر'); openItem(kind, id); };
      if ($('ovReset')) $('ovReset').onclick = () => { snapshot(); delete S.overrides[viewCycle][id]; commit('رجع للمبلغ الأساسي'); openItem(kind, id); };
      $('eEdit').onclick = () => openEdit(kind, id);
    });
  }

  /* من اختصار الآيفون: «مالي|البند|الرسالة» — البند محدد مسبقًا فتنسجل مباشرة مع إمكانية التراجع */
  function recordClip(clip) {
    const t = C.resolveTarget(S, clip.key);
    if (t && t.kind === 'ignore') return toast('تم تجاهل الرسالة');
    const p = C.parseSms(clip.sms, new Date(), clip.sender, S.settings.cardMap);
    if (!t || !(p.amount > 0)) { openSms(clip.sms); if (!t) toast(`ما عرفت البند «${clip.key}» — اختره من القائمة`); return; }
    if (S.entries.some(e => e.smsHash === p.hash)) return toast('هذي الرسالة مسجّلة قبل');
    snapshot();
    const e = { id: C.uid(), kind: t.kind, ref: t.ref, amount: p.amount, date: p.date, note: p.merchant || (t.kind === 'variable' ? 'مصروف' : ''), bank: p.bank, smsHash: p.hash, source: 'shortcut' };
    S.entries.push(e);
    if (p.type !== 'income' && p.merchant) { S.settings.merchantMap = S.settings.merchantMap || {}; S.settings.merchantMap[p.merchant.toLowerCase()] = { kind: t.kind, ref: t.ref }; }
    const cyc = C.cycleOf(e.date, S.settings.salaryDay); if (cyc !== viewCycle) viewCycle = cyc;
    const name = t.kind === 'variable' ? 'المتغيرة' : (findItem(t.kind, t.ref) || {}).name || '';
    commit(`تم تسجيل ${plain(p.amount)} ر.س على «${name}»`);
  }
  /* ───────── الربط التلقائي: سحب الرسائل من صندوق الوارد على Vercel ───────── */
  let syncing = false, lastSync = 0;
  async function syncInbox(manual) {
    const key = S.settings.syncKey;
    if (!key || syncing || location.protocol === 'file:') return;
    if (!manual && Date.now() - lastSync < 20000) return;
    syncing = true; lastSync = Date.now();
    try {
      const r = await fetch('./api/inbox', { headers: { 'x-mali-key': key }, cache: 'no-store' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { if (manual) toast(data.message || 'تعذر الاتصال بصندوق الوارد'); return; }
      const items = data.items || [];
      if (!items.length) { if (manual) toast('ما فيه رسائل جديدة'); return; }
      let saved = 0, total = 0, pend = 0, ign = 0;
      const before = JSON.stringify(S);
      for (const it of items) {
        const p = C.parseSms(it.text, new Date(it.at || Date.now()), it.sender, S.settings.cardMap);
        if (C.ignoreMatch(S, it.text, p.hash)) { ign++; continue; }
        if (S.entries.some(e => e.smsHash === p.hash) || S.pending.some(x => x.hash === p.hash)) continue;
        let t = it.item ? C.resolveTarget(S, it.item) : null;
        if (t && t.kind === 'ignore') continue;
        if (!t) t = C.autoTarget(S, p, C.cycleOf(p.date, S.settings.salaryDay));   // مشتريات بنك مربوط بمحفظة تُخصم تلقائيًا
        if (t && p.amount > 0) {
          S.entries.push({ id: C.uid(), kind: t.kind, ref: t.ref, amount: p.amount, date: p.date, note: p.merchant || (t.kind === 'variable' ? 'مصروف' : ''), bank: p.bank, smsHash: p.hash, source: 'inbox' });
          if (p.type !== 'income' && p.merchant) S.settings.merchantMap[p.merchant.toLowerCase()] = { kind: t.kind, ref: t.ref };
          saved++; total += p.amount;
        } else { S.pending.push({ hash: p.hash, text: it.text, sender: it.sender || '', at: it.at }); pend++; }
      }
      undoSnap = before; store.set('mali-v9-undo', before);
      persist();
      // نحذفها من الصندوق فقط بعد ما انحفظت على الجهاز
      await fetch('./api/inbox?ack=' + items.length, { headers: { 'x-mali-key': key }, cache: 'no-store' }).catch(() => {});
      render();
      if (saved || pend || ign) toast([ign ? `تجاهلت ${ign}` : '', saved ? `📩 انسجلت ${saved} حركة (${plain(total)} ر.س)` : '', pend ? `${pend} تحتاج تصنيف` : ''].filter(Boolean).join(' · '), saved > 0);
    } catch (e) { if (manual) toast('تعذر الاتصال — تأكد من الإنترنت'); }
    finally { syncing = false; }
  }

  /* ───────── المراقب: محلل مالي ───────── */
  const monDay = iso => { const d = new Date(iso + 'T12:00:00'), t = todayISO(); const diff = Math.round((new Date(t + 'T12:00:00') - d) / 864e5); return diff === 0 ? 'اليوم' : diff === 1 ? 'أمس' : dayFmt(d); };
  function monitorData() { return C.monitor(S, sm, new Date()); }
  function renderMonitor(box) {
    const M = monitorData(), f = n => plain(Math.abs(n));
    const lvl = { good: 'ممتاز', warn: 'انتبه', bad: 'تدخل', unknown: '—' }[M.level];
    const max = Math.max(1, ...M.days.map(d => d.total), M.pace.daily || 0);
    const bars = M.days.map(d => {
      const over = M.pace.daily > 0 && d.total > M.pace.daily + 0.009;
      return `<div class="mBar ${d.date === M.todayStr ? 'today' : ''}" title="${esc(d.date)}: ${plain(d.total)}"><i class="${over ? 'bad' : ''}" style="--p:${Math.max(d.total ? 4 : 0, d.total / max * 100).toFixed(1)}"></i><small>${new Date(d.date + 'T12:00:00').getDate()}</small></div>`;
    }).join('');
    const lim = M.pace.daily > 0 ? `<div class="mLim" style="bottom:calc(${(M.pace.daily / max * 100).toFixed(1)} * 1.12px + 18px)"><span>المسموح ${plain(M.pace.daily)}</span></div>` : '';
    const barsOf = (rows, total) => rows.length ? rows.map(r => `<div class="mRow"><div class="mRowT"><span>${esc(r.label)}${r.count > 1 ? ` <small>×${r.count}</small>` : ''}</span><b class="num money">${plain(r.amount)}</b></div><div class="bar"><i style="width:${Math.min(100, total ? r.amount / total * 100 : 0)}%"></i></div></div>`).join('') : '<div class="empty">ما فيه صرف مسجل هذي الدورة</div>';
    const weekTxt = M.week.deltaPct === null ? '' : `<span class="chip ${M.week.deltaPct > 15 ? 'bad' : M.week.deltaPct < -15 ? 'good' : 'muted'}">${M.week.deltaPct > 0 ? '▲' : M.week.deltaPct < 0 ? '▼' : '='} <span class="num">${Math.abs(M.week.deltaPct)}%</span></span>`;
    const prevTxt = M.prev && M.prev.out > 0 ? `<div class="mCmp"><div><small>هذي الدورة</small><b class="num money">${plain(M.spentTotal)}</b></div><div><small>الدورة السابقة (كاملة)</small><b class="num money">${plain(M.prev.out)}</b></div></div>` : '';
    const ign = (S.ignored || []).length, rules = (S.settings.ignoreRules || []).length;
    box.innerHTML = `
      <div class="gaugeBox"><div class="gWrap">${gaugeSVG(M.level === 'unknown' ? [] : [[Math.max(2, M.health.score), { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' }[M.health.color] || 'var(--good)']])}<div class="gMid"><small>درجة الوضع</small><b class="num">${M.level === 'unknown' ? '—' : M.health.score}</b><small>${M.level === 'unknown' ? '' : 'من 100 · ' + esc(M.health.label)}</small></div></div></div>
      <div class="bubbleRow" style="cursor:default"><span class="bIc">${svg(ICON.bolt, 22)}</span><span class="bubble"><b>${esc(M.summary.lead)}</b>${M.alerts[0] && M.level !== 'good' ? `<br>${esc(M.alerts[0].text)}` : esc(' ' + M.summary.text)}</span></div>
      <div class="mKpis">
        <div><small>صرف اليوم</small><b class="num money">${plain(M.todaySpent)}</b></div>
        <div><small>آخر 7 أيام</small><b class="num money">${plain(M.week.now)}</b>${weekTxt}</div>
        <div><small>متأخر</small><b class="num money ${M.overdue.count ? 'badTxt' : ''}">${plain(M.overdue.total)}</b></div>
      </div>
      <div class="secLbl">وش صار</div>
      <div class="card mFeed">${M.recent.length ? M.recent.map(r => `<div class="mEv"><span class="mIc ${r.income ? 'in' : 'out'}">${r.income ? '⬇︎' : '⬆︎'}</span><div><b>${esc(r.note || r.name)}</b><small>${esc(r.note && r.name !== '—' && r.name !== r.note ? r.name + ' · ' : '')}${monDay(r.date)}${r.source === 'sms' || r.source === 'inbox' ? ' · من البنك' : ''}</small></div><b class="num money ${r.income ? 'goodTxt' : ''}">${r.income ? '+' : ''}${plain(r.amount)}</b></div>`).join('') : '<div class="empty">ما سجلت شيء بعد</div>'}</div>
      <div class="secLbl">الصرف آخر 14 يوم</div>
      <div class="card"><div class="mChart">${lim}${bars}</div></div>
      <div class="secLbl">التحليل والتنبيهات</div>
      ${M.alerts.map(a => `<div class="mAlert ${a.level}"><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div>`).join('')}
      <div class="secLbl">وين راحت فلوسك</div>
      <div class="card"><div class="mSub">حسب النوع</div>${barsOf(M.byKind, M.spentTotal)}
        ${M.topMerchants.length ? `<div class="mSub">أكثر الجهات في المرن</div>${barsOf(M.topMerchants, M.spentTotal)}` : ''}
        ${M.byBank.length ? `<div class="mSub">حسب البنك</div>${barsOf(M.byBank, M.spentTotal)}` : ''}</div>
      ${prevTxt ? `<div class="secLbl">مقارنة بالدورة السابقة</div><div class="card">${prevTxt}</div>` : ''}
      <p class="note" style="margin:14px 4px">تحليل حسابي من الحركات المسجلة عندك، مو رصيد البنك الفعلي.${ign || rules ? ` · ${ign} رسالة و${rules} قاعدة تجاهل <button class="textLink" id="monIgn" style="color:var(--accentFg);text-decoration:underline">إدارة</button>` : ''}</p>`;
    if ($('monIgn')) $('monIgn').onclick = () => { closePage(); openSettings(); };
  }
  function renderMonitorCard() {
    if (sm.future) return '';
    const M = monitorData();
    if (M.level === 'unknown') return '';
    const top = M.alerts[0];
    return `<button class="pendingCard monCard ${M.level}" id="monBtn"><span class="ic">🔭</span><span><b>المراقب · ${{ good: 'الوضع ممتاز', warn: 'فيه ملاحظات', bad: 'يحتاج تدخل' }[M.level]}</b><small>${esc(top && M.level !== 'good' ? top.title : M.summary.text)}</small></span></button>`;
  }

  function renderPending() {
    const n = (S.pending || []).length;
    const dups = C.auditPlan(S).filter(f => f.type === 'dup').length;
    const auditCard = dups ? `<button class="pendingCard" id="auditCard" style="border-inline-start-color:var(--bad)"><span class="ic">🩺</span><span><b>لقيت ${dups} بند مكرر في خطتك</b><small>يضخّم المصاريف — اضغط وأصلحها</small></span><span class="chev">‹</span></button>` : '';
    $('pending').innerHTML = auditCard + (n ? `<button class="pendingCard" id="pendBtn"><span class="ic">📩</span><span><b>${n} حركة من البنك تحتاج تصنيف</b><small>وصلت بدون ما تختار البند — اضغط وحددها</small></span><span class="chev">‹</span></button>` : '');
    if ($('auditCard')) $('auditCard').onclick = openAudit;
    if (n) $('pendBtn').onclick = () => openSms(S.pending.map(x => x.text).join('\n\n'), true);
  }

  async function pasteQuick() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { return openSms(); }
    const clip = C.parseMaliClip(text);
    if (clip) return recordClip(clip);
    openSms(text);
  }

  /* رسائل البنوك: لصق ← قراءة ← تأكيد */
  function itemOptions(sel) {
    const opt = (v, n) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(n)}</option>`;
    return opt('variable|', '🧾 مصروف متغير (خارج البنود)')
      + `<optgroup label="المصاريف الثابتة">${S.fixed.map(x => opt('fixed|' + x.id, x.name)).join('')}</optgroup>`
      + `<optgroup label="الديون والأقساط">${S.debts.map(x => opt('debt|' + x.id, x.name)).join('')}</optgroup>`
      + `<optgroup label="الأهداف">${S.goals.map(x => opt('goal|' + x.id, x.name)).join('')}</optgroup>`
      + `<optgroup label="الدخل">${S.income.map(x => opt('income|' + x.id, x.name)).join('') + opt('income|', 'دخل آخر')}</optgroup>`;
  }
  let pendingMode = false;
  function openSms(prefill = '', fromPending = false) {
    pendingMode = fromPending;
    const html = `
      <p class="note" style="margin-top:0">انسخ رسالة البنك (أو أكثر من رسالة، بينها سطر فاضي) والصقها هنا. أقرأ المبلغ والبنك والتاجر وأقترح البند، وما ينسجل شيء إلا بعد تأكيدك.</p>
      <textarea class="input" id="smsText" rows="5" placeholder="مثال: شراء عبر نقاط البيع&#10;مبلغ: 85.50 ريال&#10;لدى: ALDREES">${esc(prefill)}</textarea>
      <div class="btnRow" style="margin:8px 0 12px"><button class="btn" id="smsPaste">📋 لصق من الحافظة</button><button class="btn primary" id="smsRead">اقرأ الرسالة</button></div>
      <div id="smsOut"></div>`;
    openSheet('📩 رسالة بنك', html, () => {
      $('smsPaste').onclick = async () => {
        try { const t = await navigator.clipboard.readText(); const clip = C.parseMaliClip(t); if (clip) { closeSheet(); return recordClip(clip); } $('smsText').value = t; readSms(); }
        catch (e) { toast('اضغط مطولًا في المربع واختر «لصق»'); $('smsText').focus(); }
      };
      $('smsRead').onclick = readSms;
      if (prefill) readSms();
    });
  }
  function readSms() {
    const msgs = C.splitSms($('smsText').value);
    if (!msgs.length) { $('smsOut').innerHTML = '<div class="empty">الصق رسالة أولًا</div>'; return; }
    const known = new Set(S.entries.map(e => e.smsHash).filter(Boolean));
    let autoIgn = 0;
    const rows = msgs.map(m => {
      const p = C.parseSms(m, new Date(), '', S.settings.cardMap);
      if (C.ignoreMatch(S, m, p.hash)) { autoIgn++; if (pendingMode) S.pending = S.pending.filter(x => x.hash !== p.hash); return null; }
      const cyc = C.cycleOf(p.date, S.settings.salaryDay);
      const g = C.suggestForSms(S, p, cyc);
      return { p, g, dup: known.has(p.hash) };
    }).filter(Boolean);
    if (!rows.length) { $('smsOut').innerHTML = `<div class="empty">${autoIgn ? `تم تجاهل ${autoIgn} رسالة حسب قواعد التجاهل` : 'الصق رسالة أولًا'}</div>`; if (autoIgn) { persist(); renderPending(); } return; }
    $('smsOut').innerHTML = rows.map((r, i) => `
      <div class="card smsCard ${r.dup ? 'dup' : ''}" data-i="${i}">
        <div class="rowTop"><span class="chip ${r.p.type === 'income' ? 'good' : 'bad'}">${r.p.type === 'income' ? '⬇︎ دخل' : '⬆︎ خصم'}</span>${r.dup ? '<span class="chip warn">مسجّلة قبل</span>' : `<label class="chk"><input type="checkbox" class="smsOn" ${r.p.amount ? 'checked' : ''}> سجّل</label>`}<button type="button" class="chip muted smsIgn" style="margin-inline-start:auto;min-height:32px">🚫 تجاهل</button></div>
        <div class="two" style="margin-top:8px"><label class="field"><span>المبلغ</span><input class="input smsAmt" inputmode="decimal" value="${r.p.amount || ''}"></label><label class="field"><span>التاريخ</span><input class="input smsDate" type="date" value="${r.p.date}"></label></div>
        <label class="field"><span>البند <small style="color:var(--accent)">(${esc(r.g.why)})</small></span><select class="input smsItem">${itemOptions(r.g.kind + '|' + (r.g.ref || ''))}</select></label>
        <div class="two"><label class="field"><span>البنك</span><select class="input smsBank">${bankOptions(r.p.bank)}</select></label><label class="field"><span>الوصف</span><input class="input smsNote" value="${esc(r.p.merchant)}" placeholder="التاجر / الجهة"></label></div>
        <details><summary class="note" style="margin:0">نص الرسالة</summary><pre class="smsRaw">${esc(r.p.raw)}</pre></details>
      </div>`).join('') + `<button class="btn primary block" id="smsSave">تأكيد التسجيل</button>`;
    $('smsOut').querySelectorAll('.smsBank').forEach(wireBankSelect);
    if (autoIgn) $('smsOut').insertAdjacentHTML('afterbegin', `<p class="note" style="margin:0 0 8px">تم تجاهل ${autoIgn} رسالة تلقائيًا حسب قواعد التجاهل.</p>`);
    $('smsOut').querySelectorAll('.smsIgn').forEach(btn => btn.onclick = () => {
      const card = btn.closest('.smsCard'), r = rows[+card.dataset.i];
      const key = prompt('تجاهل كل رسالة فيها هذي الكلمة مستقبلًا؟\nاترك الخانة فاضية لتجاهل هذي الرسالة فقط، أو اكتب كلمة (مثل: حوالة من فلان).', C.suggestIgnoreKey(r.p));
      if (key === null) return;
      snapshot();
      C.addIgnore(S, r.p.hash);
      const rule = key.trim().length >= 3 && C.addIgnoreRule(S, key);
      if (key.trim() && !rule && key.trim().length < 3) toast('الكلمة قصيرة، تجاهلت هذي الرسالة فقط');
      const gone = new Set([r.p.hash]);
      if (rule) rows.forEach(x => { if (C.ignoreMatch(S, x.p.raw, x.p.hash)) gone.add(x.p.hash); });
      S.pending = S.pending.filter(x => !gone.has(x.hash) && !C.ignoreMatch(S, x.text, x.hash));
      $('smsOut').querySelectorAll('.smsCard').forEach(c => { if (gone.has(rows[+c.dataset.i].p.hash)) c.remove(); });
      persist(); renderPending(); renderSections();
      if (!$('smsOut').querySelector('.smsCard')) { pendingMode = false; $('smsOut').innerHTML = '<div class="empty">ما بقي شيء للتسجيل</div>'; }
      toast(rule ? `تم، بتجاهل أي رسالة فيها «${key.trim()}»` : 'تم تجاهل الرسالة', true);
    });
    $('smsSave').onclick = () => {
      let n = 0, total = 0; snapshot();
      $('smsOut').querySelectorAll('.smsCard').forEach(card => {
        const r = rows[+card.dataset.i], on = card.querySelector('.smsOn');
        if (!on || !on.checked) return;
        const amount = C.round2(toNum(card.querySelector('.smsAmt').value));
        if (!(amount > 0)) return;
        const [kind, ref] = card.querySelector('.smsItem').value.split('|');
        const bank = card.querySelector('.smsBank').value.replace('__new', '');
        const note = card.querySelector('.smsNote').value.trim().slice(0, 80);
        S.entries.push({ id: C.uid(), kind, ref: ref || '', amount, date: card.querySelector('.smsDate').value || todayISO(), note: note || (kind === 'variable' ? 'مصروف' : ''), bank, smsHash: r.p.hash, source: 'sms' });
        // نتعلم: نفس التاجر يروح لنفس البند المرة الجاية
        if (r.p.type !== 'income' && note) { S.settings.merchantMap = S.settings.merchantMap || {}; S.settings.merchantMap[note.toLowerCase()] = { kind, ref: ref || '' }; }
        if (r.p.card && bank) S.settings.cardMap[r.p.card] = bank;
        n++; total += amount;
      });
      if (!n && !pendingMode) return toast('ما فيه شيء محدد للتسجيل');
      if (pendingMode) S.pending = [];
      pendingMode = false;
      closeSheet(); commit(n ? `تم تسجيل ${n} حركة (${plain(total)} ر.س)` : 'تم');
    };
  }

  /* تسجيل سريع من الزر العائم */
  function openQuick() {
    const groups = [
      ['متغير', [{ kind: 'variable', id: '', name: 'مصروف متغير' }]],
      ['المصاريف الثابتة', sm.lines.fixed.map(l => ({ kind: 'fixed', id: l.id, name: l.name }))],
      ['الديون', [...sm.lines.debtsTemp, ...sm.lines.debtsFixed].map(l => ({ kind: 'debt', id: l.id, name: l.name }))],
      ['الأهداف', sm.lines.goals.map(l => ({ kind: 'goal', id: l.id, name: l.name }))],
      ['الدخل', S.income.map(x => ({ kind: 'income', id: x.id, name: x.name }))]
    ].filter(g => g[1].length);
    let pick = { kind: 'variable', id: '' };
    const html = `
      <button class="gl qSmsCard" id="qSms"><span class="qIc">📩</span><span><b>الصق رسالة البنك</b><small>أقرأ المبلغ والتاجر وأقترح البند</small></span><span class="chip p">لصق</span></button>
      <div class="gl qAmtBox"><small>أو اكتب المبلغ</small><input class="input bigInput" id="qAmt" inputmode="decimal" placeholder="0.00" autofocus></div>
      <div id="qSug"></div>
      ${groups.map(([g, items]) => `<div class="groupLbl">${g}</div><div class="pickList">${items.map(i => `<button class="pick ${i.kind === 'variable' ? 'on' : ''}" data-k="${i.kind}" data-id="${esc(i.id)}">${esc(i.name)}</button>`).join('')}</div>`).join('')}
      <div style="height:10px"></div>
      <div class="two"><label class="field"><span>التاريخ</span><input class="input" type="date" id="qDate" value="${defaultDate()}"></label><label class="field" id="qBankF"><span>البنك</span><select class="input" id="qBank">${bankOptions('')}</select></label></div>
      <label class="field"><span>وصف</span><input class="input" id="qNote" placeholder="مثلاً: بقالة، مطعم، صيانة…"></label>
      <button class="btn primary block qSave" id="qSave">حفظ</button>`;
    openSheet('تسجيل جديد', html, body => {
      wireBankSelect($('qBank'));
      // اقتراحات ذكية من آخر عملياتك
      const seenK = new Set(), sug = [];
      for (const e of S.entries.slice().reverse()) {
        if (e.kind === 'income') continue;
        const k = ((e.note || '').trim().toLowerCase()) || e.kind + e.ref;
        if (seenK.has(k)) continue; seenK.add(k); sug.push(e); if (sug.length >= 4) break;
      }
      if (sug.length) {
        $('qSug').innerHTML = `<div class="secLbl" style="margin-top:12px">اقتراحات ذكية</div><div class="sugGrid">${sug.map((e, i) => `<button class="gl sug" data-i="${i}"><span class="sIcn">${e.kind === 'variable' ? '🛒' : e.kind === 'goal' ? '🎯' : e.kind === 'debt' ? '🏦' : '🏠'}</span><b>${esc(e.note || C.itemName(S, e.kind, e.ref))} · ${plain(e.amount)}</b><small>${esc(C.itemName(S, e.kind, e.ref))}</small></button>`).join('')}</div>`;
        $('qSug').querySelectorAll('.sug').forEach(b => b.onclick = () => {
          const e = sug[+b.dataset.i];
          pick = { kind: e.kind, id: e.ref || '' };
          body.querySelectorAll('.pick').forEach(p => p.classList.toggle('on', p.dataset.k === pick.kind && p.dataset.id === pick.id));
          $('qBankF').style.display = pick.kind === 'variable' ? '' : 'none';
          if (!$('qAmt').value) $('qAmt').value = e.amount;
          if (e.note) $('qNote').value = e.note;
          if (pick.kind === 'variable' && e.bank) $('qBank').value = e.bank;
        });
      }
      $('qSms').onclick = () => openSms();
      body.querySelectorAll('.pick').forEach(b => b.onclick = () => {
        body.querySelectorAll('.pick').forEach(p => p.classList.remove('on')); b.classList.add('on');
        pick = { kind: b.dataset.k, id: b.dataset.id };
        $('qBankF').style.display = pick.kind === 'variable' ? '' : 'none';
      });
      setTimeout(() => $('qAmt').focus(), 300);
      $('qSave').onclick = () => {
        const amt = toNum($('qAmt').value);
        if (!(amt > 0)) return toast('اكتب المبلغ');
        snapshot();
        const e = { id: C.uid(), kind: pick.kind, ref: pick.id, amount: C.round2(amt), date: $('qDate').value || defaultDate(), note: $('qNote').value.trim().slice(0, 80) };
        if (pick.kind === 'variable') { e.bank = $('qBank').value === '__new' ? '' : $('qBank').value; if (!e.note) e.note = 'مصروف'; }
        S.entries.push(e);
        const cyc = C.cycleOf(e.date, S.settings.salaryDay);
        if (cyc !== viewCycle) viewCycle = cyc;
        closeSheet(); commit(`تم تسجيل ${plain(amt)} ر.س`);
      };
    });
  }

  /* إضافة / تعديل بند */
  function openEdit(kind, id, sub) {
    const isNew = !id;
    const x = isNew ? null : findItem(kind, id);
    if (!isNew && !x) return;
    const v = (k, d = '') => esc(x && x[k] !== undefined && x[k] !== null ? x[k] : d);
    const cyc = viewCycle;
    let f = `<label class="field"><span>الاسم</span><input class="input" id="fName" value="${v('name')}" maxlength="40"></label>`;
    if (kind === 'goal') f += `<label class="field"><span>رمز</span><input class="input" id="fIcon" value="${v('icon', '🎯')}" maxlength="4"></label>`;
    if (kind === 'income') f += `<label class="field"><span>المبلغ الشهري المتوقع</span><input class="input" id="fAmount" inputmode="decimal" value="${v('amount', '')}"></label>
      <div class="toggle"><span><b>دخل مؤكد</b><br><small style="color:var(--muted)">غير المؤكد (مثل حساب المواطن) ما يدخل في الفائض حتى تسجله</small></span><input type="checkbox" id="fConfirmed" ${!x || x.confirmed !== false ? 'checked' : ''}></div>`;
    if (kind === 'fixed') f += `<label class="field"><span>المبلغ الشهري (الميزانية)</span><input class="input" id="fAmount" inputmode="decimal" value="${v('amount', '')}"></label>
      <div class="toggle"><span><b>متغير (محفظة)</b><br><small style="color:var(--muted)">تسحب منه طول الشهر: يظهر «باقي كم» في الرئيسية ويتلون، وما يدخل قائمة المهام</small></span><input type="checkbox" id="fWallet" ${x ? (C.isWallet(x) ? 'checked' : '') : ''}></div>
      <div class="toggle"><span><b>ميزانية يومية</b><br><small style="color:var(--muted)">تنقسم على أيام الدورة ويطلع لك المسموح كل يوم (للمصروف الشخصي)</small></span><input type="checkbox" id="fFlexible" ${x && x.flexible ? 'checked' : ''}></div>
      <div class="two"><label class="field"><span>يبدأ من دورة</span><input class="input" type="month" id="fStart" value="${v('startCycle', isNew ? cyc : '')}"></label><label class="field"><span>ينتهي (اختياري)</span><input class="input" type="month" id="fEnd" value="${v('endCycle')}"></label></div>`;
    if (kind === 'debt') {
      const k = x ? x.kind : (sub || 'temp');
      f += `<div class="field"><span>النوع</span><div class="seg" id="fKind"><button data-v="temp" class="${k === 'temp' ? 'on' : ''}">مؤقت</button><button data-v="fixed" class="${k !== 'temp' ? 'on' : ''}">ثابت (قرض)</button></div></div>
      <div class="two"><label class="field"><span>المبلغ الكلي</span><input class="input" id="fTotal" inputmode="decimal" value="${v('total')}"></label><label class="field"><span>المتبقي الآن</span><input class="input" id="fRemaining" inputmode="decimal" value="${x ? C.debtRemaining(S, x) : ''}"></label></div>
      <div class="two"><label class="field"><span>القسط الشهري</span><input class="input" id="fMonthly" inputmode="decimal" value="${v('monthly')}"></label><label class="field"><span>يبدأ من دورة</span><input class="input" type="month" id="fStart" value="${v('startCycle', isNew ? cyc : '')}"></label></div>
      ${scheduleEditor(x)}`;
    }
    if (kind === 'goal') f += `<div class="two"><label class="field"><span>المبلغ المستهدف</span><input class="input" id="fTarget" inputmode="decimal" value="${v('target')}"></label><label class="field"><span>المدخر قبل البرنامج</span><input class="input" id="fSaved" inputmode="decimal" value="${v('saved', 0)}"></label></div>
      <div class="two"><label class="field"><span>المخصص الشهري</span><input class="input" id="fMonthly" inputmode="decimal" value="${v('monthly')}"></label><label class="field"><span>الموعد (اختياري)</span><input class="input" type="date" id="fDate" value="${v('targetDate')}"></label></div>
      <label class="field"><span>يبدأ من دورة</span><input class="input" type="month" id="fStart" value="${v('startCycle', isNew ? cyc : '')}"></label>
      <div class="toggle"><span><b>التمويل شغّال</b></span><input type="checkbox" id="fActive" ${!x || x.active ? 'checked' : ''}></div>
      <div class="toggle"><span><b>صندوق طوارئ</b><br><small style="color:var(--muted)">يُحسب في تقييم الأمان المالي</small></span><input type="checkbox" id="fEmergency" ${x && x.emergency ? 'checked' : ''}></div>
      ${scheduleEditor(x)}`;
    f += `<label class="field"><span>البنك / الجهة</span><select class="input" id="fBank">${bankOptions(x ? x.bank : '')}</select></label>
      ${kind === 'income' || kind === 'goal' || kind === 'debt' || kind === 'fixed' ? `<label class="field"><span>يوم الاستحقاق من الشهر (اختياري)</span><input class="input" inputmode="numeric" id="fDue" value="${v('dueDay')}" placeholder="${S.settings.salaryDay}"></label>` : ''}
      <label class="field"><span>ملاحظة</span><textarea class="input" id="fNote" rows="2" maxlength="200">${v('note')}</textarea></label>
      <button class="btn primary block" id="fSave">${isNew ? 'إضافة' : 'حفظ التعديل'}</button>
      ${isNew ? '' : '<div style="height:8px"></div><button class="btn danger block" id="fDel">حذف البند</button>'}`;
    const titles = { income: 'الدخل', fixed: 'بند ثابت', debt: 'دين', goal: 'هدف' };
    openSheet(isNew ? 'إضافة ' + titles[kind] : 'تعديل ' + (x.name || ''), f, body => {
      wireBankSelect($('fBank'));
      let debtKind = x ? x.kind : (sub || 'temp');
      if ($('fKind')) $('fKind').querySelectorAll('button').forEach(b => b.onclick = () => { debtKind = b.dataset.v; $('fKind').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); });
      wireSchedule(body);
      $('fSave').onclick = () => {
        const name = $('fName').value.trim();
        if (!name) return toast('اكتب الاسم');
        snapshot();
        const o = x || { id: kind[0] + '-' + C.uid() };
        { const dd = Math.round(toNum($('fDue') ? $('fDue').value : '')); if (dd >= 1 && dd <= 31) o.dueDay = dd; else delete o.dueDay; }
        o.name = name; o.bank = $('fBank').value === '__new' ? '' : $('fBank').value; o.note = $('fNote').value.trim();
        if (kind === 'income') { o.amount = C.round2(toNum($('fAmount').value)); o.confirmed = $('fConfirmed').checked; }
        if (kind === 'fixed') { o.amount = C.round2(toNum($('fAmount').value)); o.flexible = $('fFlexible').checked; o.wallet = $('fWallet').checked; o.startCycle = $('fStart').value; o.endCycle = $('fEnd').value; }
        if (kind === 'debt') {
          const newRem = C.round2(toNum($('fRemaining').value));
          o.kind = debtKind; o.total = C.round2(toNum($('fTotal').value)); o.monthly = C.round2(toNum($('fMonthly').value)); o.startCycle = $('fStart').value;
          // المتبقي المحفوظ = ما كتبه المستخدم + ما سُجّل من دفعات (حتى يبقى الحساب صحيح)
          const paid = x ? C.round2(x.remaining - C.debtRemaining(S, x)) : 0;
          o.remaining = C.round2(newRem + paid);
          o.schedule = readSchedule(body);
        }
        if (kind === 'goal') {
          o.icon = $('fIcon').value.trim() || '🎯'; o.target = C.round2(toNum($('fTarget').value)); o.saved = C.round2(toNum($('fSaved').value));
          o.monthly = C.round2(toNum($('fMonthly').value)); o.targetDate = $('fDate').value; o.startCycle = $('fStart').value;
          o.active = $('fActive').checked; o.emergency = $('fEmergency').checked; o.schedule = readSchedule(body);
        }
        if (isNew) arrOf(kind).push(o);
        closeSheet(); commit(isNew ? 'تمت الإضافة' : 'تم الحفظ');
      };
      if ($('fDel')) $('fDel').onclick = () => {
        if (!confirm(`حذف «${x.name}»؟ سجل الصرف المرتبط به ينحذف أيضًا.`)) return;
        snapshot();
        const arr = arrOf(kind); arr.splice(arr.indexOf(x), 1);
        S.entries = S.entries.filter(e => !(e.kind === kind && e.ref === x.id));
        closeSheet(); commit('تم الحذف');
      };
    });
  }
  function scheduleEditor(x) {
    const rows = (x && x.schedule) || [];
    return `<details class="card" style="padding:10px 12px"><summary><b>جدول مبالغ حسب الشهر</b> <small style="color:var(--muted)">(${rows.length ? rows.length + ' شهر' : 'اختياري'})</small></summary>
      <p class="note">إذا حددت جدول، يُستخدم بدل المبلغ الشهري لهذه الأشهر.${x && x.kind ? ' الدين المجدول يتبع الجدول فقط.' : ''}</p>
      <div id="schedRows">${rows.map(r => schedRow(r)).join('')}</div>
      <button class="btn block" id="schedAdd" type="button">+ شهر</button></details>`;
  }
  const schedRow = r => `<div class="sched"><input class="input" type="month" value="${esc(r.cycle)}"><input class="input" inputmode="decimal" value="${esc(r.amount)}" placeholder="المبلغ"><button class="x" type="button" data-rm>✕</button></div>`;
  function wireSchedule(body) {
    const box = body.querySelector('#schedRows'); if (!box) return;
    const wire = () => box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => b.parentElement.remove());
    body.querySelector('#schedAdd').onclick = () => {
      const last = [...box.querySelectorAll('input[type=month]')].map(i => i.value).filter(Boolean).sort().pop();
      box.insertAdjacentHTML('beforeend', schedRow({ cycle: last ? C.shiftCycle(last, 1) : viewCycle, amount: '' })); wire();
    };
    wire();
  }
  function readSchedule(body) {
    return [...body.querySelectorAll('#schedRows .sched')].map(r => { const [m, a] = r.querySelectorAll('input'); return { cycle: m.value, amount: C.round2(toNum(a.value)) }; })
      .filter(r => /^\d{4}-\d{2}$/.test(r.cycle)).sort((a, b) => a.cycle.localeCompare(b.cycle));
  }

  /* فحص وإصلاح الخطة */
  function openAudit() {
    const found = C.auditPlan(S);
    const now = C.summarize(S, viewCycle, new Date());
    if (!found.length) return openSheet('🩺 فحص الخطة', `<div class="card"><div class="empty">✅ بياناتك مطابقة للخطة المعتمدة.<br>الفائض لهذه الدورة: <b class="num money">${plain(now.planSurplus)}</b> ر.س</div></div>`);
    const typeName = { dup: 'مكرر', extra: 'زائد', changed: 'تغيّر', missing: 'ناقص', override: 'تعديل شهر' };
    const typeCls = { dup: 'bad', extra: 'bad', changed: 'warn', missing: 'warn', override: 'muted' };
    const preview = () => {
      const picks = found.filter((f, i) => { const el = document.querySelector(`.auditOn[data-i="${i}"]`); return el && el.checked; });
      const clone = C.normalize(JSON.parse(JSON.stringify(S)));
      C.applyAudit(clone, picks);
      const after = C.summarize(clone, viewCycle, new Date());
      $('auditSum').innerHTML = `فائض ${monthName(viewCycle)}: <b class="num money" style="color:${now.planSurplus < 0 ? 'var(--bad)' : 'inherit'}">${plain(now.planSurplus)}</b> ← بعد الإصلاح <b class="num money" style="color:${after.planSurplus < 0 ? 'var(--bad)' : 'var(--good)'}">${plain(after.planSurplus)}</b> ر.س`;
      $('auditApply').textContent = picks.length ? `طبّق (${picks.length})` : 'ما اخترت شيء';
      $('auditApply').disabled = !picks.length;
    };
    const html = `
      <div class="card"><div id="auditSum" style="font-size:14.5px"></div></div>
      <p class="note" style="margin-top:0">لقيت ${found.length} ملاحظة. علّم اللي تبي أصلحه، وبعدها اضغط تطبيق.</p>
      ${found.map((f, i) => `<label class="card auditRow"><input type="checkbox" class="auditOn" data-i="${i}" ${f.checked ? 'checked' : ''}><span style="flex:1;min-width:0"><b>${esc(f.name)}</b><small style="display:block;color:var(--muted);font-size:12.5px">${esc(f.label)} · ${esc(f.detail)}${f.value ? ' · ' + plain(f.value) : ''}</small></span><span class="chip ${typeCls[f.type]}">${typeName[f.type]}</span></label>`).join('')}
      <button class="btn primary block" id="auditApply">طبّق</button>`;
    openSheet('🩺 فحص الخطة', html, body => {
      body.querySelectorAll('.auditOn').forEach(el => el.onchange = preview);
      preview();
      $('auditApply').onclick = () => {
        const picks = found.filter((f, i) => body.querySelector(`.auditOn[data-i="${i}"]`).checked);
        if (!picks.length) return;
        snapshot(); C.applyAudit(S, picks); closeSheet(); commit(`تم إصلاح ${picks.length} ملاحظة`);
      };
    });
  }

  /* دليل اختصار الآيفون */
  function openShortcutGuide() {
    const names = [...S.fixed.filter(x => x.flexible).map(x => x.name), ...S.fixed.filter(x => !x.flexible).map(x => x.name), 'متغير', 'تجاهل'];
    const api = location.origin + location.pathname.replace(/[^/]*$/, '') + 'api/inbox';
    const key = S.settings.syncKey;
    const step = (n, t) => `<div class="step"><b>${n}</b><div>${t}</div></div>`;
    openSheet('⚡️ اختصار الآيفون', `
      <p class="note" style="margin-top:0">أول ما توصل رسالة خصم، يسألك «وين أحطها؟». تختار البند، والاختصار يرسلها لموقعك في الخلفية. «مالي» يسجلها أول ما تفتحه، بدون نسخ ولا لصق.</p>
      ${key ? '' : '<div class="card"><b>أول شيء:</b> فعّل الربط من الإعدادات ⚙︎ ← «الربط التلقائي» عشان يطلع لك مفتاحك.<div style="height:8px"></div><button class="btn primary block" id="gOn">فعّل الربط الآن</button></div>'}
      <div class="card">
        ${step(1, 'افتح <b>الاختصارات Shortcuts</b> ← <b>الأتمتة Automation</b> ← <b>+</b> ← <b>الرسائل Message</b>.')}
        ${step(2, '<b>المرسل Sender:</b> اختر رسائل البنوك (الأهلي، يوربي، فيجن…). اختر <b>تشغيل فورًا Run Immediately</b> ← <b>إنشاء أتمتة جديدة</b>.')}
        ${step(3, 'أضف إجراء <b>قائمة List</b> واكتب فيها هذي الأسماء:<div class="names">' + names.map(n => `<span>${esc(n)}</span>`).join('') + '</div>')}
        ${step(4, 'أضف <b>اختيار من القائمة Choose from List</b>، والعنوان: <b>وين أحطها؟</b>')}
        ${step(5, `أضف <b>الحصول على محتويات URL ‏Get Contents of URL</b>:<pre class="code">${esc(api)}</pre>
          • الطريقة <b>Method</b>: <b>POST</b><br>
          • <b>Headers</b>: المفتاح <code>x-mali-key</code> والقيمة:<pre class="code">${key ? esc(key) : '— فعّل الربط أول —'}</pre>
          • <b>Request Body</b>: ‏<b>JSON</b> بثلاث حقول:<br>
          <code>text</code> ← <b>Shortcut Input</b> (محتوى الرسالة)<br>
          <code>item</code> ← <b>Chosen Item</b> (البند اللي اخترته)<br>
          <code>sender</code> ← <b>Sender</b> (اختياري)`)}
        ${step(6, 'خلاص ✅ جرّب: اشترِ بأي مبلغ، تجيك الرسالة، اختر «البيت»، وافتح «مالي». بتلقاها مسجلة.')}
      </div>
      <p class="note">• لو ما اخترت بند (أو أغلقت السؤال)، الرسالة توصل وتنتظرك في الرئيسية «تحتاج تصنيف».<br>• الرسالة تنحذف من موقعك أول ما تنسجل على جوالك.<br>• تحتاج تفعيل التخزين مرة وحدة في Vercel (موضح في رسالتي لك).</p>
      ${key ? '<button class="btn block" id="gCopy">نسخ المفتاح</button>' : ''}`, () => {
      if ($('gOn')) $('gOn').onclick = () => { closeSheet(); openSettings(); };
      if ($('gCopy')) $('gCopy').onclick = async () => { try { await navigator.clipboard.writeText(key); toast('تم نسخ المفتاح'); } catch (e) { toast('اضغط مطولًا على المفتاح وانسخه'); } };
    });
  }

  /* تفاصيل التقييم */
  function openHealth() {
    const H = sm.health;
    const R = S.settings.rules;
    const html = `
      <div class="card"><div class="rowTop"><b>المؤشر ${H.level === 'unknown' ? '—' : H.score} / 100</b><span class="chip ${H.color === 'good' ? 'good' : H.color === 'warn' ? 'warn' : H.color === 'bad' ? 'bad' : 'muted'}">${esc(H.label)}</span></div>
      <p class="note">مريح: 70 فأكثر · متوسط: 45–69 · ضغط: أقل من 45. العجز يحوّلها لضغط مباشرة، والفائض الأقل من ${R.bufferGood}٪ من الدخل ما يسمح بـ«مريح».</p></div>
      <div class="card">${H.factors.map(f => `<div class="factor"><div class="rowTop"><b>${esc(f.label)}</b><small>${Math.round(f.score)} / 100 · وزن ${Math.round(f.weight * 100)}٪</small></div><div class="bar ${f.score >= 70 ? 'good' : f.score >= 45 ? 'warn' : 'bad'}"><i style="width:${f.score}%"></i></div><small style="color:var(--muted)">${esc(f.note)}</small></div>`).join('')}</div>
      <div class="card"><b>على ماذا يعتمد التقييم؟</b>
      <p class="note">• <b>نسبة الادخار:</b> قاعدة 50/30/20 المعروفة تنصح بادخار 20٪ من الدخل، و10٪ حد أدنى مقبول.<br>
      • <b>أقساط الديون:</b> البنك المركزي السعودي يحدد سقف استقطاع القروض الاستهلاكية بنحو ثلث الراتب، وفوق 43–45٪ يعتبر عبئًا عاليًا.<br>
      • <b>الالتزام بالميزانية:</b> كل تجاوز على بنود الميزانية ينقص الدرجة.<br>
      • <b>صندوق الطوارئ:</b> يُنصح بتغطية 3 إلى 6 أشهر من المصاريف الأساسية.<br>
      تقدر تعدّل هذه الحدود من الإعدادات.</p></div>`;
    openSheet('تقييم وضعك المالي', html);
  }

  /* الإعدادات */
  function openSettings() {
    const st = S.settings, R = st.rules;
    const html = `
      <div class="gl sProfile">
        <span class="sAv">${esc((st.name || 'م').trim().charAt(0) || 'م')}</span>
        <div class="sPf">
          <label class="field"><span>اسمك</span><input class="input" id="sName" value="${esc(st.name)}" maxlength="20"></label>
          <label class="field"><span>يوم نزول الراتب</span><input class="input" id="sDay" type="number" min="1" max="31" value="${st.salaryDay}"></label>
        </div>
      </div>
      <p class="mut sNote">البيانات محفوظة على جهازك فقط.</p>
      <details class="sGrp" open><summary><span class="sIc">🎨</span><span class="sT"><b>المظهر والألوان</b><small>الوضع، القوالب، وتحكم كامل بكل لون</small></span><span class="chev">‹</span></summary><div class="sBody">
        <div class="field" style="margin-top:10px"><div class="seg" id="sMode">${[['auto', 'تلقائي'], ['light', 'نهاري'], ['dark', 'ليلي']].map(([k, n]) => `<button data-v="${k}" class="${st.mode === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="swatches" style="margin:12px 0 22px">${C.THEMES.map(t => `<button class="sw ${st.theme === t.id ? 'on' : ''}" style="--c:${t.accent}" data-t="${t.id}" aria-label="${t.name}"><span>${t.name}</span></button>`).join('')}
          <label class="sw ${st.theme === 'custom' ? 'on' : ''}" style="--c:${esc(st.accent || '#888')};overflow:hidden" aria-label="لون مخصص"><input type="color" class="colorIn" id="sColor" value="${esc(st.accent || '#10b981')}" style="opacity:0;position:absolute;inset:0;width:100%;height:100%"><span>مخصص</span></label></div>
      <hr class="sHr">
        <div class="seg" id="cMode" style="margin-top:10px">${[['light', 'ألوان النهاري'], ['dark', 'ألوان الليلي']].map(([k, n]) => `<button data-v="${k}" class="${(isDarkNow() ? 'dark' : 'light') === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="presets" id="cPresets">${COLOR_PRESETS.map((p, n) => `<button data-p="${n}"><i style="background:${p.c}"></i>${p.name}</button>`).join('')}</div>
        <div class="clrGrid" id="cGrid"></div>
        <button class="btn block mini" id="cReset">رجوع لألوان التصميم الافتراضية</button>
      </div></details>
      <details class="sGrp"><summary><span class="sIc">👁</span><span class="sT"><b>العرض والخصوصية</b><small>إخفاء المبالغ، التاريخ الهجري، بطاقة مصروفي</small></span><span class="chev">‹</span></summary><div class="sBody">
          <div class="toggle"><span><b>إخفاء المبالغ</b><br><small style="color:var(--muted)">تنطمس الأرقام، واضغط على الرقم لعرضه</small></span><input type="checkbox" id="sHide" ${st.hideAmounts ? 'checked' : ''}></div>
          <div class="toggle"><span><b>عرض التاريخ الهجري</b></span><input type="checkbox" id="sHijri" ${st.hijri ? 'checked' : ''}></div>
          <div class="toggle"><span><b>شريط المراقب في الرئيسية</b><br><small style="color:var(--muted)">سطر صغير يلخص وضعك ويفتح بالضغط</small></span><input type="checkbox" id="sMon" ${st.showMonitor !== false ? 'checked' : ''}></div>
          <div class="toggle"><span><b>شارة المتأخر على الأيقونة</b><br><small style="color:var(--muted)">رقم أحمر على أيقونة «مالي» بعدد المهام المتأخرة (يحتاج السماح بالإشعارات)</small></span><button class="btn mini" id="sBadge" type="button">تفعيل</button></div>
          <label class="field" style="margin-top:10px"><span>بطاقة «مصروفي» في الرئيسية</span><select class="input" id="sPinned"><option value="">— إخفاء —</option>${S.fixed.filter(x => x.flexible).map(x => `<option value="${esc(x.id)}" ${x.id === st.pinnedBudget ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      </div></details>
      <details class="sGrp"><summary><span class="sIc">📩</span><span class="sT"><b>الربط مع رسائل البنك</b><small>اختصار الآيفون ومفتاح الربط</small></span><span class="chev">‹</span></summary><div class="sBody">
        ${st.syncKey ? `<p class="note">مفعّل. مفتاحك (يُكتب في الاختصار):</p><pre class="code" id="keyBox">${esc(st.syncKey)}</pre>
          <div class="btnRow"><button class="btn" id="kCopy">نسخ المفتاح</button><button class="btn" id="kTest">اسحب الرسائل الآن</button></div>
          <div style="height:8px"></div><button class="btn block" id="kGuide">طريقة إعداد الاختصار</button>
          <div style="height:8px"></div><button class="btn danger block" id="kOff">إيقاف الربط</button>`
        : `<p class="note">الاختصار يرسل رسائل البنك لموقعك في الخلفية، و«مالي» يسجلها أول ما ينفتح. ما تحتاج تنسخ أو تلصق.</p><button class="btn primary block" id="kOn">فعّل الربط</button>`}
      </div></details>
      <details class="sGrp"><summary><span class="sIc">🚫</span><span class="sT"><b>الرسائل المتجاهَلة</b><small>حوالات وتنبيهات ما لها علاقة بالصرف</small></span><span class="chev">‹</span></summary><div class="sBody">
        <p class="note" style="margin:6px 0 8px">أي رسالة تحتوي إحدى هذي الكلمات ما تدخل في المصاريف ولا في قائمة التصنيف.</p>
        <div id="igList"></div>
        <div class="quickLog" style="margin-top:8px"><input class="input" id="igKey" placeholder="كلمة أو عبارة، مثل: حوالة من أحمد"><button class="btn primary" id="igAdd">أضف</button></div>
        <button class="btn block mini" id="igClear" style="margin-top:8px">مسح الرسائل المتجاهلة (${(S.ignored || []).length}) لتظهر من جديد</button>
      </div></details>
      <details class="sGrp"><summary><span class="sIc">🏦</span><span class="sT"><b>الجهات المضافة</b><small>بنوك وجهات إضافية</small></span><span class="chev">‹</span></summary><div class="sBody">
        ${st.customBanks.length ? st.customBanks.map(b => `<div class="entry"><span class="bank" style="--bc:${esc(b.color)}">${esc(b.name)}</span><button class="x" data-rmb="${esc(b.id)}">✕</button></div>`).join('') : '<p class="note">البنوك الأساسية موجودة. تقدر تضيف جهة من أي قائمة بنك باختيار «جهة أخرى».</p>'}
      </div></details>
      <details class="sGrp"><summary><span class="sIc">🩺</span><span class="sT"><b>حدود تقييم الوضع</b><small>الادخار، الأقساط، الطوارئ (متقدم)</small></span><span class="chev">‹</span></summary><div class="sBody">
        <div style="height:10px"></div>
        <div class="two"><label class="field"><span>ادخار ممتاز ٪</span><input class="input" id="rSG" inputmode="decimal" value="${R.savingsGood}"></label><label class="field"><span>ادخار مقبول ٪</span><input class="input" id="rSO" inputmode="decimal" value="${R.savingsOk}"></label></div>
        <div class="two"><label class="field"><span>أقساط صحية حتى ٪</span><input class="input" id="rDG" inputmode="decimal" value="${R.dtiGood}"></label><label class="field"><span>أقساط خطرة من ٪</span><input class="input" id="rDB" inputmode="decimal" value="${R.dtiBad}"></label></div>
        <div class="two"><label class="field"><span>أشهر الطوارئ المستهدفة</span><input class="input" id="rEM" inputmode="decimal" value="${R.emergencyMonths}"></label><label class="field"><span>هامش الأمان ٪ للمريح</span><input class="input" id="rBG" inputmode="decimal" value="${R.bufferGood}"></label></div>
        <button class="btn block" id="rReset">رجوع للقيم الموصى بها</button>
      </div></details>
      <details class="sGrp"><summary><span class="sIc">🛠</span><span class="sT"><b>فحص وإصلاح الخطة</b><small>المكرر والزائد مع زر تراجع</small></span><span class="chev">‹</span></summary><div class="sBody"><p class="note">يقارن بياناتك بالخطة المعتمدة ويوريك البنود المكررة أو الزائدة أو اللي تغيّرت، وتختار وش تصلح. فيه زر تراجع.</p><button class="btn block" id="auditBtn">افحص الآن</button></div></details>
      <details class="sGrp"><summary><span class="sIc">💾</span><span class="sT"><b>النسخ الاحتياطي</b><small>تصدير واستيراد وإعادة الخطة</small></span><span class="chev">‹</span></summary><div class="sBody"><p class="note">البيانات محفوظة على هذا الجهاز فقط. صدّر نسخة بين فترة وفترة.</p>
        <div class="btnRow"><button class="btn" id="bExport">⬇︎ تصدير</button><label class="btn" style="text-align:center">⬆︎ استيراد<input type="file" id="bImport" accept="application/json,.json" hidden></label></div>
        <div style="height:8px"></div><button class="btn danger block" id="bReset">إعادة البيانات للخطة الأساسية</button>
      </div></details>`;
    openSheet('الإعدادات', html, body => {
      const save = msg => { persist(); render(); if (msg) toast(msg); };
      $('sName').onchange = e => { st.name = e.target.value.trim(); save(); };
      $('sDay').onchange = e => { const d = Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 27)); st.salaryDay = d; viewCycle = C.cycleOf(new Date(), d); save('تم تغيير يوم الراتب'); };
      $('sBadge').onclick = async () => { try { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'تم التفعيل، يظهر الرقم عند فتح التطبيق' : 'ما انسمح بالإشعارات'); render(); } catch (e) { toast('جهازك ما يدعم الشارة (يحتاج إضافة التطبيق للشاشة الرئيسية)'); } };
      $('sHide').onchange = e => { st.hideAmounts = e.target.checked; save(); };
      $('sHijri').onchange = e => { st.hijri = e.target.checked; save(); };
      $('sMon').onchange = e => { st.showMonitor = e.target.checked; save(); };
      $('sPinned').onchange = e => { st.pinnedBudget = e.target.value; save(); };
      if ($('kOn')) $('kOn').onclick = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); st.syncKey = btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); save('تم تفعيل الربط'); openShortcutGuide(); };
      if ($('kCopy')) $('kCopy').onclick = async () => { try { await navigator.clipboard.writeText(st.syncKey); toast('تم نسخ المفتاح'); } catch (e) { toast('اضغط مطولًا على المفتاح وانسخه'); } };
      if ($('kTest')) $('kTest').onclick = () => syncInbox(true);
      if ($('kGuide')) $('kGuide').onclick = openShortcutGuide;
      if ($('kOff')) $('kOff').onclick = () => { if (!confirm('إيقاف الربط؟ الاختصار القديم بيتوقف يوصل.')) return; st.syncKey = ''; save('تم إيقاف الربط'); openSettings(); };
      $('sMode').querySelectorAll('button').forEach(b => b.onclick = () => { st.mode = b.dataset.v; $('sMode').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); save(); });
      body.querySelectorAll('.sw[data-t]').forEach(b => b.onclick = () => { st.theme = b.dataset.t; body.querySelectorAll('.sw').forEach(o => o.classList.toggle('on', o === b)); save(); });
      $('sColor').oninput = e => { st.theme = 'custom'; st.accent = e.target.value; e.target.parentElement.style.setProperty('--c', st.accent); body.querySelectorAll('.sw').forEach(o => o.classList.toggle('on', o === e.target.parentElement)); applyTheme(); };
      $('sColor').onchange = () => save();
      let cm = isDarkNow() ? 'dark' : 'light';
      const cDef = k => k === 'accent' ? ((C.THEMES.find(t => t.id === st.theme) || C.THEMES[0]).accent) : COLOR_KEYS.find(x => x[0] === k)[cm === 'dark' ? 4 : 3];
      const drawColors = () => {
        const set = st.colors[cm];
        $('cGrid').innerHTML = COLOR_KEYS.map(([k, n]) => `<label class="clrRow ${set[k] ? 'set' : ''}"><span>${n}</span>${set[k] ? `<button type="button" class="x" data-x="${k}" aria-label="إرجاع ${n}">↺</button>` : ''}<input type="color" data-k="${k}" value="${set[k] || cDef(k)}" aria-label="${n}"></label>`).join('');
        $('cGrid').querySelectorAll('input[type=color]').forEach(inp => {
          inp.oninput = () => { st.colors[cm][inp.dataset.k] = inp.value; if (cm === (isDarkNow() ? 'dark' : 'light')) applyColors(isDarkNow()); };
          inp.onchange = () => { save(); drawColors(); };
        });
        $('cGrid').querySelectorAll('[data-x]').forEach(b => b.onclick = e => { e.preventDefault(); delete st.colors[cm][b.dataset.x]; save(); drawColors(); });
      };
      $('cMode').querySelectorAll('button').forEach(b => b.onclick = () => { cm = b.dataset.v; $('cMode').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); drawColors(); });
      $('cPresets').querySelectorAll('button').forEach(b => b.onclick = () => { const p = COLOR_PRESETS[+b.dataset.p]; st.colors = { light: Object.assign({}, p.l), dark: Object.assign({}, p.d) }; save('تم تطبيق «' + p.name + '»'); drawColors(); });
      $('cReset').onclick = () => { st.colors = { light: {}, dark: {} }; save('رجعت الألوان الافتراضية'); drawColors(); };
      drawColors();
      const drawIg = () => {
        const rules = st.ignoreRules || [];
        $('igList').innerHTML = rules.length ? rules.map(r => `<div class="toggle"><span><b>${esc(r.key)}</b></span><button class="chip bad" data-igdel="${esc(r.id)}" style="min-height:36px">حذف</button></div>`).join('') : '<div class="empty" style="padding:8px">ما فيه قواعد</div>';
        $('igList').querySelectorAll('[data-igdel]').forEach(b => b.onclick = () => { st.ignoreRules = st.ignoreRules.filter(r => r.id !== b.dataset.igdel); save('تم حذف القاعدة'); drawIg(); });
      };
      $('igAdd').onclick = () => { const k = $('igKey').value; if (!C.addIgnoreRule(S, k)) return toast(k.trim().length < 3 ? 'اكتب 3 حروف على الأقل' : 'القاعدة موجودة'); S.pending = S.pending.filter(x => !C.ignoreMatch(S, x.text, x.hash)); $('igKey').value = ''; save('تمت الإضافة'); drawIg(); };
      $('igClear').onclick = () => { if (!confirm('مسح قائمة الرسائل المتجاهلة؟ ممكن تظهر لك لو رجعت وصلت.')) return; S.ignored = []; save('تم المسح'); $('igClear').textContent = 'مسح الرسائل المتجاهلة (0) لتظهر من جديد'; };
      drawIg();
      const rules = [['rSG', 'savingsGood'], ['rSO', 'savingsOk'], ['rDG', 'dtiGood'], ['rDB', 'dtiBad'], ['rEM', 'emergencyMonths'], ['rBG', 'bufferGood']];
      rules.forEach(([el, k]) => $(el).onchange = e => { const n = toNum(e.target.value); if (n > 0) { R[k] = n; save('تم التحديث'); } });
      $('rReset').onclick = () => { st.rules = C.defaultSettings().rules; save('رجعت القيم الموصى بها'); openSettings(); };
      body.querySelectorAll('[data-rmb]').forEach(b => b.onclick = () => { st.customBanks = st.customBanks.filter(x => x.id !== b.dataset.rmb); save('تم الحذف'); openSettings(); });
      $('auditBtn').onclick = openAudit;
      $('bExport').onclick = () => {
        const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mali-backup-${todayISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      $('bImport').onchange = async e => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          const next = data.v === 9 ? C.normalize(data) : C.normalize(C.migrateLegacy(data));
          snapshot(); S = next; viewCycle = C.cycleOf(new Date(), S.settings.salaryDay); closeSheet(); commit('تم الاستيراد');
        } catch (err) { toast('الملف غير صالح'); }
      };
      $('bReset').onclick = () => {
        if (!confirm('ترجع كل البيانات للخطة الأساسية؟ تقدر تتراجع مباشرة بعدها.')) return;
        snapshot(); const keep = S.settings; S = C.normalize(C.seedState()); S.settings = keep; closeSheet(); commit('رجعت البيانات للخطة الأساسية');
      };
    });
  }

  /* ───────── الأحداث ───────── */
  $('prevCycle').onclick = () => { viewCycle = C.shiftCycle(viewCycle, -1); render(); };
  $('nextCycle').onclick = () => { viewCycle = C.shiftCycle(viewCycle, 1); render(); };
  $('cycleName').onclick = () => { viewCycle = C.cycleOf(new Date(), S.settings.salaryDay); render(); };
  $('settingsBtn').onclick = () => openSettings();
  $('eyeBtn').onclick = () => { S.settings.hideAmounts = !S.settings.hideAmounts; persist(); applyTheme(); };
  $('modeBtn').onclick = () => { const m = S.settings.mode; S.settings.mode = m === 'light' ? 'dark' : m === 'dark' ? 'auto' : 'light'; persist(); applyTheme(); toast(S.settings.mode === 'light' ? 'مظهر نهاري' : S.settings.mode === 'dark' ? 'مظهر ليلي' : 'المظهر تلقائي حسب جهازك'); };
  $('bellBtn').onclick = () => openPage('alerts');
  $('drawer').addEventListener('click', e => { if (e.target.closest('[data-dclose]')) closeDrawer(); });
  $('pageBack').onclick = closePage;
  $('pagePrev').onclick = () => { viewCycle = C.shiftCycle(viewCycle, -1); render(); };
  $('pageNext').onclick = () => { viewCycle = C.shiftCycle(viewCycle, 1); render(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); syncInbox(); } });
  setInterval(() => { if (!document.hidden) syncInbox(); }, 60000);

  render();

  // اختصار الآيفون يفتح الرابط: ./#sms=<نص الرسالة>
  function smsFromHash() {
    const h = location.hash;
    if (!h.startsWith('#sms=')) return;
    let text = '';
    try { text = decodeURIComponent(h.slice(5)); } catch (e) { text = h.slice(5); }
    history.replaceState(null, '', location.pathname + location.search);
    if (!text.trim()) return;
    const clip = C.parseMaliClip(text);
    clip ? recordClip(clip) : openSms(text);
  }
  smsFromHash();
  window.addEventListener('hashchange', smsFromHash);
  syncInbox();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw9.js').catch(() => {});
})();
