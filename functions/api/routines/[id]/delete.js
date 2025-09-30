// POST /api/routines/:id/delete  → misma acción por POST

export const onRequestPost = async (ctx) => {
  const id = ctx.params.id;

  const res = await ctx.env.DB
    .prepare("DELETE FROM routines WHERE id = ?")
    .bind(id)
    .run();

  return new Response(null, {
    status: res.meta.changes ? 204 : 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
};

// OPTIONS (CORS preflight)
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
