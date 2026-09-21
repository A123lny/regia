import type { Metadata } from "next";
import { Fraunces, Geist, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Regìa",
  description:
    "Piattaforma di marketing e operazioni commerciali multi-marchio (gruppo Lenny + stazione Eni, San Marino).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${geist.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
