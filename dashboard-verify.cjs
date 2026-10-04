// Run against the existing finance harness plus the new UI layers.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync(__dirname+'/verify.cjs','utf8').split("// Bank grouping changes")[0];
source+=`
const amountsBefore=run('JSON.stringify({fixed:state.fixed.map(x=>x.amount),debts:state.debts.map(x=>[x.monthly,x.remaining]),goals:state.goals.map(x=>[x.target,x.monthlyPlan]),transactions:state.transactions})');
vm.runInContext(fs.readFileSync(__dirname+'/../banks.js','utf8'),ctx);
assert.equal(run("state.fixed.find(x=>x.id==='f-kids').bankProvider"),'vision');
assert.equal(run("state.fixed.find(x=>x.id==='f-personal').bankProvider"),'snb');
assert.equal(run("state.fixed.find(x=>x.id==='f-entertainment').bankProvider"),'snb');
assert.equal(run("state.debts.find(x=>x.id==='d3').bankProvider"),'emkan');
assert.equal(run("state.goals.find(x=>x.id==='g-majlis').bankProvider"),'bilad');
assert.equal(run('JSON.stringify({fixed:state.fixed.map(x=>x.amount),debts:state.debts.map(x=>[x.monthly,x.remaining]),goals:state.goals.map(x=>[x.target,x.monthlyPlan]),transactions:state.transactions})'),amountsBefore);
const bankRevised=run('JSON.stringify(state)');run('applyBankDistribution(state)');assert.equal(run('JSON.stringify(state)'),bankRevised);
vm.runInContext(fs.readFileSync(__dirname+'/../dashboard.js','utf8'),ctx);
run('state.offset=1;render()');assert(Math.abs(run('dashboardFigures().surplus')-497.76)<.001);
assert(Math.abs(run('dashboardFigures().withCitizen')-897.76)<.001);
run("setDashboardMode('actual')");assert.equal(el('dashboardLabel').textContent,'الفائض حسب المسجل');
run("setDashboardMode('accounts')");assert.equal(el('dashboardAccountsSection').hidden,false);assert.equal(el('dashboardExecutionSection').hidden,true);
run("setDashboardMode('plan')");assert.equal(el('dashboardAccountsSection').hidden,true);assert(el('dashboardExecution').innerHTML.includes('payFixed'));
assert(!run('dashboardFlow(0,[500,0,-500])').includes('NaN'));assert(!run('dashboardFlow(0,[0,0,0])').includes('Infinity'));
assert(el('dashboardTabs').innerHTML.includes('aria-selected="true"'));
console.log('PASS: confirmed bank mapping, idempotence, unchanged payments and plans, dashboard modes, salary-only surplus, editable rows and safe deficit/empty flows.');
`;
vm.runInThisContext('(function(require,__dirname){'+source+'\n})')(require,__dirname);
