'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X } from 'lucide-react';
import SearchModal from './SearchModal';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/lore', label: 'Compendium' },
  { href: '/generator', label: 'Generator' },
  { href: '/changelog', label: 'Changelog' },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Track scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-[var(--black)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <span className="font-[var(--font-display)] text-sm lg:text-base tracking-[0.3em] uppercase text-white group-hover:text-[var(--red)] transition-colors">
                Kingdom Death
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-10">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || 
                  (link.href !== '/' && pathname.startsWith(link.href));
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative text-xs tracking-[0.2em] uppercase transition-colors ${
                      isActive 
                        ? 'text-white' 
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--red)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-[var(--text-muted)] hover:text-white transition-colors"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline text-xs tracking-wider">Search</span>
                <kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 bg-[var(--black-raised)] border border-[var(--border)] rounded text-[var(--text-muted)]">
                  ⌘K
                </kbd>
              </button>
              
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 text-[var(--text-muted)] hover:text-white transition-colors"
                aria-label="Menu"
              >
                {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[var(--black)] border-t border-[var(--border-subtle)]"
            >
              <div className="px-6 py-6 space-y-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`block py-3 text-sm tracking-[0.15em] uppercase transition-colors ${
                        isActive 
                          ? 'text-white' 
                          : 'text-[var(--text-muted)] hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
