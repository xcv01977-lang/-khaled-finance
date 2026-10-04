/* User-requested one-time income reset. Expense/debt/goal records remain intact. */
const MANUAL_INCOME_REVISION='2026-10-04-manual-income-v1';
function resetIncomeForManualEntry(d){if(d.manualIncomeRevision===MANUAL_INCOME_REVISION)return d;for(let t of d.transactions)if(t.type==='income')t.amount=0;d.incomePlan={...d.incomePlan,salary:0,citizen:0};d.manualIncomeRevision=MANUAL_INCOME_REVISION;return d}
if(state.manualIncomeRevision!==MANUAL_INCOME_REVISION){let before=JSON.stringify(state);try{let next=resetIncomeForManualEntry(structuredClone(state));validateState(next);localStorage.setItem('mali-income-before-manual-20261004',before);localStorage.setItem('mali-v7-undo',before);localStorage.setItem('mali-v4',JSON.stringify(next));state=next;lastSaved=JSON.stringify(state)}catch(e){toast('تعذر تصفير الدخل: '+e.message)}}
// The actual tab makes the empty income register immediately visible.
dashboardMode='actual';render();
