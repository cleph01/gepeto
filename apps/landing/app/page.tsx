"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);
  return scrolled;
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll<HTMLElement>(".reveal");
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);
  return ref;
}

// ─────────────────────────────────────────────────────────────
// Sign-up form (reused in Hero + CTA)
// ─────────────────────────────────────────────────────────────

function SignUpForm({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        className={`inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-medium ${
          dark
            ? "bg-white/10 text-white border border-white/15"
            : "bg-blue-light text-blue border border-blue/20"
        }`}
      >
        <CheckCircleIcon className="shrink-0" />
        You&apos;re on the list — we&apos;ll be in touch soon.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2.5 w-full max-w-md"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="work@yourdentallabname.com"
        className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all ${
          dark
            ? "bg-white/8 border border-white/15 text-white placeholder:text-white/35 focus:border-blue focus:bg-white/12"
            : "bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue focus:ring-2 focus:ring-blue/15"
        }`}
      />
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 bg-blue hover:bg-blue-dark active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all duration-150 whitespace-nowrap disabled:opacity-60 cursor-pointer"
      >
        {loading ? "Joining…" : "Get Started Free"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function CheckCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 9l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M3 3l16 16M9.88 9.88A3 3 0 0012.12 12.12M6.5 6.5C4.6 7.7 3 9 3 11c2 3.33 5 5 8 5a9.3 9.3 0 003.5-.68M10 5.07A8.5 8.5 0 0119 11c-.38.67-.84 1.3-1.36 1.87"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 9h8M7 13h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipboardXIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="8"
        y="2"
        width="6"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9 13l4 4M13 13l-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 2a7 7 0 017 7c0 5.25-7 13-7 13S4 14.25 4 9a7 7 0 017-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M13 2L3 14h8l-2 8 10-12h-8l2-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M18 8A7 7 0 106 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M3 21h18M3 7h18M3 14h18M5 21V7M10 21V7M15 21V7M20 21V7M3 7l9-4 9 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────

function Nav({ scrolled }: { scrolled: boolean }) {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.08)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#185FA5" }}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z"
                fill="white"
              />
            </svg>
          </div>
          <span
            className={`text-lg font-bold tracking-tight transition-colors duration-300 ${
              scrolled ? "text-gray-900" : "text-white"
            }`}
          >
            Gepeto
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {(
            [
              ["#problem", "Problem"],
              ["#how-it-works", "How it works"],
              ["#features", "Features"],
            ] as [string, string][]
          ).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                scrolled
                  ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  : "text-white/65 hover:text-white hover:bg-white/8"
              }`}
            >
              {label}
            </a>
          ))}
          <a
            href="#cta"
            className="ml-2 px-4 py-2 bg-blue hover:bg-blue-dark text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Get Started
          </a>
        </nav>

        {/* Mobile CTA */}
        <a
          href="#cta"
          className="md:hidden px-4 py-2 bg-blue text-white text-sm font-semibold rounded-lg"
        >
          Get Started
        </a>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "#0F1B2D" }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Radial glow — blue bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 45%, rgba(24,95,165,0.18), transparent 70%)",
        }}
      />

      <div className="relative max-w-4xl mx-auto px-5 sm:px-8 pt-28 pb-24 text-center hero-animate">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/55 text-xs font-medium mb-8 tracking-wide">
          <span
            className="w-1.5 h-1.5 rounded-full bg-green inline-block"
            style={{ boxShadow: "0 0 6px #3B6D11" }}
          />
          Now accepting early-access labs
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(2.4rem,6vw,3.75rem)] font-bold text-white leading-[1.1] tracking-[-0.025em] mb-5">
          Dental lab logistics,
          <br />
          <span
            className="text-blue"
            style={{ textShadow: "0 0 48px rgba(24,95,165,0.5)" }}
          >
            finally solved.
          </span>
        </h1>

        {/* Sub-copy */}
        <p className="text-[clamp(1rem,2.5vw,1.2rem)] text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
          Replace the group texts and phone calls with a purpose-built dispatch
          platform. Real-time driver tracking, proof of delivery, and live
          status updates — for every dental office you serve.
        </p>

        {/* Form + secondary link */}
        <div className="flex flex-col items-center gap-3.5">
          <SignUpForm dark />
          <a
            href="mailto:hello@gepeto.com"
            className="text-sm text-white/35 hover:text-white/55 transition-colors"
          >
            Need a walk-through first? Schedule a demo →
          </a>
        </div>
      </div>

      {/* Fade to white at the bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, #ffffff)",
        }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Problem
// ─────────────────────────────────────────────────────────────

const problems = [
  {
    icon: <EyeOffIcon />,
    title: "No visibility after pickup",
    body: "Once a case leaves the lab, you're in the dark. Offices call asking for ETAs you can't provide — because you don't know either.",
  },
  {
    icon: <ChatIcon />,
    title: "Driver chaos over group chat",
    body: "Coordinating pickups and deliveries by text leads to missed stops, double-booked drivers, and no single source of truth.",
  },
  {
    icon: <ClipboardXIcon />,
    title: "No paper trail",
    body: "When a case goes missing or arrives damaged, there's no signature, no photo, no timestamp. Nothing to fall back on.",
  },
];

function ProblemSection() {
  const ref = useReveal();
  return (
    <section id="problem" className="bg-white py-24 px-5 sm:px-8" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <div className="reveal mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue mb-3">
            The old way
          </p>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-gray-900 tracking-tight leading-tight">
            Still running deliveries on gut
            <br className="hidden sm:block" /> feel and group texts?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {problems.map((p, i) => (
            <div
              key={i}
              className={`reveal reveal-delay-${i + 1} p-6 rounded-2xl border border-gray-100 bg-surface`}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-light text-blue flex items-center justify-center mb-4">
                {p.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {p.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// How It Works
// ─────────────────────────────────────────────────────────────

const steps = [
  {
    number: "01",
    role: "Lab Dispatcher",
    title: "Create the job",
    body: "Add case details, pick an office, assign a driver, and set priority — all in under 30 seconds. Gepeto handles the rest.",
  },
  {
    number: "02",
    role: "Driver",
    title: "Pick up & deliver",
    body: "Driver gets a push notification, navigates their stops, then captures a photo and signature at drop-off.",
  },
  {
    number: "03",
    role: "Dental Office",
    title: "Track in real time",
    body: "The office gets a magic link. They watch their delivery live on a map — no app, no login, no calls to your lab.",
  },
];

function HowItWorksSection() {
  const ref = useReveal();
  return (
    <section
      id="how-it-works"
      className="py-24 px-5 sm:px-8 bg-surface"
      ref={ref}
    >
      <div className="max-w-5xl mx-auto">
        <div className="reveal mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue mb-3">
            How it works
          </p>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-gray-900 tracking-tight leading-tight">
            Three roles. One seamless flow.
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {/* Connecting line on desktop */}
          <div
            className="hidden md:block absolute top-7 left-[calc(33.33%+1.5rem)] right-[calc(33.33%+1.5rem)] h-px"
            style={{
              background:
                "repeating-linear-gradient(to right, #185FA5 0, #185FA5 6px, transparent 6px, transparent 14px)",
              opacity: 0.25,
            }}
          />

          {steps.map((step, i) => (
            <div key={i} className={`reveal reveal-delay-${i + 1}`}>
              {/* Step number */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-blue flex items-center justify-center shrink-0">
                  <span className="text-lg font-bold text-white leading-none">
                    {step.number}
                  </span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  {step.role}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Features
// ─────────────────────────────────────────────────────────────

const features = [
  {
    icon: <MapPinIcon />,
    title: "Live Driver Tracking",
    body: "Know exactly where every driver is, updated every 8 seconds. No more guessing.",
  },
  {
    icon: <CameraIcon />,
    title: "Proof of Delivery",
    body: "Photo capture and recipient signature at every drop-off, stored securely in the cloud.",
  },
  {
    icon: <ZapIcon />,
    title: "Instant Dispatch",
    body: "Create and assign jobs in seconds. Priority flags for urgent cases so nothing gets buried.",
  },
  {
    icon: <LinkIcon />,
    title: "Office Tracking Portal",
    body: "A magic link gives offices a real-time delivery view — no app download, no account required.",
  },
  {
    icon: <BellIcon />,
    title: "Real-Time Alerts",
    body: "Status changes push instantly to dispatchers and offices. Everyone stays in the loop.",
  },
  {
    icon: <BuildingIcon />,
    title: "Multi-Lab Ready",
    body: "Built multi-tenant from day one. Run multiple lab locations from a single Gepeto account.",
  },
];

function FeaturesSection() {
  const ref = useReveal();
  return (
    <section id="features" className="py-24 px-5 sm:px-8 bg-white" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <div className="reveal mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue mb-3">
            What you get
          </p>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-gray-900 tracking-tight leading-tight">
            Everything your lab needs.
            <br className="hidden sm:block" /> Nothing it doesn&apos;t.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={i}
              className={`reveal reveal-delay-${i + 1} group p-6 rounded-2xl border border-gray-100 hover:border-blue/20 hover:shadow-[0_4px_24px_rgba(24,95,165,0.08)] transition-all duration-200`}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-light text-blue flex items-center justify-center mb-4 group-hover:bg-blue group-hover:text-white transition-colors duration-200">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                {f.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CTA section
// ─────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useReveal();
  return (
    <section
      id="cta"
      className="py-24 px-5 sm:px-8"
      style={{ background: "#0F1B2D" }}
      ref={ref}
    >
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative max-w-2xl mx-auto text-center">
        <div className="reveal">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold text-white tracking-tight leading-tight mb-4">
            Ready to modernize your
            <br /> lab&apos;s delivery operations?
          </h2>
          <p className="text-white/50 text-base mb-10 leading-relaxed">
            Join the labs already running on Gepeto. Get started free — no
            credit card required.
          </p>
        </div>

        <div className="reveal reveal-delay-1 flex flex-col items-center gap-3">
          <SignUpForm dark />
          <a
            href="mailto:hello@gepeto.com"
            className="text-sm text-white/35 hover:text-white/55 transition-colors"
          >
            Need a walk-through first? Schedule a demo →
          </a>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-8 px-5 sm:px-8 border-t"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0A1522" }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Image
            src="/gepeto-logo.png"
            alt=""
            width={1024}
            height={1024}
            style={{ width: "auto" }}
            className="h-8 brightness-0 invert opacity-40"
          />
          <span className="text-sm font-semibold text-white/40 tracking-tight">
            Gepeto
          </span>
        </div>
        <p className="text-xs text-white/25">
          © {new Date().getFullYear()} Gepeto. All rights reserved.
        </p>
        <div className="flex items-center gap-5 text-xs text-white/30">
          <a
            href="mailto:hello@gepeto.com"
            className="hover:text-white/50 transition-colors"
          >
            Contact
          </a>
          <a href="#" className="hover:text-white/50 transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-white/50 transition-colors">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const scrolled = useScrolled();

  return (
    <div className="font-sans">
      <Nav scrolled={scrolled} />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
