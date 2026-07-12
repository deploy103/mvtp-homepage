const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const crypto = require("crypto");

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");

    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && !Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    });
  } catch {
    // Environment variables may be provided by the host instead of a local file.
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const CONTENT_FILE = path.join(DATA_DIR, "site-content.json");
const ADMIN_ID = (process.env.ADMIN_ID || "").trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();
const ADMIN_SESSION_COOKIE = "mvtp_admin_session";
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto.createHash("sha256").update(`${ADMIN_ID}:${ADMIN_PASSWORD}:mvtp-homepage`).digest("hex");

const statusStates = new Set(["online", "warning", "offline", "neutral"]);

const defaultSiteContent = {
  serviceStatuses: [
    { id: "hansei", name: "School Links", status: "운영중", state: "online" },
    { id: "rice", name: "Rice", status: "운영중", state: "online" },
    { id: "calendar", name: "Calendar", status: "운영중", state: "online" },
    { id: "english", name: "English", status: "운영중", state: "online" },
    { id: "japan", name: "Japan", status: "운영중", state: "online" },
    { id: "login", name: "Login", status: "운영중", state: "online" },
    { id: "c-compiler", name: "C Compiler", status: "운영중", state: "online" },
    { id: "medas", name: "Medas", status: "운영중", state: "online" },
    { id: "downloads", name: "자료실", status: "운영중", state: "online" },
    { id: "file", name: "File Converter", status: "운영중", state: "online" },
    { id: "data", name: "Data Analytics", status: "운영중", state: "online" },
    { id: "hsoc", name: "HSOC", status: "운영중", state: "online" },
    { id: "ctf", name: "CTF", status: "운영중", state: "online" },
    { id: "network", name: "Network Lab", status: "운영중", state: "online" },
    { id: "chat", name: "Chat", status: "운영중", state: "online" },
  ],
  activities: [
    { name: "한세사이버보안고등학교 31기" },
    { name: "HanSei DevOps 차장" },
    { name: "HsShell 차장" },
    { name: "HS-CTF Team" },
    { name: "한세 기능부 부원" },
    { name: "교내 해커톤 한세톤 생활 부문 우승" },
  ],
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
};

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    ...securityHeaders,
    ...headers,
  });
  res.end(body);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];

  if (days > 0) parts.push(`${days}일`);
  if (hours > 0 || days > 0) parts.push(`${hours}시간`);
  parts.push(`${minutes}분`);

  return parts.join(" ");
}

async function getUptime() {
  try {
    const raw = await fs.promises.readFile("/proc/uptime", "utf8");
    const uptimeSeconds = Number.parseFloat(raw.split(/\s+/)[0]);

    if (Number.isFinite(uptimeSeconds) && uptimeSeconds >= 0) {
      return {
        seconds: Math.floor(uptimeSeconds),
        source: "/proc/uptime",
      };
    }
  } catch {
    // Non-Linux development machines fall back to Node's OS uptime.
  }

  return {
    seconds: Math.floor(os.uptime()),
    source: "os.uptime()",
  };
}

async function handleUptime(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, HEAD",
    });
    return;
  }

  const now = new Date();
  const uptime = await getUptime();
  const body = JSON.stringify({
    uptimeSeconds: uptime.seconds,
    formatted: formatDuration(uptime.seconds),
    bootedAt: new Date(now.getTime() - uptime.seconds * 1000).toISOString(),
    serverTime: now.toISOString(),
    source: uptime.source,
  });

  send(res, 200, req.method === "HEAD" ? "" : body, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  });
}

function parseCookies(header = "") {
  const cookies = {};

  header.split(";").forEach((cookie) => {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) return;

    const key = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();
    try {
      if (key) cookies[key] = decodeURIComponent(value);
    } catch {
      if (key) cookies[key] = value;
    }
  });

  return cookies;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value) {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(value).digest("base64url");
}

