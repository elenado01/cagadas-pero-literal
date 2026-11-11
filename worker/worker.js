const MAX_FILE_SIZE = 10 * 1024 * 1024;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(payload, status, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env),
    },
  });
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || origin === env.ALLOWED_ORIGIN;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (!isAllowedOrigin(request, env)) {
      return jsonResponse({ error: "Origen no autorizado." }, 403, env);
    }

    const url = new URL(request.url);
    if (request.method !== "POST") {
      return jsonResponse({ error: "Método no permitido." }, 405, env);
    }

    if (url.pathname === "/login") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ error: "Solicitud no válida." }, 400, env);
      }
      if (payload.password !== env.ADMIN_PASSWORD) {
        return jsonResponse({ error: "Contraseña incorrecta." }, 401, env);
      }
      return jsonResponse({ ok: true }, 200, env);
    }

    if (url.pathname !== "/upload") {
      return jsonResponse({ error: "Ruta no encontrada." }, 404, env);
    }

    const form = await request.formData();
    const password = form.get("password");
    const file = form.get("file");
    if (password !== env.ADMIN_PASSWORD) {
      return jsonResponse({ error: "Contraseña incorrecta." }, 401, env);
    }
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".txt")) {
      return jsonResponse({ error: "Selecciona un archivo .txt." }, 400, env);
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return jsonResponse({ error: "El archivo debe tener entre 1 byte y 10 MB." }, 400, env);
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
      return jsonResponse({ error: "No se pudo iniciar GitHub Actions." }, 502, env);
    }

    return jsonResponse(
      { ok: true, message: "Archivo recibido. GitHub Actions actualizará los datos." },
      200,
      env,
    );
  },
};
