function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function noContent(extraHeaders = {}) {
  return new Response(null, { status: 204, headers: extraHeaders });
}

function corsHeaders(env) {
  const origin = env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-HTTP-Method-Override",
  };
}

async function handleOptions(request, env) {
  // Responder a preflight y OPTIONS genérico
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}

async function deleteRoutineHard(env, id) {
  // Borrado duro (físico)
  // return await env.DB.prepare("DELETE FROM routines WHERE id = ?").bind(id).run();

  // Soft delete recomendado:
  const now = new Date().toISOString();
  return await env.DB
    .prepare("UPDATE routines SET deleted = 1, deleted_at = ? WHERE id = ?")
    .bind(now, id)
    .run();
}

async function getRoutine(env, id) {
  const stmt = env.DB
    .prepare("SELECT * FROM routines WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
    .bind(id);
  const { results } = await stmt.all();
  return results?.[0] || null;
}

async function listRoutines(env) {
  const stmt = env.DB
    .prepare("SELECT * FROM routines WHERE (deleted IS NULL OR deleted = 0) ORDER BY updatedAt DESC");
  const { results } = await stmt.all();
  return results || [];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    // --- RUTAS API ---

    // GET /api/routines
    if (request.method === "GET" && pathname === "/api/routines") {
      const rows = await listRoutines(env);
      return json(rows, 200, corsHeaders(env));
    }

    // POST /api/routines  (crear rutina: ya lo tienes en el frontend)
    if (request.method === "POST" && pathname === "/api/routines") {
      const body = await request.json().catch(() => ({}));
      const name = (body.name || "Rutina").trim();

      const id = "rut_" + Math.random().toString(36).slice(2, 10);
      const now = new Date().toISOString();

      await env.DB
        .prepare("INSERT INTO routines (id, name, updatedAt, deleted) VALUES (?, ?, ?, 0)")
        .bind(id, name, now)
        .run();

      return json({ id, name, updatedAt: now }, 201, corsHeaders(env));
    }

    // GET /api/routines/:id
    if (request.method === "GET" && pathname.startsWith("/api/routines/")) {
      const id = pathname.split("/").pop();
      const row = await getRoutine(env, id);
      if (!row) return json({ error: "Not found" }, 404, corsHeaders(env));
      return json(row, 200, corsHeaders(env));
    }

    // PUT /api/routines/:id  (actualizar rutina)
    if (request.method === "PUT" && pathname.startsWith("/api/routines/")) {
      const id = pathname.split("/").pop();
      const body = await request.json().catch(() => ({}));
      const now = new Date().toISOString();

      // Aquí deberías aplicar tu lógica de actualización:
      // - sets / ejercicios (payload tal como envía tu frontend)
      await env.DB
        .prepare("UPDATE routines SET updatedAt = ? WHERE id = ?")
        .bind(now, id)
        .run();

      return noContent(corsHeaders(env));
    }

    // DELETE /api/routines/:id  (REST canónico)
    if (request.method === "DELETE" && pathname.startsWith("/api/routines/")) {
      const id = pathname.split("/").pop();
      const res = await deleteRoutineHard(env, id);
      if (res.meta.changes === 0) return json({ error: "Not found" }, 404, corsHeaders(env));
      return noContent(corsHeaders(env));
    }

    // POST /api/routines/:id/delete  (acción por POST sin preflight)
    if (request.method === "POST" && pathname.endsWith("/delete") && pathname.startsWith("/api/routines/")) {
      const id = pathname.split("/").slice(-2, -1)[0]; // penúltimo segmento
      const res = await deleteRoutineHard(env, id);
      if (res.meta.changes === 0) return json({ error: "Not found" }, 404, corsHeaders(env));
      return noContent(corsHeaders(env));
    }

    // Fallback 404
    return json({ error: "Not found" }, 404, corsHeaders(env));
  },
};
