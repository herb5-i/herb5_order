# index.html → 공용 html (claude.ai 없이 여러 PC에서 쓰는 파일). 파일 안에 규칙·기온이 들어 있고,
# [공용 파일 새로 만들기]로 최신 규칙이 담긴 새 파일을 다시 만들 수 있어요.
import json, sys, base64
s = open('index.html', encoding='utf8').read()
def rep(a, b, count=1):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, count)
lines = s.split('\n')
i = next(k for k, l in enumerate(lines) if l.startswith('const DEFAULT_RULES = '))
j = next(k for k in range(i, len(lines)) if lines[k].rstrip().endswith('};'))
lines[i:j+1] = ['const SEED = /*__SEED__*/null;', 'const STANDALONE = true;', 'const DEFAULT_RULES = SEED.rules;']
s = '\n'.join(lines)
rep('<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>\n<script>window.XLSX || document.write(\'<script src="https://unpkg.com/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"><\\/script>\')</script>')
rep('<title>', '<title>(공용) ')
rep('<h1><span class="h1a">Herb5 - </span>허브아이</h1>', '<h1><span class="h1a">Herb5 - </span>허브아이 <span class="pill">공용</span></h1>')
# 저장: 저장 시각을 같이 남겨서, 더 새 공용 파일이 오면 그걸 쓰게
rep("else { try { localStorage.setItem('cafe24rules', JSON.stringify(rules)); } catch (e) {} }",
    "else { try { localStorage.setItem('cafe24shared_rules', JSON.stringify({ rules, savedAt: new Date().toISOString() })); } catch (e) {} srcLabel(sharedLabel()); }")
rep("else { const l = localStorage.getItem('cafe24weather'); if (l) wdata = JSON.parse(l); }",
    "else { wdata = loadSharedWeather(); }")
rep("else { try { localStorage.setItem('cafe24weather', JSON.stringify(next)); } catch (e) {} }",
    "else { try { localStorage.setItem('cafe24shared_weather', JSON.stringify(next)); } catch (e) {} }")
rep("""    try { const l = localStorage.getItem('cafe24rules'); if (l) rules = Object.assign(clone(DEFAULT_RULES), JSON.parse(l)); } catch (e) {}
    try { const l = localStorage.getItem('cafe24weather'); if (l) { wdata = JSON.parse(l); computeTemps(); } } catch (e) {}""",
"""    try { if (SEED.resetId && localStorage.getItem('herb5_reset_id') !== SEED.resetId) { ['cafe24shared_rules', 'cafe24shared_weather'].forEach(k => localStorage.removeItem(k)); localStorage.setItem('herb5_reset_id', SEED.resetId); try { sessionStorage.removeItem('herb5_rules_open'); } catch (e) {} } } catch (e) {}
    rules = clone(DEFAULT_RULES); window.__rulesFrom = 'file';
    try { const l = JSON.parse(localStorage.getItem('cafe24shared_rules') || 'null'); if (l && l.rules && l.savedAt > SEED.savedAt) { rules = Object.assign(clone(DEFAULT_RULES), l.rules); window.__rulesFrom = l.savedAt; } } catch (e) {}
    wdata = loadSharedWeather(); computeTemps();
    $('wrefresh').onclick = () => refreshWeather(true);
    if (navigator.onLine !== false && (!wdata || !wdata.updatedAt || Date.now() - new Date(wdata.updatedAt) > 3 * 3600e3)) setTimeout(() => refreshWeather(false), 300);""")
rep("srcLabel('공유 저장소에 연결되지 않아 이 브라우저에 저장돼요.')", "srcLabel(sharedLabel())")
rep("<dt>자동 갱신</dt><dd>매일 06:52 · 11:52 · 17:52 에 기상청 예보를 새로 받아요</dd>",
    "<dt>새로고침</dt><dd>[↻ 날씨 새로고침]을 누르면 최신 예보를 6일치 받아요 (인터넷 필요). 파일을 열었을 때 3시간이 지났으면 저절로 받아요. 직접 고친 기온은 그대로 둬요.</dd>")
