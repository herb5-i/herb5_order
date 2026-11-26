// Herb5 · 허브아이 — 카페24 중계 서버 (Cloudflare Worker)
// 하는 일: 카페24 Client Secret을 숨겨 두고, 토큰을 대신 갱신하고, 사이트가 요청하면 주문을 가져오고 송장번호를 등록해 줘요.
// 사이트에 로그인한 사람(Firebase 계정 목록에 있는 사람)만 쓸 수 있어요.
//
// Cloudflare 설정 (대시보드 → 이 Worker → Settings)
//   Variables:  CAFE24_MALL_ID, CAFE24_CLIENT_ID, REDIRECT_URI, FIREBASE_PROJECT, ALLOWED_ORIGIN
//   Secret:     CAFE24_CLIENT_SECRET
//   KV binding: TOKENS
//   Cron:       0 18 * * *   (매일 새벽 3시(한국)에 토큰을 미리 갱신해서 2주 만료를 막아요)

const API_VERSION = '2026-09-01';

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(req.url);
      if (req.method === 'GET' && /^\/img\/[a-z0-9]{6,24}\.png$/.test(url.pathname)) return imgGet(env, url.pathname.slice(5, -4));   // 공지 이미지는 누구나 볼 수 있어요
      if (req.method === 'GET' && url.pathname === '/fb/read') return fbRead(env, url.searchParams.get('k'));   // 개선 메모: 읽기 전용 주소(키가 맞을 때만) — Claude가 읽어요
      const who = await checkUser(req, env);                       // 로그인한 사람인지 확인
      if (url.pathname === '/status') return json(await status(env, who), cors);
      if (url.pathname === '/auth-url') { needAdmin(who); return json({ url: authUrl(env, url.searchParams.get('state') || '') }, cors); }
      if (url.pathname === '/exchange' && req.method === 'POST') { needAdmin(who); const { code } = await req.json(); return json(await exchange(env, code), cors); }
      if (url.pathname === '/orders') return json(await orders(env, url.searchParams), cors);
      if (url.pathname === '/bytrack') return json(await byTrack(env, url.searchParams), cors);
      if (url.pathname === '/fb' && req.method === 'POST') return json(await fbAdd(env, await req.json(), who), cors);
      if (url.pathname === '/fb') return json(await fbList(env), cors);
      if (url.pathname === '/fb/cm' && req.method === 'POST') return json(await fbCm(env, await req.json(), who), cors);   // 개선 메모에 이어서 의견 달기
      if (url.pathname === '/fb/del' && req.method === 'POST') return json(await fbDel(env, await req.json(), who), cors);   // 개선 메모 지우기: 쓴 사람 또는 관리자
      if (url.pathname === '/fb/st' && req.method === 'POST') { needAdmin(who); return json(await fbSt(env, await req.json()), cors); }
      if (url.pathname === '/fb/link') { needAdmin(who); return json(await fbLink(env, url, url.searchParams.get('new') === '1'), cors); }
      if (url.pathname === '/claimord') return json(await claimOrd(env, url.searchParams), cors);   // 취소 · 반품 카드 눌렀을 때 주문 정보 (결제자 이름은 화면에만, 저장 안 해요)
      if (url.pathname === '/ostmove' && req.method === 'POST') { needAdmin(who); return json(await ostMove(env, await req.json()), cors); }   // 입금전 · 상품준비중 → 배송준비중 (관리자만)
      if (url.pathname === '/ostorders') return json(await ostOrders(env, url.searchParams.get('code')), cors);   // 그 상태(배송준비중)인 주문 전부 (화면에만 보여 주고 저장 안 해요)
      if (url.pathname === '/ostids') return json(await ostIds(env, url.searchParams.get('code')), cors);   // 상태별 주문 번호 · 결제 시각만 (이름 · 연락처 없음)
      if (url.pathname === '/ostatus') return json(await ostatus(env, url.searchParams.get('fresh') === '1'), cors);
      if (url.pathname === '/reviews') return json(await reviews(env, url.searchParams), cors);
      if (url.pathname === '/claims') return json(await claims(env, url.searchParams), cors);
      if (url.pathname === '/crm') { needAdmin(who); return json(await crm(env, url.searchParams), cors); }
      if (url.pathname === '/who') { needAdmin(who); return json(await whoIs(env, url.searchParams), cors); }
      if (url.pathname === '/img' && req.method === 'POST') { needAdmin(who); return json(await imgPut(env, await req.json(), url), cors); }
      if (url.pathname === '/boards') { needAdmin(who); return json(await boards(env), cors); }
      if (url.pathname === '/notice' && req.method === 'POST') { needAdmin(who); return json(await noticePost(env, await req.json()), cors); }
      if (url.pathname === '/notice/del' && req.method === 'POST') { needAdmin(who); return json(await noticeDel(env, await req.json()), cors); }
      if (url.pathname === '/wish' && req.method === 'POST') { needAdmin(who); return json(await wish(env, await req.json()), cors); }
      if (url.pathname === '/shipments' && req.method === 'POST') return json(await shipments(env, await req.json(), who), cors);
      if (url.pathname === '/market/cfg') { if (req.method === 'POST') { needAdmin(who); return json(await mkSetCfg(env, await req.json()), cors); } return json(await mkCfgOut(env), cors); }
      if (url.pathname === '/market/trend' && req.method === 'POST') return json(await mkTrend(env, await req.json()), cors);
      if (url.pathname === '/sale/list') return json(await saleList(env, url.searchParams), cors);   // 판매 관리: 상품 · 옵션 목록 (100개씩)
      if (url.pathname === '/sale/one') return json(await saleOne(env, url.searchParams.get('no')), cors);   // 판매 관리: 상품 하나 (수정 창 열 때 수량까지 새로)
      if (url.pathname === '/sale/cats') return json(await saleCats(env, url.searchParams.get('fresh') === '1'), cors);   // 판매 관리: 카테고리 → 상품번호
      if (url.pathname === '/sale/save' && req.method === 'POST') { needAdmin(who); return json(await saleSave(env, await req.json()), cors); }   // 품절 · 판매 재개 · 가격 · 수량 (관리자만)
      if (url.pathname === '/disconnect' && req.method === 'POST') { needAdmin(who); await env.TOKENS.delete('tok'); return json({ ok: true }, cors); }
      return json({ error: 'not_found' }, cors, 404);
    } catch (e) {
      return json({ error: e.code || 'error', message: e.message || String(e) }, cors, e.status || 500);
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(refresh(env).catch(() => {})); }
};

function corsHeaders(req, env) {
  const o = req.headers.get('Origin') || '', allow = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  return { 'Access-Control-Allow-Origin': allow.includes(o) ? o : (allow[0] || ''), 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin' };
}
const json = (data, cors, status = 200) => new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors) });
const fail = (status, code, message) => { const e = new Error(message); e.status = status; e.code = code; return e; };

