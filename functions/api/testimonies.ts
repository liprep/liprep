interface Env {
  DB?: D1Database;
}

interface TestimonyPayload {
  name: string;
  content: string;
  solvedCount?: number;
  firstSolvedAt?: number;
}

async function ensureTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS testimonies (id INTEGER PRIMARY KEY AUTOINCREMENT, first_solved_at INTEGER UNIQUE, name TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)"
    )
    .run();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20));
  const offset = Math.max(0, Number.isFinite(offsetParam) ? offsetParam : 0);

  if (!env.DB) {
    return new Response(
      JSON.stringify({
        testimonies: [],
        hasMore: false,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  try {
    await ensureTable(env.DB);

    const { results } = await env.DB.prepare(
      `SELECT id, name, content, created_at FROM testimonies ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    ).all();

    const items = (results || []) as Array<{
      id: number;
      name: string;
      content: string;
      created_at: number;
    }>;

    return new Response(
      JSON.stringify({
        testimonies: items,
        hasMore: items.length === limit,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        testimonies: [],
        hasMore: false,
        error: err instanceof Error ? err.message : "Failed to load testimonies",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body = (await request.json()) as TestimonyPayload;
    const name = (body.name || "").trim().slice(0, 30);
    const content = (body.content || "").trim().slice(0, 300);
    const solvedCount = Number(body.solvedCount || 0);
    const firstSolvedAt = Number(body.firstSolvedAt || 0);

    // Requirement: at least 15 questions solved
    if (solvedCount < 15) {
      return new Response(
        JSON.stringify({ error: "Requires solving at least 15 questions." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!firstSolvedAt || !Number.isFinite(firstSolvedAt) || firstSolvedAt <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid progress signature." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (name.length < 1) {
      return new Response(
        JSON.stringify({ error: "Name cannot be empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (content.length < 1) {
      return new Response(
        JSON.stringify({ error: "Testimony cannot be empty." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!env.DB) {
      return new Response(
        JSON.stringify({ error: "Database binding (env.DB) is not configured." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    await ensureTable(env.DB);

    // Check if this student practice history already submitted
    const existing = await env.DB.prepare(
      "SELECT id FROM testimonies WHERE first_solved_at = ? LIMIT 1"
    )
      .bind(firstSolvedAt)
      .first();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Thank you, but it seems like you've already submitted one." }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const createdAt = Date.now();

    const insertResult = await env.DB.prepare(
      "INSERT INTO testimonies (first_solved_at, name, content, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(firstSolvedAt, name, content, createdAt)
      .run();

    const testimonyId = insertResult.meta?.last_row_id || createdAt;

    const createdTestimony = {
      id: testimonyId,
      name,
      content,
      created_at: createdAt,
    };

    return new Response(
      JSON.stringify({
        success: true,
        id: testimonyId,
        name,
        content,
        created_at: createdAt,
        testimony: createdTestimony,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    if (message.includes("UNIQUE constraint failed")) {
      return new Response(
        JSON.stringify({ error: "A testimony has already been submitted from this practice history." }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
