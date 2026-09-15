import type { PortfolioSettings } from "@/lib/portfolio-content";

const SITE_URL = "https://khertgarde.vercel.app/";
const OG_IMAGE_URL = `${SITE_URL}og-khertgarde-v1.png`;

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;

  const shortened = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const lastSpace = shortened.lastIndexOf(" ");
  return `${lastSpace > maxLength * 0.72 ? shortened.slice(0, lastSpace) : shortened}…`;
}

function setNamedMeta(name: string, content: string) {
  const element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (element) element.content = content;
}

function setPropertyMeta(property: string, content: string) {
  const element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (element) element.content = content;
}

/**
 * Keeps browser-visible metadata and JSON-LD synchronized with content that the
 * admin can edit. Static defaults remain in index.html so crawlers still see
 * useful metadata even before JavaScript/Supabase finishes loading.
 */
export function updatePortfolioSeo(settings: PortfolioSettings) {
  const displayName = cleanText(settings.display_name) || "Khert Laguna Garde";
  const primaryRole = cleanText(settings.role_primary) || "Independent Researcher";
  const description = truncate(
    settings.hero_copy ||
      `Portfolio of ${displayName}, an independent researcher focused on medicine and clinical studies.`,
    165,
  );

  const title = `${displayName} | ${primaryRole}`;

  document.title = title;
  setNamedMeta("description", description);
  setNamedMeta("author", displayName);
  setNamedMeta("twitter:title", title);
  setNamedMeta("twitter:description", description);
  setNamedMeta("twitter:image", OG_IMAGE_URL);

  setPropertyMeta("og:title", title);
  setPropertyMeta("og:description", description);
  setPropertyMeta("og:url", SITE_URL);
  setPropertyMeta("og:image", OG_IMAGE_URL);
  setPropertyMeta("og:image:secure_url", OG_IMAGE_URL);

  const structuredData = document.getElementById("khert-structured-data");
  if (!structuredData) return;

  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${SITE_URL}#person`,
    name: displayName,
    url: SITE_URL,
    jobTitle: primaryRole,
    description,
    knowsAbout: ["Medicine", "Clinical studies"],
  };

  if (settings.profile_image_url?.trim()) {
    person.image = settings.profile_image_url.trim();
  }

  structuredData.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        url: SITE_URL,
        name: `${displayName} Portfolio`,
        alternateName: "Khert Garde Portfolio",
        description,
        inLanguage: "en",
      },
      {
        "@type": "ProfilePage",
        "@id": `${SITE_URL}#profile-page`,
        url: SITE_URL,
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}#website` },
        mainEntity: { "@id": `${SITE_URL}#person` },
      },
      person,
    ],
  });
}
