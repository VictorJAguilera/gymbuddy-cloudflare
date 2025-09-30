// functions/api/routines/[id].ts

export const onRequestDelete: PagesFunction<{ DB: D1Database }> = async (ctx) => {
  const id = ctx.params.id as string;

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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
