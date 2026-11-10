# 굿즈샵 (goods-shop)

굿즈를 판매하는 작은 쇼핑몰 웹사이트. 회원가입/로그인 → 상품 보고 결제 → 내 결제내역, 그리고 관리자가 전체 결제내역을 보는 페이지로 구성된다.
세부 구조(파일 역할, DB, 결제 흐름)는 **[ARCH.md](ARCH.md)** 참고.

## 사용자에 대해
- 사용자는 **비개발자 입문자**다. 설명·질문은 쉬운 한국어로, 전문용어는 한 줄 비유와 함께 쓴다.
- 질문할 때는 열린 질문보다 "추천안 + 선택지"로 묻는다.

## 주소
| 항목 | 값 |
|---|---|
| 사이트 | https://byrhee9-rgb.github.io/goods-shop/ |
| GitHub 저장소 | https://github.com/byrhee9-rgb/goods-shop (public, `main` 브랜치 루트를 Pages로 배포) |
| Supabase 프로젝트 | ref `xvxyixihfmfcijxhhbxf` (서울, ap-northeast-2) · https://supabase.com/dashboard/project/xvxyixihfmfcijxhhbxf |
| Edge Function | `confirm-payment` (토스 결제 최종 승인) |

## 기술 구성
- **프론트엔드**: 순수 HTML/CSS/JS (빌드 도구 없음). GitHub Pages가 정적 파일로 서빙.
- **라이브러리(CDN)**: `@supabase/supabase-js@2.45.4` (UMD), 토스페이먼츠 SDK v2 (`https://js.tosspayments.com/v2/standard`)
- **백엔드**: Supabase (Auth + Postgres + RLS + Edge Function)
- **결제**: 토스페이먼츠 **테스트 모드**, 결제위젯 v2. 토스 공식 문서의 공개 테스트 키(`test_gck_docs_…` / `test_gsk_docs_…`) 사용.

## 계정
- 관리자: `admin@admin.com` / `superadmin` (테스트용 약한 비밀번호 — 실서비스 전 반드시 변경)
- 관리자 판별: `auth.users.raw_app_meta_data.role = 'admin'` (JWT의 `app_metadata.role`). 사용자가 스스로 바꿀 수 없는 값.
- Supabase Auth 설정: 이메일 인증 **꺼짐** (`mailer_autoconfirm = true`) → 가입 즉시 로그인.

## 토큰/키 보관 위치 (값은 절대 파일에 적지 말 것)
- GitHub 토큰: Windows 사용자 환경변수 `GH_TOKEN` (`gh` CLI가 자동 사용)
- Supabase 개인 토큰: Windows 사용자 환경변수 `SUPABASE_ACCESS_TOKEN` (`supabase` CLI가 자동 사용, 실행파일 `C:\Users\admin\bin\supabase.exe`)
- 토스 시크릿 키: Supabase Edge Function 시크릿 `TOSS_SECRET_KEY` 에만 저장
- `js/config.js` 에는 **공개 가능한 값만**: Supabase URL, anon 키, 토스 클라이언트 키

## 작업 규칙
1. **service_role 키, 토스 시크릿 키(`test_gsk_`/`live_gsk_`)는 프론트엔드 파일에 절대 넣지 않는다.** GitHub Pages는 전부 공개된다.
2. 데이터 보호는 화면이 아니라 **DB의 RLS 규칙**으로 한다. 새 테이블을 만들면 반드시 RLS를 켜고 정책을 만든다.
3. 금액은 브라우저 값을 믿지 않는다. 주문 금액은 DB 트리거가 `products.price`로 정하고, 승인 함수가 다시 대조한다.
4. DB 구조를 바꾸면 `supabase/schema.sql`도 같이 고치고, ARCH.md의 DB 섹션을 갱신한다.
5. 화면 문구·오류 메시지는 쉬운 한국어 존댓말("~해요")로 쓴다.
6. 새 페이지는 기존 페이지처럼 `<header id="header">` + `js/config.js` → `js/common.js` → 페이지 JS 순서로 불러온다.

## 배포 방법
```bash
# 1) 웹페이지 (GitHub Pages): 커밋 후 push 하면 1~2분 뒤 반영
git add -A && git commit -m "..." && git push

# 2) DB 구조 변경: schema.sql 을 Supabase Management API로 실행
#    POST https://api.supabase.com/v1/projects/xvxyixihfmfcijxhhbxf/database/query  {"query": "..."}

# 3) 결제 승인 함수
supabase functions deploy confirm-payment --remote=xvxyixihfmfcijxhhbxf --no-verify-jwt --use-api --yes
supabase secrets set TOSS_SECRET_KEY=... --remote=xvxyixihfmfcijxhhbxf --yes
```
- Supabase CLI는 운영 프로젝트를 바꾸는 명령에 `--yes`(동의)를 요구한다. 사용자가 승인한 작업에만 붙인다.

## 테스트 결제 방법
사이트 접속 → 회원가입 → 상품 [구매하기] → 결제수단 선택(카드 등, 테스트라 아무 정보 입력 가능) → 결제 → 성공 페이지 → [내 결제내역]에서 "결제완료" 확인 → admin 계정으로 [관리자] 페이지에서 전체 내역 확인.
