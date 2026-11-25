// 첫 화면(허브아이 · 허브다섯메) 서비스 워커: 화면 문서만 네트워크 우선, 끊겼을 때만 그 주소의 저장본을 보여 줘요. 데이터 요청은 건드리지 않아요.
// 허브아이(shop/)는 자기 서비스 워커가 따로 있어요.
const C = 'herb5-root-v2';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k === 'herb5-shell-v1').map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || r.mode !== 'navigate' || u.origin !== self.location.origin) return;
  const key = u.origin + u.pathname;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(key, cp)).catch(() => {}); } return res; })
    .catch(() => caches.open(C).then(c => c.match(key)).then(m => m || new Response('인터넷 연결을 확인해 주세요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))));
});
