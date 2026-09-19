// TBDR 가계부 PWA 서비스워커 (v5)
// 전략: 네트워크 우선(온라인이면 항상 최신 화면) + 실패 시 캐시(오프라인 대비)
// → GitHub의 index.html만 교체하면, 온라인에서 다음 실행 때 자동으로 최신 화면이 반영됩니다.
//
// v5 변경: 우리 사이트 파일과 Firebase SDK(gstatic)만 처리한다.
//   Firestore 통신(firestore.googleapis.com)은 GET 스트리밍 요청이라
//   예전처럼 전부 가로채면 동기화할 때마다 쓸모없는 응답이 캐시에 쌓였다.

const CACHE = 'tbdr-cache-v5';
const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 서비스워커가 다룰 요청인가?
//  - 같은 출처(우리 GitHub Pages 파일)
//  - www.gstatic.com (Firebase SDK 파일 — 버전이 주소에 박혀 있어 캐시해도 안전,
//    오프라인에서 앱을 열 때도 SDK를 불러올 수 있게 해 준다)
function shouldHandle(req) {
  var url;
  try { url = new URL(req.url); } catch (e) { return false; }
  if (url.origin === self.location.origin) return true;
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) return true;
  return false;
}

// 설치: 핵심 파일을 미리 캐시 (첫 오프라인 대비)
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE).catch(function () {});
    })
  );
});

// 활성화: 이전 버전 캐시 정리 (v4에 쌓인 Firestore 응답도 여기서 함께 지워진다)
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
  if (!shouldHandle(req)) return;   // 그 외(Firestore·인증 등)는 브라우저가 직접 처리

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type !== 'opaque') {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, clone); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) {
        if (r) return r;
        // 페이지 이동 요청일 때만 index.html로 대체한다.
        // (아이콘·매니페스트 요청에 HTML을 돌려주면 설치 검사가 깨진다)
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
