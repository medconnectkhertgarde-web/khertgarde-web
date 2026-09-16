import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Save,
  Sun,
  Trash2,
} from "lucide-react";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  fetchPortfolioExperiences,
  fetchPortfolioSettings,
  type PortfolioExperience,
  type PortfolioSettings,
} from "@/lib/portfolio-content";
import {
  canonicalYouTubeUrl,
  extractYouTubeVideoId,
  fetchPortfolioMusicTracks,
  type PortfolioMusicTrack,
} from "@/lib/portfolio-music";
import {
  fetchPortfolioSkills,
  type PortfolioSkill,
} from "@/lib/portfolio-skills";
import {
  fetchPortfolioCurrentWork,
  type PortfolioCurrentWorkItem,
} from "@/lib/portfolio-current-work";
import {
  EMPTY_PORTFOLIO_STATUS,
  fetchPortfolioStatus,
  type PortfolioStatus,
} from "@/lib/portfolio-status";
import "@/admin.css";

const ADMIN_EMAIL = "medconnect.khertgarde@gmail.com";
const PROFILE_BUCKET = "portfolio-assets";
const MAX_PROFILE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_PROFILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface AdminComment {
  id: number | string;
  author_name: string;
  body: string;
  created_at: string;
}

type AdminSectionId =
  | "details"
  | "photo"
  | "music"
  | "skills"
  | "current-work"
  | "experience"
  | "comments"
  | "security";

const ADMIN_SECTIONS: Array<{ id: AdminSectionId; number: string; label: string }> = [
  { id: "details", number: "01", label: "Details" },
  { id: "photo", number: "02", label: "Photo" },
  { id: "music", number: "03", label: "Music" },
  { id: "skills", number: "04", label: "Skills" },
  { id: "current-work", number: "05", label: "Current work" },
  { id: "experience", number: "06", label: "Experience" },
  { id: "comments", number: "07", label: "Comments" },
  { id: "security", number: "08", label: "Security" },
];

function adminSectionDomId(id: AdminSectionId) {
  return `admin-${id}`;
}

function isAdminUser(user: User | null) {
  return user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
}

function profileExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function profileUploadNonce() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function getPortfolioAssetPath(publicUrl: string | null) {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${PROFILE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function hasPasswordAuthentication(session: Session | null) {
  const token = session?.access_token;
  if (!token) return false;

  try {
    const payload = token.split(".")[1];
    if (!payload) return false;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const claims = JSON.parse(window.atob(padded)) as {
      amr?: Array<{ method?: string } | string>;
    };

    return (
      Array.isArray(claims.amr) &&
      claims.amr.some((item) =>
        typeof item === "string" ? item === "password" : item.method === "password",
      )
    );
  } catch {
    return false;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function AdminThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  function toggle() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("khert-theme", nextDark ? "dark" : "light");
  }

  return (
    <button className="icon-button" type="button" onClick={toggle} aria-label="Toggle color theme">
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

export function AdminPanel() {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [settings, setSettings] = useState<PortfolioSettings>(DEFAULT_PORTFOLIO_SETTINGS);
  const [experiences, setExperiences] = useState<PortfolioExperience[]>([]);
  const [musicTracks, setMusicTracks] = useState<PortfolioMusicTrack[]>([]);
  const [skills, setSkills] = useState<PortfolioSkill[]>([]);
  const [currentWork, setCurrentWork] = useState<PortfolioCurrentWorkItem[]>([]);
  const [portfolioStatus, setPortfolioStatus] = useState<PortfolioStatus>(EMPTY_PORTFOLIO_STATUS);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSectionId>("details");
  const [collapsedAdminSections, setCollapsedAdminSections] = useState<Set<AdminSectionId>>(
    () => new Set(),
  );

  const [newExperience, setNewExperience] = useState({
    company: "",
    role: "",
    description: "",
    note: "",
  });

  const [newMusic, setNewMusic] = useState({
    title: "",
    youtubeUrl: "",
    sortOrder: 0,
  });

  const [newSkill, setNewSkill] = useState({
    name: "",
    description: "",
    sortOrder: 0,
  });

  const [newCurrentWorkBody, setNewCurrentWorkBody] = useState("");

  const adminEmailMatch = isAdminUser(user);
  const passwordSession = hasPasswordAuthentication(session);
  const admin = adminEmailMatch && passwordSession;

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
      setAuthReady(true);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const loadAdminData = useCallback(async () => {
    if (!supabase || !admin) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const [
      nextSettings,
      nextExperiences,
      nextMusicTracks,
      nextSkills,
      nextCurrentWork,
      nextPortfolioStatus,
      commentsResult,
    ] = await Promise.all([
      fetchPortfolioSettings(),
      fetchPortfolioExperiences(),
      fetchPortfolioMusicTracks({ includeDisabled: true }),
      fetchPortfolioSkills({ includeDisabled: true }),
      fetchPortfolioCurrentWork({ includeHidden: true, limit: 100 }),
      fetchPortfolioStatus(),
      supabase
        .from("portfolio_comments")
        .select("id, author_name, body, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setSettings(nextSettings);
    setExperiences(nextExperiences.filter((item) => !item.id.startsWith("default-")));
    setMusicTracks(nextMusicTracks);
    setSkills(nextSkills.filter((item) => !item.id.startsWith("default-")));
    setCurrentWork(nextCurrentWork);
    setPortfolioStatus(nextPortfolioStatus);

    if (commentsResult.error) {
      setPanelMessage("Portfolio content loaded, but comments could not be loaded.");
    } else {
      setComments((commentsResult.data ?? []) as AdminComment[]);
    }

    setPanelBusy(false);
  }, [admin, supabase]);

  useEffect(() => {
    if (admin) {
      void loadAdminData();
    }
  }, [admin, loadAdminData]);

  useEffect(() => {
    if (!admin || typeof IntersectionObserver === "undefined") return;

    const sections = ADMIN_SECTIONS.map((item) =>
      document.getElementById(adminSectionDomId(item.id)),
    ).filter((item): item is HTMLElement => Boolean(item));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const nextSection = visible?.target.getAttribute("data-admin-section") as
          | AdminSectionId
          | null
          | undefined;

        if (nextSection && ADMIN_SECTIONS.some((item) => item.id === nextSection)) {
          setActiveAdminSection(nextSection);
        }
      },
      {
        rootMargin: "-18% 0px -68% 0px",
        threshold: [0, 0.01, 0.15, 0.35],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [admin]);

  function isAdminSectionCollapsed(id: AdminSectionId) {
    return collapsedAdminSections.has(id);
  }

  function toggleAdminSection(id: AdminSectionId) {
    setCollapsedAdminSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllAdminSections(collapsed: boolean) {
    setCollapsedAdminSections(
      collapsed ? new Set(ADMIN_SECTIONS.map((section) => section.id)) : new Set(),
    );
  }

  function jumpToAdminSection(id: AdminSectionId) {
    setActiveAdminSection(id);
    setCollapsedAdminSections((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });

    window.requestAnimationFrame(() => {
      const section = document.getElementById(adminSectionDomId(id));
      if (!section) return;

      section.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || authBusy || !password) return;

    setAuthBusy(true);
    setAuthMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });

    if (error) {
      setAuthMessage("Admin sign-in failed. Check the password or reset it.");
    } else if (!isAdminUser(data.user)) {
      await supabase.auth.signOut();
      setAuthMessage("This account is not authorized for the portfolio admin panel.");
    } else {
      setPassword("");
    }

    setAuthBusy(false);
  }

  async function bootstrapWithGoogle() {
    if (!supabase || authBusy) return;

    setAuthBusy(true);
    setAuthMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/admin`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setAuthMessage("Google sign-in could not be started.");
      setAuthBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (!supabase || authBusy) return;

    setAuthBusy(true);
    setAuthMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL, {
      redirectTo: `${window.location.origin}/admin`,
    });

    setAuthMessage(
      error
        ? "The password reset email could not be requested."
        : "If the admin account exists, a password reset link has been sent.",
    );
    setAuthBusy(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !adminEmailMatch || authBusy) return;

    if (newPassword.length < 8) {
      setAuthMessage("Use a password with at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthMessage("The new passwords do not match.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setAuthMessage("The password could not be updated.");
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setRecoveryMode(false);

      if (!passwordSession) {
        await supabase.auth.signOut();
        setAuthMessage("Admin password set. Sign in again using the password to enter the admin panel.");
      } else {
        setAuthMessage("Admin password updated.");
      }
    }

    setAuthBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    setAuthBusy(true);
    await supabase.auth.signOut();
    setAuthBusy(false);
    setPanelMessage(null);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !admin || panelBusy) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const payload = {
      display_name: settings.display_name.trim(),
      eyebrow: settings.eyebrow.trim(),
      role_primary: settings.role_primary.trim(),
      role_secondary: settings.role_secondary.trim(),
      hero_copy: settings.hero_copy.trim(),
      about_primary: settings.about_primary.trim(),
      about_secondary: settings.about_secondary.trim(),
      contact_intro: settings.contact_intro.trim(),
      contact_email: settings.contact_email.trim(),
      contact_phone: settings.contact_phone.trim(),
      contact_phone_href: settings.contact_phone_href.trim(),
      profile_image_url: settings.profile_image_url,
      updated_at: new Date().toISOString(),
    };

    const [settingsResult, statusResult] = await Promise.all([
      supabase.from("portfolio_settings").update(payload).eq("id", 1),
      supabase.from("portfolio_status").upsert(
        {
          id: 1,
          status_text: portfolioStatus.status_text.trim(),
          is_enabled: portfolioStatus.is_enabled && Boolean(portfolioStatus.status_text.trim()),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      ),
    ]);

    const error = settingsResult.error || statusResult.error;
    setPanelMessage(error ? "Portfolio details could not be saved." : "Portfolio details saved.");
    if (!error) {
      setPortfolioStatus((current) => ({
        ...current,
        status_text: current.status_text.trim(),
        is_enabled: current.is_enabled && Boolean(current.status_text.trim()),
      }));
    }
    setPanelBusy(false);
  }

  function updateExperienceLocal<K extends keyof PortfolioExperience>(
    id: string,
    field: K,
    value: PortfolioExperience[K],
  ) {
    setExperiences((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  async function saveExperience(item: PortfolioExperience) {
    if (!supabase || !admin || panelBusy) return;

    if (!item.company.trim() || !item.role.trim() || !item.description.trim()) {
      setPanelMessage("Company, role, and description are required.");
      return;
    }

    setPanelBusy(true);
    setPanelMessage(null);

    const { error } = await supabase
      .from("portfolio_experiences")
      .update({
        company: item.company.trim(),
        role: item.role.trim(),
        description: item.description.trim(),
        note: item.note?.trim() || null,
        sort_order: Number(item.sort_order) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    setPanelMessage(error ? "Experience could not be updated." : "Experience updated.");
    setPanelBusy(false);
  }

  async function addExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !admin || panelBusy) return;

    if (
      !newExperience.company.trim() ||
      !newExperience.role.trim() ||
      !newExperience.description.trim()
    ) {
      setPanelMessage("Company, role, and description are required.");
      return;
    }

    const nextOrder =
      experiences.reduce((highest, item) => Math.max(highest, Number(item.sort_order) || 0), 0) + 10;

    setPanelBusy(true);
    setPanelMessage(null);

    const { data, error } = await supabase
      .from("portfolio_experiences")
      .insert({
        company: newExperience.company.trim(),
        role: newExperience.role.trim(),
        description: newExperience.description.trim(),
        note: newExperience.note.trim() || null,
        sort_order: nextOrder,
      })
      .select("id, company, role, description, note, sort_order")
      .single();

    if (error) {
      setPanelMessage("Experience could not be added.");
    } else {
      setExperiences((items) => [...items, data as PortfolioExperience]);
      setNewExperience({ company: "", role: "", description: "", note: "" });
      setPanelMessage("Experience added.");
    }

    setPanelBusy(false);
  }

  async function deleteExperience(id: string) {
    if (!supabase || !admin || panelBusy) return;
    if (!window.confirm("Delete this work experience?")) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const { error } = await supabase.from("portfolio_experiences").delete().eq("id", id);

    if (error) {
      setPanelMessage("Experience could not be deleted.");
    } else {
      setExperiences((items) => items.filter((item) => item.id !== id));
      setPanelMessage("Experience deleted.");
    }

    setPanelBusy(false);
  }

  async function deleteComment(id: number | string) {
    if (!supabase || !admin || panelBusy) return;
    if (!window.confirm("Delete this visitor comment?")) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const { error } = await supabase.from("portfolio_comments").delete().eq("id", id);

    if (error) {
      setPanelMessage("Comment could not be deleted.");
    } else {
      setComments((items) => items.filter((item) => item.id !== id));
      setPanelMessage("Comment deleted.");
    }

    setPanelBusy(false);
  }

  function updateMusicLocal<K extends keyof PortfolioMusicTrack>(
    id: string,
    field: K,
    value: PortfolioMusicTrack[K],
  ) {
    setMusicTracks((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  async function addMusicTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !admin || panelBusy) return;

    const videoId = extractYouTubeVideoId(newMusic.youtubeUrl);
    if (!videoId) {
      setPanelMessage("Enter a valid YouTube video URL.");
      return;
    }

    const nextOrder = musicTracks.length
      ? Math.max(...musicTracks.map((item) => Number(item.sort_order) || 0)) + 10
      : 10;

    setPanelBusy(true);
    setPanelMessage(null);

    const { data, error } = await supabase
      .from("portfolio_music")
      .insert({
        title: newMusic.title.trim() || `Track ${musicTracks.length + 1}`,
        youtube_url: canonicalYouTubeUrl(videoId),
        youtube_video_id: videoId,
        is_enabled: true,
        sort_order: Number(newMusic.sortOrder) || nextOrder,
      })
      .select("id, title, youtube_url, youtube_video_id, is_enabled, sort_order, created_at, updated_at")
      .single();

    if (error || !data) {
      setPanelMessage(
        error?.code === "23505"
          ? "That YouTube video is already in the portfolio music list."
          : "The YouTube track could not be added.",
      );
    } else {
      setMusicTracks((items) => [...items, data as PortfolioMusicTrack]);
      setNewMusic({ title: "", youtubeUrl: "", sortOrder: 0 });
      setPanelMessage("YouTube track added.");
    }

    setPanelBusy(false);
  }

  async function saveMusicTrack(item: PortfolioMusicTrack) {
    if (!supabase || !admin || panelBusy) return;

    const videoId = extractYouTubeVideoId(item.youtube_url);
    if (!videoId) {
      setPanelMessage("Enter a valid YouTube video URL before saving.");
      return;
    }

    setPanelBusy(true);
    setPanelMessage(null);

    const payload = {
      title: item.title.trim() || "Profile music",
      youtube_url: canonicalYouTubeUrl(videoId),
      youtube_video_id: videoId,
      is_enabled: Boolean(item.is_enabled),
      sort_order: Number(item.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("portfolio_music").update(payload).eq("id", item.id);

    if (error) {
      setPanelMessage(
        error.code === "23505"
          ? "That YouTube video is already in the music list."
          : "The YouTube track could not be saved.",
      );
    } else {
      setMusicTracks((items) =>
        items.map((track) => (track.id === item.id ? { ...track, ...payload } : track)),
      );
      setPanelMessage("YouTube track saved.");
    }

    setPanelBusy(false);
  }

  async function deleteMusicTrack(id: string) {
    if (!supabase || !admin || panelBusy) return;
    if (!window.confirm("Remove this YouTube track from the portfolio?")) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const { error } = await supabase.from("portfolio_music").delete().eq("id", id);

    if (error) {
      setPanelMessage("The YouTube track could not be removed.");
    } else {
      setMusicTracks((items) => items.filter((item) => item.id !== id));
      setPanelMessage("YouTube track removed.");
    }

    setPanelBusy(false);
  }

  function updateSkillLocal<K extends keyof PortfolioSkill>(
    id: string,
    field: K,
    value: PortfolioSkill[K],
  ) {
    setSkills((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  async function addSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !admin || panelBusy) return;

    const name = newSkill.name.trim();
    const description = newSkill.description.trim();
    if (!name) {
      setPanelMessage("Enter a skill name.");
      return;
    }

    if (!description) {
      setPanelMessage("Add a short description for the skill.");
      return;
    }

    if (skills.length >= 30) {
      setPanelMessage("The interactive graph is limited to 30 skills for smooth performance.");
      return;
    }

    const nextOrder = skills.length
      ? Math.max(...skills.map((item) => Number(item.sort_order) || 0)) + 10
      : 10;

    setPanelBusy(true);
    setPanelMessage(null);

    const { data, error } = await supabase
      .from("portfolio_skills")
      .insert({
        name,
        description,
        sort_order: Number(newSkill.sortOrder) || nextOrder,
        is_enabled: true,
      })
      .select("id, name, description, sort_order, is_enabled, created_at, updated_at")
      .single();

    if (error || !data) {
      setPanelMessage(
        error?.code === "23505"
          ? "That skill is already in the portfolio."
          : "The skill could not be added.",
      );
    } else {
      setSkills((items) => [...items, data as PortfolioSkill]);
      setNewSkill({ name: "", description: "", sortOrder: 0 });
      setPanelMessage("Skill added.");
    }

    setPanelBusy(false);
  }

  async function saveSkill(item: PortfolioSkill) {
    if (!supabase || !admin || panelBusy) return;

    const name = item.name.trim();
    const description = item.description.trim();
    if (!name) {
      setPanelMessage("Skill names cannot be empty.");
      return;
    }

    if (!description) {
      setPanelMessage("Skill descriptions cannot be empty.");
      return;
    }

    setPanelBusy(true);
    setPanelMessage(null);

    const payload = {
      name,
      description,
      sort_order: Number(item.sort_order) || 0,
      is_enabled: Boolean(item.is_enabled),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("portfolio_skills").update(payload).eq("id", item.id);

    if (error) {
      setPanelMessage(
        error.code === "23505" ? "That skill already exists." : "The skill could not be saved.",
      );
    } else {
      setSkills((items) =>
        items.map((skill) => (skill.id === item.id ? { ...skill, ...payload } : skill)),
      );
      setPanelMessage("Skill saved.");
    }

    setPanelBusy(false);
  }

  async function deleteSkill(id: string) {
    if (!supabase || !admin || panelBusy) return;
    if (!window.confirm("Remove this skill from the portfolio?")) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const { error } = await supabase.from("portfolio_skills").delete().eq("id", id);

    if (error) {
      setPanelMessage("The skill could not be removed.");
    } else {
      setSkills((items) => items.filter((item) => item.id !== id));
      setPanelMessage("Skill removed.");
    }

    setPanelBusy(false);
  }

  function updateCurrentWorkLocal(id: string, field: "body" | "is_visible", value: string | boolean) {
    setCurrentWork((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  async function addCurrentWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !admin || panelBusy) return;

    const body = newCurrentWorkBody.trim();
    if (!body) {
      setPanelMessage("Write an update before publishing.");
      return;
    }

    setPanelBusy(true);
    setPanelMessage(null);
    const { data, error } = await supabase
      .from("portfolio_current_work")
      .insert({ body, is_visible: true })
      .select("id, body, is_visible, created_at, updated_at")
      .single();

    if (error || !data) {
      setPanelMessage("The current work update could not be published.");
    } else {
      setCurrentWork((items) => [data as PortfolioCurrentWorkItem, ...items]);
      setNewCurrentWorkBody("");
      setPanelMessage("Current work update published.");
    }
    setPanelBusy(false);
  }

  async function saveCurrentWork(item: PortfolioCurrentWorkItem) {
    if (!supabase || !admin || panelBusy) return;
    const body = item.body.trim();
    if (!body) {
      setPanelMessage("Current work messages cannot be empty.");
      return;
    }

    setPanelBusy(true);
    setPanelMessage(null);
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("portfolio_current_work")
      .update({ body, is_visible: Boolean(item.is_visible), updated_at: updatedAt })
      .eq("id", item.id);

    if (error) {
      setPanelMessage("The current work update could not be saved.");
    } else {
      setCurrentWork((items) =>
        items.map((entry) => entry.id === item.id ? { ...entry, body, is_visible: Boolean(item.is_visible), updated_at: updatedAt } : entry),
      );
      setPanelMessage("Current work update saved.");
    }
    setPanelBusy(false);
  }

  async function deleteCurrentWork(id: string) {
    if (!supabase || !admin || panelBusy) return;
    if (!window.confirm("Delete this current work update?")) return;

    setPanelBusy(true);
    setPanelMessage(null);
    const { error } = await supabase.from("portfolio_current_work").delete().eq("id", id);
    if (error) {
      setPanelMessage("The current work update could not be deleted.");
    } else {
      setCurrentWork((items) => items.filter((item) => item.id !== id));
      setPanelMessage("Current work update deleted.");
    }
    setPanelBusy(false);
  }

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !supabase || !admin || panelBusy) return;

    if (!ACCEPTED_PROFILE_TYPES.has(file.type)) {
      setPanelMessage("Use a JPG, PNG, or WebP profile image.");
      return;
    }

    if (file.size > MAX_PROFILE_BYTES) {
      setPanelMessage("Profile images are limited to 2 MB.");
      return;
    }

    setPanelBusy(true);
    setPanelMessage(null);

    const previousAssetPath = getPortfolioAssetPath(settings.profile_image_url);
    const objectPath = `profile/profile-${Date.now()}-${profileUploadNonce()}.${profileExtension(file.type)}`;

    const { error: uploadError } = await supabase.storage.from(PROFILE_BUCKET).upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      setPanelMessage("The profile image could not be uploaded.");
      setPanelBusy(false);
      return;
    }

    const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(objectPath);
    const nextProfileUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("portfolio_settings")
      .update({
        profile_image_url: nextProfileUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (updateError) {
      await supabase.storage.from(PROFILE_BUCKET).remove([objectPath]);
      setPanelMessage("The image uploaded, but the portfolio photo could not be updated.");
    } else {
      setSettings((current) => ({ ...current, profile_image_url: nextProfileUrl }));

      if (previousAssetPath && previousAssetPath !== objectPath) {
        void supabase.storage.from(PROFILE_BUCKET).remove([previousAssetPath]);
      }

      setPanelMessage("Profile image updated.");
    }

    setPanelBusy(false);
  }

  async function useBundledPhoto() {
    if (!supabase || !admin || panelBusy) return;

    setPanelBusy(true);
    setPanelMessage(null);

    const previousAssetPath = getPortfolioAssetPath(settings.profile_image_url);

    const { error } = await supabase
      .from("portfolio_settings")
      .update({
        profile_image_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      setPanelMessage("The profile image could not be reset.");
    } else {
      setSettings((current) => ({ ...current, profile_image_url: null }));

      if (previousAssetPath) {
        void supabase.storage.from(PROFILE_BUCKET).remove([previousAssetPath]);
      }

      setPanelMessage("The bundled profile image is active.");
    }

    setPanelBusy(false);
  }

  const previewPhoto = settings.profile_image_url || "/profile.jpg";
  const sortedExperiences = useMemo(
    () => [...experiences].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    [experiences],
  );
  const sortedMusicTracks = useMemo(
    () => [...musicTracks].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    [musicTracks],
  );
  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    [skills],
  );

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="admin-shell">
        <a className="admin-back-link" href="/">
          <ArrowLeft aria-hidden="true" /> Portfolio
        </a>
        <div className="admin-state">Supabase is not configured for the admin panel.</div>
      </main>
    );
  }

  if (!authReady) {
    return (
      <main className="admin-shell">
        <div className="admin-state">
          <LoaderCircle className="spin" aria-hidden="true" />
          Loading admin session
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="admin-shell admin-auth-shell">
        <div className="admin-auth-card">
          <div className="admin-auth-topline">
            <a className="admin-back-link" href="/">
              <ArrowLeft aria-hidden="true" /> Portfolio
            </a>
            <AdminThemeToggle />
          </div>

          <p className="admin-kicker">Portfolio administration</p>
          <h1>Admin panel</h1>
          <p className="admin-auth-copy">
            Sign in with the authorized administrator account to manage public portfolio content.
          </p>

          <form className="admin-form" onSubmit={login}>
            <label>
              Admin email
              <input type="email" value={ADMIN_EMAIL} readOnly autoComplete="username" />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button button-primary" type="submit" disabled={authBusy || !password}>
              {authBusy ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
              Sign in
            </button>
          </form>

          <div className="admin-auth-actions">
            <button className="admin-text-button" type="button" onClick={requestPasswordReset} disabled={authBusy}>
              Forgot / reset password
            </button>
            <button className="admin-text-button" type="button" onClick={bootstrapWithGoogle} disabled={authBusy}>
              Initialize with Google
            </button>
          </div>

          {authMessage ? <p className="admin-message" role="status">{authMessage}</p> : null}
        </div>
      </main>
    );
  }

  if (!adminEmailMatch) {
    return (
      <main className="admin-shell admin-auth-shell">
        <div className="admin-auth-card">
          <a className="admin-back-link" href="/">
            <ArrowLeft aria-hidden="true" /> Portfolio
          </a>
          <p className="admin-kicker">Access denied</p>
          <h1>Unauthorized account</h1>
          <p className="admin-auth-copy">This signed-in account is not the portfolio administrator.</p>
          <button className="button button-outline" type="button" onClick={signOut} disabled={authBusy}>
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (!passwordSession) {
    return (
      <main className="admin-shell admin-auth-shell">
        <div className="admin-auth-card">
          <div className="admin-auth-topline">
            <a className="admin-back-link" href="/">
              <ArrowLeft aria-hidden="true" /> Portfolio
            </a>
            <AdminThemeToggle />
          </div>

          <p className="admin-kicker">{recoveryMode ? "Password recovery" : "Admin initialization"}</p>
          <h1>Set admin password</h1>
          <p className="admin-auth-copy">
            The correct administrator email is authenticated. Set a password, then sign in again with
            email and password to unlock portfolio management.
          </p>

          <form className="admin-form admin-password-form" onSubmit={updatePassword}>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="button button-primary" type="submit" disabled={authBusy || !newPassword}>
              <KeyRound aria-hidden="true" />
              Set admin password
            </button>
          </form>

          <button className="admin-text-button admin-signout-link" type="button" onClick={signOut} disabled={authBusy}>
            Sign out
          </button>

          {authMessage ? <p className="admin-message" role="status">{authMessage}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <a className="admin-back-link" href="/">
            <ArrowLeft aria-hidden="true" /> Portfolio
          </a>
          <p className="admin-kicker">Authenticated administration</p>
          <h1>Portfolio admin</h1>
          <p className="admin-header-copy">Edit only the content you need. Drive studies remain managed by Google Drive.</p>
        </div>
        <div className="admin-header-actions">
          <AdminThemeToggle />
          <button className="button button-outline" type="button" onClick={signOut} disabled={authBusy}>
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-workspace-nav" aria-label="Admin sections">
        <div className="admin-workspace-links">
          {ADMIN_SECTIONS.map((section) => (
            <button
              className={`admin-workspace-link${activeAdminSection === section.id ? " is-active" : ""}`}
              type="button"
              key={section.id}
              onClick={() => jumpToAdminSection(section.id)}
              aria-current={activeAdminSection === section.id ? "location" : undefined}
            >
              <span>{section.number}</span>
              {section.label}
            </button>
          ))}
        </div>
        <div className="admin-workspace-tools" aria-label="Section display controls">
          <button className="admin-nav-action" type="button" onClick={() => setAllAdminSections(false)}>
            Expand all
          </button>
          <button className="admin-nav-action" type="button" onClick={() => setAllAdminSections(true)}>
            Collapse all
          </button>
        </div>
      </nav>

      {panelMessage ? <p className="admin-global-message" role="status">{panelMessage}</p> : null}
      {panelBusy ? (
        <div className="admin-progress" role="status">
          <LoaderCircle className="spin" aria-hidden="true" /> Saving changes
        </div>
      ) : null}

      <section
        className={`admin-section${isAdminSectionCollapsed("details") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("details")}
        data-admin-section="details"
      >
        <div className="admin-section-heading">
          <div>
            <span>01</span>
            <h2>Portfolio details</h2>
          </div>
          <p>Name, introduction, about text, and contact details.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("details")}
            aria-expanded={!isAdminSectionCollapsed("details")}
          >
            {isAdminSectionCollapsed("details") ? "Expand" : "Collapse"}
          </button>
        </div>

        <form className="admin-form admin-form-grid" onSubmit={saveSettings}>
          <label>
            Display name
            <input
              value={settings.display_name}
              onChange={(event) => setSettings((current) => ({ ...current, display_name: event.target.value }))}
              maxLength={100}
              required
            />
          </label>
          <label>
            Eyebrow
            <input
              value={settings.eyebrow}
              onChange={(event) => setSettings((current) => ({ ...current, eyebrow: event.target.value }))}
              maxLength={160}
            />
          </label>
          <label>
            Primary role
            <input
              value={settings.role_primary}
              onChange={(event) => setSettings((current) => ({ ...current, role_primary: event.target.value }))}
              maxLength={100}
              required
            />
          </label>
          <label>
            Secondary focus
            <input
              value={settings.role_secondary}
              onChange={(event) => setSettings((current) => ({ ...current, role_secondary: event.target.value }))}
              maxLength={120}
            />
          </label>

          <label className="admin-field-wide">
            Portfolio status badge
            <input
              value={portfolioStatus.status_text}
              onChange={(event) =>
                setPortfolioStatus((current) => ({ ...current, status_text: event.target.value.slice(0, 120) }))
              }
              maxLength={120}
              placeholder="Currently working on a new clinical study"
            />
          </label>

          <label className="admin-checkbox-label admin-field-wide">
            <input
              type="checkbox"
              checked={portfolioStatus.is_enabled}
              onChange={(event) =>
                setPortfolioStatus((current) => ({ ...current, is_enabled: event.target.checked }))
              }
            />
            <span>Show status badge on public portfolio</span>
          </label>

          <label className="admin-field-wide">
            Hero introduction
            <textarea
              value={settings.hero_copy}
              onChange={(event) => setSettings((current) => ({ ...current, hero_copy: event.target.value }))}
              rows={4}
              maxLength={1200}
              required
            />
          </label>

          <label className="admin-field-wide">
            About — paragraph 1
            <textarea
              value={settings.about_primary}
              onChange={(event) => setSettings((current) => ({ ...current, about_primary: event.target.value }))}
              rows={4}
              maxLength={1600}
              required
            />
          </label>

          <label className="admin-field-wide">
            About — paragraph 2
            <textarea
              value={settings.about_secondary}
              onChange={(event) => setSettings((current) => ({ ...current, about_secondary: event.target.value }))}
              rows={4}
              maxLength={1600}
            />
          </label>

          <label className="admin-field-wide">
            Contact introduction
            <textarea
              value={settings.contact_intro}
              onChange={(event) => setSettings((current) => ({ ...current, contact_intro: event.target.value }))}
              rows={3}
              maxLength={600}
            />
          </label>

          <label>
            Public email
            <input
              type="email"
              value={settings.contact_email}
              onChange={(event) => setSettings((current) => ({ ...current, contact_email: event.target.value }))}
              maxLength={320}
            />
          </label>

          <label>
            Phone shown on portfolio
            <input
              value={settings.contact_phone}
              onChange={(event) => setSettings((current) => ({ ...current, contact_phone: event.target.value }))}
              maxLength={40}
            />
          </label>

          <label className="admin-field-wide">
            Phone dial value
            <input
              value={settings.contact_phone_href}
              onChange={(event) => setSettings((current) => ({ ...current, contact_phone_href: event.target.value }))}
              maxLength={40}
              placeholder="+639307732588"
            />
          </label>

          <div className="admin-form-actions admin-field-wide">
            <button className="button button-primary" type="submit" disabled={panelBusy}>
              <Save aria-hidden="true" /> Save portfolio details
            </button>
          </div>
        </form>
      </section>

      <section
        className={`admin-section${isAdminSectionCollapsed("photo") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("photo")}
        data-admin-section="photo"
      >
        <div className="admin-section-heading">
          <div>
            <span>02</span>
            <h2>Profile photo</h2>
          </div>
          <p>JPG, PNG, or WebP. Maximum 2 MB.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("photo")}
            aria-expanded={!isAdminSectionCollapsed("photo")}
          >
            {isAdminSectionCollapsed("photo") ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className="admin-photo-editor">
          <img src={previewPhoto} alt="Current portfolio profile" />
          <div>
            <label className="button button-primary admin-upload-button">
              <ImagePlus aria-hidden="true" />
              Upload new photo
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProfilePhoto} />
            </label>
            <button className="button button-outline" type="button" onClick={useBundledPhoto} disabled={panelBusy}>
              Use bundled photo
            </button>
          </div>
        </div>
      </section>

      <section
        className={`admin-section${isAdminSectionCollapsed("music") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("music")}
        data-admin-section="music"
      >
        <div className="admin-section-heading">
          <div>
            <span>03</span>
            <h2>Profile music</h2>
          </div>
          <p>Optional YouTube tracks for the profile control. If no enabled tracks exist, the public play button disappears automatically.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("music")}
            aria-expanded={!isAdminSectionCollapsed("music")}
          >
            {isAdminSectionCollapsed("music") ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className="admin-music-note">
          The public site uses YouTube's standard visible embedded player. YouTube may show ads depending on the video and viewer.
        </div>

        <div className="admin-music-list">
          {sortedMusicTracks.map((track) => (
            <article className="admin-music-card" key={track.id}>
              <div className="admin-form admin-form-grid">
                <label>
                  Display title
                  <input
                    value={track.title}
                    onChange={(event) => updateMusicLocal(track.id, "title", event.target.value)}
                    maxLength={120}
                  />
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    value={track.sort_order}
                    onChange={(event) => updateMusicLocal(track.id, "sort_order", Number(event.target.value))}
                  />
                </label>
                <label className="admin-field-wide">
                  YouTube video URL
                  <input
                    type="url"
                    value={track.youtube_url}
                    onChange={(event) => updateMusicLocal(track.id, "youtube_url", event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </label>
                <label className="admin-checkbox-label admin-field-wide">
                  <input
                    type="checkbox"
                    checked={track.is_enabled}
                    onChange={(event) => updateMusicLocal(track.id, "is_enabled", event.target.checked)}
                  />
                  <span>Enabled on public portfolio</span>
                </label>
              </div>

              <div className="admin-card-actions">
                <button className="button button-primary" type="button" onClick={() => void saveMusicTrack(track)} disabled={panelBusy}>
                  <Save aria-hidden="true" /> Save
                </button>
                <button className="button button-outline admin-danger-button" type="button" onClick={() => void deleteMusicTrack(track.id)} disabled={panelBusy}>
                  <Trash2 aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="admin-new-experience admin-music-add" onSubmit={addMusicTrack}>
          <h3>Add YouTube track</h3>
          <div className="admin-form admin-form-grid">
            <label>
              Display title (optional)
              <input
                value={newMusic.title}
                onChange={(event) => setNewMusic((current) => ({ ...current, title: event.target.value }))}
                maxLength={120}
                placeholder="My profile music"
              />
            </label>
            <label>
              Display order (optional)
              <input
                type="number"
                value={newMusic.sortOrder || ""}
                onChange={(event) => setNewMusic((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
                placeholder="Auto"
              />
            </label>
            <label className="admin-field-wide">
              YouTube video URL
              <input
                type="url"
                value={newMusic.youtubeUrl}
                onChange={(event) => setNewMusic((current) => ({ ...current, youtubeUrl: event.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                required
              />
            </label>
          </div>
          <button className="button button-primary" type="submit" disabled={panelBusy || !newMusic.youtubeUrl.trim()}>
            <Plus aria-hidden="true" /> Add YouTube track
          </button>
        </form>
      </section>

      <section
        className={`admin-section${isAdminSectionCollapsed("skills") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("skills")}
        data-admin-section="skills"
      >
        <div className="admin-section-heading">
          <div>
            <span>04</span>
            <h2>Interactive skills</h2>
          </div>
          <p>Add, describe, rename, reorder, hide, or remove skills. Public visitors see only enabled skills.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("skills")}
            aria-expanded={!isAdminSectionCollapsed("skills")}
          >
            {isAdminSectionCollapsed("skills") ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className="admin-skills-note">
          The public graph is capped at 30 nodes and pauses animation when off-screen to keep it responsive. Skill descriptions appear when a visitor hovers, touches, or drags a node.
        </div>

        <div className="admin-skills-list">
          {sortedSkills.map((skill) => (
            <article className="admin-skill-card" key={skill.id}>
              <div className="admin-form admin-skill-grid">
                <label>
                  Skill name
                  <input
                    value={skill.name}
                    onChange={(event) => updateSkillLocal(skill.id, "name", event.target.value)}
                    maxLength={64}
                    required
                  />
                </label>
                <label className="admin-field-wide">
                  Skill description
                  <textarea
                    value={skill.description}
                    onChange={(event) => updateSkillLocal(skill.id, "description", event.target.value)}
                    rows={3}
                    maxLength={320}
                    placeholder="Briefly explain what this skill means in your work."
                    required
                  />
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    value={skill.sort_order}
                    onChange={(event) => updateSkillLocal(skill.id, "sort_order", Number(event.target.value))}
                  />
                </label>
                <label className="admin-checkbox-label admin-skill-enabled">
                  <input
                    type="checkbox"
                    checked={skill.is_enabled}
                    onChange={(event) => updateSkillLocal(skill.id, "is_enabled", event.target.checked)}
                  />
                  <span>Visible on public portfolio</span>
                </label>
              </div>

              <div className="admin-card-actions">
                <button className="button button-primary" type="button" onClick={() => void saveSkill(skill)} disabled={panelBusy}>
                  <Save aria-hidden="true" /> Save
                </button>
                <button className="button button-outline admin-danger-button" type="button" onClick={() => void deleteSkill(skill.id)} disabled={panelBusy}>
                  <Trash2 aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="admin-new-experience admin-skill-add" onSubmit={addSkill}>
          <h3>Add skill</h3>
          <div className="admin-form admin-form-grid">
            <label>
              Skill name
              <input
                value={newSkill.name}
                onChange={(event) => setNewSkill((current) => ({ ...current, name: event.target.value }))}
                maxLength={64}
                placeholder="e.g. Technical Support"
                required
              />
            </label>
            <label className="admin-field-wide">
              Skill description
              <textarea
                value={newSkill.description}
                onChange={(event) => setNewSkill((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                maxLength={320}
                placeholder="Briefly explain what this skill means in your work."
                required
              />
            </label>
            <label>
              Display order (optional)
              <input
                type="number"
                value={newSkill.sortOrder || ""}
                onChange={(event) => setNewSkill((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
                placeholder="Auto"
              />
            </label>
          </div>
          <button className="button button-primary" type="submit" disabled={panelBusy || !newSkill.name.trim() || !newSkill.description.trim() || skills.length >= 30}>
            <Plus aria-hidden="true" /> Add skill
          </button>
        </form>
      </section>

      <section
        className={`admin-section admin-current-work-section${isAdminSectionCollapsed("current-work") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("current-work")}
        data-admin-section="current-work"
      >
        <div className="admin-section-heading">
          <div>
            <span>05</span>
            <h2>Currently working on</h2>
          </div>
          <p>Publish short public updates without opening a separate editor.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("current-work")}
            aria-expanded={!isAdminSectionCollapsed("current-work")}
          >
            {isAdminSectionCollapsed("current-work") ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className="admin-current-work-board">
          <form className="admin-current-work-composer" onSubmit={addCurrentWork}>
            <label>
              New update
              <textarea
                value={newCurrentWorkBody}
                onChange={(event) => setNewCurrentWorkBody(event.target.value.slice(0, 600))}
                rows={3}
                maxLength={600}
                placeholder="Share what you are currently working on..."
                required
              />
            </label>
            <div className="admin-current-work-composer-actions">
              <span>{newCurrentWorkBody.length}/600</span>
              <button className="button button-primary" type="submit" disabled={panelBusy || !newCurrentWorkBody.trim()}>
                <Plus aria-hidden="true" /> Publish update
              </button>
            </div>
          </form>

          <div className="admin-current-work-list">
            {currentWork.length ? currentWork.map((item) => (
              <article className="admin-current-work-card" key={item.id}>
                <div className="admin-current-work-meta">
                  <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={item.is_visible}
                      onChange={(event) => updateCurrentWorkLocal(item.id, "is_visible", event.target.checked)}
                    />
                    <span>Visible publicly</span>
                  </label>
                </div>
                <textarea
                  value={item.body}
                  onChange={(event) => updateCurrentWorkLocal(item.id, "body", event.target.value.slice(0, 600))}
                  rows={3}
                  maxLength={600}
                />
                <div className="admin-card-actions">
                  <button className="button button-primary" type="button" onClick={() => void saveCurrentWork(item)} disabled={panelBusy || !item.body.trim()}>
                    <Save aria-hidden="true" /> Save
                  </button>
                  <button className="button button-outline admin-danger-button" type="button" onClick={() => void deleteCurrentWork(item.id)} disabled={panelBusy}>
                    <Trash2 aria-hidden="true" /> Delete
                  </button>
                </div>
              </article>
            )) : (
              <div className="admin-state">No current work updates yet.</div>
            )}
          </div>
        </div>
      </section>

      <section
        className={`admin-section${isAdminSectionCollapsed("experience") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("experience")}
        data-admin-section="experience"
      >
        <div className="admin-section-heading">
          <div>
            <span>06</span>
            <h2>Work experience</h2>
          </div>
          <p>Add, edit, reorder numerically, or remove entries.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("experience")}
            aria-expanded={!isAdminSectionCollapsed("experience")}
          >
            {isAdminSectionCollapsed("experience") ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className="admin-experience-list">
          {sortedExperiences.map((item) => (
            <article className="admin-experience-card" key={item.id}>
              <div className="admin-form admin-form-grid">
                <label>
                  Company
                  <input value={item.company} onChange={(event) => updateExperienceLocal(item.id, "company", event.target.value)} />
                </label>
                <label>
                  Role
                  <input value={item.role} onChange={(event) => updateExperienceLocal(item.id, "role", event.target.value)} />
                </label>
                <label className="admin-field-wide">
                  Description
                  <textarea
                    value={item.description}
                    onChange={(event) => updateExperienceLocal(item.id, "description", event.target.value)}
                    rows={4}
                    maxLength={1800}
                  />
                </label>
                <label className="admin-field-wide">
                  Additional note
                  <textarea
                    value={item.note ?? ""}
                    onChange={(event) => updateExperienceLocal(item.id, "note", event.target.value)}
                    rows={3}
                    maxLength={1200}
                  />
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    value={item.sort_order}
                    onChange={(event) => updateExperienceLocal(item.id, "sort_order", Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="admin-card-actions">
                <button className="button button-primary" type="button" onClick={() => void saveExperience(item)} disabled={panelBusy}>
                  <Save aria-hidden="true" /> Save
                </button>
                <button className="button button-outline admin-danger-button" type="button" onClick={() => void deleteExperience(item.id)} disabled={panelBusy}>
                  <Trash2 aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>

        <form className="admin-new-experience" onSubmit={addExperience}>
          <h3>Add experience</h3>
          <div className="admin-form admin-form-grid">
            <label>
              Company
              <input
                value={newExperience.company}
                onChange={(event) => setNewExperience((current) => ({ ...current, company: event.target.value }))}
                required
              />
            </label>
            <label>
              Role
              <input
                value={newExperience.role}
                onChange={(event) => setNewExperience((current) => ({ ...current, role: event.target.value }))}
                required
              />
            </label>
            <label className="admin-field-wide">
              Description
              <textarea
                value={newExperience.description}
                onChange={(event) => setNewExperience((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                required
              />
            </label>
            <label className="admin-field-wide">
              Additional note
              <textarea
                value={newExperience.note}
                onChange={(event) => setNewExperience((current) => ({ ...current, note: event.target.value }))}
                rows={3}
              />
            </label>
          </div>
          <button className="button button-primary" type="submit" disabled={panelBusy}>
            <Plus aria-hidden="true" /> Add experience
          </button>
        </form>
      </section>

      <section
        className={`admin-section${isAdminSectionCollapsed("comments") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("comments")}
        data-admin-section="comments"
      >
        <div className="admin-section-heading">
          <div>
            <span>07</span>
            <h2>Visitor comments</h2>
          </div>
          <p>Newest active comments. Delete only when moderation is needed.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("comments")}
            aria-expanded={!isAdminSectionCollapsed("comments")}
          >
            {isAdminSectionCollapsed("comments") ? "Expand" : "Collapse"}
          </button>
        </div>

        <div className="admin-comment-list">
          {comments.length ? (
            comments.map((comment) => (
              <article className="admin-comment-item" key={comment.id}>
                <div>
                  <div className="admin-comment-meta">
                    <strong>{comment.author_name}</strong>
                    <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>
                  </div>
                  <p>{comment.body}</p>
                </div>
                <button
                  className="icon-button admin-delete-icon"
                  type="button"
                  onClick={() => void deleteComment(comment.id)}
                  disabled={panelBusy}
                  aria-label={`Delete comment by ${comment.author_name}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </article>
            ))
          ) : (
            <div className="admin-state">No active visitor comments.</div>
          )}
        </div>
      </section>

      <section
        className={`admin-section${isAdminSectionCollapsed("security") ? " is-collapsed" : ""}`}
        id={adminSectionDomId("security")}
        data-admin-section="security"
      >
        <div className="admin-section-heading">
          <div>
            <span>08</span>
            <h2>Admin security</h2>
          </div>
          <p>Set or change the password attached to the authorized Supabase account.</p>
          <button
            className="admin-section-toggle"
            type="button"
            onClick={() => toggleAdminSection("security")}
            aria-expanded={!isAdminSectionCollapsed("security")}
          >
            {isAdminSectionCollapsed("security") ? "Expand" : "Collapse"}
          </button>
        </div>

        <form className="admin-form admin-password-form" onSubmit={updatePassword}>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={authBusy || !newPassword}>
            <KeyRound aria-hidden="true" />
            {recoveryMode ? "Set recovered password" : "Change password"}
          </button>
        </form>

        {authMessage ? <p className="admin-message" role="status">{authMessage}</p> : null}
      </section>
    </main>
  );
}
