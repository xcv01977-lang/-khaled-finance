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

  /* ───────── الثيم ───────── */
  function applyTheme() {
    const st = S.settings, root = document.documentElement;
    const theme = C.THEMES.find(t => t.id === st.theme) || C.THEMES[0];
    root.style.setProperty('--accent', st.theme === 'custom' && st.accent ? st.accent : theme.accent);
    if (st.mode === 'light' || st.mode === 'dark') root.dataset.theme = st.mode; else delete root.dataset.theme;
    const dark = st.mode === 'dark' || (st.mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name=theme-color]').content = dark ? '#0b0f14' : '#f3f5f8';
    document.body.classList.toggle('privacy', !!st.hideAmounts);
    $('eyeBtn').textContent = st.hideAmounts ? '🙈' : '👁';
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  /* ───────── الرسم الرئيسي ───────── */
  let sm;
  function render() {
    applyTheme();
    sm = C.summarize(S, viewCycle, new Date());
    const h = new Date().getHours();
    $('greet').textContent = h < 12 ? 'صباح الخير' : 'مساء الخير';
    $('who').textContent = S.settings.name ? `يا ${S.settings.name} 👋` : 'وضعك المالي';
    renderCycle(); renderHero(); renderInsights(); renderSections();
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
    return `ماشي على الخطة 👌 الفائض المتوقع ${f(sm.projectedSurplus)} ر.س.`;
  }

  function renderHero() {
    const H = sm.health, T = sm.totals, sp = sm.spend;
    const color = STATUS_COLOR[H.color] || 'var(--muted)';
    const circ = 2 * Math.PI * 42, off = circ * (1 - H.score / 100);
    const surplus = sm.past ? sm.recordedNet : sm.projectedSurplus;
    const safeLabel = sm.past ? 'صرفت من الميزانية المرنة' : sm.future ? 'المسموح يوميًا حسب الخطة' : 'تقدر تصرف اليوم';
    const safeVal = sm.past ? sp.spent : sp.daily;
    const safeSub = sm.past ? `من ${plain(sp.budget)} ر.س` : sm.future ? `${plain(sp.budget)} ر.س على ${sm.totalDays} يوم` : `باقي ${plain(sp.flexRemaining)} ر.س لـ ${sp.daysLeft} يوم${sp.spentToday ? ` · صرفت اليوم ${plain(sp.spentToday)}` : ''}`;
    $('hero').style.setProperty('--status', color);
    $('hero').innerHTML = `
      <div class="briefTop">
        <span class="statusPill">الوضع ${esc(H.label)}</span>
        <button class="gauge mini" id="whyBtn" aria-label="مؤشر الوضع ${H.score} من 100 — اضغط للتفاصيل">
          <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42" fill="none" stroke-width="10"/><circle class="val" cx="50" cy="50" r="42" fill="none" stroke-width="10" stroke-dasharray="${circ}" stroke-dashoffset="${off}"/></svg>
          <div class="center"><b>${H.level === 'unknown' ? '—' : H.score}</b></div>
        </button>
      </div>
      <p class="briefLine">${esc(briefSentence())}</p>
      ${H.level === 'unknown' ? '<button class="btn primary block" id="setIncome">أدخل راتبك المتوقع</button>' : `
      <div class="safe"><small>${safeLabel}</small><div class="safeVal">${money(safeVal)}</div><small>${safeSub}</small></div>`}
      <div class="kpis">
        <div><small>${sm.past ? 'صافي الدورة' : 'الفائض المتوقع'}</small><b class="${surplus < 0 ? 'neg' : 'pos'}">${money(surplus, { cur: false, sign: true })}</b></div>
        <div><small>الدخل</small><b>${money(T.income.projected || T.income.confirmedPlanned, { cur: false })}</b></div>
        <div><small>${sm.cycle === sm.current ? 'للراتب' : 'الخارج'}</small><b>${sm.cycle === sm.current ? sm.daysToSalary + ' يوم' : money(sm.outProjected, { cur: false })}</b></div>
      </div>`;
    $('whyBtn').onclick = openHealth;
    if ($('setIncome')) $('setIncome').onclick = () => openEdit('income', 'i-salary');
    renderCarousel();
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

  function paceCard() {
    const sp = sm.spend, W = 300, Hh = 130, padB = 18, padT = 8;
    if (!sp.budget) return '<h3>سرعة الصرف</h3><div class="empty">حدد ميزانيات مرنة (مثل الشخصي والبيت) من تعديل البند</div>';
    const n = sp.allowedCum.length, maxY = Math.max(sp.budget, ...sp.actualCum, 1) * 1.08;
    const x = i => (n <= 1 ? 0 : i / (n - 1)) * W, y = v => padT + (Hh - padB - padT) * (1 - v / maxY);
    // الرسم من اليمين لليسار (اتجاه القراءة العربي): أول الدورة على اليمين
    const X = i => W - x(i);
    const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const a = sp.actualCum, last = a.length - 1;
    const over = last >= 0 && a[last] > sp.allowedCum[last];
    const lineColor = over ? 'var(--bad)' : 'var(--accent)';
    const pctSpent = Math.round(sp.spent / sp.budget * 100), pctTime = Math.round(sm.timePct * 100);
    return `<h3>سرعة الصرف</h3><small class="cSub">الميزانيات المرنة + المتغيرة</small>
      <div class="pace" id="paceBox">
        <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="صرفت ${plain(sp.spent)} من ${plain(sp.budget)}">
          <line x1="0" x2="${W}" y1="${y(sp.budget)}" y2="${y(sp.budget)}" class="gridL"/>
          <line x1="0" x2="${W}" y1="${Hh - padB}" y2="${Hh - padB}" class="axisL"/>
          <path d="${path(sp.allowedCum)}" class="allowL"/>
          ${a.length ? `<path d="${path(a)}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(last)}" cy="${y(a[last])}" r="4.5" fill="${lineColor}" stroke="var(--card)" stroke-width="2"/>` : ''}
          <line id="paceX" x1="0" x2="0" y1="${padT}" y2="${Hh - padB}" class="crossL" style="display:none"/>
        </svg>
        <div class="paceTip" id="paceTip"></div>
        <div class="paceAxis"><span>${dayFmt(sm.start)}</span><span>${dayFmt(sm.end)}</span></div>
      </div>
      <div class="legend2"><span><i style="background:${lineColor}"></i>الفعلي</span><span><i class="dash"></i>المسموح</span></div>
      <p class="cNote">${sp.live || sm.past ? `صرفت <b class="num money">${plain(sp.spent)}</b> (${pctSpent}٪) ومضى ${pctTime}٪ من الدورة.` : 'الرسم يبدأ أول ما تبدأ الدورة.'}</p>`;
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

  function renderCarousel() {
    const cards = [flowCard(), paceCard(), debtCard()];
    const box = $('carousel');
    const keep = box.scrollLeft;
    box.innerHTML = cards.map(c => `<article class="cCard">${c}</article>`).join('');
    box.scrollLeft = keep;
    $('dots').innerHTML = cards.map((_, i) => `<i data-i="${i}"></i>`).join('');
    const mark = () => {
      const w = box.clientWidth || 1, i = Math.round(Math.abs(box.scrollLeft) / w);
      $('dots').querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
    };
    box.onscroll = mark; mark();
    $('dots').querySelectorAll('i').forEach(d => d.onclick = () => box.children[+d.dataset.i].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }));
    box.querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
    // تلميح عند لمس الرسم
    const pb = $('paceBox');
    if (pb && sm.spend.budget) {
      const sp = sm.spend, n = sp.allowedCum.length;
      const show = ev => {
        const r = pb.getBoundingClientRect(), fx = (r.right - ev.clientX) / r.width; // من اليمين
        const i = Math.max(0, Math.min(n - 1, Math.round(fx * (n - 1))));
        const d = new Date(sm.start); d.setDate(d.getDate() + i);
        const act = i < sp.actualCum.length ? sp.actualCum[i] : null;
        $('paceTip').innerHTML = `<b>${dayFmt(d)}</b> · المسموح ${plain(sp.allowedCum[i])}${act !== null ? ` · الفعلي ${plain(act)}` : ''}`;
        $('paceTip').style.display = 'block';
        const xl = $('paceX'), px = 300 - (n <= 1 ? 0 : i / (n - 1)) * 300;
        xl.setAttribute('x1', px); xl.setAttribute('x2', px); xl.style.display = '';
      };
      const hide = () => { $('paceTip').style.display = 'none'; $('paceX').style.display = 'none'; };
      pb.onpointermove = show; pb.onpointerdown = show; pb.onpointerleave = hide;
    }
  }

  // الرئيسية: تنبيه واحد فقط، والباقي في صفحة التنبيهات
  function renderInsights() {
    const list = sm.insights, top = list[0];
    $('insights').innerHTML = top ? `<button class="insight ${top.level}" id="topIns"><span class="ic">${top.icon}</span><span><b>${esc(top.title)}</b><small>${esc(top.text)}</small></span></button>`
      + (list.length > 1 ? `<button class="moreInsights" id="moreIns">كل التنبيهات (${list.length}) ‹</button>` : '') : '';
    if ($('topIns')) $('topIns').onclick = () => runAction(top.action) || openPage('alerts');
    if ($('moreIns')) $('moreIns').onclick = () => openPage('alerts');
  }
  function runAction(a) {
    if (!a) return false;
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
    const cls = l.state === 'over' ? 'bad' : (l.state === 'saved' || l.state === 'done' || l.state === 'good') ? 'good' : l.state === 'near' || l.state === 'warn' ? 'warn' : '';
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
      { key: 'income', icon: '💰', title: 'الدخل', a: T.income.actual, p: T.income.confirmedPlanned, state: tileState(L.income),
        body: () => sumLine(T.income.actual, T.income.confirmedPlanned, 'المستلم') + L.income.map(l => rowHTML(l, l.item.confirmed === false ? 'غير مؤكد — ما يدخل في حساب الفائض' : '')).join('')
          + (noCitizen.length && sm.planSurplus ? `<p class="note">بدون ${noCitizen.map(x => esc(x.name)).join(' و')} يصير فائض الخطة <b class="num money" style="color:${sm.planSurplus - C.sum(noCitizen, x => C.plannedFor(S, 'income', x, sm.cycle)) < 0 ? 'var(--bad)' : 'inherit'}">${plain(sm.planSurplus - C.sum(noCitizen, x => C.plannedFor(S, 'income', x, sm.cycle)))}</b> ر.س.</p>` : '')
          + addBtn('income', '+ مصدر دخل') },
      { key: 'fixed', icon: '🏠', title: 'المصاريف الثابتة', a: T.fixed.actual, p: T.fixed.planned, state: tileState(L.fixed), badge: sm.overs.length,
        body: () => sumLine(T.fixed.actual, T.fixed.planned) + (L.fixed.map(l => rowHTML(l, [l.item.flexible ? 'ميزانية مرنة' : '', l.item.note && l.item.confirm ? '⚠︎ ' + esc(l.item.note) : ''].filter(Boolean).join(' · '))).join('') || '<div class="empty">ما فيه بنود لهذه الدورة</div>') + addBtn('fixed', '+ بند ثابت') },
      { key: 'debtsTemp', icon: '⏳', title: 'الديون المؤقتة', a: T.debtsTemp.actual, p: T.debtsTemp.planned, state: tileState(L.debtsTemp),
        body: () => sumLine(T.debtsTemp.actual, T.debtsTemp.planned, 'المسدد') + (L.debtsTemp.map(l => rowHTML(l, debtExtra(l))).join('') || '<div class="empty">ما عليك أقساط مؤقتة هذه الدورة 🎉</div>') + addBtn('debt', '+ دين مؤقت', 'temp') },
      { key: 'debtsFixed', icon: '🏦', title: 'القروض', a: T.debtsFixed.actual, p: T.debtsFixed.planned, state: tileState(L.debtsFixed),
        body: () => sumLine(T.debtsFixed.actual, T.debtsFixed.planned, 'المسدد') + (L.debtsFixed.map(l => rowHTML(l, debtExtra(l))).join('') || '<div class="empty">لا توجد قروض</div>') + addBtn('debt', '+ قرض', 'fixed') },
      { key: 'goals', icon: '🎯', title: 'الأهداف', a: T.goals.actual, p: T.goals.planned, state: tileState(L.goals),
        body: () => sumLine(T.goals.actual, T.goals.planned, 'المحوّل') + (L.goals.map(l => rowHTML(l, goalExtra(l))).join('') || '<div class="empty">ما فيه مخصصات أهداف هذه الدورة</div>')
          + (idle.length ? `<div class="subHead">بدون مخصص هذه الدورة</div>` + idle.map(g => { const saved = C.goalSaved(S, g); return `<button class="row" data-kind="goal" data-id="${esc(g.id)}" data-edit="1"><div class="rowTop"><div class="rowName"><b>${esc(g.icon || '🎯')} ${esc(g.name)}</b>${bankTag(g.bank)}</div><div class="rowAmt"><small>${g.active ? '' : 'متوقف · '}${money(saved, { cur: false })}${g.target ? ' / ' + plain(g.target) : ''}</small></div></div>${g.note ? `<div class="rowFoot"><small>${esc(g.note)}</small></div>` : ''}</button>`; }).join('') : '')
          + addBtn('goal', '+ هدف جديد') },
      { key: 'variable', icon: '🧾', title: 'المصاريف المتغيرة', a: T.variable.actual, p: null, state: T.variable.actual ? 'warn' : '',
        body: () => (vlist.map(e => `<div class="entry"><div><b>${esc(e.note || 'مصروف')}</b><small>${esc(e.date)} ${bankTag(e.bank)}</small></div><div class="btnRow" style="flex:none;align-items:center"><b>${money(e.amount, { cur: false })}</b><button class="x" data-del="${esc(e.id)}" aria-label="حذف">✕</button></div></div>`).join('') || '<div class="empty">ما سجلت مصروف متغير هذه الدورة</div>')
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

  // بلاطات الرئيسية: ملخص صغير لكل قسم، والضغط يفتح صفحته
  function renderTiles() {
    const secs = buildSecs().filter(x => !x.menuOnly);
    $('tiles').innerHTML = secs.map(x => `<button class="tile ${x.state}" data-page="${x.key}"><span class="tIcon">${x.icon}</span><span class="tTitle">${x.title}${x.badge ? ` <i class="dot">${x.badge}</i>` : ''}</span><span class="tNum"><b>${money(x.a, { cur: false })}</b>${x.p !== null ? `<small class="num money">من ${plain(x.p)}</small>` : '<small>خارج الخطة</small>'}</span></button>`).join('');
    $('tiles').querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
  }
  function renderSections() { renderTiles(); renderDrawer(); if (curPage) fillPage(); }

  /* القائمة الجانبية (من اليمين) */
  function renderDrawer() {
    const secs = buildSecs();
    $('drawerList').innerHTML = secs.map(x => `<button class="dItem" data-page="${x.key}"><span class="secIcon">${x.icon}</span><span class="secTitle"><b>${x.title}</b>${x.a !== undefined ? `<small class="num money">${plain(x.a)}${x.p ? ' / ' + plain(x.p) : ''}</small>` : ''}</span>${x.badge ? `<i class="dot">${x.badge}</i>` : ''}<span class="chev">‹</span></button>`).join('')
      + `<button class="dItem" id="dHealth"><span class="secIcon">🩺</span><span class="secTitle"><b>تقييم الوضع</b><small>${esc(sm.health.label)} · ${sm.health.level === 'unknown' ? '—' : sm.health.score}/100</small></span><span class="chev">‹</span></button>`
      + `<button class="dItem" id="dSettings"><span class="secIcon">⚙︎</span><span class="secTitle"><b>الإعدادات</b><small>الألوان، البنوك، النسخ الاحتياطي</small></span><span class="chev">‹</span></button>`;
    $('drawerList').querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
    $('dHealth').onclick = () => { closeDrawer(); openHealth(); };
    $('dSettings').onclick = () => { closeDrawer(); openSettings(); };
  }
  function openDrawer() { renderDrawer(); $('drawer').classList.add('show'); $('drawer').setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { $('drawer').classList.remove('show'); $('drawer').setAttribute('aria-hidden', 'true'); }

  /* صفحة القسم */
  let curPage = null;
  function openPage(key) { curPage = key; closeDrawer(); fillPage(); $('page').classList.add('show'); $('page').setAttribute('aria-hidden', 'false'); $('pageBody').scrollTop = 0; }
  function closePage() { curPage = null; $('page').classList.remove('show'); $('page').setAttribute('aria-hidden', 'true'); }
  function fillPage() {
    const sec = buildSecs().find(x => x.key === curPage);
    if (!sec) return closePage();
    $('pageTitle').textContent = sec.title;
    $('pageCycle').textContent = 'راتب ' + monthName(sm.cycle);
    const body = $('pageBody');
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
      <div class="card">
        <div class="field"><span>سجّل مبلغ ${verb}ه</span><input class="input bigInput" id="eAmt" inputmode="decimal" placeholder="0" value=""></div>
        <div class="two"><label class="field"><span>التاريخ</span><input class="input" type="date" id="eDate" value="${defaultDate()}"></label><label class="field"><span>ملاحظة</span><input class="input" id="eNote" placeholder="اختياري"></label></div>
        <div class="btnRow">
          <button class="btn primary" id="eAdd">إضافة</button>
          ${remain > 0 ? `<button class="btn good" id="eFull">${isInc ? 'استلمته' : 'دفعته'} كامل (${plain(remain)})</button>` : ''}
        </div>
        ${!isInc ? `<div class="toggle" style="margin-top:8px"><span><b>اكتمل البند لهذه الدورة</b><br><small style="color:var(--muted)">فعّلها إذا خلص صرفه، عشان يُحسب التوفير ضمن الفائض</small></span><input type="checkbox" id="eClosed" ${l.closed ? 'checked' : ''} ${sm.past ? 'disabled' : ''}></div>` : ''}
      </div>
      <div class="card"><b>سجل ${monthName(viewCycle, { month: 'long' })}</b>${l.entries.length ? l.entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `<div class="entry"><div><b>${money(e.amount)}</b><small>${esc(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</small></div><button class="x" data-del="${esc(e.id)}" aria-label="حذف">✕</button></div>`).join('') : '<div class="empty">ما فيه تسجيل بعد</div>'}</div>
      <div class="card">
        <div class="field"><span>تعديل المخطط لهذا الشهر فقط</span><div class="btnRow"><input class="input" id="ovAmt" inputmode="decimal" value="${l.planned}" style="flex:2"><button class="btn" id="ovSave">حفظ</button></div></div>
        ${hasOv ? '<button class="btn block" id="ovReset">رجّعه للمبلغ الأساسي</button>' : ''}
        <p class="note">التعديل هنا يخص ${monthName(viewCycle)} فقط. لتغيير المبلغ دائمًا استخدم «تعديل البند».</p>
        <button class="btn block" id="eEdit">✎ تعديل البند (الاسم، المبلغ، البنك…)</button>
      </div>`;
    openSheet(x.name, html, body => {
      const addEntry = amt => {
        if (!(amt > 0)) return toast('اكتب مبلغ صحيح');
        const date = $('eDate').value || defaultDate();
        snapshot();
        S.entries.push({ id: C.uid(), kind, ref: id, amount: C.round2(amt), date, note: $('eNote').value.trim().slice(0, 80) });
        commit(`تم تسجيل ${plain(amt)} ر.س`); openItem(kind, id);
      };
      $('eAdd').onclick = () => addEntry(toNum($('eAmt').value));
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
      $('ovSave').onclick = () => { snapshot(); S.overrides[viewCycle] = S.overrides[viewCycle] || {}; S.overrides[viewCycle][id] = C.round2(toNum($('ovAmt').value)); commit('تم تعديل مخطط هذا الشهر'); openItem(kind, id); };
      if ($('ovReset')) $('ovReset').onclick = () => { snapshot(); delete S.overrides[viewCycle][id]; commit('رجع للمبلغ الأساسي'); openItem(kind, id); };
      $('eEdit').onclick = () => openEdit(kind, id);
    });
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
      <div class="field"><input class="input bigInput" id="qAmt" inputmode="decimal" placeholder="0.00" autofocus></div>
      ${groups.map(([g, items]) => `<div class="groupLbl">${g}</div><div class="pickList">${items.map(i => `<button class="pick ${i.kind === 'variable' ? 'on' : ''}" data-k="${i.kind}" data-id="${esc(i.id)}">${esc(i.name)}</button>`).join('')}</div>`).join('')}
      <div style="height:10px"></div>
      <div class="two"><label class="field"><span>التاريخ</span><input class="input" type="date" id="qDate" value="${defaultDate()}"></label><label class="field" id="qBankF"><span>البنك</span><select class="input" id="qBank">${bankOptions('')}</select></label></div>
      <label class="field"><span>وصف</span><input class="input" id="qNote" placeholder="مثلاً: بقالة، مطعم، صيانة…"></label>
      <button class="btn primary block" id="qSave">حفظ</button>`;
    openSheet('تسجيل جديد', html, body => {
      wireBankSelect($('qBank'));
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
      <div class="toggle"><span><b>ميزانية مرنة</b><br><small style="color:var(--muted)">تُصرف على دفعات (مثل البيت والشخصي)، ونراقب سرعة الصرف</small></span><input type="checkbox" id="fFlexible" ${x && x.flexible ? 'checked' : ''}></div>
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
        o.name = name; o.bank = $('fBank').value === '__new' ? '' : $('fBank').value; o.note = $('fNote').value.trim();
        if (kind === 'income') { o.amount = C.round2(toNum($('fAmount').value)); o.confirmed = $('fConfirmed').checked; }
        if (kind === 'fixed') { o.amount = C.round2(toNum($('fAmount').value)); o.flexible = $('fFlexible').checked; o.startCycle = $('fStart').value; o.endCycle = $('fEnd').value; }
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
      <div class="card">
        <label class="field"><span>اسمك</span><input class="input" id="sName" value="${esc(st.name)}" maxlength="20"></label>
        <label class="field"><span>يوم نزول الراتب</span><input class="input" id="sDay" type="number" min="1" max="31" value="${st.salaryDay}"></label>
        <div class="toggle"><span><b>إخفاء المبالغ</b><br><small style="color:var(--muted)">تنطمس الأرقام، واضغط على الرقم لعرضه</small></span><input type="checkbox" id="sHide" ${st.hideAmounts ? 'checked' : ''}></div>
        <div class="toggle"><span><b>عرض التاريخ الهجري</b></span><input type="checkbox" id="sHijri" ${st.hijri ? 'checked' : ''}></div>
      </div>
      <div class="card"><b>المظهر</b>
        <div class="field" style="margin-top:10px"><div class="seg" id="sMode">${[['auto', 'تلقائي'], ['light', 'نهاري'], ['dark', 'ليلي']].map(([k, n]) => `<button data-v="${k}" class="${st.mode === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="swatches" style="margin:12px 0 22px">${C.THEMES.map(t => `<button class="sw ${st.theme === t.id ? 'on' : ''}" style="--c:${t.accent}" data-t="${t.id}" aria-label="${t.name}"><span>${t.name}</span></button>`).join('')}
          <label class="sw ${st.theme === 'custom' ? 'on' : ''}" style="--c:${esc(st.accent || '#888')};overflow:hidden" aria-label="لون مخصص"><input type="color" class="colorIn" id="sColor" value="${esc(st.accent || '#10b981')}" style="opacity:0;position:absolute;inset:0;width:100%;height:100%"><span>مخصص</span></label></div>
      </div>
      <details class="card"><summary><b>حدود تقييم الوضع</b> <small style="color:var(--muted)">(متقدم)</small></summary>
        <div style="height:10px"></div>
        <div class="two"><label class="field"><span>ادخار ممتاز ٪</span><input class="input" id="rSG" inputmode="decimal" value="${R.savingsGood}"></label><label class="field"><span>ادخار مقبول ٪</span><input class="input" id="rSO" inputmode="decimal" value="${R.savingsOk}"></label></div>
        <div class="two"><label class="field"><span>أقساط صحية حتى ٪</span><input class="input" id="rDG" inputmode="decimal" value="${R.dtiGood}"></label><label class="field"><span>أقساط خطرة من ٪</span><input class="input" id="rDB" inputmode="decimal" value="${R.dtiBad}"></label></div>
        <div class="two"><label class="field"><span>أشهر الطوارئ المستهدفة</span><input class="input" id="rEM" inputmode="decimal" value="${R.emergencyMonths}"></label><label class="field"><span>هامش الأمان ٪ للمريح</span><input class="input" id="rBG" inputmode="decimal" value="${R.bufferGood}"></label></div>
        <button class="btn block" id="rReset">رجوع للقيم الموصى بها</button>
      </details>
      <div class="card"><b>الجهات المضافة</b>
        ${st.customBanks.length ? st.customBanks.map(b => `<div class="entry"><span class="bank" style="--bc:${esc(b.color)}">${esc(b.name)}</span><button class="x" data-rmb="${esc(b.id)}">✕</button></div>`).join('') : '<p class="note">البنوك الأساسية موجودة. تقدر تضيف جهة من أي قائمة بنك باختيار «جهة أخرى».</p>'}
      </div>
      <div class="card"><b>النسخ الاحتياطي</b><p class="note">البيانات محفوظة على هذا الجهاز فقط. صدّر نسخة بين فترة وفترة.</p>
        <div class="btnRow"><button class="btn" id="bExport">⬇︎ تصدير</button><label class="btn" style="text-align:center">⬆︎ استيراد<input type="file" id="bImport" accept="application/json,.json" hidden></label></div>
        <div style="height:8px"></div><button class="btn danger block" id="bReset">إعادة البيانات للخطة الأساسية</button>
      </div>`;
    openSheet('الإعدادات', html, body => {
      const save = msg => { persist(); render(); if (msg) toast(msg); };
      $('sName').onchange = e => { st.name = e.target.value.trim(); save(); };
      $('sDay').onchange = e => { const d = Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 27)); st.salaryDay = d; viewCycle = C.cycleOf(new Date(), d); save('تم تغيير يوم الراتب'); };
      $('sHide').onchange = e => { st.hideAmounts = e.target.checked; save(); };
      $('sHijri').onchange = e => { st.hijri = e.target.checked; save(); };
      $('sMode').querySelectorAll('button').forEach(b => b.onclick = () => { st.mode = b.dataset.v; $('sMode').querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b)); save(); });
      body.querySelectorAll('.sw[data-t]').forEach(b => b.onclick = () => { st.theme = b.dataset.t; body.querySelectorAll('.sw').forEach(o => o.classList.toggle('on', o === b)); save(); });
      $('sColor').oninput = e => { st.theme = 'custom'; st.accent = e.target.value; e.target.parentElement.style.setProperty('--c', st.accent); body.querySelectorAll('.sw').forEach(o => o.classList.toggle('on', o === e.target.parentElement)); applyTheme(); };
      $('sColor').onchange = () => save();
      const rules = [['rSG', 'savingsGood'], ['rSO', 'savingsOk'], ['rDG', 'dtiGood'], ['rDB', 'dtiBad'], ['rEM', 'emergencyMonths'], ['rBG', 'bufferGood']];
      rules.forEach(([el, k]) => $(el).onchange = e => { const n = toNum(e.target.value); if (n > 0) { R[k] = n; save('تم التحديث'); } });
      $('rReset').onclick = () => { st.rules = C.defaultSettings().rules; save('رجعت القيم الموصى بها'); openSettings(); };
      body.querySelectorAll('[data-rmb]').forEach(b => b.onclick = () => { st.customBanks = st.customBanks.filter(x => x.id !== b.dataset.rmb); save('تم الحذف'); openSettings(); });
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
  $('eyeBtn').onclick = () => { S.settings.hideAmounts = !S.settings.hideAmounts; persist(); applyTheme(); };
  $('settingsBtn').onclick = openSettings;
  $('menuBtn').onclick = openDrawer;
  $('drawer').addEventListener('click', e => { if (e.target.closest('[data-dclose]')) closeDrawer(); });
  $('pageBack').onclick = closePage;
  $('pagePrev').onclick = () => { viewCycle = C.shiftCycle(viewCycle, -1); render(); };
  $('pageNext').onclick = () => { viewCycle = C.shiftCycle(viewCycle, 1); render(); };
  $('fab').onclick = openQuick;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw9.js').catch(() => {});
})();
