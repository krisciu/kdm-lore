'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter,
  Skull, 
  MapPin, 
  Users, 
  Swords, 
  Scroll, 
  Sparkles,
  Eye,
  Flame,
  Flag,
  Lightbulb,
  Cog,
  Grid,
  List,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { getCategoriesWithCounts, getLoreEntries, searchLore } from '@/data/lore';
import { LoreCategory } from '@/types/lore';
import LoreCard from '@/components/LoreCard';
import Breadcrumbs from '@/components/Breadcrumbs';

const categoryIcons: Record<string, React.ElementType> = {
  monster: Skull,
  location: MapPin,
  survivor: Users,
  character: Users,
  settlement: Flame,
  item: Swords,
  event: Scroll,
  philosophy: Sparkles,
  entity: Eye,
  faction: Flag,
  concept: Lightbulb,
  technology: Cog,
};

const categoryColors: Record<string, string> = {
  monster: 'border-red-500/50 bg-red-500/5 hover:bg-red-500/10 text-red-400',
  location: 'border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400',
  character: 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400',
  survivor: 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400',
  settlement: 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400',
  item: 'border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-400',
  event: 'border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400',
  philosophy: 'border-cyan-500/50 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400',
  entity: 'border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/10 text-violet-400',
  faction: 'border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/10 text-orange-400',
  concept: 'border-pink-500/50 bg-pink-500/5 hover:bg-pink-500/10 text-pink-400',
  technology: 'border-slate-400/50 bg-slate-400/5 hover:bg-slate-400/10 text-slate-300',
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.03,
    },
  },
};

export default function LorePage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as LoreCategory | null;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LoreCategory | 'all'>(initialCategory || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  
  // Load entries dynamically
  const loreEntries = getLoreEntries();
  const categoriesWithCounts = getCategoriesWithCounts();

  const filteredEntries = useMemo(() => {
    let entries = loreEntries;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      entries = entries.filter(entry => entry.category === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      entries = searchLore(searchQuery);
      if (selectedCategory !== 'all') {
        entries = entries.filter(entry => entry.category === selectedCategory);
      }
    }
    
    return entries;
  }, [searchQuery, selectedCategory, loreEntries]);

  const selectedCategoryInfo = categoriesWithCounts.find(c => c.id === selectedCategory);
  const activeFiltersCount = (selectedCategory !== 'all' ? 1 : 0) + (searchQuery ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: 'Lore Compendium' }
          ]} 
        />

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-[var(--font-display)] tracking-wider mb-4">
            LORE <span className="text-lantern">COMPENDIUM</span>
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl">
            The most comprehensive collection of Kingdom Death: Monster lore. 
            Explore monsters, locations, philosophies, and the dark mysteries of the world.
          </p>
        </header>

        {/* Search & Filters Bar */}
        <div className="sticky top-16 z-30 -mx-4 px-4 py-4 bg-[var(--void-black)]/95 backdrop-blur-sm border-b border-[var(--weathered-bone)]/10 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the compendium..."
                className="w-full pl-12 pr-4 py-3 bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/30 rounded-xl text-base focus:border-lantern/50 focus:ring-1 focus:ring-lantern/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View & Filter Controls */}
            <div className="flex items-center gap-2">
              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`sm:hidden flex items-center gap-2 px-4 py-3 border rounded-xl transition-colors ${
                  showFilters || activeFiltersCount > 0
                    ? 'border-lantern/50 bg-lantern/10 text-lantern'
                    : 'border-[var(--weathered-bone)]/30 bg-[var(--dark-stone)] text-[var(--text-secondary)]'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                {activeFiltersCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-lantern text-[var(--void-black)] rounded text-xs font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-3 transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-[var(--weathered-bone)]/20 text-lantern' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-label="Grid view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-3 transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-[var(--weathered-bone)]/20 text-lantern' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-label="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Filters */}
          <div className={`mt-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Filter className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border whitespace-nowrap text-sm font-[var(--font-display)] tracking-wider transition-all ${
                  selectedCategory === 'all' 
                    ? 'border-lantern/50 bg-lantern/10 text-lantern' 
                    : 'border-[var(--weathered-bone)]/30 bg-[var(--dark-stone)] text-[var(--text-secondary)] hover:border-[var(--weathered-bone)]/50'
                }`}
              >
                All
                <span className="text-xs opacity-70">({loreEntries.length})</span>
              </button>
              {categoriesWithCounts.filter(c => c.count > 0).map((category) => {
                const Icon = categoryIcons[category.id];
                const isSelected = selectedCategory === category.id;
                const colors = categoryColors[category.id];
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border whitespace-nowrap text-sm font-[var(--font-display)] tracking-wider transition-all ${
                      isSelected 
                        ? colors
                        : 'border-[var(--weathered-bone)]/30 bg-[var(--dark-stone)] text-[var(--text-secondary)] hover:border-[var(--weathered-bone)]/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {category.name}
                    <span className="text-xs opacity-70">({category.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm text-[var(--text-muted)]">Active filters:</span>
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--weathered-bone)]/10 rounded text-sm">
                Category: {selectedCategory}
                <button onClick={() => setSelectedCategory('all')} className="hover:text-lantern">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--weathered-bone)]/10 rounded text-sm">
                Search: &quot;{searchQuery}&quot;
                <button onClick={() => setSearchQuery('')} className="hover:text-lantern">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button 
              onClick={clearFilters}
              className="text-sm text-lantern hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Category Header (when filtered) */}
        {selectedCategory !== 'all' && selectedCategoryInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-8 p-6 rounded-xl border ${categoryColors[selectedCategory]}`}
          >
            <div className="flex items-center gap-4">
              {(() => {
                const Icon = categoryIcons[selectedCategory] || Scroll;
                return <Icon className="w-10 h-10" />;
              })()}
              <div>
                <h2 className="text-2xl font-[var(--font-display)] tracking-wider">
                  {selectedCategoryInfo.name}
                </h2>
                <p className="text-[var(--text-secondary)]">
                  {selectedCategoryInfo.description}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results Count */}
        <div className="mb-4 text-sm text-[var(--text-muted)]">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'} found
        </div>

        {/* Entries Grid/List */}
        {filteredEntries.length > 0 ? (
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className={viewMode === 'grid' 
              ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Search className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]/30" />
            <h3 className="text-xl font-[var(--font-display)] tracking-wider mb-2">
              No entries found
            </h3>
            <p className="text-[var(--text-secondary)] mb-4">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={clearFilters}
              className="btn"
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
