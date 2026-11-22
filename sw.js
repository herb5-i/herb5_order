// 허브아이 앱 설치용 서비스 워커: 화면 문서만 네트워크 우선, 끊겼을 때만 저장본을 보여 줘요. 데이터 요청은 건드리지 않아요.
const C = 'herb5-shell-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put('./', cp)).catch(() => {}); } return res; })
    .catch(() => caches.open(C).then(c => c.match('./')).then(m => m || new Response('인터넷 연결을 확인해 주세요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))));
});
