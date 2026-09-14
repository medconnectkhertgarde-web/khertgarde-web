import { useState } from "react";
import { ArrowDown, Mail, Menu, Moon, Phone, Sun, X } from "lucide-react";

import { ClinicalStudies } from "@/components/ClinicalStudies";

const navItems = [
  ["About", "about"],
  ["Experience", "experience"],
  ["Clinical studies", "clinical-studies"],
  ["Contact", "contact"],
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

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="#top" className="brand">
          Khert Laguna Garde
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


function ProfilePhoto() {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div className="profile-placeholder" aria-label="Profile photo placeholder">
        <span>Profile photo</span>
      </div>
    );
  }

  return (
    <div className="profile-placeholder profile-photo-shell">
      <img
        src="/profile.jpg"
        alt="Khert Laguna Garde"
        loading="lazy"
        onError={() => setMissing(true)}
      />
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="hero">
      <div className="hero-grid">
        <div>
          <p className="eyebrow">Independent researcher · Philippines</p>
          <h1>Khert Laguna Garde</h1>
          <div className="hero-role">
            <span>Independent Researcher</span>
            <span aria-hidden="true">/</span>
            <span>Medicine · Clinical Studies</span>
          </div>
          <p className="hero-copy">
            Independent researcher with a strong interest in medicine and clinical studies. I explore
            medical conditions, diagnostic approaches, disease mechanisms, treatment principles, and
            clinical scenarios through structured independent research and study.
          </p>
        </div>

        <ProfilePhoto />
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

function About() {
  return (
    <section id="about" className="section split-section" aria-labelledby="about-heading">
      <SectionHeading number="01" id="about-heading">
        About
      </SectionHeading>
      <div className="body-copy">
        <p>
          I’m an independent researcher with a growing focus on medicine and clinical studies. My work
          centers on understanding diseases, clinical presentation, diagnostic reasoning, treatment
          principles, and evidence-based approaches to patient scenarios.
        </p>
        <p>
          I enjoy turning complex medical topics into structured and understandable study materials while
          continuously expanding my knowledge across different areas of medicine.
        </p>
      </div>
    </section>
  );
}

const experiences = [
  {
    company: "Concentrix",
    role: "Customer Service Representative",
    description:
      "Handled customer inquiries and service concerns while providing clear, professional, and timely support. The role involved understanding customer needs, explaining information accurately, resolving concerns when possible, documenting interactions, following account procedures, and escalating complex issues when necessary.",
    note: "A Customer Service Representative serves as a primary point of contact between a company and its customers, helping answer questions, resolve concerns, provide information, and maintain a positive customer experience.",
  },
  {
    company: "Sutherland Global Services",
    role: "Business Process Outsourcing — Healthcare Account",
    description:
      "Worked within a healthcare-focused BPO account supporting account operations and customer interactions according to established company and account procedures.",
  },
];

function Experience() {
  return (
    <section id="experience" className="section" aria-labelledby="experience-heading">
      <SectionHeading number="02" id="experience-heading">
        Experience
      </SectionHeading>

      <div className="experience-list">
        {experiences.map((item, index) => (
          <article key={item.company} className="experience-item">
            <span className="experience-number">0{index + 1}</span>
            <div>
              <h3>{item.company}</h3>
              <p className="experience-role">{item.role}</p>
            </div>
            <div className="experience-description">
              <p>{item.description}</p>
              {item.note ? <p className="experience-note">{item.note}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="section split-section contact-section" aria-labelledby="contact-heading">
      <SectionHeading number="04" id="contact-heading">
        Contact
      </SectionHeading>

      <div>
        <p className="contact-intro">
          For research-related inquiries, professional opportunities, and other communications.
        </p>

        <div className="contact-list">
          <a href="mailto:medconnect.khertgarde@gmail.com" className="contact-link">
            <span className="contact-label">Email</span>
            <span className="contact-value">medconnect.khertgarde@gmail.com</span>
            <Mail aria-hidden="true" />
          </a>
          <a href="tel:+639307732588" className="contact-link">
            <span className="contact-label">Phone</span>
            <span className="contact-value">09307732588</span>
            <Phone aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div>
        <p className="footer-name">Khert Laguna Garde</p>
        <p>Independent Researcher</p>
      </div>
      <p className="footer-copyright">© {new Date().getFullYear()} Khert Laguna Garde</p>
    </footer>
  );
}

export function Portfolio() {
  return (
    <>
      <Header />
      <main className="page-shell">
        <Hero />
        <About />
        <Experience />
        <ClinicalStudies />
        <Contact />
        <Footer />
      </main>
    </>
  );
}
