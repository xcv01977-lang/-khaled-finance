const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const f of fs.readdirSync(__dirname).filter(x=>/^\d\d-.*\.html$/.test(x))){const p=await b.newPage({viewport:{width:1010,height:1000},deviceScaleFactor:1.5});
await p.goto('file://'+__dirname+'/'+f);await p.waitForTimeout(700);await p.screenshot({path:__dirname+'/'+f.replace('.html','.png'),fullPage:true});await p.close();}
await b.close()})();
