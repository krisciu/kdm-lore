'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Skull, 
  MapPin, 
  Users, 
  Swords, 
  Scroll, 
  Sparkles,
  Eye,
  ArrowRight,
  Flame,
  BookOpen,
  Brain
} from 'lucide-react';
import { getCategoriesWithCounts, getLoreEntries, categories } from '@/data/lore';

const categoryIcons: Record<string, React.ElementType> = {
  monster: Skull,
  location: MapPin,
  survivor: Users,
  settlement: Flame,
  item: Swords,
  event: Scroll,
  philosophy: Sparkles,
  entity: Eye,
};

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Home() {
  const loreEntries = getLoreEntries();
  const categoriesWithCounts = getCategoriesWithCounts();
  const featuredEntries = loreEntries.slice(0, 4);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--void-black)] to-[var(--void-black)]" />
          
          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-lantern/30 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [-20, 20, -20],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
          
          {/* Central glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lantern/5 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="mb-8"
          >
            <div className="relative inline-block">
              <Flame className="w-20 h-20 mx-auto text-lantern animate-lantern" />
              <div className="absolute inset-0 blur-xl bg-lantern/40 animate-lantern" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-7xl font-[var(--font-display)] tracking-[0.15em] mb-6"
          >
            <span className="text-parchment">KINGDOM DEATH</span>
            <br />
            <span className="text-lantern glow-lantern">LORE COMPENDIUM</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-[var(--text-secondary)] max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Delve into the darkness. Uncover the mysteries of monsters, survivors, and the 
            cosmic horrors that lurk beyond the lantern&apos;s light.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/lore"
              className="btn btn-primary flex items-center gap-2 text-base"
            >
              <BookOpen className="w-5 h-5" />
              Explore the Lore
            </Link>
            <Link
              href="/research"
              className="btn flex items-center gap-2 text-base"
            >
              <Brain className="w-5 h-5" />
              Research Lab
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-[var(--weathered-bone)]/50 rounded-full flex justify-center">
            <div className="w-1.5 h-3 bg-lantern/50 rounded-full mt-2" />
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-[var(--weathered-bone)]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { label: 'Lore Entries', value: loreEntries.length, icon: BookOpen },
              { label: 'Categories', value: categories.length, icon: Scroll },
              { label: 'Monsters', value: loreEntries.filter(e => e.category === 'monster').length, icon: Skull },
              { label: 'Active Research', value: '∞', icon: Brain },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeInUp}
                className="text-center"
              >
                <stat.icon className="w-8 h-8 mx-auto mb-3 text-lantern/60" />
                <div className="text-3xl md:text-4xl font-[var(--font-display)] text-parchment mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-[var(--text-muted)] uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-[var(--font-display)] tracking-wider mb-4">
              EXPLORE THE <span className="text-lantern">DARKNESS</span>
            </h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
              Navigate through the vast compendium of Kingdom Death lore, organized by category.
            </p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {categoriesWithCounts.map((category) => {
              const Icon = categoryIcons[category.id] || Scroll;
              return (
                <motion.div key={category.id} variants={fadeInUp}>
                  <Link
                    href={`/lore?category=${category.id}`}
                    className="lore-card block p-6 text-center group"
                  >
                    <Icon className="w-10 h-10 mx-auto mb-4 text-[var(--text-muted)] group-hover:text-lantern transition-colors" />
                    <h3 className="font-[var(--font-display)] text-lg tracking-wider mb-2 group-hover:text-lantern transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] mb-3 line-clamp-2">
                      {category.description}
                    </p>
                    <span className="tag">
                      {category.count} {category.count === 1 ? 'entry' : 'entries'}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Featured Lore Section */}
      <section className="py-20 bg-stone/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-12"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-[var(--font-display)] tracking-wider mb-2">
                FEATURED <span className="text-lantern">LORE</span>
              </h2>
              <p className="text-[var(--text-secondary)]">
                Essential knowledge for understanding the darkness
              </p>
            </div>
            <Link
              href="/lore"
              className="hidden md:flex items-center gap-2 text-lantern hover:text-parchment transition-colors"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-6"
          >
            {featuredEntries.map((entry) => {
              const Icon = categoryIcons[entry.category] || Scroll;
              return (
                <motion.div key={entry.id} variants={fadeInUp}>
                  <Link
                    href={`/lore/${entry.slug}`}
                    className="lore-card block p-6 h-full group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-[var(--weathered-bone)]/10 rounded">
                        <Icon className="w-6 h-6 text-lantern/70" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`tag tag-${entry.category}`}>
                            {entry.category}
                          </span>
                          {entry.monsterType && (
                            <span className="tag">{entry.monsterType}</span>
                          )}
                        </div>
                        <h3 className="text-xl font-[var(--font-display)] tracking-wider mb-2 group-hover:text-lantern transition-colors">
                          {entry.title}
                        </h3>
                        <p className="text-[var(--text-secondary)] text-sm line-clamp-2">
                          {entry.summary}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="mt-8 text-center md:hidden">
            <Link
              href="/lore"
              className="btn inline-flex items-center gap-2"
            >
              View All Lore <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Research Lab CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="relative inline-block mb-8">
              <Brain className="w-16 h-16 text-lantern" />
              <motion.div
                className="absolute inset-0 blur-xl bg-lantern/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-[var(--font-display)] tracking-wider mb-6">
              THE <span className="text-lantern">RESEARCH LAB</span>
            </h2>
            
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
              Our AI-powered research system continuously explores and expands the lore compendium. 
              Propose new entries, verify existing knowledge, and help uncover the deepest mysteries 
              of Kingdom Death.
            </p>
            
            <Link
              href="/research"
              className="btn btn-primary inline-flex items-center gap-2 text-lg"
            >
              <Brain className="w-5 h-5" />
              Enter the Research Lab
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-20 border-t border-[var(--weathered-bone)]/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.blockquote
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="text-2xl md:text-3xl italic text-[var(--text-secondary)] leading-relaxed"
          >
            &ldquo;In the darkness, there is no history. There is only survival, 
            and the stories we tell to make sense of the void.&rdquo;
          </motion.blockquote>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mt-6 text-lantern font-[var(--font-display)] tracking-wider"
          >
            — Unknown Survivor
          </motion.p>
        </div>
      </section>
    </div>
  );
}
