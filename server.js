const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const crypto = require("crypto");
const {
  ContentStoreError,
  createContentStore,
  publicContent,
} = require("./lib/content-store");

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
      if (key && !Object.prototype.hasOwnProperty.call(process.env, key)) process.env[key] = value;
    });
  } catch {
    // The deployment environment may provide variables without a local .env file.
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".zip": "application/zip",
  ".exe": "application/vnd.microsoft.portable-executable",
};

const CLEAN_URL_REDIRECTS = new Map([
  ["/index.html", "/"],
  ["/about.html", "/about"],
  ["/downloads.html", "/downloads"],
  ["/adminpage.html", "/adminpage"],
]);

const ADMIN_COOKIE = "mvtp_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 12000;
const MAX_IMAGE_PIXELS = 40_000_000;

function securityHeaders() {
  return {
    "Content-Security-Policy":
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { ...securityHeaders(), ...headers });
  res.end(body);
}

function sendJson(res, statusCode, value, headers = {}, headOnly = false) {
  const body = JSON.stringify(value);
  send(res, statusCode, headOnly ? "" : body, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    ...headers,
  });
}

function sendApiError(res, statusCode, message) {
  sendJson(res, statusCode, { ok: false, error: message });
}

function methodNotAllowed(res, methods) {
  send(res, 405, "Method Not Allowed", {
    "Content-Type": "text/plain; charset=utf-8",
    Allow: methods.join(", "),
  });
}

function parseCookies(header = "") {
  const cookies = {};
  header.split(";").forEach((cookie) => {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) return;
    const key = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();
    if (!key) return;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  });
  return cookies;
}

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function readRequestBuffer(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number.parseInt(req.headers["content-length"] || "0", 10);
    if (Number.isFinite(declaredLength) && declaredLength > limitBytes) {
      reject(Object.assign(new Error("Payload Too Large"), { statusCode: 413 }));
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        settled = true;
        reject(Object.assign(new Error("Payload Too Large"), { statusCode: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!settled) resolve(Buffer.concat(chunks));
    });
    req.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

async function readJson(req, limitBytes = MAX_JSON_BYTES) {
  const contentType = String(req.headers["content-type"] || "").split(";", 1)[0].trim();
  if (contentType !== "application/json") {
    throw Object.assign(new Error("Content-Type must be application/json"), { statusCode: 415 });
  }
  const raw = await readRequestBuffer(req, limitBytes);
  try {
    return raw.length ? JSON.parse(raw.toString("utf8")) : {};
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { statusCode: 400 });
  }
}

function getClientIp(req) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",", 1)[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || "unknown";
}

function requestProtocol(req) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",", 1)[0].trim().toLowerCase();
    if (forwarded === "http" || forwarded === "https") return forwarded;
  }
  return req.socket.encrypted ? "https" : "http";
}

function requestOrigin(req) {
  return `${requestProtocol(req)}://${req.headers.host || "localhost"}`;
}

function hasSafeOrigin(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(requestOrigin(req)).origin;
  } catch {
    return false;
  }
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
    const seconds = Number.parseFloat(raw.split(/\s+/)[0]);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.floor(seconds);
  } catch {
    // Non-Linux development systems use Node's OS uptime.
  }
  return Math.floor(os.uptime());
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && length >= 7) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) return null;
  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X") {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (format === "VP8 " && buffer.toString("hex", 23, 26) === "9d012a") {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (format === "VP8L" && buffer[20] === 0x2f && buffer.length >= 25) {
    return {
      width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]),
      height: 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6)),
    };
  }
  return null;
}

function pngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 57 || !buffer.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawImageData = false;
  let chunkCount = 0;

  while (offset + 12 <= buffer.length && chunkCount < 10000) {
    const dataLength = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const chunkEnd = dataStart + dataLength + 4;
    if (chunkEnd > buffer.length) return null;
    if (!sawHeader && type !== "IHDR") return null;
    if (type === "IHDR") {
      if (sawHeader || dataLength !== 13) return null;
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      if (buffer[dataStart + 10] !== 0 || buffer[dataStart + 11] !== 0 || buffer[dataStart + 12] > 1) {
        return null;
      }
      sawHeader = true;
    } else if (type === "IDAT") {
      if (!sawHeader || dataLength === 0) return null;
      sawImageData = true;
    } else if (type === "IEND") {
      if (dataLength !== 0 || !sawImageData || chunkEnd !== buffer.length) return null;
      return { width, height };
    }
    offset = chunkEnd;
    chunkCount += 1;
  }
  return null;
}

function detectImage(buffer) {
  let detected = null;
  const png = pngDimensions(buffer);
  if (png) {
    detected = {
      mime: "image/png",
      extension: ".png",
      ...png,
    };
  } else {
    const jpeg = jpegDimensions(buffer);
    if (jpeg && buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) {
      detected = { mime: "image/jpeg", extension: ".jpg", ...jpeg };
    }
    else {
      const webp = webpDimensions(buffer);
      if (webp && buffer.readUInt32LE(4) + 8 === buffer.length) {
        detected = { mime: "image/webp", extension: ".webp", ...webp };
      }
    }
  }
  if (
    !detected || detected.width < 1 || detected.height < 1 ||
    detected.width > MAX_IMAGE_DIMENSION || detected.height > MAX_IMAGE_DIMENSION ||
    detected.width * detected.height > MAX_IMAGE_PIXELS
  ) return null;
  return detected;
}

function safeOriginalName(headerValue, extension) {
  let decoded = String(headerValue || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the undecoded header if percent encoding is malformed.
  }
  const name = path.basename(decoded.replace(/[\0\r\n]/g, "")).slice(0, 160);
  return name || `image${extension}`;
}

