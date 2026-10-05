G=lambda c,x='':f'<div class="gl {c}" style="{x}">'
E='</div>'
def li(ico,t,s,amt,extra='',cls=''):
    return f'<div class="li"><span class="ico">{ico}</span><div><b>{t}</b><small>{s}</small></div><div style="flex:none;text-align:end">{amt}{extra}</div></div>'
def op(t,s,v,k):
    col={'g':'#1FD6A3','c':'#FF6B6B','a':'#F6C945'}[k]; sg='+' if k=='g' else '-'
    ic_={'g':'✓','c':'⇄','a':'⛽'}[k]
    return f'<div class="gl {k}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;margin-bottom:8px;border-radius:16px"><span class="ico" style="background:{col}22;color:{col}">{ic_}</span><div style="flex:1"><b style="font-size:14px">{t}</b><div class="mut">{s}</div></div><span class="n" style="color:{col};font-size:15px">{sg}{v}</span></div>'
D={}

# ───────── الرئيسية ─────────
gA=gauge(330,[(49.5,'#1FD6A3'),(20.3,'#7B61FF'),(30.2,'#FF6B6B')])
homeA=phone(f'''
<div style="text-align:center;margin:-2px 0 0"><div style="position:relative;height:150px;margin-top:4px">{gA}<div style="position:absolute;inset:auto 0 6px 0;text-align:center"><div class="mut">الراتب المتبقي</div><span class="n" style="font-size:30px">6,828</span></div></div>
<div style="display:flex;justify-content:center;gap:16px;font-size:11.5px;color:var(--mut);margin-top:2px"><span><i style="color:#1FD6A3">●</i> متاح 49٪</span><span><i style="color:#7B61FF">●</i> أهداف 20٪</span><span><i style="color:#FF6B6B">●</i> التزامات 30٪</span></div></div>
{G('g','margin-top:12px')}<div style="display:flex;justify-content:space-between"><b style="font-size:15px">الفائض المتوقع هذي الدورة</b><span class="chip g">وضعك مريح · 80</span></div>
<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px"><div><span class="n" style="font-size:36px">+6,828</span> <span class="mut">ر.س</span><div class="mut" style="margin-top:2px">الدخل 13,780 · باقي 22 يوم</div></div>{spark(120,56)}</div>{E}
<div style="margin-top:12px">{bubble("خالد، وضعك المالي مريح. تقدر تصرف <b>81.82 ر.س</b> اليوم، وعندك <b>8 مهام متأخرة</b> بـ 3,250 ر.س تنتظرك.")}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px">
<div class="gl r" style="padding:11px 10px;border-radius:18px;text-align:center"><div style="font-size:20px">⏰</div><b style="font-size:12.5px">متأخرة</b><div class="n" style="font-size:15px">3,250</div><div class="bar c" style="margin-top:6px"><i style="width:100%"></i></div></div>
<div class="gl p" style="padding:11px 10px;border-radius:18px;text-align:center"><div style="font-size:20px">⛽</div><b style="font-size:12.5px">مصروفي الشخصي</b><div class="n" style="font-size:15px">1,350</div><div class="bar" style="margin-top:6px"><i style="width:75%"></i></div></div>
<div class="gl g" style="padding:11px 10px;border-radius:18px;text-align:center"><div style="font-size:20px">🏠</div><b style="font-size:12.5px">البيت</b><div class="n" style="font-size:15px">620</div><div class="bar g" style="margin-top:6px"><i style="width:62%"></i></div></div></div>
<div class="gl" style="margin-top:12px;display:flex;align-items:center;gap:10px"><span style="color:var(--mut)">{ic("back")}</span><div style="flex:1"><b style="font-size:14px">🔮 تنبؤ ذكي</b><div class="mut">بنفس السرعة متوقع يبقى معك 5,978 ر.س بنهاية الدورة</div></div>{E}
<div class="lbl">آخر العمليات <a>الكل</a></div>{op("ALDREES","اليوم · من البنك","85","c")}''','home',header='مالي')

