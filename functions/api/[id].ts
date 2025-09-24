export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async (ctx) => {
  const id = ctx.params.id as string;
  const now = new Date().toISOString();
  // Soft delete:
  const res = await ctx.env.DB
    .prepare("UPDATE routines SET deleted = 1, deleted_at = ? WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
    .bind(now, id)
    .run();
  if (res.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  return new Response(null, { status: 204 });
};

export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (ctx) => {
  // Maneja POST /api/routines/:id/delete
  if (!ctx.request.url.endsWith("/delete")) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  const id = ctx.params.id as string;
  const now = new Date().toISOString();
  const res = await ctx.env.DB
    .prepare("UPDATE routines SET deleted = 1, deleted_at = ? WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
    .bind(now, id)
    .run();
  if (res.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }
  return new Response(null, { status: 204 });
};
