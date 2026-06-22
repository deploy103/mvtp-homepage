const serviceEditor = document.querySelector("[data-service-editor]");
const activityEditor = document.querySelector("[data-activity-editor]");
const adminForm = document.querySelector("[data-admin-form]");
const addActivityButton = document.querySelector("[data-add-activity]");
const logoutButton = document.querySelector("[data-admin-logout]");
const saveStatus = document.querySelector("[data-save-status]");

const stateOptions = [
  { value: "online", label: "정상" },
  { value: "warning", label: "점검" },
  { value: "offline", label: "중단" },
  { value: "neutral", label: "대기" },
];

let content = {
  serviceStatuses: [],
  activities: [],
};

function setSaveStatus(message) {
  if (saveStatus) saveStatus.textContent = message;
}

function createServiceRow(service) {
  const row = document.createElement("div");
  row.className = "admin-service-row";
  row.dataset.serviceId = service.id;
  row.dataset.serviceName = service.name;

  const label = document.createElement("strong");
  label.textContent = service.name;

  const statusInput = document.createElement("input");
  statusInput.type = "text";
  statusInput.name = `status-${service.id}`;
  statusInput.value = service.status || "";
  statusInput.placeholder = "운영중";
  statusInput.maxLength = 40;
  statusInput.autocomplete = "off";

  const stateSelect = document.createElement("select");
  stateSelect.name = `state-${service.id}`;

  stateOptions.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.value === service.state;
    stateSelect.append(optionElement);
  });

  row.append(label, statusInput, stateSelect);
  return row;
}

function createActivityRow(activity = { name: "" }) {
  const row = document.createElement("div");
  row.className = "admin-activity-row";

  const input = document.createElement("input");
  input.type = "text";
  input.name = "activity-name";
  input.value = activity.name || "";
  input.placeholder = "활동 이름";
  input.maxLength = 120;
  input.autocomplete = "off";

  const removeButton = document.createElement("button");
  removeButton.className = "button button-secondary admin-icon-button";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "활동 삭제");
  removeButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  `;
  removeButton.addEventListener("click", () => row.remove());

  row.append(input, removeButton);
  return row;
}

function renderContent() {
  serviceEditor.replaceChildren(...content.serviceStatuses.map(createServiceRow));
  activityEditor.replaceChildren(...content.activities.map(createActivityRow));
}

async function loadContent() {
  try {
    const response = await fetch("/api/site-content", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load site content");

    content = await response.json();
    renderContent();
    setSaveStatus("수정 가능");
  } catch {
    setSaveStatus("불러오기 실패");
  }
}

function collectContent() {
  const serviceStatuses = [...serviceEditor.querySelectorAll(".admin-service-row")].map((row) => ({
    id: row.dataset.serviceId,
    name: row.dataset.serviceName,
    status: row.querySelector("input").value.trim() || "운영중",
    state: row.querySelector("select").value,
  }));

  const activities = [...activityEditor.querySelectorAll("input")]
    .map((input) => ({ name: input.value.trim() }))
    .filter((activity) => activity.name);

  return {
    serviceStatuses,
    activities,
  };
}

addActivityButton.addEventListener("click", () => {
  activityEditor.append(createActivityRow());
  const input = activityEditor.querySelector(".admin-activity-row:last-child input");
  if (input) input.focus();
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setSaveStatus("저장 중");

  try {
    const response = await fetch("/api/site-content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(collectContent()),
    });

    if (response.status === 401) {
      window.location.href = "/adminpage";
      return;
    }

    if (!response.ok) throw new Error("Failed to save site content");

    content = await response.json();
    renderContent();
    setSaveStatus("저장 완료");
  } catch {
    setSaveStatus("저장 실패");
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin-logout", { method: "POST" });
  window.location.href = "/adminpage";
});

loadContent();
