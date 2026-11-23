// ---------- Firebase 실시간 동기화 (웹사이트용) ----------
// 아이디 · 비밀번호로 로그인해요. 계정마다 관리자/게스트가 정해져 있어서 로그인하면 저절로 구분돼요.
// 아이디는 안에서 '아이디@프로젝트.firebaseapp.com' 꼴의 이메일로 바꿔서 Firebase 로그인에 써요.
let fbUser = null, fbRole = null, fbStore = null, fbAuth = null, justLogin = false;
const ROLE_TXT = { admin: '관리자', staff: '게스트', guest: '게스트' };
function fbConfigOk() { const c = window.HERB5_FIREBASE; return !!(c && c.apiKey && c.projectId && !/여기|YOUR|붙여/.test(c.apiKey + c.projectId)); }
const idDomain = () => { const c = window.HERB5_FIREBASE || {}; return String(c.authDomain || (c.projectId + '.firebaseapp.com')).toLowerCase(); };
const idToEmail = v => { v = String(v || '').trim().toLowerCase(); return v.includes('@') ? v : v + '@' + idDomain(); };
const showId = e => { e = String(e || ''); const d = '@' + idDomain(); return e.toLowerCase().endsWith(d) ? e.slice(0, -d.length) : e; };
// Firebase는 비밀번호가 6자 이상이어야 해서, 안에서만 뒤에 고정 글자를 붙여 써요 (사람은 원래 비밀번호만 치면 돼요)
const fbPw = p => String(p) + '#h5';
const isIdEmail = e => String(e || '').toLowerCase().endsWith('@' + idDomain());
function fbErr(e) {
  const c = (e && e.code) || '';
  const M = {
    'auth/invalid-credential': '아이디 또는 비밀번호가 맞지 않아요', 'auth/wrong-password': '아이디 또는 비밀번호가 맞지 않아요', 'auth/user-not-found': '아이디 또는 비밀번호가 맞지 않아요',
    'auth/invalid-login-credentials': '아이디 또는 비밀번호가 맞지 않아요', 'auth/invalid-email': '아이디는 영문 소문자·숫자로 적어 주세요', 'auth/missing-password': '비밀번호를 넣어 주세요',
    'auth/email-already-in-use': '이미 있는 아이디예요', 'auth/weak-password': '비밀번호는 6자 이상으로 해 주세요',
    'auth/too-many-requests': '잠시 너무 많이 시도했어요. 몇 분 뒤 다시 해 주세요',
    'auth/unauthorized-domain': '이 사이트 주소가 Firebase에 등록되지 않았어요. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 이 주소를 추가해 주세요',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요', 'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인이 꺼져 있어요 (Authentication → 로그인 방법 → 이메일/비밀번호 → 사용 설정)',
    'permission-denied': '권한이 없어요'
  };
  return M[c] || ((e && e.message) || String(e));
}
function authEl() { return $('authwrap'); }
function setMsg(t, cls) { const m = $('authmsg'); if (m) { m.className = 'msg ' + (cls || ''); m.textContent = t; } }
const AIC = {
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 4.5 5.8v5.6c0 4.6 3.1 8.4 7.5 9.8 4.4-1.4 7.5-5.2 7.5-9.8V5.8z" fill="currentColor"/><path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3C10 3 4 9 4 17c0 1.2.2 2.3.5 3.3l1.6-1.6C9 12 13 9 18 7.6 13.7 10 10.6 13.3 8.3 17.5 15.5 18 20 12 20 3z" fill="currentColor"/></svg>'
};
function authShow(view, extra) {
  const w = authEl(); w.hidden = false; document.body.classList.add('authing');
  const box = $('authbody'); w.dataset.view = view;
  if (view === 'loading') { box.innerHTML = '<div class="aload"><span></span><span></span><span></span></div>'; return; }
  if (view === 'welcome') {
    const adm = extra === 'admin';
    box.innerHTML = `<div class="awel ${adm ? 'adm' : 'gst'}"><i>${adm ? AIC.shield : AIC.leaf}</i><b>${adm ? '관리자' : '게스트'}로 들어가요</b><span>${esc(showId(fbUser && fbUser.email))}</span></div>`;
    return;
  }
  if (view === 'verify') {
    box.innerHTML = `<h2>이메일 인증이 필요해요</h2><p class="help"><b>${esc(fbUser.email || '')}</b>(으)로 보낸 인증 메일의 링크를 누른 뒤 [인증했어요]를 눌러 주세요.</p>
      <div class="authbtns"><button class="abtn" id="av_done">인증했어요</button><button class="btn" id="av_again">인증 메일 다시 보내기</button><button class="btn" id="av_out">다른 아이디로 로그인</button></div><p class="msg" id="authmsg">${extra ? esc(extra) : ''}</p>`;
    $('av_done').onclick = async () => { try { await fbUser.reload(); await fbUser.getIdToken(true); handleUser(fbAuth.currentUser); } catch (e) { setMsg(fbErr(e), 'err'); } };
    $('av_again').onclick = async () => { try { await fbUser.sendEmailVerification(); setMsg('인증 메일을 다시 보냈어요', 'ok'); } catch (e) { setMsg(fbErr(e), 'err'); } };
    $('av_out').onclick = () => fbAuth.signOut();
    return;
  }
  if (view === 'denied') {
    box.innerHTML = `<h2>들어갈 수 없는 아이디예요</h2><p class="help"><b>${esc(showId(fbUser && fbUser.email))}</b> 계정은 아직 사용 허락을 받지 않았어요. 관리자에게 아이디를 받아 다시 로그인해 주세요.</p>
      <div class="authbtns"><button class="abtn" id="ad_out">다른 아이디로 로그인</button></div><p class="msg err" id="authmsg">${extra ? esc(extra) : ''}</p>`;
    $('ad_out').onclick = () => fbAuth.signOut();
    return;
  }
  box.innerHTML = `<form id="a_form" class="aform" autocomplete="on" novalidate>
      <label class="afield"><i>${AIC.user}</i><input id="a_id" name="username" placeholder="아이디" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>
      <label class="afield"><i>${AIC.lock}</i><input type="password" id="a_pw" name="password" placeholder="비밀번호" autocomplete="current-password" required><button type="button" class="aeye" id="a_eye" aria-label="비밀번호 보기" aria-pressed="false">${AIC.eye}</button></label>
      <button class="abtn" id="a_go" type="submit"><span>로그인</span></button>
    </form>
    <p class="msg" id="authmsg">${extra ? esc(extra) : ''}</p>`;
  $('a_eye').onclick = () => { const p = $('a_pw'), on = p.type === 'password'; p.type = on ? 'text' : 'password'; $('a_eye').setAttribute('aria-pressed', on); $('a_eye').classList.toggle('on', on); p.focus(); };
  $('a_form').onsubmit = async e => {
    e.preventDefault();
    const id = $('a_id').value.trim(), pw = $('a_pw').value;
    if (!id) { setMsg('아이디를 넣어 주세요', 'err'); $('a_id').focus(); return; }
    if (!pw) { setMsg('비밀번호를 넣어 주세요', 'err'); $('a_pw').focus(); return; }
    const go = $('a_go'); go.disabled = true; go.classList.add('busy'); setMsg('');
    try { justLogin = true; await fbAuth.signInWithEmailAndPassword(idToEmail(id), isIdEmail(idToEmail(id)) ? fbPw(pw) : pw); }
    catch (er) { justLogin = false; go.disabled = false; go.classList.remove('busy'); setMsg(fbErr(er), 'err'); $('a_form').classList.remove('shake'); void $('a_form').offsetWidth; $('a_form').classList.add('shake'); $('a_pw').select(); }
  };
  setTimeout(() => { const i = $('a_id'); if (i && !i.value) i.focus(); }, 60);
}
function hideAuth() { authEl().hidden = true; document.body.classList.remove('authing'); }
let fbResolve = null, fbReady = false;
function enter(role) {
  const changed = fbReady && fbRole !== role;
  fbRole = role; hideAuth();
  if (changed) { location.reload(); return; }
  applyRole();
  if (!fbReady) { fbReady = true; fbResolve(fbStore); }
  window.h5Fb = { ready: true, token: () => fbUser.getIdToken(), role: () => fbRole };
  setTimeout(() => window.dispatchEvent(new Event('h5ready')), 0);
}
async function handleUser(u) {
  fbUser = u;
  if (!u) { if (fbReady) { location.reload(); return; } authShow('login'); return; }
  if (u.isAnonymous) { try { await fbAuth.signOut(); } catch (e) { authShow('login'); } return; }   // 예전 손님(익명) 접속은 정리하고 로그인 화면으로
  const isPw = (u.providerData || []).some(p => p && p.providerId === 'password');
  if (isPw && !u.emailVerified && !isIdEmail(u.email)) { authShow('verify'); return; }
  if (!justLogin) authShow('loading');
  try {
    const snap = await fbStore.doc('members/' + String(u.email || '').toLowerCase()).get();
    if (!snap.exists) { justLogin = false; authShow('denied'); return; }
    const role = snap.data().role === 'admin' ? 'admin' : 'guest';
    if (justLogin) { justLogin = false; authShow('welcome', role); await new Promise(r => setTimeout(r, 1100)); }
    enter(role);
  } catch (e) { justLogin = false; authShow('denied', e.code === 'permission-denied' ? '' : fbErr(e)); }
}
async function herb5Firebase() {
  if (!fbConfigOk()) { webBanner('Firebase 설정(firebase-config.js)이 아직 없어서 이 기기에만 저장돼요. 안내서의 1~4단계를 마친 뒤 다시 배포해 주세요.'); return null; }
  if (!window.firebase || !firebase.firestore || !firebase.auth) { webBanner('Firebase를 불러오지 못해서 이 기기에만 저장돼요. 인터넷 연결을 확인하고 새로고침해 주세요.'); return null; }
  try { firebase.initializeApp(window.HERB5_FIREBASE); } catch (e) { if (!/already exists/.test(e.message || '')) { webBanner('Firebase 설정이 맞지 않아요: ' + (e.message || e)); return null; } }
  fbStore = firebase.firestore();
  try { fbStore.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}
  try { await fbStore.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
  fbAuth = firebase.auth();
  authShow('loading');
  return new Promise(res => { fbResolve = res; fbAuth.onAuthStateChanged(handleUser); });
}
function webBanner(t) {
  let b = document.getElementById('webbanner');
  if (!b) { b = document.createElement('div'); b.id = 'webbanner'; b.className = 'framebanner'; document.querySelector('.wrap').prepend(b); }
  b.textContent = t;
}
function applyRole() {
  document.body.classList.add('fbmode');
  document.body.classList.toggle('is-admin', fbRole === 'admin');
  document.body.classList.toggle('is-staff', fbRole !== 'admin');
  document.body.classList.toggle('is-guest', fbRole !== 'admin');
  const a = $('acct');
  a.innerHTML = `<span class="em">${esc(showId(fbUser.email || ''))}</span><span class="rl ${fbRole === 'admin' ? 'r-adm' : 'r-gst'}">${ROLE_TXT[fbRole]}</span><button class="btn sm" id="logout">로그아웃</button>`;
  a.hidden = false; a.title = showId(fbUser.email || '') + ' · ' + ROLE_TXT[fbRole];
  $('logout').onclick = () => fbAuth.signOut();
  setRulesOpen(true);   // 규칙은 게스트도 고칠 수 있어요 (내보내기·가져오기·초기화·계정 관리는 관리자만)
  const at = document.querySelector('.tab.admin'); if (at) at.title = '규칙 관리';
  const ht = document.querySelector('.tab[data-t=hist]'); if (ht && fbRole !== 'admin') { ht.title = '기록·통계 (관리자만)'; ht.setAttribute('aria-label', '기록·통계 · 관리자만'); }
  if (fbRole === 'admin') membersInit();
  else { document.querySelectorAll('[data-rsub]').forEach(b => b.classList.toggle('on', b.dataset.rsub === 'rules')); $('v-rules').classList.remove('sub-admin'); }
  if (typeof homeSoon === 'function') homeSoon();
}
// 관리자는 로그인만으로 규칙 관리가 열려요 (화면 비밀번호 대신 계정 권한으로 지켜요)
const _showLock = showLock;
showLock = function (mode) { if (fbRole) { setRulesOpen(true); return; } return _showLock(mode); };

// ---------- 계정 관리 (관리자) ----------
let membersSub = null;
function membersInit() {
  if (membersSub || !fbStore) return;
  membersSub = fbStore.collection('members').onSnapshot(qs => {
    const list = []; (qs.docs || []).forEach(d => list.push({ id: d.id, ...d.data() }));
    const rk = r => r === 'admin' ? 0 : 1;
    list.sort((a, b) => rk(a.role) - rk(b.role) || showId(a.id).localeCompare(showId(b.id)));
    const me = String(fbUser.email).toLowerCase();
    $('mlist').innerHTML = list.map(m => `<tr><td><span class="mav ${m.role === 'admin' ? 'adm' : 'gst'}">${esc(showId(m.id).slice(0, 1).toUpperCase())}</span><b>${esc(showId(m.id))}</b>${m.id === me ? ' <span class="msg">(나)</span>' : ''}</td>
      <td><select data-mrole="${esc(m.id)}" ${m.id === me ? 'disabled' : ''}><option value="guest" ${m.role !== 'admin' ? 'selected' : ''}>게스트</option><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>관리자</option></select></td>
      <td>${m.id === me ? '' : `<button class="btn sm" data-mdel="${esc(m.id)}">빼기</button>`}</td></tr>`).join('') || '<tr><td colspan="3" class="msg">아직 아무도 없어요</td></tr>';
  }, e => { $('mmsg').className = 'msg err'; $('mmsg').textContent = '계정 목록을 불러오지 못했어요: ' + fbErr(e); });
}
async function makeAccount(id, pw) {   // 지금 로그인은 그대로 두고, 따로 연 연결로 계정만 만들어요
  const app2 = firebase.initializeApp(window.HERB5_FIREBASE, 'mk' + Date.now());
  const a2 = app2.auth();
  try { await a2.setPersistence(firebase.auth.Auth.Persistence.NONE); } catch (e) {}
  try {
    try { await a2.createUserWithEmailAndPassword(idToEmail(id), fbPw(pw)); return 'new'; }
    catch (e) {
      if (e.code !== 'auth/email-already-in-use') throw e;
      // 예전에 만든 아이디를 다시 넣을 때: 비밀번호가 맞아야만 다시 허락해요 (남이 먼저 만든 아이디를 넣지 않게)
      try { await a2.signInWithEmailAndPassword(idToEmail(id), fbPw(pw)); return 'again'; }
      catch (e2) { const er = new Error('이미 있는 아이디예요. 다른 아이디로 만들거나, 그 아이디의 원래 비밀번호를 넣어 주세요'); er.code = 'x'; throw er; }
    }
  } finally { try { await a2.signOut(); } catch (e) {} try { await app2.delete(); } catch (e) {} }
}
function membersBind() {
  $('madd').onsubmit = async e => {
    e.preventDefault(); const m = $('mmsg'), id = $('mid').value.trim().toLowerCase(), pw = $('mpw').value, role = $('mrole').value;
    if (!/^[a-z0-9][a-z0-9._-]{2,19}$/.test(id)) { m.className = 'msg err'; m.textContent = '아이디는 영문 소문자·숫자로 3~20자 (예: herb5, guest1)'; return; }
    if (pw.length < 4) { m.className = 'msg err'; m.textContent = '비밀번호는 4자 이상으로 해 주세요'; return; }
    const btn = $('madd').querySelector('button[type=submit]'); btn.disabled = true; m.className = 'msg'; m.textContent = '만드는 중…';
    try {
      const how = await makeAccount(id, pw);
      await fbStore.doc('members/' + idToEmail(id)).set({ role, name: id, addedBy: fbUser.email, addedAt: new Date().toISOString() });
      m.className = 'msg ok'; m.textContent = `${id} (${ROLE_TXT[role]}) ${how === 'new' ? '계정을 만들었어요' : '계정을 다시 쓸 수 있게 했어요'}. 이 아이디와 비밀번호로 로그인하면 돼요.`;
      $('mid').value = ''; $('mpw').value = '';
    } catch (er) { m.className = 'msg err'; m.textContent = '만들지 못했어요: ' + fbErr(er); }
    finally { btn.disabled = false; }
  };
  document.addEventListener('change', async e => {
    const s = e.target.closest('[data-mrole]'); if (!s) return;
    try { await fbStore.doc('members/' + s.dataset.mrole).update({ role: s.value }); $('mmsg').className = 'msg ok'; $('mmsg').textContent = showId(s.dataset.mrole) + ' → ' + ROLE_TXT[s.value]; }
    catch (er) { $('mmsg').className = 'msg err'; $('mmsg').textContent = '바꾸지 못했어요: ' + fbErr(er); }
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-mdel]'); if (!b) return;
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '정말 뺄까요?'; b.classList.add('danger'); return; }
    try { await fbStore.doc('members/' + b.dataset.mdel).delete(); } catch (er) { $('mmsg').className = 'msg err'; $('mmsg').textContent = '빼지 못했어요: ' + fbErr(er); }
  });
}
membersBind();

