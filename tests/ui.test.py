"""اختبار الشاشات بمتصفح آلي — يتشغّل قبل كل نشر: python3 tests/ui.test.py
يفتح مالي ببيانات خالد (من tests/fixtures/history.cjs) وبجهاز فاضي، ويتأكد إن الشاشات الأساسية
تطلع، وإن النسخة السحابية تنرفع مشفرة وترجع صح، وإن ما فيه أخطاء JavaScript."""
import asyncio, base64, functools, gzip, http.server, json, os, subprocess, sys, threading
from playwright.async_api import async_playwright
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = 'testKey_abcdefghijklmnop'
passed = 0


def ok(cond, name):
    global passed
    if not cond:
        raise AssertionError(name)
    passed += 1
    print('✓', name)


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def fixture_state():
    js = "const C=require('./mali9-core.js'),H=require('./tests/fixtures/history.cjs');const s=H.apply(C.normalize(H.seedState()));s.settings.syncKey='%s';process.stdout.write(JSON.stringify(s));" % KEY
    return subprocess.check_output(['node', '-e', js], cwd=ROOT).decode()


def decrypt(rec):
    raw = base64.b64decode(rec['data'])
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=b'mali-backup-v1', info=b'aes-gcm').derive(KEY.encode())
    pt = AESGCM(key).decrypt(raw[:12], raw[12:], None)
    return json.loads(gzip.decompress(pt) if rec['fmt'] == 'gzenc1' else pt)


def clock(day):
    return "const D=Date;const f=new D('%s').getTime();window.Date=class extends D{constructor(...a){a.length?super(...a):super(f)}static now(){return f}};" % day


async def tab(pg, word):
    await pg.evaluate("w=>[...document.querySelectorAll('#tabbar button')].find(b=>b.innerText.includes(w)).click()", word)
    await pg.wait_for_timeout(400)


