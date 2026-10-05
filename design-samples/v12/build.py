import math, html
I = {
 'bell':'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
 'gear':'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2L10 21h4l.6-2.7c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
 'home':'<path d="M3 11l9-8 9 8v10H3z"/>','check':'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
 'wal':'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14h2"/>','grid':'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>','back':'<path d="M9 6l6 6-6 6"/>','eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'chart':'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>','x':'<path d="M6 6l12 12M18 6L6 18"/>','search':'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 'cal':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>','bolt':'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>','shield':'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
 'msg':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>','pal':'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.5-1.3.4-2.3 1.7-2.3H18a3 3 0 0 0 3-3C21 7 17 3 12 3z"/>',
 'db':'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
}
def ic(n,s=20): return f'<svg viewBox="0 0 24 24" style="width:{s}px;height:{s}px">{I[n]}</svg>'
def num(v,cls='',sign=False):
    t=f'{v:,.2f}'.rstrip('0').rstrip('.') if isinstance(v,float) and v%1 else f'{int(round(v)):,}'
    return f'<span class="n {cls}">{"+" if sign and v>0 else ""}{t}</span>'

def nav(active):
    items=[('home','الرئيسية','home',0),('tasks','المهام','check',8),None,('wallets','المحافظ','wal',0),('more','المزيد','grid',0)]
    out=''
    for it in items:
        if it is None: out+=f'<a><span class="fab">{ic("plus",28)}</span><span style="height:16px"></span></a>'; continue
        k,l,i,b=it
        out+=f'<a class="{"on" if k==active else ""}">{ic(i,24)}{f"<span class=bdg>{b}</span>" if b else ""}{l}</a>'
    return f'<div class="nav">{out}</div>'

def phone(content, active=None, header=None, nonav=False, left='bell', right='gear'):
    hd=''
    if header: hd=f'<div class="hd"><span class="ib">{ic(left)}</span><h2>{header}</h2><span class="ib">{ic(right)}</span></div>'
    return f'<div class="phone"><div class="scr"><div class="island"></div><div class="sb"><span>12:28</span><span style="font-size:12px">●●● 5G ▭</span></div><div class="body">{hd}{content}</div>{"" if nonav else nav(active)}</div></div>'

def board(title,sub,a,b,na='خيار A',nb='خيار B'):
    return f'<!doctype html><meta charset=utf-8><link rel=stylesheet href=v12.css><div class="board"><h1>{title}</h1><p class="sub">{sub}</p><div class="row2"><div class="opt">{a}<span class="tag">{na}</span></div><div class="opt">{b}<span class="tag">{nb}</span></div></div></div>'

def gauge(w=330, segs=None):
    # semicircle: segs list of (pct,color)
    r=110; cx=w/2; cy=130; L=math.pi*r; out=''; off=0
    out+=f'<path d="M {cx-r} {cy} A {r} {r} 0 0 1 {cx+r} {cy}" stroke="rgba(255,255,255,.08)" stroke-width="16" fill="none" stroke-linecap="round"/>'
    for pct,col in segs:
        ln=L*pct/100-6
        out+=f'<path d="M {cx-r} {cy} A {r} {r} 0 0 1 {cx+r} {cy}" stroke="{col}" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="{max(ln,1)} {L}" stroke-dashoffset="{-off}"/>'
        off+=L*pct/100
    return f'<svg viewBox="0 0 {w} 150" style="width:{w}px;height:150px;stroke-width:16">{out}</svg>'

def spark(w=150,h=50,pts=None,col='#1FD6A3'):
    pts=pts or [10,14,11,18,15,22,19,28,24,31,36]
    mx=max(pts);mn=min(pts);xs=[i*w/(len(pts)-1) for i in range(len(pts))]
    ys=[h-4-(p-mn)/(mx-mn)*(h-10) for p in pts]
    d='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in zip(xs,ys))
    return f'<svg viewBox="0 0 {w} {h}" style="width:{w}px;height:{h}px;stroke-width:2.4"><defs><linearGradient id="sg{col[1:]}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{col}" stop-opacity=".35"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></linearGradient></defs><path d="{d} L{w} {h} L0 {h}Z" fill="url(#sg{col[1:]})" stroke="none"/><path d="{d}" stroke="{col}" fill="none"/></svg>'

def ring(p,size=84,col='#1FD6A3',inner=''):
    r=size/2-7;c=2*math.pi*r
    return f'<div style="width:{size}px;height:{size}px;position:relative;flex:none"><svg viewBox="0 0 {size} {size}" style="width:{size}px;height:{size}px;transform:rotate(-90deg);stroke-width:8"><circle cx="{size/2}" cy="{size/2}" r="{r}" stroke="rgba(255,255,255,.1)" fill="none"/><circle cx="{size/2}" cy="{size/2}" r="{r}" stroke="{col}" fill="none" stroke-linecap="round" stroke-dasharray="{c*p/100:.1f} {c}"/></svg><div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">{inner}</div></div>'

def bubble(t):
    return f'<div style="display:flex;gap:10px;align-items:flex-end"><span class="ico" style="background:#101728;border:1px solid #7B61FF66;color:#A596FF;width:46px;height:46px;border-radius:15px">{ic("bolt",22)}</span><div class="bub" style="flex:1">{t}</div></div>'

PAGES=[]
exec(open('screens.py',encoding='utf-8').read())
for name,(t,sub,a,b) in PAGES_DICT.items():
    open(f'{name}.html','w',encoding='utf-8').write(board(t,sub,a,b))
print(list(PAGES_DICT))