// ---------- 날씨 새로고침: Open-Meteo → 모든 기기에 공유 ----------
const WX_POINTS = /*__WXPOINTS__*/{};
async function refreshWeather(manual) {
  const msg = $('wmsg'), btn = $('wrefresh');
  if (manual && wDirty && !window.__wConfirm) { window.__wConfirm = true; msg.className = 'msg err'; msg.textContent = '저장 안 한 고친 기온이 사라져요. 한 번 더 누르면 새로고침'; return; }
  window.__wConfirm = false; btn.disabled = true; msg.className = 'msg'; msg.textContent = '최신 예보 받는 중…';
  try {
    const pts = [], owner = [];
    for (const r in WX_POINTS) WX_POINTS[r].forEach(p => { pts.push(p); owner.push(r); });
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + pts.map(p => p[0]).join(',') + '&longitude=' + pts.map(p => p[1]).join(',') + '&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=6';
    let res = null, lastErr = null;
    for (let n = 0; n < 2 && !res; n++) {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
      try { res = await fetch(url, { signal: ac.signal, cache: 'no-store' }); } catch (er) { lastErr = er; if (n === 0) await new Promise(r => setTimeout(r, 1200)); } finally { clearTimeout(tm); }
    }
    if (!res) throw new Error(lastErr && lastErr.name === 'AbortError' ? '예보 서버가 15초 넘게 답하지 않아요' : '예보 서버(api.open-meteo.com)에 연결하지 못했어요. 인터넷이나 보안 프로그램을 확인해 주세요');
    if (!res.ok) throw new Error('예보 서버가 ' + res.status + ' 오류를 보냈어요');
    let js = await res.json(); if (!Array.isArray(js)) js = [js];
    if (js.length !== pts.length) throw new Error('받은 예보 개수가 맞지 않아요');
    const acc = {};
    js.forEach((o, k) => { const r = owner[k], d = o && o.daily; if (!d || !d.time) return;
      d.time.forEach((t, i) => { const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i]; if (lo == null || hi == null) return;
        const e = ((acc[t] = acc[t] || {})[r] = acc[t][r] || { lo: [], hi: [] }); e.lo.push(Math.round(lo)); e.hi.push(Math.round(hi)); }); });
    const days = {}, today = isoOf(0);
    for (const t in acc) { if (t < today) continue; days[t] = {}; for (const r in acc[t]) { const e = acc[t][r];
      days[t][r] = { min: [Math.min(...e.lo), Math.max(...e.lo)], max: [Math.min(...e.hi), Math.max(...e.hi)], src: WX_POINTS[r].length > 1 ? '권역예보' : '동네예보' }; } }
    if (!Object.keys(days).length) throw new Error('받은 예보가 비어 있어요');
    const old = (wdata && wdata.days) || {};
    for (const t in old) { if (t < today) continue; for (const r in old[t]) if (old[t][r] && old[t][r].manual) (days[t] = days[t] || {})[r] = old[t][r]; }
    const now = new Date();
    const next = { source: 'Open-Meteo 예보', issued: now.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 받음', updatedAt: now.toISOString(), by: fbUser ? fbUser.email : '', days, places: {} };
    wdata = next;
    if (weatherDoc) await weatherDoc.set(next); else { try { localStorage.setItem('cafe24weather', JSON.stringify(next)); } catch (e) {} }
    wDirty = false; edited.clear(); computeTemps(); renderWeather(); renderNeed(); if (srcRows) runProcess();
    msg.className = 'msg ok'; msg.textContent = '최신 예보를 받았어요 (' + Object.keys(days).length + '일치)' + (weatherDoc ? ' · 모든 기기에 반영' : '');
  } catch (e) { msg.className = 'msg err'; msg.textContent = '예보를 받지 못했어요: ' + (e.message || e) + ' · 지도에서 직접 고칠 수도 있어요'; }
  finally { btn.disabled = false; }
}
function webWeatherAuto() {
  $('wrefresh').onclick = () => refreshWeather(true);
  setTimeout(() => { if (navigator.onLine !== false && (!wdata || !wdata.updatedAt || Date.now() - new Date(wdata.updatedAt) > 3 * 3600e3)) refreshWeather(false); }, 2500);
}