// ---------- 사이트 로그인 확인: 그 사람의 Firebase 토큰으로 자기 계정 문서(members/이메일)를 읽어 봐요 ----------
async function checkUser(req, env) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/); if (!m) throw fail(401, 'login', '사이트에 로그인해 주세요');
  const tok = m[1], p64 = (tok.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'), payload = JSON.parse(decodeURIComponent(escape(atob(p64 + '='.repeat((4 - p64.length % 4) % 4)))));
  const email = String(payload.email || '').toLowerCase(); if (!email) throw fail(401, 'login', '로그인 정보를 확인할 수 없어요');
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/members/${encodeURIComponent(email)}`, { headers: { Authorization: 'Bearer ' + tok } });
  if (!r.ok) throw fail(403, 'member', '이 계정은 사용할 수 없어요');
  const doc = await r.json(), role = doc.fields && doc.fields.role && doc.fields.role.stringValue;
  return { email, role: role === 'admin' ? 'admin' : 'guest' };
}
const needAdmin = who => { if (who.role !== 'admin') throw fail(403, 'admin', '관리자만 할 수 있어요'); };

// ---------- 카페24 토큰 ----------
const base = env => `https://${env.CAFE24_MALL_ID}.cafe24api.com/api/v2`;
const basic = env => 'Basic ' + btoa(env.CAFE24_CLIENT_ID + ':' + env.CAFE24_CLIENT_SECRET);
function authUrl(env, state) {
  const u = new URL(base(env) + '/oauth/authorize');
  u.searchParams.set('response_type', 'code'); u.searchParams.set('client_id', env.CAFE24_CLIENT_ID);
  u.searchParams.set('state', state); u.searchParams.set('redirect_uri', env.REDIRECT_URI);
  u.searchParams.set('scope', 'mall.read_order mall.write_order mall.read_shipping mall.read_community mall.write_community mall.read_product mall.write_product mall.read_category');
  u.searchParams.set('prompt', 'consent');   // 권한을 새로 더했을 때도 동의 화면을 다시 띄워서 새 권한을 받아요
  return u.toString();
}
async function tokenCall(env, body) {
  const r = await fetch(base(env) + '/oauth/token', { method: 'POST', headers: { Authorization: basic(env), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) throw fail(400, 'cafe24_token', '카페24 토큰을 받지 못했어요: ' + (t.error_description || t.error || r.status));
  await env.TOKENS.put('tok', JSON.stringify(t));
  return t;
}
async function exchange(env, code) {
  if (!code) throw fail(400, 'code', '인증 코드가 없어요');
  const t = await tokenCall(env, { grant_type: 'authorization_code', code, redirect_uri: env.REDIRECT_URI });
  return { ok: true, mall: t.mall_id, scopes: t.scopes, refresh_expires: t.refresh_token_expires_at };
}
async function refresh(env) {
  const t = JSON.parse((await env.TOKENS.get('tok')) || 'null'); if (!t) return null;
  return tokenCall(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
}
const kst = s => new Date(String(s).replace(' ', 'T') + (/[+Z]/.test(String(s).slice(10)) ? '' : '+09:00')); // 카페24 시간은 한국 시간
async function accessToken(env) {
  let t = JSON.parse((await env.TOKENS.get('tok')) || 'null');
  if (!t) throw fail(409, 'not_connected', '카페24가 아직 연결되지 않았어요. 관리자가 [카페24 연결]을 눌러 주세요');
  if (kst(t.expires_at) - Date.now() < 5 * 60e3) {
    if (kst(t.refresh_token_expires_at) < Date.now()) throw fail(409, 'expired', '카페24 연결이 끝났어요(2주 동안 안 씀). 관리자가 다시 [카페24 연결]을 눌러 주세요');
    t = await refresh(env);
  }
  return t.access_token;
}
async function status(env, who) {
  const t = JSON.parse((await env.TOKENS.get('tok')) || 'null');
  return { role: who.role, connected: !!t && kst(t.refresh_token_expires_at) > Date.now(), mall: env.CAFE24_MALL_ID, refresh_expires: t ? t.refresh_token_expires_at : null, scopes: t ? t.scopes || [] : [] };
}

// ---------- 주문 가져오기: 결제일시 from ≤ t < to ----------
async function orders(env, q) {
  const from = new Date(q.get('from')), to = new Date(q.get('to'));
  if (isNaN(from) || isNaN(to) || to <= from) throw fail(400, 'range', '기간이 맞지 않아요');
  const day = d => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜
  const token = await accessToken(env), out = [];
  const one = q.has('offset'), lim = one ? Math.min(500, Math.max(50, Number(q.get('limit')) || 200)) : 1000, lite = q.get('lite') === '1';
  for (let offset = one ? Math.max(0, Number(q.get('offset')) || 0) : 0; offset <= 15000; offset += lim) {
    const u = new URL(base(env) + '/admin/orders');
    u.searchParams.set('date_type', 'pay_date'); u.searchParams.set('start_date', day(from)); u.searchParams.set('end_date', day(to));
    u.searchParams.set('embed', lite ? 'items' : 'items,receivers,buyer'); u.searchParams.set('limit', String(lim)); u.searchParams.set('offset', String(offset));
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 주문을 가져오지 못했어요: ' + ((d.error && d.error.message) || r.status));
    const list = d.orders || [];
    list.forEach(o => {
      if (o.paid !== 'T' || o.canceled === 'T' || !o.payment_date) return;
      const t = kst(o.payment_date); if (t < from || t >= to) return;
      const rc = (o.receivers || [])[0] || {}, by = o.buyer || {};
      out.push({
        order_id: o.order_id, order_date: o.order_date, payment_date: o.payment_date,
        payment_method: o.payment_method || [], payment_method_name: o.payment_method_name || [], order_place_id: o.order_place_id || '', market_id: o.market_id || '', order_place_name: o.order_place_name || '',
        buyer: { name: by.name || '', phone: by.phone || '', cellphone: by.cellphone || '', zipcode: by.buyer_zipcode || '', address1: by.buyer_address1 || '', address2: by.buyer_address2 || '' },
        receiver: { name: rc.name || '', phone: rc.phone || '', cellphone: rc.cellphone || '', virtual_phone_no: rc.virtual_phone_no || '', zipcode: rc.zipcode || '', address1: rc.address1 || '', address2: rc.address2 || '', shipping_message: rc.shipping_message || '' },
        items: (o.items || []).filter(i => !/^[CR]/.test(i.order_status || '')).map(i => ({ order_item_code: i.order_item_code, product_name: i.product_name, custom_variant_code: i.custom_variant_code || '', option_value: i.option_value || '', additional_option_value: i.additional_option_value || '', quantity: Number(i.quantity) || 0, product_price: Number(i.product_price) || 0, option_price: Number(i.option_price) || 0, order_status: i.order_status || '' }))
      });
    });
    if (one) return { orders: out, count: out.length, next: list.length < lim || offset + lim > 15000 ? null : offset + lim };
    if (list.length < lim) break;
  }
  return { orders: out, count: out.length, from: from.toISOString(), to: to.toISOString() };
}

// ---------- 고객 관리: 주문을 고객별로 묶을 수 있게 (고객 번호는 해시 · 이름은 관리자 화면 표시용 · 연락처 · 상세 주소는 안 보내요) ----------
async function h16(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('herb5-crm|' + t)); return [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }
const crmNorm = t => String(t || '').replace(/\s+/g, '').replace(/[()\-,.]/g, '').toLowerCase();
const SIDO = { '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기', '강원도': '강원', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '전라북도': '전북', '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주' };
function crmRegion(a) { const t = String(a || '').trim().split(/\s+/); if (!t[0]) return ''; const s = SIDO[t[0]] || t[0].replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, ''); return s === '세종' ? '세종' : (s + ' ' + (t[1] || '')).trim(); }
async function crm(env, q) {
  const from = new Date(q.get('from')), to = new Date(q.get('to'));
  if (isNaN(from) || isNaN(to) || to <= from) throw fail(400, 'range', '기간이 맞지 않아요');
  const day = d => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const token = await accessToken(env), lim = 200, offset = Math.max(0, Number(q.get('offset')) || 0), out = [];
  const u = new URL(base(env) + '/admin/orders');
  u.searchParams.set('date_type', 'pay_date'); u.searchParams.set('start_date', day(from)); u.searchParams.set('end_date', day(to));
  u.searchParams.set('embed', 'items,receivers,buyer'); u.searchParams.set('limit', String(lim)); u.searchParams.set('offset', String(offset));
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 주문을 가져오지 못했어요: ' + ((d.error && d.error.message) || r.status));
  const list = d.orders || [];
  for (const o of list) {
    if (o.paid !== 'T' || o.canceled === 'T' || !o.payment_date) continue;
    const t = kst(o.payment_date); if (t < from || t >= to) continue;
    const rc = (o.receivers || [])[0] || {}, by = o.buyer || {};
    const its = (o.items || []).filter(i => !/^[CR]/.test(i.order_status || ''));
    if (!its.length) continue;
    const mem = String(o.member_id || '').trim();
    const cid = mem ? 'm' + await h16('m|' + mem) : 'g' + await h16(crmNorm(rc.address1) + '|' + crmNorm(rc.name || by.name));
    const ph = String(rc.cellphone || rc.phone || '').replace(/\D/g, '');
    const bn = String(by.name || '').trim(), rn = String(rc.name || '').trim();
    out.push({ i: o.order_id, d: day(t), c: cid, nm: bn || rn, rn: rn && rn !== bn ? rn : '', market_id: o.market_id || '', order_place_id: o.order_place_id || '', order_place_name: o.order_place_name || '', r: crmRegion(rc.address1), l4: ph.length >= 8 && !/^050/.test(ph) ? ph.slice(-4) : '',
      a: its.reduce((s, i) => s + ((Number(i.product_price) || 0) + (Number(i.option_price) || 0)) * (Number(i.quantity) || 0), 0),
      it: its.map(i => [i.product_name || '', i.option_value || '', Number(i.quantity) || 0]) });
  }
  return { orders: out, next: list.length < lim || offset + lim > 15000 ? null : offset + lim };
}
// 고객 카드에서 [이름 · 연락처 보기]를 누를 때만: 그 주문의 주문자 · 수령인을 보여주고 어디에도 저장하지 않아요
// ---------- 개선 메모 (홈 화면 고정 칸): 직원이 적은 불편한 점 · 바라는 점. KV 'fb'에 모아 둬요 ----------
const FB_ST = { new: '새 메모', seen: '확인함', done: '반영함' };
const fbGet = async env => JSON.parse((await env.TOKENS.get('fb')) || '[]');
const fbKst = iso => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
async function fbAdd(env, body, who) {
  const text = String((body && body.text) || '').trim().slice(0, 1000); if (!text) throw fail(400, 'empty', '메모를 적어 주세요');
  const L = await fbGet(env), no = L.reduce((m, x) => Math.max(m, x.no || 0), 0) + 1;
  L.push({ id: 'f' + Date.now().toString(36), no, text, by: who.email.split('@')[0], at: new Date().toISOString(), st: 'new', voice: !!(body && body.voice) });
  await env.TOKENS.put('fb', JSON.stringify(L.slice(-500))); return { ok: true, no, list: L.slice(-500) };
}
async function fbList(env) { return { list: await fbGet(env) }; }
async function fbCm(env, body, who) {
  const t = String((body && body.text) || '').trim().slice(0, 1000); if (!t) throw fail(400, 'empty', '의견을 적어 주세요');
  const L = await fbGet(env), x = L.find(v => v.id === (body && body.id)); if (!x) throw fail(404, 'none', '메모를 찾지 못했어요');
  x.cm = (x.cm || []).concat([{ by: who.email.split('@')[0], at: new Date().toISOString(), t, voice: !!(body && body.voice) }]).slice(-50); x.cmNew = true;
  await env.TOKENS.put('fb', JSON.stringify(L)); return { ok: true, list: L };
}
async function fbDel(env, body, who) {
  const L = await fbGet(env), i = L.findIndex(v => v.id === (body && body.id)); if (i < 0) throw fail(404, 'none', '메모를 찾지 못했어요');
  if (who.role !== 'admin' && L[i].by !== who.email.split('@')[0]) throw fail(403, 'own', '내가 쓴 메모만 지울 수 있어요');
  L.splice(i, 1); await env.TOKENS.put('fb', JSON.stringify(L)); return { ok: true, list: L };
}
async function fbSt(env, body) {
  const L = await fbGet(env), x = L.find(v => v.id === (body && body.id)); if (!x) throw fail(404, 'none', '메모를 찾지 못했어요');
  if (!FB_ST[body.st]) throw fail(400, 'st', '상태가 맞지 않아요'); x.st = body.st; x.stAt = new Date().toISOString();
  await env.TOKENS.put('fb', JSON.stringify(L)); return { ok: true, list: L };
}
async function fbLink(env, url, renew) {
  let k = await env.TOKENS.get('fbkey');
  if (!k || renew) { const b = new Uint8Array(18); crypto.getRandomValues(b); k = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); await env.TOKENS.put('fbkey', k); }
  return { url: url.origin + '/fb/read?k=' + k };
}
async function fbRead(env, k) {
  const key = await env.TOKENS.get('fbkey'), head = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (!key || !k || k !== key) return new Response('주소가 맞지 않아요', { status: 403, headers: head });
  const L = (await fbGet(env)).slice().reverse(), n = L.filter(x => x.st === 'new').length;
  const txt = `허브아이 사이트 개선 메모 · 총 ${L.length}건 · 새 메모 ${n}건 · ${fbKst(new Date().toISOString())} 기준 (한국 시간)\n\n` +
    L.map(x => `#${x.no} [${FB_ST[x.st] || x.st}] ${fbKst(x.at)} · ${x.by}${x.voice ? ' · 음성' : ''}\n${x.text}\n` + (x.cm || []).map(c => `  └ 이어서 의견 · ${fbKst(c.at)} · ${c.by}${c.voice ? ' · 음성' : ''}\n    ${c.t}\n`).join('')).join('\n');
  return new Response(txt || '아직 메모가 없어요', { headers: head });
}

// ---------- 택배 사고: 송장번호로 카페24 주문 찾기 (받는 분 · 주문자 이름 · 전화 · 주소는 돌려주지 않아요) ----------
const OST_NAME = { N00: '입금전', N10: '상품준비중', N20: '배송준비중', N21: '배송대기', N22: '배송보류', N30: '배송중', N40: '배송완료', N50: '구매확정' };
async function byTrack(env, q) {
  const no = String(q.get('no') || '').replace(/[^0-9A-Za-z]/g, ''); if (no.length < 8) throw fail(400, 'track', '송장번호를 확인해 주세요');
  const days = Math.min(90, Math.max(7, Number(q.get('days')) || 45)), day = d => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const token = await accessToken(env), to = new Date(Date.now() + 864e5), from = new Date(Date.now() - days * 864e5), lim = 1000;
  const num = v => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? null : Number(v);
  for (let offset = 0, n = 0; offset <= 15000 && n < 30; offset += lim, n++) {
    const u = new URL(base(env) + '/admin/orders');
    u.searchParams.set('date_type', 'pay_date'); u.searchParams.set('start_date', day(from)); u.searchParams.set('end_date', day(to));
    u.searchParams.set('embed', 'items'); u.searchParams.set('limit', String(lim)); u.searchParams.set('offset', String(offset));
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 주문을 가져오지 못했어요: ' + ((d.error && d.error.message) || r.status));
    const list = d.orders || [];
    const o = list.find(x => (x.items || []).some(i => String(i.tracking_no || '').replace(/[^0-9A-Za-z]/g, '') === no));
    if (o) {
      const a = o.actual_order_amount || o.initial_order_amount || {}, items = (o.items || []).map(i => ({
        product_name: i.product_name || '', option_value: i.option_value || '', quantity: Number(i.quantity) || 0, product_price: Number(i.product_price) || 0, option_price: Number(i.option_price) || 0,
        order_status: i.order_status || '', status_name: OST_NAME[i.order_status] || (/^C/.test(i.order_status || '') ? '취소' : /^R/.test(i.order_status || '') ? '반품' : /^E/.test(i.order_status || '') ? '교환' : (i.order_status || '')),
        tracking_no: i.tracking_no || '', shipping_company_name: i.shipping_company_name || '', order_item_code: i.order_item_code || '', hit: String(i.tracking_no || '').replace(/[^0-9A-Za-z]/g, '') === no }));
      const price = num(a.order_price_amount) ?? items.reduce((t, i) => t + (i.product_price + i.option_price) * i.quantity, 0), ship = num(a.shipping_fee) ?? num(o.shipping_fee), pay = num(o.payment_amount) ?? num(a.payment_amount);
      return { found: true, order: { order_id: o.order_id, order_date: o.order_date || '', payment_date: o.payment_date || '', order_place_name: o.order_place_name || '', market_id: o.market_id || '',
        payment_method_name: o.payment_method_name || [], price, shipping_fee: ship, payment: pay, discount: price !== null && pay !== null ? Math.max(0, price + (ship || 0) - pay) : null, items } };
    }
    if (list.length < lim) break;
  }
  return { found: false, days };
}
async function claimOrd(env, q) {
  const id = String(q.get('order_id') || '').replace(/[^0-9A-Za-z\-]/g, ''), code = String(q.get('item') || ''); if (!id) throw fail(400, 'order', '주문번호가 없어요');
  const token = await accessToken(env), num = v => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? null : Number(v);
  const d = await c24get(env, token, '/admin/orders/' + id, { embed: 'items,buyer' }, '주문(Order) 읽기'), o = d.order || {};
  const a = o.actual_order_amount || o.initial_order_amount || {}, by = o.buyer || {};
  const items = (o.items || []).map(i => ({ order_item_code: i.order_item_code || '', shipping_code: i.shipping_code || '', product_name: i.product_name || '', option_value: i.option_value || '', quantity: Number(i.quantity) || 0,
    product_price: Number(i.product_price) || 0, option_price: Number(i.option_price) || 0, order_status: i.order_status || '', status_text: i.order_status_additional_info || '', claim_by: i.claim_type || '',
    tracking_no: i.tracking_no || '', shipping_company_name: i.shipping_company_name || '', hit: !!code && i.order_item_code === code }));
  const price = num(a.order_price_amount) ?? items.reduce((t, i) => t + (i.product_price + i.option_price) * i.quantity, 0), ship = num(a.shipping_fee) ?? num(o.shipping_fee), pay = num(o.payment_amount) ?? num(a.payment_amount);
  return { order: { order_id: o.order_id || id, order_date: o.order_date || '', payment_date: o.payment_date || '', order_place_name: o.order_place_name || '', market_id: o.market_id || '',
    payment_method_name: o.payment_method_name || [], payer: o.billing_name || by.name || '', price, shipping_fee: ship, payment: pay, discount: price !== null && pay !== null ? Math.max(0, price + (ship || 0) - pay) : null, items } };
}
async function whoIs(env, q) {
  const id = String(q.get('order_id') || '').replace(/[^0-9A-Za-z\-]/g, ''); if (!id) throw fail(400, 'order', '주문번호가 없어요');
  const token = await accessToken(env);
  const r = await fetch(base(env) + '/admin/orders/' + id + '?embed=receivers,buyer', { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 주문을 찾지 못했어요');
  const o = d.order || {}, rc = (o.receivers || [])[0] || {}, by = o.buyer || {};
  return { buyer: by.name || '', receiver: rc.name || '', phone: rc.cellphone || rc.phone || by.cellphone || '', address: [rc.address1, rc.address2].filter(Boolean).join(' '), member: o.member_id || '' };
}

// ---------- 송장번호 등록: 100건씩 묶어서 보내고, 묶음이 실패하면 한 건씩 다시 보내서 어느 주문이 문제인지 알려 줘요 ----------
async function shipments(env, body, who) {
  const list = Array.isArray(body && body.items) ? body.items : [], status = body && body.status === 'standby' ? 'standby' : 'shipping';
  if (!list.length) throw fail(400, 'empty', '등록할 송장이 없어요');
  if (list.length > 2000) throw fail(400, 'too_many', '한 번에 2000건까지만 등록할 수 있어요');
  const token = await accessToken(env), ok = [], bad = [], carrier = await carrierOf(env, token, list[0] && list[0].shipping_company_code);
  const reqOf = x => { const r = { order_id: String(x.order_id), tracking_no: String(x.tracking_no).replace(/[^0-9A-Za-z]/g, ''), shipping_company_code: carrier.code, carrier_id: carrier.id, status };
    if (Array.isArray(x.order_item_code) && x.order_item_code.length) r.order_item_code = x.order_item_code.map(String); return r; };
  const send = async reqs => {
    const r = await fetch(base(env) + '/admin/shipments', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION }, body: JSON.stringify({ shop_no: 1, requests: reqs }) });
    const d = await r.json().catch(() => ({})); return { okr: r.ok, status: r.status, d };
  };
  const msgOf = d => (d && d.error && (d.error.message || d.error.code)) || '';
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100).map(reqOf), r = await send(chunk);
    if (r.okr) { chunk.forEach(x => ok.push(x.order_id)); continue; }
    if (r.status === 401 || r.status === 403) throw fail(r.status, 'cafe24', '카페24가 송장 등록을 거절했어요: ' + (msgOf(r.d) || r.status) + ' (앱 권한에 주문 쓰기가 있는지 확인해 주세요)');
    for (const x of chunk) {   // 묶음 실패 → 한 건씩
      const one = await send([x]);
      if (one.okr) ok.push(x.order_id); else bad.push({ order_id: x.order_id, tracking_no: x.tracking_no, message: msgOf(one.d) || ('오류 ' + one.status) });
      await new Promise(res => setTimeout(res, 60));
    }
  }
  return { ok: ok.length, fail: bad, status, by: who.email };
}

