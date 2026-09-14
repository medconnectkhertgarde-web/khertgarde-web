import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, LogIn, LogOut, MessageSquare, Send, Trash2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import "@/comments.css";

const COMMENT_MAX_LENGTH = 150;
const COMMENT_LIMIT = 50;
const AUTH_RETURN_KEY = "khert-comment-auth-return";

interface PortfolioComment {
  id: number | string;
  user_id: string;
  author_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

type LoadState = "loading" | "ready" | "error";

function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getDisplayName(user: User | null) {
  if (!user) return "";

  const metadata = user.user_metadata ?? {};
  return (
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "Google user"
  );
}

function getAvatarUrl(user: User | null) {
  if (!user) return null;

  const metadata = user.user_metadata ?? {};
  const value = metadata.avatar_url ?? metadata.picture;
  return typeof value === "string" && value.trim() ? value : null;
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  const initials = useMemo(() => {
    const pieces = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    const result = pieces.map((piece) => piece[0]?.toUpperCase() ?? "").join("");
    return result || "G";
  }, [name]);

  if (src) {
    return <img className="comment-avatar" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  }

  return (
    <span className="comment-avatar comment-avatar-fallback" aria-hidden="true">
      {initials}
    </span>
  );
}

export function Comments() {
  const supabase = getSupabaseClient();
  const [comments, setComments] = useState<PortfolioComment[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [body, setBody] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<number | string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (!supabase) {
      setLoadState("error");
      return;
    }

    setLoadState("loading");

    const { data, error } = await supabase
      .from("portfolio_comments")
      .select("id, user_id, author_name, avatar_url, body, created_at")
      .order("created_at", { ascending: false })
      .limit(COMMENT_LIMIT);

    if (error) {
      console.error("Unable to load portfolio comments:", error.message);
      setLoadState("error");
      return;
    }

    setComments((data ?? []) as PortfolioComment[]);
    setLoadState("ready");
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoadState("error");
      return;
    }

    void loadComments();

    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);

      if (data.session?.user && window.sessionStorage.getItem(AUTH_RETURN_KEY) === "1") {
        window.sessionStorage.removeItem(AUTH_RETURN_KEY);
        window.requestAnimationFrame(() => {
          document.getElementById("comments")?.scrollIntoView({ block: "start" });
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadComments, supabase]);

  async function signInWithGoogle() {
    if (!supabase) return;

    setAuthBusy(true);
    setMessage(null);
    window.sessionStorage.setItem(AUTH_RETURN_KEY, "1");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      window.sessionStorage.removeItem(AUTH_RETURN_KEY);
      setMessage("Google sign-in could not be started. Please try again.");
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;

    setAuthBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage("Sign out failed. Please try again.");
    } else {
      setBody("");
    }

    setAuthBusy(false);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || submitBusy) return;

