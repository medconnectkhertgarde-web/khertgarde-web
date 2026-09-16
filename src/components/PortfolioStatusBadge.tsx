import type { PortfolioStatus } from "@/lib/portfolio-status";
import "@/status-share.css";

export function PortfolioStatusBadge({ status }: { status: PortfolioStatus }) {
  if (!status.is_enabled || !status.status_text.trim()) return null;

  return (
    <div className="portfolio-status-badge" role="status" aria-label={`Current status: ${status.status_text}`}>
      <span className="portfolio-status-dot" aria-hidden="true" />
      <span>{status.status_text}</span>
    </div>
  );
}
