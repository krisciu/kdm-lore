'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, X } from 'lucide-react';

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
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-3 bg-[var(--black-raised)] border border-[var(--border)] hover:border-[var(--gray-dark)] transition-colors"
        aria-label="Table of contents"
      >
        {isOpen ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/90"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-[var(--black-raised)] border-l border-[var(--border)] p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] mb-6">
                Contents
              </h3>
              <nav className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`block w-full text-left py-2 text-sm transition-colors ${
                      item.level === 3 ? 'pl-4 text-xs' : ''
                    } ${
                      activeId === item.id
                        ? 'text-white'
                        : 'text-[var(--text-muted)] hover:text-white'
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
      <aside className="hidden lg:block sticky top-28 h-fit">
        <h3 className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)] mb-4">
          Contents
        </h3>
        <nav className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`block w-full text-left py-1.5 text-xs transition-colors ${
                item.level === 3 ? 'pl-3' : ''
              } ${
                activeId === item.id
                  ? 'text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
