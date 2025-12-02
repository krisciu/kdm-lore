import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Kingdom Death: Monster Lore Compendium",
  description: "The definitive wiki and lore compendium for Kingdom Death: Monster. Explore monsters, locations, survivors, and the deep mysteries of the darkness.",
  keywords: ["Kingdom Death", "Monster", "Lore", "Wiki", "Board Game", "Tabletop"],
  openGraph: {
    title: "Kingdom Death: Monster Lore Compendium",
    description: "The definitive lore compendium for Kingdom Death: Monster",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for faster font loading */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Navigation />
        <main className="min-h-screen">
          {children}
        </main>
        <footer className="border-t border-[var(--border-subtle)] py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <p className="font-[var(--font-display)] text-xs tracking-[0.2em] uppercase text-[var(--text-muted)] mb-2">
                  Kingdom Death Lore Compendium
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  A fan-made resource. Kingdom Death: Monster © Adam Poots Games.
                </p>
              </div>
              <div className="flex items-center gap-8 text-xs text-[var(--text-muted)]">
                <a href="/about" className="hover:text-white transition-colors">About</a>
                <a href="/contribute" className="hover:text-white transition-colors">Contribute</a>
                <a href="https://kingdomdeath.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  Official Site
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
