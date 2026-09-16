import { getSupabaseClient } from "@/lib/supabase";

export interface PortfolioAdminStats {
  generated_at: string;
  settings_present: boolean;
  settings_updated_at: string | null;
  profile_image_custom: boolean;
  status_present: boolean;
  status_enabled: boolean;
  status_updated_at: string | null;
  experiences_total: number;
  skills_total: number;
  skills_enabled: number;
  music_total: number;
  music_enabled: number;
  current_work_total: number;
  current_work_active: number;
  comments_active: number;
  ratings_total: number;
  rating_average: number;
  ratings_five_star: number;
}

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function normalizeStats(value: unknown): PortfolioAdminStats {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    generated_at: typeof row.generated_at === "string" ? row.generated_at : new Date().toISOString(),
    settings_present: Boolean(row.settings_present),
    settings_updated_at: asNullableString(row.settings_updated_at),
    profile_image_custom: Boolean(row.profile_image_custom),
    status_present: Boolean(row.status_present),
    status_enabled: Boolean(row.status_enabled),
    status_updated_at: asNullableString(row.status_updated_at),
    experiences_total: asNumber(row.experiences_total),
    skills_total: asNumber(row.skills_total),
    skills_enabled: asNumber(row.skills_enabled),
    music_total: asNumber(row.music_total),
    music_enabled: asNumber(row.music_enabled),
    current_work_total: asNumber(row.current_work_total),
    current_work_active: asNumber(row.current_work_active),
    comments_active: asNumber(row.comments_active),
    ratings_total: asNumber(row.ratings_total),
    rating_average: asNumber(row.rating_average),
    ratings_five_star: asNumber(row.ratings_five_star),
  };
}

export async function fetchPortfolioAdminStats() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const startedAt = performance.now();
  const { data, error } = await supabase.rpc("get_portfolio_admin_stats");
  const responseMs = Math.max(0, Math.round(performance.now() - startedAt));

  if (error) throw error;

  return {
    stats: normalizeStats(data),
    responseMs,
  };
}