homeB=phone(f'''
<div style="text-align:center;margin-top:2px"><div class="mut">مساء الخير يا خالد</div></div>
<div style="display:grid;place-items:center;margin:8px 0 4px">{ring(66,230,'#1FD6A3','<div><div class="mut">تقدر تصرف اليوم</div><span class="n" style="font-size:42px">81.82</span><div class="mut">ر.س · باقي 22 يوم</div></div>')}</div>
<div style="display:flex;justify-content:center;margin:-2px 0 10px"><span class="chip g" style="font-size:13px;padding:4px 16px">● وضعك مريح — 80 من 100</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">{G('g','padding:12px 14px')}<div class="mut">الفائض المتوقع</div><span class="n" style="font-size:24px">+6,828</span>{spark(110,34)}{E}{G('p','padding:12px 14px')}<div class="mut">الدخل</div><span class="n" style="font-size:24px">13,780</span><div class="mut" style="margin-top:8px">صرفت 765 · 42٪ أسرع</div><div class="bar" style="margin-top:6px"><i style="width:44%"></i></div>{E}</div>
<div class="gl r" style="margin-top:10px;display:flex;align-items:center;gap:12px"><span class="ico" style="background:#FF6B6B22">⏰</span><div style="flex:1"><b>8 مهام متأخرة</b><div class="mut">الجامعة، جوالي، الكهرباء…</div></div><span class="n cor" style="font-size:20px">3,250</span></div>
<div style="margin-top:10px">{bubble("صرفك أسرع من المخطط بـ <b>42٪</b>. لا تتعدى <b>72 ر.س</b> يوميًا وترجع للمعدل.")}</div>
<div class="lbl">المحافظ <a>الكل</a></div>
<div style="display:flex;gap:10px"><div class="gl" style="flex:1;padding:12px"><b style="font-size:13px">الشخصي</b><div class="n" style="font-size:18px">1,350</div><div class="bar" style="margin-top:6px"><i style="width:75%"></i></div></div><div class="gl" style="flex:1;padding:12px"><b style="font-size:13px">البيت</b><div class="n" style="font-size:18px">620</div><div class="bar a" style="margin-top:6px"><i style="width:62%"></i></div></div><div class="gl" style="flex:1;padding:12px"><b style="font-size:13px">العيال</b><div class="n" style="font-size:18px">900</div><div class="bar g" style="margin-top:6px"><i style="width:100%"></i></div></div></div>''','home',header='الرئيسية',left='eye')
D['01-home']=('الرئيسية','خيارا A (الفكرة نفسها بالمقياس) و B (مركز على «كم أصرف اليوم»)',homeA,homeB)

# ───────── المهام ─────────
rows=[('🎓','الجامعة','سداد / تحويل','725'),('📱','الجوال','بدون جهة','500'),('⚡','الكهرباء','بنك الجزيرة','500'),('🎭','الترفيه','الأهلي','500'),('👩','الزوجة','الراجحي','400'),('📞','جوال الزوجة','STC Bank','200')]
def trow(r,late=True):
    return f'<div class="li"><span class="ch"></span><span class="ico">{r[0]}</span><div><b>{r[1]}</b><small>{r[2]}</small></div><div style="text-align:end"><span class="n" style="font-size:15px">{r[3]}</span><div><span class="chip c" style="font-size:10.5px">متأخر · 27 سبتمبر</span></div></div></div>'