// 사이트에 넣는 [배송 업체 번호](카페24 엑셀 일괄배송 화면의 6, 4 같은 번호 = carrier_id)를
// API가 원하는 배송업체 코드(0006 같은 4자리)로 바꿔요. 쇼핑몰 배송사 목록을 읽어서 맞춰요.
async function carrierOf(env, token, raw) {
  const v = String(raw || '').trim(); if (!v) throw fail(400, 'carrier', '배송 업체 번호를 넣어 주세요');
  const cacheKey = 'carriers', cached = JSON.parse((await env.TOKENS.get(cacheKey)) || 'null');
  let list = cached && Date.now() - cached.at < 864e5 ? cached.list : null;
  if (!list) {
    const r = await fetch(base(env) + '/admin/carriers', { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) throw fail(403, 'scope_shipping', '카페24 앱에 [배송 읽기] 권한이 필요해요. 개발자센터에서 권한을 추가하고, 사이트에서 [카페24 연결]을 다시 눌러 주세요');
    if (!r.ok) throw fail(r.status, 'cafe24', '카페24 배송사 목록을 읽지 못했어요: ' + ((d.error && d.error.message) || r.status));
    list = (d.carriers || []).map(c => ({ id: Number(c.carrier_id), code: String(c.shipping_carrier_code || ''), name: c.shipping_carrier || '' }));
    await env.TOKENS.put(cacheKey, JSON.stringify({ at: Date.now(), list }));
  }
  const n = Number(v), hit = list.find(c => c.id === n && !/^0\d{3}$/.test(v)) || list.find(c => c.code === v) || list.find(c => c.id === n);
  if (!hit) throw fail(400, 'carrier', '배송 업체 번호 ' + v + '번을 쇼핑몰 배송사 목록에서 찾지 못했어요. 있는 번호: ' + list.map(c => c.id + '(' + c.name + ')').join(', '));
  return hit;
}

// ---------- 취소 · 반품 · 교환: 신청일이 그날인 주문의 해당 품목 ----------
async function claims(env, q) {
  const day = String(q.get('day') || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw fail(400, 'day', '날짜가 맞지 않아요');
  const token = await accessToken(env), out = [];
  const T = [['cancel', 'cancel_request_date', 'C', 'cancellation'], ['return', 'return_request_date', 'R', 'return'], ['exchange', 'exchange_request_date', 'E', 'exchange']];
  const pick = (o, ks) => { for (const k of ks) if (o && o[k] != null && String(o[k]).trim()) return String(o[k]).trim(); return ''; };
  const RK = ['claim_reason', 'reason', 'claim_reason_type_text', 'claim_reason_type', 'cancel_reason', 'return_reason', 'exchange_reason'];
  for (const [type, dt, pre, emb] of T) {
    for (let offset = 0; offset <= 15000; offset += 500) {
      const u = new URL(base(env) + '/admin/orders');
      u.searchParams.set('date_type', dt); u.searchParams.set('start_date', day); u.searchParams.set('end_date', day);
      u.searchParams.set('embed', 'items,' + emb); u.searchParams.set('limit', '500'); u.searchParams.set('offset', String(offset));
      const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 취소·반품·교환을 가져오지 못했어요: ' + ((d.error && d.error.message) || r.status));
      const list = d.orders || [];
      list.forEach(o => {
        const cl = [].concat(o[emb] || []), creason = cl.map(c => pick(c, RK)).find(Boolean) || '';
        const allI = o.items || [];
        allI.filter(i => String(i.order_status || '').startsWith(pre) || String(i.claim_type || '').toUpperCase().startsWith(pre)).forEach(i => {
          const ci = cl.find(c => [].concat(c.items || []).some(x => x.order_item_code === i.order_item_code)) || {};
          out.push({ type, day, order_id: o.order_id, order_item_code: i.order_item_code, product_name: i.product_name, option_value: i.option_value || '', quantity: Number(i.claim_quantity || i.quantity) || 0,
            status: i.order_status || '', tracking_no: i.tracking_no || '', shipping_company_name: i.shipping_company_name || '', item_no: allI.indexOf(i) + 1, item_count: allI.length, reason: pick(i, RK) || pick(ci, RK) || creason, market_id: o.market_id || '', order_place_id: o.order_place_id || '', order_place_name: o.order_place_name || '' });
        });
      });
      if (list.length < 500) break;
    }
  }
  return { day, claims: out };
}

// ---------- 주문 처리 현황: 상태별 주문 수만 (개인정보 없음) · 9분 동안 같은 값을 나눠 써요 (KV 쓰기 하루 160번 이하) ----------
const OST = [['N00', '입금전'], ['N10', '상품준비중'], ['N22', '배송보류중'], ['N20', '배송준비중'], ['N21', '배송대기'], ['N30', '배송중']];
let ostMem = null;
async function ostatus(env, fresh) {
  const ok = h => h && Date.now() - h.t < (fresh ? 60e3 : 540e3);
  if (ok(ostMem)) return ostMem;
  const hit = JSON.parse((await env.TOKENS.get('ost')) || 'null'); if (ok(hit)) { ostMem = hit; return hit; }
  const token = await accessToken(env), day = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10), now = Date.now();
  const params = { start_date: day(now - 89 * 864e5), end_date: day(now), date_type: 'order_date' };
  const counts = {};
  await Promise.all(OST.map(async ([code]) => { const d = await c24get(env, token, '/admin/orders/count', Object.assign({ order_status: code }, params), '주문(Order) 읽기'); counts[code] = Number(d.count) || 0; }));
  const out = { t: now, at: new Date(now).toISOString(), from: params.start_date, counts, labels: Object.fromEntries(OST) };
  ostMem = out; await env.TOKENS.put('ost', JSON.stringify(out), { expirationTtl: 3600 }).catch(() => {});
  return out;
}

// 들어온 주문과 맞춰 보기: 그 상태(예: 배송준비중)인 주문 번호 · 결제 시각 · 주문 경로만 보내요
async function ostIds(env, code) {
  code = String(code || 'N20'); if (!OST.some(([c]) => c === code)) throw fail(400, 'code', '주문 상태 코드가 맞지 않아요');
  const token = await accessToken(env), day = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10), now = Date.now(), out = [];
  for (let offset = 0; offset < 3000; offset += 500) {
    const d = await c24get(env, token, '/admin/orders', { start_date: day(now - 89 * 864e5), end_date: day(now), date_type: 'order_date', order_status: code, limit: 500, offset }, '주문(Order) 읽기');
    const L = d.orders || []; L.forEach(o => out.push({ i: o.order_id, p: o.payment_date || '', pl: o.order_place_id || '' })); if (L.length < 500) break;
  }
  return { code, at: new Date(now).toISOString(), list: out };
}

