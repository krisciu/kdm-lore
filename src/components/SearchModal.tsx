'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight } from 'lucide-react';
import { searchLore } from '@/data/lore';
import { LoreEntry } from '@/types/lore';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LoreEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 1) {
      const searchResults = searchLore(query).slice(0, 6);
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, onClose]);

  const navigateToResult = (entry: LoreEntry) => {
    router.push(`/lore/${entry.slug}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[var(--black-raised)] border border-[var(--border)] overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border-subtle)]">
                <Search className="w-4 h-4 text-[var(--text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search the compendium..."
                  className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder:text-[var(--text-muted)]"
                />
                <button
                  onClick={onClose}
                  className="p-1 text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results */}
              {query.trim().length > 1 ? (
                results.length > 0 ? (
                  <div className="py-2">
                    {results.map((entry, index) => {
                      const isSelected = index === selectedIndex;
                      const isMonster = entry.category === 'monster';

                      return (
                        <button
                          key={entry.id}
                          onClick={() => navigateToResult(entry)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
                            isSelected ? 'bg-[var(--black-elevated)]' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`font-[var(--font-display)] text-sm tracking-wider uppercase ${
                                isSelected ? 'text-white' : 'text-[var(--text-secondary)]'
                              }`}>
                                {entry.title}
                              </span>
                              <span className={`text-[10px] tracking-wider uppercase ${
                                isMonster ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'
                              }`}>
                                {entry.category}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {entry.summary}
                            </p>
                          </div>
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-[var(--red)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <p className="text-[var(--text-muted)] text-sm">No results for &quot;{query}&quot;</p>
                  </div>
                )
              ) : (
                <div className="px-5 py-6">
                  <p className="text-[10px] tracking-wider uppercase text-[var(--text-muted)] mb-3">Quick Search</p>
                  <div className="flex flex-wrap gap-2">
                    {['White Lion', 'Butcher', 'Phoenix', 'Twilight Knight', 'The King'].map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="px-3 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--gray-dark)] hover:text-white transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center gap-6 text-[10px] text-[var(--text-muted)]">
                  <span><kbd className="px-1 py-0.5 bg-[var(--black-surface)] mr-1">↑↓</kbd> navigate</span>
                  <span><kbd className="px-1 py-0.5 bg-[var(--black-surface)] mr-1">↵</kbd> select</span>
                  <span><kbd className="px-1 py-0.5 bg-[var(--black-surface)] mr-1">esc</kbd> close</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
