import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export interface PortfolioStatus {
  id: number;
  status_text: string;
  is_enabled: boolean;
  updated_at: string;
}

export const EMPTY_PORTFOLIO_STATUS: PortfolioStatus = {
  id: 1,
  status_text: "",
  is_enabled: false,
  updated_at: "",
};

export async function fetchPortfolioStatus(): Promise<PortfolioStatus> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured || !supabase) return EMPTY_PORTFOLIO_STATUS;

  const { data, error } = await supabase
    .from("portfolio_status")
    .select("id, status_text, is_enabled, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Unable to load portfolio status:", error.message);
    return EMPTY_PORTFOLIO_STATUS;
  }

  return data ? (data as PortfolioStatus) : EMPTY_PORTFOLIO_STATUS;
}
