// 상품 목록 페이지 (index.html)
(async () => {
  await renderHeader();

  const box = document.getElementById("products");
  const { data: products, error } = await sb
    .from("products")
    .select("*")
    .order("sort_order");

  if (error) {
    box.innerHTML = "";
    showMessage(document.getElementById("message"), "상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    return;
  }
  if (!products.length) {
    box.innerHTML = `<p class="empty">아직 등록된 상품이 없어요.</p>`;
    return;
  }

  box.innerHTML = products.map((p) => `
    <article class="product">
      ${productArt(p)}
      <div class="product-body">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="price">${won(p.price)}</div>
        <a class="btn btn-block" href="checkout.html?product=${p.id}">구매하기</a>
      </div>
    </article>`).join("");
})();
