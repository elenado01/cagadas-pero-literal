const MAX_FILE_SIZE = 10 * 1024 * 1024;

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const configuredOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const defaultOrigins = [
    "https://elenado01.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
  ];
  const allowedOrigins = [...new Set([...configuredOrigins, ...defaultOrigins])];
  return origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
}

function corsHeaders(request, env) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(request, env),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(payload, status, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      ...corsHeaders(request, env),
    },
  });
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || Boolean(allowedOrigin(request, env));
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders(request, env) });
      }

      if (!isAllowedOrigin(request, env)) {
        return jsonResponse({ error: "Origen no autorizado." }, 403, request, env);
      }

      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/") {
        return jsonResponse({ ok: true, message: "Worker de subida activo." }, 200, request, env);
      }
      if (request.method === "GET" && url.pathname === "/status") {
        const since = Date.parse(url.searchParams.get("since") || "");
        if (!Number.isFinite(since)) return jsonResponse({ error: "Falta la fecha de inicio." }, 400, request, env);
        const runsResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPOSITORY}/actions/runs?event=repository_dispatch&per_page=20`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "cagadas-upload-worker",
            },
          },
        );
        if (!runsResponse.ok) return jsonResponse({ error: "No se pudo consultar GitHub Actions." }, 502, request, env);
        const runs = await runsResponse.json();
        const run = (runs.workflow_runs || []).find((item) => Date.parse(item.created_at) >= since - 60000);
        if (!run) return jsonResponse({ status: "pending" }, 200, request, env);
        if (run.status !== "completed") return jsonResponse({ status: "running" }, 200, request, env);
        if (run.conclusion !== "success") return jsonResponse({ status: "failed" }, 200, request, env);
        return jsonResponse({ status: "completed" }, 200, request, env);
      }
      if (request.method !== "POST") {
        return jsonResponse({ error: "Método no permitido." }, 405, request, env);
      }

      if (url.pathname === "/login") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "Solicitud no válida." }, 400, request, env);
        }
        if (payload.password !== env.ADMIN_PASSWORD) {
          return jsonResponse({ error: "Contraseña incorrecta." }, 401, request, env);
        }
        return jsonResponse({ ok: true }, 200, request, env);
      }

      if (url.pathname !== "/upload") {
        return jsonResponse({ error: "Ruta no encontrada." }, 404, request, env);
      }

      const form = await request.formData();
      const password = form.get("password");
      const file = form.get("file");
      if (password !== env.ADMIN_PASSWORD) {
        return jsonResponse({ error: "Contraseña incorrecta." }, 401, request, env);
      }
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".txt")) {
        return jsonResponse({ error: "Selecciona un archivo .txt." }, 400, request, env);
      }
      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        return jsonResponse({ error: "El archivo debe tener entre 1 byte y 10 MB." }, 400, request, env);
      }

      const objectKey = `uploads/${crypto.randomUUID()}.txt`;
      await env.UPLOADS.put(objectKey, file.stream(), {
        httpMetadata: { contentType: "text/plain; charset=utf-8" },
      });

      const githubResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPOSITORY}/dispatches`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "cagadas-upload-worker",
          },
          body: JSON.stringify({
            event_type: "update-chat",
            client_payload: { object_key: objectKey },
          }),
        },
      );

      if (!githubResponse.ok) {
        await env.UPLOADS.delete(objectKey);
        return jsonResponse({ error: "No se pudo iniciar GitHub Actions." }, 502, request, env);
      }

      return jsonResponse(
        { ok: true, started_at: new Date().toISOString(), message: "Archivo recibido. GitHub Actions actualizará los datos." },
        200,
        request,
        env,
      );
    } catch (error) {
      console.error("Worker error", error);
      return jsonResponse(
        { error: `Error interno del Worker: ${error.message || "desconocido"}` },
        500,
        request,
        env,
      );
    }
  },
};
