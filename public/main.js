const page = document.body.dataset.page;

const SERVICE_ICONS = {
  hansei: ["blue", [["path", { d: "M3 21h18" }], ["path", { d: "M5 21V8l7-5 7 5v13" }], ["path", { d: "M9 21v-6h6v6" }], ["path", { d: "M10 10h4" }]]],
  rice: ["amber", [["path", { d: "M4 3h16" }], ["path", { d: "M5 3v10a7 7 0 0 0 14 0V3" }], ["path", { d: "M8 21h8" }], ["path", { d: "M12 17v4" }]]],
  calendar: ["coral", [["path", { d: "M8 2v4" }], ["path", { d: "M16 2v4" }], ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }], ["path", { d: "M3 10h18" }], ["path", { d: "M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" }]]],
  english: ["green", [["path", { d: "m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h8" }]]],
  japan: ["blue", [["circle", { cx: "12", cy: "12", r: "10" }], ["path", { d: "M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" }]]],
  login: ["amber", [["path", { d: "M15 7a2 2 0 1 0 2 2M14 6 3 17v3h3l11-11M9 15l3 3" }]]],
  "c-compiler": ["code", [["path", { d: "m16 18 6-6-6-6M8 6l-6 6 6 6M14 4l-4 16" }]]],
  medas: ["blue", [["path", { d: "M4 4h16v16H4zM8 8h8M8 12h5M16 16h.01" }]]],
  downloads: ["coral", [["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M12 18v-6M9 15l3 3 3-3" }]]],
  file: ["blue", [["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M10 10l-2 3 2 3M14 10l2 3-2 3" }]]],
  data: ["data", [["path", { d: "M4 19V5M4 19h16M7 15l3-4 3 2 5-6" }], ["circle", { cx: "7", cy: "15", r: "1" }], ["circle", { cx: "10", cy: "11", r: "1" }], ["circle", { cx: "13", cy: "13", r: "1" }], ["circle", { cx: "18", cy: "7", r: "1" }]]],
  hsoc: ["coral", [["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4" }]]],
  ctf: ["code", [["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9.5 12.5 11 14l3.5-4M8 7h8" }]]],
  network: ["blue", [["rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }], ["rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }], ["rect", { x: "8.5", y: "14", width: "7", height: "7", rx: "1" }], ["path", { d: "M10 6.5h4M8.5 14l-2-4M15.5 14l2-4" }]]],
  chat: ["green", [["path", { d: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4ZM8 9h8M8 13h5" }]]],
  flow: ["data", [["rect", { x: "3", y: "3", width: "6", height: "6", rx: "2" }], ["rect", { x: "15", y: "3", width: "6", height: "6", rx: "2" }], ["rect", { x: "9", y: "15", width: "6", height: "6", rx: "2" }], ["path", { d: "M9 6h6M6 9v2a4 4 0 0 0 4 4h2M18 9v2a4 4 0 0 1-4 4h-2" }]]],
};

function serviceIcon(id) {
  const specification = SERVICE_ICONS[id];
  if (!specification) return null;
  const [theme, parts] = specification;
  const wrapper = element("span", `project-icon project-icon-${theme}`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  parts.forEach(([tag, attributes]) => {
    const part = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => part.setAttribute(name, value));
    svg.append(part);
  });
  wrapper.append(svg);
  return wrapper;
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function safeHref(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value, window.location.origin);
    if (!["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) return "";
    if (value.startsWith("/") && !value.startsWith("//")) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.href;
  } catch {
    return "";
  }
}

function configureLink(anchor, href) {
  const safe = safeHref(href);
  if (!safe) return false;
  anchor.href = safe;
  if (/^https?:/i.test(safe) && new URL(safe).origin !== window.location.origin) {
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
  }
  return true;
}

function imageNode(src, alt, className = "") {
  const safe = typeof src === "string" && src.startsWith("/") && !src.startsWith("//") ? src : "";
  if (!safe) return null;
  const image = element("img", className);
  image.src = safe;
  image.alt = alt || "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => image.remove());
  return image;
}

function buttonLink(label, href, variant = "primary") {
  const anchor = element("a", `button button-${variant}`, label);
  if (!configureLink(anchor, href)) return null;
  const arrow = element("span", "button-arrow", "↗");
  arrow.setAttribute("aria-hidden", "true");
  anchor.append(arrow);
  return anchor;
}

function formatDate(value, options = { year: "numeric", month: "long", day: "numeric" }) {
  if (!value) return "날짜 미정";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", options).format(parsed);
}

function applySiteMetadata(data, titlePrefix = "") {
  const { site } = data;
  const pageTitle = titlePrefix
    ? `${titlePrefix} | ${site.siteName || site.title}`
    : site.seoTitle || site.title || site.siteName;
  document.title = pageTitle;
  document.querySelectorAll("[data-meta-description]").forEach((node) => {
    node.setAttribute("content", site.seoDescription || site.description || "");
  });
  document.querySelectorAll("[data-og-title]").forEach((node) => {
    node.setAttribute("content", pageTitle || site.title || site.siteName || "");
  });
  document.querySelectorAll("[data-og-description]").forEach((node) => {
    node.setAttribute("content", site.seoDescription || site.description || "");
  });
  document.querySelectorAll("[data-og-image]").forEach((node) => {
    node.setAttribute("content", site.ogImage || "");
  });
  document.querySelectorAll("[data-favicon]").forEach((node) => {
    if (site.favicon) {
      node.setAttribute("href", site.favicon);
      node.removeAttribute("type");
    } else node.remove();
  });
  document.querySelectorAll("[data-brand]").forEach((node) => {
    node.replaceChildren();
    const mark = imageNode(site.logoImage, "", "brand-logo") ||
      element("span", "brand-mark", (site.brandText || site.siteName || "M").slice(0, 1));
    const label = element("span", "brand-label", site.brandText || site.siteName || "Portfolio");
    node.append(mark, label);
  });
  document.querySelectorAll("[data-site-footer]").forEach((footer) => {
    footer.replaceChildren(
      element("span", "footer-brand", site.siteName || site.title),
      element("span", "footer-copy", site.footerText || site.description),
    );
  });
}

function sectionHeading(section) {
  const header = element("header", "section-heading");
  const copy = element("div", "section-heading-copy");
  if (section.eyebrow) copy.append(element("p", "eyebrow", section.eyebrow));
  copy.append(element("h2", "section-title", section.title));
  header.append(copy);
  if (section.description) header.append(element("p", "section-description", section.description));
  return header;
}

function renderHero(data, section) {
  const node = element("section", "hero-section");
  node.id = "top";
  node.dataset.sectionId = section.id;

  const background = element("div", "hero-background");
  background.setAttribute("aria-hidden", "true");
  const heroImage = imageNode(data.profile.heroImage, "", "hero-background-image");
  if (heroImage) {
    heroImage.loading = "eager";
    heroImage.decoding = "sync";
    heroImage.fetchPriority = "high";
    background.append(heroImage);
  }

  const inner = element("div", "hero-inner");
  const copy = element("div", "hero-copy");
  copy.append(
    element("p", "eyebrow", section.eyebrow || data.profile.displayName),
    element("h1", "hero-title", data.site.title || data.site.siteName),
    element("p", "hero-summary", section.description || data.site.description),
  );

  const actions = element("div", "hero-actions");
  const projects = buttonLink("서비스 보기", "#projects");
  const activities = buttonLink("활동 내역", "#activities", "secondary");
  const downloads = buttonLink("자료실", "/downloads", "secondary");
  if (projects) actions.append(projects);
  if (activities) actions.append(activities);
  if (downloads) actions.append(downloads);
  copy.append(actions);

  const status = element("aside", "hero-status");
  status.append(
    element("span", "live-dot"),
    element("span", "hero-status-label", "Server uptime"),
    element("strong", "", "확인 중"),
  );
  loadUptime(status.querySelector("strong"));

  inner.append(copy, status);
  node.append(background, inner);
  return node;
}

function renderAbout(data, section) {
  const node = element("section", "content-section about-section compact-section");
  node.id = section.id;
  node.dataset.sectionId = section.id;
  const layout = element("div", "profile-card");
  const identity = element("div", "profile-identity");
  identity.append(
    element("p", "eyebrow", "Profile"),
    element("h3", "", data.profile.displayName),
  );
  const facts = element("dl", "profile-summary-facts");
  [
    ["Role", data.profile.role],
    ["School", data.profile.school],
    ["Location", data.profile.location],
  ].filter(([, value]) => value).forEach(([label, value]) => {
    const group = element("div");
    group.append(element("dt", "", label), element("dd", "", value));
    facts.append(group);
  });
  const skillList = element("div", "profile-skills");
  data.skills.forEach((skill) => skillList.append(element("span", "tag", skill.name)));
  const more = buttonLink("프로필 전체 보기", "/about", "text");
  identity.append(skillList);
  if (more) identity.append(more);
  layout.append(identity, facts);
  node.append(sectionHeading(section), layout);
  return node;
}

function renderSkills(data, section) {
  const node = element("section", "content-section skills-section");
  node.id = section.id;
  node.dataset.sectionId = section.id;
  node.append(sectionHeading(section));
  if (!data.skills.length) {
    node.append(element("p", "empty-state", "표시할 기술이 없습니다."));
    return node;
  }
  const groups = new Map();
  data.skills.forEach((skill) => {
    if (!groups.has(skill.category)) groups.set(skill.category, []);
    groups.get(skill.category).push(skill);
  });
  const grid = element("div", "skill-groups");
  groups.forEach((skills, category) => {
    const group = element("article", "skill-group");
    group.append(element("h3", "skill-category", category));
    const list = element("div", "skill-list");
    skills.forEach((skill) => {
      const item = element("div", "skill-item");
      const image = imageNode(skill.image, skill.name, "skill-image");
      const copy = element("div", "skill-copy");
      copy.append(element("strong", "", skill.name), element("p", "", skill.description));
      if (skill.proficiency > 0) {
        const meter = element("progress", "skill-meter");
        meter.setAttribute("aria-label", `${skill.name} 숙련도`);
        meter.max = 100;
        meter.value = skill.proficiency;
        copy.append(meter);
      }
      if (image) item.append(image);
      item.append(copy);
      list.append(item);
    });
    group.append(list);
    grid.append(group);
  });
  node.append(grid);
  return node;
}

function projectCard(project) {
  const target = project.demoUrl || project.githubUrl;
  const canOpen = project.state === "online" && target;
  const card = element(canOpen ? "a" : "article", `project-card state-${project.state}${project.featured ? " is-featured" : ""}`);
  if (canOpen) configureLink(card, target);
  const image = imageNode(project.image, project.title, "project-image");
  if (image) card.append(image);
  const top = element("div", "project-topline");
  const kind = element("span", "project-kind");
  const icon = serviceIcon(project.id);
  if (icon) kind.append(icon);
  kind.append(element("span", "project-category", project.category));
  top.append(kind);
  const status = element("span", "project-status");
  status.append(element("i", "status-dot"), document.createTextNode(project.status));
  top.append(status);
  card.append(top, element("h3", "", project.title), element("p", "", project.summary));
  const footer = element("div", "project-footer");
  if (project.technologies.length) {
    footer.append(element("span", "project-stack", project.technologies.slice(0, 3).join(" · ")));
  }
  footer.append(element("span", "project-open", canOpen ? "바로가기 ↗" : "현재 이용할 수 없음"));
  card.append(footer);
  return card;
}

function renderProjects(data, section) {
  const node = element("section", "content-section projects-section");
  node.id = section.id;
  node.dataset.sectionId = section.id;
  node.append(sectionHeading(section));
  if (!data.projects.length) {
    node.append(element("p", "empty-state", "표시할 프로젝트가 없습니다."));
    return node;
  }
  const grid = element("div", "project-grid");
  data.projects.forEach((project) => grid.append(projectCard(project)));
  node.append(grid);
  return node;
}

async function loadUptime(target) {
  if (!target) return;
  try {
    const response = await fetch("/api/uptime", { cache: "no-store" });
    if (!response.ok) throw new Error("uptime unavailable");
    const uptime = await response.json();
    target.textContent = uptime.formatted;
  } catch {
    target.textContent = "확인 불가";
  }
}

function renderOperations(data, section) {
  const sectionNode = element("section", "content-section operations-section");
  sectionNode.id = section.id;
  sectionNode.dataset.sectionId = section.id;
  sectionNode.append(sectionHeading(section));
  if (!data.operations.length) {
    sectionNode.append(element("p", "empty-state", "표시할 운영 안내가 없습니다."));
    return sectionNode;
  }
  const grid = element("div", "operation-grid");
  data.operations.forEach((operation, index) => {
    const card = element("article", "operation-card");
    const number = element("span", "operation-number", String(index + 1).padStart(2, "0"));
    card.append(
      number,
      element("p", "eyebrow", operation.eyebrow),
      element("h3", "", operation.title),
      element("p", "operation-description", operation.description),
    );
    if (operation.highlights.length) {
      const highlights = element("div", "operation-highlights");
      operation.highlights.forEach((highlight) => highlights.append(element("span", "", highlight)));
      card.append(highlights);
    }
    grid.append(card);
  });
  sectionNode.append(grid);
  return sectionNode;
}

function activityCard(activity) {
  const article = element("article", "activity-row");
  const date = element("time", "activity-date", activity.date ? formatDate(activity.date, { month: "2-digit", day: "2-digit" }) : "");
  const copy = element("div", "activity-copy");
  copy.append(element("h4", "", activity.title));
  if (activity.summary || activity.detail) copy.append(element("p", "", activity.summary || activity.detail));
  if (activity.tags.length) {
    const tags = element("div", "tag-list");
    activity.tags.forEach((tag) => tags.append(element("span", "tag", tag)));
    copy.append(tags);
  }
  const categoryLabels = {
    Award: "수상",
    Education: "교육",
    Organization: "교내 활동",
    Team: "팀 활동",
  };
  const meta = element("div", "activity-row-meta");
  if (activity.category) meta.append(element("span", "activity-category", categoryLabels[activity.category] || activity.category));
  const hasDetails = Boolean(activity.summary || activity.detail || activity.coverImage || activity.images.length || activity.url);
  if (hasDetails) {
    const details = element("a", "text-link", "자세히 ↗");
    details.href = `/activities/${encodeURIComponent(activity.slug)}`;
    meta.append(details);
  }
  const cover = imageNode(activity.coverImage, activity.title, "activity-cover");
  article.append(date, copy);
  if (cover) article.append(cover);
  article.append(meta);
  return article;
}

function renderActivities(data, section) {
  const node = element("section", "content-section activities-section");
  node.id = section.id;
  node.dataset.sectionId = section.id;
  node.append(sectionHeading(section));
  if (!data.activities.length) {
    node.append(element("p", "empty-state", "표시할 활동이 없습니다."));
    return node;
  }
  const grouped = new Map();
  const currentYear = String(new Date().getFullYear());
  data.activities.forEach((activity) => {
    const createdYear = /^\d{4}/.test(activity.createdAt || "") ? activity.createdAt.slice(0, 4) : "";
    const key = activity.year ? String(activity.year) : createdYear || currentYear;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(activity);
  });
  const years = [...grouped.keys()].sort((left, right) => Number(right) - Number(left));
  const yearNav = element("nav", "year-nav");
  yearNav.setAttribute("aria-label", "활동 연도");
  const timeline = element("div", "activity-years");
  years.forEach((year) => {
    const anchor = element("a", "year-link", year);
    anchor.href = `#activities-${year}`;
    yearNav.append(anchor);

    const group = element("section", "activity-year-group");
    group.id = `activities-${year}`;
    const heading = element("header", "activity-year-heading");
    heading.append(
      element("h3", "", year),
      element("span", "", `${grouped.get(year).length}개`),
    );
    const list = element("div", "activity-list");
    grouped.get(year).forEach((activity) => list.append(activityCard(activity)));
    group.append(heading, list);
    timeline.append(group);
  });
  node.append(yearNav, timeline);
  return node;
}

function renderContact(data, section) {
  const node = element("section", "content-section contact-section");
  node.id = section.id;
  node.dataset.sectionId = section.id;
  const copy = sectionHeading(section);
  const links = element("div", "contact-links");
  data.socialLinks.forEach((item) => {
    const link = element("a", "contact-link");
    if (!configureLink(link, item.url)) return;
    link.append(
      element("span", "contact-label", item.label),
      element("strong", "", item.value || item.url),
      element("span", "contact-arrow", "↗"),
    );
    links.append(link);
  });
  if (!links.childElementCount) links.append(element("p", "empty-state", "공개된 연락 링크가 없습니다."));
  node.append(copy, links);
  return node;
}

const sectionRenderers = {
  hero: renderHero,
  about: renderAbout,
  skills: renderSkills,
  projects: renderProjects,
  operations: renderOperations,
  activities: renderActivities,
  contact: renderContact,
};

function renderHome(data) {
  const root = document.querySelector("[data-home-root]");
  const nav = document.querySelector("[data-primary-nav]");
  root.replaceChildren();
  nav.replaceChildren();
  const navLabels = {
    projects: "서비스",
    activities: "활동",
    about: "프로필",
    contact: "연락처",
  };
  data.sections.forEach((section) => {
    const renderer = sectionRenderers[section.id];
    if (!renderer) return;
    root.append(renderer(data, section));
    if (navLabels[section.id]) {
      const link = element("a", "", navLabels[section.id]);
      link.href = `#${section.id}`;
      nav.append(link);
    }
  });
  const downloads = element("a", "", "Downloads");
  downloads.href = "/downloads";
  nav.append(downloads);
}

function profileFacts(profile) {
  const facts = element("dl", "profile-fact-grid");
  [
    ["Role", profile.role],
    ["School", profile.school],
    ["Location", profile.location],
    ["Email", profile.email],
    ["Phone", profile.phone],
  ].filter(([, value]) => value).forEach(([label, value]) => {
    const group = element("div");
    group.append(element("dt", "", label), element("dd", "", value));
    facts.append(group);
  });
  return facts;
}

function renderAboutPage(data) {
  applySiteMetadata(data, data.profile.displayName || "Profile");
  const root = document.querySelector("[data-about-root]");
  root.replaceChildren();
  const hero = element("section", "profile-page-hero");
  const copy = element("div");
  copy.append(
    element("p", "eyebrow", "Profile"),
    element("h1", "", data.profile.displayName),
    element("p", "profile-summary", data.profile.shortBio),
  );
  const photo = imageNode(data.profile.profileImage, data.profile.displayName, "profile-page-image");
  if (photo) {
    photo.loading = "eager";
    photo.decoding = "sync";
  }
  hero.append(copy);
  if (photo) hero.append(photo);
  const details = element("section", "profile-page-details");
  const narrative = element("article", "profile-narrative");
  const aboutSection = data.sections.find((section) => section.id === "about");
  narrative.append(element("p", "eyebrow", "About"), element("h2", "", aboutSection?.title || "프로필"));
  data.profile.aboutParagraphs.forEach((paragraph) => narrative.append(element("p", "", paragraph)));
  if (data.profile.highlight) narrative.append(element("strong", "profile-highlight", data.profile.highlight));
  const aside = element("aside", "profile-aside");
  aside.append(profileFacts(data.profile));
  const contacts = element("div", "profile-contact-list");
  data.socialLinks.forEach((item) => {
    const link = element("a", "profile-contact-link");
    if (!configureLink(link, item.url)) return;
    link.append(element("span", "", item.label), element("strong", "", item.value || item.url));
    contacts.append(link);
  });
  if (!contacts.childElementCount) contacts.append(element("p", "empty-state", "공개된 연락 링크가 없습니다."));
  aside.append(contacts);
  details.append(narrative, aside);
  root.append(hero, details);
}

function renderDownloadsPage(data) {
  applySiteMetadata(data, "Downloads");
  const root = document.querySelector("[data-downloads-root]");
  root.replaceChildren();
  const hero = element("section", "subpage-hero");
  const heading = element("div");
  const downloadsProject = data.projects.find((project) => project.id === "downloads");
  heading.append(
    element("p", "eyebrow", "Download center"),
    element("h1", "", "자료실"),
    element("p", "", downloadsProject?.summary || data.site.description),
  );
  const count = element("div", "count-card");
  count.append(element("span", "", "Public files"), element("strong", "", String(data.downloads.length)));
  hero.append(heading, count);
  const list = element("section", "download-list");
  list.setAttribute("aria-label", "다운로드 파일");
  if (!data.downloads.length) list.append(element("p", "empty-state", "공개된 파일이 없습니다."));
  data.downloads.forEach((download) => {
    const card = element("article", "download-card");
    const copy = element("div", "download-copy");
    copy.append(
      element("p", "eyebrow", download.type),
      element("h2", "", download.title),
      element("p", "", download.description),
    );
    const action = buttonLink("다운로드", download.fileUrl);
    if (action) action.setAttribute("download", download.fileName || "");
    const metadata = element("dl", "download-meta");
    [
      ["File", download.fileName],
      ["Size", download.size],
      ["Platform", download.platform],
      ["Published", formatDate(download.date, { year: "numeric", month: "2-digit", day: "2-digit" })],
    ].filter(([, value]) => value).forEach(([label, value]) => {
      const group = element("div");
      group.append(element("dt", "", label), element("dd", "", value));
      metadata.append(group);
    });
    card.append(copy);
    if (action) card.append(action);
    card.append(metadata);
    if (download.checksum) {
      const checksum = element("div", "checksum");
      checksum.append(element("span", "", "SHA-256"), element("code", "", download.checksum));
      card.append(checksum);
    }
    if (download.note) card.append(element("p", "download-note", download.note));
    list.append(card);
  });
  root.append(hero, list);
}

function renderActivityPage(data) {
  const root = document.querySelector("[data-activity-root]");
  const parts = window.location.pathname.split("/").filter(Boolean);
  let slug = "";
  try {
    slug = decodeURIComponent(parts[1] || "");
  } catch {
    slug = "";
  }
  const activity = data.activities.find((item) => item.slug === slug);
  root.replaceChildren();
  if (!activity) {
    const missing = element("section", "not-found");
    missing.append(element("p", "eyebrow", "404"), element("h1", "", "활동을 찾을 수 없습니다."));
    const back = buttonLink("활동 목록", "/#activities", "secondary");
    if (back) missing.append(back);
    root.append(missing);
    document.title = `Not found | ${data.site.siteName}`;
    return;
  }
  applySiteMetadata(data, activity.title);
  const article = element("article", "activity-detail");
  const header = element("header", "activity-detail-header");
  const meta = element("div", "activity-meta");
  if (activity.date) meta.append(element("time", "", formatDate(activity.date)));
  if (activity.category) meta.append(element("span", "", activity.category));
  header.append(meta, element("h1", "", activity.title));
  if (activity.summary) header.append(element("p", "activity-detail-summary", activity.summary));
  const cover = imageNode(activity.coverImage, activity.title, "activity-detail-cover");
  article.append(header);
  if (cover) article.append(cover);
  if (activity.detail) article.append(element("div", "activity-detail-copy", activity.detail));
  if (!activity.detail && !activity.summary && !activity.coverImage && !activity.images.length) {
    article.append(element("p", "empty-state", "상세 내용이 아직 등록되지 않았습니다."));
  }
  if (activity.tags.length) {
    const tags = element("div", "tag-list");
    activity.tags.forEach((tag) => tags.append(element("span", "tag", tag)));
    article.append(tags);
  }
  if (activity.images.length) {
    const gallery = element("section", "activity-gallery");
    gallery.append(element("h2", "", "Gallery"));
    const grid = element("div");
    activity.images.forEach((src, index) => {
      const image = imageNode(src, `${activity.title} 이미지 ${index + 1}`, "");
      if (image) grid.append(image);
    });
    gallery.append(grid);
    article.append(gallery);
  }
  if (activity.url) {
    const related = buttonLink("관련 링크", activity.url, "secondary");
    if (related) article.append(related);
  }
  root.append(article);
}

function showLoadError() {
  const root = document.querySelector("[data-home-root], [data-about-root], [data-downloads-root], [data-activity-root]");
  if (!root) return;
  const state = element("div", "page-state page-state-error");
  state.append(element("strong", "", "콘텐츠를 불러오지 못했습니다."), element("p", "", "잠시 후 다시 시도해 주세요."));
  const retry = element("button", "button button-secondary", "다시 시도");
  retry.type = "button";
  retry.addEventListener("click", loadPage);
  state.append(retry);
  root.replaceChildren(state);
}

async function loadPage() {
  try {
    const response = await fetch("/api/site-content", { cache: "no-store" });
    if (!response.ok) throw new Error("content unavailable");
    const data = await response.json();
    applySiteMetadata(data);
    if (page === "home") renderHome(data);
    if (page === "about") renderAboutPage(data);
    if (page === "downloads") renderDownloadsPage(data);
    if (page === "activity") renderActivityPage(data);
  } catch {
    showLoadError();
  }
}

const navToggle = document.querySelector("[data-nav-toggle]");
const primaryNav = document.querySelector("[data-primary-nav]");
if (navToggle && primaryNav) {
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") !== "true";
    navToggle.setAttribute("aria-expanded", String(open));
    primaryNav.classList.toggle("is-open", open);
  });
  primaryNav.addEventListener("click", () => {
    navToggle.setAttribute("aria-expanded", "false");
    primaryNav.classList.remove("is-open");
  });
}

loadPage();