tasksA=phone(f'''
<div style="display:flex;gap:8px;margin-bottom:10px"><span class="chip p" style="padding:6px 14px;font-size:13px">الكل 18</span><span class="chip c" style="padding:6px 14px;font-size:13px">متأخر 8</span><span class="chip" style="padding:6px 14px;font-size:13px">قادم 10</span><span class="chip g" style="padding:6px 14px;font-size:13px">تم 0</span></div>
{G('r','display:flex;align-items:center;gap:14px')}{ring(0,78,'#FF6B6B','<span class="n" style="font-size:20px">0٪</span>')}<div style="flex:1"><div class="mut">المتأخر</div><span class="n cor" style="font-size:30px">3,250</span> <span class="mut">ر.س</span><div class="mut">8 بنود · الأقدم 27 سبتمبر</div></div>{E}
<div class="btn-fake" style="margin:10px 0;height:48px;border-radius:16px;background:linear-gradient(135deg,#7B61FF,#1FD6A3);display:grid;place-items:center;font-weight:700">راجع وادفع المتأخرات بالترتيب</div>
{G('', 'padding:4px 14px')}{"".join(trow(r) for r in rows)}{E}''','tasks',header='المهام',left='search',right='cal')
DOT='<div style="width:5px;height:5px;border-radius:50%;background:#FF6B6B;margin:3px auto 0"></div>'
days=[('س','27'),('أ','28'),('ث','29'),('ر','30'),('خ','1'),('ج','2'),('ب','3')]
strip=''.join(f'<div style="flex:1;text-align:center;border-radius:16px;padding:8px 0;{"background:linear-gradient(160deg,#7B61FF,#5B8CFF);" if i==0 else "background:rgba(255,255,255,.05);"}"><div class="mut" style="{"color:#fff;" if i==0 else ""}font-size:11px">{d}</div><b class="n" style="font-size:16px">{n}</b>{DOT if i==0 else ""}</div>' for i,(d,n) in enumerate(days))
def tcard(r,k='c'):
    return f'<div class="gl {k}" style="display:flex;align-items:center;gap:12px;padding:11px 14px;margin-bottom:8px;border-radius:18px"><span class="ico">{r[0]}</span><div style="flex:1"><b>{r[1]}</b><div class="mut">{r[2]}</div></div><div style="text-align:end"><span class="n" style="font-size:16px">{r[3]}</span><div class="mut" style="font-size:11px">اسحب للدفع ‹‹</div></div></div>'
tasksB=phone(f'''
<div style="display:flex;gap:6px;margin-bottom:12px;direction:rtl">{strip}</div>
<div class="lbl" style="margin-top:4px"><span>اليوم · 27 سبتمبر <span class="chip c">8 متأخرة</span></span><span class="n cor" style="font-size:15px">3,250</span></div>
{"".join(tcard(r) for r in rows[:4])}
<div class="lbl"><span>27 أكتوبر · قادم</span><span class="n mut" style="font-size:14px">5,885</span></div>
<div class="gl" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:18px"><span class="ico">🏦</span><div style="flex:1"><b>القرض الرئيسي</b><div class="mut">بعد 22 يوم</div></div><span class="n" style="font-size:16px">2,887</span></div>''','tasks',header='المهام',left='search',right='cal')
D['02-tasks']=('المهام','خيارا A (قائمة مع ملخص المتأخر وزر دفع) و B (شريط أيام وبطاقات اسحب للدفع)',tasksA,tasksB)

# ───────── المحافظ ─────────
def wcard(n,e,left,tot,pct,col,note):
    return f'<div class="gl" style="display:flex;align-items:center;gap:14px;margin-bottom:10px;border-color:{col}55">{ring(pct,92,col,f"<span class=n style=font-size:17px>{pct}٪</span>")}<div style="flex:1"><b style="font-size:16px">{e} {n}</b><div><span class="n" style="font-size:24px">{left}</span> <span class="mut">من {tot}</span></div><div class="mut">{note}</div></div></div>'
walA=phone(f'''
<div class="mut" style="margin:0 2px 8px">راتب سبتمبر · باقي 22 يوم</div>
{wcard("مصروفي الشخصي","⛽","1,350","1,800",75,"#7B61FF","60 ر.س يوميًا · صرفت 450")}
{wcard("مصروف البيت","🏠","620","1,000",62,"#F6C945","⚠︎ باقي أقل من 70٪ والمعدل أسرع")}
{wcard("مصروف العيال","👨‍👩‍👧","900","900",100,"#1FD6A3","لم يُصرف شيء")}
<div class="gl p" style="display:flex;align-items:center;gap:10px;padding:12px 14px"><span style="font-size:20px">💡</span><div class="mut" style="font-size:13px">مشتريات يوربي تنخصم من البيت، فيجن من العيال، الأهلي من الشخصي.</div></div>''','wallets',header='المحافظ',left='search',right='plus')
def wbar(n,l,t,p,c,k):
    return f'<div class="li" style="display:block;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:15px">{n}</b><span class="n" style="font-size:16px;color:{c}">{l}</span></div><div class="bar {k}" style="margin:8px 0 6px;height:10px"><i style="width:{p}%"></i></div><div class="mut" style="display:flex;justify-content:space-between"><span>صرفت {t-int(l.replace(",",""))} من {t:,}</span><span>{p}٪ باقي</span></div></div>'
