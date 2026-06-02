const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");

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

function resolveStaticPath(urlPath) {
  const normalizedPath = urlPath === "/" ? "/index.html" : urlPath === "/about" ? "/about.html" : urlPath;
  const decodedPath = decodeURIComponent(normalizedPath);
  const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return null;
  }

  return filePath;
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
    const cacheControl = ext === ".html" ? "no-store" : "public, max-age=604800, immutable";

    res.writeHead(200, {
      ...securityHeaders,
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    });

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

    await serveStatic(req, res, url.pathname);
  } catch {
    send(res, 400, "Bad Request", { "Content-Type": "text/plain; charset=utf-8" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MVTP homepage running at http://${HOST}:${PORT}`);
});
