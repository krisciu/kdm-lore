'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, X, Grid, List, Filter } from 'lucide-react';
import { getCategoriesWithCounts, getLoreEntries, searchLore } from '@/data/lore';
import { LoreCategory } from '@/types/lore';
import LoreCard from '@/components/LoreCard';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function LorePage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as LoreCategory | null;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LoreCategory | 'all'>(initialCategory || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const loreEntries = getLoreEntries();
  const categoriesWithCounts = getCategoriesWithCounts();

  const filteredEntries = useMemo(() => {
    let entries = loreEntries;
    
    if (selectedCategory !== 'all') {
      entries = entries.filter(entry => entry.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      entries = searchLore(searchQuery);
      if (selectedCategory !== 'all') {
        entries = entries.filter(entry => entry.category === selectedCategory);
      }
    }
    
    return entries;
  }, [searchQuery, selectedCategory, loreEntries]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Compendium' }]} />

        {/* Header */}
        <header className="mb-12">
          <h1 className="font-[var(--font-display)] text-3xl md:text-4xl tracking-wider uppercase mb-4">
            Lore <span className="text-[var(--red)]">Compendium</span>
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            The complete archive of Kingdom Death lore. Browse monsters, locations, 
            philosophies, and the mysteries of the darkness.
          </p>
        </header>

        {/* Filters */}
        <div className="sticky top-16 lg:top-20 z-30 -mx-6 px-6 py-4 bg-[var(--black)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-11 pr-10 py-3 bg-[var(--black-raised)] border border-[var(--border)] text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <Filter className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-2 text-xs tracking-wider uppercase whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'text-white bg-[var(--black-elevated)]'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                All ({loreEntries.length})
              </button>
              {categoriesWithCounts.filter(c => c.count > 0).map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-2 text-xs tracking-wider uppercase whitespace-nowrap transition-colors ${
                    selectedCategory === category.id
                      ? category.id === 'monster' 
                        ? 'text-[var(--red)] bg-[var(--black-elevated)]'
                        : 'text-white bg-[var(--black-elevated)]'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex items-center border border-[var(--border)] divide-x divide-[var(--border)]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 transition-colors ${
                  viewMode === 'grid' ? 'text-white bg-[var(--black-elevated)]' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 transition-colors ${
                  viewMode === 'list' ? 'text-white bg-[var(--black-elevated)]' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {(selectedCategory !== 'all' || searchQuery) && (
          <div className="flex items-center gap-3 mb-6 text-sm">
            <span className="text-[var(--text-muted)]">Filters:</span>
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-2 px-2 py-1 bg-[var(--black-raised)] border border-[var(--border)]">
                {selectedCategory}
                <button onClick={() => setSelectedCategory('all')} className="hover:text-[var(--red)]">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-2 px-2 py-1 bg-[var(--black-raised)] border border-[var(--border)]">
                &quot;{searchQuery}&quot;
                <button onClick={() => setSearchQuery('')} className="hover:text-[var(--red)]">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button onClick={clearFilters} className="text-[var(--text-muted)] hover:text-white text-xs">
              Clear all
            </button>
          </div>
        )}

        {/* Results Count */}
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </p>

        {/* Results */}
        {filteredEntries.length > 0 ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.03 } }
            }}
            className={viewMode === 'grid' 
              ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-0'
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
          <div className="text-center py-20">
            <p className="text-[var(--text-muted)] mb-4">No entries found</p>
            <button onClick={clearFilters} className="btn">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
