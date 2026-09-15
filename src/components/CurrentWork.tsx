import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { LoaderCircle, Send, Trash2 } from "lucide-react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase";
import {
  fetchPortfolioCurrentWork,
  type PortfolioCurrentWorkItem,
} from "@/lib/portfolio-current-work";
import "@/engagement.css";

const ADMIN_EMAIL = "medconnect.khertgarde@gmail.com";
const MESSAGE_MAX = 600;

function hasPasswordAuthentication(session: Session | null) {
  const token = session?.access_token;
  if (!token) return false;

  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as { amr?: Array<string | { method?: string }> };
    return (parsed.amr ?? []).some((entry) =>
      typeof entry === "string" ? entry === "password" : entry?.method === "password",
    );
  } catch {
    return false;
  }
}

function isAdminSession(user: User | null, session: Session | null) {
  return (
    user?.email?.trim().toLowerCase() === ADMIN_EMAIL &&
    hasPasswordAuthentication(session)
  );
}

function formatUpdateDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function CurrentWork() {
  const supabase = getSupabaseClient();
  const [items, setItems] = useState<PortfolioCurrentWorkItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const admin = useMemo(() => isAdminSession(user, session), [session, user]);

  const loadItems = useCallback(async () => {
    const next = await fetchPortfolioCurrentWork({ limit: 20 });
    setItems(next);
    setResolved(true);
  }, []);

  useEffect(() => {
    void loadItems();

    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadItems, supabase]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !admin || busy) return;

    const trimmed = body.trim();
    if (!trimmed) {
      setMessage("Write an update before publishing.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("portfolio_current_work").insert({
      body: trimmed.slice(0, MESSAGE_MAX),
      is_visible: true,
    });

    if (error) {
      setMessage("The update could not be published.");
    } else {
      setBody("");
      setMessage("Update published.");
      await loadItems();
    }
    setBusy(false);
  }

  async function removeItem(id: string) {
    if (!supabase || !admin || busy) return;
    setBusy(true);
    const { error } = await supabase.from("portfolio_current_work").delete().eq("id", id);
    if (error) setMessage("The update could not be deleted.");
    else {
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage("Update deleted.");
    }
    setBusy(false);
  }

  return (
    <section id="current-work" className="section current-work-section" aria-labelledby="current-work-heading">
      <div className="current-work-heading-row">
        <div>
          <p className="current-work-kicker">Current activity</p>
          <h2 id="current-work-heading">What I’m currently working on</h2>
          <p className="current-work-intro">
            Short updates on the research, technical work, and projects currently receiving my attention.
          </p>
        </div>
        <span className="current-work-status"><span aria-hidden="true" /> Live notes</span>
      </div>

      <div className="current-work-board">
        {!resolved ? (
          <div className="current-work-loading" aria-label="Loading current work updates">
            <span />
            <span />
            <span />
          </div>
        ) : items.length ? (
          <div className="current-work-stream" aria-live="polite">
            {[...items].reverse().map((item, index) => (
              <article
                className="current-work-message"
                key={item.id}
                style={{ "--message-index": index } as CSSProperties}
              >
                <div className="current-work-message-head">
                  <span>Khert</span>
                  <time dateTime={item.created_at}>{formatUpdateDate(item.created_at)}</time>
                </div>
                <p>{item.body}</p>
                {admin ? (
                  <button
                    type="button"
                    className="current-work-delete"
                    onClick={() => void removeItem(item.id)}
                    disabled={busy}
                    aria-label="Delete this current work update"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="current-work-empty">No public updates yet.</p>
        )}

        {admin ? (
          <form className="current-work-admin-composer" onSubmit={publish}>
            <div className="current-work-admin-label">
              <span>Admin quick post</span>
              <span>{body.length}/{MESSAGE_MAX}</span>
            </div>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, MESSAGE_MAX))}
              maxLength={MESSAGE_MAX}
              rows={3}
              placeholder="Share what you are currently working on..."
              disabled={busy}
            />
            <div className="current-work-admin-actions">
              {message ? <span role="status">{message}</span> : <span>Visible publicly after publishing.</span>}
              <button className="button button-primary" type="submit" disabled={busy || !body.trim()}>
                {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                Publish
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}
