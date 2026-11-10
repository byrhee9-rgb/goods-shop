// =====================================================================
// confirm-payment: 토스 결제 "최종 승인" 서버 함수 (Supabase Edge Function)
//
// 왜 서버가 필요할까?
//   결제 승인에는 토스 "시크릿 키"가 필요한데, 이 키는 브라우저(HTML/JS)에
//   넣으면 누구나 볼 수 있어요. 그래서 이 함수(서버)에만 보관합니다.
//
// 흐름: success.html → (로그인 토큰 + paymentKey, orderId, amount) → 이 함수
//   1) 로그인한 사용자인지 확인
//   2) 주문이 그 사용자 것인지, 금액이 DB 금액과 같은지 확인
//   3) 토스 승인 API 호출
//   4) 성공하면 주문을 'paid' 로, 실패하면 'failed' 로 저장
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST 요청만 받아요" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tossSecret = Deno.env.get("TOSS_SECRET_KEY");
    if (!tossSecret) return json({ error: "서버에 토스 시크릿 키가 설정되지 않았어요" }, 500);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) 로그인 확인
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "로그인이 필요해요" }, 401);

    // 2) 요청 값 확인
    const { paymentKey, orderId, amount } = await req.json().catch(() => ({}));
    if (!paymentKey || !orderId || amount === undefined) {
      return json({ error: "결제 정보가 부족해요" }, 400);
    }

    const { data: order } = await admin
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!order || order.user_id !== user.id) {
      return json({ error: "주문을 찾을 수 없어요" }, 404);
    }
    if (order.status === "paid") {
      // 새로고침 등으로 다시 호출된 경우: 이미 끝난 결제
      return json({ ok: true, order });
    }
    if (Number(amount) !== order.amount) {
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
      return json({ error: "결제 금액이 주문 금액과 달라요" }, 400);
    }

    // 3) 토스 승인 요청
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(tossSecret + ":"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
    });
    const toss = await tossRes.json();

    // 4) 결과 저장
    if (!tossRes.ok) {
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
      return json({ error: toss.message ?? "결제 승인에 실패했어요", code: toss.code }, 400);
    }

    const { data: updated } = await admin
      .from("orders")
      .update({
        status: "paid",
        payment_key: toss.paymentKey,
        method: toss.easyPay?.provider ? `${toss.method} (${toss.easyPay.provider})` : toss.method,
        approved_at: toss.approvedAt,
      })
      .eq("id", order.id)
      .select()
      .single();

    return json({ ok: true, order: updated });
  } catch (e) {
    console.error(e);
    return json({ error: "서버 오류가 발생했어요" }, 500);
  }
});
