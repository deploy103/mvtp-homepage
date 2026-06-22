const loginForm = document.querySelector("[data-admin-login-form]");
const loginMessage = document.querySelector("[data-login-message]");

function setLoginMessage(message) {
  if (loginMessage) loginMessage.textContent = message;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginMessage("로그인 중");

  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/admin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: formData.get("id"),
        password: formData.get("password"),
      }),
    });

    if (!response.ok) {
      setLoginMessage(response.status === 503 ? "관리자 계정 설정이 필요합니다." : "ID 또는 비밀번호가 맞지 않습니다.");
      return;
    }

    window.location.href = "/adminpage";
  } catch {
    setLoginMessage("로그인 요청에 실패했습니다.");
  }
});