walB=phone(f'''
{G('g','text-align:center')}<div class="mut">إجمالي المتاح في المحافظ</div><span class="n" style="font-size:38px">2,870</span> <span class="mut">من 3,700</span><div style="margin-top:6px">{spark(300,46,[10,12,11,15,14,17,16,20,22,21,26],"#1FD6A3")}</div>{E}
<div class="gl" style="margin-top:12px;padding:4px 16px">{wbar("مصروفي الشخصي والبنزين","1,350",1800,75,"#A596FF","")}{wbar("مصروف البيت","620",1000,62,"#F6C945","a")}{wbar("مصروف العيال","900",900,100,"#1FD6A3","g")}</div>
<div style="margin-top:12px">{bubble("البيت أسرع من المعدل. حدّد <b>41 ر.س</b> يوميًا ويكمّل لين الراتب.")}</div>''','wallets',header='المحافظ',left='search',right='plus')
D['03-wallets']=('المحافظ','خيارا A (بطاقات حلقية) و B (إجمالي ومؤشرات أفقية)',walA,walB)

# ───────── المراقب ─────────
bars=''.join(f'<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%"><i style="display:block;width:100%;max-width:14px;border-radius:5px 5px 2px 2px;height:{h}px;background:{"linear-gradient(180deg,#FF6B6B,#c0394a)" if h>60 else "linear-gradient(180deg,#7B61FF,#4a3bb8)"}"></i><small class="mut" style="font-size:9.5px">{d}</small></div>' for d,h in zip(range(22,36),[0,6,0,0,92,10,0,0,50,0,22,34,24,60]))
monA=phone(f'''
<div style="position:relative;height:150px;text-align:center">{gauge(330,[(50,'#1FD6A3'),(30,'#7B61FF'),(12,'#F6C945')])}<div style="position:absolute;inset:auto 0 6px 0"><div class="mut">درجة الوضع</div><span class="n" style="font-size:34px">80</span><span class="mut"> /100 · مريح</span></div></div>
<div style="margin-top:12px">{bubble("صرفك أسرع من المخطط بـ <b>42٪</b>، وعملية <b>950 ر.س</b> غير معتادة. للرجوع للمعدل لا تتعدى 72 ر.س يوميًا.")}</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">
<div class="gl" style="padding:10px 12px;border-radius:16px"><div class="mut">اليوم</div><span class="n" style="font-size:19px">285</span></div><div class="gl" style="padding:10px 12px;border-radius:16px"><div class="mut">7 أيام</div><span class="n" style="font-size:19px">960</span> <span class="chip c" style="font-size:10px">▼14٪</span></div><div class="gl r" style="padding:10px 12px;border-radius:16px"><div class="mut">متأخر</div><span class="n cor" style="font-size:19px">3,250</span></div></div>
<div class="lbl">الصرف آخر 14 يوم</div><div class="gl" style="padding:12px 12px 8px"><div style="height:100px;display:flex;gap:4px;direction:ltr;align-items:flex-end">{bars}</div></div>
<div class="lbl">التنبيهات</div><div class="gl r" style="padding:10px 14px;border-radius:16px"><b style="font-size:14px">8 مهام متأخرة بمجموع 3,250 ر.س</b></div>''','home',header='المراقب',left='bell',right='gear')
monB=phone(f'''
<div class="gl g" style="display:flex;align-items:center;gap:14px">{ring(80,86,'#1FD6A3','<span class=n style=font-size:22px>80</span>')}<div style="flex:1"><b style="font-size:17px">الوضع مريح</b><div class="mut">الفائض المتوقع <span class="n grn">+5,978</span> ر.س</div><div class="mut">صرفت 765 من 1,800 · باقي 22 يوم</div></div></div>
<div class="lbl">وين راحت فلوسك <a>التفاصيل</a></div>
<div class="gl" style="display:flex;gap:14px;align-items:center">{ring(64,96,'#7B61FF','<span class=mut style=font-size:11px>متغير<br>64٪</span>')}<div style="flex:1">
<div style="display:flex;justify-content:space-between;font-size:13px"><span>● متغير</span><span class="n">850</span></div><div class="bar" style="margin:4px 0 8px"><i style="width:64%"></i></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#F6C945">● ثابت</span><span class="n">200</span></div><div class="bar a" style="margin:4px 0 8px"><i style="width:15%"></i></div>
<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#1FD6A3">● أهداف</span><span class="n">0</span></div><div class="bar g" style="margin:4px 0 0"><i style="width:2%"></i></div></div></div>
<div class="lbl">أكثر الجهات</div><div class="gl" style="padding:4px 16px">{li("🍽","مطعم","1 عملية",num(320))}{li("🛒","ALDREES","3 عمليات",num(270))}{li("⛽","بنزين","1 عملية",num(200))}</div>
<div class="lbl">تحليل المحلل</div><div class="gl a" style="padding:10px 14px;border-radius:16px"><b style="font-size:14px">⚠︎ عملية غير معتادة: أبل ستور 950</b><div class="mut">المعتاد حوالي 90 ر.س</div></div>''','home',header='المراقب',left='bell',right='gear')
D['04-monitor']=('المراقب','خيارا A (مقياس + رسالة المحلل + رسم أيام) و B (حلقة + توزيع الصرف)',monA,monB)

