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
      const who = await checkUser(req, env);                       // 로그인한 사람인지 확인
      if (url.pathname === '/status') return json(await status(env, who), cors);
      if (url.pathname === '/auth-url') { needAdmin(who); return json({ url: authUrl(env, url.searchParams.get('state') || '') }, cors); }
      if (url.pathname === '/exchange' && req.method === 'POST') { needAdmin(who); const { code } = await req.json(); return json(await exchange(env, code), cors); }
      if (url.pathname === '/orders') return json(await orders(env, url.searchParams), cors);
      if (url.pathname === '/reviews') return json(await reviews(env, url.searchParams), cors);
      if (url.pathname === '/claims') return json(await claims(env, url.searchParams), cors);
      if (url.pathname === '/crm') { needAdmin(who); return json(await crm(env, url.searchParams), cors); }
      if (url.pathname === '/who') { needAdmin(who); return json(await whoIs(env, url.searchParams), cors); }
      if (url.pathname === '/shipments' && req.method === 'POST') return json(await shipments(env, await req.json(), who), cors);
      if (url.pathname === '/market/cfg') { if (req.method === 'POST') { needAdmin(who); return json(await mkSetCfg(env, await req.json()), cors); } return json(await mkCfgOut(env), cors); }
      if (url.pathname === '/market/trend' && req.method === 'POST') return json(await mkTrend(env, await req.json()), cors);
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
  u.searchParams.set('scope', 'mall.read_order mall.write_order mall.read_shipping mall.read_community mall.read_product');
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
        (o.items || []).filter(i => String(i.order_status || '').startsWith(pre) || String(i.claim_type || '').toUpperCase().startsWith(pre)).forEach(i => {
          const ci = cl.find(c => [].concat(c.items || []).some(x => x.order_item_code === i.order_item_code)) || {};
          out.push({ type, day, order_id: o.order_id, order_item_code: i.order_item_code, product_name: i.product_name, option_value: i.option_value || '', quantity: Number(i.claim_quantity || i.quantity) || 0,
            status: i.order_status || '', reason: pick(i, RK) || pick(ci, RK) || creason, market_id: o.market_id || '', order_place_id: o.order_place_id || '', order_place_name: o.order_place_name || '' });
        });
      });
      if (list.length < 500) break;
    }
  }
  return { day, claims: out };
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

