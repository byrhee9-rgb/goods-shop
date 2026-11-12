// 관리자 페이지 (admin.html)
// 화면에서 관리자인지 확인하지만, 진짜 보호는 DB의 RLS 규칙이 해요.
// (관리자가 아닌 사람이 이 페이지를 억지로 열어도 다른 사람 주문은 DB가 내주지 않음)
(async () => {
  await renderHeader();
  const user = await requireLogin();
  if (!user) return;

  const msg = document.getElementById("message");
  if (!isAdmin(user)) {
    document.querySelector("main").innerHTML = `
      <div class="card result">
        <div class="icon">🔒</div>
        <h1>관리자만 볼 수 있어요</h1>
        <p class="page-desc">관리자 계정으로 로그인해 주세요.</p>
        <div class="actions"><a class="btn" href="index.html">상품 목록으로</a></div>
      </div>`;
    return;
  }

  const { data: orders, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("list").innerHTML = "";
    return showMessage(msg, "결제내역을 불러오지 못했어요.");
  }

  // 요약 숫자
  const paid = orders.filter((o) => o.status === "paid");
  const buyers = new Set(paid.map((o) => o.user_id)).size;
  document.getElementById("stats").innerHTML = [
    ["총 결제금액", won(paid.reduce((s, o) => s + o.amount, 0))],
    ["결제완료 건수", paid.length + "건"],
    ["구매한 회원 수", buyers + "명"],
    ["전체 주문 시도", orders.length + "건"],
  ].map(([label, value]) =>
    `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`
  ).join("");

  // 표 그리기 (상태 필터)
  let filter = "all";
  function draw() {
    const rows = filter === "all" ? orders : orders.filter((o) => o.status === filter);
    document.getElementById("list").innerHTML = rows.length ? `
      <div class="table-wrap">
        <table class="stack">
          <thead><tr>
            <th>주문일시</th><th>구매자</th><th>상품</th><th class="num">금액</th>
            <th>결제수단</th><th>상태</th><th>주문번호</th>
          </tr></thead>
          <tbody>
            ${rows.map((o) => `
              <tr>
                <td data-label="주문일시">${formatDate(o.created_at)}</td>
                <td data-label="구매자">${escapeHtml(o.buyer_email || "-")}</td>
                <td data-label="상품" class="title">${escapeHtml(o.product_name)}</td>
                <td data-label="금액" class="num">${won(o.amount)}</td>
                <td data-label="결제수단">${escapeHtml(o.method || "-")}</td>
                <td data-label="상태">${statusBadge(o.status)}</td>
                <td data-label="주문번호" class="order-id">${escapeHtml(o.order_id)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : `<p class="empty">해당하는 주문이 없어요.</p>`;
  }

  document.getElementById("filters").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("on", x === b));
    draw();
  });
  draw();
})();
