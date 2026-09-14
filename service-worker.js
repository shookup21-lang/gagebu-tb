// TBDR 가계부 PWA 서비스워커 (v2)
// 전략: 네트워크 우선(온라인이면 항상 최신 화면) + 실패 시 캐시(오프라인 대비)
// → GitHub의 index.html만 교체하면, 온라인에서 다음 실행 때 자동으로 최신 화면이 반영됩니다.

const CACHE = 'tbdr-cache-v2';
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 설치: 핵심 파일을 미리 캐시 (첫 오프라인 대비)
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE).catch(function () {});
    })
  );
});

// 활성화: 이전 버전 캐시 정리
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// 요청 처리: 네트워크 우선 → 성공하면 캐시 갱신, 실패(오프라인)하면 캐시 사용
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type !== 'opaque') {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, clone); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) {
        return r || caches.match('./index.html');
      });
    })
  );
});
