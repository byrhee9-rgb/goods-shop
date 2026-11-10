// =====================================================================
// 사이트 설정값
// 여기 있는 값들은 모두 "공개해도 되는" 값이에요.
//  - SUPABASE_ANON_KEY : 브라우저용 공개 키 (데이터 보호는 DB의 RLS 규칙이 담당)
//  - TOSS_CLIENT_KEY   : 토스 결제창을 띄우는 공개 키 (테스트용 문서 키)
// ⚠️ 절대 넣으면 안 되는 값: service_role 키, 토스 시크릿 키(test_gsk_...)
// =====================================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://xvxyixihfmfcijxhhbxf.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2eHlpeGloZm1mY2lqeGhoYnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNjQ5MzksImV4cCI6MjEwOTg0MDkzOX0.G2xf7SDmmthmnB6C7cOvqICJ8VZXAfTfq0fy8VPpncU",
  TOSS_CLIENT_KEY: "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm",
  ADMIN_EMAIL: "admin@admin.com",
};