# ───────── الإعدادات ─────────
def srow(ico,t,s,right=''):
    return f'<div class="li"><span class="ico" style="background:linear-gradient(135deg,#7B61FF33,#1FD6A322);color:#B9ACFF">{ico}</span><div><b>{t}</b><small>{s}</small></div>{right or "<span style=color:var(--mut)>"+ic("back",18)+"</span>"}</div>'
tg=lambda on:f'<span class="tg {"on" if on else ""}"><i></i></span>'
setA=phone(f'''
<div class="gl" style="display:flex;align-items:center;gap:14px;margin-bottom:12px"><span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7B61FF,#1FD6A3);display:grid;place-items:center;font-size:24px;font-weight:700">خ</span><div style="flex:1"><b style="font-size:18px">خالد</b><div class="mut">يوم الراتب 27 · الميزانية المرنة 1,800</div></div><span class="chip g">البيانات على جهازك</span></div>
<div class="gl" style="padding:2px 16px;margin-bottom:12px">{srow("🎨","المظهر والألوان","تحكم كامل بكل لون")}{srow("🌙","الوضع الليلي","تلقائي حسب الجهاز","<div class='seg' style='display:flex;gap:4px'><span class='chip p'>تلقائي</span></div>")}{srow("👁","إخفاء المبالغ","تنطمس الأرقام",tg(0))}{srow("📅","التاريخ الهجري","",tg(1))}</div>
<div class="gl" style="padding:2px 16px;margin-bottom:12px">{srow("📩","رسائل البنك","ربط الاختصار · 2 قاعدة تجاهل")}{srow("🩺","حدود تقييم الوضع","ادخار 20٪ · أقساط 33٪")}{srow("💾","نسخ احتياطي","تصدير واستيراد JSON")}</div>''','more',header='الإعدادات',left='back',right='search')
sw=['#0F172A','#1C6B86','#065F46','#4C1D95','#B45309','#BE185D','#7B61FF','#1FD6A3']
sws=''.join(f'<div class="sw {"on" if i==6 else ""}" style="background:{c}"></div>' for i,c in enumerate(sw))
setB=phone(f'''
{G('p','padding:12px;margin-bottom:10px')}<div style="display:flex;gap:10px;align-items:center"><div style="flex:1"><div class="mut">معاينة مباشرة</div><div class="n" style="font-size:26px">+6,828</div><div class="bar" style="margin-top:8px"><i style="width:60%"></i></div></div><div class="gl g" style="padding:8px 12px;border-radius:14px"><span class="chip g">أخضر</span><br><span class="chip c" style="margin-top:4px">أحمر</span></div></div>{E}
<div class="lbl" style="margin-top:2px">القوالب</div><div style="display:grid;grid-template-columns:repeat(8,1fr);gap:7px">{sws}</div>
<div class="lbl">الألوان بالتفصيل <span class="chip p">ليلي ▾</span></div>
<div class="gl" style="padding:2px 14px">
{"".join(f'<div class="li" style="padding:8px 0"><div><b style="font-size:14px">{n}</b></div><span style="width:52px;height:30px;border-radius:10px;background:{c};border:1px solid var(--line)"></span></div>' for n,c in [("كتلة الرأس","#16233D"),("زر التسجيل","#7B61FF"),("الخلفية","#060A13"),("البطاقات","#131C2E"),("الأخضر (جيد)","#1FD6A3"),("الأحمر (متأخر)","#FF6B6B")])}</div>
<div style="margin-top:10px;height:46px;border-radius:15px;border:1px solid var(--line);display:grid;place-items:center;color:var(--mut);font-size:14px">رجوع لألوان التصميم الافتراضية</div>''','more',header='المظهر والألوان',left='back',right='search')
D['05-settings']=('الإعدادات','خيارا A (ملف شخصي وقوائم مجمّعة) و B (استوديو ألوان بمعاينة مباشرة)',setA,setB)

