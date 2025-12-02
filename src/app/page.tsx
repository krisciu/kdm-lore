'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getCategoriesWithCounts, getLoreEntries, categories } from '@/data/lore';
import LoreCard from '@/components/LoreCard';

export default function Home() {
  const loreEntries = getLoreEntries();
  const categoriesWithCounts = getCategoriesWithCounts();
  const featuredEntries = loreEntries.slice(0, 4);
  const monsterCount = loreEntries.filter(e => e.category === 'monster').length;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center">
        {/* Background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--red)] rounded-full opacity-[0.02] blur-[150px]" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[var(--text-muted)] text-xs tracking-[0.3em] uppercase mb-6"
          >
            The Definitive Resource
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-[var(--font-display)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-[0.15em] uppercase mb-8"
          >
            <span className="block text-white">Kingdom Death</span>
            <span className="block text-[var(--red)] mt-2">Lore Compendium</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[var(--text-secondary)] text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Delve into the darkness. A comprehensive archive of monsters, 
            survivors, and the cosmic horrors that lurk beyond the lantern&apos;s light.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/lore" className="btn btn-primary">
              Explore the Compendium
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/research" className="btn">
              Research Lab
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-px h-16 bg-gradient-to-b from-[var(--text-muted)] to-transparent" />
        </motion.div>
      </section>

      {/* Stats */}
      <section className="py-20 border-y border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { label: 'Lore Entries', value: loreEntries.length },
              { label: 'Categories', value: categories.length },
              { label: 'Monsters', value: monsterCount },
              { label: 'Research Active', value: '∞' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center"
              >
                <div className="font-[var(--font-display)] text-3xl md:text-4xl text-white mb-2 tracking-wider">
                  {stat.value}
                </div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-muted)]">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mb-16"
          >
            <h2 className="font-[var(--font-display)] text-2xl tracking-wider uppercase mb-4">
              Browse by <span className="text-[var(--red)]">Category</span>
            </h2>
            <p className="text-[var(--text-secondary)]">
              Navigate through the compendium organized by type.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoriesWithCounts.filter(c => c.count > 0).map((category, idx) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  href={`/lore?category=${category.id}`}
                  className="group block p-6 bg-[var(--black-raised)] border border-[var(--border-subtle)] hover:border-[var(--border)] transition-all"
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase text-white group-hover:text-[var(--red)] transition-colors">
                      {category.name}
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">
                      {category.count}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                    {category.description}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="py-24 bg-[var(--black-raised)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <h2 className="font-[var(--font-display)] text-2xl tracking-wider uppercase mb-2">
                Featured <span className="text-[var(--red)]">Lore</span>
              </h2>
              <p className="text-[var(--text-secondary)] text-sm">
                Essential knowledge for understanding the darkness.
              </p>
            </div>
            <Link
              href="/lore"
              className="hidden md:flex items-center gap-2 text-xs tracking-wider uppercase text-[var(--text-muted)] hover:text-white transition-colors"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {featuredEntries.map((entry, idx) => (
              <LoreCard key={entry.id} entry={entry} variant="featured" index={idx} />
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link href="/lore" className="btn">
              View All Lore <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Research CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-[var(--font-display)] text-2xl md:text-3xl tracking-wider uppercase mb-6">
              The <span className="text-[var(--red)]">Research Lab</span>
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-lg mx-auto">
              AI-powered lore discovery. Ask questions, explore connections, 
              and help expand the compendium with new findings.
            </p>
            <Link href="/research" className="btn btn-primary">
              Enter Research Lab
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-24 border-t border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <motion.blockquote
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xl md:text-2xl italic text-[var(--text-secondary)] leading-relaxed border-none pl-0"
          >
            &ldquo;In the darkness, there is no history. There is only survival, 
            and the stories we tell to make sense of the void.&rdquo;
          </motion.blockquote>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]"
          >
            — Unknown Survivor
          </motion.p>
        </div>
      </section>
    </div>
  );
}
