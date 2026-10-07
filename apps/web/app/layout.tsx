import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Geist, JetBrains_Mono } from "next/font/google";
import { Navbar } from "../components/Navbar";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Isopleth",
  description: "Your margin ratio is a snapshot. Isopleth maps the boundary it is sitting next to.",
};

// Explicit, not relied on as a framework default: without this, mobile
// browsers (and Chromium's mobile emulation) lay the page out at a desktop-
// width virtual viewport (~980px) and scale it down, which silently causes
// "overflow" on every route rather than an honest 375px-wide layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${geistSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Navbar />
        <main>{children}</main>
        <footer className="container" style={{ padding: "48px 24px", color: "var(--ink-soft)", fontSize: 14 }}>
          Built for the Bitget AI Base Camp Hackathon S2 — Track: AI Trading Desk, Decision Stress Testing.
          Every number on this site traces to a reproducible command. See{" "}
          <a href="/proof" style={{ textDecoration: "underline" }}>
            /proof
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
