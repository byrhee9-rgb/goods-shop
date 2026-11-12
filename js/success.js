// 결제 성공 후 돌아오는 페이지 (success.html?paymentKey=...&orderId=...&amount=...)
// 토스 결제창에서 "인증"만 끝난 상태라, 서버 함수(confirm-payment)로 "최종 승인"을 받아야 해요.
(async () => {
  await renderHeader();
  const user = await requireLogin();
  if (!user) return;

  const box = document.getElementById("result");
  const p = new URLSearchParams(location.search);
  const paymentKey = p.get("paymentKey");
  const orderId = p.get("orderId");
  const amount = Number(p.get("amount"));

  // 이미 승인이 끝난 뒤 새로고침한 경우: DB에서 주문을 읽어 보여줘요
  if (p.get("done") && orderId) {
    const { data: saved } = await sb
      .from("orders").select("*").eq("order_id", orderId).maybeSingle();
    return saved && saved.status === "paid" ? render(saved) : fail("주문 정보를 찾을 수 없어요.");
  }

  if (!paymentKey || !orderId || !amount) {
    return fail("결제 정보가 없어요.");
  }

  const { data, error } = await sb.functions.invoke("confirm-payment", {
    body: { paymentKey, orderId, amount },
  });

  if (error || !data || !data.ok) {
    let reason = (data && data.error) || "";
    if (!reason && error && error.context && typeof error.context.json === "function") {
      try { reason = (await error.context.json()).error; } catch (_) { /* 무시 */ }
    }
    return fail(reason || "결제 승인 중 문제가 생겼어요.");
  }

  // 새로고침해도 다시 승인 요청하지 않도록 주소에서 결제 정보를 지워요
  history.replaceState(null, "", "success.html?orderId=" + encodeURIComponent(data.order.order_id) + "&done=1");
  render(data.order);

  function render(o) {
    box.innerHTML = `
    <div class="icon">🎉</div>
    <h1>결제가 완료됐어요!</h1>
    <dl class="summary-list">
      <div><dt>상품</dt><dd>${escapeHtml(o.product_name)}</dd></div>
      <div><dt>결제 금액</dt><dd>${won(o.amount)}</dd></div>
      <div><dt>결제 수단</dt><dd>${escapeHtml(o.method || "-")}</dd></div>
      <div><dt>결제 시각</dt><dd>${formatDate(o.approved_at)}</dd></div>
      <div><dt>주문번호</dt><dd style="font-size:.875rem">${escapeHtml(o.order_id)}</dd></div>
    </dl>
    <div class="actions">
      <a class="btn" href="orders.html">내 결제내역 보기</a>
      <a class="btn btn-ghost" href="index.html">쇼핑 계속하기</a>
    </div>`;
  }

  function fail(reason) {
    box.innerHTML = `
      <div class="icon">😢</div>
      <h1>결제를 완료하지 못했어요</h1>
      <p class="page-desc">${escapeHtml(reason)}</p>
      <div class="actions">
        <a class="btn" href="index.html">상품 목록으로</a>
        <a class="btn btn-ghost" href="orders.html">내 결제내역</a>
      </div>`;
  }
})();