    const trimmed = body.trim();
    if (!trimmed) {
      setMessage("Write a comment before posting.");
      return;
    }

    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setMessage(`Comments are limited to ${COMMENT_MAX_LENGTH} characters.`);
      return;
    }

    setSubmitBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc("add_portfolio_comment", {
      comment_text: trimmed,
    });

    if (error) {
      const cooldown = error.message.toLowerCase().includes("wait before posting");
      setMessage(
        cooldown
          ? "Please wait a moment before posting another comment."
          : "Your comment could not be posted. Please try again.",
      );
      setSubmitBusy(false);
      return;
    }

    setBody("");
    setMessage("Comment posted.");
    await loadComments();
    setSubmitBusy(false);
  }

  async function deleteOwnComment(comment: PortfolioComment) {
    if (!supabase || !user || comment.user_id !== user.id || deleteBusyId !== null) return;
    if (!window.confirm("Delete your comment?")) return;

    setDeleteBusyId(comment.id);
    setMessage(null);

    const { error } = await supabase.from("portfolio_comments").delete().eq("id", comment.id);

    if (error) {
      setMessage("Your comment could not be deleted. Please try again.");
    } else {
      setComments((items) => items.filter((item) => item.id !== comment.id));
      setMessage("Comment deleted.");
    }

    setDeleteBusyId(null);
  }

  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);
  const remaining = COMMENT_MAX_LENGTH - body.length;

  return (
    <section id="comments" className="section comments-section" aria-labelledby="comments-heading">
      <div className="section-heading-row comments-heading-row">
        <div>
          <h2 id="comments-heading" className="section-label">
            05 — Comments
          </h2>
          <p className="comments-intro">Thoughts, feedback, and notes from visitors.</p>
        </div>
        <span className="section-note">Visitor guestbook</span>
      </div>

      {!isSupabaseConfigured ? (
        <div className="comments-state" role="status">
          Comments are temporarily unavailable.
        </div>
      ) : (
        <>
          <div className="comment-composer">
            {user ? (
              <>
                <div className="comment-account-row">
                  <div className="comment-account">
                    <Avatar name={displayName} src={avatarUrl} />
                    <div>
                      <span className="comment-account-label">Signed in as</span>
                      <strong>{displayName}</strong>
                    </div>
                  </div>
                  <button className="button button-outline" type="button" onClick={signOut} disabled={authBusy}>
                    {authBusy ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
                    Sign out
                  </button>
                </div>

                <form className="comment-form" onSubmit={submitComment}>
                  <label htmlFor="portfolio-comment">Leave a comment</label>
                  <textarea
                    id="portfolio-comment"
                    value={body}
                    onChange={(event) => setBody(event.target.value.slice(0, COMMENT_MAX_LENGTH))}
                    maxLength={COMMENT_MAX_LENGTH}
                    rows={3}
                    placeholder="Share a short thought about the portfolio."
                    disabled={submitBusy}
                  />
                  <div className="comment-form-footer">
                    <span className={remaining <= 20 ? "comment-counter comment-counter-low" : "comment-counter"}>
                      {body.length} / {COMMENT_MAX_LENGTH}
                    </span>
                    <button className="button button-primary" type="submit" disabled={submitBusy || !body.trim()}>
                      {submitBusy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                      Post comment
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="comment-signin">
                <div>
                  <p>Want to leave a comment?</p>
                  <span>Sign in with Google first. Your email address is not shown publicly.</span>
                </div>
                <button className="button button-primary" type="button" onClick={signInWithGoogle} disabled={authBusy}>
                  {authBusy ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                  Continue with Google
                </button>
              </div>
            )}

            {message ? <p className="comment-message" role="status">{message}</p> : null}
          </div>

          <div className="comment-list" aria-live="polite">
            {loadState === "loading" ? (
              <div className="comments-state" role="status">
                <LoaderCircle className="spin" aria-hidden="true" />
                Loading comments
              </div>
            ) : null}

            {loadState === "error" ? (
              <div className="comments-state" role="status">
                <span>Comments are temporarily unavailable.</span>
                <button className="button button-outline" type="button" onClick={() => void loadComments()}>
                  Retry
                </button>
              </div>
            ) : null}

            {loadState === "ready" && comments.length === 0 ? (
              <div className="comments-state comments-empty">
                <MessageSquare aria-hidden="true" />
                No comments yet. Be the first to leave one.
              </div>
            ) : null}

            {loadState === "ready"
              ? comments.map((comment) => {
                  const canDelete = Boolean(user && user.id === comment.user_id);
                  return (
                    <article className="comment-item" key={comment.id}>
                      <Avatar name={comment.author_name} src={comment.avatar_url} />
                      <div className="comment-content">
                        <div className="comment-meta">
                          <div className="comment-author-row">
                            <strong>{comment.author_name}</strong>
                            <time dateTime={comment.created_at}>{formatCommentDate(comment.created_at)}</time>
                          </div>
                          {canDelete ? (
                            <button
                              className="comment-delete-button"
                              type="button"
                              onClick={() => void deleteOwnComment(comment)}
                              disabled={deleteBusyId === comment.id}
                              aria-label="Delete your comment"
                              title="Delete your comment"
                            >
                              {deleteBusyId === comment.id ? (
                                <LoaderCircle className="spin" aria-hidden="true" />
                              ) : (
                                <Trash2 aria-hidden="true" />
                              )}
                            </button>
                          ) : null}
                        </div>
                        <p>{comment.body}</p>
                      </div>
                    </article>
                  );
                })
              : null}
          </div>
        </>
      )}
    </section>
  );
}
