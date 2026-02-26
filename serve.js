/**
 * Very small HTTP server + mock game API for Cosmic Cash.
 * Keeps logic simple to avoid invalid responses.
 *
 * Usage: node serve.js
 * Then open: http://localhost:8080/
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DEMO = path.join(ROOT, "demogamesfree.pragmaticplay.net", "gs2c");

const MIME = {
  ".html": "text/html",
  ".htm": "text/html",
  ".do": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".ttf": "font/ttf",
};

// Cached mock responses (loaded once)
let gameServiceBody = null;
let reloadBalanceBody = null;
let saveSettingsBody = null;
let statsBody = null;

function loadMockResponses() {
  const gsPath = path.join(DEMO, "ge", "v4", "gameService.html");
  const rbPath = path.join(DEMO, "reloadBalance.do");
  const ssPath = path.join(DEMO, "saveSettings.do");
  const stPath = path.join(DEMO, "stats.do");
  try {
    if (fs.existsSync(gsPath)) gameServiceBody = fs.readFileSync(gsPath, "utf8");
    if (fs.existsSync(rbPath)) reloadBalanceBody = fs.readFileSync(rbPath, "utf8");
    if (fs.existsSync(ssPath)) saveSettingsBody = fs.readFileSync(ssPath, "utf8");
    if (fs.existsSync(stPath)) statsBody = fs.readFileSync(stPath, "utf8");
  } catch (e) {
    console.warn("Could not load some mock responses:", e.message);
  }
}

function sendMock(res, body, contentType) {
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType || "application/x-www-form-urlencoded");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(body || "");
}

const server = http.createServer((req, res) => {
  try {
    // Use only the path part (safe on all Node versions)
    const pathname = (req.url || "").split("?")[0] || "/";

    // Mock: gameService (init, spin, etc.) – return saved init response
    if (pathname.includes("gameService")) {
      const body = gameServiceBody || "balance=100000.00&balance_cash=100000.00&na=s";
      return sendMock(res, body);
    }

    // Mock: reloadBalance.do
    if (pathname.includes("reloadBalance.do")) {
      const body =
        reloadBalanceBody ||
        "balance_bonus=0.00&balance=100000.00&balance_cash=100000.00&stime=" + Date.now();
      return sendMock(res, body);
    }

    // Mock: saveSettings.do (POST) – accept and return OK
    if (pathname.includes("saveSettings.do")) {
      const body = saveSettingsBody || "";
      return sendMock(res, body, "text/plain");
    }

    // Mock: stats.do (analytics) – return OK
    if (pathname.includes("stats.do")) {
      const body = statsBody || '{"error":0,"description":"OK"}';
      return sendMock(res, body, "application/json");
    }

    // Mock: customizations.info – file not in clone; return empty so game continues
    if (pathname.includes("customizations.info")) {
      return sendMock(res, '{"customizations":[]}', "application/json");
    }

    // Static file – serve index.html for root, with fallbacks for vs40cosmiccash assets
    const isRoot = pathname === "/" || pathname === "" || pathname === "/index.html";
    const relPath = isRoot ? "index.html" : pathname.replace(/^\//, "");

    // Build list of candidate relative paths to try
    const relCandidates = [relPath];

    // For game assets, some requests may miss the "desktop" or "desktop/game" segment.
    // Try a few safe fallbacks so JSON/resources resolve correctly both locally and on Render.
    const vsPrefix =
      "demogamesfree.pragmaticplay.net/gs2c/common/v1/games-html5/games/vs/vs40cosmiccash/";
    if (relPath.startsWith(vsPrefix)) {
      const tail = relPath.slice(vsPrefix.length); // part after vs40cosmiccash/

      // If there is no "desktop/" segment, try inserting it
      if (!tail.startsWith("desktop/")) {
        relCandidates.push(vsPrefix + "desktop/" + tail);
      }

      // If there is no "desktop/game/" segment, try inserting it before the filename
      if (!tail.startsWith("desktop/game/")) {
        const tailNoLeadingGame = tail.startsWith("game/") ? tail.slice("game/".length) : tail;
        relCandidates.push(vsPrefix + "desktop/game/" + tailNoLeadingGame);
      }
    }

    // Try candidates in order until one exists
    const tryCandidate = (index) => {
      if (index >= relCandidates.length) {
        res.statusCode = 404;
        return res.end("Not Found: " + pathname);
      }

      const candidateRel = relCandidates[index];
      const candidatePath = path.join(ROOT, candidateRel);
      const normalized = path.normalize(candidatePath);

      if (!normalized.startsWith(ROOT)) {
        res.statusCode = 403;
        return res.end("Forbidden");
      }

      fs.stat(candidatePath, (err, stat) => {
        if (err || !stat || !stat.isFile()) {
          return tryCandidate(index + 1);
        }
        const ext = path.extname(candidatePath);
        res.statusCode = 200;
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        fs.createReadStream(candidatePath).pipe(res);
      });
    };

    tryCandidate(0);
  } catch (e) {
    console.error("Server error:", e);
    res.statusCode = 500;
    res.end("Internal server error");
  }
});

loadMockResponses();
server.listen(PORT, () => {
  console.log("Cosmic Cash local server at http://localhost:" + PORT + "/");
  console.log("Mock API: gameService, reloadBalance, saveSettings, stats");
  console.log("Open in browser: http://localhost:" + PORT + "/");
});
