// =====================================================================
// 앱(PWA) 기능 — 모든 페이지에서 불러요
//  1) 서비스워커(sw.js) 등록: 방문한 페이지를 저장해서 인터넷이 없어도 열리게
//  2) "홈 화면에 추가" 안내: 폰으로 상품 목록에 처음 왔을 때 한 번만, 아래에 살짝
// =====================================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* 실패해도 사이트는 평소처럼 동작 */ });
  });
}

(() => {
  const KEY = "installHintShown";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  // 카카오톡·네이버·인스타그램 등 앱 안의 브라우저는 홈 화면 추가가 안 돼요
  const inAppBrowser = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|; wv\)/i.test(ua);
  const runningAsApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const onShopPage = /\/(index\.html)?$/.test(location.pathname);
  let seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch (_) { /* 저장 불가 브라우저 */ }

  if (!(isIOS || isAndroid) || inAppBrowser || runningAsApp || !onShopPage || seen) return;

  if (isIOS) {
    // 아이폰·아이패드는 설치 버튼이 없어서 방법을 알려줘요
    show("화면의 공유 버튼(⬆︎)을 누르고 ‘홈 화면에 추가’를 골라 주세요.");
  } else {
    // 안드로이드: 브라우저가 "설치할 수 있어요" 신호를 줄 때만 안내해요
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      show("홈 화면에 추가하면 앱처럼 바로 열 수 있어요.", () => e.prompt());
    }, { once: true });
  }

  function show(text, onAdd) {
    setTimeout(() => {
      const box = document.createElement("div");
      box.className = "install-hint";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", "홈 화면에 추가 안내");
      box.innerHTML = `
        <img src="icons/icon-192.png" alt="" width="48" height="48" />
        <p><b>bylee-shop 앱으로 쓰기</b><span>${text}</span></p>
        <div class="install-actions">
          ${onAdd ? `<button type="button" class="btn" data-add>추가하기</button>` : ""}
          <button type="button" class="btn btn-ghost" data-close>닫기</button>
        </div>`;
      document.body.appendChild(box);
      try { localStorage.setItem(KEY, "1"); } catch (_) { /* 무시 */ }

      box.addEventListener("click", async (ev) => {
        const add = ev.target.closest("[data-add]");
        if (!add && !ev.target.closest("[data-close]")) return;
        box.remove();
        if (add) await onAdd();
      });
    }, 2000);
  }
})();