rep("<dt>출처</dt><dd><b>기상청 날씨누리</b> · 시(서울·인천·대전·세종·광주·대구·부산·울산)는 시청 근처 동네예보, 도는 권역 예보 범위 ·",
    "<dt>출처</dt><dd><b>${esc(wdata.source || '')}</b> · 시(서울·인천·대전·세종·광주·대구·부산·울산)는 시청 근처 1곳, 도는 도 안 여러 곳(4~6곳)의 범위 · <a href=\"https://open-meteo.com/\" target=\"_blank\" rel=\"noopener\">Weather data by Open-Meteo.com</a> ·")
rep("? `기상청 도 단위 예보 · 최저", "? `도 안 여러 곳 예보 · 최저")
rep("'기상청 동네예보 (시청 근처)'", "'시청 근처 지점 예보'")
rep("Claude에게 <b>\"날씨 업데이트\"</b>라고 말하면 이 지역들을 기상청 동네예보로 하나씩 확인해서 채워요.", "정확히 하려면 기상청에서 그 지역 예보를 보고, 지도에서 그 도를 눌러 기온을 직접 고쳐 주세요.")

rep('<button class="btn" id="rimport">⬆ 규칙 가져오기</button>',
    '<button class="btn" id="rimport">⬆ 규칙 가져오기</button>\n        <button class="btn pri" id="rshare">공용 파일 새로 만들기</button>')
