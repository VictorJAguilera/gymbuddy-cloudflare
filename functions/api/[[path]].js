// functions/api/[[path]].js
// Cloudflare Pages Functions + D1 (SQLite) — API para GymBuddy 2025

export async function onRequest(context) {
  const { request, env } = context;

  // Asegúrate de añadir el binding D1 en Pages:
  // Settings → Bindings → D1 databases → Add binding → name: DB → database: gymbuddy-db1
  if (!env.DB) {
    return json({ error: "Falta binding D1 'DB' en Settings → Bindings (binding DB → gymbuddy-db1)" }, 500);
  }

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  // Este file vive en /functions/api/[[path]].js, así que montamos las rutas bajo /api/*
  const path = url.pathname.replace(/^\/api\/?/, "");

  try {
    // Autoseed si hay tabla exercises y está vacía (NO crea tablas aquí)
    await seedIfEmpty(env);

    // Healthcheck simple
    if (path === "" && method === "GET") return json({ ok: true });

    // ------- Ejercicios -------
    if (path === "exercises/groups" && method === "GET") {
      const res = await env.DB.prepare(
        "SELECT DISTINCT bodyPart AS g FROM exercises WHERE bodyPart IS NOT NULL AND bodyPart<>'' ORDER BY g"
      ).all();
      return json((res.results || []).map((r) => r.g));
    }

    if (path.startsWith("exercises") && method === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const group = url.searchParams.get("group") || "*";
      let sql = "SELECT * FROM exercises WHERE 1=1";
      const binds = [];
      if (group && group !== "*") {
        sql += " AND bodyPart LIKE ?";
        binds.push(`%${group}%`);
      }
      if (q) {
        sql += " AND LOWER(name) LIKE ?";
        binds.push(`%${q}%`);
      }
      sql += " ORDER BY name ASC LIMIT 300";
      const res = await env.DB.prepare(sql).bind(...binds).all();
      return json(res.results || []);
    }

    if (path === "exercises" && method === "POST") {
      const p = await safeJSON(request);
      if (!p.name) return json({ error: "name required" }, 400);

      const id = "cus_" + cryptoRandom();
      await env.DB.prepare(
        `INSERT INTO exercises(id,name,image,bodyPart,primaryMuscles,secondaryMuscles,equipment,isCustom)
         VALUES(?,?,?,?,?,?,?,1)`
      )
        .bind(
          id,
          (p.name || "").trim(),
          p.image || "",
          p.bodyPart || "",
          p.primaryMuscles || "",
          p.secondaryMuscles || "",
          p.equipment || ""
        )
        .run();

      const row = await env.DB.prepare("SELECT * FROM exercises WHERE id=?").bind(id).first();
      return json(row);
    }

    // ------- Rutinas (listado/creación) -------
    if (path === "routines" && method === "GET") {
      const routines = (await env.DB.prepare("SELECT * FROM routines ORDER BY updatedAt DESC").all()).results || [];
      const counts = (await env.DB.prepare("SELECT routine_id, COUNT(*) AS c FROM routine_exercises GROUP BY routine_id").all())
        .results || [];
      const map = Object.fromEntries(counts.map((r) => [r.routine_id, r.c]));
      // Front pide exercises.length: entregamos estructura ligera con ese conteo
      const withFake = routines.map((r) => ({
        ...r,
        exercises: Array.from({ length: map[r.id] || 0 }, () => ({ sets: [] })),
      }));
      return json(withFake);
    }

    if (path === "routines" && method === "POST") {
      const p = await safeJSON(request);
      const id = "rut_" + cryptoRandom();
      const ts = Date.now();
      await env.DB.prepare("INSERT INTO routines(id,name,createdAt,updatedAt) VALUES(?,?,?,?)")
        .bind(id, p.name || "Rutina", ts, ts)
        .run();
      const full = await loadRoutineFull(env, id);
      return json(full);
    }

    // ------- Rutina (detalle / update nombre + sets) -------
    {
      const m = path.match(/^routines\/([^/]+)$/);
      if (m) {
        const rid = m[1];
        if (method === "GET") {
          const full = await loadRoutineFull(env, rid);
          if (!full) return json({ error: "not found" }, 404);
          return json(full);
        }
        if (method === "PUT") {
          const body = await safeJSON(request);

          if (body.name) {
            await env.DB.prepare("UPDATE routines SET name=?, updatedAt=? WHERE id=?")
              .bind(body.name, Date.now(), rid)
              .run();
          }
          // Actualización de reps/peso de sets ya existentes
          if (Array.isArray(body.exercises)) {
            for (const ex of body.exercises) {
              if (Array.isArray(ex.sets)) {
                for (const s of ex.sets) {
                  if (s.id) {
                    await env.DB.prepare("UPDATE routine_sets SET reps=?, peso=? WHERE id=?")
                      .bind(s.reps ?? null, s.peso ?? null, s.id)
                      .run();
                  }
                }
              }
            }
            await env.DB.prepare("UPDATE routines SET updatedAt=? WHERE id=?").bind(Date.now(), rid).run();
          }

          return json(await loadRoutineFull(env, rid));
        }
      }
    }

    // ------- Añadir / borrar ejercicios de una rutina -------
    {
      const mAddEx = path.match(/^routines\/([^/]+)\/exercises$/);
      if (mAddEx && method === "POST") {
        const rid = mAddEx[1];
        const p = await safeJSON(request);
        if (!p.exerciseId) return json({ error: "exerciseId required" }, 400);

        const rexId = "rex_" + cryptoRandom();
        const row = await env.DB.prepare("SELECT COALESCE(MAX(order_index),0)+1 AS o FROM routine_exercises WHERE routine_id=?")
          .bind(rid)
          .first();
        const order = row ? row.o : 0;

        await env.DB.batch([
          env.DB
            .prepare("INSERT INTO routine_exercises(id,routine_id,exercise_id,order_index) VALUES(?,?,?,?)")
            .bind(rexId, rid, p.exerciseId, order),
          env.DB.prepare("UPDATE routines SET updatedAt=? WHERE id=?").bind(Date.now(), rid),
        ]);

        return json(await loadRoutineFull(env, rid));
      }
    }

    {
      const mDelEx = path.match(/^routines\/([^/]+)\/exercises\/([^/]+)$/);
      if (mDelEx && method === "DELETE") {
        const [_, rid, rexId] = mDelEx;

        await env.DB.batch([
          env.DB.prepare("DELETE FROM routine_sets WHERE routine_exercise_id=?").bind(rexId),
          env.DB.prepare("DELETE FROM routine_exercises WHERE id=? AND routine_id=?").bind(rexId, rid),
          env.DB.prepare("UPDATE routines SET updatedAt=? WHERE id=?").bind(Date.now(), rid),
        ]);

        return json({ ok: true });
      }
    }

    // ------- Añadir / borrar sets -------
    {
      const mAddSet = path.match(/^routines\/([^/]+)\/exercises\/([^/]+)\/sets$/);
      if (mAddSet && method === "POST") {
        const [_, rid, rexId] = mAddSet;
        const p = await safeJSON(request);

        const setId = "set_" + cryptoRandom();
        await env.DB.batch([
          env.DB
            .prepare("INSERT INTO routine_sets(id,routine_exercise_id,reps,peso) VALUES(?,?,?,?)")
            .bind(setId, rexId, p.reps ?? null, p.peso ?? null),
          env.DB.prepare("UPDATE routines SET updatedAt=? WHERE id=?").bind(Date.now(), rid),
        ]);

        return json({ id: setId });
      }
    }

    {
      const mDelSet = path.match(/^routines\/([^/]+)\/exercises\/([^/]+)\/sets\/([^/]+)$/);
      if (mDelSet && method === "DELETE") {
        const [_, rid, rexId, setId] = mDelSet;

        await env.DB.batch([
          env.DB.prepare("DELETE FROM routine_sets WHERE id=? AND routine_exercise_id=?").bind(setId, rexId),
          env.DB.prepare("UPDATE routines SET updatedAt=? WHERE id=?").bind(Date.now(), rid),
        ]);

        return json({ ok: true });
      }
    }

    // ------- Guardar entrenamientos (workouts) -------
    if (path === "workouts" && method === "POST") {
      const s = await safeJSON(request);
      const wid = "wo_" + cryptoRandom();

      const stmts = [
        env.DB
          .prepare("INSERT INTO workouts(id,routine_id,startedAt,finishedAt,durationSec) VALUES(?,?,?,?,?)")
          .bind(wid, s.routineId, s.startedAt, s.finishedAt, s.durationSec),
      ];

      (s.items || []).forEach((it, idx) => {
        const wi = "wi_" + cryptoRandom();
        stmts.push(
          env.DB
            .prepare(
              "INSERT INTO workout_items(id,workout_id,exercise_id,name,bodyPart,image,order_index) VALUES(?,?,?,?,?,?,?)"
            )
            .bind(wi, wid, it.exerciseId, it.name, it.bodyPart, it.image, idx)
        );
        (it.sets || []).forEach((st) => {
          const ws = "ws_" + cryptoRandom();
          stmts.push(
            env.DB
              .prepare("INSERT INTO workout_sets(id,workout_item_id,reps,peso,done) VALUES(?,?,?,?,?)")
              .bind(ws, wi, st.reps, st.peso, st.done ? 1 : 0)
          );
        });
      });

      await env.DB.batch(stmts);
      return json({ id: wid });
    }

    // ------- MIS MARCAS (PR por ejercicio) -------
    if (path === "marks" && method === "GET") {
      // Elige el mejor set por ejercicio priorizando peso DESC y, si empata, reps DESC.
      const sql = `
        WITH ranked AS (
          SELECT wi.exercise_id, wi.name, wi.bodyPart, wi.image, ws.peso, ws.reps,
                 ROW_NUMBER() OVER (
                   PARTITION BY wi.exercise_id
                   ORDER BY (ws.peso IS NULL) ASC, ws.peso DESC, (ws.reps IS NULL) ASC, ws.reps DESC
                 ) AS rn
          FROM workout_sets ws
          JOIN workout_items wi ON wi.id = ws.workout_item_id
        )
        SELECT exercise_id, name, bodyPart, image, peso AS pr_weight, COALESCE(reps,0) AS reps_at_pr
        FROM ranked WHERE rn=1
        ORDER BY name ASC
      `;
      const res = await env.DB.prepare(sql).all();
      return json(res.results || []);
    }

    // Ruta no encontrada
    return json({ error: "not found" }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

/* ---------------- Helpers ---------------- */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function safeJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function cryptoRandom() {
  // id compacto base36
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Siembra ejercicios solo si:
 *  - la tabla exercises EXISTE y
 *  - está vacía.
 * No crea tablas aquí (las crea 001_init.sql).
 */
async function seedIfEmpty(env) {
  let count = 0;
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM exercises").first();
    count = row?.c ?? 0;
  } catch {
    // La tabla no existe aún (no se han aplicado migraciones): no hacemos nada.
    return;
  }

  if (count === 0) {
    const seed = [
      ["seed_bench_press","Bench Press","https://www.lyfta.app/thumbnails/00251201.jpg","Chest","Pectoralis Major Sternal Head","Deltoid Anterior, Pectoralis Major Clavicular Head, Triceps Brachii","Barbell",0],
      ["seed_triceps_pushdown","Triceps Pushdown","https://www.lyfta.app/thumbnails/02411201.jpg","Triceps, Upper Arms","Triceps Brachii","","Cable",0],
      ["seed_incline_bench_press","Incline Bench Press","https://www.lyfta.app/thumbnails/03141201.jpg","Chest","Pectoralis Major Clavicular Head","Deltoid Anterior, Triceps Brachii","Dumbbell",0],
      ["seed_lateral_raise","Lateral Raise","https://www.lyfta.app/thumbnails/03341201.jpg","Shoulders","Deltoid Lateral","Deltoid Anterior, Serratus Anterior","Dumbbell",0],
      ["seed_full_squat","Full Squat","https://www.lyfta.app/thumbnails/00431201.jpg","Quadriceps, Thighs","Gluteus Maximus, Quadriceps","Adductor Magnus, Soleus","Barbell",0],
      ["seed_push_up","Push-up","https://www.lyfta.app/thumbnails/00071201.jpg","Chest","Pectoralis Major","Triceps Brachii, Deltoid Anterior, Serratus Anterior, Core","Body weight",0],
      ["seed_bent_over_row","Bent Over Row","https://www.lyfta.app/thumbnails/00271201.jpg","Back","Infraspinatus, Latissimus Dorsi, Teres Major, Teres Minor, Trapezius Middle & Upper Fibers","Brachialis, Brachioradialis, Deltoid Posterior","Barbell",0],
      ["seed_lat_pulldown","Bar Lateral Pulldown","https://www.lyfta.app/thumbnails/02181201.jpg","Back","Latissimus Dorsi","Biceps Brachii, Teres Major, Rhomboids","Cable",0]
    ];
    const stmt = env.DB.prepare(
      "INSERT INTO exercises(id,name,image,bodyPart,primaryMuscles,secondaryMuscles,equipment,isCustom) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)"
    );
    await env.DB.batch(seed.map(v => stmt.bind(...v)));
  }
}

async function loadRoutineFull(env, id) {
  const r = await env.DB.prepare("SELECT * FROM routines WHERE id=?").bind(id).first();
  if (!r) return null;

  const exs =
    (
      await env.DB
        .prepare(
          `
      SELECT re.id as rex_id, re.order_index, e.*
      FROM routine_exercises re
      JOIN exercises e ON e.id = re.exercise_id
      WHERE re.routine_id = ?
      ORDER BY re.order_index ASC, re.id ASC
    `
        )
        .bind(id)
        .all()
    ).results || [];

  const exercises = [];
  for (const row of exs) {
    const sets =
      (
        await env.DB
          .prepare("SELECT * FROM routine_sets WHERE routine_exercise_id = ? ORDER BY rowid ASC")
          .bind(row.rex_id)
          .all()
      ).results || [];
    exercises.push({
      id: row.rex_id,
      order_index: row.order_index,
      exercise: {
        id: row.id,
        name: row.name,
        image: row.image,
        bodyPart: row.bodyPart,
        primaryMuscles: row.primaryMuscles,
        secondaryMuscles: row.secondaryMuscles,
        equipment: row.equipment,
      },
      sets: sets.map((s) => ({ id: s.id, reps: s.reps, peso: s.peso })),
    });
  }

  return { id: r.id, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt, exercises };
}
