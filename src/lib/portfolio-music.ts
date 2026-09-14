import { getSupabaseClient } from "@/lib/supabase";

export interface PortfolioMusicTrack {
  id: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  is_enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  if (VIDEO_ID_PATTERN.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return VIDEO_ID_PATTERN.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = url.searchParams.get("v") ?? "";
      if (VIDEO_ID_PATTERN.test(watchId)) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
        const id = parts[1] ?? "";
        return VIDEO_ID_PATTERN.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function canonicalYouTubeUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function fetchPortfolioMusicTracks(options?: { includeDisabled?: boolean }) {
  const supabase = getSupabaseClient();
  if (!supabase) return [] as PortfolioMusicTrack[];

  let query = supabase
    .from("portfolio_music")
    .select("id, title, youtube_url, youtube_video_id, is_enabled, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(20);

  if (!options?.includeDisabled) {
    query = query.eq("is_enabled", true);
  }

  const { data, error } = await query;
  if (error || !data) return [] as PortfolioMusicTrack[];

  return data as PortfolioMusicTrack[];
}
