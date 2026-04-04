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
  title: "Payproof — The Trustless Payment Protocol for Autonomous Agents",
  description:
    "Atomic data-for-payment via HTLC. The preimage that unlocks payment IS the encryption key. Built on Circle Arc, powered by USDC. SDK ready.",
  openGraph: {
    title: "Payproof — Trustless Payments for Autonomous Agents",
    description:
      "The only atomic data-for-payment protocol. The HTLC preimage IS the AES-256-GCM decryption key. Neither party can cheat.",
    url: "https://payproof.so",
    siteName: "Payproof",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Payproof — Trustless Payments for Autonomous Agents",
    description:
      "Atomic data-for-payment. The HTLC preimage IS the encryption key. Built on Arc, powered by USDC.",
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
