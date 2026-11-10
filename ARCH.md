# 굿즈샵 상세 구조 (ARCH.md)

프로젝트 개요와 작업 규칙은 [CLAUDE.md](CLAUDE.md) 참고.

## 1. 전체 그림

```
 [브라우저]                         [GitHub Pages]              [Supabase]                    [토스페이먼츠]
 사용자 ──── HTML/CSS/JS 받기 ────▶  goods-shop 정적 파일
   │
   ├─ 로그인/가입 ─────────────────────────────────────────▶  Auth (이메일+비밀번호)
   ├─ 상품·주문 읽기/쓰기 (anon 키 + 로그인 토큰) ──────────▶  Postgres + RLS
   ├─ 결제창 열기 (클라이언트 키) ───────────────────────────────────────────────────────▶  결제위젯
   └─ 결제 최종 승인 요청 ─────────────────────────────────▶  Edge Function confirm-payment
                                                                   └─ 시크릿 키로 승인 ─────────▶  /v1/payments/confirm
```

## 2. 파일 구조와 역할

| 파일 | 역할 |
|---|---|
| `index.html` + `js/shop.js` | 첫 화면. `products` 테이블을 읽어 상품 카드 표시 |
| `login.html` + `js/login.js` | 로그인/회원가입 탭. `?next=페이지` 로 로그인 후 돌아갈 곳 지정, `?mode=signup` 으로 가입 탭 열기 |
| `checkout.html` + `js/checkout.js` | `?product=ID`. 상품 표시 → 토스 결제위젯 렌더 → [결제하기] 시 `orders`에 pending 주문 생성 → `requestPayment` |
| `success.html` + `js/success.js` | 토스가 `?paymentKey&orderId&amount` 로 돌려보냄 → `confirm-payment` 호출 → 결과 표시. 승인 후 주소를 `?orderId&done=1` 로 바꿔 새로고침 시 재승인 방지 |
| `fail.html` | 토스가 `?code&message&orderId` 로 돌려보냄 → 사유 표시 |
| `orders.html` + `js/orders.js` | 로그인 필수. 내 주문 목록(최신순), 결제완료 합계 |
| `admin.html` + `js/admin.js` | 관리자만. 전체 주문 + 요약(총 결제금액, 건수, 구매 회원 수, 전체 시도) + 상태 필터 |
| `js/config.js` | 공개 설정값: Supabase URL, anon 키, 토스 클라이언트 키, 관리자 이메일 |
| `js/common.js` | Supabase 클라이언트 `sb`, `getUser`, `isAdmin`, `requireLogin`, `renderHeader`, `won`, `formatDate`, `statusBadge`, `escapeHtml`, `productArt`, `showMessage` |
| `css/style.css` | 전체 스타일 (카드형, 모바일 대응) |
| `supabase/schema.sql` | 테이블, 함수, 트리거, RLS, 권한, 예시 상품. 여러 번 실행해도 안전 |
| `supabase/functions/confirm-payment/index.ts` | 결제 최종 승인 Edge Function (Deno) |

각 HTML의 스크립트 로드 순서: (토스 SDK) → supabase-js UMD → `config.js` → `common.js` → 페이지 JS.

## 3. 데이터베이스

### `products` (상품)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint (identity) | 상품 번호 |
| name | text | 상품명 |
| description | text | 설명 |
| price | integer | 가격(원), > 0 |
| emoji | text | 상품 그림 대신 쓰는 이모지 |
| color | text | 카드 그라디언트 색 (hex) |
| sort_order | integer | 목록 정렬 순서 |
| created_at | timestamptz | |

예시 상품 6개: 데일리 머그컵(12,000) · 스티커 세트(4,500) · 캔버스 에코백(18,000) · 아크릴 키링(7,000) · 엽서 세트(8,000) · 오버핏 후드티(49,000)

### `orders` (주문/결제)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint (identity) | 내부 번호 |
| order_id | text unique | 토스 주문번호 `ORD-<32자리 hex>` (트리거가 생성) |
| user_id | uuid → auth.users | 주문자 |
| buyer_email | text | 주문자 이메일 (트리거가 채움, 관리자 화면용) |
| product_id | bigint → products | |
| product_name | text | 주문 당시 상품명 (트리거가 채움) |
| amount | integer | 주문 당시 가격 (트리거가 채움) |
| status | text | `pending`(결제 미완료) / `paid`(결제완료) / `failed`(실패) |
| payment_key | text | 토스 paymentKey (승인 후) |
| method | text | 결제수단, 간편결제면 `간편결제 (토스페이)` 형태 |
| approved_at | timestamptz | 승인 시각 |
| created_at | timestamptz | 주문 생성 시각 |

