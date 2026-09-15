import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, LogIn, Star } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchMyPortfolioRating,
  fetchPortfolioRatingSummary,
  savePortfolioRating,
  type PortfolioRatingSummary,
} from "@/lib/portfolio-ratings";
import "@/engagement.css";

const PENDING_RATING_KEY = "khert-pending-portfolio-rating";
const AUTH_RETURN_KEY = "khert-rating-auth-return";

const EMPTY_SUMMARY: PortfolioRatingSummary = {
  average: 0,
  count: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

function displayName(user: User | null) {
  const metadata = user?.user_metadata ?? {};
  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) return metadata.full_name.trim();
  if (typeof metadata.name === "string" && metadata.name.trim()) return metadata.name.trim();
  return user?.email ?? "visitor";
}

export function PortfolioRating() {
  const supabase = getSupabaseClient();
  const [summary, setSummary] = useState<PortfolioRatingSummary>(EMPTY_SUMMARY);
  const [user, setUser] = useState<User | null>(null);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshSummary = useCallback(async () => {
    setSummary(await fetchPortfolioRatingSummary());
  }, []);

  const refreshMine = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setMyRating(null);
      return;
    }
    setMyRating(await fetchMyPortfolioRating(nextUser.id));
  }, []);

  const submitRating = useCallback(async (stars: number) => {
    setBusy(true);
    setMessage(null);
    const result = await savePortfolioRating(stars);
    if (result.error) {
      setMessage("Your rating could not be saved. Please try again.");
    } else {
      setMyRating(stars);
      setMessage("Thanks — your rating was saved.");
      await refreshSummary();
    }
    setBusy(false);
  }, [refreshSummary]);

  useEffect(() => {
    void refreshSummary();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    const handleSession = async (nextUser: User | null) => {
      setUser(nextUser);
      setAuthReady(true);
      await refreshMine(nextUser);

      if (nextUser && window.sessionStorage.getItem(AUTH_RETURN_KEY) === "1") {
        window.sessionStorage.removeItem(AUTH_RETURN_KEY);
        const pending = Number(window.sessionStorage.getItem(PENDING_RATING_KEY));
        window.sessionStorage.removeItem(PENDING_RATING_KEY);
        if (pending >= 1 && pending <= 5) await submitRating(pending);
        window.requestAnimationFrame(() => {
          document.getElementById("portfolio-rating")?.scrollIntoView({ block: "center" });
        });
      }
    };

    void supabase.auth.getSession().then(({ data }) => void handleSession(data.session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void handleSession(session?.user ?? null);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [refreshMine, refreshSummary, submitRating, supabase]);

  async function signInForRating(stars?: number) {
    if (!supabase || busy) return;
    if (stars) window.sessionStorage.setItem(PENDING_RATING_KEY, String(stars));
    window.sessionStorage.setItem(AUTH_RETURN_KEY, "1");
    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      window.sessionStorage.removeItem(PENDING_RATING_KEY);
      setMessage("Google sign-in could not be started.");
      setBusy(false);
    }
  }

  function chooseRating(stars: number) {
    if (!user) {
      void signInForRating(stars);
      return;
    }
    void submitRating(stars);
  }

  const activeRating = hovered || myRating || 0;
  const displayAverage = summary.count ? summary.average.toFixed(1) : "—";
  const distribution = useMemo(
    () => [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: summary.breakdown[stars as 1 | 2 | 3 | 4 | 5],
      percent: summary.count
        ? Math.round((summary.breakdown[stars as 1 | 2 | 3 | 4 | 5] / summary.count) * 100)
        : 0,
    })),
    [summary],
  );

  return (
    <section id="portfolio-rating" className="portfolio-rating" aria-labelledby="portfolio-rating-heading">
      <div className="portfolio-rating-copy">
        <p className="portfolio-rating-kicker">Visitor rating</p>
        <h2 id="portfolio-rating-heading">Rate this portfolio</h2>
        <p>
          Ratings are tied to signed-in visitors, so each account contributes one current rating.
        </p>
      </div>

      <div className="portfolio-rating-panel">
        <div className="portfolio-rating-overview" aria-label={`${summary.average.toFixed(1)} out of 5 from ${summary.count} ratings`}>
          <div className="portfolio-rating-score">
            <div className="portfolio-rating-score-value">{displayAverage}</div>
            <div className="portfolio-rating-score-stars" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={summary.count && star <= Math.round(summary.average) ? "is-filled" : ""} />
              ))}
            </div>
            <div className="portfolio-rating-score-meta">
              {summary.count ? `${summary.count} ${summary.count === 1 ? "rating" : "ratings"}` : "No ratings yet"}
            </div>
          </div>

          <div className="portfolio-rating-distribution" aria-label="Rating distribution">
            {distribution.map((row) => (
              <div className="portfolio-rating-distribution-row" key={row.stars}>
                <span className="portfolio-rating-distribution-label">{row.stars}</span>
                <div className="portfolio-rating-distribution-track" aria-hidden="true">
                  <span style={{ width: `${row.percent}%` }} />
                </div>
                <span className="portfolio-rating-distribution-count">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="portfolio-rating-divider" />

        <div className="portfolio-rating-action-label">
          {myRating ? "Update your rating" : "Leave your rating"}
        </div>

        <div className="portfolio-rating-stars" role="group" aria-label="Rate this portfolio from 1 to 5 stars">
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              type="button"
              key={stars}
              className={stars <= activeRating ? "is-active" : ""}
              onMouseEnter={() => setHovered(stars)}
              onMouseLeave={() => setHovered(0)}
              onFocus={() => setHovered(stars)}
              onBlur={() => setHovered(0)}
              onClick={() => chooseRating(stars)}
              disabled={busy || !isSupabaseConfigured || !authReady}
              aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`}
              aria-pressed={myRating === stars}
            >
              <Star aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="portfolio-rating-meta">
          {user ? (
            <span>{myRating ? `Your rating: ${myRating}/5` : `Signed in as ${displayName(user)}`}</span>
          ) : (
            <button type="button" className="portfolio-rating-signin" onClick={() => void signInForRating()} disabled={busy || !isSupabaseConfigured}>
              {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
              Sign in with Google to rate
            </button>
          )}
          {message ? <span className="portfolio-rating-message" role="status">{message}</span> : null}
        </div>
      </div>
    </section>
  );
}
