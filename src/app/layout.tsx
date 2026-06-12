import type { Metadata } from "next";
import { Geist, Space_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Space Mono — the lostastronaut.space brand face. Carries display headlines,
// labels, and all technical/mono text, the visual signature of the app.
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lost Astronaut · vibe-code your need",
  description: "Describe who you're looking for; we scan, rank, and research them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        {/* Cosmic atmosphere: fixed aurora + starfield behind all content. */}
        <div aria-hidden className="cosmos" />
        {children}
      </body>
    </html>
  );
}
