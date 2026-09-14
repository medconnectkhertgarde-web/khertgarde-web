import { useEffect, useState } from "react";
import { ArrowDown, Mail, Menu, Moon, Phone, Sun, X } from "lucide-react";

import { ClinicalStudies } from "@/components/ClinicalStudies";
import { Comments } from "@/components/Comments";
import {
  DEFAULT_EXPERIENCES,
  DEFAULT_PORTFOLIO_SETTINGS,
  fetchPortfolioExperiences,
  fetchPortfolioSettings,
  normalizePhoneHref,
  type PortfolioExperience,
  type PortfolioSettings,
} from "@/lib/portfolio-content";

const navItems = [
  ["About", "about"],
  ["Experience", "experience"],
  ["Clinical studies", "clinical-studies"],
  ["Contact", "contact"],
  ["Comments", "comments"],
] as const;

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("khert-theme", nextDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

function Header({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="#top" className="brand">
          {displayName}
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(([label, id]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
          <ThemeToggle />
        </nav>

        <div className="mobile-controls">
          <ThemeToggle />
          <button
            type="button"
            className="icon-button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close navigation" : "Open navigation"}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function ProfilePhoto({
  name,
  src,
  resolved,
}: {
  name: string;
  src: string | null;
  resolved: boolean;
}) {
  const imageSource = resolved ? src || "/profile.jpg" : null;
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    if (!imageSource) return;

    let active = true;
    const preload = new Image();

    preload.onload = () => {
      if (!active) return;
      setFailedSource(null);
      setLoadedSource(imageSource);
    };

    preload.onerror = () => {
      if (!active) return;
      setLoadedSource(null);
      setFailedSource(imageSource);
    };

    preload.src = imageSource;

    return () => {
      active = false;
    };
  }, [imageSource]);

  const ready = Boolean(imageSource && loadedSource === imageSource);
  const failed = Boolean(imageSource && failedSource === imageSource);

  return (
    <div className={`profile-frame${ready ? " is-ready" : " is-loading"}`}>
      <div className="profile-frame-inner">
        {ready && imageSource ? (
          <img
            src={imageSource}
            alt={name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : failed ? (
          <div className="profile-image-state" role="img" aria-label={`${name} profile photo unavailable`}>
            <span>Profile photo unavailable</span>
          </div>
        ) : (
          <div className="profile-image-state profile-image-loading" aria-hidden="true">
            <span>Loading profile</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Hero({ settings, settingsResolved }: { settings: PortfolioSettings; settingsResolved: boolean }) {
  return (
    <section id="top" className="hero">
      <div className="hero-grid">
        <div>
          <p className="eyebrow">{settings.eyebrow}</p>
          <h1>{settings.display_name}</h1>
          <div className="hero-role">
            <span>{settings.role_primary}</span>
            <span aria-hidden="true">/</span>
            <span>{settings.role_secondary}</span>
          </div>
          <p className="hero-copy">{settings.hero_copy}</p>
        </div>

        <ProfilePhoto name={settings.display_name} src={settings.profile_image_url} resolved={settingsResolved} />
      </div>

      <a href="#about" className="continue-link">
        Continue <ArrowDown aria-hidden="true" />
      </a>
    </section>
  );
}

function SectionHeading({ number, children, id }: { number: string; children: string; id: string }) {
  return (
    <h2 id={id} className="section-label">
      {number} — {children}
    </h2>
  );
}

function About({ settings }: { settings: PortfolioSettings }) {
  return (
    <section id="about" className="section split-section" aria-labelledby="about-heading">
      <SectionHeading number="01" id="about-heading">
        About
      </SectionHeading>
      <div className="body-copy">
        <p>{settings.about_primary}</p>
        {settings.about_secondary.trim() ? <p>{settings.about_secondary}</p> : null}
      </div>
    </section>
  );
}

function Experience({ experiences }: { experiences: PortfolioExperience[] }) {
  return (
    <section id="experience" className="section" aria-labelledby="experience-heading">
      <SectionHeading number="02" id="experience-heading">
        Experience
      </SectionHeading>

      <div className="experience-list">
        {experiences.map((item, index) => (
          <article key={item.id} className="experience-item">
            <span className="experience-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{item.company}</h3>
              <p className="experience-role">{item.role}</p>
            </div>
            <div className="experience-description">
              <p>{item.description}</p>
              {item.note?.trim() ? <p className="experience-note">{item.note}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Contact({ settings }: { settings: PortfolioSettings }) {
  const phoneHref = normalizePhoneHref(settings.contact_phone_href || settings.contact_phone);

  return (
    <section id="contact" className="section split-section contact-section" aria-labelledby="contact-heading">
      <SectionHeading number="04" id="contact-heading">
        Contact
      </SectionHeading>

      <div>
        <p className="contact-intro">{settings.contact_intro}</p>

        <div className="contact-list">
          {settings.contact_email.trim() ? (
            <a href={`mailto:${settings.contact_email.trim()}`} className="contact-link">
              <span className="contact-label">Email</span>
              <span className="contact-value">{settings.contact_email}</span>
              <Mail aria-hidden="true" />
            </a>
          ) : null}

          {settings.contact_phone.trim() ? (
            <a href={`tel:${phoneHref}`} className="contact-link">
              <span className="contact-label">Phone</span>
              <span className="contact-value">{settings.contact_phone}</span>
              <Phone aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Footer({ settings }: { settings: PortfolioSettings }) {
  return (
    <footer className="footer">
      <div>
        <p className="footer-name">{settings.display_name}</p>
        <p>{settings.role_primary}</p>
      </div>
      <p className="footer-copyright">© {new Date().getFullYear()} {settings.display_name}</p>
    </footer>
  );
}

export function Portfolio() {
  const [settings, setSettings] = useState<PortfolioSettings>(DEFAULT_PORTFOLIO_SETTINGS);
  const [experiences, setExperiences] = useState<PortfolioExperience[]>(DEFAULT_EXPERIENCES);
  const [settingsResolved, setSettingsResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchPortfolioSettings(), fetchPortfolioExperiences()]).then(
      ([nextSettings, nextExperiences]) => {
        if (cancelled) return;
        setSettings(nextSettings);
        setExperiences(nextExperiences);
        setSettingsResolved(nextSettings !== DEFAULT_PORTFOLIO_SETTINGS);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = `${settings.display_name} — ${settings.role_primary}`;
  }, [settings.display_name, settings.role_primary]);

  return (
    <>
      <Header displayName={settings.display_name} />
      <main className="page-shell">
        <Hero settings={settings} settingsResolved={settingsResolved} />
        <About settings={settings} />
        <Experience experiences={experiences} />
        <ClinicalStudies />
        <Contact settings={settings} />
        <Comments />
        <Footer settings={settings} />
      </main>
    </>
  );
}
