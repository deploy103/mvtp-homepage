const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createApplication } = require("../server");

const projectRoot = path.join(__dirname, "..");
const adminId = `test-${crypto.randomUUID()}`;
const adminPassword = crypto.randomBytes(32).toString("hex");
const sessionSecret = crypto.randomBytes(48).toString("hex");

async function startTestApplication(t) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mvtp-server-test-"));
  const contentFile = path.join(directory, "site-content.json");
  const defaultsFile = path.join(directory, "content-defaults.json");
  const uploadDirectory = path.join(directory, "uploads");
  await fs.promises.copyFile(path.join(projectRoot, "data", "content-defaults.json"), defaultsFile);
  await fs.promises.copyFile(path.join(projectRoot, "data", "content-defaults.json"), contentFile);

  const application = createApplication({
    rootDirectory: projectRoot,
    publicDirectory: path.join(projectRoot, "public"),
    uploadDirectory,
    contentFile,
    defaultsFile,
    adminId,
    adminPassword,
    sessionSecret,
  });
  await application.initialize();
  await new Promise((resolve) => application.server.listen(0, "127.0.0.1", resolve));
  const address = application.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise((resolve) => application.server.close(resolve));
    await fs.promises.rm(directory, { recursive: true, force: true });
  });
  return { baseUrl, uploadDirectory };
}

