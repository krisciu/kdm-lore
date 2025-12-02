'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight, Command, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import { searchLore } from '@/data/lore';
import { LoreEntry } from '@/types/lore';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_SEARCHES = [
  'White Lion',
  'Butcher', 
  'Phoenix',
  'Twilight Knight',
  'Gold Smoke Knight',
];

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
      const searchResults = searchLore(query).slice(0, 8);
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
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh]"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--void)]/95 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[var(--shadow)] border border-[var(--border)] rounded-lg overflow-hidden shadow-2xl">
              {/* Search Input */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--border-subtle)]">
                <Search className="w-5 h-5 text-[var(--dust)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search the compendium..."
                  className="flex-1 bg-transparent border-none outline-none text-base text-[var(--bone)] placeholder:text-[var(--smoke)]"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 text-[var(--dust)] hover:text-[var(--bone)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-[var(--dust)] hover:text-[var(--bone)] bg-[var(--obsidian)] rounded transition-colors"
                >
                  <span className="text-[10px] font-mono">ESC</span>
                </button>
              </div>

              {/* Results */}
              {query.trim().length > 1 ? (
                results.length > 0 ? (
                  <div className="py-2 max-h-[400px] overflow-y-auto">
                    {results.map((entry, index) => {
                      const isSelected = index === selectedIndex;
                      const isMonster = entry.category === 'monster';

                      return (
                        <button
                          key={entry.id}
                          onClick={() => navigateToResult(entry)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-all ${
                            isSelected ? 'bg-[var(--obsidian)]' : 'hover:bg-[var(--obsidian)]/50'
                          }`}
                        >
                          {/* Indicator */}
                          <div className={`w-1 h-10 rounded-full flex-shrink-0 transition-colors ${
                            isSelected 
                              ? isMonster ? 'bg-[var(--scarlet)]' : 'bg-[var(--dust)]'
                              : 'bg-transparent'
                          }`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className={`font-[var(--font-display)] text-sm tracking-wider uppercase transition-colors ${
                                isSelected ? 'text-[var(--bone)]' : 'text-[var(--ash)]'
                              }`}>
                                {entry.title}
                              </span>
                              <span className={`text-[9px] tracking-[0.15em] uppercase px-1.5 py-0.5 rounded ${
                                isMonster 
                                  ? 'text-[var(--scarlet)] bg-[var(--blood)]/20' 
                                  : 'text-[var(--dust)] bg-[var(--charcoal)]'
                              }`}>
                                {entry.category}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--dust)] truncate">
                              {entry.summary}
                            </p>
                          </div>
                          
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-[var(--scarlet)] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <p className="text-[var(--dust)]">No results for &quot;{query}&quot;</p>
                    <p className="text-xs text-[var(--smoke)] mt-2">Try a different search term</p>
                  </div>
                )
              ) : (
                <div className="px-5 py-6">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[var(--smoke)] mb-4">
                    Quick Search
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SEARCHES.map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="px-3 py-2 text-xs text-[var(--ash)] border border-[var(--border)] rounded hover:border-[var(--border-focus)] hover:text-[var(--bone)] transition-all"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--smoke)]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <ArrowUp className="w-3 h-3" />
                      <ArrowDown className="w-3 h-3" />
                      navigate
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CornerDownLeft className="w-3 h-3" />
                      select
                    </span>
                  </div>
                  <span className="text-[var(--dust)]">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
