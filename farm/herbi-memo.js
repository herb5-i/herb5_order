// 허브다섯메 첫 화면에 '개선 메모' 칸을 고정해요 (허브아이 홈의 개선 메모 칸과 같은 모양 · 같은 동작)
// - tools/farm_theme.py가 farm/herbi-memo.js로 복사하고 admin.html · staff.html에 붙여요. farm/ 파일은 직접 고치지 말고 이 파일을 고쳐요.
// - 같은 기기에서 허브아이에 로그인해 둔 사람만 쓸 수 있어요 (주소가 같아서 허브아이 로그인이 그대로 이어져요).
// - 메모는 카페24 중계 서버에 허브아이 메모와 따로 모여요 (/fb?site=farm). 처리 내용은 저장소 맨 위 fb_notes_farm.json.
(function () {
  if (window.__h5memo) return; window.__h5memo = 1;
  const FBV = '10.12.2', ROOT = '../', SITE = 'farm';
  const ST = [['memo', '메모됨'], ['doing', '처리중'], ['done', '반영함'], ['hold', '반영 안 됨']], SL = Object.fromEntries(ST);
  const S = { phase: 'off', user: null, role: 'guest', worker: '', list: null, notes: {}, notesAt: 0, F: null, openN: new Set(), openCm: new Set(), voice: false, rec: null, err: '' };
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tm = iso => { const d = new Date(iso); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const tmd = iso => { const d = new Date(iso); return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate(); };
  const fmt = t => String(t || '').split('\n').map(l => /^\s*(📌|✅|😥|💡|👉|⚠)/.test(l) ? `<b class="fbh">${esc(l.trim())}</b>` : esc(l)).join('\n');
  const img = f => ROOT + 'fb_img/' + encodeURIComponent(String(f).replace(/^.*\//, ''));
  const stat = x => { const n = S.notes[String(x.no)]; if (!n || !n.st) return n && n.t ? 'doing' : 'memo'; return n.st === 'hold' ? 'hold' : n.st === 'done' ? 'done' : 'doing'; };
  const mine = x => S.role === 'admin' || (S.user && S.user.email && x.by === S.user.email.split('@')[0]);

  // ---------- 화면 모양 (허브아이 메모 칸과 같은 값) ----------
  const css = `
.h5m{--a:#2f7d55;--a2:#e8f1e1;--ln:#e8eaed;--mu:#6b7480;--ik:#1d2329;--cd:#fff;--bgm:#f6f7f8;box-sizing:border-box;font-family:"IBM Plex Sans KR","Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;color:var(--ik);background:var(--cd);border:1px solid var(--ln);border-radius:12px;padding:17px;margin:0 0 16px;min-width:0;text-align:left;line-height:1.5}
html.dark .h5m{--a:#3f9a6c;--a2:rgba(147,207,140,.14);--ln:#2a322d;--mu:#98a29b;--ik:#e4e9e5;--cd:#1a1f1c;--bgm:#121614}
.m-body>.h5m{margin:0 0 14px}
.h5m *{box-sizing:border-box}
.h5m button{font:inherit;cursor:pointer}
.h5m-wt{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.h5m-lb{flex:1;min-width:0;font-size:13.5px;font-weight:600;color:var(--mu);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.h5m-i{width:18px;height:18px;border-radius:50%;border:1px solid var(--mu);color:var(--mu);background:none;font-size:11px;font-weight:700;line-height:1;padding:0;display:inline-grid;place-items:center}
.h5m-tip{flex-basis:100%;font-weight:400;font-size:12.5px;margin-top:2px}
.h5m-pin{color:var(--a);flex:none;display:flex}.h5m-pin svg{width:18px;height:18px}
.h5m textarea{width:100%;border-radius:14px;border:1px solid var(--ln);padding:10px 12px;font:inherit;font-size:15px;color:var(--ik);background:var(--cd);resize:vertical;min-height:64px;display:block}
html.dark .h5m textarea{background:rgba(0,0,0,.18);border-color:rgba(255,255,240,.08)}
.h5m textarea:focus{outline:2px solid var(--a);outline-offset:1px}
.h5m-b{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.h5m-mic{width:44px;height:44px;border-radius:50%;border:1px solid var(--ln);background:var(--cd);color:var(--a);display:grid;place-items:center;flex:none;padding:0}
.h5m-mic svg{width:22px;height:22px}
.h5m-mic.on{background:#d9483b;border-color:#d9483b;color:#fff;animation:h5mp 1.2s infinite}
@keyframes h5mp{50%{box-shadow:0 0 0 6px rgba(217,72,59,.18)}}
.h5m-go{background:var(--a);color:#fff;border:1px solid var(--a);border-radius:8px;padding:5px 11px;font-size:12px!important;font-weight:600;min-height:31px}
.h5m-go:disabled{opacity:.6}
.h5m-sb{background:var(--cd);color:var(--ik);border:1px solid var(--ln);border-radius:8px;padding:5px 11px;font-size:12px!important;font-weight:600;min-height:31px}
.h5m-msg{flex:1 1 160px;min-width:0;font-size:13px;color:var(--mu)}
.h5m-msg.ok{color:var(--a);font-weight:600}.h5m-msg.err{color:#c0392b;font-weight:600}
html.dark .h5m-msg.err{color:#f08a7e}
.h5m-foot{margin:10px 0 0;font-size:12.5px;color:var(--mu)}
.h5m-t{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0 4px}
@media (max-width:560px){.h5m-t{grid-template-columns:repeat(2,minmax(0,1fr))}}
.h5m-s{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:10px 12px;border-radius:14px;border:1.5px solid var(--ln);background:var(--cd);color:var(--ik);text-align:left;min-width:0}
.h5m-s b{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2}
.h5m-s span{font-size:14px;font-weight:700}
.h5m-s.memo b{color:#c0392b}.h5m-s.doing b{color:#b86b00}.h5m-s.done b{color:var(--a)}.h5m-s.hold b{color:#6a7266}
html.dark .h5m-s.memo b{color:#f08a7e}html.dark .h5m-s.doing b{color:#e0a050}html.dark .h5m-s.hold b{color:#a3aba5}
.h5m-s.memo.on{border-color:#c0392b;background:rgba(192,57,43,.07)}.h5m-s.doing.on{border-color:#d08a3a;background:rgba(208,138,58,.09)}
.h5m-s.done.on{border-color:var(--a);background:var(--a2)}.h5m-s.hold.on{border-color:#8a9286;background:var(--bgm)}
.h5m-it{padding:10px 0;border-top:1px solid var(--ln);font-size:14px}
.h5m-it>p{margin:0 0 4px;white-space:pre-wrap;overflow-wrap:anywhere}
.h5m-it>small{display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:var(--mu);font-size:12px}
.h5m-top{display:flex;margin-bottom:4px}
.h5m-chip{font-size:11.5px;font-weight:700;color:#fff;border-radius:99px;padding:2px 9px}
.h5m-chip.memo{background:#c0392b}.h5m-chip.doing{background:#b86b00}.h5m-chip.done{background:var(--a)}.h5m-chip.hold{background:#6a7266}
.h5m-del{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:none;color:var(--mu);display:grid;place-items:center;padding:0}
.h5m-del svg{width:16px;height:16px}.h5m-del.sure{border-color:#c0392b;color:#c0392b;background:rgba(192,57,43,.07)}
.h5m-note{margin-top:8px;padding:9px 12px;border-radius:12px;background:var(--a2);font-size:13.5px}
.h5m-note.none{background:var(--bgm);display:flex;gap:8px;align-items:center;color:var(--mu)}.h5m-note.none b{color:var(--mu)}
.h5m-nh{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:0;color:inherit;text-align:left}
.h5m-nh b{color:var(--a)}.h5m-nh span{font-size:12px;color:var(--mu)}
.h5m-nh i{margin-left:auto;font-style:normal;font-size:12.5px;font-weight:700;color:var(--a)}
.h5m-note p{margin:6px 0 0;white-space:pre-line;line-height:1.6;color:var(--ik);overflow-wrap:anywhere;word-break:keep-all}
.h5m-note .fbh{display:inline-block;font-size:14.5px;font-weight:800;margin-top:2px}
.h5m-im{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;margin-top:8px}
.h5m-im button{padding:0;border:1px solid var(--ln);border-radius:10px;overflow:hidden;background:var(--cd);cursor:zoom-in;line-height:0}
.h5m-im img{display:block;width:120px;height:80px;object-fit:cover;object-position:top}
.h5m-im small{font-size:11.5px;color:var(--mu)}
.h5m-cm{margin-top:6px;padding-left:12px;border-left:2px solid var(--ln);display:flex;flex-direction:column;gap:6px}
.h5m-c small{font-size:12px;color:var(--mu)}.h5m-c p{margin:2px 0 0;font-size:13.5px;white-space:pre-line;overflow-wrap:anywhere}
.h5m-cmo{align-self:flex-start;border:0;background:none;color:var(--a);font-size:13px!important;font-weight:700;padding:4px 0}
.h5m-cf textarea{font-size:14px;min-height:56px;border-radius:10px;padding:8px 10px}
.h5m-cb{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}
.h5m-gate{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px;border-radius:12px;background:var(--bgm);border:1px solid var(--ln)}
.h5m-gate b{font-size:15px}.h5m-gate span{font-size:13px;color:var(--mu)}
.h5m-gate .h5m-row{display:flex;gap:8px;flex-wrap:wrap}
.h5m-gate a.h5m-go{display:inline-flex;align-items:center;text-decoration:none}
.h5m-ph{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:grid;place-items:center;padding:16px}
.h5m-ph img{max-width:100%;max-height:90vh;border-radius:12px;background:#fff}
`;

  // ---------- 칸 만들기 ----------
  const el = document.createElement('section'); el.className = 'h5m'; el.setAttribute('aria-label', '개선 메모');
  el.innerHTML = `<div class="h5m-wt"><span class="h5m-lb">개선 메모 <button type="button" class="h5m-i" aria-label="설명 보기" aria-expanded="false">!</button><small class="h5m-tip" hidden>불편한 점 · 고칠 점 · 바라는 기능을 적어 주세요. 모두 같이 봐요</small></span><span class="h5m-pin" title="첫 화면에 고정된 칸이에요"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z"/><path d="M12 14v6"/></svg></span></div>
<form class="h5m-f" autocomplete="off" hidden><textarea rows="2" maxlength="1000" placeholder="예: 점검 화면에서 사진 올리기가 불편해요 · 마이크를 누르고 말해도 돼요" aria-label="개선 메모"></textarea>
<div class="h5m-b"><button type="button" class="h5m-mic" title="말로 적기" aria-label="말로 적기" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button><button type="submit" class="h5m-go">남기기</button><span class="h5m-msg" role="status"></span></div></form>
<div class="h5m-list"></div>`;
  const $f = el.querySelector('.h5m-f'), $t = $f.querySelector('textarea'), $mic = el.querySelector('.h5m-mic'), $go = $f.querySelector('.h5m-go'), $msg = el.querySelector('.h5m-msg'), $list = el.querySelector('.h5m-list');
  const say = (t, c) => { $msg.className = 'h5m-msg' + (c ? ' ' + c : ''); $msg.textContent = t || ''; };

  function render() {
    $f.hidden = S.phase !== 'ready' || !S.list;   // 서버가 '허브다섯메 목록'이라고 확인해 준 뒤에만 쓸 수 있어요
    if (S.phase === 'loading' || S.phase === 'off') { $list.innerHTML = '<p class="h5m-foot">메모 칸을 준비하는 중…</p>'; return; }
    if (S.phase === 'error') { $list.innerHTML = `<p class="h5m-foot">메모 칸을 불러오지 못했어요: ${esc(S.err)}</p>`; return; }
    if (S.phase === 'login' || S.phase === 'member') {
      $list.innerHTML = `<div class="h5m-gate"><b>${S.phase === 'login' ? '허브아이에 로그인한 사람만 메모를 남길 수 있어요' : '이 계정은 허브아이 직원 목록에 없어요'}</b>
<span>${S.phase === 'login' ? '이 기기에서 허브아이에 한 번 로그인해 두면 여기서 바로 써요. 새 창에서 로그인하면 이 칸도 저절로 바뀌어요.' : '사장님께 허브아이 계정을 만들어 달라고 해 주세요.'}</span>
<div class="h5m-row"><a class="h5m-go" href="${ROOT}shop/" target="_blank" rel="noopener">허브아이 로그인하러 가기</a><button type="button" class="h5m-sb" data-h5m="re">다시 확인</button></div></div>`; return; }
    if (S.phase === 'oldworker') { $list.innerHTML = '<p class="h5m-foot">카페24 중계 서버를 새로 올려야 허브다섯메 메모를 남길 수 있어요 (사장님이 Cloudflare에 새 worker.js를 붙여 넣으면 돼요)</p>'; return; }
    if (S.phase === 'noworker') { $list.innerHTML = '<p class="h5m-foot">허브아이 [연결 설정]에 카페24 중계 서버 주소가 있어야 메모가 모여요</p>'; return; }
    if (!S.list) { $list.innerHTML = '<p class="h5m-foot">메모 불러오는 중…</p>'; return; }
    const ALL = S.list.slice().reverse(), cnt = {}; ALL.forEach(x => { const k = stat(x); cnt[k] = (cnt[k] || 0) + 1; });
    const L = S.F ? ALL.filter(x => stat(x) === S.F) : [];
    const noteH = x => { const n = S.notes[String(x.no)]; if (!n || !n.t) return '<div class="h5m-note none"><b>처리 내용</b><span>아직 처리 전이에요</span></div>';
      const open = S.openN.has(x.no), I = [].concat(n.img || []).filter(Boolean);
      return `<div class="h5m-note${open ? ' open' : ''}"><button type="button" class="h5m-nh" data-h5m="n" data-no="${x.no}" aria-expanded="${open}"><b>처리 내용</b><span>AI · ${esc(n.at ? tmd(n.at) : '')}</span><i>${open ? '접기 ▴' : '상세보기 ▾'}</i></button>${open ? `<p>${fmt(n.t)}</p>${I.length ? `<div class="h5m-im">${I.map(f => `<button type="button" data-h5m="img" data-src="${esc(img(f))}" aria-label="미리보기 사진 크게 보기"><img src="${esc(img(f))}" alt="미리보기 사진" loading="lazy"></button>`).join('')}<small>사진을 누르면 크게 보여요</small></div>` : ''}` : ''}</div>`; };
    const cmH = x => { const C = x.cm || [], open = S.openCm.has(x.id);
      return `<div class="h5m-cm">${C.map(c => `<div class="h5m-c"><small><b>${esc(c.by)}</b> · ${tm(c.at)}</small><p>${esc(c.t)}</p></div>`).join('')}${open
        ? `<form class="h5m-cf" data-id="${esc(x.id)}" autocomplete="off"><textarea rows="2" maxlength="1000" placeholder="처리 내용에 이어서 의견을 적어 주세요 (예: 사진은 잘 올라가요, 순서가 반대예요)" aria-label="이어서 의견"></textarea><div class="h5m-cb"><button type="button" class="h5m-sb" data-h5m="cx" data-id="${esc(x.id)}">닫기</button><button type="submit" class="h5m-go">의견 남기기</button></div></form>`
        : `<button type="button" class="h5m-cmo" data-h5m="co" data-id="${esc(x.id)}">＋ 이어서 의견 더하기${C.length ? ' · ' + C.length + '개' : ''}</button>`}</div>`; };
    const tiles = `<div class="h5m-t" role="group" aria-label="메모 상태로 보기">${ST.map(([k, l]) => `<button type="button" class="h5m-s ${k}${S.F === k ? ' on' : ''}" data-h5m="f" data-k="${k}" aria-pressed="${S.F === k}"><b>${cnt[k] || 0}</b><span>${l}</span></button>`).join('')}</div>`;
    $list.innerHTML = !ALL.length ? '<p class="h5m-foot">아직 메모가 없어요. 첫 메모를 남겨 보세요</p>' : tiles + (!S.F ? '' : !L.length ? '<p class="h5m-foot">이 상태인 메모가 없어요</p>' : L.map(x => `<div class="h5m-it"><div class="h5m-top"><span class="h5m-chip ${stat(x)}">${SL[stat(x)]}</span></div><p>${esc(x.text)}</p><small><b>#${x.no}</b><span>${esc(x.by)}</span><span>${tm(x.at)}</span>${x.voice ? '<span>음성</span>' : ''}${mine(x) ? `<button type="button" class="h5m-del" data-h5m="del" data-id="${esc(x.id)}" title="메모 지우기" aria-label="메모 #${x.no} 지우기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button>` : ''}</small>${noteH(x)}${cmH(x)}</div>`).join(''));
  }

  // ---------- 서버 ----------
  async function call(path, opt) {
    const tok = await S.user.getIdToken(), wb = (/^https?:\/\//i.test(S.worker) ? S.worker : 'https://' + S.worker).replace(/\/+$/, '');
    const r = await fetch(wb + path + (path.includes('?') ? '&' : '?') + 'site=' + SITE, Object.assign({}, opt || {}, { headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } }));
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || ('중계 서버 오류 ' + r.status)); return d;
  }
  async function loadNotes(force) { if (!force && Date.now() - S.notesAt < 60e3) return; S.notesAt = Date.now();
    try { const r = await fetch(ROOT + 'fb_notes_farm.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) { S.notes = await r.json(); render(); } } catch (e) {} }
  async function loadList() { if (S.phase !== 'ready' && S.phase !== 'oldworker') return;
    try { const d = await call('/fb'); if (d.site !== SITE) { S.phase = 'oldworker'; S.list = null; } else { S.phase = 'ready'; S.list = d.list || []; } }   // 예전 중계 서버는 허브다섯메 메모를 따로 못 모아요 → 쓰지 않게 막아요
    catch (e) { if (!S.list) { S.phase = 'error'; S.err = e.message || e; } } render(); }

  // ---------- 허브아이 로그인 이어 받기 (Firebase) ----------
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('파일을 받지 못했어요')); document.head.appendChild(s); });
  let started = false;
  async function start() { if (started) return; started = true; S.phase = 'loading'; render();
    try {
      if (!window.firebase || !firebase.auth) { await load(`https://www.gstatic.com/firebasejs/${FBV}/firebase-app-compat.js`); await load(`https://www.gstatic.com/firebasejs/${FBV}/firebase-auth-compat.js`); await load(`https://www.gstatic.com/firebasejs/${FBV}/firebase-firestore-compat.js`); }
      if (!window.HERB5_FIREBASE) await load(ROOT + 'firebase-config.js');
      if (!firebase.apps.length) firebase.initializeApp(window.HERB5_FIREBASE);
      firebase.auth().onAuthStateChanged(onUser);
    } catch (e) { S.phase = 'error'; S.err = e.message || e; render(); }
  }
  async function onUser(u) {
    S.user = u || null; S.list = null;
    if (!u) { S.phase = 'login'; render(); return; }
    S.phase = 'loading'; render();
    try {
      const db = firebase.firestore(), m = await db.doc('members/' + String(u.email || '').toLowerCase()).get().catch(() => null);
      if (!m || !m.exists) { S.phase = 'member'; render(); return; }
      S.role = m.data().role === 'admin' ? 'admin' : 'guest';
      const rd = await db.doc('config/rules').get(), R = rd.exists && rd.data().rules;
      S.worker = (R && R.cafe24 && R.cafe24.worker) || '';
      if (!S.worker) { S.phase = 'noworker'; render(); return; }
      S.phase = 'ready'; render(); loadNotes(true); loadList();
    } catch (e) { S.phase = 'error'; S.err = e.message || e; render(); }
  }

  // ---------- 누르기 ----------
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-h5m], .h5m-i'); if (!b) return;
    if (b.classList.contains('h5m-i')) { const t = el.querySelector('.h5m-tip'); t.hidden = !t.hidden; b.setAttribute('aria-expanded', String(!t.hidden)); return; }
    const k = b.dataset.h5m;
    if (k === 'f') { S.F = S.F === b.dataset.k ? null : b.dataset.k; render(); }
    else if (k === 'n') { const no = +b.dataset.no; S.openN.has(no) ? S.openN.delete(no) : S.openN.add(no); render(); }
    else if (k === 'co') { S.openCm.add(b.dataset.id); render(); const f = el.querySelector(`.h5m-cf[data-id="${b.dataset.id}"] textarea`); if (f) f.focus(); }
    else if (k === 'cx') { S.openCm.delete(b.dataset.id); render(); }
    else if (k === 're') { if (window.firebase && firebase.auth) { const u = firebase.auth().currentUser; if (u) { await u.reload().catch(() => {}); } onUser(firebase.auth().currentUser); } else { started = false; start(); } }
    else if (k === 'img') { const m = document.createElement('div'); m.className = 'h5m-ph'; m.innerHTML = `<img alt="미리보기 사진" src="${esc(b.dataset.src)}">`; m.addEventListener('click', () => m.remove()); document.body.appendChild(m); }
    else if (k === 'del') {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.classList.add('sure'); b.title = '한 번 더 누르면 지워요'; say('한 번 더 누르면 메모를 지워요'); setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.classList.remove('sure'); b.title = '메모 지우기'; } }, 3500); return; }
      b.disabled = true; try { const d = await call('/fb/del', { method: 'POST', body: JSON.stringify({ id: b.dataset.id }) }); S.list = d.list || S.list; say('메모를 지웠어요', 'ok'); render(); } catch (er) { b.disabled = false; say('지우지 못했어요: ' + (er.message || er), 'err'); }
    }
  });
  el.addEventListener('submit', async e => {
    const cf = e.target.closest('.h5m-cf');
    if (cf) { e.preventDefault(); const ta = cf.querySelector('textarea'), t = ta.value.trim(), bt = cf.querySelector('[type=submit]'); if (!t) { ta.focus(); return; } bt.disabled = true;
      try { const d = await call('/fb/cm', { method: 'POST', body: JSON.stringify({ id: cf.dataset.id, text: t }) }); S.list = d.list || S.list; S.openCm.delete(cf.dataset.id); render(); say('의견을 남겼어요', 'ok'); }
      catch (er) { bt.disabled = false; say('남기지 못했어요: ' + (er.message || er), 'err'); } return; }
    if (e.target !== $f) return; e.preventDefault(); const t = $t.value.trim();
    if (!t) { say('메모를 적거나 마이크를 눌러 말해 주세요', 'err'); return; }
    if (S.rec) { S.rec.want = false; try { S.rec.r.stop(); } catch (er) {} }
    $go.disabled = true;
    try { const d = await call('/fb', { method: 'POST', body: JSON.stringify({ text: t, voice: S.voice }) }); S.list = d.list || S.list; $t.value = ''; S.voice = false; S.F = 'memo'; say('#' + d.no + ' 메모를 남겼어요', 'ok'); render(); }
    catch (er) { say(/404|Not Found|찾지 못한 경로/i.test(String(er.message || er)) ? '중계 서버를 새로 올려야 남길 수 있어요' : '남기지 못했어요: ' + (er.message || er), 'err'); }
    finally { $go.disabled = false; }
  });

  // ---------- 말로 적기 (허브아이와 같은 방법: 휴대폰에서 같은 말이 두 번 들어가지 않게 겹치는 문장은 하나만) ----------
  const vN = t => String(t || '').replace(/[\s.,!?·~]+/g, '').toLowerCase();
  const vMerge = segs => { const out = []; segs.forEach(s => { s = String(s || '').trim(); if (!s) return; const n = vN(s), last = out.length ? vN(out[out.length - 1]) : '';
    if (!last) { out.push(s); return; } if (n === last || last.endsWith(n) || last.includes(n)) return; if (n.startsWith(last) || n.includes(last)) { out[out.length - 1] = s; return; } out.push(s); }); return out; };
  const vJoin = (base, add) => { add = String(add || '').trim(); if (!add) return base; const b = vN(base), a = vN(add); if (b && b.endsWith(a)) return base; return (base ? base + ' ' : '') + add; };
  $mic.addEventListener('click', () => { const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (S.rec) { S.rec.want = false; try { S.rec.r.stop(); } catch (er) {} return; }
    if (!SR) { say('이 브라우저는 음성 입력을 못 해요. 휴대폰 키보드의 마이크 버튼을 써 주세요', 'err'); return; }
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const st = { want: true, base: $t.value.replace(/\s+$/, ''), r: null, tries: 0 };
    const off = () => { S.rec = null; $mic.classList.remove('on'); $mic.setAttribute('aria-pressed', 'false'); $mic.title = '말로 적기'; if (/^듣고 있어요/.test($msg.textContent)) say($t.value.trim() ? '다 적혔으면 남기기를 눌러 주세요' : ''); };
    const run = () => { const r = new SR(); st.r = r; let cur = ''; r.lang = 'ko-KR'; r.interimResults = true; r.continuous = !mobile; r.maxAlternatives = 1;
      r.onresult = ev => { const fins = [], ints = []; for (let i = 0; i < ev.results.length; i++) (ev.results[i].isFinal ? fins : ints).push(ev.results[i][0].transcript);
        let all = vMerge(fins); const it = ints.length ? ints[ints.length - 1] : ''; if (it) all = vMerge(all.concat([it])); cur = all.join(' '); $t.value = vJoin(st.base, cur); S.voice = true; st.tries = 0; };
      r.onerror = ev => { if (ev.error === 'no-speech' && st.want && mobile && st.tries < 2) return; if (ev.error === 'aborted') return; st.want = false;
        say(ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? '마이크 사용을 허락해 주세요 (주소창 옆 자물쇠 → 마이크 허용)' : ev.error === 'no-speech' ? '말소리가 들리지 않았어요. 다시 눌러 말해 주세요' : '음성 인식이 멈췄어요: ' + ev.error, 'err'); };
      r.onend = () => { st.base = vJoin(st.base, cur); $t.value = st.base; cur = ''; if (st.want && mobile) { st.tries++; if (st.tries <= 3) { try { run(); return; } catch (er) {} } } off(); };
      r.start(); };
    try { run(); } catch (er) { say('음성 인식을 시작하지 못했어요', 'err'); return; }
    S.rec = st; $mic.classList.add('on'); $mic.setAttribute('aria-pressed', 'true'); $mic.title = '그만 듣기'; say('듣고 있어요… 다 말하면 마이크를 한 번 더 눌러 주세요'); });

  // ---------- 첫 화면에 붙이기: PC는 대시보드 맨 위, 휴대폰은 첫 탭(대시보드 · 홈)일 때 맨 위 ----------
  function place() {
    const dash = document.querySelector('.admin-body > .dash');
    if (dash) { if (el.nextSibling !== dash) dash.parentNode.insertBefore(el, dash); return true; }
    const tabs = document.querySelector('.m-tabs'), mb = document.querySelector('.m-body'), first = tabs && tabs.querySelector('button');
    if (mb && first && first.classList.contains('on')) { if (mb.firstChild !== el) mb.insertBefore(el, mb.firstChild); return true; }
    if (el.parentNode) el.parentNode.removeChild(el); return false;
  }
  let q = 0; const tick = () => { q = 0; if (place()) start(); };
  const st = document.createElement('style'); st.textContent = css;
  const boot = () => { document.head.appendChild(st); new MutationObserver(() => { if (!q) q = requestAnimationFrame(tick); }).observe(document.body, { childList: true, subtree: true }); tick(); };
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
  // 1분마다 새 메모, 10분마다 처리 내용 (보고 있을 때만)
  setInterval(() => { if (!document.hidden && el.isConnected) loadList(); }, 60e3);
  setInterval(() => { if (!document.hidden && el.isConnected) loadNotes(true); }, 10 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && el.isConnected) { loadNotes(); loadList(); } });
})();
