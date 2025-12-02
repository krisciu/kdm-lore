'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowRight, BookOpen, Bot, Sparkles, 
  CheckCircle, Clock, Zap, Archive,
  TrendingUp, Eye
} from 'lucide-react';
import { categories } from '@/data/lore';
import { LoreEntry, CategoryInfo } from '@/types/lore';
import LoreCard from '@/components/LoreCard';

interface AgentStatus {
  state: {
    status: string;
    currentTask: string | null;
    lastRun: string | null;
    stats: {
      entriesGenerated: number;
      entriesApproved: number;
      entitiesDiscovered: number;
    };
  };
  queue: {
    queued: number;
    pendingReview: number;
  };
}

export default function Home() {
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryInfo[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Fetch lore entries
    fetch('/api/lore')
      .then(res => res.json())
      .then(data => {
        setLoreEntries(data.entries || []);
        const counts = categories.map(cat => ({
          ...cat,
          count: (data.entries || []).filter((e: LoreEntry) => e.category === cat.id).length,
        }));
        setCategoriesWithCounts(counts);
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));

    // Fetch agent status
    fetch('/api/agent?action=status')
      .then(res => res.json())
      .then(data => setAgentStatus(data))
      .catch(() => {});

    // Fetch pending entries
    fetch('/api/agent?action=pending')
      .then(res => res.json())
      .then(data => setPendingCount(data.total || 0))
      .catch(() => {});
  }, []);

  const featuredEntries = loreEntries.slice(0, 4);
  const agentRunning = agentStatus?.state?.status === 'running';
  const totalEntries = loreEntries.length;
  const totalDiscovered = agentStatus?.state?.stats?.entitiesDiscovered || 0;

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--void)] via-transparent to-[var(--void)]" />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px]"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.03, 0.05, 0.03],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full rounded-full bg-[var(--blood)] blur-[200px]" />
          </motion.div>
          <motion.div
            className="absolute top-1/3 left-1/4 w-[400px] h-[400px]"
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
              opacity: [0.02, 0.04, 0.02],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full rounded-full bg-[var(--lantern)] blur-[150px]" />
          </motion.div>
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto pt-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Eyebrow */}
            <p className="font-[var(--font-display)] text-[10px] tracking-[0.4em] uppercase text-[var(--dust)] mb-8">
              The Definitive Archive
            </p>
            
            {/* Title */}
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-[0.2em] uppercase mb-6">
              <span className="block text-[var(--bone)]">Kingdom Death</span>
              <span className="block text-[var(--scarlet)] mt-2">Lore</span>
            </h1>
            
            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-lg sm:text-xl text-[var(--ash)] max-w-2xl mx-auto leading-relaxed"
            >
              AI-powered research compendium for the deepest mysteries of the darkness.
              Discover, explore, and preserve the lore.
            </motion.p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12"
          >
            <Link href="/lore" className="btn btn-primary btn-lg group">
              <BookOpen className="w-4 h-4" />
              Explore Compendium
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/agent" className="btn btn-lg">
              <Bot className="w-4 h-4" />
              Research Agent
            </Link>
          </motion.div>

          {/* Live Stats Strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex items-center justify-center gap-8 sm:gap-12 mt-16 pt-8 border-t border-[var(--border-subtle)]"
          >
            <div className="text-center">
              <div className="font-mono text-2xl sm:text-3xl text-[var(--bone)]">
                {isLoaded ? totalEntries : '—'}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--dust)] mt-1">
                Entries
              </div>
            </div>
            <div className="w-px h-10 bg-[var(--border-subtle)]" />
            <div className="text-center">
              <div className="font-mono text-2xl sm:text-3xl text-[var(--scarlet)]">
                {totalDiscovered || '—'}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--dust)] mt-1">
                Discovered
              </div>
            </div>
            <div className="w-px h-10 bg-[var(--border-subtle)]" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className={`w-2 h-2 rounded-full ${agentRunning ? 'bg-[var(--warning-light)] animate-pulse' : 'bg-[var(--success-light)]'}`} />
                <span className="font-mono text-sm text-[var(--bone)]">
                  {agentRunning ? 'Active' : 'Ready'}
                </span>
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--dust)] mt-1">
                Agent Status
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-[var(--dust)] to-transparent" />
        </motion.div>
      </section>

      {/* Quick Actions Dashboard */}
      <section className="py-16 sm:py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* Browse Lore */}
            <Link href="/lore" className="group">
              <div className="stat-card h-full hover:border-[var(--border-focus)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-[var(--obsidian)] border border-[var(--border-subtle)] rounded">
                    <BookOpen className="w-5 h-5 text-[var(--scarlet)]" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--dust)] group-hover:text-[var(--bone)] group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-[var(--font-display)] text-sm tracking-[0.15em] uppercase mb-2">
                  Compendium
                </h3>
                <p className="text-sm text-[var(--dust)] mb-4">
                  Browse all documented lore entries
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl text-[var(--bone)]">{isLoaded ? totalEntries : '—'}</span>
                  <span className="text-xs text-[var(--dust)]">entries</span>
                </div>
              </div>
            </Link>

            {/* Agent Dashboard */}
            <Link href="/agent" className="group">
              <div className="stat-card h-full hover:border-[var(--border-focus)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-[var(--obsidian)] border border-[var(--border-subtle)] rounded">
                    <Bot className={`w-5 h-5 ${agentRunning ? 'text-[var(--warning-light)]' : 'text-[var(--success-light)]'}`} />
                  </div>
                  {agentRunning && (
                    <span className="text-[9px] tracking-wider uppercase px-2 py-1 bg-[var(--warning)]/20 text-[var(--warning-light)] rounded">
                      Running
                    </span>
                  )}
                </div>
                <h3 className="font-[var(--font-display)] text-sm tracking-[0.15em] uppercase mb-2">
                  Research Agent
                </h3>
                <p className="text-sm text-[var(--dust)] mb-4">
                  Autonomous lore discovery system
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-mono text-2xl text-[var(--bone)]">{agentStatus?.queue?.queued || 0}</span>
                    <span className="text-xs text-[var(--dust)] ml-1">queued</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Pending Review */}
            <Link href="/agent?tab=review" className="group">
              <div className={`stat-card h-full hover:border-[var(--border-focus)] ${pendingCount > 0 ? 'stat-card-highlight' : ''}`}>
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-[var(--obsidian)] border border-[var(--border-subtle)] rounded">
                    <Eye className={`w-5 h-5 ${pendingCount > 0 ? 'text-[var(--scarlet)]' : 'text-[var(--dust)]'}`} />
                  </div>
                  {pendingCount > 0 && (
                    <span className="flex items-center justify-center w-6 h-6 bg-[var(--blood)] text-[var(--bone)] text-xs font-mono rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <h3 className="font-[var(--font-display)] text-sm tracking-[0.15em] uppercase mb-2">
                  Pending Review
                </h3>
                <p className="text-sm text-[var(--dust)] mb-4">
                  {pendingCount > 0 ? 'Entries awaiting approval' : 'All entries reviewed'}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-3xl ${pendingCount > 0 ? 'text-[var(--scarlet)]' : 'text-[var(--dust)]'}`}>
                    {pendingCount}
                  </span>
                  <span className="text-xs text-[var(--dust)]">pending</span>
                </div>
              </div>
            </Link>

            {/* Changelog */}
            <Link href="/changelog" className="group">
              <div className="stat-card h-full hover:border-[var(--border-focus)]">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-[var(--obsidian)] border border-[var(--border-subtle)] rounded">
                    <TrendingUp className="w-5 h-5 text-violet-400" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--dust)] group-hover:text-[var(--bone)] group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="font-[var(--font-display)] text-sm tracking-[0.15em] uppercase mb-2">
                  Changelog
                </h3>
                <p className="text-sm text-[var(--dust)] mb-4">
                  Track all modifications and updates
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl text-[var(--bone)]">{agentStatus?.state?.stats?.entriesApproved || 0}</span>
                  <span className="text-xs text-[var(--dust)]">approved</span>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Research Pipeline Visual */}
      <section className="py-12 px-6 lg:px-8 border-y border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="w-5 h-5 text-[var(--lantern)]" />
            <h2 className="font-[var(--font-display)] text-sm tracking-[0.2em] uppercase text-[var(--ash)]">
              Research Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0">
            {[
              { label: 'Sources', value: '400+', desc: 'Official materials', icon: Archive, color: 'text-sky-400' },
              { label: 'Discovered', value: totalDiscovered || '—', desc: 'Entities found', icon: Zap, color: 'text-violet-400' },
              { label: 'Pending', value: pendingCount, desc: 'Awaiting review', icon: Clock, color: pendingCount > 0 ? 'text-[var(--warning-light)]' : 'text-[var(--dust)]' },
              { label: 'Published', value: totalEntries, desc: 'Live entries', icon: CheckCircle, color: 'text-[var(--success-light)]' },
            ].map((step, idx) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative"
              >
                <div className="flex flex-col items-center text-center p-6">
                  <div className={`mb-4 ${step.color}`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div className="font-mono text-2xl md:text-3xl text-[var(--bone)] mb-1">
                    {step.value}
                  </div>
                  <div className="font-[var(--font-display)] text-[10px] tracking-[0.15em] uppercase text-[var(--ash)] mb-1">
                    {step.label}
                  </div>
                  <div className="text-xs text-[var(--dust)]">
                    {step.desc}
                  </div>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-[var(--smoke)]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 sm:py-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="font-[var(--font-display)] text-xl sm:text-2xl tracking-[0.15em] uppercase">
                Browse by <span className="text-[var(--scarlet)]">Category</span>
              </h2>
              <p className="text-sm text-[var(--dust)] mt-2">
                Explore the compendium by classification
              </p>
            </div>
            <Link
              href="/lore"
              className="hidden sm:flex items-center gap-2 text-xs tracking-[0.15em] uppercase text-[var(--dust)] hover:text-[var(--bone)] transition-colors"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categoriesWithCounts.filter(c => c.count > 0).map((category, idx) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  href={`/lore?category=${category.id}`}
                  className="group block p-5 bg-[var(--shadow)] border border-[var(--border-subtle)] hover:border-[var(--scarlet)]/30 transition-all"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`text-[10px] sm:text-xs tracking-[0.12em] uppercase group-hover:text-[var(--scarlet)] transition-colors ${
                      category.id === 'monster' ? 'text-[var(--scarlet)]' : 'text-[var(--bone)]'
                    }`}>
                      {category.name}
                    </h3>
                    <span className="text-xs text-[var(--dust)] font-mono">
                      {category.count}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Entries */}
      {featuredEntries.length > 0 && (
        <section className="py-16 sm:py-20 px-6 lg:px-8 bg-[var(--shadow)]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="font-[var(--font-display)] text-xl sm:text-2xl tracking-[0.15em] uppercase">
                  Recent <span className="text-[var(--scarlet)]">Discoveries</span>
                </h2>
                <p className="text-sm text-[var(--dust)] mt-2">
                  Latest additions to the compendium
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {featuredEntries.map((entry, idx) => (
                <LoreCard key={entry.id} entry={entry} variant="featured" index={idx} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Atmospheric Quote */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <div className="text-5xl text-[var(--blood)] opacity-30 mb-6">"</div>
            <blockquote className="text-xl sm:text-2xl italic text-[var(--ash)] leading-relaxed font-[var(--font-body)]">
              In the darkness, there is no history. There is only survival, 
              and the stories we tell to make sense of the void.
            </blockquote>
            <p className="mt-8 text-[10px] tracking-[0.3em] uppercase text-[var(--smoke)]">
              — Unknown Survivor
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
