import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://payproof.so"),
  icons: { icon: "/favicon.svg" },
  title: "Payproof - The Trustless Payment Protocol for Autonomous Agents",
  description:
    "The permissionless payment protocol for autonomous agents. Trustless commerce at machine speed. Built on Circle Arc, powered by USDC.",
  openGraph: {
    title: "Payproof - Trustless Payments for Autonomous Agents",
    description:
      "Permissionless, trustless payments for autonomous agents. Atomic data-for-payment at machine speed.",
    url: "https://payproof.so",
    siteName: "Payproof",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Payproof - Trustless Payments for Autonomous Agents",
    description:
      "Permissionless payments for autonomous agents. Trustless. Atomic. Built on Arc, powered by USDC.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
