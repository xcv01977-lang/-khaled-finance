/* V9 home: a presentation layer only.
   It reads the existing figures (dashboardFigures, surplusFigures, fixedActual, matchedFixed, cycleDebtAmount,
   goalMonthlyAllocation, monitorGoalGap, commitments' due-date rule, bankLabel) and never creates or edits money.
   Writes happen only through the existing paths (payFixed, payDebt, editItem, chooseType, editBank) and, for the
   period chips, through state.offset + saveState(), exactly like the existing previous/next buttons. */
const homeState={cat:'all',status:'all',bank:'all',open:{}};
const homeCats=[['all','الكل'],['fixed','المصاريف الثابتة'],['debt','الأقساط والديون'],['goal','الأهداف والخزائن'],['variable','المصاريف المتغيرة'],['income','الدخل']];
const homeStatuses=[['all','الكل'],['unpaid','غير مدفوع'],['paid','مدفوع'],['over','أعلى من المخطط'],['funding','يحتاج تمويل']];
const homeViews=[['plan','الخطة','الراتب المخطط ناقص الالتزامات ومخصصات الأهداف'],['actual','الفعلي','الدخل المسجل ناقص المصروفات والمدفوعات والتحويلات'],['accounts','الحسابات','توزيع المخصصات حسب جهة الصرف، وليست أرصدة بنكية']];
const homeMoney=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:2});
const homeShort=ds=>{if(!ds||!validDate(ds))return '';let [,m,d]=dateParts(ds);return d+'/'+m};
function homeAddDays(ds,n){let x=new Date(ds+'T12:00:00');x.setDate(x.getDate()+n);return civil(x.getFullYear(),x.getMonth()+1,x.getDate())}
function homePeriodLabel(){let c=cycle(),s=new Date(c.start+'T12:00:00'),e=new Date(c.end+'T12:00:00');e.setDate(e.getDate()-1);let f=new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long'});return `${f.format(s)} — ${f.format(e)} ${e.getFullYear()}`}

/* Heavy reads are memoised by the saved-state signature, so a filter tap redraws without recomputing money. */
const homeCache={};
function homeMemo(name,compute){let sig=currentDate()+'|'+JSON.stringify(state);if(homeCache[name]&&homeCache[name].sig===sig)return homeCache[name].value;let value=compute();homeCache[name]={sig,value};return value}
/* One flat list describing every line of the selected cycle. */
function homeEntries(){return homeMemo('entries',homeEntriesCompute)}
function homeProjection(){return typeof monitorProjection==='function'?monitorProjection():[]}
/* monitorProjection is a pure read of the saved state; share one result between the monitor and the home alert. */
if(typeof monitorProjection==='function'){const monitorProjectionUncached=monitorProjection;monitorProjection=function(months=12){return homeMemo('projection:'+months,()=>monitorProjectionUncached(months))}}
function homeEntriesCompute(){
 let c=cycle(),asOf=[currentDate(),c.start].sort().at(-1),tx=state.transactions.filter(t=>appliesDate(t.date)),out=[],d=dashboardFigures();
 for(let x of state.fixed.filter(recurringApplies)){let planned=Number(x.amount)||0,actual=fixedActual(x.id),has=tx.some(t=>matchedFixed(t,x));out.push({key:'fixed:'+x.id,kind:'fixed',cat:'fixed',id:x.id,name:x.name,planned,actual,has,due:dueInCycle(x.dueDay||27),gap:0,over:Math.max(0,actual-planned),remaining:Math.max(0,planned-actual),bank:bankLabel(x)||'',inAccounts:true})}
 for(let x of state.debts){let planned=cycleDebtAmount(x);if(!(planned>0))continue;let actual=tx.filter(t=>t.type==='debt_payment'&&t.debtId===x.id).reduce((a,t)=>a+Number(t.amount),0);out.push({key:'debt:'+x.id,kind:'debt',cat:'debt',id:x.id,name:x.name,planned,actual,has:actual>0,due:x.dueDate||'',gap:0,over:0,remaining:Math.max(0,planned-actual),bank:bankLabel(x)||'',inAccounts:true})}
 for(let g of state.goals){let planned=goalMonthlyAllocation(g),actual=tx.filter(t=>t.type==='vault'&&t.goalId===g.id).reduce((a,t)=>a+Number(t.amount),0),gap=0;if(typeof monitorGoalGap==='function'&&g.target>0&&g.targetDate&&g.fundingStatus!=='paused')gap=monitorGoalGap(g,asOf).gap||0;if(!(planned>0)&&!(gap>0))continue;out.push({key:'goal:'+g.id,kind:'goal',cat:'goal',id:g.id,name:g.name,planned,actual,has:actual>0,due:g.targetDate||'',gap,over:0,remaining:Math.max(0,planned-actual),bank:bankLabel(g)||'',inAccounts:planned>0,targetDate:g.targetDate||''})}
 for(let t of tx.filter(t=>t.type==='expense'))out.push({key:'variable:'+t.id,kind:'variable',cat:'variable',id:t.id,name:t.name,planned:0,actual:Number(t.amount),has:true,due:t.date,gap:0,over:0,remaining:0,bank:'',inAccounts:false});
 out.push({key:'income:all',kind:'income',cat:'income',id:'income',name:'الدخل',planned:d.salary,actual:d.income,has:d.income>0,due:'',gap:0,over:0,remaining:d.income>0?0:d.salary,bank:'',inAccounts:false});
 for(let e of out)e.flags=homeFlags(e);
 return out}
function homeFlags(e){let s=[];if(e.remaining>.004)s.push('unpaid');else if(e.planned>0||e.has)s.push('paid');if(e.over>.004)s.push('over');if(e.gap>.004)s.push('funding');return s}
function homeFiltered(entries){return entries.filter(e=>(homeState.cat==='all'||e.cat===homeState.cat)&&(homeState.status==='all'||e.flags.includes(homeState.status)))}
function homeStatusText(e){if(e.flags.includes('over'))return `أعلى من المخطط بـ ${homeMoney(e.over)}`;if(e.flags.includes('funding'))return `ينقص ${homeMoney(e.gap)} قبل ${homeShort(e.targetDate)}`;if(e.kind==='income')return e.has?'مسجل':'لم يُسجل بعد';if(e.kind==='variable')return homeShort(e.due)||'مسجل';if(e.flags.includes('unpaid'))return e.actual>0?`بقي ${homeMoney(e.remaining)}`:(e.kind==='goal'?'لم يُحوَّل بعد':'غير مدفوع');return 'مدفوع'}
/* Over-plan figure: excess over the planned amount of the lines that exceeded, as a share of that planned amount. */
function homeOverrun(entries){let over=entries.filter(e=>e.kind==='fixed'&&e.over>.004),excess=over.reduce((a,e)=>a+e.over,0),base=over.reduce((a,e)=>a+e.planned,0);return {excess,pct:base>0?Math.round(excess/base*100):0,count:over.length}}

/* Attention candidates, one reason per line, highest priority first. */
function homeAttention(entries){
 let today=currentDate(),soon=homeAddDays(today,7),started=cycle().start<=today,list=[];
 for(let e of entries){let r=null;
  if(e.kind==='income'){if(started&&!e.has&&e.planned>0)r={score:290,why:'لم يُسجل بعد',amount:e.planned,act:['تسجيل فعلي',"chooseType('income')"]}}
  else if((e.kind==='fixed'||e.kind==='debt')&&e.remaining>.004&&e.actual===0&&validDate(e.due)&&e.due<=soon){let late=e.due<today;r={score:300+(late?50:0)-Math.max(0,Math.round((new Date(e.due)-new Date(today))/864e5)),why:late?`استحق ${homeShort(e.due)} ولم يُسجل`:`يستحق ${homeShort(e.due)} ولم يُسجل`,amount:e.remaining,act:['تسجيل فعلي',e.kind==='fixed'?`payFixed('${e.id}')`:`payDebt('${e.id}')`]}}
  if(!r&&e.kind==='fixed'&&e.over>.004){let pct=e.planned>0?Math.round(e.over/e.planned*100):0;r={score:200+Math.min(90,e.over/50),why:`أعلى من المخطط بـ ${homeMoney(e.over)} (${pct}٪)`,amount:e.actual,act:['تعديل',`editItem('fixed','${e.id}')`]}}
  if(!r&&e.kind==='goal'&&e.gap>.004)r={score:150,why:`ينقص ${homeMoney(e.gap)} قبل ${homeShort(e.targetDate)}`,amount:e.gap,act:['تعديل',typeof editGoalSchedule==='function'?`editGoalSchedule('${e.id}')`:`editItem('goal','${e.id}')`]};
  if(!r&&e.kind==='debt'&&e.remaining>.004&&e.actual>0)r={score:120,why:`بقي ${homeMoney(e.remaining)} من قسط الدورة`,amount:e.remaining,act:['تسجيل فعلي',`payDebt('${e.id}')`]};
  if(!r&&e.inAccounts&&e.planned>0&&!e.bank)r={score:50,why:'بلا جهة صرف',amount:e.planned,act:['تعديل',`editBank('${e.kind}','${e.id}')`]};
  if(r)list.push({e,...r})}
 return list.sort((a,b)=>b.score-a.score)}
function homeAction(e){let a=e.kind==='fixed'?(e.flags.includes('unpaid')?['تسجيل فعلي',`payFixed('${e.id}')`]:['تعديل',`editItem('fixed','${e.id}')`]):e.kind==='debt'?(e.flags.includes('unpaid')?['تسجيل فعلي',`payDebt('${e.id}')`]:['فتح التفاصيل',"show('debtsPage')"]):e.kind==='goal'?(e.flags.includes('unpaid')&&e.planned>0?['تسجيل فعلي',`chooseType('vault','${e.id}')`]:['تعديل',`editItem('goal','${e.id}')`]):e.kind==='income'?['فتح التفاصيل',"show('incomePage')"]:['فتح التفاصيل',"show('variablePage')"];return a}

/* The single alert, chosen by priority: deficit, over-plan line, unfunded dated goal, near unrecorded line. */
function homeAlert(d,mode,entries,attention){
 let planDeficit=d.surplus<0,actualDeficit=d.income>0&&d.actual<0;
 if(mode==='plan'&&planDeficit)return {tone:'bad',text:`عجز ${homeMoney(-d.surplus)} ر.س في خطة هذه الدورة`,act:['تعديل الدخل','editPlanIncome()']};
 if(mode==='actual'&&actualDeficit)return {tone:'bad',text:`عجز ${homeMoney(-d.actual)} ر.س؛ الصرف تجاوز الدخل المسجل`,act:['فتح التفاصيل',"show('reportsPage')"]};
 if(mode==='accounts'&&(planDeficit||actualDeficit))return {tone:'bad',text:planDeficit?`عجز ${homeMoney(-d.surplus)} ر.س في خطة هذه الدورة`:`عجز ${homeMoney(-d.actual)} ر.س حسب المسجل`};
 {let row=homeProjection().find(r=>r.surplus<0);if(row)return {tone:'bad',text:`عجز متوقع ${homeMoney(-row.surplus)} ر.س في دورة ${homeShort(row.date)}`,act:['فتح التفاصيل',"show('advisorPage')"]}}
 let over=entries.filter(e=>e.kind==='fixed'&&e.over>.004).sort((a,b)=>b.over-a.over)[0];
 if(over){let o=homeOverrun(entries);return {tone:'warn',text:`${over.name} أعلى من المخطط بـ ${homeMoney(over.over)} ر.س${o.count>1?` (إجمالي التجاوز ${homeMoney(o.excess)})`:''}`,act:['تعديل',`editItem('fixed','${over.id}')`]}}
 let goal=entries.filter(e=>e.kind==='goal'&&e.gap>.004).sort((a,b)=>String(a.targetDate).localeCompare(String(b.targetDate)))[0];
 if(goal)return {tone:'warn',text:`هدف «${goal.name}» يحتاج تمويلًا قبل ${homeShort(goal.targetDate)}`,act:['تعديل',typeof editGoalSchedule==='function'?`editGoalSchedule('${goal.id}')`:`editItem('goal','${goal.id}')`]};
 let near=attention.find(a=>a.score>=300);
 if(near)return {tone:'info',text:`${near.e.name}: ${near.why}`,act:near.act};
 return null}

function homeHero(d,mode,entries){
 let accountsRows=entries.filter(e=>e.inAccounts);
 if(mode==='accounts'){let planned=accountsRows.reduce((a,e)=>a+e.planned,0),un=accountsRows.filter(e=>!e.bank).reduce((a,e)=>a+e.planned,0);return {tone:'info',label:'إجمالي المخصصات',amount:planned,sub:un>0?`منها ${homeMoney(un)} غير موزع على جهة`:'كلها موزعة على جهات الصرف'}}
 if(mode==='plan'){if(!(d.salary>0))return {tone:'warn',label:'لم يُحدد الراتب المخطط بعد',amount:null,sub:'أضف الراتب المخطط ليظهر فائض الدورة',cta:['تعديل الدخل المخطط','editPlanIncome()']};
  return d.surplus<0?{tone:'bad',label:'العجز',amount:-d.surplus,negative:true,sub:`الالتزامات والأهداف (${homeMoney(d.obligations+d.goals)}) أكبر من الراتب (${homeMoney(d.salary)})`}:{tone:'ok',label:'الفائض المتاح',amount:d.surplus,sub:'بعد الالتزامات ومخصصات الأهداف'}}
 if(!(d.income>0))return {tone:'warn',label:'لم يُسجل الدخل بعد',amount:null,sub:(d.spending+d.transfers>0?`المصروف المسجل ${homeMoney(d.spending+d.transfers)} ر.س؛ `:'')+'سجّل الدخل ليظهر الفائض',cta:['تسجيل دخل',"chooseType('income')"]};
 let o=homeOverrun(entries),note=o.count?`تجاوز المخطط ${homeMoney(o.excess)} ر.س (${o.pct}٪)`:'';
 return d.actual<0?{tone:'bad',label:'العجز',amount:-d.actual,negative:true,sub:'المدفوعات والتحويلات تجاوزت الدخل المسجل',note}:{tone:'ok',label:'الفائض المتاح',amount:d.actual,sub:'الدخل المسجل بعد المصروفات والتحويلات',note}}
function homeKpis(d,mode,entries){
 if(mode==='accounts'){let rows=entries.filter(e=>e.inAccounts),names=new Set(rows.map(e=>e.bank||'غير موزع'));return [['جهات الصرف',names.size,''],['الفعلي',rows.reduce((a,e)=>a+e.actual,0),'ر.س'],['غير موزع',rows.filter(e=>!e.bank).reduce((a,e)=>a+e.planned,0),'ر.س']]}
 return mode==='actual'?[['الدخل المسجل',d.income,'ر.س'],['المدفوعات',d.spending,'ر.س'],['تحويلات الأهداف',d.transfers,'ر.س']]:[['الدخل المخطط',d.salary,'ر.س'],['الالتزامات',d.obligations,'ر.س'],['الأهداف',d.goals,'ر.س']]}

/* Accounts: allocations per issuing party, same grouping rule as bankDistribution(). */
function homeAccounts(entries){let map=new Map();for(let e of entries.filter(e=>e.inAccounts&&(homeState.status==='all'||e.flags.includes(homeState.status)))){let key=e.bank||'غير موزع';if(!map.has(key))map.set(key,{name:key,planned:0,actual:0,items:[]});let b=map.get(key);b.planned+=e.planned;b.actual+=e.actual;b.items.push(e)}return [...map.values()].sort((a,b)=>(a.name==='غير موزع')-(b.name==='غير موزع')||b.planned-a.planned)}

function homeChip(group,value,label,active){return `<button type="button" class="hChip" data-fid="${group}:${esc(value)}" data-v="${esc(value)}" aria-pressed="${active}" onclick="homeSet('${group}',this.dataset.v)">${esc(label)}</button>`}
function homeFold(id,title,hint,body,cls=''){return `<details class="hFold ${cls}" data-did="${id}" ${homeState.open[id]?'open':''} ontoggle="homeToggle('${id}',this.open)"><summary><span>${title}</span>${hint?`<small>${hint}</small>`:''}</summary><div class="hFoldBody">${body}</div></details>`}
function homeRow(label,value,sign,cls=''){return `<div class="hRow ${cls}"><span>${sign?`<i aria-hidden="true">${sign}</i>`:''}${esc(label)}</span><b class="${value<0?'negative':''}">${homeMoney(value)}</b></div>`}
function homeItem(name,why,amount,act,extra=''){return `<li class="hItem ${extra}"><strong>${esc(name)}</strong><b class="hAmt">${homeMoney(amount)}</b><small>${esc(why)}</small><button type="button" class="hBtn" onclick="${act[1]}" aria-label="${esc(act[0]+' '+name)}">${act[0]}</button></li>`}

function renderHome(){
 let host=$('homeV9');if(!host)return;
 let mode=dashboardMode,d=dashboardFigures(),entries=homeEntries(),att=homeAttention(entries),hero=homeHero(d,mode,entries),kpis=homeKpis(d,mode,entries),alert=homeAlert(d,mode,entries,att),offset=state.offset||0;
 let accounts=homeAccounts(entries);if(homeState.bank!=='all'&&!accounts.some(a=>a.name===homeState.bank))homeState.bank='all';
 let filtered=homeFiltered(entries),active=(homeState.cat!=='all')+(homeState.status!=='all'),mine=mode==='accounts'?(homeState.bank!=='all'?1:0):0;
 let focus=typeof document!=='undefined'&&document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.fid||document.activeElement.id||'':'';
 let tabs=homeViews.map(([id,label])=>`<button type="button" role="tab" id="hTab-${id}" aria-selected="${mode===id}" aria-controls="homePanel" tabindex="${mode===id?0:-1}" data-fid="tab:${id}" onclick="setDashboardMode('${id}')">${label}</button>`).join('');
 let period=`<div class="hPeriod"><button type="button" class="hArrow" data-fid="step:-1" onclick="homeStep(-1)" aria-label="الدورة السابقة">›</button><div class="hChips hPeriodChips" role="group" aria-label="الفترة">${[[-1,'السابقة'],[0,'الحالية'],[1,'التالية']].map(([n,l])=>`<button type="button" class="hChip" data-fid="period:${n}" aria-pressed="${offset===n}" onclick="homePeriodSet(${n})">${l}</button>`).join('')}</div><button type="button" class="hArrow" data-fid="step:1" onclick="homeStep(1)" aria-label="الدورة التالية">‹</button></div><p class="hRange">دورة الراتب · ${homePeriodLabel()}</p>`;
 let heroHtml=`<section class="hHero tone-${hero.tone}" aria-label="المؤشر الرئيسي"><p class="hHeroLabel">${hero.label}</p>${hero.amount===null?'':`<p class="hHeroValue ${hero.negative?'negative':''}" dir="ltr"><b>${homeMoney(hero.amount)}</b><span>ر.س</span></p>`}<p class="hHeroSub">${hero.sub}</p>${hero.note?`<p class="hHeroNote">${hero.note}</p>`:''}${hero.cta?`<button type="button" class="hBtn hCta" onclick="${hero.cta[1]}">${hero.cta[0]}</button>`:''}</section>`;
 let kpiHtml=`<div class="hKpis">${kpis.map(([l,v,u])=>`<div><small>${l}</small><b>${homeMoney(v)}${u?`<span>${u}</span>`:''}</b></div>`).join('')}</div>`;
 let alertHtml=alert?`<div class="hAlert tone-${alert.tone}" role="status"><span>${esc(alert.text)}</span>${alert.act?`<button type="button" class="hLink" onclick="${alert.act[1]}">${alert.act[0]}</button>`:''}</div>`:'';
 let filterOn=homeState.cat!=='all'||homeState.status!=='all';
 let list,listTitle;
 if(filterOn){listTitle='نتيجة التصفية';let order=new Map(att.map(a=>[a.e.key,a.score])),rows=filtered.slice().sort((a,b)=>(order.get(b.key)||0)-(order.get(a.key)||0)||b.planned-a.planned||b.actual-a.actual),shown=rows.slice(0,3),rest=rows.slice(3);
  list=rows.length?`<ul class="hList">${shown.map(e=>homeItem(e.name,homeStatusText(e),mode==='actual'?e.actual:e.planned,homeAction(e))).join('')}</ul>${rest.length?homeFold('rest',`باقي البنود (${rest.length})`,'',`<ul class="hList">${rest.map(e=>homeItem(e.name,homeStatusText(e),mode==='actual'?e.actual:e.planned,homeAction(e))).join('')}</ul>`):''}`:'<p class="hCalm">لا توجد بنود بهذه التصفية في الدورة المختارة.</p>'}
 else{listTitle='أهم ما يحتاج انتباهك';list=att.length?`<ul class="hList">${att.slice(0,3).map(a=>homeItem(a.e.name,a.why,a.amount,a.act)).join('')}</ul>`:'<p class="hCalm">وضعك مرتب حاليًا، لا توجد إجراءات عاجلة.</p>'}
 let flow;
 if(mode==='accounts'){let shown=homeState.bank==='all'?accounts:accounts.filter(a=>a.name===homeState.bank);
  flow=`<p class="hNote">مخصصات البنود والأقساط والأهداف، وليست أرصدة بنكية.</p>`+(shown.map(a=>`<details class="hAcc" data-did="acc:${esc(a.name)}" ${(homeState.open['acc:'+a.name]||homeState.bank===a.name)?'open':''} ontoggle="homeToggle(this.dataset.did,this.open)"><summary><span class="hBank ${a.name==='غير موزع'?'none':''}">${esc(a.name)}</span><span class="hAccNums"><b>${homeMoney(a.planned)}</b><small>فعلي ${homeMoney(a.actual)} · ${a.items.length} بنود</small></span></summary><ul class="hList">${a.items.map(e=>`<li class="hItem"><strong>${esc(e.name)}</strong><b class="hAmt">${homeMoney(e.planned)}</b><small>فعلي ${homeMoney(e.actual)}</small><button type="button" class="hBtn" onclick="${e.bank?`editItem('${e.kind}','${e.id}')`:`editBank('${e.kind}','${e.id}')`}" aria-label="${e.bank?'تعديل':'تحديد جهة'} ${esc(e.name)}">${e.bank?'تعديل':'تحديد الجهة'}</button></li>`).join('')}</ul></details>`).join('')||'<p class="hCalm">لا توجد مخصصات بهذه التصفية.</p>')}
 else if(filterOn){let amount=e=>mode==='actual'?e.actual:e.planned,rows=filtered.filter(e=>amount(e)>0||e.kind!=='variable'),total=rows.reduce((a,e)=>a+amount(e),0),top=rows.slice(0,5),rest=rows.slice(5);
  flow=top.map(e=>homeRow(e.name,amount(e),'')).join('')+(rest.length?homeFold('flowRest',`باقي البنود (${rest.length})`,'',rest.map(e=>homeRow(e.name,amount(e),'')).join('')):'')+homeRow(`المجموع · ${rows.length} بند`,total,'=','hResult')}
 else{let f=surplusFigures(),rows=mode==='actual'?[['الدخل المسجل',d.income,'+'],['المصروفات والدفعات',d.spending,'−'],['تحويلات للأهداف',d.transfers,'−'],['الفائض حسب المسجل',d.actual,'=']]:[['الراتب المخطط',d.salary,'+'],['المصاريف الثابتة',f.fixedPlan,'−'],['الأقساط والديون',f.debtPlan,'−'],['مخصصات الأهداف',d.goals,'−'],['الفائض المخطط',d.surplus,'=']];flow=rows.map(([l,v,s],i)=>homeRow(l,v,s,i===rows.length-1?'hResult':'')).join('')+homeFold('flowWhy','كيف حُسب؟','',$('dashboardDetails').innerHTML||'<p>—</p>','hInner')}
 let flowTitle=mode==='accounts'?'جهات الصرف':filterOn?'مسار التوزيع (حسب التصفية)':mode==='actual'?'كيف حُسب الفائض المسجل؟':'مسار توزيع الراتب';
 let bankChips=mode==='accounts'&&accounts.length>1?`<div class="hChips hBankChips" role="group" aria-label="جهة الصرف">${homeChip('bank','all','كل الجهات',homeState.bank==='all')}${accounts.map(a=>homeChip('bank',a.name,a.name,homeState.bank===a.name)).join('')}</div>`:'';
 let filters=`<details class="hFilters" data-did="filters" ${homeState.open.filters?'open':''} ontoggle="homeToggle('filters',this.open)"><summary><span>تصفية</span>${active?`<em>${active}</em>`:''}<small>${homeCats.find(c=>c[0]===homeState.cat)[1]} · ${homeStatuses.find(c=>c[0]===homeState.status)[1]}</small></summary><div class="hFilterBody"><p class="hGroupLabel">التصنيف</p><div class="hChips" role="group" aria-label="التصنيف">${homeCats.map(([v,l])=>homeChip('cat',v,l,homeState.cat===v)).join('')}</div><p class="hGroupLabel">الحالة</p><div class="hChips" role="group" aria-label="الحالة">${homeStatuses.map(([v,l])=>homeChip('status',v,l,homeState.status===v)).join('')}</div>${active?'<button type="button" class="hLink" onclick="homeClear()">مسح التصفية</button>':''}</div></details>`;
 let goalsBody=($('dashboardGoals').innerHTML||'<p class="hCalm">لا مخصصات أهداف لهذه الدورة.</p>');
 let more=`<div class="hLinks"><button type="button" class="hLink" onclick="show('advisorPage')">التحليل وخطة ٦ أشهر</button><button type="button" class="hLink" onclick="show('reportsPage')">التقارير والسجل</button><button type="button" class="hLink" onclick="show('calendarPage')">التقويم المالي</button><button type="button" class="hLink" onclick="show('settingsPage')">الإعدادات</button></div>`;
 let folds=homeFold('goals','أهداف هذه الدورة',esc($('dashboardGoalsSummary').textContent||''),goalsBody)+homeFold('season','تمويل رمضان والأضحية','',$('seasonFunding').innerHTML||'<p class="hCalm">—</p>')+homeFold('ledger','آخر الحركات','',($('dashboardTransactions').innerHTML||'<p class="hCalm">لا حركات مسجلة.</p>')+'<button type="button" class="hLink" onclick="show(\'reportsPage\')">السجل الكامل</button>')+homeFold('more','التحليل والتقارير والإعدادات','',more);
 host.innerHTML=`<div class="hTabs" role="tablist" aria-label="نوع العرض" onkeydown="homeTabKey(event)">${tabs}</div><p class="hViewNote">${homeViews.find(v=>v[0]===mode)[2]}</p>${period}${filters}${bankChips}<div id="homePanel" role="tabpanel" aria-labelledby="hTab-${mode}">${heroHtml}${kpiHtml}${alertHtml}<section class="hSection" aria-labelledby="hAttTitle"><h2 id="hAttTitle">${listTitle}</h2>${list}</section><section class="hSection" aria-labelledby="hFlowTitle"><h2 id="hFlowTitle">${flowTitle}</h2><div class="hFlow">${flow}</div></section>${folds}<div class="hActions"><button type="button" class="hPrimary" onclick="chooseType('expense')">+ تسجيل مصروف</button><button type="button" class="hGhost" onclick="openTypes()">حركة أخرى</button></div></div>`;
 let brand=$('brandCycle');if(brand)brand.textContent=homePeriodLabel().replace(/\s\d{4}$/,'');
 if(focus&&typeof host.querySelector==='function'){let el=host.querySelector(`[data-fid="${focus}"]`)||document.getElementById(focus);if(el&&el.focus&&el!==host)el.focus()}
}
function homeSet(group,value){if(!['cat','status','bank'].includes(group))return;homeState[group]=value;renderHome()}
function homeClear(){homeState.cat='all';homeState.status='all';renderHome()}
function homeToggle(id,open){homeState.open[id]=!!open}
function homePeriodSet(n){state.offset=n;saveState()}
function homeStep(n){state.offset=(state.offset||0)+n;saveState()}
function homeTabKey(ev){let order=homeViews.map(v=>v[0]),i=order.indexOf(dashboardMode),k=ev.key;if(k!=='ArrowLeft'&&k!=='ArrowRight'&&k!=='Home'&&k!=='End')return;ev.preventDefault();let next=k==='Home'?0:k==='End'?order.length-1:(i+(k==='ArrowLeft'?1:-1)+order.length)%order.length;setDashboardMode(order[next]);let t=document.getElementById('hTab-'+order[next]);if(t&&t.focus)t.focus()}
const dashboardBeforeHome=renderDashboard;renderDashboard=function(){dashboardBeforeHome();renderHome()};
const showBeforeHome=show;show=function(id){showBeforeHome(id);if(document.body&&document.body.classList)document.body.classList.toggle('isHome',id==='home')};
if(document.body&&document.body.classList)document.body.classList.add('isHome');
renderHome();
