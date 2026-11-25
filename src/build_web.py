import json
# index.html → Netlify 웹사이트 (Firebase 로그인 + Firestore 실시간 동기화)
# 결과: site_fb/index.html, site_fb/firebase-config.js, firestore.rules
import re, os, sys, shutil
s = open('index.html', encoding='utf8').read()
def rep(a, b, n=1):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, n)

FB = '10.12.2'
# 연결값을 index.html 안에도 넣어둬요 → index.html 한 파일만 올려도 연결돼요
_cfgp = os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'site_fb', 'firebase-config.js')
_cfg = open(_cfgp, encoding='utf8').read() if os.path.exists(_cfgp) else ''
INLINE_CFG = ('<script>if(!window.HERB5_FIREBASE){' + re.sub(r'^\s*//.*$', '', _cfg, flags=re.M).strip() + '}</script>') if 'apiKey: "AIza' in _cfg else ''
rep('<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>\n'
    '<script>window.XLSX || document.write(\'<script src="https://unpkg.com/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"><\\/script>\')</script>\n'
    f'<script src="https://www.gstatic.com/firebasejs/{FB}/firebase-app-compat.js"></script>\n'
    f'<script src="https://www.gstatic.com/firebasejs/{FB}/firebase-auth-compat.js"></script>\n'
    f'<script src="https://www.gstatic.com/firebasejs/{FB}/firebase-firestore-compat.js"></script>\n'
    '<script src="firebase-config.js"></script>\n' + INLINE_CFG)
rep('<h1><span class="h1a">Herb5 - </span>허브아이</h1>', '<h1><span class="h1a">Herb5 - </span>허브아이 <span class="pill">웹</span></h1>')
rep('<title>Herb5 - 허브아이</title>', '<title>Herb5 - 허브아이</title>\n<link rel="apple-touch-icon" href="apple-touch-icon.png?v=2">\n<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png?v=2">\n<link rel="icon" type="image/png" sizes="512x512" href="icon-512.png?v=2">\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#f5f2ea">\n<meta name="apple-mobile-web-app-title" content="허브아이">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">')
logo = re.search(r'<img class="mark"[^>]*? src="(data:image/png;base64,[^"]+)"', s).group(1)
# 머리말: 계정 표시
rep('''      <span class="sync" id="syncbadge" title=""></span>''', '''      <span class="sync" id="syncbadge" title=""></span>
      <span class="acct" id="acct" tabindex="0" title="계정" hidden></span>''')
# 로그인 화면 + 이전 확인 창
rep('<div class="wrap">', f'''<div class="authwrap" id="authwrap" hidden>
  <div class="authbg" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="authcard">
    <div class="authhero"><img class="mark" src="{logo}" alt="허브아이 로고"><p class="ah-k">허브아이 · since 1983</p></div>
    <div id="authbody" class="authbody"><div class="aload"><span></span><span></span><span></span></div></div>
  </div>
  <p class="authfoot">since 1983</p>
</div>
<div class="modal hidden" id="migModal" role="dialog" aria-modal="true" aria-labelledby="migTitle">
  <div class="mbox">
    <h2 id="migTitle">이 기기의 예전 데이터를 옮길까요?</h2>
    <div id="migbody"></div>
    <p class="msg" id="migmsg"></p>
    <div class="row mact"><button class="btn" id="migNo">나중에</button><button class="btn pri" id="migYes">백업 받고 옮기기</button></div>
  </div>
</div>
<div class="wrap">''')
# 사용자 관리 (관리자)
rep('''    <div class="card rbak" data-sub="set">''', '''    <div class="card fbonly adminpane" style="display:block" id="memcard" data-sub="admin">
      <div class="hh"><h2>계정 관리</h2><span class="msg">관리자만 보여요</span></div>
      <p class="help">여기서 만든 <b>아이디 · 비밀번호</b>로 로그인하면 관리자인지 게스트인지 저절로 알아봐요. <b>관리자</b>는 모든 화면과 규칙 바꾸기·기록 지우기·계정 관리까지, <b>게스트</b>는 정리하기·집계 보기·재고 관리만 쓰고 <b>기록·통계는 잠겨</b> 있어요.</p>
      <table class="mtbl"><tbody id="mlist"><tr><td class="msg">불러오는 중…</td></tr></tbody></table>
      <form class="madd" id="madd" autocomplete="off">
        <input type="text" id="mid" placeholder="새 아이디 (영문·숫자)" autocapitalize="none" spellcheck="false" required>
        <input type="text" id="mpw" placeholder="비밀번호 (4자 이상)" autocomplete="new-password" required>
        <select id="mrole"><option value="guest">게스트</option><option value="admin">관리자</option></select>
        <button class="btn pri" type="submit">계정 만들기</button>
      </form>
      <p class="cardnote">빼기를 누르면 그 아이디로는 더 못 들어와요. 비밀번호를 바꾸려면 새 아이디를 만들고 예전 아이디를 빼 주세요.</p>
      <p class="msg" id="mmsg"></p>
      <div class="appicon" id="appicon">
        <div class="ai-h"><b>앱 아이콘</b><span class="msg">휴대폰 · PC에 설치하는 앱의 아이콘이에요. 고르면 모든 기기에 같이 적용돼요</span></div>
        <div class="ai-g" role="radiogroup" aria-label="앱 아이콘">
          <button type="button" class="ai-o" role="radio" data-appicon="hi" aria-checked="false"><img src="icon-hi-192.png" alt=""><span>허브아이</span></button>
          <button type="button" class="ai-o" role="radio" data-appicon="farm" aria-checked="false"><img src="icon-farm-192.png" alt=""><span>허브다섯메</span></button>
          <button type="button" class="ai-o" role="radio" data-appicon="both" aria-checked="false"><img src="icon-both-192.png" alt=""><span>두 로고 함께</span></button>
        </div>
        <p class="cardnote">이미 설치한 앱은 바로 안 바뀔 수 있어요. 바로 바꾸려면 앱을 지우고 다시 설치해 주세요 (아이폰은 꼭 다시 설치해야 해요).</p>
        <p class="msg" id="aimsg"></p>
      </div>
    </div>
    <div class="card rbak" data-sub="set">''')
