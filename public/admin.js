const adminContent = document.querySelector("[data-admin-content]");
const saveButton = document.querySelector("[data-save-content]");
const saveStatus = document.querySelector("[data-save-status]");
const panelTitle = document.querySelector("[data-panel-title]");
const sidebar = document.querySelector("[data-admin-sidebar]");
const toast = document.querySelector("[data-admin-toast]");
const mediaInput = document.querySelector("[data-media-input]");
const mediaDropzone = document.querySelector("[data-media-dropzone]");
const mediaProgress = document.querySelector("[data-media-progress]");

const PANEL_TITLES = {
  dashboard: "Dashboard",
  site: "Site & SEO",
  profile: "Profile",
  links: "Links",
  skills: "Skills",
  projects: "Projects",
  activities: "Activities",
  sections: "Sections",
  operations: "Operation guide",
  downloads: "Downloads",
  media: "Media",
};

const collectionSpecifications = {
  socialLinks: {
    titleKey: "label",
    fields: [
      { key: "label", label: "링크 이름", required: true, maxLength: 80 },
      { key: "value", label: "표시 값", maxLength: 180 },
      { key: "url", label: "URL / mailto / tel", type: "urlText", wide: true, maxLength: 2048 },
      { key: "visible", label: "공개", type: "toggle" },
    ],
    create: () => ({ id: uniqueId("social"), label: "", value: "", url: "", visible: true }),
  },
  skills: {
    titleKey: "name",
    fields: [
      { key: "name", label: "이름", required: true, maxLength: 120 },
      { key: "category", label: "카테고리", required: true, maxLength: 100 },
      { key: "description", label: "설명", type: "textarea", wide: true, rows: 3, maxLength: 800 },
      { key: "proficiency", label: "숙련도 (0이면 숨김)", type: "number", min: 0, max: 100 },
      { key: "image", label: "아이콘 / 이미지", type: "image", wide: true },
      { key: "visible", label: "공개", type: "toggle" },
    ],
    create: () => ({
      id: uniqueId("skill"), name: "", category: "Other", description: "", proficiency: 0,
      image: "", visible: true,
    }),
  },
  projects: {
    titleKey: "title",
    fields: [
      { key: "title", label: "프로젝트 이름", required: true, maxLength: 180 },
      { key: "category", label: "카테고리", maxLength: 100 },
      { key: "summary", label: "요약", type: "textarea", wide: true, rows: 3, maxLength: 1200 },
      { key: "detail", label: "상세 설명", type: "textarea", wide: true, rows: 6, maxLength: 12000 },
      { key: "startDate", label: "시작일", type: "date" },
      { key: "endDate", label: "종료일", type: "date" },
      { key: "technologies", label: "기술 스택", type: "list", wide: true, hint: "쉼표 또는 줄바꿈으로 구분" },
      { key: "githubUrl", label: "GitHub URL", type: "url", maxLength: 2048 },
      { key: "demoUrl", label: "Demo URL", type: "urlText", maxLength: 2048 },
      { key: "image", label: "대표 이미지", type: "image", wide: true },
      { key: "status", label: "표시 상태", maxLength: 60 },
      { key: "state", label: "접속 상태", type: "select", options: [
        ["online", "정상"], ["warning", "점검"], ["offline", "중단"], ["neutral", "대기"],
      ] },
      { key: "featured", label: "주요 프로젝트", type: "toggle" },
      { key: "visible", label: "공개", type: "toggle" },
    ],
    create: () => ({
      id: uniqueId("project"), title: "", summary: "", detail: "", category: "Project",
      startDate: "", endDate: "", technologies: [], githubUrl: "", demoUrl: "", image: "",
      status: "준비중", state: "neutral", featured: false, visible: true,
    }),
  },
  activities: {
    titleKey: "title",
    fields: [
      { key: "title", label: "활동 제목", required: true, maxLength: 220 },
      { key: "slug", label: "URL Slug", maxLength: 120 },
      { key: "summary", label: "간단한 설명", type: "textarea", wide: true, rows: 3, maxLength: 1200 },
      { key: "detail", label: "상세 설명", type: "textarea", wide: true, rows: 7, maxLength: 16000 },
      { key: "date", label: "활동 날짜", type: "date" },
      { key: "category", label: "카테고리", maxLength: 100 },
      { key: "coverImage", label: "대표 이미지", type: "image", wide: true },
      { key: "images", label: "추가 이미지", type: "imageList", wide: true, hint: "최대 12개, 미디어 선택 또는 직접 업로드" },
      { key: "url", label: "관련 URL", type: "urlText", wide: true, maxLength: 2048 },
      { key: "tags", label: "태그", type: "list", wide: true, hint: "쉼표 또는 줄바꿈으로 구분" },
      { key: "visible", label: "공개", type: "toggle" },
    ],
    create: () => {
      const now = new Date().toISOString();
      return {
        id: uniqueId("activity"), slug: "", title: "", summary: "", detail: "", date: "",
        category: "Activity", coverImage: "", images: [], url: "", tags: [], visible: true,
        createdAt: now, updatedAt: now,
      };
    },
  },
  operations: {
    titleKey: "title",
    fields: [
      { key: "eyebrow", label: "짧은 분류", maxLength: 80 },
      { key: "title", label: "제목", required: true, maxLength: 160 },
      { key: "description", label: "설명", type: "textarea", wide: true, rows: 4, maxLength: 1600 },
      { key: "highlights", label: "핵심 항목", type: "list", wide: true, hint: "쉼표 또는 줄바꿈으로 구분" },
      { key: "visible", label: "공개", type: "toggle" },
    ],
    create: () => ({
      id: uniqueId("operation"), eyebrow: "Guide", title: "", description: "", highlights: [], visible: true,
    }),
  },
  sections: {
    titleKey: "label",
    fixed: true,
    fields: [
      { key: "label", label: "메뉴 이름", required: true, maxLength: 80 },
      { key: "eyebrow", label: "Eyebrow", maxLength: 120 },
      { key: "title", label: "제목", required: true, maxLength: 180, wide: true },
      { key: "description", label: "설명", type: "textarea", wide: true, rows: 3, maxLength: 1200 },
      { key: "visible", label: "표시", type: "toggle" },
    ],
  },
  downloads: {
    titleKey: "title",
    fields: [
      { key: "title", label: "표시 이름", required: true, maxLength: 220 },
      { key: "type", label: "유형", maxLength: 100 },
      { key: "description", label: "설명", type: "textarea", wide: true, rows: 3, maxLength: 1600 },
      { key: "fileUrl", label: "파일 URL", type: "urlText", wide: true, maxLength: 2048 },
      { key: "fileName", label: "파일명", maxLength: 240 },
      { key: "size", label: "표시 크기", maxLength: 60 },
      { key: "platform", label: "플랫폼", maxLength: 80 },
      { key: "date", label: "공개일", type: "date" },
      { key: "checksum", label: "SHA-256", wide: true, maxLength: 160 },
      { key: "note", label: "안내 문구", type: "textarea", wide: true, rows: 3, maxLength: 1600 },
      { key: "visible", label: "공개", type: "toggle" },
    ],
    create: () => ({
      id: uniqueId("download"), title: "", type: "", description: "", fileUrl: "", fileName: "",
      size: "", platform: "", date: "", checksum: "", note: "", visible: true,
    }),
  },
};

