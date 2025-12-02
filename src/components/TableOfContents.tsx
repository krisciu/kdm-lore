'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, ChevronRight, X } from 'lucide-react';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export default function TableOfContents({ content }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<TocItem[]>([]);

  // Extract headings from content
  useEffect(() => {
    const headings: TocItem[] = [];
    const lines = content.split('\n');

    lines.forEach((line) => {
      const h2Match = line.match(/^## (.+)/);
      const h3Match = line.match(/^### (.+)/);

      if (h2Match) {
        const title = h2Match[1];
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        headings.push({ id, title, level: 2 });
      } else if (h3Match) {
        const title = h3Match[1];
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        headings.push({ id, title, level: 3 });
      }
    });

    setItems(headings);
  }, [content]);

  // Track active heading on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) {
    return null; // Don't show TOC for short content
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/30 rounded-full shadow-lg hover:border-lantern/50 transition-colors"
        aria-label="Table of contents"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-lantern" />
        ) : (
          <List className="w-5 h-5 text-lantern" />
        )}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-[var(--dark-stone)] border-l border-[var(--weathered-bone)]/30 p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-[var(--font-display)] tracking-wider text-lg text-lantern mb-6">
                Contents
              </h3>
              <nav className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`block w-full text-left py-2 px-3 rounded transition-colors ${
                      item.level === 3 ? 'pl-6 text-sm' : ''
                    } ${
                      activeId === item.id
                        ? 'bg-lantern/10 text-lantern'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--weathered-bone)]/10'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block sticky top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="p-4 bg-[var(--dark-stone)]/50 border border-[var(--weathered-bone)]/20 rounded-lg">
          <h3 className="font-[var(--font-display)] tracking-wider text-sm text-[var(--text-muted)] uppercase mb-4 flex items-center gap-2">
            <List className="w-4 h-4" />
            Contents
          </h3>
          <nav className="space-y-0.5">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`group flex items-center gap-2 w-full text-left py-1.5 transition-colors ${
                  item.level === 3 ? 'pl-4 text-xs' : 'text-sm'
                } ${
                  activeId === item.id
                    ? 'text-lantern'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <ChevronRight 
                  className={`w-3 h-3 transition-transform ${
                    activeId === item.id ? 'text-lantern' : 'text-transparent group-hover:text-[var(--text-muted)]'
                  }`} 
                />
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