async function authenticate(baseUrl) {
  const response = await fetch(`${baseUrl}/api/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ id: adminId, password: adminPassword }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  return {
    cookie: response.headers.get("set-cookie").split(";", 1)[0],
    csrfToken: result.csrfToken,
  };
}

test("static pages and public API include security headers and only visible content", async (t) => {
  const { baseUrl, uploadDirectory } = await startTestApplication(t);
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /object-src 'none'/);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.match(await page.text(), /data-page="home"/);

  const detailShell = await fetch(`${baseUrl}/activities/example-slug`);
  assert.equal(detailShell.status, 200);
  assert.match(await detailShell.text(), /data-page="activity"/);

  const publicResponse = await fetch(`${baseUrl}/api/site-content`);
  const publicContent = await publicResponse.json();
  assert.equal(publicResponse.status, 200);
  assert.equal(Object.hasOwn(publicContent, "media"), false);
  assert.ok(publicContent.operations.length > 0);
  assert.ok(publicContent.projects.every((project) => project.visible));

  const traversal = await fetch(`${baseUrl}/%2e%2e%2fserver.js`);
  assert.ok([403, 404].includes(traversal.status));

  await fs.promises.writeFile(path.join(uploadDirectory, "unmanaged.png"), "not an uploaded image");
  assert.equal((await fetch(`${baseUrl}/uploads/unmanaged.png`)).status, 403);
});

test("admin authentication, CSRF, authorization, revisions, and visibility work together", async (t) => {
  const { baseUrl } = await startTestApplication(t);
  assert.equal((await fetch(`${baseUrl}/api/admin/content`)).status, 401);
  assert.match(await (await fetch(`${baseUrl}/adminpage`)).text(), /data-admin-login-form/);

  const crossSiteLogin = await fetch(`${baseUrl}/api/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ id: adminId, password: adminPassword }),
  });
  assert.equal(crossSiteLogin.status, 403);

  const spoofedProxyLogin = await fetch(`${baseUrl}/api/admin-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl.replace("http://", "https://"),
      "X-Forwarded-Proto": "https",
    },
    body: JSON.stringify({ id: adminId, password: adminPassword }),
  });
  assert.equal(spoofedProxyLogin.status, 403);

  const auth = await authenticate(baseUrl);
  assert.match(
    await (await fetch(`${baseUrl}/adminpage`, { headers: { Cookie: auth.cookie } })).text(),
    /data-admin-content/,
  );
  const sessionResponse = await fetch(`${baseUrl}/api/admin-session`, { headers: { Cookie: auth.cookie } });
  const session = await sessionResponse.json();
  assert.equal(session.authenticated, true);
  assert.equal(session.csrfToken, auth.csrfToken);

  const contentResponse = await fetch(`${baseUrl}/api/admin/content`, { headers: { Cookie: auth.cookie } });
  const content = await contentResponse.json();
  const missingCsrf = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: { Cookie: auth.cookie, "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  assert.equal(missingCsrf.status, 403);
  const missingRevision = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      Cookie: auth.cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-CSRF-Token": auth.csrfToken,
    },
    body: JSON.stringify(content),
  });
  assert.equal(missingRevision.status, 428);

  content.site.siteName = "Updated portfolio";
  content.profile.role = "Updated role";
  content.projects[0].summary = "Updated project summary";
  content.projects[1].visible = false;
  const movedProject = content.projects.pop();
  content.projects.unshift(movedProject);
  content.projects.forEach((project, index) => { project.sortOrder = index; });
  content.skills[0].description = "Updated skill description";
  content.skills[1].visible = false;
  content.operations[0].description = "Updated operation description";

  content.activities.unshift({
    id: "dated-private", slug: "dated-private", title: "비공개 활동", summary: "private",
    detail: "", date: "2025-06-03", category: "Test", coverImage: "", images: [], url: "",
    tags: [], visible: false, sortOrder: 0,
  });
  content.activities.unshift({
    id: "dated-public", slug: "dated-public", title: "공개 활동", summary: "public",
    detail: "", date: "2026-06-03", category: "Test", coverImage: "", images: [], url: "",
    tags: [], visible: true, sortOrder: 0,
  });
  const savedResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      Cookie: auth.cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-CSRF-Token": auth.csrfToken,
      "If-Match": `"${content.meta.revision}"`,
    },
    body: JSON.stringify(content),
  });
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();
  assert.equal(saved.activities[0].title, "공개 활동");
  assert.equal(saved.projects[0].id, movedProject.id);

  const publicContent = await (await fetch(`${baseUrl}/api/site-content`)).json();
  assert.equal(publicContent.site.siteName, "Updated portfolio");
  assert.equal(publicContent.profile.role, "Updated role");
  assert.equal(publicContent.projects.some((project) => project.id === "rice"), false);
  assert.equal(publicContent.skills.some((skill) => skill.id === "skill-cloud"), false);
  assert.equal(publicContent.skills.find((skill) => skill.id === "skill-homelab").description, "Updated skill description");
  assert.equal(publicContent.operations[0].description, "Updated operation description");
  assert.equal(publicContent.activities.find((activity) => activity.id === "dated-public").year, 2026);
  assert.equal(publicContent.activities.some((activity) => activity.id === "dated-private"), false);

  const editedActivity = saved.activities.find((activity) => activity.id === "dated-public");
  editedActivity.summary = "수정된 공개 활동";
  saved.activities = saved.activities.filter((activity) => activity.id !== "dated-private");
  const movedActivity = saved.activities.pop();
  saved.activities.unshift(movedActivity);
  saved.activities.forEach((activity, index) => { activity.sortOrder = index; });
  const activityEditResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      Cookie: auth.cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-CSRF-Token": auth.csrfToken,
      "If-Match": `"${saved.meta.revision}"`,
    },
    body: JSON.stringify(saved),
  });
  assert.equal(activityEditResponse.status, 200);
  const activityEdited = await activityEditResponse.json();
  assert.equal(activityEdited.activities[0].id, movedActivity.id);
  assert.equal(activityEdited.activities.find((activity) => activity.id === "dated-public").summary, "수정된 공개 활동");
  assert.equal(activityEdited.activities.some((activity) => activity.id === "dated-private"), false);

  const staleSave = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      Cookie: auth.cookie,
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-CSRF-Token": auth.csrfToken,
      "If-Match": `"${content.meta.revision}"`,
    },
    body: JSON.stringify(saved),
  });
  assert.equal(staleSave.status, 409);

  const logout = await fetch(`${baseUrl}/api/admin-logout`, {
    method: "POST",
    headers: { Cookie: auth.cookie, Origin: baseUrl, "X-CSRF-Token": auth.csrfToken },
  });
  assert.equal(logout.status, 200);
  const clearedCookie = logout.headers.get("set-cookie").split(";", 1)[0];
  const loggedOutSession = await (await fetch(`${baseUrl}/api/admin-session`, {
    headers: { Cookie: clearedCookie },
  })).json();
  assert.equal(loggedOutSession.authenticated, false);
});

test("image upload validates content and referenced media cannot be deleted", async (t) => {
  const { baseUrl, uploadDirectory } = await startTestApplication(t);
  const auth = await authenticate(baseUrl);
  const commonHeaders = { Cookie: auth.cookie, Origin: baseUrl, "X-CSRF-Token": auth.csrfToken };

  const invalidUpload = await fetch(`${baseUrl}/api/admin/media`, {
    method: "POST",
    headers: { ...commonHeaders, "Content-Type": "image/png", "X-File-Name": "fake.png" },
    body: Buffer.from("<script>alert(1)</script>"),
  });
  assert.equal(invalidUpload.status, 415);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const uploadResponse = await fetch(`${baseUrl}/api/admin/media`, {
    method: "POST",
    headers: {
      ...commonHeaders,
      "Content-Type": "image/png",
      "X-File-Name": encodeURIComponent("profile ../ image.png"),
    },
    body: png,
  });
  assert.equal(uploadResponse.status, 201);
  const upload = await uploadResponse.json();
  assert.match(upload.media.url, /^\/uploads\/[a-f0-9-]{36}\.png$/);
  assert.equal(upload.media.width, 1);
  assert.equal((await fs.promises.readdir(uploadDirectory)).length, 1);

  const content = await (await fetch(`${baseUrl}/api/admin/content`, { headers: { Cookie: auth.cookie } })).json();
  content.profile.profileImage = upload.media.url;
  const referenceResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/json",
      "If-Match": `"${content.meta.revision}"`,
    },
    body: JSON.stringify(content),
  });
  assert.equal(referenceResponse.status, 200);
  let saved = await referenceResponse.json();

  const blockedDelete = await fetch(`${baseUrl}/api/admin/media/${upload.media.id}`, {
    method: "DELETE",
    headers: commonHeaders,
  });
  assert.equal(blockedDelete.status, 409);

  saved.profile.profileImage = "";
  const detachResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/json",
      "If-Match": `"${saved.meta.revision}"`,
    },
    body: JSON.stringify(saved),
  });
  assert.equal(detachResponse.status, 200);

  const deleted = await fetch(`${baseUrl}/api/admin/media/${upload.media.id}`, {
    method: "DELETE",
    headers: commonHeaders,
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await fs.promises.readdir(uploadDirectory), []);
});
