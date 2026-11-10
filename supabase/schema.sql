-- =====================================================================
-- 굿즈 쇼핑몰 데이터베이스 설계
-- Supabase 프로젝트: xvxyixihfmfcijxhhbxf
-- 이 파일 하나로 테이블, 보안 규칙(RLS), 예시 상품을 모두 만듭니다.
-- 여러 번 실행해도 안전하도록 작성했습니다(이미 있으면 다시 만듦).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 관리자인지 확인하는 함수
--    로그인 정보(JWT)의 app_metadata.role 이 'admin' 이면 관리자.
--    app_metadata 는 서버(관리자 키)만 바꿀 수 있어 사용자가 조작할 수 없음.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------------------------------------------------------------------
-- 2) 상품 테이블
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  name        text    not null,
  description text    not null default '',
  price       integer not null check (price > 0),       -- 원 단위
  emoji       text    not null default '🎁',             -- 상품 그림 대신 쓰는 이모지
  color       text    not null default '#6366f1',        -- 카드 배경 그라디언트 색
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) 주문(결제) 테이블
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id           bigint generated always as identity primary key,
  order_id     text    not null unique,                  -- 토스에 보내는 주문번호
  user_id      uuid    not null references auth.users(id) on delete cascade,
  buyer_email  text,
  product_id   bigint  not null references public.products(id),
  product_name text    not null,
  amount       integer not null,
  status       text    not null default 'pending'
               check (status in ('pending', 'paid', 'failed')),
  payment_key  text,                                     -- 토스 결제 키 (승인 후 저장)
  method       text,                                     -- 결제수단 (카드, 간편결제 등)
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ---------------------------------------------------------------------
-- 4) 주문을 만들 때 자동으로 값 채우기 (가격 조작 방지)
--    브라우저는 product_id 만 보내면 되고, 나머지는 DB가 정합니다.
-- ---------------------------------------------------------------------
create or replace function public.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select name, price into p from public.products where id = new.product_id;
  if not found then
    raise exception '상품을 찾을 수 없어요 (product_id=%)', new.product_id;
  end if;

  new.user_id      := coalesce(auth.uid(), new.user_id);
  new.buyer_email  := (select email from auth.users where id = new.user_id);
  new.product_name := p.name;
  new.amount       := p.price;
  new.order_id     := 'ORD-' || replace(gen_random_uuid()::text, '-', '');
  new.status       := 'pending';
  new.payment_key  := null;
  new.method       := null;
  new.approved_at  := null;
  new.created_at   := now();
  return new;
end;
$$;

drop trigger if exists orders_before_insert on public.orders;
create trigger orders_before_insert
  before insert on public.orders
  for each row execute function public.orders_before_insert();

-- ---------------------------------------------------------------------
-- 5) 보안 규칙 (RLS: Row Level Security)
-- ---------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- 상품: 누구나 보기만 가능
drop policy if exists "products are public" on public.products;
create policy "products are public"
  on public.products for select
  to anon, authenticated
  using (true);

-- 주문 보기: 내 주문만, 관리자는 전체
drop policy if exists "read own orders or admin" on public.orders;
create policy "read own orders or admin"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 주문 만들기: 로그인한 사람이 자기 이름으로만 (값은 트리거가 채움)
drop policy if exists "create own pending order" on public.orders;
create policy "create own pending order"
  on public.orders for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- 수정/삭제 규칙은 일부러 만들지 않음 → 브라우저에서는 불가능.
-- 결제 승인 후 상태 변경은 서버 함수(confirm-payment)가 관리자 키로만 수행.

-- 권한 (Data API 로 접근할 수 있는 범위)
grant select on public.products to anon, authenticated;
grant select, insert on public.orders to authenticated;
revoke update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.products from anon, authenticated;
revoke all on public.orders from anon;

-- ---------------------------------------------------------------------
-- 6) 예시 상품 (상품이 하나도 없을 때만 넣음)
-- ---------------------------------------------------------------------
insert into public.products (name, description, price, emoji, color, sort_order)
select * from (values
  ('데일리 머그컵',   '아침 커피를 기분 좋게! 350ml 세라믹 머그컵',            12000, '☕', '#f59e0b', 1),
  ('스티커 세트',     '노트북, 다이어리 꾸미기용 방수 스티커 12종',              4500, '✨', '#ec4899', 2),
  ('캔버스 에코백',   '튼튼한 코튼 캔버스, A4 노트북도 쏙 들어가요',            18000, '👜', '#10b981', 3),
  ('아크릴 키링',     '양면 인쇄 아크릴 키링, 가방에 달기 딱 좋아요',            7000, '🔑', '#6366f1', 4),
  ('엽서 세트',       '감성 일러스트 엽서 8장 세트',                             8000, '💌', '#ef4444', 5),
  ('오버핏 후드티',   '도톰한 기모 후드티, 남녀공용 프리사이즈',                49000, '🧥', '#0ea5e9', 6)
) as v(name, description, price, emoji, color, sort_order)
where not exists (select 1 from public.products);