# ───────── التسجيل (+) ─────────
keys=''.join(f'<b>{k}</b>' for k in ['1','2','3','4','5','6','7','8','9','.','0','⌫'])
addA=phone(f'''
<div style="position:absolute;inset:0;background:#000a;z-index:1"></div>
<div style="position:absolute;inset-inline:0;bottom:0;top:90px;z-index:2;background:linear-gradient(180deg,#121a2e,#0a0f1c);border-radius:34px 34px 0 0;border:1px solid var(--line);padding:12px 16px">
<div style="width:44px;height:5px;border-radius:9px;background:#fff3;margin:0 auto 12px"></div>
<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">تسجيل صرف</b><span class="ib" style="width:36px;height:36px">{ic("x",18)}</span></div>
<div style="text-align:center;margin:8px 0"><span class="n" style="font-size:54px">85.50</span> <span class="mut">ر.س</span></div>
<div style="display:flex;gap:8px;overflow:hidden;margin-bottom:10px"><span class="chip p" style="padding:7px 14px;font-size:13px">🛒 متغير</span><span class="chip" style="padding:7px 14px;font-size:13px">⛽ الشخصي</span><span class="chip" style="padding:7px 14px;font-size:13px">🏠 البيت</span><span class="chip" style="padding:7px 14px;font-size:13px">👨‍👩‍👧 العيال</span></div>
<div class="gl" style="display:flex;gap:10px;padding:8px 14px;margin-bottom:10px;border-radius:16px"><span class="chip">📅 اليوم</span><span class="chip">🏦 الأهلي</span><span class="chip g">ALDREES</span></div>
<div class="kp">{keys}</div><div style="margin-top:10px;height:52px;border-radius:17px;background:linear-gradient(135deg,#7B61FF,#1FD6A3);display:grid;place-items:center;font-weight:700;font-size:16px">حفظ</div></div>''','home',nonav=True)
addB=phone(f'''
<div style="position:absolute;inset:0;background:#000a;z-index:1"></div>
<div style="position:absolute;inset-inline:0;bottom:0;top:70px;z-index:2;background:linear-gradient(180deg,#121a2e,#0a0f1c);border-radius:34px 34px 0 0;border:1px solid var(--line);padding:12px 16px">
<div style="width:44px;height:5px;border-radius:9px;background:#fff3;margin:0 auto 12px"></div>
<b style="font-size:19px">تسجيل جديد</b>
<div class="gl p" style="margin:10px 0;display:flex;align-items:center;gap:12px"><span class="ico" style="background:#7B61FF33">📩</span><div style="flex:1"><b>الصق رسالة البنك</b><div class="mut">أقرأ المبلغ والتاجر وأقترح البند</div></div><span class="chip p">لصق</span></div>
<div class="gl" style="padding:10px 14px"><div class="mut">أو اكتب المبلغ</div><span class="n" style="font-size:40px">0.00</span></div>
<div class="lbl">اقتراحات ذكية</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<div class="gl g" style="padding:10px;border-radius:16px"><div style="font-size:20px">🛒</div><b style="font-size:13.5px">ALDREES · 85</b><div class="mut">عادة من مصروفي الشخصي</div></div>
<div class="gl" style="padding:10px;border-radius:16px"><div style="font-size:20px">☕</div><b style="font-size:13.5px">قهوة · 20</b><div class="mut">متغير</div></div>
<div class="gl" style="padding:10px;border-radius:16px"><div style="font-size:20px">⛽</div><b style="font-size:13.5px">بنزين · 200</b><div class="mut">الشخصي</div></div>
<div class="gl" style="padding:10px;border-radius:16px"><div style="font-size:20px">🏠</div><b style="font-size:13.5px">البيت</b><div class="mut">محفظة</div></div></div>
<div class="lbl">أو اختر البند</div><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip" style="padding:7px 14px;font-size:13px">متغير</span><span class="chip" style="padding:7px 14px;font-size:13px">الكهرباء</span><span class="chip" style="padding:7px 14px;font-size:13px">الجامعة</span><span class="chip" style="padding:7px 14px;font-size:13px">الأهداف</span><span class="chip" style="padding:7px 14px;font-size:13px">دخل</span></div>
<div style="margin-top:14px;height:52px;border-radius:17px;background:linear-gradient(135deg,#7B61FF,#1FD6A3);display:grid;place-items:center;font-weight:700;font-size:16px">متابعة</div></div>''','home',nonav=True)
D['06-add']=('التسجيل (زر +)','خيارا A (لوحة أرقام) و B (لصق رسالة واقتراحات ذكية)',addA,addB)

