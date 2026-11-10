// 내 결제내역 페이지 (orders.html)
// DB 보안 규칙(RLS) 덕분에 "내 주문"만 돌아와요. (관리자도 이 페이지에서는 자기 것만 보이게 필터)
(async () => {
  await renderHeader();
  const user = await requireLogin();
  if (!user) return;

  const list = document.getElementById("list");
  const { data: orders, error } = await sb
    .from("orders")
    .select("order_id, product_name, amount, status, method, created_at, approved_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = "";
    return showMessage(document.getElementById("message"), "결제내역을 불러오지 못했어요.");
  }
  if (!orders.length) {
    list.innerHTML = `<p class="empty">아직 주문한 내역이 없어요.<br /><a href="index.html">상품 보러 가기 →</a></p>`;
    return;
  }

  const paidTotal = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);

  list.innerHTML = `
    <p style="margin-top:0">결제완료 합계: <b>${won(paidTotal)}</b></p>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>주문일시</th><th>상품</th><th class="num">금액</th><th>결제수단</th><th>상태</th>
        </tr></thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td>${formatDate(o.created_at)}</td>
              <td>${escapeHtml(o.product_name)}</td>
              <td class="num">${won(o.amount)}</td>
              <td>${escapeHtml(o.method || "-")}</td>
              <td>${statusBadge(o.status)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="hint">"결제 미완료"는 결제창을 열었다가 닫은 주문이에요. 돈은 나가지 않았어요.</p>`;
})();
