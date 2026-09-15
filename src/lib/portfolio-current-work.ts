import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export interface PortfolioCurrentWorkItem {
  id: string;
  body: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export async function fetchPortfolioCurrentWork(options: { includeHidden?: boolean; limit?: number } = {}) {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured || !supabase) return [] as PortfolioCurrentWorkItem[];

  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  const now = new Date().toISOString();
  let query = supabase
    .from("portfolio_current_work")
    .select("id, body, is_visible, created_at, updated_at, expires_at")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!options.includeHidden) query = query.eq("is_visible", true);

  const result = await query;
  if (!result.error) return (result.data ?? []) as PortfolioCurrentWorkItem[];

  // Short migration-compatibility fallback: keeps the existing feature usable
  // if frontend files are tested immediately before the retention migration runs.
  let legacyQuery = supabase
    .from("portfolio_current_work")
    .select("id, body, is_visible, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!options.includeHidden) legacyQuery = legacyQuery.eq("is_visible", true);

  const legacyResult = await legacyQuery;
  if (legacyResult.error) {
    console.error("Unable to load current work updates:", legacyResult.error.message);
    return [] as PortfolioCurrentWorkItem[];
  }

  return (legacyResult.data ?? []) as PortfolioCurrentWorkItem[];
}
