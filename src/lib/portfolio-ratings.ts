import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export interface PortfolioRatingSummary {
  average: number;
  count: number;
  breakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

const EMPTY_SUMMARY: PortfolioRatingSummary = {
  average: 0,
  count: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchPortfolioRatingSummary(): Promise<PortfolioRatingSummary> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured || !supabase) return EMPTY_SUMMARY;

  const statsResult = await supabase.rpc("get_portfolio_rating_stats");
  if (!statsResult.error) {
    const row = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;
    return {
      average: numberValue(row?.average_rating),
      count: numberValue(row?.rating_count),
      breakdown: {
        1: numberValue(row?.one_star_count),
        2: numberValue(row?.two_star_count),
        3: numberValue(row?.three_star_count),
        4: numberValue(row?.four_star_count),
        5: numberValue(row?.five_star_count),
      },
    };
  }

  // Compatibility fallback while the new migration is being applied.
  const legacyResult = await supabase.rpc("get_portfolio_rating_summary");
  if (legacyResult.error) {
    console.error("Unable to load portfolio rating summary:", legacyResult.error.message);
    return EMPTY_SUMMARY;
  }

  const row = Array.isArray(legacyResult.data) ? legacyResult.data[0] : legacyResult.data;
  return {
    average: numberValue(row?.average_rating),
    count: numberValue(row?.rating_count),
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

export async function fetchMyPortfolioRating(userId: string): Promise<number | null> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  const { data, error } = await supabase
    .from("portfolio_ratings")
    .select("rating")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load visitor rating:", error.message);
    return null;
  }

  const value = Number(data?.rating ?? 0);
  return value >= 1 && value <= 5 ? value : null;
}

export async function savePortfolioRating(stars: number) {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured || !supabase) return { error: "Ratings are unavailable." };

  const safeStars = Math.round(stars);
  if (safeStars < 1 || safeStars > 5) return { error: "Choose a rating from 1 to 5 stars." };

  const { error } = await supabase.rpc("rate_portfolio", { stars: safeStars });
  return { error: error?.message ?? null };
}