rep("// ---------- 규칙 내보내기 / 가져오기 ----------", r"""// ---------- 공용 파일 ----------
const fmtDT = iso => { try { return new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
function sharedLabel() {
  let l = null; try { l = JSON.parse(localStorage.getItem('cafe24shared_rules') || 'null'); } catch (e) {}
  const fileTxt = '이 파일의 규칙 (' + fmtDT(SEED.savedAt) + ' 만든 공용 파일)';
  if (l && l.savedAt > SEED.savedAt) return '공용 파일 · 이 PC에서 고친 규칙 사용 중 (' + fmtDT(l.savedAt) + ' 저장). 다른 사람도 쓰게 하려면 [공용 파일 새로 만들기]로 새 파일을 나눠 주세요.';
  return '공용 파일 · ' + fileTxt + ' 사용 중. 규칙을 고치면 [공용 파일 새로 만들기]로 새 파일을 만들어 나눠 주세요.';
}
function loadSharedWeather() {
  let w = SEED.weather;
  try { const l = JSON.parse(localStorage.getItem('cafe24shared_weather') || 'null'); if (l && l.days && (l.updatedAt || '') > (w.updatedAt || '')) w = l; } catch (e) {}
  return w;
}
// 날씨 새로고침: Open-Meteo (브라우저에서 바로 받을 수 있는 무료 예보). 시는 시청 1곳, 도는 여러 곳의 범위.
const WX_POINTS = {
  '서울': [[37.5665, 126.978]], '인천': [[37.456, 126.705]], '대전': [[36.350, 127.385]], '세종': [[36.480, 127.289]],
  '광주': [[35.160, 126.851]], '대구': [[35.871, 128.601]], '부산': [[35.180, 129.075]], '울산': [[35.539, 129.311]],
  '경기': [[37.263, 127.029], [37.760, 126.780], [37.895, 127.200], [37.272, 127.435], [36.992, 127.113], [37.831, 127.510]],
  '강원': [[37.881, 127.730], [37.342, 127.920], [37.752, 128.876], [38.147, 127.313], [37.164, 128.986], [38.207, 128.592]],
  '충북': [[36.642, 127.489], [36.991, 127.926], [37.133, 128.191], [36.175, 127.776]],
  '충남': [[36.815, 127.114], [36.785, 126.450], [36.447, 127.119], [36.333, 126.613], [36.187, 127.099]],
  '전북': [[35.825, 127.148], [35.968, 126.737], [35.416, 127.390], [36.007, 127.661], [35.570, 126.856]],
  '전남': [[34.812, 126.392], [34.760, 127.662], [34.951, 127.488], [35.016, 126.711], [34.573, 126.599], [35.203, 127.463]],
  '경북': [[36.019, 129.343], [36.568, 128.730], [36.120, 128.344], [35.856, 129.225], [36.893, 128.732], [36.806, 128.624]],
  '경남': [[35.228, 128.681], [35.180, 128.108], [35.229, 128.889], [35.687, 127.910], [34.854, 128.433], [35.335, 129.037]],
  '제주': [[33.500, 126.531], [33.254, 126.560], [33.459, 126.931]]
};
function inFrame() { try { return window.self !== window.top; } catch (e) { return true; } }
function showFrameBanner() {
  if (!inFrame() || document.getElementById('framebanner')) return;
  const b = document.createElement('div'); b.id = 'framebanner'; b.className = 'framebanner';
  b.innerHTML = '<b>미리보기 화면으로 열려 있어요.</b> 여기서는 날씨 새로고침·내려받기가 막힐 수 있어요. 파일을 내려받아 바탕화면에 두고 <b>더블클릭(크롬·엣지·사파리)</b>으로 열어 주세요.';
  document.querySelector('.wrap').prepend(b);
}
async function refreshWeather(manual) {
  const msg = $('wmsg'), btn = $('wrefresh');
  if (manual && wDirty && !window.__wConfirm) { window.__wConfirm = true; msg.className = 'msg err'; msg.textContent = '저장 안 한 고친 기온이 사라져요. 한 번 더 누르면 새로고침'; return; }
  window.__wConfirm = false; btn.disabled = true; msg.className = 'msg'; msg.textContent = '최신 예보 받는 중…';
  try {
    const pts = [], owner = [];
    for (const r in WX_POINTS) WX_POINTS[r].forEach(p => { pts.push(p); owner.push(r); });
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + pts.map(p => p[0]).join(',') + '&longitude=' + pts.map(p => p[1]).join(',') +
      '&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=6';
    let res = null, lastErr = null;
    for (let tryN = 0; tryN < 2 && !res; tryN++) {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
      try { res = await fetch(url, { signal: ac.signal, cache: 'no-store' }); } catch (err) { lastErr = err; if (tryN === 0) await new Promise(r => setTimeout(r, 1200)); }
      finally { clearTimeout(tm); }
    }
    if (!res) throw Object.assign(new Error('net'), { net: true, abort: lastErr && lastErr.name === 'AbortError' });
    if (!res.ok) throw new Error('예보 서버가 ' + res.status + ' 오류를 보냈어요. 잠시 뒤 다시 눌러 주세요.');
    let js = await res.json(); if (!Array.isArray(js)) js = [js];
    if (js.length !== pts.length) throw new Error('받은 예보 개수가 맞지 않아요');
    const acc = {};
    js.forEach((o, k) => {
      const r = owner[k], d = o && o.daily; if (!d || !d.time) return;
      d.time.forEach((t, i) => {
        const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i]; if (lo == null || hi == null) return;
        const e = ((acc[t] = acc[t] || {})[r] = acc[t][r] || { lo: [], hi: [] }); e.lo.push(Math.round(lo)); e.hi.push(Math.round(hi));
      });
    });
    const days = {}, today = isoOf(0);
    for (const t in acc) { if (t < today) continue; days[t] = {}; for (const r in acc[t]) { const e = acc[t][r];
      days[t][r] = { min: [Math.min(...e.lo), Math.max(...e.lo)], max: [Math.min(...e.hi), Math.max(...e.hi)], src: WX_POINTS[r].length > 1 ? '권역예보' : '동네예보' }; } }
    if (!Object.keys(days).length) throw new Error('받은 예보가 비어 있어요');
    const old = (wdata && wdata.days) || {};
    for (const t in old) { if (t < today) continue; for (const r in old[t]) if (old[t][r] && old[t][r].manual) { (days[t] = days[t] || {})[r] = old[t][r]; } }
    const now = new Date();
    wdata = { source: 'Open-Meteo 예보', issued: now.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 받음', updatedAt: now.toISOString(), days, places: {} };
    try { localStorage.setItem('cafe24shared_weather', JSON.stringify(wdata)); } catch (e) {}
    wDirty = false; edited.clear(); computeTemps(); renderWeather(); renderNeed(); if (srcRows) runProcess();
    msg.className = 'msg ok'; msg.textContent = '최신 예보를 받았어요 (' + Object.keys(days).length + '일치)';
  } catch (e) {
    msg.className = 'msg err';
    if (e && e.net) {
      msg.innerHTML = inFrame() ? '예보를 받지 못했어요. <b>미리보기 화면</b>에서는 인터넷 연결이 막혀요. 파일을 내려받아 <b>크롬이나 엣지에서 직접 열어</b> 주세요.'
        : e.abort ? '예보 서버가 15초 넘게 답하지 않아요. 잠시 뒤 다시 눌러 주세요.'
        : (navigator.onLine === false ? '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 눌러 주세요.'
        : '예보 서버(api.open-meteo.com)에 연결하지 못했어요. 광고 차단 프로그램·회사 보안 프로그램이 막고 있는지 확인해 주세요. 그동안은 지도에서 기온을 직접 고칠 수 있어요.');
    } else msg.textContent = '예보를 받지 못했어요: ' + (e.message || e);
    showFrameBanner();
  } finally { btn.disabled = false; }
}
$('rshare').onclick = async () => {
  const m = $('rbakmsg'); m.className = 'msg';
  try {
    const tpl = document.getElementById('tpl').textContent.trim();
    const bin = atob(tpl), bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const src = new TextDecoder('utf-8').decode(bytes);
    const now = new Date().toISOString();
    const seed = { savedAt: now, rules: rules, weather: wdata || SEED.weather, resetId: SEED.resetId };
    const seedTxt = JSON.stringify(seed).replace(/</g, '\\u003c');
    const SEED_MARK = '/*__' + 'SEED__*/null', TPL_MARK = '<!--__' + 'TPL__-->';
    const out = src.replace(SEED_MARK, () => seedTxt).replace(TPL_MARK, () => '<script id="tpl" type="text/plain">' + tpl + '<\/script>');
    await saveFile('Herb5 허브아이 (공용).html', new Blob([out], { type: 'text/html' }));
    try { localStorage.setItem('cafe24shared_rules', JSON.stringify({ rules, savedAt: now })); } catch (e) {}
    dirty = false; $('savemsg').className = 'msg ok'; $('savemsg').textContent = '이 PC에도 저장했어요';
    m.className = 'msg ok'; m.innerHTML = '새 공용 파일을 내려받았어요. 예전 파일 대신 이 파일을 공유 폴더·메신저로 나눠 주세요.<br>다른 PC에서 새 파일을 열면 자동으로 새 규칙을 써요.';
  } catch (e) {
    if (e && e.code === 'declined') { m.textContent = '내려받기를 취소했어요'; return; }
    m.className = 'msg err'; m.textContent = '만들지 못했어요: ' + ((e && (e.message || e.code)) || e);
  }
};
// ---------- 규칙 내보내기 / 가져오기 ----------""")
rep('</body>', '<!--__TPL__-->\n</body>')
rep('</style>', '.framebanner{background:#fff6e6;border:1px solid #f0d9b0;color:#7a4a00;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:13px}\n</style>')
template = s
seed = {"savedAt": "2026-11-17T11:00:00.000Z", "resetId": "reset-2026-11-17-2015",
        "rules": json.load(open('rules_live.json', encoding='utf8')),
        "weather": json.load(open('weather_doc.json', encoding='utf8'))}
tpl64 = base64.b64encode(template.encode('utf8')).decode()
out = template.replace('/*__SEED__*/null', json.dumps(seed, ensure_ascii=False).replace('<', '\\u003c'), 1) \
              .replace('<!--__TPL__-->', '<script id="tpl" type="text/plain">' + tpl64 + '</script>', 1)
open(sys.argv[1] if len(sys.argv) > 1 else 'shared.html', 'w', encoding='utf8').write(out)
print('ok', len(out))
