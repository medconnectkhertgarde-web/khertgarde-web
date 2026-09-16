import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Database, RefreshCw, Star } from "lucide-react";

import {
  fetchPortfolioAdminStats,
  type PortfolioAdminStats,
} from "@/lib/portfolio-admin-stats";

interface AdminStatsProps {
  active: boolean;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AdminStats({ active }: AdminStatsProps) {
  const [stats, setStats] = useState<PortfolioAdminStats | null>(null);
  const [responseMs, setResponseMs] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);

    try {
      const result = await fetchPortfolioAdminStats();
      setStats(result.stats);
      setResponseMs(result.responseMs);
      setCheckedAt(new Date().toISOString());
      setError(null);
    } catch (refreshError) {
      console.error("Portfolio admin stats failed to load", refreshError);
      setError("Supabase stats could not be reached. Existing portfolio data was not changed.");
      setCheckedAt(new Date().toISOString());
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(intervalId);
  }, [active, refresh]);

  return (
    <div className="admin-stats-shell">
      <div className="admin-stats-health">
        <div>
          <span className={`admin-live-dot${error ? " is-error" : stats ? "" : " is-pending"}`} aria-hidden="true" />
          <div>
            <span>SUPABASE HEALTH</span>
            <strong>{error ? "Unavailable" : stats ? "Connected" : "Checking"}</strong>
          </div>
        </div>
        <button className="button button-outline" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={loading ? "spin" : undefined} aria-hidden="true" />
          Refresh live stats
        </button>
      </div>

      {error ? <p className="admin-stats-error" role="alert">{error}</p> : null}

      <div className="admin-stats-grid" aria-busy={loading && !stats}>
        <article className="admin-stat-card admin-stat-card-wide">
          <Database aria-hidden="true" />
          <span>Supabase response</span>
          <strong>{responseMs === null ? "—" : `${formatNumber(responseMs)} ms`}</strong>
          <small>Measured from this browser to the live admin-stats RPC.</small>
        </article>

        <article className="admin-stat-card">
          <Star aria-hidden="true" />
          <span>Portfolio rating</span>
          <strong>{stats && stats.ratings_total ? stats.rating_average.toFixed(2) : "—"}</strong>
          <small>{stats ? `${formatNumber(stats.ratings_total)} authenticated ratings` : "Loading"}</small>
        </article>

        <article className="admin-stat-card">
          <Activity aria-hidden="true" />
          <span>Active comments</span>
          <strong>{stats ? formatNumber(stats.comments_active) : "—"}</strong>
          <small>Only comments that have not reached retention expiry.</small>
        </article>

        <article className="admin-stat-card">
          <Activity aria-hidden="true" />
          <span>Skills</span>
          <strong>{stats ? `${formatNumber(stats.skills_enabled)} / ${formatNumber(stats.skills_total)}` : "—"}</strong>
          <small>Enabled / total skill records.</small>
        </article>

        <article className="admin-stat-card">
          <Activity aria-hidden="true" />
          <span>Experience entries</span>
          <strong>{stats ? formatNumber(stats.experiences_total) : "—"}</strong>
          <small>Live work-experience records in Supabase.</small>
        </article>

        <article className="admin-stat-card">
          <Activity aria-hidden="true" />
          <span>Current work</span>
          <strong>{stats ? `${formatNumber(stats.current_work_active)} / ${formatNumber(stats.current_work_total)}` : "—"}</strong>
          <small>Visible + unexpired / total stored messages.</small>
        </article>

        <article className="admin-stat-card">
          <Activity aria-hidden="true" />
          <span>Profile music</span>
          <strong>{stats ? `${formatNumber(stats.music_enabled)} / ${formatNumber(stats.music_total)}` : "—"}</strong>
          <small>Enabled / total YouTube tracks.</small>
        </article>
      </div>

      <div className="admin-stats-integrity">
        <div>
          <span>Portfolio settings record</span>
          <strong>{stats ? (stats.settings_present ? "Available" : "Missing") : "Checking"}</strong>
        </div>
        <div>
          <span>Status badge record</span>
          <strong>{stats ? (stats.status_present ? (stats.status_enabled ? "Enabled" : "Disabled") : "Missing") : "Checking"}</strong>
        </div>
        <div>
          <span>Custom profile image</span>
          <strong>{stats ? (stats.profile_image_custom ? "Configured" : "Bundled image") : "Checking"}</strong>
        </div>
        <div>
          <span>Five-star ratings</span>
          <strong>{stats ? formatNumber(stats.ratings_five_star) : "—"}</strong>
        </div>
      </div>

      <div className="admin-stats-footnote">
        <span>Last checked: {formatDateTime(checkedAt)}</span>
        <span>Server snapshot: {formatDateTime(stats?.generated_at ?? null)}</span>
        <span>Settings updated: {formatDateTime(stats?.settings_updated_at ?? null)}</span>
        <span>Status updated: {formatDateTime(stats?.status_updated_at ?? null)}</span>
        <span>Auto-refresh: every 30 seconds while this page is open.</span>
      </div>
    </div>
  );
}
