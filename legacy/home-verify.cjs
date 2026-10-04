// V9 home: filters are presentation only, one alert, at most three attention rows, honest hero states.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes=new Map(),storage=new Map();
function el(id){if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},appendChild(){},remove(){},insertAdjacentHTML(){},insertBefore(){},querySelector(){return el(id+'child')},querySelectorAll(){return []},value:'',checked:false});return nodes.get(id)}
const ctx={console,Intl,Date,Math,Number,String,JSON,Set,Map,Error,structuredClone,document:{getElementById:el,createElement:()=>el(Math.random()),querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},scrollTo(){},setTimeout(){},confirm:()=>true,prompt:()=>null,window:{print(){}}};
vm.createContext(ctx);for(const f of ['app','banks','dashboard','goal-timing','monitor','compact','home'])vm.runInContext(fs.readFileSync(__dirname+'/../'+f+'.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),html=()=>el('homeV9').innerHTML;
const bad=h=>/NaN|undefined|Infinity|\[object/.test(h);
const dataOnly=()=>{let s=JSON.parse(run('JSON.stringify(state)'));delete s.offset;return JSON.stringify(s)};
const base=dataOnly(),txCount=run('state.transactions.length');

// 1. Every combination of view, category, status and period renders cleanly and never edits data.
for(const offset of [-1,0,1,2]){run(`state.offset=${offset};render()`);
 for(const mode of ['plan','actual','accounts'])for(const cat of ['all','fixed','debt','goal','variable','income'])for(const status of ['all','unpaid','paid','over','funding']){
  run(`dashboardMode='${mode}';homeState.cat='${cat}';homeState.status='${status}';renderHome()`);
  const h=html();assert(!bad(h),`bad output ${offset}/${mode}/${cat}/${status}`);
  assert((h.match(/class="hAlert /g)||[]).length<=1,'more than one alert');
  const att=h.split('id="hAttTitle"')[1].split('</section>')[0];
  const shown=att.split('<details')[0];assert((shown.match(/<li class="hItem/g)||[]).length<=3,'more than three attention rows');
  assert(h.includes('aria-selected="true"')&&h.includes('role="tablist"'));}}
run("homeState.cat='all';homeState.status='all';setDashboardMode('plan');state.offset=0;render()");
assert.equal(dataOnly(),base,'filters changed saved data');assert.equal(run('state.transactions.length'),txCount);

// 2. Accounts view groups allocations exactly like the existing bankDistribution().
for(const offset of [0,1,2]){run(`state.offset=${offset};render()`);
 const mine=JSON.parse(run('JSON.stringify(homeAccounts(homeEntries()).map(a=>[a.name,a.items.length,Math.round(a.planned*100),Math.round(a.actual*100)]).sort())')),
  theirs=JSON.parse(run("JSON.stringify(bankDistribution().map(b=>[b.name,b.count,Math.round(b.planned*100),Math.round(b.actual*100)]).sort())"));
 assert.deepEqual(mine,theirs,'account groups differ at offset '+offset)}
run('state.offset=1;render()');assert(JSON.parse(run('JSON.stringify(homeAccounts(homeEntries()).map(a=>a.name))')).includes('غير موزع'),'unassigned party missing');

// 3. Category and status filters pick exactly the existing figures.
run('state.offset=0;render()');
const debtSum=run('state.debts.reduce((a,x)=>a+cycleDebtAmount(x),0)');
assert(Math.abs(run("homeEntries().filter(e=>e.cat==='debt').reduce((a,e)=>a+e.planned,0)")-debtSum)<.001,'debt entries differ from cycleDebtAmount');
const fixedSum=run('state.fixed.filter(recurringApplies).reduce((a,x)=>a+x.amount,0)');assert(Math.abs(run("homeEntries().filter(e=>e.cat==='fixed').reduce((a,e)=>a+e.planned,0)")-fixedSum)<.001,'fixed entries differ from the plan');
run("homeState.cat='fixed';homeState.status='over';renderHome()");assert(html().includes('أعلى من المخطط')&&html().includes('الزوجة'));
run("homeClear()");assert(!html().includes('نتيجة التصفية'));

// 4. Hero states: no income recorded, deficit, and plan without salary never show a misleading figure.
run("state.offset=-1;render();setDashboardMode('actual')");assert(html().includes('لم يُسجل الدخل بعد'));assert(!html().includes('hHeroValue'));
run("state.offset=0;render();setDashboardMode('plan')");assert(html().includes('الفائض المتاح'));
const salary=run('state.incomePlan.salary');
run('state.incomePlan.salary=1000;renderHome()');assert(html().includes('class="hHeroLabel">العجز')&&html().includes('hAlert tone-bad'));
run('state.incomePlan.salary=0;renderHome()');assert(html().includes('لم يُحدد الراتب المخطط بعد'));
run(`state.incomePlan.salary=${salary};render()`);assert.equal(dataOnly(),base);

// 5. Over-plan note carries amount and percentage; a calm message appears when nothing needs attention.
run("state.offset=0;render();setDashboardMode('actual')");assert(/تجاوز المخطط 100 ر\.س \(25٪\)/.test(html()),'overrun amount and percent');
run("setDashboardMode('plan');state.offset=3;render()");assert(html().includes('وضعك مرتب حاليًا')||html().includes('hItem'));

// 6. Period chips use the existing offset mechanism only.
run('state.offset=0;homePeriodSet(1)');assert.equal(run('state.offset'),1);run('homeStep(-1)');assert.equal(run('state.offset'),0);
assert.equal(dataOnly(),base);assert.equal(run('state.transactions.length'),txCount);
console.log('PASS: home filters (view, period, category, status, party) are display-only; one alert; at most three attention rows; hero states honest; accounts match bankDistribution.');