async function ostOrders(env, code) {
  code = String(code || 'N20'); if (!OST.some(([c]) => c === code)) throw fail(400, 'code', '주문 상태 코드가 맞지 않아요');
  const token = await accessToken(env), day = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10), now = Date.now(), out = [];
  for (let offset = 0; offset < 2000; offset += 200) {
    const d = await c24get(env, token, '/admin/orders', { start_date: day(now - 89 * 864e5), end_date: day(now), date_type: 'order_date', order_status: code, embed: 'items,receivers,buyer', limit: 200, offset }, '주문(Order) 읽기');
    const L = d.orders || [];
    L.forEach(o => { if (o.canceled === 'T') return; const rc = (o.receivers || [])[0] || {}, by = o.buyer || {};
      const items = (o.items || []).filter(i => (i.order_status || '') === code).map(i => ({ order_item_code: i.order_item_code, product_name: i.product_name, option_value: i.option_value || '', additional_option_value: i.additional_option_value || '', quantity: Number(i.quantity) || 0, product_price: Number(i.product_price) || 0, option_price: Number(i.option_price) || 0 }));
      if (!items.length) return;
      out.push({ order_id: o.order_id, order_date: o.order_date, payment_date: o.payment_date, payment_method: o.payment_method || [], payment_amount: o.payment_amount || (o.actual_order_amount && o.actual_order_amount.payment_amount) || '', payer_name: code === 'N00' ? (o.payer_name || '') : '', order_place_id: o.order_place_id || '', market_id: o.market_id || '', order_place_name: o.order_place_name || '',
        buyer: { name: by.name || '' }, receiver: { name: rc.name || '', phone: rc.phone || '', cellphone: rc.cellphone || '', virtual_phone_no: rc.virtual_phone_no || '', zipcode: rc.zipcode || '', address1: rc.address1 || '', address2: rc.address2 || '' }, items }); });
    if (L.length < 200) break;
  }
  return { code, at: new Date(now).toISOString(), orders: out, count: out.length };
}

