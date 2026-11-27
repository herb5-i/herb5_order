# 허브다섯메 농장 사이트에 허브아이 디자인을 입혀요 (기능 코드는 건드리지 않고 화면 모양만 덮어써요)
# 쓰는 법: python3 tools/farm_theme.py   (저장소 맨 위 폴더에서, sync_farm.sh가 알아서 불러요)
# 하는 일: farm/admin.html · staff.html의 스타일을 읽어 다크 모드용 색을 만들고, farm/herbi-theme.css를 쓰고, 각 화면에 연결해요.
import re, colorsys, os
FARM = 'farm'
LIGHT = r'''
/* ===== 허브아이 디자인 (밝은 화면) ===== */
:root{--green:#2f7d55;--green-d:#256645;--green-l:#e8f3ec;--green-m:#bcdcc9;--bg:#f6f7f8;--line:#e8eaed;--ink:#1d2329;--muted:#6a737c;--gray-l:#eef0ee;--navy:#1f2a24;--navy-2:#2f3a33;--r:16px;--r-sm:10px;--shadow:none;
  font-family:"IBM Plex Sans KR","Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif}
html,body{background:var(--bg)}
.btn{border-radius:10px}.btn.primary{background:var(--green);border-color:var(--green)}
input,select,textarea{border-radius:10px}
.panel,.kpi{border-radius:16px;border-color:var(--line);box-shadow:none}
.kpi{border-top-width:3px}
/* PC: 왼쪽 메뉴를 허브아이처럼 떠 있는 흰 칸으로 */
.app-admin{background:var(--bg)}
.admin{background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important;gap:16px}
.side{background:#fff!important;border:1px solid var(--line)!important;border-radius:24px;padding:16px 10px!important}
.side button{color:var(--muted)!important;border-radius:12px}
.side button:hover{color:var(--ink)!important;background:#f2f4f1!important}
.side button.on{color:var(--green)!important;background:var(--green-l)!important;box-shadow:none!important}
.side-foot b{color:var(--ink)!important}.side-logout{color:#b3261e!important}.side-reset{color:var(--muted)!important}
.admin-main{background:transparent}
.admin-head{background:#fff!important;border:1px solid var(--line)!important;border-radius:24px;margin-bottom:14px!important}
/* 관리자용 · 직원용 고르는 첫 화면 */
body > main{border-radius:24px!important;border:1px solid var(--line);box-shadow:0 18px 36px -22px rgba(40,60,30,.4)}
body > main > a{border-radius:14px!important}body > main > a.a{background:var(--navy)!important}body > main > a.s{background:var(--green)!important}
/* 휴대폰: 아래 메뉴를 허브아이처럼 떠 있는 둥근 막대로 */
.m-head{background:#fff!important;color:var(--ink)!important}
.m-tabs{margin:0 10px max(10px,env(safe-area-inset-bottom));border:1px solid var(--line)!important;border-radius:24px;box-shadow:0 8px 24px -12px rgba(30,40,30,.35);padding:6px!important;background:#fff}
.m-tabs button{border-radius:16px;position:relative}
.m-tabs button.on{color:var(--green)!important;background:var(--green-l)}
.m-tabs button.on:before{display:none!important}
'''
DARK_BASE = r'''
/* ===== 다크 모드 (허브아이와 같은 설정을 따라가요) ===== */
html.dark{color-scheme:dark;--green:#3f9a6c;--green-d:#5bb486;--green-l:rgba(63,154,108,.18);--green-m:rgba(63,154,108,.4);--bg:#121614;--card:#1a1f1c;--line:#2a322d;--ink:#e4e9e5;--muted:#98a29b;--gray-l:#232a26;--navy:#1a1f1c;--navy-2:#232a26;
  --blue-l:rgba(80,130,200,.16);--orange-l:rgba(200,112,30,.16);--red-l:rgba(194,59,51,.18);--yellow-l:rgba(184,134,11,.18);color:var(--ink)}
html.dark,html.dark body{background:var(--bg)!important;color:var(--ink)}
html.dark .side,html.dark .admin-head,html.dark .m-head,html.dark .m-tabs,html.dark .panel{background:var(--card)!important;border-color:var(--line)!important}
html.dark .kpi{background:var(--card)!important;border-left-color:var(--line)!important;border-right-color:var(--line)!important;border-bottom-color:var(--line)!important}
html.dark .chk-unchecked,html.dark .lg-unchecked,html.dark .mx-unchecked,html.dark .unchk-cell{color:var(--muted)!important;background:repeating-linear-gradient(135deg,#232a26 0 4px,#1c221e 4px 8px)!important;border-color:#4a544e!important}
html.dark .side button:hover{background:#232a26!important}
html.dark input,html.dark select,html.dark textarea{background:#151a17!important;color:var(--ink)!important;border-color:var(--line)!important}
html.dark .btn{background:#232a26;color:var(--ink);border-color:var(--line)}html.dark .btn.primary{background:var(--green);color:#fff;border-color:var(--green)}
html.dark body > main{background:var(--card)!important;border-color:var(--line)}html.dark body > main > a.a{background:#2f3a33!important}
html.dark img[src*="logo"]{background:#fff;border-radius:10px;padding:2px 6px}
html.dark img[src="logo.gif"]{content:url(logo-dark.png);background:none;padding:0}
'''
def hexrgb(h):
    h = h.lstrip('#')
    if len(h) in (3, 4): h = ''.join(c * 2 for c in h[:3])
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def dark_rules(css):
    out = []
    for sel, body in re.findall(r'([^{}@]+)\{([^{}]*)\}', css):
        sel = sel.strip()
        if not sel or sel.startswith(':root') or 'html.dark' in sel or sel.startswith('@'): continue
        decl = []
        for prop, val in re.findall(r'(background(?:-color)?|color|border(?:-[a-z]+)?-?color|border(?:-top|-bottom|-left|-right)?)\s*:\s*([^;]+)', body):
            m = re.search(r'#([0-9a-fA-F]{3,8})\b', val)
            if not m or 'var(' in val or 'gradient' in val: continue
            r, g, b = hexrgb(m.group(0)); h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if prop.startswith('background'):
                if l > .93 and s < .35: decl.append('background:var(--card)')
                elif l > .82: decl.append(f'background:rgba({r},{g},{b},.12)')
            elif prop == 'color':
                if l < .35 and s < .45: decl.append('color:var(--ink)')
                elif l < .55 and s < .3: decl.append('color:var(--muted)')
            else:
                if l > .82: decl.append(('border-color' if prop == 'border' or prop.endswith('color') and prop == 'border-color' else prop if prop.endswith('color') else prop + '-color') + ':var(--line)')
        if decl:
            sels = ','.join('html.dark ' + x.strip() for x in sel.split(',') if x.strip() and not x.strip().startswith(('html', ':root')))
            if sels: out.append(sels + '{' + ';'.join(dict.fromkeys(decl)) + '}')
    return '\n'.join(out)
