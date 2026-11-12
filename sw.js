// =====================================================================
// 서비스워커: 기본 오프라인 캐시
//  - 우리 사이트 파일(HTML·CSS·JS·아이콘): 네트워크 먼저 → 받은 것을 저장 → 인터넷이 없으면 저장본
//  - supabase-js 라이브러리(버전 고정 주소): 저장본 먼저
//  - 그 밖의 요청(Supabase 로그인·데이터, 토스 결제, 상품 사진)은 건드리지 않음 = 절대 저장 안 함
// 저장할 파일 목록(PRECACHE)을 바꾸면 CACHE 이름의 숫자를 올려 주세요.
// =====================================================================
const CACHE = "bylee-shop-v1";
const SUPABASE_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
const PRECACHE = [
  "./", "index.html", "offline.html", "css/style.css",
  "js/config.js", "js/common.js", "js/shop.js", "js/pwa.js",
  "icons/icon-192.png", SUPABASE_LIB,
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

// 옛 버전 저장소 지우기
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.href === SUPABASE_LIB) {
    e.respondWith(caches.match(SUPABASE_LIB).then((hit) => hit || fetch(req)));
  } else if (url.origin === location.origin) {
    e.respondWith(networkFirst(req, url));
  }
  // 그 밖의 요청은 respondWith 를 하지 않음 → 브라우저가 평소처럼 처리
});

async function networkFirst(req, url) {
  // 주소 뒤의 ?... 는 빼고 저장 (결제 정보 같은 값이 저장되지 않게)
  const key = url.origin + url.pathname;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(key, copy));
    }
    return res;
  } catch (err) {
    const hit = await caches.match(key);
    if (hit) return hit;
    if (req.mode === "navigate") return caches.match("offline.html");
    throw err;
  }
}
