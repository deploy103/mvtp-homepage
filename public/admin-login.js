const loginForm = document.querySelector("[data-admin-login-form]");
const loginMessage = document.querySelector("[data-login-message]");
const submitButton = loginForm.querySelector("button[type='submit']");

function setLoginMessage(message) {
  loginMessage.textContent = message;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  submitButton.disabled = true;
  setLoginMessage("인증 정보를 확인하고 있습니다.");
  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: formData.get("id"), password: formData.get("password") }),
    });
    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    if (!response.ok) {
      if (response.status === 429) setLoginMessage("로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      else if (response.status === 503) setLoginMessage("서버에 관리자 계정 설정이 필요합니다.");
      else if (response.status === 403) setLoginMessage("허용되지 않은 요청입니다.");
      else setLoginMessage(result?.error || "ID 또는 비밀번호가 맞지 않습니다.");
      return;
    }
    window.location.replace("/adminpage");
  } catch {
    setLoginMessage("서버에 연결하지 못했습니다.");
  } finally {
    submitButton.disabled = false;
  }
});
