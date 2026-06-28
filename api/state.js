const STATE_KEY = "calorie-tracker:state";

const defaultState = {
  ingredients: [
    { id: "seed-chicken", name: "Chicken breast", serving: 100, unit: "g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { id: "seed-rice", name: "White rice, cooked", serving: 100, unit: "g", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { id: "seed-olive-oil", name: "Olive oil", serving: 15, unit: "ml", calories: 119, protein: 0, carbs: 0, fat: 13.5 },
    { id: "seed-broccoli", name: "Broccoli", serving: 100, unit: "g", calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 }
  ],
  days: {}
};

module.exports = async function handler(request, response) {
  try {
    if (!hasAccess(request)) {
      sendJson(response, 401, { error: "access_code_required" });
      return;
    }

    if (request.method === "GET") {
      const state = await readState();
      sendJson(response, 200, state);
      return;
    }

    if (request.method === "PUT") {
      const nextState = normalizeState(parseBody(request.body));
      await writeState(nextState);
      sendJson(response, 200, nextState);
      return;
    }

    sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    sendJson(response, 500, { error: "sync_failed", detail: error.message });
  }
};

function hasAccess(request) {
  const accessCode = process.env.ACCESS_CODE || "";
  if (!accessCode) return true;
  return request.headers["x-access-code"] === accessCode;
}

async function readState() {
  const stored = await redisCommand(["GET", STATE_KEY]);
  if (!stored) {
    await writeState(defaultState);
    return defaultState;
  }

  try {
    return normalizeState(JSON.parse(stored));
  } catch {
    await writeState(defaultState);
    return defaultState;
  }
}

async function writeState(nextState) {
  await redisCommand(["SET", STATE_KEY, JSON.stringify(normalizeState(nextState))]);
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Redis REST URL or token environment variables");
  }

  const redisResponse = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!redisResponse.ok) {
    throw new Error(`Redis command failed with ${redisResponse.status}`);
  }

  const payload = await redisResponse.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

function normalizeState(nextState) {
  return {
    ingredients: Array.isArray(nextState.ingredients) && nextState.ingredients.length
      ? nextState.ingredients
      : defaultState.ingredients,
    days: nextState.days && typeof nextState.days === "object" ? nextState.days : {}
  };
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}