// ---------- 상품 후기: 후기 게시판 글 + 상품 이름 (작성자 이름·이메일은 보내지 않아요) ----------
async function c24get(env, token, path, params, need) {
  const u = new URL(base(env) + path); Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw fail(403, 'scope_review', '카페24 앱에 [' + (need || '게시판 읽기') + '] 권한이 없어요. 개발자센터 → 앱 → 권한에서 ' + (need || '게시판 읽기') + '을 추가하고 저장한 뒤, 사이트에서 [카페24 연결]을 다시 눌러 동의해 주세요 (' + ((d.error && d.error.message) || r.status) + ')');
  if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 가져오지 못했어요: ' + ((d.error && d.error.message) || r.status));
  return d;
}
async function reviewBoards(env, token) {
  const c = JSON.parse((await env.TOKENS.get('rboards')) || 'null'); if (c && Date.now() - c.at < 7 * 864e5) return c.list;
  const d = await c24get(env, token, '/admin/boards', {}, '게시판(Community) 읽기');
  let list = (d.boards || []).filter(b => /후기|리뷰|review/i.test(String(b.board_name || '')) || String(b.board_type) === '4' || Number(b.board_no) === 4).map(b => ({ no: Number(b.board_no), name: b.board_name || '' }));
  if (!list.length) list = [{ no: 4, name: '상품 사용후기' }];
  await env.TOKENS.put('rboards', JSON.stringify({ at: Date.now(), list })); return list;
}
async function reviews(env, q) {
  const from = String(q.get('from') || ''), to = String(q.get('to') || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw fail(400, 'range', '기간이 맞지 않아요');
  const token = await accessToken(env), boards = await reviewBoards(env, token), out = [];
  for (const b of boards) {
    for (let offset = 0; offset <= 8000; offset += 100) {
      const d = await c24get(env, token, '/admin/boards/' + b.no + '/articles', { start_date: from, end_date: to, limit: 100, offset }, '게시판(Community) 읽기');
      const list = d.articles || [];
      list.forEach(a => { if (Number(a.reply_depth) > 0 || a.deleted === 'T' || a.notice === 'T') return;
        out.push({ id: b.no + ':' + a.article_no, board: b.name, created: a.created_date, product_no: Number(a.product_no) || 0, rating: Number(a.rating) || 0,
          title: String(a.title || '').slice(0, 120), content: String(a.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
          npay: !!a.naverpay_review_id, photos: (a.attach_file_urls || []).length, order_id: a.order_id || '' }); });
      if (list.length < 100) break;
    }
  }
  const nos = [...new Set(out.map(r => r.product_no).filter(Boolean))], names = {};
  for (let i = 0; i < nos.length; i += 100) {
    const d = await c24get(env, token, '/admin/products', { product_no: nos.slice(i, i + 100).join(','), fields: 'product_no,product_name', limit: 100 }, '상품(Product) 읽기');
    (d.products || []).forEach(p => { names[p.product_no] = p.product_name; });
  }
  out.forEach(r => { r.product_name = names[r.product_no] || ''; });
  return { from, to, reviews: out };
}


// ---------- 시장 비교: NAVER API HUB 데이터랩 (검색어 트렌드 · 쇼핑 인사이트) ----------
// 필요: 변수 NAVER_CLIENT_ID, 비밀 값 NAVER_CLIENT_SECRET (네이버 클라우드 콘솔 → NAVER API HUB → Application → 인증 정보)
const HUB = 'https://naverapihub.apigw.ntruss.com';
const MK_CFG0 = { kw: ['식용꽃', '로즈마리', '애플민트', '허브 모종', '바질'], cat: '50000006' };
const nvOk = env => !!(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET);
const nvH = env => ({ 'X-NCP-APIGW-API-KEY-ID': env.NAVER_CLIENT_ID, 'X-NCP-APIGW-API-KEY': env.NAVER_CLIENT_SECRET, 'Content-Type': 'application/json' });
const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
async function mkCfg(env) { try { const v = JSON.parse(await env.TOKENS.get('mk:cfg') || 'null'); if (v && Array.isArray(v.kw)) return { kw: v.kw, cat: v.cat || MK_CFG0.cat }; } catch (e) {} return Object.assign({}, MK_CFG0); }
async function mkCfgOut(env) { const c = await mkCfg(env); return Object.assign({ naver: nvOk(env) }, c); }
async function mkSetCfg(env, b) {
  const clean = (a, n, m) => [...new Set((Array.isArray(a) ? a : []).map(x => String(x || '').trim().slice(0, m)).filter(Boolean))].slice(0, n);
  const c = await mkCfg(env); if (b.kw) c.kw = clean(b.kw, 20, 30); if (b.cat !== undefined) c.cat = String(b.cat).replace(/\D/g, '').slice(0, 12) || MK_CFG0.cat;
  await env.TOKENS.put('mk:cfg', JSON.stringify(c));
  return mkCfgOut(env);
}
async function hubPost(env, path, body) {
  const r = await fetch(HUB + path, { method: 'POST', headers: nvH(env), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(r.status, 'naver', (r.status === 401 || r.status === 403 ? '네이버 키가 맞지 않거나 이 API를 Application에 추가하지 않았어요' : r.status === 429 ? '오늘 조회 한도를 넘었어요' : '네이버 데이터랩 조회에 실패했어요') + ' (' + (d.errorMessage || d.errMsg || (d.error && d.error.message) || r.status) + ')');
  return d;
}
async function mkTrend(env, b) {
  if (!nvOk(env)) throw fail(400, 'naver_key', '네이버 API 키가 아직 없어요');
  const kws = (Array.isArray(b.keywords) ? b.keywords : []).map(x => String(x).trim()).filter(Boolean).slice(0, 5);
  if (!kws.length) return { results: [] };
  const c = await mkCfg(env), src = b.src === 'shop' ? 'shop' : 'search', unit = ['date', 'week', 'month'].includes(b.unit) ? b.unit : 'month';
  const end = /^\d{4}-\d\d-\d\d$/.test(b.end || '') ? b.end : kstDay(), start = /^\d{4}-\d\d-\d\d$/.test(b.start || '') ? b.start : kstDay(Date.now() - 365 * 3 * 864e5);
  const ck = 'mk:t:' + [src, unit, start, end, c.cat, kws.join('|')].join('~');
  const hit = await env.TOKENS.get(ck); if (hit && !b.force) return JSON.parse(hit);
  const d = src === 'shop'
    ? await hubPost(env, '/shopping/v1/category/keywords', { startDate: start, endDate: end, timeUnit: unit, category: c.cat, keyword: kws.map(k => ({ name: k, param: [k] })) })
    : await hubPost(env, '/search-trend/v1/search', { startDate: start, endDate: end, timeUnit: unit, keywordGroups: kws.map(k => ({ groupName: k, keywords: [k] })) });
  const out = { src, unit, start, end, at: new Date().toISOString(), results: (d.results || []).map(x => ({ k: x.title, data: (x.data || []).map(p => [p.period, p.ratio]) })) };
  await env.TOKENS.put(ck, JSON.stringify(out), { expirationTtl: 60 * 60 * 12 });
  return out;
}


// ---------- 배송 휴무: 마감 뒤 주문에 희망배송일(다시 보내는 날) 기록 ----------
// 한 번에 최대 35건만 고쳐요 (무료 요금제의 요청 수 제한) · 남은 건수(left)가 있으면 사이트가 다시 불러요
async function wish(env, b) {
  const date = String(b && b.date || ''), from = new Date(b && b.from), to = new Date(b && b.to);
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) throw fail(400, 'date', '기록할 날짜가 올바르지 않아요');
  if (isNaN(from) || isNaN(to) || to <= from || to - from > 31 * 864e5) throw fail(400, 'range', '주문 기간이 올바르지 않아요');
  const day = d => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10), token = await accessToken(env);
  const H = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION };
  const todo = []; let seen = 0, already = 0;
  for (let offset = 0; offset <= 5000; offset += 500) {
    const u = new URL(base(env) + '/admin/orders');
    u.searchParams.set('date_type', 'pay_date'); u.searchParams.set('start_date', day(from)); u.searchParams.set('end_date', day(to));
    u.searchParams.set('embed', 'receivers'); u.searchParams.set('limit', '500'); u.searchParams.set('offset', String(offset));
    const r = await fetch(u, { headers: H }), d = await r.json().catch(() => ({}));
    if (!r.ok) throw fail(r.status, 'cafe24', '카페24에서 주문을 가져오지 못했어요: ' + ((d.error && d.error.message) || r.status));
    const list = d.orders || [];
    list.forEach(o => { if (o.paid !== 'T' || o.canceled === 'T' || !o.payment_date) return; const t = kst(o.payment_date); if (t < from || t >= to) return;
      (o.receivers || []).forEach(rc => { if (!rc.shipping_code) return; seen++; if (String(rc.wished_delivery_date || '').slice(0, 10) === date) { already++; return; } todo.push({ order_id: o.order_id, code: rc.shipping_code }); }); });
    if (list.length < 500) break;
  }
  const ok = [], bad = [], max = 35;
  for (const x of todo.slice(0, max)) {
    const r = await fetch(base(env) + '/admin/orders/' + encodeURIComponent(x.order_id) + '/receivers/' + encodeURIComponent(x.code), { method: 'PUT', headers: H, body: JSON.stringify({ shop_no: 1, request: { wished_delivery_date: date } }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) ok.push(x.order_id);
    else { if (r.status === 401 || r.status === 403) throw fail(r.status, 'cafe24', '카페24가 주문 수정을 거절했어요: ' + ((d.error && d.error.message) || r.status) + ' (앱 권한에 주문 쓰기가 있는지 확인해 주세요)'); bad.push({ order_id: x.order_id, message: (d.error && (d.error.message || d.error.code)) || ('오류 ' + r.status) }); }
    await new Promise(res => setTimeout(res, 120));
  }
  return { date, orders: seen, done: ok.length, already, fail: bad, left: Math.max(0, todo.length - max) };
}

// ---------- 판매 관리: 카페24 상품 품절 · 판매 재개 · 가격 · 수량 (상품 읽기 · 쓰기, 상품분류 읽기 권한) ----------
// 손님 정보는 다루지 않아요. 바꾸기는 관리자만 할 수 있어요 (사이트에서 확인 창을 거쳐요).
const SALE_NEED_W = '상품(Product) 쓰기';
async function c24p(env, token, method, path, body, need) {   // 카페24가 잠깐 바쁘면(429) 조금 쉬었다가 다시 해요
  for (let i = 0; i < 4; i++) {
    const r = await fetch(base(env) + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429 && i < 3) { await new Promise(res => setTimeout(res, 1200 * (i + 1))); continue; }
    if (r.status === 401 || r.status === 403) throw fail(403, 'scope_product', '카페24 앱에 [' + need + '] 권한이 없어요. 개발자센터 → 앱 → 권한에서 ' + need + '을 추가하고 저장한 뒤, 사이트에서 [카페24 연결]을 다시 눌러 동의해 주세요 (' + ((d.error && d.error.message) || r.status) + ')');
    if (!r.ok) throw fail(r.status, 'cafe24', '카페24 상품 작업에 실패했어요: ' + ((d.error && d.error.message) || r.status));
    return d;
  }
}
const saleNum = v => Math.round(Number(v) || 0);
function saleProd(p) {
  const invs = {}; (p.inventories || []).forEach(x => { if (x && x.variant_code) invs[x.variant_code] = x; });
  (p.variants || []).forEach(v => { const x = invs[v.variant_code] || (Array.isArray(v.inventories) ? v.inventories[0] : v.inventories) || null; if (x) { if (x.quantity != null) v.quantity = x.quantity; if (x.use_inventory) v.use_inventory = x.use_inventory; if (x.display_soldout) v.display_soldout = x.display_soldout; } });
  const vs = (p.variants || []).map(v => ({ code: v.variant_code, name: (v.options || []).map(o => o.value).filter(Boolean).join(' / ') || '기본', display: v.display !== 'F', selling: v.selling !== 'F',
    add: saleNum(v.additional_amount), inv: v.use_inventory === 'T', qty: v.quantity == null ? null : saleNum(v.quantity), dsold: v.display_soldout === 'T' }));
  return { no: Number(p.product_no), code: p.product_code || '', name: p.product_name || '', price: saleNum(p.price), retail: saleNum(p.retail_price), display: p.display === 'T', selling: p.selling === 'T',
    opt: p.has_option === 'T', img: p.tiny_image || p.small_image || p.list_image || '', v: vs };
}
async function saleList(env, q) {
  const token = await accessToken(env), offset = Math.max(0, Math.min(8000, Number(q.get('offset')) || 0));
  const d = await c24p(env, token, 'GET', '/admin/products?shop_no=1&limit=100&offset=' + offset + '&embed=variants', null, '상품(Product) 읽기');
  const list = (d.products || []).map(saleProd);
  return { list, next: list.length >= 100 ? offset + 100 : null };
}
let saleCatMem = null;
async function saleCats(env, fresh) {
  const ok = h => h && Date.now() - h.t < 6 * 3600e3;
  if (!fresh && ok(saleCatMem)) return saleCatMem;
  if (!fresh) { const hit = JSON.parse((await env.TOKENS.get('salecats')) || 'null'); if (ok(hit)) { saleCatMem = hit; return hit; } }
  const token = await accessToken(env);
  let cats = [];
  try {
    for (let off = 0; off < 500; off += 100) { const d = await c24p(env, token, 'GET', '/admin/categories?shop_no=1&limit=100&offset=' + off, null, '상품분류(Category) 읽기'); const L = d.categories || []; cats = cats.concat(L); if (L.length < 100) break; }
  } catch (e) { return { t: Date.now(), cats: null, err: e.message }; }
  cats = cats.filter(c => c.use_display !== 'F').map(c => ({ no: Number(c.category_no), name: c.category_name || '', depth: Number(c.category_depth) || 1, parent: Number(c.parent_category_no) || 0, p: [] }));
  cats.sort((a, b) => a.depth - b.depth);
  const todo = cats.slice(0, 38); let calls = 0;   // 한 번에 외부 요청 50개까지라 카테고리는 38개까지만 봐요
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async c => {
      if (calls++ > 44) return;
      const d = await c24p(env, token, 'GET', '/admin/products?shop_no=1&limit=100&fields=product_no&category=' + c.no, null, '상품(Product) 읽기').catch(() => null);
      c.p = d ? (d.products || []).map(x => Number(x.product_no)) : [];
    }));
  }
  const out = { t: Date.now(), cats: todo.filter(c => c.p.length || todo.some(x => x.parent === c.no)), more: cats.length > todo.length };
  saleCatMem = out; await env.TOKENS.put('salecats', JSON.stringify(out), { expirationTtl: 86400 }).catch(() => {});
  return out;
}
// 입금전(N00) · 상품준비중(N10) 주문을 배송준비중(N20)으로 넘겨요. 입금전은 먼저 입금확인(paid)을 해요
async function ostMove(env, b) {
  const from = String(b && b.from || ''); if (from !== 'N00' && from !== 'N10') throw fail(400, 'move', '입금전 · 상품준비중 주문만 넘길 수 있어요');
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String).filter(i => /^\d{8}-\d{7}$/.test(i)))].slice(0, 40);
  if (!ids.length) throw fail(400, 'move', '넘길 주문을 골라 주세요');
  const token = await accessToken(env), day = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10), now = Date.now();
  const look = async () => { const d = await c24get(env, token, '/admin/orders', { order_id: ids.join(','), start_date: day(now - 89 * 864e5), end_date: day(now), date_type: 'order_date', embed: 'items', limit: 100 }, '주문(Order) 읽기');
    const M = {}; (d.orders || []).forEach(o => { if (o.canceled === 'T') return; M[o.order_id] = (o.items || []).filter(i => !/^C|^R|^E/.test(i.order_status || '')).map(i => ({ c: i.order_item_code, s: i.order_status || '' })); }); return M; };
  const W = async (path, body) => { for (let i = 0; i < 4; i++) {
    const r = await fetch(base(env) + path, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429 && i < 3) { await new Promise(res => setTimeout(res, 1200 * (i + 1))); continue; }
    if (r.status === 401 || r.status === 403) throw fail(403, 'scope_order', '카페24 앱에 [주문 쓰기] 권한이 없어요. 개발자센터 → 앱 → 권한에서 주문(쓰기)을 추가하고, 사이트에서 [카페24 연결]을 다시 눌러 주세요 (' + ((d.error && d.error.message) || r.status) + ')');
    return { ok: r.ok, d, st: r.status }; } };
  const res = {}; ids.forEach(i => { res[i] = { ok: false, msg: '지금 그 상태인 주문이 아니에요' }; });
  let M = await look();
  const want = from, mine = id => (M[id] || []).filter(x => x.s === want);
  let todo = ids.filter(id => mine(id).length);
  if (from === 'N00' && todo.length) {
    const r = await W('/admin/payments', { shop_no: 1, requests: todo.map(id => ({ order_id: id, status: 'paid' })) });
    if (!r.ok && r.st !== 207) { const m = (r.d.error && r.d.error.message) || ('오류 ' + r.st); todo.forEach(id => { res[id] = { ok: false, msg: '입금확인 실패: ' + m }; }); todo = []; }
    if (todo.length) { await new Promise(r2 => setTimeout(r2, 400)); M = await look(); }
  }
  const step = todo.filter(id => (M[id] || []).some(x => x.s === 'N10' || x.s === 'N00'));
  ids.forEach(id => { if ((M[id] || []).length && (M[id] || []).every(x => x.s === 'N20')) res[id] = { ok: true }; });
  if (step.length) {
    const r = await W('/admin/orders', { shop_no: 1, requests: step.map(id => ({ order_id: id, process_status: 'prepare', order_item_code: (M[id] || []).filter(x => x.s === 'N10' || x.s === 'N00').map(x => x.c) })) });
    if (!r.ok && r.st !== 207) { const m = (r.d.error && r.d.error.message) || ('오류 ' + r.st); step.forEach(id => { res[id] = { ok: false, msg: (from === 'N00' ? '입금확인은 됐지만 ' : '') + '배송준비중으로 바꾸지 못했어요: ' + m }; }); }
    else { await new Promise(r2 => setTimeout(r2, 400)); M = await look(); step.forEach(id => { const L = M[id] || []; res[id] = L.length && L.every(x => x.s === 'N20') ? { ok: true } : { ok: false, msg: (from === 'N00' ? '입금확인은 됐지만 ' : '') + '아직 배송준비중이 아니에요 (' + [...new Set(L.map(x => x.s))].join(',') + ')' }; }); }
  }
  ostMem = null; await env.TOKENS.delete('ost').catch(() => {});
  return { ok: true, from, res, done: ids.filter(i => res[i].ok).length };
}

