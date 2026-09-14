import { createClient } from "@supabase/supabase-js";

const KEEPALIVE_TABLES = [
  "portfolio_settings",
  "portfolio_experiences",
  "portfolio_comments",
] as const;

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  // Vercel automatically sends Authorization: Bearer <CRON_SECRET>
  // for scheduled cron invocations when CRON_SECRET is configured.
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return json({ ok: false }, { status: 401 });
  }

  const supabaseUrl = (
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  )?.trim();
  const supabaseKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Supabase keepalive is missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
    return json({ ok: false, reason: "supabase_not_configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "khert-portfolio-keepalive/1.0",
      },
    },
  });

  // Three tiny SELECTs per day intentionally create a small amount of real
  // database activity without writes, Realtime, polling, or visitor overhead.
  const results = await Promise.all(
    KEEPALIVE_TABLES.map(async (table) => {
      try {
        const { error } = await supabase.from(table).select("id").limit(1);
        if (error) {
          console.error(`Supabase keepalive query failed for ${table}:`, error.message);
          return false;
        }
        return true;
      } catch (error) {
        console.error(`Supabase keepalive query threw for ${table}:`, error);
        return false;
      }
    }),
  );

  const succeeded = results.filter(Boolean).length;

  // At least one successful DB request means the project was reachable.
  // We still attempt all three so normal runs create "a few" light queries.
  if (succeeded === 0) {
    return json(
      {
        ok: false,
        reason: "supabase_unreachable",
        checked_at: new Date().toISOString(),
      },
      { status: 502 },
    );
  }

  return json({
    ok: true,
    database_queries_attempted: KEEPALIVE_TABLES.length,
    database_queries_succeeded: succeeded,
    checked_at: new Date().toISOString(),
  });
}