let content = null;
let csrfToken = "";
let dirty = false;
let draggedItem = null;
let toastTimer = 0;

function node(tag, className = "", text = "") {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== "") item.textContent = text;
  return item;
}

function uniqueId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getPath(path) {
  return path.split(".").reduce((value, key) => value?.[key], content);
}

function setPath(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((target, key) => target[key], content);
  parent[last] = value;
}

function setSaveState(message, className = "") {
  saveStatus.textContent = message;
  saveStatus.className = `admin-save-status${className ? ` ${className}` : ""}`;
}

function markDirty() {
  if (!content) return;
  dirty = true;
  saveButton.disabled = false;
  setSaveState("저장하지 않은 변경사항", "is-dirty");
  renderDashboard();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (response.status === 401) {
    window.location.href = "/adminpage";
    throw new Error("인증 세션이 만료되었습니다.");
  }
  if (!response.ok) {
    const error = new Error(body?.error || `요청 실패 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function bindStaticFields() {
  document.querySelectorAll("[data-bind]").forEach((input) => {
    const path = input.dataset.bind;
    input.value = getPath(path) ?? "";
    if (!input.dataset.bound) {
      input.addEventListener("input", () => {
        setPath(path, input.value);
        markDirty();
      });
      input.dataset.bound = "true";
    }
  });
  document.querySelectorAll("[data-bind-list]").forEach((input) => {
    const path = input.dataset.bindList;
    input.value = (getPath(path) || []).join("\n");
    if (!input.dataset.bound) {
      input.addEventListener("input", () => {
        setPath(path, input.value.split(/\n+/).map((value) => value.trim()).filter(Boolean));
        markDirty();
      });
      input.dataset.bound = "true";
    }
  });
}

function createImageField(label, value, onChange) {
  const field = node("div", "image-field");
  field.append(node("span", "", label));
  const controls = node("div", "image-field-controls");
  const select = node("select");
  const empty = node("option", "", "이미지 없음");
  empty.value = "";
  select.append(empty);
  const knownUrls = new Set();
  content.media.forEach((media) => {
    const option = node("option", "", media.originalName || media.url);
    option.value = media.url;
    option.selected = media.url === value;
    knownUrls.add(media.url);
    select.append(option);
  });
  if (value && !knownUrls.has(value)) {
    const option = node("option", "", value);
    option.value = value;
    option.selected = true;
    select.append(option);
  }
  const upload = node("button", "button button-secondary", "업로드");
  upload.type = "button";
  upload.addEventListener("click", () => chooseImage(async (media) => onChange(media.url)));
  select.addEventListener("change", () => onChange(select.value));
  controls.append(select, upload);
  const preview = node("div", "image-preview");
  if (value) {
    const image = node("img");
    image.src = value;
    image.alt = `${label} 미리보기`;
    image.loading = "lazy";
    preview.append(image);
  } else {
    preview.textContent = "선택된 이미지가 없습니다.";
  }
  field.append(controls, preview);
  return field;
}

function renderStaticImages() {
  document.querySelectorAll("[data-static-image]").forEach((host) => {
    const path = host.dataset.staticImage;
    const control = createImageField(host.dataset.label, getPath(path) || "", (url) => {
      setPath(path, url);
      markDirty();
      renderStaticImages();
    });
    host.replaceChildren(control);
  });
}

function listFromInput(value) {
  return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function createImageListField(item, descriptor, rerender) {
  const field = node("div", "image-list-field field-wide");
  const caption = node("span", "", descriptor.label);
  if (descriptor.hint) caption.append(node("small", "", ` · ${descriptor.hint}`));
  field.append(caption);
  const images = Array.isArray(item[descriptor.key]) ? item[descriptor.key] : [];
  const gallery = node("div", "image-list-preview");
  if (!images.length) gallery.append(node("p", "", "추가 이미지가 없습니다."));
  images.forEach((url, index) => {
    const entry = node("div");
    const image = node("img");
    image.src = url;
    image.alt = `추가 이미지 ${index + 1}`;
    image.loading = "lazy";
    const remove = node("button", "", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", `추가 이미지 ${index + 1} 제거`);
    remove.addEventListener("click", () => {
      item[descriptor.key] = images.filter((_, imageIndex) => imageIndex !== index);
      markDirty();
      rerender();
    });
    entry.append(image, remove);
    gallery.append(entry);
  });
  const controls = node("div", "image-list-controls");
  const select = node("select");
  const prompt = node("option", "", "미디어에서 선택");
  prompt.value = "";
  select.append(prompt);
  content.media.filter((media) => !images.includes(media.url)).forEach((media) => {
    const option = node("option", "", media.originalName || media.url);
    option.value = media.url;
    select.append(option);
  });
  const add = node("button", "button button-secondary", "추가");
  add.type = "button";
  add.addEventListener("click", () => {
    if (!select.value || images.length >= 12) return;
    item[descriptor.key] = [...images, select.value];
    markDirty();
    rerender();
  });
  const upload = node("button", "button button-secondary", "업로드 후 추가");
  upload.type = "button";
  upload.addEventListener("click", () => chooseImage((media) => {
    if (images.length >= 12) return;
    item[descriptor.key] = [...images, media.url];
    markDirty();
    rerender();
  }));
  controls.append(select, add, upload);
  field.append(gallery, controls);
  return field;
}

function createEditorField(item, descriptor, rerender) {
  if (descriptor.type === "imageList") {
    return createImageListField(item, descriptor, rerender);
  }
  if (descriptor.type === "image") {
    const imageField = createImageField(descriptor.label, item[descriptor.key] || "", (url) => {
      item[descriptor.key] = url;
      markDirty();
      rerender();
    });
    if (descriptor.wide) imageField.classList.add("field-wide");
    return imageField;
  }

  const label = node("label", descriptor.wide ? "field-wide" : "");
  const caption = node("span", "", descriptor.label);
  if (descriptor.hint) caption.append(node("small", "", ` · ${descriptor.hint}`));
  label.append(caption);

  if (descriptor.type === "toggle") {
    label.classList.add("toggle-field");
    const input = node("input");
    input.type = "checkbox";
    input.checked = Boolean(item[descriptor.key]);
    input.addEventListener("change", () => {
      item[descriptor.key] = input.checked;
      markDirty();
      rerender();
    });
    label.append(input);
    return label;
  }

  let input;
  if (["textarea", "list"].includes(descriptor.type)) {
    input = node("textarea");
    input.rows = descriptor.rows || 3;
    input.value = Array.isArray(item[descriptor.key]) ? item[descriptor.key].join("\n") : item[descriptor.key] || "";
  } else if (descriptor.type === "select") {
    input = node("select");
    descriptor.options.forEach(([value, text]) => {
      const option = node("option", "", text);
      option.value = value;
      option.selected = value === item[descriptor.key];
      input.append(option);
    });
  } else {
    input = node("input");
    input.type = descriptor.type === "url" ? "url" : descriptor.type || "text";
    input.value = item[descriptor.key] ?? "";
  }
  if (descriptor.required) input.required = true;
  if (descriptor.maxLength) input.maxLength = descriptor.maxLength;
  if (descriptor.min !== undefined) input.min = String(descriptor.min);
  if (descriptor.max !== undefined) input.max = String(descriptor.max);
  input.addEventListener("input", () => {
    if (descriptor.type === "list") item[descriptor.key] = listFromInput(input.value);
    else if (descriptor.type === "number") item[descriptor.key] = Number.parseInt(input.value || "0", 10);
    else item[descriptor.key] = input.value;
    markDirty();
  });
  label.append(input);
  return label;
}

function collectionSubtitle(name, item) {
  if (name === "activities") return [item.date?.slice(0, 4) || "연도 미지정", item.category].filter(Boolean).join(" / ");
  if (name === "projects") return [item.category, item.status].filter(Boolean).join(" / ");
  if (name === "skills") return item.category || "카테고리 미지정";
  if (name === "socialLinks") return item.value || item.url || "링크 정보 없음";
  if (name === "downloads") return [item.type, item.size].filter(Boolean).join(" / ");
  if (name === "operations") return item.eyebrow || "운영 안내";
  if (name === "sections") return item.id;
  return item.id;
}

function moveCollectionItem(name, itemId, direction) {
  const items = content[name];
  const index = items.findIndex((item) => item.id === itemId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  items.forEach((item, itemIndex) => { item.sortOrder = itemIndex; });
  markDirty();
  renderCollection(name);
}

function removeCollectionItem(name, itemId) {
  const specification = collectionSpecifications[name];
  if (specification.fixed) return;
  const item = content[name].find((entry) => entry.id === itemId);
  const displayName = item?.[specification.titleKey] || "이 항목";
  if (!window.confirm(`“${displayName}” 항목을 삭제하시겠습니까? 저장 전에는 되돌릴 수 있습니다.`)) return;
  content[name] = content[name].filter((entry) => entry.id !== itemId);
  content[name].forEach((entry, index) => { entry.sortOrder = index; });
  markDirty();
  renderCollection(name);
}

function editorRow(name, item, index) {
  const specification = collectionSpecifications[name];
  const details = node("details", "editor-item");
  details.dataset.itemId = item.id;
  const summary = node("summary", "editor-summary");
  const handle = node("span", "drag-handle", "≡");
  handle.draggable = true;
  handle.title = "드래그하여 순서 변경";
  handle.setAttribute("aria-label", "정렬 핸들");
  const title = node("span", "editor-title");
  title.append(
    node("strong", "", item[specification.titleKey] || "새 항목"),
    node("small", "", collectionSubtitle(name, item)),
  );
  const visibility = node("span", `visibility-badge${item.visible === false ? " is-hidden" : ""}`, item.visible === false ? "Hidden" : "Public");
  const arrow = node("span", "editor-arrow", "›");
  arrow.setAttribute("aria-hidden", "true");
  summary.append(handle, title, visibility, arrow);

  handle.addEventListener("dragstart", (event) => {
    draggedItem = { name, id: item.id };
    details.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  });
  handle.addEventListener("dragend", () => {
    draggedItem = null;
    document.querySelectorAll(".editor-item").forEach((row) => row.classList.remove("is-dragging", "is-drag-target"));
  });
  details.addEventListener("dragover", (event) => {
    if (draggedItem?.name !== name || draggedItem.id === item.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    details.classList.add("is-drag-target");
  });
  details.addEventListener("dragleave", () => details.classList.remove("is-drag-target"));
  details.addEventListener("drop", (event) => {
    event.preventDefault();
    details.classList.remove("is-drag-target");
    if (draggedItem?.name !== name || draggedItem.id === item.id) return;
    const items = content[name];
    const from = items.findIndex((entry) => entry.id === draggedItem.id);
    let to = items.findIndex((entry) => entry.id === item.id);
    const [moved] = items.splice(from, 1);
    if (from < to) to -= 1;
    items.splice(to, 0, moved);
    items.forEach((entry, order) => { entry.sortOrder = order; });
    markDirty();
    renderCollection(name);
  });

  const body = node("div", "editor-body");
  const fields = node("div", "editor-fields");
  const rerender = () => renderCollection(name, item.id);
  specification.fields.forEach((descriptor) => fields.append(createEditorField(item, descriptor, rerender)));
  const actions = node("div", "editor-actions");
  const orderActions = node("div", "editor-order-actions");
  const up = node("button", "", "↑ 위로");
  const down = node("button", "", "↓ 아래로");
  up.type = "button";
  down.type = "button";
  up.disabled = index === 0;
  down.disabled = index === content[name].length - 1;
  up.addEventListener("click", () => moveCollectionItem(name, item.id, -1));
  down.addEventListener("click", () => moveCollectionItem(name, item.id, 1));
  orderActions.append(up, down);
  actions.append(orderActions);
  if (!specification.fixed) {
    const remove = node("button", "danger-action", "삭제");
    remove.type = "button";
    remove.addEventListener("click", () => removeCollectionItem(name, item.id));
    actions.append(remove);
  }
  body.append(fields, actions);
  details.append(summary, body);
  return details;
}

function renderCollection(name, openItemId = "") {
  const host = document.querySelector(`[data-collection="${name}"]`);
  if (!host) return;
  if (!content[name].length) {
    host.replaceChildren(node("p", "media-empty", "등록된 항목이 없습니다."));
    return;
  }
  const rows = content[name].map((item, index) => editorRow(name, item, index));
  host.replaceChildren(...rows);
  if (openItemId) {
    const openRow = rows.find((row) => row.dataset.itemId === openItemId);
    if (openRow) openRow.open = true;
  }
}

function renderCollections() {
  Object.keys(collectionSpecifications).forEach((name) => renderCollection(name));
}

function renderDashboard() {
  if (!content) return;
  const host = document.querySelector("[data-dashboard-stats]");
  const definitions = [
    ["Activities", content.activities.length, `${content.activities.filter((item) => item.visible).length} public`],
    ["Projects", content.projects.length, `${content.projects.filter((item) => item.visible).length} public`],
    ["Skills", content.skills.length, `${content.skills.filter((item) => item.visible).length} public`],
    ["Media", content.media.length, `${content.media.filter((item) => item.managed).length} uploaded`],
  ];
  host.replaceChildren(...definitions.map(([label, count, note]) => {
    const card = node("article", "dashboard-stat");
    card.append(node("span", "", label), node("strong", "", String(count)), node("small", "", note));
    return card;
  }));
  const updated = new Date(content.meta.updatedAt);
  document.querySelector("[data-dashboard-updated]").textContent = Number.isNaN(updated.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" }).format(updated);
  document.querySelector("[data-dashboard-revision]").textContent = `Revision ${content.meta.revision}${dirty ? " · unsaved local changes" : ""}`;
}

function formatBytes(size) {
  if (!Number.isFinite(Number(size))) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function contentUsesMedia(url) {
  function includes(value, key = "") {
    if (key === "media") return false;
    if (typeof value === "string") return value === url;
    if (Array.isArray(value)) return value.some((entry) => includes(entry, key));
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([childKey, child]) => includes(child, childKey));
  }
  return includes(content);
}

async function deleteMedia(media) {
  if (!media.managed) return;
  if (contentUsesMedia(media.url)) {
    showToast("현재 콘텐츠에서 사용 중인 이미지는 먼저 연결을 해제하고 저장해야 합니다.");
    return;
  }
  if (!window.confirm(`“${media.originalName || media.url}” 이미지를 서버에서 삭제하시겠습니까?`)) return;
  try {
    const result = await requestJson(`/api/admin/media/${encodeURIComponent(media.id)}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    });
    content.media = content.media.filter((item) => item.id !== media.id);
    content.meta = result.meta;
    renderMedia();
    renderStaticImages();
    renderCollections();
    renderDashboard();
    showToast("이미지를 삭제했습니다.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderMedia() {
  const host = document.querySelector("[data-media-grid]");
  if (!content.media.length) {
    host.replaceChildren(node("p", "media-empty", "업로드된 이미지가 없습니다."));
    return;
  }
  host.replaceChildren(...content.media.map((media) => {
    const card = node("article", "media-card");
    const image = node("img");
    image.src = media.url;
    image.alt = media.alt || media.originalName || "미디어 이미지";
    image.loading = "lazy";
    const body = node("div", "media-card-body");
    body.append(
      node("strong", "", media.originalName || media.url),
      node("span", "", `${formatBytes(media.size)} · ${media.width || "?"}×${media.height || "?"}`),
    );
    const alt = node("input");
    alt.type = "text";
    alt.value = media.alt || "";
    alt.maxLength = 240;
    alt.placeholder = "대체 텍스트";
    alt.setAttribute("aria-label", `${media.originalName || "이미지"} 대체 텍스트`);
    alt.addEventListener("input", () => {
      media.alt = alt.value;
      markDirty();
    });
    const actions = node("div", "media-card-actions");
    const copy = node("button", "", "URL 복사");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(media.url);
        showToast("이미지 URL을 복사했습니다.");
      } catch {
        showToast(`이미지 URL: ${media.url}`);
      }
    });
    const remove = node("button", media.managed ? "danger-action" : "", media.managed ? "삭제" : "기본 파일");
    remove.type = "button";
    remove.disabled = !media.managed;
    remove.addEventListener("click", () => deleteMedia(media));
    actions.append(copy, remove);
    body.append(alt, actions);
    card.append(image, body);
    return card;
  }));
}

