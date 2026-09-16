import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";

import { ShareButton } from "@/components/ShareButton";

export interface ClinicalStudy {
  id: string;
  title: string;
  summary: string;
  category: string;
  published_at: string | null;
  filename: string;
  mime_type: string;
  preview_url: string;
  view_url: string;
  download_url: string | null;
}

type StudiesState =
  | { status: "loading"; studies: ClinicalStudy[] }
  | { status: "ready"; studies: ClinicalStudy[] }
  | { status: "error"; studies: ClinicalStudy[] };

interface StudiesApiResponse {
  studies?: ClinicalStudy[];
  synced_at?: string;
  error?: string;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function StudyCardSkeleton() {
  return (
    <article className="study-card study-card-skeleton" aria-hidden="true">
      <div className="study-skeleton-meta">
        <span className="skeleton-block skeleton-meta-line" />
        <span className="skeleton-block skeleton-meta-line skeleton-meta-line-short" />
      </div>
      <div className="study-skeleton-copy">
        <span className="skeleton-block skeleton-title-line" />
        <span className="skeleton-block skeleton-copy-line" />
        <span className="skeleton-block skeleton-copy-line skeleton-copy-line-short" />
      </div>
      <div className="study-skeleton-actions">
        <span className="skeleton-block skeleton-button" />
        <span className="skeleton-block skeleton-button" />
      </div>
    </article>
  );
}

function StudyCard({ study, onView }: { study: ClinicalStudy; onView: () => void }) {
  const published = formatDate(study.published_at);

  return (
    <article className="study-card">
      <div className="study-meta">
        <span>{study.category || "Clinical study"}</span>
        {published ? <span>{published}</span> : null}
      </div>

      <div className="study-copy">
        <h3>{study.title}</h3>
        {study.summary ? <p>{study.summary}</p> : null}
      </div>

      <div className="study-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={onView}
          disabled={!study.preview_url}
        >
          <FileText aria-hidden="true" />
          View study
        </button>

        {study.download_url ? (
          <a
            className="button button-outline"
            href={study.download_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowDownToLine aria-hidden="true" />
            Download
          </a>
        ) : (
          <button className="button button-outline" type="button" disabled>
            <ArrowDownToLine aria-hidden="true" />
            Download
          </button>
        )}

        <ShareButton
          title={study.title}
          text={study.summary || `${study.category || "Clinical study"} by Khert Laguna Garde`}
          url={study.view_url}
          label="Share"
        />
      </div>
    </article>
  );
}

function StudyViewer({ study, onClose }: { study: ClinicalStudy; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const slowTimer = window.setTimeout(() => setSlow(true), 12_000);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(slowTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="study-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-viewer-title"
        aria-describedby="study-viewer-description"
      >
        <header className="viewer-header">
          <div className="viewer-heading">
            <h2 id="study-viewer-title">{study.title}</h2>
            <p id="study-viewer-description">{study.category || "Clinical study"}</p>
          </div>

          <div className="viewer-actions">
            <a
              className="button button-outline"
              href={study.view_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowUpRight aria-hidden="true" />
              Open in Drive
            </a>
            {study.download_url ? (
              <a
                className="button button-primary"
                href={study.download_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowDownToLine aria-hidden="true" />
                Download
              </a>
            ) : null}
            <ShareButton
              title={study.title}
              text={study.summary || `${study.category || "Clinical study"} by Khert Laguna Garde`}
              url={study.view_url}
              label="Share"
            />
            <button
              ref={closeButtonRef}
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label="Close study viewer"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="viewer-body">
          {study.preview_url ? (
            <>
              {!loaded ? (
                <div className="viewer-loading viewer-loading-skeleton" role="status">
                  <span className="sr-only">
                    {slow
                      ? "The Google Drive preview is taking longer than usual."
                      : "Loading study viewer"}
                  </span>
                  <div className="viewer-skeleton-document" aria-hidden="true">
                    <span className="skeleton-block viewer-skeleton-heading" />
                    <span className="skeleton-block viewer-skeleton-line" />
                    <span className="skeleton-block viewer-skeleton-line" />
                    <span className="skeleton-block viewer-skeleton-line viewer-skeleton-line-short" />
                    <span className="skeleton-block viewer-skeleton-block" />
                  </div>
                  {slow ? (
                    <div className="viewer-slow-note">
                      <span>The Google Drive preview is taking longer than usual.</span>
                      <a href={study.view_url} target="_blank" rel="noopener noreferrer">
                        Open directly in Google Drive
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <iframe
                className="drive-frame"
                src={study.preview_url}
                title={`${study.title} Google Drive document viewer`}
                loading="lazy"
                allow="autoplay; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoaded(true)}
              />
            </>
          ) : (
            <div className="viewer-unavailable">
              <FileText aria-hidden="true" />
              <p>This study does not have an embeddable Google Drive preview.</p>
              <a href={study.view_url} target="_blank" rel="noopener noreferrer">
                Open directly in Google Drive
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function readStudiesResponse(response: Response): Promise<ClinicalStudy[]> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Study API returned a non-JSON response (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as StudiesApiResponse;

  if (!response.ok) {
    throw new Error(payload.error || `Study API returned HTTP ${response.status}`);
  }

  if (!Array.isArray(payload.studies)) {
    throw new Error("Study API returned an invalid response.");
  }

  return payload.studies;
}

export function ClinicalStudies() {
  const [state, setState] = useState<StudiesState>({ status: "loading", studies: [] });
  const [selectedStudy, setSelectedStudy] = useState<ClinicalStudy | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | null = null;

    const requestStudies = async () => {
      const response = await fetch("/api/studies", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      return readStudiesResponse(response);
    };

    async function loadStudies() {
      setState({ status: "loading", studies: [] });

      try {
        const studies = await requestStudies();
        if (!controller.signal.aborted) {
          setState({ status: "ready", studies });
        }
        return;
      } catch (firstError) {
        if (controller.signal.aborted) return;

        // A single short retry absorbs transient local/Vercel/Drive startup failures
        // without creating polling or meaningful extra resource usage.
        await new Promise<void>((resolve) => {
          retryTimer = window.setTimeout(resolve, 700);
        });

        if (controller.signal.aborted) return;

        try {
          const studies = await requestStudies();
          if (!controller.signal.aborted) {
            setState({ status: "ready", studies });
          }
          return;
        } catch (secondError) {
          if (controller.signal.aborted) return;
          const error = secondError instanceof Error ? secondError : firstError;
          const message = error instanceof Error ? error.message : "Unknown study loading error";
          console.error("Unable to load clinical studies:", message);
          setState({ status: "error", studies: [] });
        }
      }
    }

    void loadStudies();

    return () => {
      controller.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [retryKey]);

  return (
    <section id="clinical-studies" className="section clinical-section" aria-labelledby="studies-heading">
      <div className="section-heading-row">
        <h2 id="studies-heading" className="section-label">
          04 {"\u2014"} Recent clinical studies
        </h2>
        <span className="section-note">Published work</span>
      </div>

      {state.status === "loading" ? (
        <div className="study-skeleton-list" role="status" aria-live="polite">
          <span className="sr-only">Loading clinical studies</span>
          <StudyCardSkeleton />
          <StudyCardSkeleton />
          <StudyCardSkeleton />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="studies-state" role="status">
          <span>Clinical studies are temporarily unavailable.</span>
          <button
            className="button button-outline"
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {state.status === "ready" && state.studies.length === 0 ? (
        <div className="studies-state">Clinical studies will appear here once published.</div>
      ) : null}

      {state.status === "ready" && state.studies.length > 0 ? (
        <div>
          {state.studies.map((study) => (
            <StudyCard key={study.id} study={study} onView={() => setSelectedStudy(study)} />
          ))}
        </div>
      ) : null}

      {selectedStudy ? (
        <StudyViewer study={selectedStudy} onClose={() => setSelectedStudy(null)} />
      ) : null}
    </section>
  );
}
