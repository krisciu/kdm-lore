'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Menu, X, Command } from 'lucide-react';
import SearchModal from './SearchModal';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/lore', label: 'Compendium' },
  { href: '/agent', label: 'Agent' },
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

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-[var(--void)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)]' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                {/* Animated glow effect */}
                <motion.div
                  className="absolute inset-0 bg-[var(--blood)] rounded-full blur-lg opacity-0 group-hover:opacity-30"
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="relative font-[var(--font-display)] text-sm lg:text-base tracking-[0.25em] uppercase text-[var(--bone)] group-hover:text-[var(--scarlet)] transition-colors duration-300">
                  Kingdom Death
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || 
                  (link.href !== '/' && pathname.startsWith(link.href));
                
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-colors duration-300 ${
                      isActive 
                        ? 'text-[var(--bone)]' 
                        : 'text-[var(--dust)] hover:text-[var(--bone)]'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[var(--scarlet)] to-transparent"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2.5 px-3 py-2 text-[var(--dust)] hover:text-[var(--bone)] hover:bg-[var(--shadow)] rounded-lg transition-all duration-200"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px] tracking-wider uppercase">Search</span>
                <kbd className="hidden lg:flex items-center gap-0.5 text-[9px] px-1.5 py-1 bg-[var(--shadow)] border border-[var(--border)] rounded text-[var(--smoke)]">
                  <Command className="w-2.5 h-2.5" />
                  <span>K</span>
                </kbd>
              </button>
              
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2.5 text-[var(--dust)] hover:text-[var(--bone)] hover:bg-[var(--shadow)] rounded-lg transition-colors"
                aria-label="Menu"
              >
                <motion.div
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </motion.div>
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
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden bg-[var(--void)] border-t border-[var(--border-subtle)]"
            >
              <div className="px-6 py-4 space-y-1">
                {navLinks.map((link, idx) => {
                  const isActive = pathname === link.href;
                  
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        className={`flex items-center justify-between py-3.5 px-3 rounded-lg text-sm tracking-[0.15em] uppercase transition-colors ${
                          isActive 
                            ? 'text-[var(--bone)] bg-[var(--shadow)]' 
                            : 'text-[var(--dust)] hover:text-[var(--bone)] hover:bg-[var(--shadow)]'
                        }`}
                      >
                        {link.label}
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--scarlet)]" />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
                
                {/* Mobile Search Button */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.05 }}
                  className="pt-3 mt-3 border-t border-[var(--border-subtle)]"
                >
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setSearchOpen(true);
                    }}
                    className="flex items-center gap-3 w-full py-3.5 px-3 rounded-lg text-sm tracking-[0.15em] uppercase text-[var(--dust)] hover:text-[var(--bone)] hover:bg-[var(--shadow)] transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