function chooseImage(callback) {
  const picker = node("input");
  picker.type = "file";
  picker.accept = "image/jpeg,image/png,image/webp";
  picker.addEventListener("change", () => {
    if (picker.files?.[0]) uploadFiles([picker.files[0]], callback);
  });
  picker.click();
}

async function uploadOne(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`${file.name}: JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.`);
  }
  if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: 파일 크기가 8MB를 초과합니다.`);
  const result = await requestJson("/api/admin/media", {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "X-CSRF-Token": csrfToken,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  content.media.push(result.media);
  content.meta = result.meta;
  return result.media;
}

async function uploadFiles(files, callback) {
  const candidates = [...files].slice(0, 12);
  if (!candidates.length) return;
  mediaProgress.textContent = `0 / ${candidates.length} 업로드 중`;
  let firstMedia = null;
  try {
    for (let index = 0; index < candidates.length; index += 1) {
      const uploaded = await uploadOne(candidates[index]);
      if (!firstMedia) firstMedia = uploaded;
      mediaProgress.textContent = `${index + 1} / ${candidates.length} 업로드 완료`;
    }
    if (callback && firstMedia) callback(firstMedia);
    renderMedia();
    renderStaticImages();
    renderCollections();
    renderDashboard();
    showToast(`${candidates.length}개 이미지를 업로드했습니다.`);
  } catch (error) {
    mediaProgress.textContent = error.message;
    showToast(error.message);
    renderMedia();
  } finally {
    if (mediaInput) mediaInput.value = "";
  }
}

function normalizeOrder() {
  Object.keys(collectionSpecifications).forEach((name) => {
    content[name].forEach((item, index) => { item.sortOrder = index; });
  });
}

async function saveContent() {
  const invalid = [...document.querySelectorAll("[required]")].find((input) => !input.checkValidity());
  if (invalid) {
    const invalidPanel = invalid.closest("[data-panel]");
    if (invalidPanel) showPanel(invalidPanel.dataset.panel);
    invalid.reportValidity();
    showToast("필수 입력값을 확인해 주세요.");
    return;
  }
  normalizeOrder();
  saveButton.disabled = true;
  setSaveState("저장 중");
  try {
    const saved = await requestJson("/api/admin/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        "If-Match": `"${content.meta.revision}"`,
      },
      body: JSON.stringify(content),
    });
    content = saved;
    dirty = false;
    bindStaticFields();
    renderStaticImages();
    renderCollections();
    renderMedia();
    renderDashboard();
    setSaveState("저장 완료", "is-success");
    showToast("공개 사이트 콘텐츠를 저장했습니다.");
  } catch (error) {
    saveButton.disabled = false;
    setSaveState(error.status === 409 ? "다른 세션에서 변경됨" : "저장 실패", "is-error");
    showToast(error.status === 409 ? "다른 세션의 변경사항이 있습니다. 페이지를 새로고침해 확인해 주세요." : error.message);
  }
}

function showPanel(name, updateHistory = true) {
  const selected = PANEL_TITLES[name] ? name : "dashboard";
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== selected;
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === selected);
  });
  panelTitle.textContent = PANEL_TITLES[selected];
  if (updateHistory) window.history.replaceState(null, "", `#${selected}`);
  sidebar.classList.remove("is-open");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function attachEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.view));
  });
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.add;
      const item = collectionSpecifications[name].create();
      content[name].push(item);
      content[name].forEach((entry, index) => { entry.sortOrder = index; });
      markDirty();
      renderCollection(name, item.id);
      const row = document.querySelector(`[data-collection="${name}"] [data-item-id="${item.id}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  saveButton.addEventListener("click", saveContent);
  document.querySelector("[data-sidebar-open]").addEventListener("click", () => sidebar.classList.add("is-open"));
  document.querySelector("[data-sidebar-close]").addEventListener("click", () => sidebar.classList.remove("is-open"));
  document.querySelector("[data-admin-logout]").addEventListener("click", async () => {
    if (dirty && !window.confirm("저장하지 않은 변경사항이 있습니다. 로그아웃하시겠습니까?")) return;
    try {
      await requestJson("/api/admin-logout", { method: "POST", headers: { "X-CSRF-Token": csrfToken } });
    } finally {
      dirty = false;
      window.location.href = "/adminpage";
    }
  });
  mediaDropzone.addEventListener("click", () => mediaInput.click());
  mediaDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      mediaInput.click();
    }
  });
  mediaInput.addEventListener("change", () => uploadFiles(mediaInput.files || []));
  ["dragenter", "dragover"].forEach((eventName) => mediaDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    mediaDropzone.classList.add("is-over");
  }));
  ["dragleave", "drop"].forEach((eventName) => mediaDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    mediaDropzone.classList.remove("is-over");
  }));
  mediaDropzone.addEventListener("drop", (event) => uploadFiles(event.dataTransfer.files || []));
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function initialize() {
  try {
    const session = await requestJson("/api/admin-session");
    if (!session.authenticated) {
      window.location.href = "/adminpage";
      return;
    }
    csrfToken = session.csrfToken;
    content = await requestJson("/api/admin/content");
    bindStaticFields();
    renderStaticImages();
    renderCollections();
    renderMedia();
    renderDashboard();
    attachEvents();
    adminContent.setAttribute("aria-busy", "false");
    saveButton.disabled = true;
    setSaveState("모든 변경사항 저장됨");
    showPanel(window.location.hash.slice(1) || "dashboard", false);
  } catch (error) {
    adminContent.setAttribute("aria-busy", "false");
    setSaveState("불러오기 실패", "is-error");
    showToast(error.message);
  }
}

initialize();
