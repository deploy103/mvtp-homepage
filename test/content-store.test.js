const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ContentStoreError,
  createContentStore,
  normalizeContent,
} = require("../lib/content-store");

const defaultsPath = path.join(__dirname, "..", "data", "content-defaults.json");
const defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));

async function temporaryStore(t, initialContent) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mvtp-content-test-"));
  const contentFile = path.join(directory, "site-content.json");
  const localDefaults = path.join(directory, "content-defaults.json");
  await fs.promises.copyFile(defaultsPath, localDefaults);
  if (initialContent !== undefined) {
    await fs.promises.writeFile(contentFile, JSON.stringify(initialContent), "utf8");
  }
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  return {
    contentFile,
    store: createContentStore({ contentFile, defaultsFile: localDefaults }),
  };
}

test("legacy service states and activities migrate without data loss", async (t) => {
  const legacy = {
    serviceStatuses: [
      { id: "hansei", name: "School Links", status: "점검중", state: "warning" },
    ],
    activities: [{ name: "기존 활동" }, { name: "한세 기능부 부원" }],
  };
  const { store } = await temporaryStore(t, legacy);
  const migrated = await store.init();

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.projects.find((project) => project.id === "hansei").status, "점검중");
  assert.equal(migrated.projects.find((project) => project.id === "hansei").state, "warning");
  assert.deepEqual(migrated.activities.map((activity) => activity.title), ["기존 활동", "한세 기능부 부원"]);
  assert.ok(migrated.socialLinks.length > 0);
  assert.ok(migrated.downloads.length > 0);
});

test("schema v2 content is extended without replacing customized values", async (t) => {
  const versionTwo = structuredClone(defaults);
  versionTwo.schemaVersion = 2;
  versionTwo.site.siteName = "Customized portfolio";
  versionTwo.projects[0].status = "사용자 상태";
  delete versionTwo.operations;
  const { store } = await temporaryStore(t, versionTwo);
  const migrated = await store.init();

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.site.siteName, "Customized portfolio");
  assert.equal(migrated.projects[0].status, "사용자 상태");
  assert.equal(migrated.operations.length, defaults.operations.length);
});

test("invalid existing JSON is never overwritten with defaults", async (t) => {
  const { store, contentFile } = await temporaryStore(t);
  const invalid = "{ not valid json";
  await fs.promises.writeFile(contentFile, invalid, "utf8");

  await assert.rejects(store.init(), (error) => {
    assert.ok(error instanceof ContentStoreError);
    assert.equal(error.statusCode, 500);
    return true;
  });
  assert.equal(await fs.promises.readFile(contentFile, "utf8"), invalid);
});

test("unsupported or invalid content shapes are never downgraded or overwritten", async (t) => {
  const future = { schemaVersion: 999, futureOnlyData: { preserve: true } };
  const futureStore = await temporaryStore(t, future);
  await assert.rejects(futureStore.store.init(), (error) => {
    assert.ok(error instanceof ContentStoreError);
    assert.match(error.message, /newer than supported/);
    return true;
  });
  assert.deepEqual(JSON.parse(await fs.promises.readFile(futureStore.contentFile, "utf8")), future);

  const invalidShapeStore = await temporaryStore(t, null);
  await assert.rejects(invalidShapeStore.store.init(), (error) => {
    assert.ok(error instanceof ContentStoreError);
    assert.match(error.message, /JSON object/);
    return true;
  });
  assert.equal(await fs.promises.readFile(invalidShapeStore.contentFile, "utf8"), "null");
});

test("normalization allowlists fields, URLs, slugs, and ordering", () => {
  const normalized = normalizeContent({
    ...defaults,
    projects: [
      { id: "second", title: "Second", sortOrder: 20, demoUrl: "javascript:alert(1)", unknown: "drop" },
      { id: "first", title: "First", sortOrder: 2, demoUrl: "https://example.com" },
    ],
    activities: [
      { id: "one", title: "Same", slug: "same", sortOrder: 0 },
      { id: "two", title: "Same again", slug: "same", sortOrder: 1 },
    ],
  }, defaults);

  assert.deepEqual(normalized.projects.map((project) => project.id), ["first", "second"]);
  assert.equal(normalized.projects[1].demoUrl, "");
  assert.equal(Object.hasOwn(normalized.projects[1], "unknown"), false);
  assert.deepEqual(normalized.activities.map((activity) => activity.slug), ["same", "same-2"]);
});

test("image fields inherit defaults only when omitted and may be explicitly cleared", () => {
  const omitted = structuredClone(defaults);
  delete omitted.site.favicon;
  delete omitted.profile.heroImage;
  const inherited = normalizeContent(omitted, defaults);

  assert.equal(inherited.site.favicon, defaults.site.favicon);
  assert.equal(inherited.profile.heroImage, defaults.profile.heroImage);

  const cleared = structuredClone(defaults);
  cleared.site.logoImage = "";
  cleared.site.favicon = "";
  cleared.site.ogImage = "";
  cleared.profile.profileImage = "";
  cleared.profile.heroImage = "";
  const normalized = normalizeContent(cleared, defaults);

  assert.equal(normalized.site.logoImage, "");
  assert.equal(normalized.site.favicon, "");
  assert.equal(normalized.site.ogImage, "");
  assert.equal(normalized.profile.profileImage, "");
  assert.equal(normalized.profile.heroImage, "");
});

test("saves are revision guarded and activity timestamps are server managed", async (t) => {
  const { store } = await temporaryStore(t, defaults);
  const original = await store.init();
  const next = structuredClone(original);
  next.media[0].alt = "변경된 대체 텍스트";
  next.media.push({
    id: "injected-media", url: "/uploads/not-created.png", originalName: "injected.png",
    mime: "image/png", size: 1, width: 1, height: 1, alt: "injected", managed: true,
    createdAt: new Date().toISOString(), sortOrder: 1,
  });
  next.activities.push({
    id: "new-activity", slug: "new-activity", title: "새 활동", summary: "", detail: "",
    date: "2026-08-24", category: "Test", coverImage: "", images: [], url: "", tags: [],
    visible: true, sortOrder: next.activities.length,
    createdAt: "2000-01-01T00:00:00.000Z", updatedAt: "2000-01-01T00:00:00.000Z",
  });
  const saved = await store.save(next, original.meta.revision);
  const created = saved.activities.find((activity) => activity.id === "new-activity");

  assert.equal(saved.meta.revision, original.meta.revision + 1);
  assert.deepEqual(saved.media.map((media) => media.id), original.media.map((media) => media.id));
  assert.equal(saved.media[0].alt, "변경된 대체 텍스트");
  assert.notEqual(created.createdAt, "2000-01-01T00:00:00.000Z");
  assert.equal(created.createdAt, created.updatedAt);
  await assert.rejects(store.save(saved, original.meta.revision), (error) => error.statusCode === 409);
  await assert.rejects(store.save(null, saved.meta.revision), (error) => error.statusCode === 400);
  assert.equal((await store.read()).meta.revision, saved.meta.revision);
});
