const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8080);
const ACCESS_CODE = process.env.ACCESS_CODE || "";
const PUBLIC_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const defaultState = {
  ingredients: [
    { id: "seed-chicken", name: "Chicken breast", serving: 100, unit: "g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { id: "seed-rice", name: "White rice, cooked", serving: 100, unit: "g", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { id: "seed-olive-oil", name: "Olive oil", serving: 15, unit: "ml", calories: 119, protein: 0, carbs: 0, fat: 13.5 },
    { id: "seed-broccoli", name: "Broccoli", serving: 100, unit: "g", calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 }
  ],
  days: {}
};

fs.mkdirSync(DATA_DIR, { recursive: true });

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/state") {
    handleStateApi(request, response);
    return;
  }

  serveStatic(url.pathname, response);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Calorie Tracker running on http://0.0.0.0:${PORT}`);
});

function handleStateApi(request, response) {
  if (!hasAccess(request)) {
    sendJson(response, 401, { error: "access_code_required" });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, readState());
    return;
  }

  if (request.method === "PUT") {
    readBody(request, 1024 * 1024)
      .then((body) => {
        const nextState = normalizeState(JSON.parse(body || "{}"));
        writeState(nextState);
        sendJson(response, 200, nextState);
      })
      .catch(() => sendJson(response, 400, { error: "invalid_state" }));
    return;
  }

  sendJson(response, 405, { error: "method_not_allowed" });
}

function hasAccess(request) {
  if (!ACCESS_CODE) return true;
  return request.headers["x-access-code"] === ACCESS_CODE;
}

function readState() {
  try {
    return normalizeState(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
  } catch {
    writeState(defaultState);
    return defaultState;
  }
}

function writeState(nextState) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeState(nextState), null, 2));
}

function normalizeState(nextState) {
  return {
    ingredients: Array.isArray(nextState.ingredients) && nextState.ingredients.length
      ? nextState.ingredients
      : defaultState.ingredients,
    days: nextState.days && typeof nextState.days === "object" ? nextState.days : {}
  };
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        request.destroy();
        reject(new Error("body_too_large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function serveStatic(rawPath, response) {
  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR) || filePath.includes(`${path.sep}data${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
