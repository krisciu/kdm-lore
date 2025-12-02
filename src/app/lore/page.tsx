'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Grid, List, SlidersHorizontal, Loader2 } from 'lucide-react';
import { categories, seedLoreEntries } from '@/data/lore';
import { LoreEntry, LoreCategory, CategoryInfo } from '@/types/lore';
import LoreCard from '@/components/LoreCard';
import Breadcrumbs from '@/components/Breadcrumbs';

function LorePageContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as LoreCategory | null;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LoreCategory | 'all'>(initialCategory || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>(seedLoreEntries);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch lore entries from API on mount
  useEffect(() => {
    async function fetchLore() {
      try {
        const res = await fetch('/api/lore');
        if (res.ok) {
          const data = await res.json();
          if (data.entries && data.entries.length > 0) {
            setLoreEntries(data.entries);
          }
        }
      } catch (error) {
        console.error('Failed to fetch lore:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLore();
  }, []);
  
  // Calculate categories with counts
  const categoriesWithCounts: CategoryInfo[] = useMemo(() => {
    return categories.map(cat => ({
      ...cat,
      count: loreEntries.filter(entry => entry.category === cat.id).length,
    }));
  }, [loreEntries]);

  const filteredEntries = useMemo(() => {
    let entries = loreEntries;
    
    if (selectedCategory !== 'all') {
      entries = entries.filter(entry => entry.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      entries = entries.filter(entry => 
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.summary.toLowerCase().includes(lowerQuery) ||
        entry.content.toLowerCase().includes(lowerQuery) ||
        entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }
    
    return entries;
  }, [searchQuery, selectedCategory, loreEntries]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const activeFiltersCount = (selectedCategory !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0);

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Compendium' }]} />

        {/* Header */}
        <header className="mb-10">
          <h1 className="font-[var(--font-display)] text-3xl md:text-4xl tracking-[0.15em] uppercase mb-4">
            Lore <span className="text-[var(--scarlet)]">Compendium</span>
          </h1>
          <p className="text-[var(--ash)] max-w-2xl text-lg">
            The complete archive of Kingdom Death lore. Browse monsters, locations, 
            philosophies, and the mysteries of the darkness.
          </p>
        </header>

        {/* Filters Bar */}
        <div className="sticky top-16 lg:top-20 z-30 -mx-6 px-6 py-5 glass border-b border-[var(--border-subtle)] mb-8">
          <div className="flex flex-col gap-4">
            {/* Top Row: Search + Actions */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dust)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries..."
                  className="w-full pl-11 pr-10 py-3 bg-[var(--shadow)] border border-[var(--border)] rounded-lg text-sm focus:border-[var(--border-focus)]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--dust)] hover:text-[var(--bone)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`lg:hidden flex items-center gap-2 px-4 py-3 border rounded-lg transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-[var(--shadow)] border-[var(--border-focus)] text-[var(--bone)]'
                    : 'border-[var(--border)] text-[var(--dust)]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 flex items-center justify-center text-[10px] bg-[var(--blood)] text-[var(--bone)] rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* View Toggle */}
              <div className="flex items-center border border-[var(--border)] divide-x divide-[var(--border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 transition-colors ${
                    viewMode === 'grid' 
                      ? 'text-[var(--bone)] bg-[var(--shadow)]' 
                      : 'text-[var(--dust)] hover:text-[var(--bone)]'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 transition-colors ${
                    viewMode === 'list' 
                      ? 'text-[var(--bone)] bg-[var(--shadow)]' 
                      : 'text-[var(--dust)] hover:text-[var(--bone)]'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Filters (Always visible on desktop, toggleable on mobile) */}
            <AnimatePresence>
              {(showFilters || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden lg:!h-auto lg:!opacity-100"
                >
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mb-1">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`flex-shrink-0 px-4 py-2 text-[11px] tracking-[0.12em] uppercase rounded-full transition-all ${
                        selectedCategory === 'all'
                          ? 'text-[var(--bone)] bg-[var(--obsidian)] border border-[var(--border-focus)]'
                          : 'text-[var(--dust)] hover:text-[var(--bone)] border border-transparent hover:border-[var(--border)]'
                      }`}
                    >
                      All ({loreEntries.length})
                    </button>
                    {categoriesWithCounts.filter(c => c.count > 0).map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`flex-shrink-0 px-4 py-2 text-[11px] tracking-[0.12em] uppercase rounded-full transition-all ${
                          selectedCategory === category.id
                            ? category.id === 'monster' 
                              ? 'text-[var(--scarlet)] bg-[var(--blood)]/20 border border-[var(--blood)]/50'
                              : 'text-[var(--bone)] bg-[var(--obsidian)] border border-[var(--border-focus)]'
                            : 'text-[var(--dust)] hover:text-[var(--bone)] border border-transparent hover:border-[var(--border)]'
                        }`}
                      >
                        {category.name} ({category.count})
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-[var(--dust)] tracking-wider uppercase">Active:</span>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-[var(--shadow)] border border-[var(--border)] rounded-full">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory('all')} className="text-[var(--dust)] hover:text-[var(--scarlet)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-[var(--shadow)] border border-[var(--border)] rounded-full">
                  &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery('')} className="text-[var(--dust)] hover:text-[var(--scarlet)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button 
              onClick={clearFilters} 
              className="text-xs text-[var(--dust)] hover:text-[var(--bone)] transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[var(--dust)]">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading entries...
              </span>
            ) : (
              `${filteredEntries.length} ${filteredEntries.length === 1 ? 'entry' : 'entries'}`
            )}
          </p>
        </div>

        {/* Results */}
        {filteredEntries.length > 0 ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.03 } }
            }}
            className={viewMode === 'grid' 
              ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-5'
              : 'space-y-0 divide-y divide-[var(--border-subtle)]'
            }
          >
            {filteredEntries.map((entry, idx) => (
              <LoreCard 
                key={entry.id} 
                entry={entry} 
                variant={viewMode === 'list' ? 'compact' : 'default'}
                index={idx}
              />
            ))}
          </motion.div>
        ) : (
          <div className="empty-state">
            <Search className="empty-state-icon" />
            <p className="empty-state-title">No Entries Found</p>
            <p className="empty-state-description">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="btn mt-6">
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LorePageLoading() {
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="loading-spinner" style={{ width: 32, height: 32 }} />
            <p className="text-[var(--dust)] text-sm">Loading compendium...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function LorePage() {
  return (
    <Suspense fallback={<LorePageLoading />}>
      <LorePageContent />
    </Suspense>
  );
}
