const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCHEMA_VERSION = 3;
const MAX_COLLECTION_ITEMS = 300;
const STATUS_STATES = new Set(["online", "warning", "offline", "neutral"]);
const SECTION_IDS = new Set(["hero", "about", "skills", "projects", "operations", "activities", "contact"]);

class ContentStoreError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ContentStoreError";
    this.statusCode = statusCode;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, maxLength = 5000, fallback = "") {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  return String(value)
    .replace(/\0/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, maxLength)
    .trim();
}

function cleanSingleLine(value, maxLength = 240, fallback = "") {
  return cleanText(value, maxLength, fallback).replace(/[\n\t]+/g, " ").replace(/\s{2,}/g, " ");
}

function cleanBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanInteger(value, min, max, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function cleanId(value, fallback) {
  const id = cleanSingleLine(value, 80).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return id.replace(/^-|-$/g, "") || fallback;
}

function cleanSlug(value, fallback) {
  const slug = cleanSingleLine(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

function cleanDate(value) {
  const date = cleanSingleLine(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "" : date;
}

function cleanTimestamp(value, fallback) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function cleanUrl(value, { allowContact = false, allowDownload = false } = {}) {
  const url = cleanSingleLine(value, 2048);
  if (!url) return "";

  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
    try {
      const decoded = decodeURIComponent(url.split(/[?#]/, 1)[0]);
      if (decoded.split("/").includes("..")) return "";
    } catch {
      return "";
    }
    if (!allowDownload && url.startsWith("/downloads/")) return "";
    return url;
  }

  if (allowContact && /^(mailto:|tel:)/i.test(url)) return url;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function cleanImagePath(value) {
  const url = cleanUrl(value);
  if (!url || !url.startsWith("/")) return "";
  const pathname = url.split(/[?#]/, 1)[0].toLowerCase();
  return /\.(?:png|jpe?g|webp|gif|ico|svg)$/.test(pathname) ? url : "";
}

function cleanStringList(value, maxItems = 20, itemLength = 80) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanSingleLine(item, itemLength))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, maxItems);
}

function fieldOrFallback(value, key, fallback) {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : fallback;
}

function normalizeIds(items, prefix) {
  const seen = new Set();
  return items.map((item, index) => {
    const base = cleanId(item.id, `${prefix}-${index + 1}`);
    let id = base;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${base}-${suffix}`.slice(0, 80);
      suffix += 1;
    }
    seen.add(id);
    return { ...item, id };
  });
}

function sortCollection(items) {
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }));
}

function normalizeSlugs(items) {
  const seen = new Set();
  return items.map((item, index) => {
    const base = cleanSlug(item.slug, `activity-${index + 1}`);
    let slug = base;
    let suffix = 2;
    while (seen.has(slug)) {
      slug = `${base}-${suffix}`.slice(0, 120).replace(/-+$/g, "");
      suffix += 1;
    }
    seen.add(slug);
    return { ...item, slug };
  });
}

function normalizeContent(input, defaults) {
  const value = input && typeof input === "object" ? input : {};
  const fallback = defaults && typeof defaults === "object" ? defaults : {};
  const now = new Date().toISOString();
  const site = value.site && typeof value.site === "object" ? value.site : {};
  const fallbackSite = fallback.site || {};
  const profile = value.profile && typeof value.profile === "object" ? value.profile : {};
  const fallbackProfile = fallback.profile || {};

  const socialSource = Array.isArray(value.socialLinks)
    ? value.socialLinks
    : Array.isArray(fallback.socialLinks)
      ? fallback.socialLinks
      : [];
  const skillSource = Array.isArray(value.skills)
    ? value.skills
    : Array.isArray(fallback.skills)
      ? fallback.skills
      : [];
  const projectSource = Array.isArray(value.projects)
    ? value.projects
    : Array.isArray(fallback.projects)
      ? fallback.projects
      : [];
  const activitySource = Array.isArray(value.activities)
    ? value.activities
    : Array.isArray(fallback.activities)
      ? fallback.activities
      : [];
  const downloadSource = Array.isArray(value.downloads)
    ? value.downloads
    : Array.isArray(fallback.downloads)
      ? fallback.downloads
      : [];
  const operationSource = Array.isArray(value.operations)
    ? value.operations
    : Array.isArray(fallback.operations)
      ? fallback.operations
      : [];
  const sectionSource = Array.isArray(value.sections)
    ? value.sections
    : Array.isArray(fallback.sections)
      ? fallback.sections
      : [];
  const mediaSource = Array.isArray(value.media)
    ? value.media
    : Array.isArray(fallback.media)
      ? fallback.media
      : [];
  const mergedMediaSource = [];
  const seenMediaUrls = new Set();
  [...mediaSource, ...(fallback.media || []).filter((item) => item?.managed === false)].forEach((item) => {
    const url = cleanImagePath(item?.url);
    if (!url || seenMediaUrls.has(url)) return;
    seenMediaUrls.add(url);
    mergedMediaSource.push(item);
  });

  const socialLinks = sortCollection(
    normalizeIds(
      socialSource.slice(0, MAX_COLLECTION_ITEMS).map((item, index) => ({
        id: item?.id,
        label: cleanSingleLine(item?.label, 80),
        value: cleanSingleLine(item?.value, 180),
        url: cleanUrl(item?.url, { allowContact: true }),
        visible: cleanBoolean(item?.visible, true),
        sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
      })),
      "social",
    ).filter((item) => item.label),
  );

  const skills = sortCollection(
    normalizeIds(
      skillSource.slice(0, MAX_COLLECTION_ITEMS).map((item, index) => ({
        id: item?.id,
        name: cleanSingleLine(item?.name, 120),
        category: cleanSingleLine(item?.category, 100, "Other"),
        description: cleanText(item?.description, 800),
        proficiency: cleanInteger(item?.proficiency, 0, 100, 0),
        image: cleanImagePath(item?.image),
        visible: cleanBoolean(item?.visible, true),
        sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
      })),
      "skill",
    ).filter((item) => item.name),
  );

  const projects = sortCollection(
    normalizeIds(
      projectSource.slice(0, MAX_COLLECTION_ITEMS).map((item, index) => ({
        id: item?.id,
        title: cleanSingleLine(item?.title, 180),
        summary: cleanText(item?.summary, 1200),
        detail: cleanText(item?.detail, 12000),
        category: cleanSingleLine(item?.category, 100, "Project"),
        startDate: cleanDate(item?.startDate),
        endDate: cleanDate(item?.endDate),
        technologies: cleanStringList(item?.technologies),
        githubUrl: cleanUrl(item?.githubUrl),
        demoUrl: cleanUrl(item?.demoUrl, { allowDownload: true }),
        image: cleanImagePath(item?.image),
        status: cleanSingleLine(item?.status, 60),
        state: STATUS_STATES.has(item?.state) ? item.state : "neutral",
        featured: cleanBoolean(item?.featured, false),
        visible: cleanBoolean(item?.visible, true),
        sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
      })),
      "project",
    ).filter((item) => item.title),
  );

  const activities = normalizeSlugs(
    sortCollection(
      normalizeIds(
        activitySource.slice(0, MAX_COLLECTION_ITEMS).map((item, index) => {
          const createdAt = cleanTimestamp(item?.createdAt, now);
          const fallbackSlug = `activity-${index + 1}`;
          return {
            id: item?.id,
            slug: cleanSlug(item?.slug || item?.title, fallbackSlug),
            title: cleanSingleLine(item?.title || item?.name, 220),
            summary: cleanText(item?.summary, 1200),
            detail: cleanText(item?.detail, 16000),
            date: cleanDate(item?.date),
            category: cleanSingleLine(item?.category, 100, "Activity"),
            coverImage: cleanImagePath(item?.coverImage),
            images: Array.isArray(item?.images)
              ? item.images.map(cleanImagePath).filter(Boolean).slice(0, 12)
              : [],
            url: cleanUrl(item?.url, { allowDownload: true }),
            tags: cleanStringList(item?.tags),
            visible: cleanBoolean(item?.visible, true),
            sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
            createdAt,
            updatedAt: cleanTimestamp(item?.updatedAt, createdAt),
          };
        }),
        "activity",
      ).filter((item) => item.title),
    ),
  );

  const downloads = sortCollection(
    normalizeIds(
      downloadSource.slice(0, MAX_COLLECTION_ITEMS).map((item, index) => ({
        id: item?.id,
        title: cleanSingleLine(item?.title, 220),
        type: cleanSingleLine(item?.type, 100),
        description: cleanText(item?.description, 1600),
        fileUrl: cleanUrl(item?.fileUrl, { allowDownload: true }),
        fileName: cleanSingleLine(item?.fileName, 240),
        size: cleanSingleLine(item?.size, 60),
        platform: cleanSingleLine(item?.platform, 80),
        date: cleanDate(item?.date),
        checksum: cleanSingleLine(item?.checksum, 160).toLowerCase().replace(/[^a-f0-9]/g, ""),
        note: cleanText(item?.note, 1600),
        visible: cleanBoolean(item?.visible, true),
        sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
      })),
      "download",
    ).filter((item) => item.title),
  );

  const operations = sortCollection(
    normalizeIds(
      operationSource.slice(0, 30).map((item, index) => ({
        id: item?.id,
        eyebrow: cleanSingleLine(item?.eyebrow, 80),
        title: cleanSingleLine(item?.title, 160),
        description: cleanText(item?.description, 1600),
        highlights: cleanStringList(item?.highlights, 12, 100),
        visible: cleanBoolean(item?.visible, true),
        sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
      })),
      "operation",
    ).filter((item) => item.title),
  );

  const uniqueSections = [];
  const seenSectionIds = new Set();
  [...sectionSource, ...(fallback.sections || [])].forEach((item) => {
    if (!SECTION_IDS.has(item?.id) || seenSectionIds.has(item.id)) return;
    seenSectionIds.add(item.id);
    uniqueSections.push(item);
  });
  const sections = sortCollection(
    normalizeIds(
      uniqueSections
        .slice(0, SECTION_IDS.size)
        .map((item, index) => ({
          id: item.id,
          label: cleanSingleLine(item?.label, 80, item.id),
          eyebrow: cleanSingleLine(item?.eyebrow, 120),
          title: cleanSingleLine(item?.title, 180),
          description: cleanText(item?.description, 1200),
          visible: cleanBoolean(item?.visible, true),
          sortOrder: cleanInteger(item?.sortOrder, 0, 100000, index),
        })),
      "section",
    ),
  );

  const media = normalizeIds(
    mergedMediaSource.slice(0, 1000).map((item, index) => ({
      id: item?.id,
      url: cleanImagePath(item?.url),
      originalName: cleanSingleLine(item?.originalName, 180),
      mime: cleanSingleLine(item?.mime, 80),
      size: cleanInteger(item?.size, 0, 20 * 1024 * 1024, 0),
      width: cleanInteger(item?.width, 0, 20000, 0),
      height: cleanInteger(item?.height, 0, 20000, 0),
      alt: cleanSingleLine(item?.alt, 240),
      managed: cleanBoolean(item?.managed, true),
      createdAt: cleanTimestamp(item?.createdAt, now),
      sortOrder: index,
    })),
    "media",
  ).filter((item) => item.url);

  const fallbackMeta = fallback.meta || {};
  const inputMeta = value.meta && typeof value.meta === "object" ? value.meta : {};

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      revision: cleanInteger(inputMeta.revision, 1, Number.MAX_SAFE_INTEGER, fallbackMeta.revision || 1),
      createdAt: cleanTimestamp(inputMeta.createdAt, fallbackMeta.createdAt || now),
      updatedAt: cleanTimestamp(inputMeta.updatedAt, fallbackMeta.updatedAt || now),
    },
    site: {
      siteName: cleanSingleLine(site.siteName, 160, fallbackSite.siteName || "Portfolio"),
      brandText: cleanSingleLine(site.brandText, 40, fallbackSite.brandText || "MVTP"),
      title: cleanSingleLine(site.title, 180, fallbackSite.title || "Portfolio"),
      description: cleanText(site.description, 1200, fallbackSite.description || ""),
      seoTitle: cleanSingleLine(site.seoTitle, 180, fallbackSite.seoTitle || ""),
      seoDescription: cleanText(site.seoDescription, 320, fallbackSite.seoDescription || ""),
      footerText: cleanSingleLine(site.footerText, 240, fallbackSite.footerText || ""),
      logoImage: cleanImagePath(fieldOrFallback(site, "logoImage", fallbackSite.logoImage)),
      favicon: cleanImagePath(fieldOrFallback(site, "favicon", fallbackSite.favicon)),
      ogImage: cleanImagePath(fieldOrFallback(site, "ogImage", fallbackSite.ogImage)),
      email: cleanSingleLine(site.email, 240, fallbackSite.email || ""),
    },
    profile: {
      displayName: cleanSingleLine(profile.displayName, 160, fallbackProfile.displayName || ""),
      englishName: cleanSingleLine(profile.englishName, 160, fallbackProfile.englishName || ""),
      role: cleanSingleLine(profile.role, 160, fallbackProfile.role || ""),
      headline: cleanText(profile.headline, 500, fallbackProfile.headline || ""),
      shortBio: cleanText(profile.shortBio, 1600, fallbackProfile.shortBio || ""),
      aboutTitle: cleanSingleLine(profile.aboutTitle, 220, fallbackProfile.aboutTitle || ""),
      aboutParagraphs: Array.isArray(profile.aboutParagraphs)
        ? profile.aboutParagraphs.map((item) => cleanText(item, 2400)).filter(Boolean).slice(0, 12)
        : clone(fallbackProfile.aboutParagraphs || []),
      highlight: cleanSingleLine(profile.highlight, 180, fallbackProfile.highlight || ""),
      location: cleanSingleLine(profile.location, 180, fallbackProfile.location || ""),
      school: cleanSingleLine(profile.school, 220, fallbackProfile.school || ""),
      email: cleanSingleLine(profile.email, 240, fallbackProfile.email || ""),
      phone: cleanSingleLine(profile.phone, 80, fallbackProfile.phone || ""),
      profileImage: cleanImagePath(fieldOrFallback(profile, "profileImage", fallbackProfile.profileImage)),
      heroImage: cleanImagePath(fieldOrFallback(profile, "heroImage", fallbackProfile.heroImage)),
      availability: cleanSingleLine(profile.availability, 180, fallbackProfile.availability || ""),
    },
    socialLinks,
    skills,
    projects,
    activities,
    downloads,
    operations,
    sections,
    media,
  };
}

function migrateLegacyContent(value, defaults) {
  if (Number(value?.schemaVersion) >= SCHEMA_VERSION) return normalizeContent(value, defaults);

  if (Number(value?.schemaVersion) >= 2) {
    const migrated = normalizeContent(value, defaults);
    migrated.meta.updatedAt = new Date().toISOString();
    return migrated;
  }

  const migrated = clone(defaults);
  const statusById = new Map(
    (Array.isArray(value?.serviceStatuses) ? value.serviceStatuses : []).map((item) => [item?.id, item]),
  );

  migrated.projects = migrated.projects.map((project) => {
    const previous = statusById.get(project.id);
    if (!previous) return project;
    return {
      ...project,
      status: cleanSingleLine(previous.status, 60, project.status),
      state: STATUS_STATES.has(previous.state) ? previous.state : project.state,
    };
  });

  if (Array.isArray(value?.activities)) {
    const seededByTitle = new Map(migrated.activities.map((item) => [item.title, item]));
    migrated.activities = value.activities
      .map((item, index) => {
        const title = cleanSingleLine(typeof item === "string" ? item : item?.name || item?.title, 220);
        if (!title) return null;
        const seeded = seededByTitle.get(title);
        return seeded
          ? { ...seeded, sortOrder: index }
          : {
              id: `activity-${index + 1}`,
              slug: cleanSlug(title, `activity-${index + 1}`),
              title,
              summary: "",
              detail: "",
              date: "",
              category: "Activity",
              coverImage: "",
              images: [],
              url: "",
              tags: [],
              visible: true,
              sortOrder: index,
              createdAt: migrated.meta.updatedAt,
              updatedAt: migrated.meta.updatedAt,
            };
      })
      .filter(Boolean);
  }

  migrated.meta.revision = 1;
  migrated.meta.updatedAt = new Date().toISOString();
  return normalizeContent(migrated, defaults);
}

function publicContent(content) {
  const visibleSorted = (items) => items.filter((item) => item.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    schemaVersion: content.schemaVersion,
    meta: { updatedAt: content.meta.updatedAt },
    site: clone(content.site),
    profile: clone(content.profile),
    socialLinks: clone(visibleSorted(content.socialLinks)),
    skills: clone(visibleSorted(content.skills)),
    projects: clone(visibleSorted(content.projects)),
    activities: clone(visibleSorted(content.activities)).map((item) => ({
      ...item,
      year: item.date ? Number(item.date.slice(0, 4)) : null,
    })),
    downloads: clone(visibleSorted(content.downloads)),
    operations: clone(visibleSorted(content.operations)),
    sections: clone(visibleSorted(content.sections)),
  };
}

function contentReferencesUrl(value, targetUrl, key = "") {
  if (key === "media") return false;
  if (typeof value === "string") return value === targetUrl;
  if (Array.isArray(value)) return value.some((item) => contentReferencesUrl(item, targetUrl, key));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([childKey, child]) => contentReferencesUrl(child, targetUrl, childKey));
}

function createContentStore({ contentFile, defaultsFile }) {
  const defaultsRaw = JSON.parse(fs.readFileSync(defaultsFile, "utf8"));
  const defaults = normalizeContent(defaultsRaw, defaultsRaw);
  let writeQueue = Promise.resolve();

  async function atomicWrite(content) {
    await fs.promises.mkdir(path.dirname(contentFile), { recursive: true });
    const temporaryFile = `${contentFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(temporaryFile, `${JSON.stringify(content, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await fs.promises.rename(temporaryFile, contentFile);
    } finally {
      await fs.promises.unlink(temporaryFile).catch(() => undefined);
    }
  }

  async function readRaw() {
    const raw = await fs.promises.readFile(contentFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ContentStoreError("Content file must contain a JSON object", 500);
    }
    if (Number(parsed.schemaVersion) > SCHEMA_VERSION) {
      throw new ContentStoreError(
        `Content schema ${parsed.schemaVersion} is newer than supported schema ${SCHEMA_VERSION}`,
        500,
      );
    }
    return parsed;
  }

  async function read() {
    return normalizeContent(await readRaw(), defaults);
  }

  function locked(operation) {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => undefined);
    return result;
  }

  async function init() {
    return locked(async () => {
      await fs.promises.mkdir(path.dirname(contentFile), { recursive: true });
      let raw;
      try {
        raw = await readRaw();
      } catch (error) {
        if (error.code !== "ENOENT") {
          if (error instanceof SyntaxError) {
            throw new ContentStoreError("Content file contains invalid JSON", 500);
          }
          throw error;
        }
        raw = defaults;
      }
      const migrated = migrateLegacyContent(raw, defaults);
      const serializedBefore = JSON.stringify(raw);
      const serializedAfter = JSON.stringify(migrated);
      if (serializedBefore !== serializedAfter) await atomicWrite(migrated);
      return migrated;
    });
  }

  async function save(nextValue, expectedRevision) {
    return locked(async () => {
      const current = await read();
      if (
        expectedRevision !== undefined &&
        Number(expectedRevision) !== Number(current.meta.revision)
      ) {
        throw new ContentStoreError("Content was changed by another session", 409);
      }
      if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
        throw new ContentStoreError("Content payload must be a JSON object", 400);
      }
      if (Number(nextValue.schemaVersion) !== SCHEMA_VERSION) {
        throw new ContentStoreError(`Content payload must use schema ${SCHEMA_VERSION}`, 400);
      }
      const next = normalizeContent(nextValue, defaults);
      const savedAt = new Date().toISOString();
      const submittedMedia = new Map(next.media.map((item) => [item.id, item]));
      next.media = current.media.map((item, index) => ({
        ...item,
        alt: submittedMedia.get(item.id)?.alt ?? item.alt,
        sortOrder: index,
      }));
      const currentActivities = new Map(current.activities.map((item) => [item.id, item]));
      next.activities = next.activities.map((item) => {
        const previous = currentActivities.get(item.id);
        if (!previous) return { ...item, createdAt: savedAt, updatedAt: savedAt };
        const previousComparable = { ...previous, createdAt: undefined, updatedAt: undefined };
        const nextComparable = { ...item, createdAt: undefined, updatedAt: undefined };
        return {
          ...item,
          createdAt: previous.createdAt,
          updatedAt: JSON.stringify(previousComparable) === JSON.stringify(nextComparable)
            ? previous.updatedAt
            : savedAt,
        };
      });
      next.meta.createdAt = current.meta.createdAt;
      next.meta.updatedAt = savedAt;
      next.meta.revision = current.meta.revision + 1;
      await atomicWrite(next);
      return next;
    });
  }

  async function addMedia(mediaItem) {
    return locked(async () => {
      const current = await read();
      const next = normalizeContent(
        { ...current, media: [...current.media, mediaItem] },
        defaults,
      );
      next.meta.createdAt = current.meta.createdAt;
      next.meta.updatedAt = new Date().toISOString();
      next.meta.revision = current.meta.revision + 1;
      await atomicWrite(next);
      return { content: next, media: next.media.find((item) => item.id === mediaItem.id) };
    });
  }

  async function removeMedia(mediaId) {
    return locked(async () => {
      const current = await read();
      const media = current.media.find((item) => item.id === mediaId);
      if (!media) throw new ContentStoreError("Media not found", 404);
      if (!media.managed) throw new ContentStoreError("Bundled media cannot be deleted", 409);
      if (contentReferencesUrl(current, media.url)) {
        throw new ContentStoreError("Media is currently in use", 409);
      }
      const next = normalizeContent(
        { ...current, media: current.media.filter((item) => item.id !== mediaId) },
        defaults,
      );
      next.meta.createdAt = current.meta.createdAt;
      next.meta.updatedAt = new Date().toISOString();
      next.meta.revision = current.meta.revision + 1;
      await atomicWrite(next);
      return { content: next, media };
    });
  }

  return { init, read, save, addMedia, removeMedia, defaults: clone(defaults) };
}

module.exports = {
  SCHEMA_VERSION,
  ContentStoreError,
  createContentStore,
  migrateLegacyContent,
  normalizeContent,
  publicContent,
};
