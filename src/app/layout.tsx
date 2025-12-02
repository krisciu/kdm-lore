import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Kingdom Death: Monster Lore Compendium",
  description: "The ultimate wiki and lore compendium for Kingdom Death: Monster. Explore monsters, locations, survivors, and the deep mysteries of the darkness.",
  keywords: ["Kingdom Death", "Monster", "Lore", "Wiki", "Board Game", "Tabletop"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased">
        <Navigation />
        <main className="pt-16 min-h-screen">
          {children}
        </main>
        <footer className="border-t border-[var(--weathered-bone)]/20 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="font-[var(--font-display)] text-sm tracking-widest uppercase text-[var(--text-muted)]">
                  Kingdom Death: Monster Lore Compendium
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  A fan-made resource. Kingdom Death is © Adam Poots Games.
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm text-[var(--text-muted)]">
                <a href="/about" className="hover:text-lantern transition-colors">About</a>
                <a href="/contribute" className="hover:text-lantern transition-colors">Contribute</a>
                <a href="https://kingdomdeath.com" target="_blank" rel="noopener noreferrer" className="hover:text-lantern transition-colors">
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
