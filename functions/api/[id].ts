// functions/api/routines/[id].ts

// DELETE /api/routines/:id  → elimina la fila (hard delete)
export const onRequestDelete: PagesFunction<{ DB: gymbuddy-db1 }> = async (ctx) => {
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

// POST /api/routines/:id/delete  → misma acción por POST
export const onRequestPost: PagesFunction<{ DB: gymbuddy-db1 }> = async (ctx) => {
  const url = new URL(ctx.request.url);

  // Acepta /delete y /delete/
  const endsWithDelete = /\/delete\/?$/.test(url.pathname);
  if (!endsWithDelete) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

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

// OPTIONS (CORS preflight)
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