_hm = re.search(r'<button class="ibtn" id="himport"[^>]*>.*?</button>', s).group(0)
rep(_hm, _hm + '\n          <button class="btn sm fbonly" id="hmig">이 기기 예전 데이터 옮기기</button>')
rep('<span>설정 · 백업</span><i class="sdot"></i></button></nav>', '<span>설정 · 백업</span><i class="sdot"></i></button><button type="button" role="tab" data-subgo="admin" class="fbonly"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>계정 관리</span><i class="sdot"></i></button></nav>')
rep("// ---------- 날씨 (기상청) ----------", """document.addEventListener('click', e => {
  const t = e.target.closest('[data-rsub]'); if (!t) return;
  document.querySelectorAll('[data-rsub]').forEach(b => b.classList.toggle('on', b === t));
  $('v-rules').classList.toggle('sub-admin', t.dataset.rsub === 'admin');
});
// ---------- 날씨 (기상청) ----------""")
rep('<section id="v-hist" class="hidden" data-cur="report">', '''<section id="v-hist" class="hidden" data-cur="report">
    <div class="histlock"><i><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></i><h2>관리자만 볼 수 있어요</h2><p>기록·통계(매출)는 관리자 아이디로 로그인했을 때만 열려요.</p><button class="btn" type="button" data-go="home">홈으로</button></div>''')
_pbg = re.search(r'\n\.pagehead\{position:relative[^\n]*\n\s*(background:[^\n]*)\n', s).group(1)
_dbg = re.search(r'\nhtml\.dark \.pagehead\{(background:[^}]*)\}', s).group(1)
rep('</style>', '.authhero{' + _pbg + '}\nhtml.dark .authhero{' + _dbg + '}\n' + open('web_login.css', encoding='utf8').read() + '</style>')
# 날씨 문구
rep("<dt>자동 갱신</dt><dd>매일 06:52 · 11:52 · 17:52 에 기상청 예보를 새로 받아요</dd>",
    "<dt>새로고침</dt><dd>새로고침(↻) 버튼을 누르거나, 사이트를 열 때 3시간이 지났으면 저절로 최신 예보를 6일치 받아요. 받은 예보와 고친 기온은 로그인한 모든 기기에 바로 같이 보여요.</dd>")
rep("<dt>출처</dt><dd><b>기상청 날씨누리</b> · 시(서울·인천·대전·세종·광주·대구·부산·울산)는 시청 근처 동네예보, 도는 권역 예보 범위 ·",
    "<dt>출처</dt><dd><b>${esc(wdata.source || '')}</b> · 시(서울·인천·대전·세종·광주·대구·부산·울산)는 시청 근처 1곳, 도는 도 안 여러 곳(4~6곳)의 범위 · <a href=\"https://open-meteo.com/\" target=\"_blank\" rel=\"noopener\">Weather data by Open-Meteo.com</a> ·")
rep("? `기상청 도 단위 예보 · 최저", "? `도 안 여러 곳 예보 · 최저")
rep("'기상청 동네예보 (시청 근처)'", "'시청 근처 지점 예보'")
rep("Claude에게 <b>\"날씨 업데이트\"</b>라고 말하면 이 지역들을 기상청 동네예보로 하나씩 확인해서 채워요.", "정확히 하려면 기상청에서 그 지역 예보를 보고, 지도에서 그 도를 눌러 기온을 직접 고쳐 주세요.")
# Firebase 코드
fb = open('web_fb.js', encoding='utf8').read()
wx = re.search(r"const WX_POINTS = (\{.*?\n\});", open('build_shared.py', encoding='utf8').read(), re.S).group(1)
fb = fb.replace('/*__WXPOINTS__*/{}', wx)
rep("// ---------- 날씨 (기상청) ----------", fb + "\n// ---------- 날씨 (기상청) ----------")
rep("  try { db = window.claude ? await claude.use('db') : null; } catch (e) { db = null; }",
    "  try { db = await herb5Firebase(); } catch (e) { db = null; webBanner('Firebase에 연결하지 못해 이 기기에만 저장돼요: ' + (e.message || e)); }")