function createApplication(options = {}) {
  const rootDirectory = options.rootDirectory || __dirname;
  const publicDirectory = options.publicDirectory || path.join(rootDirectory, "public");
  const uploadDirectory = options.uploadDirectory || path.join(publicDirectory, "uploads");
  const contentFile = options.contentFile || path.join(rootDirectory, "data", "site-content.json");
  const defaultsFile = options.defaultsFile || path.join(rootDirectory, "data", "content-defaults.json");
  const adminId = String(options.adminId ?? process.env.ADMIN_ID ?? "").trim();
  const adminPassword = String(options.adminPassword ?? process.env.ADMIN_PASSWORD ?? "");
  const configuredSecret = String(options.sessionSecret ?? process.env.ADMIN_SESSION_SECRET ?? "");
  const sessionSecret = configuredSecret ||
    crypto.createHash("sha256").update(`${adminId}:${adminPassword}:mvtp-session-v2`).digest("hex");
  const store = createContentStore({ contentFile, defaultsFile });
  const loginAttempts = new Map();

  function sign(value) {
    return crypto.createHmac("sha256", sessionSecret).update(value).digest("base64url");
  }

  function createSession() {
    const payload = Buffer.from(JSON.stringify({
      sub: adminId,
      exp: Date.now() + SESSION_TTL_MS,
      csrf: crypto.randomBytes(24).toString("base64url"),
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function sessionFromRequest(req) {
    if (!adminId || !adminPassword) return null;
    const token = parseCookies(req.headers.cookie || "")[ADMIN_COOKIE];
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2 || !constantTimeEqual(parts[1], sign(parts[0]))) return null;
    try {
      const session = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      if (
        session.sub !== adminId || !Number.isFinite(Number(session.exp)) ||
        Number(session.exp) <= Date.now() || typeof session.csrf !== "string"
      ) return null;
      return session;
    } catch {
      return null;
    }
  }

  function cookieForSession(req, sessionToken) {
    const secure = requestProtocol(req) === "https" || process.env.COOKIE_SECURE === "true";
    const parts = [
      `${ADMIN_COOKIE}=${encodeURIComponent(sessionToken)}`, "Path=/", "HttpOnly", "SameSite=Strict",
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    ];
    if (secure) parts.push("Secure");
    return parts.join("; ");
  }

  function clearCookie(req) {
    const secure = requestProtocol(req) === "https" || process.env.COOKIE_SECURE === "true";
    return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
  }

  function authorize(req, res, { csrf = false } = {}) {
    const session = sessionFromRequest(req);
    if (!session) {
      sendApiError(res, 401, "Authentication required");
      return null;
    }
    if (csrf) {
      if (!hasSafeOrigin(req)) {
        sendApiError(res, 403, "Cross-origin request blocked");
        return null;
      }
      const token = String(req.headers["x-csrf-token"] || "");
      if (!token || !constantTimeEqual(token, session.csrf)) {
        sendApiError(res, 403, "Invalid CSRF token");
        return null;
      }
    }
    return session;
  }

  function loginIsLimited(req) {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [key, attempts] of loginAttempts) {
      const recent = attempts.filter((timestamp) => timestamp > cutoff);
      if (recent.length) loginAttempts.set(key, recent);
      else loginAttempts.delete(key);
    }
    return (loginAttempts.get(getClientIp(req)) || []).length >= 7;
  }

  function recordLoginFailure(req) {
    const ip = getClientIp(req);
    if (!loginAttempts.has(ip) && loginAttempts.size >= 1000) {
      loginAttempts.delete(loginAttempts.keys().next().value);
    }
    loginAttempts.set(ip, [...(loginAttempts.get(ip) || []), Date.now()].slice(-7));
  }

  async function handleLogin(req, res) {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
    if (!adminId || !adminPassword) return sendApiError(res, 503, "Admin login is not configured");
    if (!hasSafeOrigin(req)) return sendApiError(res, 403, "Cross-origin request blocked");
    if (loginIsLimited(req)) return sendApiError(res, 429, "Too many login attempts. Try again later.");
    try {
      const body = await readJson(req, 8 * 1024);
      const id = String(body.id || "").trim();
      const password = String(body.password || "");
      if (!constantTimeEqual(id, adminId) || !constantTimeEqual(password, adminPassword)) {
        recordLoginFailure(req);
        return sendApiError(res, 401, "Invalid credentials");
      }
      loginAttempts.delete(getClientIp(req));
      const token = createSession();
      const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
      return sendJson(res, 200, { ok: true, csrfToken: payload.csrf }, {
        "Set-Cookie": cookieForSession(req, token),
      });
    } catch (error) {
      return sendApiError(res, error.statusCode || 400, error.message || "Bad Request");
    }
  }

  async function handleLogout(req, res) {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
    if (!authorize(req, res, { csrf: true })) return;
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearCookie(req) });
  }

  async function handleSession(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(res, ["GET", "HEAD"]);
    const session = sessionFromRequest(req);
    return sendJson(res, 200, {
      authenticated: Boolean(session), csrfToken: session?.csrf || "",
    }, {}, req.method === "HEAD");
  }

  async function handlePublicContent(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(res, ["GET", "HEAD"]);
    return sendJson(res, 200, publicContent(await store.read()), {}, req.method === "HEAD");
  }

  async function handleAdminContent(req, res) {
    if (!["GET", "HEAD", "PUT"].includes(req.method)) return methodNotAllowed(res, ["GET", "HEAD", "PUT"]);
    if (!authorize(req, res, { csrf: req.method === "PUT" })) return;
    if (req.method === "GET" || req.method === "HEAD") {
      const current = await store.read();
      return sendJson(res, 200, current, { ETag: `"${current.meta.revision}"` }, req.method === "HEAD");
    }
    try {
      const revisionMatch = String(req.headers["if-match"] || "").match(/^(?:W\/)?"(\d+)"$/);
      if (!revisionMatch) return sendApiError(res, 428, "A valid If-Match revision is required");
      const body = await readJson(req);
      const saved = await store.save(body, revisionMatch[1]);
      return sendJson(res, 200, saved, { ETag: `"${saved.meta.revision}"` });
    } catch (error) {
      const status = error.statusCode || (error instanceof ContentStoreError ? error.statusCode : 500);
      return sendApiError(res, status, error.message || "Unable to save content");
    }
  }

  async function handleMediaUpload(req, res) {
    if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
    if (!authorize(req, res, { csrf: true })) return;
    const declaredMime = String(req.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(declaredMime)) {
      return sendApiError(res, 415, "Only JPEG, PNG, and WebP images are allowed");
    }
    let savedPath = "";
    try {
      const buffer = await readRequestBuffer(req, MAX_IMAGE_BYTES);
      const detected = detectImage(buffer);
      if (!detected || detected.mime !== declaredMime) {
        return sendApiError(res, 415, "The file content is not a supported image");
      }
      await fs.promises.mkdir(uploadDirectory, { recursive: true, mode: 0o755 });
      const id = crypto.randomUUID();
      const fileName = `${id}${detected.extension}`;
      savedPath = path.join(uploadDirectory, fileName);
      await fs.promises.writeFile(savedPath, buffer, { flag: "wx", mode: 0o644 });
      let alt = "";
      try {
        alt = decodeURIComponent(String(req.headers["x-image-alt"] || ""));
      } catch {
        alt = String(req.headers["x-image-alt"] || "");
      }
      const result = await store.addMedia({
        id, url: `/uploads/${fileName}`,
        originalName: safeOriginalName(req.headers["x-file-name"], detected.extension),
        mime: detected.mime, size: buffer.length, width: detected.width, height: detected.height,
        alt, managed: true, createdAt: new Date().toISOString(),
      });
      return sendJson(res, 201, { ok: true, media: result.media, meta: result.content.meta });
    } catch (error) {
      if (savedPath) await fs.promises.unlink(savedPath).catch(() => undefined);
      return sendApiError(res, error.statusCode || 500, error.message || "Image upload failed");
    }
  }

  async function handleMediaItem(req, res, mediaId) {
    if (req.method !== "DELETE") return methodNotAllowed(res, ["DELETE"]);
    if (!authorize(req, res, { csrf: true })) return;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(mediaId)) return sendApiError(res, 400, "Invalid media id");
    try {
      const result = await store.removeMedia(mediaId);
      if (result.media.url.startsWith("/uploads/")) {
        const fileName = result.media.url.slice("/uploads/".length);
        if (/^[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(fileName)) {
          await fs.promises.unlink(path.join(uploadDirectory, fileName)).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      }
      return sendJson(res, 200, { ok: true, meta: result.content.meta });
    } catch (error) {
      return sendApiError(res, error.statusCode || 500, error.message || "Unable to delete media");
    }
  }

  function resolveStaticPath(urlPath) {
    const routePath = urlPath === "/" ? "/index.html"
      : urlPath === "/about" || urlPath === "/about/" || urlPath === "/profile" || urlPath === "/profile/"
        ? "/about.html"
        : urlPath === "/downloads" || urlPath === "/downloads/" ? "/downloads.html"
          : /^\/activities\/[^/]+\/?$/.test(urlPath) ? "/activity.html" : urlPath;
    let decoded;
    try {
      decoded = decodeURIComponent(routePath);
    } catch {
      return null;
    }
    if (decoded.split("/").some((segment) => segment.startsWith("."))) return null;
    const filePath = path.resolve(publicDirectory, `.${decoded}`);
    return filePath.startsWith(`${publicDirectory}${path.sep}`) ? filePath : null;
  }

  function resolveUploadPath(urlPath) {
    if (!urlPath.startsWith("/uploads/")) return null;
    const fileName = urlPath.slice("/uploads/".length);
    if (!/^[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(fileName)) return null;
    return path.join(uploadDirectory, fileName);
  }

  function attachmentName(filePath) {
    const relative = path.relative(publicDirectory, filePath).split(path.sep).join("/");
    if (!relative.startsWith("downloads/")) return null;
    return path.basename(filePath).replace(/["\\\r\n]/g, "");
  }

  async function serveFile(req, res, filePath) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return send(res, 404, "Not Found", { "Content-Type": "text/plain; charset=utf-8" });
      const extension = path.extname(filePath).toLowerCase();
      const downloadName = attachmentName(filePath);
      const cacheControl = extension === ".html" ? "no-store"
        : extension === ".css" || extension === ".js" ? "no-cache, max-age=0"
          : "public, max-age=604800, immutable";
      const headers = {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Content-Length": stat.size, "Cache-Control": cacheControl,
      };
      if (downloadName) headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
      res.writeHead(200, { ...securityHeaders(), ...headers });
      if (req.method === "HEAD") return res.end();
      const stream = fs.createReadStream(filePath);
      stream.on("error", () => res.destroy());
      return stream.pipe(res);
    } catch (error) {
      const statusCode = error.code === "ENOENT" ? 404 : 500;
      return send(res, statusCode, statusCode === 404 ? "Not Found" : "Internal Server Error", {
        "Content-Type": "text/plain; charset=utf-8",
      });
    }
  }

  async function serveStatic(req, res, urlPath) {
    if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(res, ["GET", "HEAD"]);
    const filePath = urlPath.startsWith("/uploads/")
      ? resolveUploadPath(urlPath)
      : resolveStaticPath(urlPath);
    if (!filePath) return send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return serveFile(req, res, filePath);
  }

  async function handleAdminPage(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(res, ["GET", "HEAD"]);
    return serveStatic(req, res, sessionFromRequest(req) ? "/adminpage.html" : "/admin-login.html");
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
      return send(res, 400, "Bad Request", { "Content-Type": "text/plain; charset=utf-8" });
    }
    try {
      if (url.pathname === "/api/uptime") {
        if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(res, ["GET", "HEAD"]);
        const seconds = await getUptime();
        return sendJson(res, 200, {
          uptimeSeconds: seconds, formatted: formatDuration(seconds),
          bootedAt: new Date(Date.now() - seconds * 1000).toISOString(),
          serverTime: new Date().toISOString(),
        }, {}, req.method === "HEAD");
      }
      if (url.pathname === "/api/site-content") return await handlePublicContent(req, res);
      if (url.pathname === "/api/admin-login") return await handleLogin(req, res);
      if (url.pathname === "/api/admin-logout") return await handleLogout(req, res);
      if (url.pathname === "/api/admin-session") return await handleSession(req, res);
      if (url.pathname === "/api/admin/content") return await handleAdminContent(req, res);
      if (url.pathname === "/api/admin/media") return await handleMediaUpload(req, res);
      if (url.pathname.startsWith("/api/admin/media/")) {
        let mediaId;
        try {
          mediaId = decodeURIComponent(url.pathname.slice("/api/admin/media/".length));
        } catch {
          return sendApiError(res, 400, "Invalid media id");
        }
        return await handleMediaItem(req, res, mediaId);
      }
      if (url.pathname === "/adminpage" || url.pathname === "/adminpage/" || url.pathname === "/adminpage.html") {
        return await handleAdminPage(req, res);
      }
      const cleanUrl = CLEAN_URL_REDIRECTS.get(url.pathname);
      if (cleanUrl) return send(res, 301, "", {
        Location: `${cleanUrl}${url.search}`, "Cache-Control": "no-store, max-age=0",
      });
      return await serveStatic(req, res, url.pathname);
    } catch {
      if (res.headersSent) return res.destroy();
      return send(res, 500, "Internal Server Error", { "Content-Type": "text/plain; charset=utf-8" });
    }
  });

  return {
    server, store,
    initialize: () => store.init().then(() => fs.promises.mkdir(uploadDirectory, { recursive: true })),
  };
}

async function start() {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";
  const application = createApplication();
  await application.initialize();
  application.server.listen(port, host, () => {
    process.stdout.write(`MVTP homepage running at http://${host}:${port}\n`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    process.stderr.write(`Unable to start server: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { createApplication, detectImage };