// ---------- 예전 데이터 옮기기 (이 기기 → Firestore, 백업 후 중복·덮어쓰기 없이) ----------
const LOCAL_KEYS = ['cafe24shared_rules', 'cafe24rules', 'cafe24shared_weather', 'cafe24weather', 'herb5_history', 'herb5_uploads'];
function migKey() { return 'herb5_migrated_' + ((window.HERB5_FIREBASE && window.HERB5_FIREBASE.projectId) || ''); }
function localData() {
  const g = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const sr = g('cafe24shared_rules'), r = g('cafe24rules');
  const rulesL = (sr && sr.rules) || r || null;
  const w = g('cafe24shared_weather') || g('cafe24weather');
  const hist = g('herb5_history') || {}, uploads = g('herb5_uploads') || {};
  const today = isoOf(0); let manual = 0;
  if (w && w.days) for (const d in w.days) if (d >= today) for (const reg in w.days[d]) if (w.days[d][reg] && w.days[d][reg].manual) manual++;
  return { rules: rulesL, weather: w, history: hist, uploads, manual, hd: Object.keys(hist).length, ud: Object.keys(uploads).length };
}
const RULE_LISTS = [['names', x => x.from], ['requests', x => x.keyword], ['optionMap', x => (x.product || '') + '|' + x.from], ['fixedValues', x => x.col],
  ['summary.merge', x => x.from], ['summary.optionMerge', x => (x.product || '') + '|' + x.from], ['summary.groups', x => x.match], ['weather.regions', x => x.match],
  ['stockAlias', x => x.item], ['mallAlias', x => x.item], ['stockUnits', x => x.item], ['checkWords', x => x], ['dropColumns', x => x], ['summary.order', x => x], ['summary.bagProducts', x => x], ['optionClean.removeWords', x => x]];