async function saleSave(env, b) {
  const no = Number(b && b.no); if (!no) throw fail(400, 'sale', '상품 번호가 없어요');
  const yn = v => v === 'T' || v === 'F' ? v : null, token = await accessToken(env);
  const P = b.prod || {}, req = {};
  if (typeof P.product_name === 'string' && P.product_name.trim()) req.product_name = P.product_name.trim().slice(0, 250);
  if (P.price != null) { const v = saleNum(P.price); if (v < 0 || v > 100000000) throw fail(400, 'sale', '판매가를 확인해 주세요'); req.price = v; }
  if (P.retail_price != null) { const v = saleNum(P.retail_price); if (v < 0 || v > 100000000) throw fail(400, 'sale', '소비자가를 확인해 주세요'); req.retail_price = v; }
  if (yn(P.display)) req.display = P.display;
  if (yn(P.selling)) req.selling = P.selling;
  if (Object.keys(req).length) await c24p(env, token, 'PUT', '/admin/products/' + no, { shop_no: 1, request: req }, SALE_NEED_W);
  const V = (Array.isArray(b.vars) ? b.vars : []).slice(0, 100).map(v => { const r = { variant_code: String(v.variant_code || '') }; if (yn(v.selling)) r.selling = v.selling; if (yn(v.display)) r.display = v.display; if (v.additional_amount != null) r.additional_amount = saleNum(v.additional_amount); return r; }).filter(r => /^[A-Z0-9]{12}$/.test(r.variant_code) && Object.keys(r).length > 1);
  if (V.length) await c24p(env, token, 'PUT', '/admin/products/' + no + '/variants', { shop_no: 1, requests: V }, SALE_NEED_W);
  const I = (Array.isArray(b.inv) ? b.inv : []).slice(0, 30).filter(v => /^[A-Z0-9]{12}$/.test(String(v.variant_code || '')));
  for (const v of I) {
    const q = saleNum(v.quantity); if (q < 0 || q > 999999) throw fail(400, 'sale', '수량을 확인해 주세요');
    await c24p(env, token, 'PUT', '/admin/products/' + no + '/variants/' + v.variant_code + '/inventories', { shop_no: 1, request: { use_inventory: 'T', display_soldout: 'T', quantity: q } }, SALE_NEED_W);
  }
  return { ok: true, product: await saleOneGet(env, token, no) };
}
async function saleOneGet(env, token, no) { const d = await c24p(env, token, 'GET', '/admin/products/' + no + '?shop_no=1&embed=variants,inventories', null, '상품(Product) 읽기'); return d.product ? saleProd(d.product) : null; }
async function saleOne(env, no) { no = Number(no); if (!no) throw fail(400, 'sale', '상품 번호가 없어요'); return { product: await saleOneGet(env, await accessToken(env), no) }; }

