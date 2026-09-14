import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  FileText,
  LoaderCircle,
  X,
} from "lucide-react";

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
                <div className="viewer-loading" role="status">
                  <LoaderCircle className="spin" aria-hidden="true" />
                  <span>
                    {slow
                      ? "The Google Drive preview is taking longer than usual."
                      : "Loading study viewer"}
                  </span>
                  {slow ? (
                    <a href={study.view_url} target="_blank" rel="noopener noreferrer">
                      Open directly in Google Drive
                    </a>
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

export function ClinicalStudies() {
  const [state, setState] = useState<StudiesState>({ status: "loading", studies: [] });
  const [selectedStudy, setSelectedStudy] = useState<ClinicalStudy | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStudies() {
      try {
        const response = await fetch("/api/studies", {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        const payload = (await response.json()) as StudiesApiResponse;

        if (!response.ok) {
          throw new Error(payload.error || `Study API returned HTTP ${response.status}`);
        }

        setState({ status: "ready", studies: payload.studies ?? [] });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Unknown study loading error";
        console.error("Unable to load clinical studies:", message);
        setState({ status: "error", studies: [] });
      }
    }

    void loadStudies();

    return () => controller.abort();
  }, []);

  return (
    <section id="clinical-studies" className="section clinical-section" aria-labelledby="studies-heading">
      <div className="section-heading-row">
        <h2 id="studies-heading" className="section-label">
          03 — Recent clinical studies
        </h2>
        <span className="section-note">Published work</span>
      </div>

      {state.status === "loading" ? (
        <div className="studies-state" role="status">
          <LoaderCircle className="spin" aria-hidden="true" />
          Loading clinical studies
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="studies-state" role="status">
          Clinical studies are temporarily unavailable.
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