async def main():
    srv = serve()
    base = 'http://127.0.0.1:%d/index.html' % srv.server_port
    state = fixture_state()
    cloud = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()

        async def page(day, data=None):
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar-SA')
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.add_init_script(clock(day))
            if data:
                await pg.add_init_script("if(!localStorage.getItem('mali-v9'))localStorage.setItem('mali-v9',%s)" % json.dumps(data))

            async def bk(route):
                req = route.request
                if req.method == 'POST':
                    body = json.loads(req.post_data)
                    if body.get('key') == KEY:          # جهاز ثاني بمفتاح ثاني = تخزين ثاني في الحقيقة
                        cloud['rec'] = body
                    return await route.fulfill(json={'ok': True, 'at': body.get('at'), 'day': body.get('day')})
                if 'get=' in req.url:
                    return await route.fulfill(json=dict(cloud['rec'], ok=True))
                return await route.fulfill(json={'ok': True, 'latest': {'at': cloud.get('rec', {}).get('at'), 'count': 0, 'size': 1}, 'days': ['2026-10-28']})
            await pg.route('**/api/backup*', bk)
            await pg.route('**/api/inbox*', lambda r: r.fulfill(json={'ok': True, 'items': []}))
            await pg.goto(base)
            await pg.wait_for_timeout(1200)
            return ctx, pg, errs

        # ── بيانات خالد، راتب أكتوبر الحالي ──
        ctx, pg, errs = await page('2026-10-28T10:00:00', state)
        txt = lambda sel: pg.evaluate("s=>(document.querySelector(s)||{}).innerText||''", sel)
        hero = await txt('#homeHero')
        ok('معك تصرفه لين الراتب' in hero and '3,997.94' in hero and 'المسموح اليوم' in hero, 'الرئيسية: معك والمسموح اليوم')
        ok('دفعات من الراتب' in hero or 'القرض' in hero, 'الرئيسية: السطر الذكي')
        ok(await pg.locator('#quick button').count() == 4, 'الرئيسية: 4 أزرار سريعة')
        ok(await pg.locator('#homeTasks .rjItem').count() == 4 and 'مدفوعات قادمة' in await txt('#homeTasks'), 'الرئيسية: مدفوعات قادمة')
        await pg.click('#homeTasks summary'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("!document.querySelector('#homeTasks details').open") and await pg.locator('#homeTasks .rjBadge').is_visible(), 'المدفوعات تنقفل ويبقى الشعار')
        await pg.reload(); await pg.wait_for_timeout(1200)
        ok(await pg.evaluate("!document.querySelector('#homeTasks details').open"), 'المدفوعات تتذكر إنها مقفلة')
        await pg.click('#homeTasks summary'); await pg.wait_for_timeout(300)
        w = await txt('#wallets')
        ok('الفائض' in w and 'المصروف اليومي' in w and 'البيت' in w and 'العيال' in w and 'الشخصي' in w, 'الرئيسية: محافظك وخانة الفائض والمصروف اليومي')
        ok(await pg.locator('#tabbar button').count() == 4 and 'أصرفها' not in await txt('#tabbar'), 'الشريط: 4 تبويبات بدون أصرفها')
        ok(await pg.evaluate("document.getElementById('budget').closest('#planStash')!==null"), 'مصروفي انتقل لتفاصيل الخطة')
        ok('هامش' in await txt('#proposals'), 'الرئيسية: بطاقة التحديث المقترح')
        await pg.click('#pOk'); await pg.wait_for_timeout(500)
        ok('هامش الأمان' in await txt('#wallets') and await txt('#proposals') == '', 'اعتماد التحديث يضيف هامش الأمان')
        await tab(pg, 'الخطة')
        body = await txt('#pageBody')
        ok('وين يروح راتبك' in body and 'المواسم' in body and 'توصل' in body, 'تبويب الخطة: وين يروح راتبك والمواسم والطوارئ')
        await pg.click('.pDet > summary'); await pg.wait_for_timeout(300)
        body = await txt('#pageBody')
        ok('الفائض المتوقع' in body and 'عدّاد المواسم' in body and 'مصروفي' in body, 'تفاصيل الخطة: العداد والميزان ومصروفي')
        await pg.click('#pageBack'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.getElementById('planStash').children.length") == 6, 'الرجوع من الخطة يرجع الأقسام لمكانها')
        # سجل التعديلات: ادفع مهمة من صفحة المهام ثم رجّع
        await tab(pg, 'المهام')
        first = await pg.evaluate("document.querySelector('#pageBody .task .tBody b').innerText")
        await pg.evaluate("document.querySelector('#pageBody .task [data-full]').click()"); await pg.wait_for_timeout(600)
        await pg.click('#pageBack'); await pg.wait_for_timeout(300)
        ok(first not in await txt('#homeTasks'), 'الدفع يشيل المهمة من المدفوعات القادمة')
        await pg.click('#histBtn'); await pg.wait_for_timeout(300)
        ok('تم تسجيل' in await txt('#sheetBody') or 'دفع' in await txt('#sheetBody'), 'سجل التعديلات فيه الدفعة')
        await pg.click('[data-hrev]'); await pg.wait_for_timeout(600)
        ok(first in await txt('#homeTasks'), 'رجّع يرجّع المهمة')
        await tab(pg, 'المهام')
        ok('القرض الرئيسي' in await txt('#pageBody'), 'تبويب المهام: الدورة الحالية')
        await pg.click('#pageNext'); await pg.wait_for_timeout(400)
        ok('القرض الرئيسي' in await txt('#pageBody'), 'تبويب المهام: الدورة الجاية')
        await pg.click('#pageBack'); await pg.wait_for_timeout(300)
        await pg.click('#nextCycle'); await pg.wait_for_timeout(400)
        ok('البيت' in await txt('#wallets'), 'المحافظ تطلع في الدورة الجاية')
        await pg.click('#prevCycle'); await pg.wait_for_timeout(300)
        await pg.click('#settingsBtn'); await pg.wait_for_timeout(400)
        await pg.click('#sWeekly'); await pg.wait_for_timeout(300)
        ok('ملخص الخميس' in await txt('#sheetTitle'), 'الإعدادات: ملخص الخميس')
        # نسخة سحابية: ترتفع مشفرة
        await pg.evaluate("document.querySelector('[data-close].iconBtn').click()"); await pg.wait_for_timeout(300)
        await pg.click('#settingsBtn'); await pg.wait_for_timeout(300)
        await pg.click('#sCloud'); await pg.wait_for_timeout(400)
        await pg.click('#ckNow'); await pg.wait_for_timeout(1200)
        rec = cloud.get('rec') or {}
        ok(rec.get('fmt') == 'gzenc1', 'النسخة السحابية مشفرة')
        ok('13378' not in rec.get('data', '') and 'الشغالة' not in json.dumps(rec, ensure_ascii=False), 'ما فيه أرقام مقروءة في النسخة')
        restored = decrypt(rec)
        ok(any(x['id'] == 'f-buffer' for x in restored['fixed']), 'فك التشفير بالمفتاح يرجع البيانات')
        ok(rec.get('digest') and 'surplus' in rec['digest'] and 'fixed' not in rec['digest'], 'أرقام الملخص المختصرة بدون أسماء')
        ok(not errs, 'ما فيه أخطاء (بيانات خالد): %s' % errs)
        await ctx.close()

        # ── جهاز جديد فاضي: يسترجع من السحابة بالمفتاح ──
        ctx, pg, errs = await page('2026-10-28T10:00:00')
        txt = lambda sel: pg.evaluate("s=>(document.querySelector(s)||{}).innerText||''", sel)
        ok('رجعت خطتك تلقائيًا' in await txt('#insights') and await pg.locator('#homeTasks .rjItem').count() > 0, 'جهاز جديد: الخطة ترجع تلقائيًا')
        await pg.click('#sdCloud'); await pg.wait_for_timeout(400)
        await pg.fill('#ckIn', KEY); await pg.click('#ckGo'); await pg.wait_for_timeout(800)
        await pg.click('[data-ckr]'); await pg.wait_for_timeout(1500)
        ok('القرض الرئيسي' in await pg.evaluate("document.body.innerText") or await pg.locator('#homeTasks .hRow').count() > 0, 'الاسترجاع يرجع الخطة على جهاز جديد')
        ok(not errs, 'ما فيه أخطاء (جهاز جديد): %s' % errs)
        await ctx.close()
        await b.close()
    srv.shutdown()
    print('\n%d اختبار ناجح' % passed)

asyncio.run(main())
