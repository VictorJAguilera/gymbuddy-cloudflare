export const onRequestGet: PagesFunction<{ DB: D1Database }> = async (ctx) => {
  const { results } = await ctx.env.DB
    .prepare("SELECT * FROM routines WHERE (deleted IS NULL OR deleted = 0) ORDER BY updatedAt DESC")
    .all();
  return new Response(JSON.stringify(results || []), { headers: { "Content-Type": "application/json" } });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({} as any));
  const name = (body.name || "Rutina").trim();
  const id = "rut_" + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  await ctx.env.DB.prepare("INSERT INTO routines (id, name, updatedAt, deleted) VALUES (?, ?, ?, 0)")
    .bind(id, name, now).run();
  return new Response(JSON.stringify({ id, name, updatedAt: now }), { status: 201, headers: { "Content-Type": "application/json" } });
};
