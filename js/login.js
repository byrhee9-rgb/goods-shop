// 로그인 / 회원가입 페이지 (login.html)
(async () => {
  const user = await renderHeader();
  const params = new URLSearchParams(location.search);
  // 로그인 후 돌아갈 페이지 (같은 사이트 안의 .html 파일만 허용)
  const next = params.get("next");
  const goNext = (u) => {
    if (next && /^[a-z]+\.html(\?[\w=&%-]*)?$/i.test(next)) location.href = next;
    else location.href = isAdmin(u) ? "admin.html" : "index.html";
  };

  if (user) { goNext(user); return; }

  let mode = "login";
  const $ = (id) => document.getElementById(id);
  const msg = $("message");

  function setMode(m) {
    mode = m;
    $("tabLogin").classList.toggle("on", m === "login");
    $("tabSignup").classList.toggle("on", m === "signup");
    $("confirmWrap").hidden = m === "login";
    $("submitBtn").textContent = m === "login" ? "로그인" : "회원가입";
    $("password").autocomplete = m === "login" ? "current-password" : "new-password";
    showMessage(msg, "");
  }
  $("tabLogin").onclick = () => setMode("login");
  $("tabSignup").onclick = () => setMode("signup");
  if (params.get("mode") === "signup") setMode("signup");

  // Supabase 오류 메시지를 쉬운 한국어로 바꾸기
  function friendly(err) {
    const m = (err && err.message) || "";
    if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않아요.";
    if (/already registered|already been registered/i.test(m)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
    if (/at least 6/i.test(m)) return "비밀번호는 6자 이상이어야 해요.";
    if (/valid email|invalid format|is invalid/i.test(m)) return "이메일 형식이 올바르지 않아요.";
    if (/rate limit|too many/i.test(m)) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
    return "문제가 생겼어요: " + m;
  }

  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) return showMessage(msg, "이메일과 비밀번호를 입력해 주세요.");
    if (password.length < 6) return showMessage(msg, "비밀번호는 6자 이상이어야 해요.");
    if (mode === "signup" && password !== $("password2").value) {
      return showMessage(msg, "비밀번호 확인이 일치하지 않아요.");
    }

    $("submitBtn").disabled = true;
    showMessage(msg, mode === "login" ? "로그인 중..." : "가입하는 중...", "info");

    const { data, error } = mode === "login"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });

    $("submitBtn").disabled = false;
    if (error) return showMessage(msg, friendly(error));

    if (!data.session) {
      // 이메일 인증이 켜져 있으면 세션이 없어요 (현재 설정에서는 일어나지 않아야 함)
      return showMessage(msg, "가입은 되었지만 바로 로그인되지 않았어요. 로그인 탭에서 다시 로그인해 주세요.");
    }
    goNext(data.session.user);
  });
})();
