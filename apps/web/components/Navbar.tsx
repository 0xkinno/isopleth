"use client";

import { useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "/workbench", label: "Workbench" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/proof", label: "Proof" },
  { href: "/method", label: "Method" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        borderBottom: "1px solid var(--rule)",
        background: "var(--vellum)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          gap: 24,
        }}
      >
        <Link
          href="/"
          onClick={() => setOpen(false)}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          Isopleth
        </Link>

        <nav className="nav-desktop" style={{ alignItems: "center", gap: 28 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 15, textDecoration: "none", color: "var(--ink-soft)" }}>
              {l.label}
            </Link>
          ))}
          <Link href="/workbench" className="btn btn-primary" style={{ fontSize: 14, padding: "10px 18px" }}>
            Map a book
          </Link>
        </nav>

        <button
          className="nav-toggle btn btn-secondary"
          style={{ fontSize: 14, padding: "10px 16px" }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          aria-label="Toggle navigation menu"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav-panel" className="nav-mobile-panel">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ fontSize: 16, textDecoration: "none", color: "var(--ink)" }}>
              {l.label}
            </Link>
          ))}
          <Link href="/workbench" onClick={() => setOpen(false)} className="btn btn-primary" style={{ fontSize: 15, textAlign: "center" }}>
            Map a book
          </Link>
        </nav>
      )}
    </header>
  );
}