# ───────── المزيد ─────────
def tile(e,t,v,c=''):
    return f'<div class="gl {c}" style="padding:14px;border-radius:20px"><div style="font-size:24px">{e}</div><b style="font-size:14.5px;display:block;margin-top:6px">{t}</b><div class="mut">{v}</div></div>'
moreA=phone(f'''
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
{tile("🔭","المراقب","محلل مالي","p")}{tile("📩","رسائل البنك","2 تحتاج تصنيف","a")}
{tile("💰","الدخل","13,780")}{tile("🏠","المصاريف الثابتة","6,850")}
{tile("⏳","الديون المؤقتة","710")}{tile("🏦","القروض","3,222")}
{tile("🎯","الأهداف","2,800 / شهر")}{tile("🧾","المصاريف المتغيرة","850")}
{tile("🏛","التوزيع حسب البنك","13 جهة")}{tile("📆","الأشهر القادمة","فائض متوقع")}</div>''','more',header='المزيد',left='search',right='gear')
def mrow(e,t,s,v,p=None,b=''):
    bar=f'<div class="bar" style="margin-top:6px"><i style="width:{p}%"></i></div>' if p is not None else ''
    return f'<div class="li"><span class="ico">{e}</span><div><b>{t} {b}</b><small>{s}</small>{bar}</div><span class="n" style="font-size:15px">{v}</span></div>'
moreB=phone(f'''
<div class="gl p" style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><span class="ico" style="background:#7B61FF33">🔭</span><div style="flex:1"><b>المراقب</b><div class="mut">8 تنبيهات · الوضع مريح</div></div><span style="color:var(--mut)">{ic("back",18)}</span></div>
<div class="gl" style="padding:2px 16px">
{mrow("💰","الدخل","مستلم 0 من 13,780","13,780",0)}{mrow("🏠","المصاريف الثابتة","مدفوع 0 من 6,850","6,850",0,'<span class="chip c" style="font-size:10px">5 متأخر</span>')}{mrow("⏳","الديون المؤقتة","مسدد 0 من 710","710",0)}{mrow("🏦","القروض","مسدد 0 من 3,222","3,222",0)}{mrow("🎯","الأهداف","المدخر 4,100","2,800",28)}{mrow("🧾","المصاريف المتغيرة","هذي الدورة","850",47)}</div>
<div class="gl" style="margin-top:10px;padding:2px 16px">{li("📩","رسالة بنك","الصق وتنسجل بعد تأكيدك","<span style=color:var(--mut)>"+ic("back",18)+"</span>")}{li("⚡","اختصار الآيفون","","<span style=color:var(--mut)>"+ic("back",18)+"</span>")}</div>''','more',header='المزيد',left='search',right='gear')
D['07-more']=('المزيد (القائمة)','خيارا A (شبكة بطاقات) و B (قائمة بتقدم وشارات)',moreA,moreB)
PAGES_DICT=D