function createAdminSession() {
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: ADMIN_ID,
      exp: Date.now() + ADMIN_SESSION_TTL_MS,
    }),
  );

  return `${payload}.${signValue(payload)}`;
}

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();

  return crypto.timingSafeEqual(leftHash, rightHash);
}

function isAdminConfigured() {
  return Boolean(ADMIN_ID && ADMIN_PASSWORD);
}

function isAdminAuthenticated(req) {
  if (!isAdminConfigured()) return false;

  const token = parseCookies(req.headers.cookie || "")[ADMIN_SESSION_COOKIE];
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !constantTimeEqual(signature, signValue(payload))) return false;

  try {
    const session = JSON.parse(base64UrlDecode(payload));
    return session.sub === ADMIN_ID && Number(session.exp) > Date.now();
  } catch {
    return false;
  }
}

function getAdminCookie(req) {
  const secure = req.headers["x-forwarded-proto"] === "https" || process.env.COOKIE_SECURE === "true";
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(createAdminSession())}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`,
  ];

  if (secure) parts.push("Secure");

  return parts.join("; ");
}

function getClearAdminCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

async function handleAdminLogin(req, res) {
  if (req.method !== "POST") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "POST",
    });
    return;
  }

  if (!isAdminConfigured()) {
    send(res, 503, "Admin login is not configured", {
      "Content-Type": "text/plain; charset=utf-8",
    });
    return;
  }

  try {
    const rawBody = await readRequestBody(req, 8 * 1024);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const id = String(body.id || "").trim();
    const password = String(body.password || "");

    if (!constantTimeEqual(id, ADMIN_ID) || !constantTimeEqual(password, ADMIN_PASSWORD)) {
      send(res, 401, "Unauthorized", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    send(res, 200, JSON.stringify({ ok: true }), {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Set-Cookie": getAdminCookie(req),
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    send(res, statusCode, statusCode === 413 ? "Payload Too Large" : "Bad Request", {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }
}

async function handleAdminLogout(req, res) {
  if (req.method !== "POST") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "POST",
    });
    return;
  }

  send(res, 200, JSON.stringify({ ok: true }), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Set-Cookie": getClearAdminCookie(),
  });
}

async function handleAdminSession(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, HEAD",
    });
    return;
  }

  const body = JSON.stringify({ authenticated: isAdminAuthenticated(req) });

  send(res, 200, req.method === "HEAD" ? "" : body, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  });
}

function cloneDefaultSiteContent() {
  return JSON.parse(JSON.stringify(defaultSiteContent));
}

function normalizeSiteContent(value = {}) {
  const defaults = cloneDefaultSiteContent();
  const incomingStatuses = Array.isArray(value.serviceStatuses) ? value.serviceStatuses : [];
  const incomingStatusById = new Map(
    incomingStatuses
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.id || ""), item]),
  );

  const serviceStatuses = defaults.serviceStatuses.map((service) => {
    const incoming = incomingStatusById.get(service.id);
    const status =
      typeof incoming?.status === "string" && incoming.status.trim()
        ? incoming.status.trim().slice(0, 40)
        : service.status;
    const state = statusStates.has(incoming?.state) ? incoming.state : service.state;

    return {
      ...service,
      status,
      state,
    };
  });

  const rawActivities = Array.isArray(value.activities) ? value.activities : defaults.activities;
  const activities = rawActivities
    .map((activity) => {
      const rawName = typeof activity === "string" ? activity : activity?.name;
      return { name: String(rawName || "").trim().slice(0, 120) };
    })
    .filter((activity) => activity.name)
    .slice(0, 50);

  return {
    serviceStatuses,
    activities: activities.length > 0 ? activities : defaults.activities,
  };
}

async function ensureContentFile() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.promises.access(CONTENT_FILE, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(
      CONTENT_FILE,
      `${JSON.stringify(cloneDefaultSiteContent(), null, 2)}\n`,
      "utf8",
    );
  }
}

async function readSiteContent() {
  await ensureContentFile();

  try {
    const raw = await fs.promises.readFile(CONTENT_FILE, "utf8");
    return normalizeSiteContent(JSON.parse(raw));
  } catch {
    return cloneDefaultSiteContent();
  }
}

async function writeSiteContent(content) {
  const normalized = normalizeSiteContent(content);
  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  const temporaryFile = `${CONTENT_FILE}.tmp`;
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryFile, CONTENT_FILE);

  return normalized;
}

function readRequestBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > limitBytes) {
        reject(Object.assign(new Error("Payload Too Large"), { statusCode: 413 }));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleSiteContent(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "PUT") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, HEAD, PUT",
    });
    return;
  }

  if (req.method === "PUT" && !isAdminAuthenticated(req)) {
    send(res, 401, "Unauthorized", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const body = JSON.stringify(await readSiteContent());

    send(res, 200, req.method === "HEAD" ? "" : body, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    });
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = rawBody ? JSON.parse(rawBody) : {};
    const content = await writeSiteContent(body);

    send(res, 200, JSON.stringify(content), {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    send(res, statusCode, statusCode === 413 ? "Payload Too Large" : "Bad Request", {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }
}

async function handleAdminPage(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, HEAD",
    });
    return;
  }

  await serveStatic(req, res, isAdminAuthenticated(req) ? "/adminpage.html" : "/admin-login.html");
}

function resolveStaticPath(urlPath) {
  const normalizedPath =
    urlPath === "/"
      ? "/index.html"
      : urlPath === "/about" || urlPath === "/profile" || urlPath === "/profile/"
        ? "/about.html"
        : urlPath === "/downloads" || urlPath === "/downloads/"
          ? "/downloads.html"
          : urlPath;
  const decodedPath = decodeURIComponent(normalizedPath);
  const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return null;
  }

  return filePath;
}

function getAttachmentName(filePath) {
  const relativePath = path.relative(PUBLIC_DIR, filePath).split(path.sep).join("/");

  if (!relativePath.startsWith("downloads/")) {
    return null;
  }

  return path.basename(filePath).replace(/["\\\r\n]/g, "");
}

async function serveStatic(req, res, urlPath) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed", {
      "Content-Type": "text/plain; charset=utf-8",
      "Allow": "GET, HEAD",
    });
    return;
  }

  const filePath = resolveStaticPath(urlPath);

  if (!filePath) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);

    if (!stat.isFile()) {
      send(res, 404, "Not Found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const attachmentName = getAttachmentName(filePath);
    const cacheControl =
      ext === ".html"
        ? "no-store"
        : ext === ".css" || ext === ".js"
          ? "no-cache, max-age=0"
          : "public, max-age=604800, immutable";

    const headers = {
      ...securityHeaders,
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": cacheControl,
    };

    if (attachmentName) {
      headers["Content-Disposition"] = `attachment; filename="${attachmentName}"`;
    }

    res.writeHead(200, headers);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    const statusCode = error.code === "ENOENT" ? 404 : 500;
    send(res, statusCode, statusCode === 404 ? "Not Found" : "Internal Server Error", {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/uptime") {
      await handleUptime(req, res);
      return;
    }

    if (url.pathname === "/api/admin-login") {
      await handleAdminLogin(req, res);
      return;
    }

    if (url.pathname === "/api/admin-logout") {
      await handleAdminLogout(req, res);
      return;
    }

    if (url.pathname === "/api/admin-session") {
      await handleAdminSession(req, res);
      return;
    }

    if (url.pathname === "/api/site-content") {
      await handleSiteContent(req, res);
      return;
    }

    if (
      url.pathname === "/adminpage" ||
      url.pathname === "/adminpage/" ||
      url.pathname === "/adminpage.html"
    ) {
      await handleAdminPage(req, res);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch {
    send(res, 400, "Bad Request", { "Content-Type": "text/plain; charset=utf-8" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MVTP homepage running at http://${HOST}:${PORT}`);
});
