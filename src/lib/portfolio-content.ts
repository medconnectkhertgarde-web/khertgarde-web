import { getSupabaseClient } from "@/lib/supabase";

export interface PortfolioSettings {
  id: number;
  display_name: string;
  eyebrow: string;
  role_primary: string;
  role_secondary: string;
  hero_copy: string;
  about_primary: string;
  about_secondary: string;
  contact_intro: string;
  contact_email: string;
  contact_phone: string;
  contact_phone_href: string;
  profile_image_url: string | null;
  updated_at?: string;
}

export interface PortfolioExperience {
  id: string;
  company: string;
  role: string;
  description: string;
  note: string | null;
  sort_order: number;
}

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettings = {
  id: 1,
  display_name: "Khert Laguna Garde",
  eyebrow: "Independent researcher · Philippines",
  role_primary: "Independent Researcher",
  role_secondary: "Medicine · Clinical Studies",
  hero_copy:
    "Independent researcher with a strong interest in medicine and clinical studies. I explore medical conditions, diagnostic approaches, disease mechanisms, treatment principles, and clinical scenarios through structured independent research and study.",
  about_primary:
    "I’m an independent researcher with a growing focus on medicine and clinical studies. My work centers on understanding diseases, clinical presentation, diagnostic reasoning, treatment principles, and evidence-based approaches to patient scenarios.",
  about_secondary:
    "I enjoy turning complex medical topics into structured and understandable study materials while continuously expanding my knowledge across different areas of medicine.",
  contact_intro:
    "For research-related inquiries, professional opportunities, and other communications.",
  contact_email: "medconnect.khertgarde@gmail.com",
  contact_phone: "09307732588",
  contact_phone_href: "+639307732588",
  profile_image_url: null,
};

export const DEFAULT_EXPERIENCES: PortfolioExperience[] = [
  {
    id: "default-concentrix",
    company: "Concentrix",
    role: "Customer Service Representative",
    description:
      "Handled customer inquiries and service concerns while providing clear, professional, and timely support. The role involved understanding customer needs, explaining information accurately, resolving concerns when possible, documenting interactions, following account procedures, and escalating complex issues when necessary.",
    note:
      "A Customer Service Representative serves as a primary point of contact between a company and its customers, helping answer questions, resolve concerns, provide information, and maintain a positive customer experience.",
    sort_order: 10,
  },
  {
    id: "default-sutherland",
    company: "Sutherland Global Services",
    role: "Business Process Outsourcing — Healthcare Account",
    description:
      "Worked within a healthcare-focused BPO account supporting account operations and customer interactions according to established company and account procedures.",
    note: null,
    sort_order: 20,
  },
];

export async function fetchPortfolioSettings(): Promise<PortfolioSettings> {
  const supabase = getSupabaseClient();
  if (!supabase) return DEFAULT_PORTFOLIO_SETTINGS;

  const { data, error } = await supabase
    .from("portfolio_settings")
    .select(
      "id, display_name, eyebrow, role_primary, role_secondary, hero_copy, about_primary, about_secondary, contact_intro, contact_email, contact_phone, contact_phone_href, profile_image_url, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Unable to load portfolio settings:", error.message);
    return DEFAULT_PORTFOLIO_SETTINGS;
  }

  return {
    ...DEFAULT_PORTFOLIO_SETTINGS,
    ...(data as PortfolioSettings),
  };
}

export async function fetchPortfolioExperiences(): Promise<PortfolioExperience[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return DEFAULT_EXPERIENCES;

  const { data, error } = await supabase
    .from("portfolio_experiences")
    .select("id, company, role, description, note, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Unable to load portfolio experiences:", error.message);
    return DEFAULT_EXPERIENCES;
  }

  return (data ?? []) as PortfolioExperience[];
}

export function normalizePhoneHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+")
    ? `+${trimmed.slice(1).replace(/\D/g, "")}`
    : trimmed.replace(/\D/g, "");
}