### 트리거 `orders_before_insert`
브라우저가 보낸 값과 상관없이 `user_id=auth.uid()`, `buyer_email`, `product_name`, `amount=products.price`, `order_id`, `status='pending'` 등을 강제로 채운다. → 가격 조작 불가.

### 함수 `is_admin()`
`auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` 이면 true.

### RLS 정책
| 테이블 | 동작 | 대상 | 조건 |
|---|---|---|---|
| products | SELECT | anon, authenticated | 모두 |
| orders | SELECT | authenticated | `user_id = auth.uid()` 또는 `is_admin()` |
| orders | INSERT | authenticated | `user_id = auth.uid()` 이고 `status = 'pending'` |
| orders | UPDATE/DELETE | — | 정책 없음 + 권한 회수 → 브라우저에서 불가. Edge Function(service_role)만 변경 |

## 4. 결제 흐름 (토스페이먼츠 결제위젯 v2, 테스트 모드)

```
checkout.html
  1. products 에서 상품 읽기
  2. TossPayments(clientKey).widgets({customerKey: user.id})
     setAmount(price) → renderPaymentMethods(#payment-method) + renderAgreement(#agreement)
  3. [결제하기] → orders INSERT {product_id}  ──▶ 트리거가 amount/order_id 확정 (status=pending)
  4. widgets.requestPayment({orderId, orderName, customerEmail, successUrl, failUrl})
        │
        ├─ 성공 → success.html?paymentKey&orderId&amount
        │     5. sb.functions.invoke('confirm-payment', {paymentKey, orderId, amount})
        │        Edge Function:
        │          a. Authorization 토큰으로 사용자 확인 (auth.getUser)
        │          b. orders 에서 order_id 조회, 주인 확인
        │          c. 이미 paid 면 그대로 성공 반환 (중복 호출 대비)
        │          d. amount 가 DB 금액과 다르면 failed 처리 후 거절
        │          e. POST https://api.tosspayments.com/v1/payments/confirm (Basic 시크릿키:)
        │          f. 성공 → status=paid, payment_key, method, approved_at 저장
        │             실패 → status=failed, 토스 오류 메시지 반환
        │
        └─ 실패/취소 → fail.html?code&message&orderId  (주문은 pending 으로 남음 = "결제 미완료")
```

- Edge Function은 `--no-verify-jwt` 로 배포하고, 함수 안에서 `auth.getUser(token)`으로 직접 로그인 검증한다.
- CORS: `Access-Control-Allow-Origin: *` (토큰 검증으로 보호).
- 필요한 시크릿: `TOSS_SECRET_KEY` (Supabase가 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 자동 제공).

## 5. 인증
- Supabase Auth 이메일/비밀번호. 이메일 인증 꺼짐(`mailer_autoconfirm=true`) → `signUp` 즉시 세션 발급.
- 비밀번호 최소 6자.
- Auth `site_url` / 허용 주소: `https://byrhee9-rgb.github.io/goods-shop/`
- 세션은 supabase-js가 브라우저 localStorage에 보관.
- 관리자 계정은 Admin API(`POST /auth/v1/admin/users`)로 `app_metadata.role='admin'`, `email_confirm=true` 로 생성.

## 6. 페이지별 접근 규칙
| 페이지 | 비로그인 | 일반 회원 | 관리자 |
|---|---|---|---|
| index | ✅ | ✅ | ✅ |
| login | ✅ | → 첫 화면으로 이동 | → admin 으로 이동 |
| checkout / success | → login | ✅ | ✅ |
| orders | → login | 내 주문 | 내 주문 (`user_id` 필터) |
| admin | → login | 🔒 안내 | 전체 주문 |

## 7. 설정값 목록
| 이름 | 위치 | 공개 여부 |
|---|---|---|
| SUPABASE_URL | js/config.js | 공개 |
| SUPABASE_ANON_KEY (legacy anon JWT) | js/config.js | 공개 (RLS로 보호) |
| TOSS_CLIENT_KEY `test_gck_docs_…` | js/config.js | 공개 |
| TOSS_SECRET_KEY `test_gsk_docs_…` | Supabase 함수 시크릿 | **비공개** |
| service_role 키 | Supabase 내부 | **비공개** |

## 8. 실서비스 전환 시 할 일
1. 토스 개발자센터 가입 → 내 라이브 키로 교체 (`TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`)
2. 관리자 비밀번호 변경
3. 이메일 인증 켜기 검토
4. Edge Function CORS를 사이트 주소로 제한
