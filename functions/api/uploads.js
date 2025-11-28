// functions/api/uploads.js

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

export const onRequestPost = async (ctx) => {
  try {
    const req = ctx.request;
    const env = ctx.env;

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "expected multipart/form-data" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return new Response(JSON.stringify({ error: "file not provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const mime = file.type || "application/octet-stream";
    if (!/^image\//i.test(mime)) {
      return new Response(JSON.stringify({ error: "only images allowed" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // Prioridad: Cloudflare Images si hay variables -> sino, R2 si hay binding
    if (env.IMG_ACCOUNT_ID && env.IMG_API_TOKEN && env.IMG_DELIVERY_HASH) {
      // 1) solicitar URL de subida directa
      const du = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.IMG_ACCOUNT_ID}/images/v2/direct_upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.IMG_API_TOKEN}`,
        },
      });
      if (!du.ok) {
        const txt = await du.text();
        return new Response(JSON.stringify({ error: "images direct_upload failed", details: txt }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }
      const duJson = await du.json();
      const uploadURL = duJson?.result?.uploadURL;
      const imgId = duJson?.result?.id;

      if (!uploadURL || !imgId) {
        return new Response(JSON.stringify({ error: "invalid direct_upload response" }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      // 2) subir el archivo a la uploadURL
      const fd = new FormData();
      fd.append("file", file, file.name || "image");

      const upRes = await fetch(uploadURL, { method: "POST", body: fd });
      if (!upRes.ok) {
        const t = await upRes.text();
        return new Response(JSON.stringify({ error: "upload to images failed", details: t }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      // 3) construir URL pública de entrega
      const url = `https://imagedelivery.net/${env.IMG_DELIVERY_HASH}/${imgId}/public`;
      return new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    if (env.BUCKET && env.R2_PUBLIC_BASE) {
      // Subida a R2
      const ext = (file.name || "").split(".").pop()?.toLowerCase() || "bin";
      const key = `exercises/${Date.now()}_${Math.random().toString(36).slice(2,10)}.${ext}`;
      // @ts-ignore (Pages Functions: env.BUCKET es R2 bucket binding)
      await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: mime } });

      const url = `${env.R2_PUBLIC_BASE.replace(/\/+$/,'')}/${key}`;
      return new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ error: "no storage configured (set Cloudflare Images vars or R2 binding)" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message || err || "unknown") }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
};
