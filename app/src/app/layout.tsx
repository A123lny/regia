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
      <head>
        {/* RF-2.2: font aggiuntivi per anteprima brand (Playfair, Poppins, Roboto, Lora,
            Montserrat, Merriweather, Inter). Bricolage e Geist gia via next/font sopra. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;700&family=Roboto:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