// ---------- 배송 휴무 공지: 카페24 게시판에 글 올리기 · 내리기 (게시판 쓰기 권한 필요) ----------
async function c24Req(env, method, path, body) {
  const token = await accessToken(env);
  const r = await fetch(base(env) + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Cafe24-Api-Version': API_VERSION }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw fail(403, 'scope_board', '카페24 앱에 [게시판 쓰기] 권한이 없어요. 개발자센터 → 앱 → 권한에서 게시판(쓰기)을 추가하고, 사이트에서 [카페24 연결]을 다시 눌러 주세요');
  if (!r.ok) throw fail(r.status, 'cafe24', '카페24 게시판 작업에 실패했어요: ' + ((d.error && d.error.message) || r.status));
  return d;
}
async function boards(env) { const d = await c24Req(env, 'GET', '/admin/boards?shop_no=1'); return { boards: (d.boards || []).map(b => ({ no: b.board_no, name: b.board_name, type: b.board_type, use: b.use_board })) }; }
async function noticePost(env, b) {
  const no = Number(b && b.board_no), title = String(b && b.title || '').trim().slice(0, 250), content = String(b && b.content || '').trim().slice(0, 20000);
  if (!no || !title || !content) throw fail(400, 'notice', '게시판 · 제목 · 내용을 모두 넣어 주세요');
  const d = await c24Req(env, 'POST', '/admin/boards/' + no + '/articles', { shop_no: 1, requests: [{ writer: String(b.writer || '관리자').slice(0, 100), title, content, notice: b.notice ? 'T' : 'F' }] });
  const a = (d.articles || [])[0] || d.article || {};
  return { ok: true, board_no: no, article_no: a.article_no || null };
}
async function noticeDel(env, b) { const no = Number(b && b.board_no), art = Number(b && b.article_no); if (!no || !art) throw fail(400, 'notice', '지울 공지를 찾지 못했어요'); await c24Req(env, 'DELETE', '/admin/boards/' + no + '/articles/' + art + '?shop_no=1'); return { ok: true }; }

// ---------- 공지 이미지 보관: 카페24 게시판 글에 넣을 PNG를 KV에 두고 주소로 보여 줘요 ----------
async function imgPut(env, b, url) {
  const m = String(b && b.data || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw fail(400, 'img', '이미지가 올바르지 않아요');
  const bin = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
  if (bin.length > 6 * 1024 * 1024) throw fail(400, 'img', '이미지가 너무 커요 (6MB까지)');
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await env.TOKENS.put('img:' + id, bin, { expirationTtl: 60 * 60 * 24 * 400 });
  return { ok: true, id, url: url.origin + '/img/' + id + '.png' };
}
async function imgGet(env, id) {
  const v = await env.TOKENS.get('img:' + id, { type: 'arrayBuffer' });
  if (!v) return new Response('not found', { status: 404 });
  return new Response(v, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
}