function mergeRulesAdd(remote, local) {
  const out = clone(remote); let added = 0;
  const at = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const put = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => (a[k] = a[k] || {}), o); t[last] = v; };
  RULE_LISTS.forEach(([p, key]) => {
    const R = at(out, p), L = at(local, p); if (!Array.isArray(L)) return;
    const arr = Array.isArray(R) ? R.slice() : [], seen = new Set(arr.map(x => JSON.stringify(key(x))));
    L.forEach(x => { const k = JSON.stringify(key(x)); if (!seen.has(k)) { arr.push(x); seen.add(k); added++; } });
    put(out, p, arr);
  });
  return { merged: out, added };
}
function mergeHistAdd(remote, local) {
  const r = remote || { rows: [], files: [] }, map = new Map((r.rows || []).map(x => [x.k, x])); let added = 0;
  (local.rows || []).forEach(x => { if (x && x.k && !map.has(x.k)) { map.set(x.k, x); added++; } });
  const names = new Set(); const files = [...(r.files || []), ...(local.files || [])].filter(f => f && !names.has(f.name) && names.add(f.name)).slice(-20);
  const batches = Object.assign({}, local.batches || {}, r.batches || {});
  return { doc: { rows: [...map.values()], files, batches, updatedAt: new Date().toISOString() }, added };
}
async function migrateLocal(L, report) {
  const out = { hist: 0, rows: 0, upl: 0, rules: 0, weather: 0, skipped: [] };
  for (const d of Object.keys(L.history).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const ref = fbStore.doc('history/' + d);
    await fbStore.runTransaction(async tx => { const s = await tx.get(ref); const m = mergeHistAdd(s.exists ? s.data() : null, L.history[d]);
      if (!s.exists || m.added) { tx.set(ref, m.doc); out.hist++; out.rows += m.added; } });
    report(out);
  }
  for (const d of Object.keys(L.uploads).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const ref = fbStore.doc('uploads/' + d);
    await fbStore.runTransaction(async tx => { const s = await tx.get(ref), cur = s.exists ? s.data() : {}, next = Object.assign({}, cur); let ch = false;
      ['am', 'pm'].forEach(k => { if (L.uploads[d][k] && !cur[k]) { next[k] = L.uploads[d][k]; ch = true; } });
      if (ch) { next.updatedAt = new Date().toISOString(); tx.set(ref, next); out.upl++; } });
    report(out);
  }
  if (L.rules) {
    await fbStore.runTransaction(async tx => { const s = await tx.get(rulesDoc), remote = s.exists && s.data().rules;
      const base = remote || clone(DEFAULT_RULES), m = mergeRulesAdd(base, L.rules);
      if (!remote && L.rules.adminHash) m.merged.adminHash = L.rules.adminHash;
      if (!remote || m.added) { tx.set(rulesDoc, { rules: m.merged, updatedAt: new Date().toISOString(), by: fbUser.email }); out.rules = remote ? m.added : 1; } });
  }
  if (L.manual && L.weather && L.weather.days) {
    await fbStore.runTransaction(async tx => { const s = await tx.get(weatherDoc), cur = s.exists ? s.data() : { days: {}, places: {} };
      const next = clone(cur); next.days = next.days || {}; const today = isoOf(0); let n = 0;
      for (const d in L.weather.days) { if (d < today) continue; for (const reg in L.weather.days[d]) { const v = L.weather.days[d][reg];
        if (v && v.manual && !(next.days[d] && next.days[d][reg] && next.days[d][reg].manual)) { (next.days[d] = next.days[d] || {})[reg] = v; n++; } } }
      if (n) { next.updatedAt = new Date().toISOString(); tx.set(weatherDoc, next); out.weather = n; } });
  }
  return out;
}
function migCheck(force) {
  if (!fbStore) return;
  try { if (!force && localStorage.getItem(migKey())) return; } catch (e) { return; }
  const L = localData();
  const rulesDiff = L.rules ? mergeRulesAdd(rules, L.rules).added : 0;
  if (!L.hd && !L.ud && !rulesDiff && !L.manual) { if (force) { $('hbakmsg').className = 'msg'; $('hbakmsg').textContent = '이 기기에 옮길 예전 데이터가 없어요'; } else try { localStorage.setItem(migKey(), 'none'); } catch (e) {} return; }
  const items = [L.hd ? `기록·통계 <b>${L.hd}일치</b>` : '', L.ud ? `집계 보기 <b>${L.ud}일치</b>` : '', rulesDiff ? `규칙 <b>${rulesDiff}줄</b> (지금 공유 규칙에 없는 것만)` : '', L.manual ? `직접 고친 기온 <b>${L.manual}곳</b>` : ''].filter(Boolean);
  $('migbody').innerHTML = `<p>이 기기에 예전에 저장한 데이터가 있어요: ${items.join(' · ')}</p>
    <p class="msg">[백업 받고 옮기기]를 누르면 먼저 이 기기 데이터를 파일로 내려받은 뒤, 공유 저장소에 <b>없는 것만</b> 더해요. 이미 있는 기록·규칙은 바꾸지 않고, 같은 주문은 두 번 들어가지 않아요. 이 기기의 예전 데이터는 지우지 않아요.</p>
`;
  $('migmsg').textContent = ''; $('migYes').classList.remove('hidden'); $('migYes').disabled = false; $('migNo').textContent = '나중에';
  $('migModal').classList.remove('hidden');
  $('migNo').onclick = () => { $('migModal').classList.add('hidden'); try { localStorage.setItem(migKey(), 'later:' + new Date().toISOString()); } catch (e) {} };
  $('migYes').onclick = async () => {
    const m = $('migmsg'); $('migYes').disabled = true; m.className = 'msg'; m.textContent = '백업 파일 만드는 중…';
    try {
      const raw = {}; LOCAL_KEYS.concat(['herb5_reset_id']).forEach(k => { const v = localStorage.getItem(k); if (v != null) raw[k] = v; });
      await saveFile('Herb5_이기기_백업_' + isoDate(new Date()) + '.json', new Blob([JSON.stringify({ app: 'herb5-local-backup', version: 1, exportedAt: new Date().toISOString(), origin: location.origin, localStorage: raw }, null, 1)], { type: 'application/json' }));
      m.textContent = '옮기는 중…';
      const r = await migrateLocal(L, o => { m.textContent = `옮기는 중… 기록 ${o.hist}일 · 집계 ${o.upl}일`; });
      try { localStorage.setItem(migKey(), 'done:' + new Date().toISOString()); } catch (e) {}
      m.className = 'msg ok';
      m.innerHTML = `다 옮겼어요. 기록 ${r.hist}일(새 주문 줄 ${r.rows}), 집계 보기 ${r.upl}일, 규칙 ${r.rules}줄, 기온 ${r.weather}곳을 더했어요.` + (r.skipped.length ? '<br>' + r.skipped.join(' · ') : '') + '<br>백업 파일은 내려받기 폴더에 있어요.';
      $('migNo').textContent = '닫기'; $('migNo').onclick = () => $('migModal').classList.add('hidden'); $('migYes').classList.add('hidden');
    } catch (e) { m.className = 'msg err'; m.textContent = '옮기지 못했어요: ' + fbErr(e) + ' · 이 기기 데이터는 그대로 있어요. 다시 눌러 주세요.'; $('migYes').disabled = false; }
  };
}
