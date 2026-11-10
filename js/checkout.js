// 결제 페이지 (checkout.html?product=상품번호)
// 1) 상품 정보 표시 → 2) 토스 결제위젯 그리기
// 3) [결제하기] 클릭 → DB에 '결제 미완료(pending)' 주문 생성 → 토스 결제창 열기
// 4) 결제가 끝나면 토스가 success.html 또는 fail.html 로 돌려보냄
(async () => {
  await renderHeader();
  const user = await requireLogin();
  if (!user) return;

  const msg = document.getElementById("message");
  const payBtn = document.getElementById("payBtn");
  const productId = Number(new URLSearchParams(location.search).get("product"));

  // 1) 상품 정보
  const { data: product } = await sb
    .from("products").select("*").eq("id", productId).maybeSingle();

  if (!product) {
    document.getElementById("item").innerHTML =
      `<p class="empty">상품을 찾을 수 없어요. <a href="index.html">상품 목록으로</a></p>`;
    return;
  }

  document.getElementById("item").innerHTML = `
    <div class="checkout-item">
      ${productArt(product, "small")}
      <div>
        <h2>${escapeHtml(product.name)}</h2>
        <div class="price">${won(product.price)}</div>
      </div>
    </div>`;

  // 2) 토스 결제위젯
  let widgets;
  try {
    const tossPayments = TossPayments(window.APP_CONFIG.TOSS_CLIENT_KEY);
    widgets = tossPayments.widgets({ customerKey: user.id });
    await widgets.setAmount({ currency: "KRW", value: product.price });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
      widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
    ]);
    payBtn.disabled = false;
  } catch (e) {
    console.error(e);
    showMessage(msg, "결제창을 불러오지 못했어요. 새로고침해 주세요.");
    return;
  }

  // 3) 결제하기
  payBtn.addEventListener("click", async () => {
    payBtn.disabled = true;
    showMessage(msg, "");

    // 주문 만들기: product_id 만 보내면 가격·주문번호는 DB가 정해요
    const { data: order, error } = await sb
      .from("orders")
      .insert({ product_id: product.id, user_id: user.id })
      .select()
      .single();

    if (error || !order) {
      payBtn.disabled = false;
      return showMessage(msg, "주문을 만들지 못했어요. 다시 시도해 주세요.");
    }

    // 혹시 DB 가격이 바뀌었으면 결제 금액도 맞춰요
    if (order.amount !== product.price) {
      await widgets.setAmount({ currency: "KRW", value: order.amount });
    }

    const base = location.href.replace(/[^/]*$/, ""); // 현재 폴더 주소
    try {
      await widgets.requestPayment({
        orderId: order.order_id,
        orderName: order.product_name,
        customerEmail: user.email,
        successUrl: base + "success.html",
        failUrl: base + "fail.html",
      });
    } catch (e) {
      // 결제창을 닫거나 취소한 경우
      payBtn.disabled = false;
      showMessage(msg, e && e.code === "USER_CANCEL"
        ? "결제를 취소했어요. 다시 결제하려면 [결제하기]를 눌러 주세요."
        : "결제창을 여는 중 문제가 생겼어요: " + ((e && e.message) || ""));
    }
  });
})();
