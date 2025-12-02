'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className="flex items-center justify-between py-4 border-b border-[var(--border-subtle)] group-hover:border-[var(--border)] transition-colors"
        >
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase text-white group-hover:text-[var(--red)] transition-colors truncate">
                {entry.title}
              </h3>
              <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)] flex-shrink-0">
                {entry.category}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] truncate">
              {entry.summary}
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--red)] transition-colors flex-shrink-0" />
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
          transition={{ delay: index * 0.1 }}
          className="relative h-full p-8 bg-[var(--black-raised)] border border-[var(--border-subtle)] group-hover:border-[var(--border)] transition-all"
        >
          {/* Red accent line */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[var(--red)] via-[var(--red-dark)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex flex-col h-full">
            {/* Category */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-[10px] tracking-[0.2em] uppercase ${isMonster ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'}`}>
                {entry.category}
              </span>
              {entry.monsterType && (
                <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)]">
                  / {entry.monsterType}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-[var(--font-display)] text-xl tracking-wider uppercase mb-4 text-white group-hover:text-[var(--red)] transition-colors">
              {entry.title}
            </h3>

            {/* Summary */}
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed flex-1 line-clamp-3 mb-6">
              {entry.summary}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)]">
                {entry.confidence}
              </span>
              <ArrowUpRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--red)] transition-colors" />
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
        transition={{ delay: index * 0.04 }}
        className="relative h-full p-6 bg-[var(--black-raised)] border border-[var(--border-subtle)] group-hover:border-[var(--border)] transition-all"
      >
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/30 pointer-events-none" />
        
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] tracking-[0.15em] uppercase px-2 py-1 border ${
                isMonster 
                  ? 'border-[var(--red-dark)] text-[var(--red)]' 
                  : 'border-[var(--border)] text-[var(--text-muted)]'
              }`}>
                {entry.category}
              </span>
              {entry.monsterType && (
                <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)]">
                  {entry.monsterType}
                </span>
              )}
              {entry.level && (
                <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)]">
                  Lv.{entry.level}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-[var(--font-display)] text-base tracking-wider uppercase mb-3 text-white group-hover:text-[var(--red)] transition-colors leading-tight">
            {entry.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-4 flex-1">
            {entry.summary}
          </p>

          {/* Tags */}
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            {entry.tags.slice(0, 3).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
            {entry.tags.length > 3 && (
              <span>+{entry.tags.length - 3}</span>
            )}
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
