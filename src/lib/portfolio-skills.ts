import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export interface PortfolioSkill {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PORTFOLIO_SKILLS: PortfolioSkill[] = [
  {
    id: "default-customer-service",
    name: "Customer Service",
    description:
      "Supporting customers through clear communication, active listening, issue resolution, and accurate documentation.",
    sort_order: 10,
    is_enabled: true,
  },
  {
    id: "default-ai",
    name: "Artificial Intelligence",
    description:
      "Using AI tools to support research, productivity, content workflows, and practical project development.",
    sort_order: 20,
    is_enabled: true,
  },
  {
    id: "default-ai-prompting",
    name: "AI Prompt Engineering",
    description:
      "Designing structured prompts and iterative instructions to produce more accurate and useful AI-assisted outputs.",
    sort_order: 30,
    is_enabled: true,
  },
  {
    id: "default-python",
    name: "Python",
    description:
      "Foundational Python for scripting, automation, data handling, and building practical tools and utilities.",
    sort_order: 40,
    is_enabled: true,
  },
  {
    id: "default-cybersecurity",
    name: "Cybersecurity",
    description:
      "Foundational knowledge of security principles, safe system practices, common threats, and risk-aware troubleshooting.",
    sort_order: 50,
    is_enabled: true,
  },
  {
    id: "default-networking",
    name: "Networking",
    description:
      "Foundational computer networking, connectivity setup, basic diagnostics, and troubleshooting of local network issues.",
    sort_order: 60,
    is_enabled: true,
  },
  {
    id: "default-css",
    name: "Computer Systems Servicing",
    description:
      "Computer setup, hardware and software maintenance, basic diagnostics, troubleshooting, and system support.",
    sort_order: 70,
    is_enabled: true,
  },
  {
    id: "default-onsit",
    name: "ONSIT",
    description:
      "Practical familiarity with ONSIT-related workflows and tasks included in my current technical skill set.",
    sort_order: 80,
    is_enabled: true,
  },
  {
    id: "default-research",
    name: "Research",
    description:
      "Independent research, evidence gathering, source review, structured synthesis, and turning complex topics into clear materials.",
    sort_order: 90,
    is_enabled: true,
  },
  {
    id: "default-technical-support",
    name: "Technical Support",
    description:
      "Providing basic technical assistance, diagnosing common issues, and guiding users through practical solutions.",
    sort_order: 100,
    is_enabled: true,
  },
  {
    id: "default-troubleshooting",
    name: "Troubleshooting",
    description:
      "Systematically identifying likely causes, testing fixes, and documenting solutions for technical problems.",
    sort_order: 110,
    is_enabled: true,
  },
  {
    id: "default-systems-support",
    name: "Systems Support",
    description:
      "Supporting day-to-day computer systems, software setup, user needs, and reliable operation of basic IT environments.",
    sort_order: 120,
    is_enabled: true,
  },
  {
    id: "default-communication",
    name: "Communication",
    description:
      "Clear written and verbal communication across customer service, technical support, research, and collaborative work.",
    sort_order: 130,
    is_enabled: true,
  },
  {
    id: "default-data-organization",
    name: "Data Organization",
    description:
      "Structuring, labeling, and maintaining information so it stays accurate, usable, and easy to retrieve.",
    sort_order: 140,
    is_enabled: true,
  },
];

export async function fetchPortfolioSkills(options: { includeDisabled?: boolean } = {}) {
  const supabase = getSupabaseClient();

  if (!isSupabaseConfigured || !supabase) {
    return DEFAULT_PORTFOLIO_SKILLS;
  }

  let query = supabase
    .from("portfolio_skills")
    .select("id, name, description, sort_order, is_enabled, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(30);

  if (!options.includeDisabled) {
    query = query.eq("is_enabled", true);
  }

  const { data, error } = await query;

  if (error) {
    return DEFAULT_PORTFOLIO_SKILLS;
  }

  return (data ?? []) as PortfolioSkill[];
}
