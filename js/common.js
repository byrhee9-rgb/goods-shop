// =====================================================================
// 모든 페이지에서 같이 쓰는 기능
//  - Supabase 연결(sb)
//  - 로그인 상태 확인, 상단 메뉴 그리기
//  - 가격/날짜 표시, 안전한 글자 출력 등 도우미 함수
// =====================================================================
const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

// 현재 로그인한 사용자 (없으면 null)
async function getUser() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

function isAdmin(user) {
  return !!user && user.app_metadata && user.app_metadata.role === "admin";
}

// 로그인이 필요한 페이지에서 호출: 로그인 안 했으면 로그인 페이지로 보냄
async function requireLogin() {
  const user = await getUser();
  if (!user) {
    const back = encodeURIComponent(location.pathname.split("/").pop() + location.search);
    location.replace("login.html?next=" + back);
    return null;
  }
  return user;
}

// 상단 메뉴 그리기
async function renderHeader() {
  const user = await getUser();
  const here = location.pathname.split("/").pop() || "index.html";
  const link = (href, label) =>
    `<a href="${href}" class="${here === href ? "active" : ""}">${label}</a>`;

  let menu = link("index.html", "상품");
  if (user) {
    menu += link("orders.html", "내 결제내역");
    if (isAdmin(user)) menu += link("admin.html", "관리자");
    menu += `<span class="who" title="${escapeHtml(user.email)}">${escapeHtml(user.email)}</span>`;
    menu += `<button type="button" class="btn-link" id="logoutBtn">로그아웃</button>`;
  } else {
    menu += link("login.html", "로그인");
  }

  document.getElementById("header").innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="logo">🛍️ 굿즈샵</a>
      <nav>${menu}</nav>
    </div>`;

  const btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.addEventListener("click", async () => {
      await sb.auth.signOut();
      location.href = "index.html";
    });
  }
  return user;
}

// 12000 → "12,000원"
function won(n) {
  return Number(n || 0).toLocaleString("ko-KR") + "원";
}

// 날짜를 "2026. 11. 10. 오후 3:20" 형태로
function formatDate(s) {
  if (!s) return "-";
  return new Date(s).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_LABEL = {
  paid: { text: "결제완료", cls: "badge-paid" },
  pending: { text: "결제 미완료", cls: "badge-pending" },
  failed: { text: "실패", cls: "badge-failed" },
};

function statusBadge(status) {
  const s = STATUS_LABEL[status] || { text: status, cls: "" };
  return `<span class="badge ${s.cls}">${s.text}</span>`;
}

// 사용자가 입력한 글자를 화면에 안전하게 표시 (HTML 코드로 해석되지 않게)
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// 상품 그림(이모지 + 그라디언트) 만들기
function productArt(p, size = "") {
  const c = escapeHtml(p.color || "#6366f1");
  return `<div class="art ${size}" style="--c:${c}"><span>${escapeHtml(p.emoji)}</span></div>`;
}

function showMessage(el, text, type = "error") {
  el.innerHTML = text ? `<div class="msg msg-${type}">${escapeHtml(text)}</div>` : "";
}