def main():
    css_all = ''
    for f in ('admin.html', 'staff.html'):
        s = open(os.path.join(FARM, f), encoding='utf-8').read()
        css_all += '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', s, re.S))
    gen = dark_rules(css_all)
    gen = '\n'.join(dict.fromkeys(gen.split('\n')))
    open(os.path.join(FARM, 'herbi-theme.css'), 'w', encoding='utf-8').write(LIGHT + '\n/* --- 원래 화면 색에서 자동으로 만든 다크 모드 색 --- */\n' + gen + '\n' + DARK_BASE)
    head = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">'
            '<link rel="stylesheet" href="herbi-theme.css?v=1">'
            "<script>(function(){var m='auto';try{m=localStorage.getItem('herb5_theme')||'auto'}catch(e){}var d=m==='dark'||(m!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)})();</script>"
            # 허브다섯메 로고를 누르면 첫 화면(허브아이 · 허브다섯메 고르기)으로 — 허브아이 쪽과 똑같이
            "<style>img[alt=\"허브다섯메\"],.m-logo{cursor:pointer}</style>"
            "<script>(function(){if(!/^https?:$/.test(location.protocol))return;var m=location.pathname.match(/^(.*\\/)farm\\/[^\\/]*$/);if(!m)return;var home=m[1];"
            "document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('img[alt=\"허브다섯메\"],.m-logo');if(!t)return;e.preventDefault();e.stopPropagation();location.href=home;},true);"
            "var tip=function(){document.querySelectorAll('img[alt=\"허브다섯메\"],.m-logo').forEach(function(x){x.title='처음 화면으로 (허브아이 · 허브다섯메 고르기)'})};"
            "document.addEventListener('DOMContentLoaded',tip);setInterval(tip,2000);})();</script>")
    # 개선 메모 칸 (첫 화면 맨 위 고정 · 허브아이 메모 칸과 같은 모양): tools/farm_memo.js → farm/herbi-memo.js
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'farm_memo.js'), encoding='utf-8').read()
    open(os.path.join(FARM, 'herbi-memo.js'), 'w', encoding='utf-8').write(src)
    import hashlib; mv = hashlib.md5(src.encode('utf-8')).hexdigest()[:8]
    for f in ('admin.html', 'staff.html', 'index.html'):
        p = os.path.join(FARM, f); s = open(p, encoding='utf-8').read()
        s = re.sub(r'<!--herbi-theme-->.*?<!--/herbi-theme-->\n?', '', s, flags=re.S)
        extra = f'<script src="herbi-memo.js?v={mv}" defer></script>' if f != 'index.html' else ''
        s = s.replace('</head>', '<!--herbi-theme-->' + head + extra + '<!--/herbi-theme-->\n</head>', 1)
        open(p, 'w', encoding='utf-8').write(s)
    print('herbi-theme.css 규칙', gen.count('\n') + 1, '줄')
main()