rep("    renderRules(); srcLabel('공유 저장소에 연결되지 않아 이 브라우저에 저장돼요.'); return;",
    "    renderRules(); srcLabel('Firebase에 연결되지 않아 이 브라우저에만 저장돼요.'); webWeatherAuto(); return;")
rep("  setSync(true);\n  histInit(db);", "  setSync(true);\n  histInit(db);\n  webWeatherAuto();\n  setTimeout(() => migCheck(false), 3000);\n  $('hmig').onclick = () => migCheck(true);")
rep("b.title = on ? '규칙 · 날씨 · 기록이 휴대폰과 컴퓨터에서 바로 같이 보여요' : '이 파일은 이 기기의 브라우저에만 저장돼요. 실시간으로 같이 쓰려면 온라인 사이트를 쓰세요.';",
    "b.title = on ? '규칙 · 날씨 · 기록이 로그인한 휴대폰과 컴퓨터에서 바로 같이 보여요' : 'Firebase에 연결되지 않아 이 기기의 브라우저에만 저장돼요.';")
rep("@media(prefers-reduced-motion:reduce)", open('web_fb.css', encoding='utf8').read() + "\n#v-rules[data-cur=\"admin\"] [data-sub]:not([data-sub=\"admin\"]),#v-rules[data-cur=\"admin\"] .savebar,#v-rules:not([data-cur=\"admin\"]) .adminpane{display:none!important}\nbody:not(.is-admin) [data-subgo=\"admin\"]{display:none!important}\nbody.fbmode .nofb{display:none}\n.rtabs button{padding:7px 16px;font-size:14px}\n.framebanner{background:#fff6e6;border:1px solid #f0d9b0;color:#7a4a00;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:13px}\n@media(prefers-reduced-motion:reduce)")
out = sys.argv[1] if len(sys.argv) > 1 else 'site_fb'
os.makedirs(out, exist_ok=True)
shutil.copy('splash/icon-180.png', os.path.join(out, 'apple-touch-icon.png'))
shutil.copy('splash/icon-192.png', os.path.join(out, 'icon-192.png'))
shutil.copy('splash/icon-512.png', os.path.join(out, 'icon-512.png'))
open(os.path.join(out, 'manifest.webmanifest'), 'w', encoding='utf8').write('''{
  "name": "Herb5 - 허브아이",
  "short_name": "허브아이",
  "start_url": "./",
  "display": "standalone",
  "scope": "./",
  "id": "./",
  "background_color": "#ffffff",
  "theme_color": "#0f8584",
  "icons": [
    { "src": "icon-192.png?v=2", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png?v=2", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png?v=2", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
''')
# 앱 아이콘 고르기 (규칙 관리 → 계정 관리): 아이콘 3종과 그 아이콘을 쓰는 앱 설치 파일(manifest-종류.webmanifest)
for _k in ('hi', 'farm', 'both'):
    for _s in (180, 192, 512): shutil.copy(f'icons/icon-{_k}-{_s}.png', os.path.join(out, f'icon-{_k}-{_s}.png'))
    open(os.path.join(out, f'manifest-{_k}.webmanifest'), 'w', encoding='utf8').write(json.dumps({
      "name": "Herb5 - 허브아이", "short_name": "허브아이", "start_url": "./", "display": "standalone", "scope": "./", "id": "./",
      "background_color": "#ffffff", "theme_color": "#0f8584",
      "icons": [{"src": f"icon-{_k}-192.png", "sizes": "192x192", "type": "image/png"}, {"src": f"icon-{_k}-512.png", "sizes": "512x512", "type": "image/png"},
                {"src": f"icon-{_k}-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, ensure_ascii=False, indent=2) + '\n')
open(os.path.join(out, 'sw.js'), 'w', encoding='utf8').write("""// 허브아이 앱 설치용 서비스 워커: 화면 문서만 네트워크 우선, 끊겼을 때만 저장본을 보여 줘요. 데이터 요청은 건드리지 않아요.
const C = 'herb5-shell-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put('./', cp)).catch(() => {}); } return res; })
    .catch(() => caches.open(C).then(c => c.match('./')).then(m => m || new Response('인터넷 연결을 확인해 주세요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))));
});
""")
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w', encoding='utf8').write(s)
cfg = os.path.join(out, 'firebase-config.js')
if not os.path.exists(cfg):
    open(cfg, 'w', encoding='utf8').write('''// Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱(웹) → "SDK 설정 및 구성"의 firebaseConfig 값을 아래에 붙여 넣으세요.
// 이 값은 공개돼도 괜찮아요 (데이터는 Firestore 보안 규칙과 로그인으로 지켜요).
window.HERB5_FIREBASE = {
  apiKey: "여기에_apiKey_붙여넣기",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
''')
print('ok', len(s))
