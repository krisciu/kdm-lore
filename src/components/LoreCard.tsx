'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { LoreEntry } from '@/types/lore';

interface LoreCardProps {
  entry: LoreEntry;
  variant?: 'default' | 'compact' | 'featured';
  index?: number;
}

export default function LoreCard({ entry, variant = 'default', index = 0 }: LoreCardProps) {
  const isMonster = entry.category === 'monster';

  if (variant === 'compact') {
    return (
      <Link href={`/lore/${entry.slug}`} className="group block">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03, duration: 0.4 }}
          className="flex items-center justify-between py-4 px-2 -mx-2 rounded hover:bg-[var(--shadow)] border-b border-[var(--border-subtle)] group-hover:border-transparent transition-all"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
            <div className={`w-1 h-8 rounded-full flex-shrink-0 transition-all ${
              isMonster 
                ? 'bg-[var(--blood)] group-hover:bg-[var(--scarlet)]' 
                : 'bg-[var(--border)] group-hover:bg-[var(--dust)]'
            }`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-0.5">
                <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase text-[var(--bone)] group-hover:text-[var(--scarlet)] transition-colors truncate">
                  {entry.title}
                </h3>
                <span className={`text-[9px] tracking-[0.15em] uppercase flex-shrink-0 ${
                  isMonster ? 'text-[var(--blood)]' : 'text-[var(--dust)]'
                }`}>
                  {entry.category}
                </span>
              </div>
              <p className="text-sm text-[var(--dust)] truncate">
                {entry.summary}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--smoke)] group-hover:text-[var(--scarlet)] group-hover:translate-x-1 transition-all flex-shrink-0" />
        </motion.div>
      </Link>
    );
  }

  if (variant === 'featured') {
    return (
      <Link href={`/lore/${entry.slug}`} className="group block h-full">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5 }}
          className="lore-card relative h-full"
        >
          <div className="relative z-10 p-8 flex flex-col h-full">
            {/* Category Badge */}
            <div className="flex items-center gap-3 mb-5">
              <span className={`text-[9px] tracking-[0.2em] uppercase px-2.5 py-1.5 border rounded ${
                isMonster 
                  ? 'border-[var(--blood)]/40 text-[var(--scarlet)] bg-[var(--blood)]/10' 
                  : 'border-[var(--border)] text-[var(--dust)]'
              }`}>
                {entry.category}
              </span>
              {entry.monsterType && (
                <span className="text-[9px] tracking-wider uppercase text-[var(--smoke)]">
                  / {entry.monsterType}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-[var(--font-display)] text-xl tracking-[0.1em] uppercase mb-4 text-[var(--bone)] group-hover:text-[var(--scarlet)] transition-colors leading-tight">
              {entry.title}
            </h3>

            {/* Summary */}
            <p className="text-[var(--ash)] text-[15px] leading-relaxed flex-1 line-clamp-3 mb-6">
              {entry.summary}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-5 border-t border-[var(--border-subtle)]">
              <span className={`text-[9px] tracking-[0.15em] uppercase ${
                entry.confidence === 'confirmed' 
                  ? 'text-[var(--success-light)]' 
                  : entry.confidence === 'likely'
                    ? 'text-[var(--warning-light)]'
                    : 'text-[var(--dust)]'
              }`}>
                {entry.confidence}
              </span>
              <div className="flex items-center gap-2 text-[var(--dust)] group-hover:text-[var(--scarlet)] transition-colors">
                <span className="text-[10px] tracking-wider uppercase">Read</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </motion.article>
      </Link>
    );
  }

  // Default variant
  return (
    <Link href={`/lore/${entry.slug}`} className="group block h-full">
      <motion.article
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.4 }}
        className="lore-card relative h-full"
      >
        <div className="relative z-10 p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[9px] tracking-[0.15em] uppercase px-2 py-1 border ${
                isMonster 
                  ? 'border-[var(--blood)]/40 text-[var(--scarlet)] bg-[var(--blood)]/5' 
                  : 'border-[var(--border)] text-[var(--dust)]'
              }`}>
                {entry.category}
              </span>
              {entry.monsterType && (
                <span className="text-[9px] tracking-wider uppercase text-[var(--smoke)]">
                  {entry.monsterType}
                </span>
              )}
              {entry.level && (
                <span className="text-[9px] tracking-wider uppercase text-[var(--smoke)]">
                  Lv.{entry.level}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-[var(--font-display)] text-base tracking-[0.1em] uppercase mb-3 text-[var(--bone)] group-hover:text-[var(--scarlet)] transition-colors leading-tight">
            {entry.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-[var(--dust)] line-clamp-2 mb-5 flex-1">
            {entry.summary}
          </p>

          {/* Tags & Arrow */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-[10px] text-[var(--smoke)] overflow-hidden">
              {entry.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="truncate">#{tag}</span>
              ))}
              {entry.tags.length > 2 && (
                <span>+{entry.tags.length - 2}</span>
              )}
            </div>
            <ArrowUpRight className="w-4 h-4 text-[var(--smoke)] group-hover:text-[var(--scarlet)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
