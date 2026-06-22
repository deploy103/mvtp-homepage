const uptimeText = document.querySelector("[data-uptime-live]");
const uptimeBoot = document.querySelector("[data-uptime-boot]");
const serviceCards = document.querySelectorAll("[data-service-id]");
const activityList = document.querySelector("[data-activity-list]");

let snapshot = null;

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${secs}초`;
  return `${secs}초`;
}

function renderUptime() {
  if (!snapshot || !uptimeText || !uptimeBoot) return;

  const liveSeconds = snapshot.uptimeSeconds + Math.floor((Date.now() - snapshot.receivedAt) / 1000);
  uptimeText.textContent = formatDuration(liveSeconds);
  uptimeBoot.textContent = `Boot: ${new Date(snapshot.bootedAt).toLocaleString("ko-KR")}`;
}

async function loadUptime() {
  if (!uptimeText || !uptimeBoot) return;

  try {
    const response = await fetch("/api/uptime", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load uptime");

    const data = await response.json();
    snapshot = {
      uptimeSeconds: Number(data.uptimeSeconds) || 0,
      bootedAt: data.bootedAt,
      receivedAt: Date.now(),
    };

    renderUptime();
  } catch {
    uptimeText.textContent = "업타임을 불러오지 못했습니다.";
    uptimeBoot.textContent = "API 연결 확인 필요";
  }
}

function renderServiceStatuses(services = []) {
  if (!serviceCards.length) return;

  const servicesById = new Map(services.map((service) => [service.id, service]));

  serviceCards.forEach((card) => {
    const service = servicesById.get(card.dataset.serviceId);
    const status = card.querySelector("[data-service-status]");

    if (!service || !status) return;

    status.textContent = service.status;
    status.className = `service-status service-status-${service.state || "neutral"}`;
  });
}

function renderActivities(activities = []) {
  if (!activityList) return;

  activityList.replaceChildren(
    ...activities.map((activity) => {
      const article = document.createElement("article");
      const name = document.createElement("strong");
      name.textContent = activity.name;
      article.append(name);
      return article;
    }),
  );
}

async function loadSiteContent() {
  if (!serviceCards.length && !activityList) return;

  try {
    const response = await fetch("/api/site-content", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load site content");

    const data = await response.json();
    renderServiceStatuses(data.serviceStatuses || []);
    renderActivities(data.activities || []);
  } catch {
    if (activityList && !activityList.children.length) {
      const article = document.createElement("article");
      const name = document.createElement("strong");
      name.textContent = "활동 내역을 불러오지 못했습니다.";
      article.append(name);
      activityList.append(article);
    }
  }
}

loadUptime();
loadSiteContent();
window.setInterval(loadUptime, 30000);
window.setInterval(renderUptime, 1000);
