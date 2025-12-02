'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowRight, BookOpen, Bot, FileText, Clock, 
  CheckCircle, AlertCircle, Loader2, FolderOpen 
} from 'lucide-react';
import { categories } from '@/data/lore';
import { LoreEntry, CategoryInfo } from '@/types/lore';
import LoreCard from '@/components/LoreCard';

interface AgentStatus {
  state: {
    status: string;
    currentTask: string | null;
    stats: {
      entriesGenerated: number;
      entriesApproved: number;
    };
  };
  queue: {
    queued: number;
    pendingReview: number;
  };
}

interface SourceStats {
  totalFiles: number;
  byType: Record<string, number>;
}

export default function Home() {
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryInfo[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Fetch lore entries
    fetch('/api/lore')
      .then(res => res.json())
      .then(data => {
        setLoreEntries(data.entries || []);
        // Calculate category counts
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

    // Calculate source stats (simplified)
    setSourceStats({
      totalFiles: 400, // Approximate from directory listing
      byType: {
        'Shop Pages': 265,
        'Rulebook Pages': 102,
        'News/Updates': 11,
        'Community': 22,
      }
    });
  }, []);

  const featuredEntries = loreEntries.slice(0, 4);
  const monsterCount = loreEntries.filter(e => e.category === 'monster').length;

  const agentRunning = agentStatus?.state?.status === 'running';

  return (
    <div className="min-h-screen">
      {/* Hero Section - Compact */}
      <section className="relative pt-32 pb-16">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--red)] rounded-full opacity-[0.02] blur-[150px]" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-[var(--font-display)] text-3xl sm:text-4xl md:text-5xl tracking-[0.15em] uppercase mb-4"
          >
            <span className="text-white">Kingdom Death</span>
            <span className="text-[var(--red)]"> Lore</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--text-secondary)] max-w-xl mx-auto"
          >
            AI-powered research compendium. Discover, generate, and curate lore from official sources.
          </motion.p>
        </div>
      </section>

      {/* Dashboard Grid */}
      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Compendium Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[var(--black-raised)] border border-[var(--border-subtle)] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[var(--black-elevated)] border border-[var(--border)]">
                  <BookOpen className="w-5 h-5 text-[var(--red)]" />
                </div>
                <div>
                  <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase">Compendium</h3>
                  <p className="text-xs text-[var(--text-muted)]">Published Lore</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">Total Entries</span>
                  <span className="font-mono text-lg text-white">{isLoaded ? loreEntries.length : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">Monsters</span>
                  <span className="font-mono text-[var(--red)]">{isLoaded ? monsterCount : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">Categories</span>
                  <span className="font-mono">{categoriesWithCounts.filter(c => c.count > 0).length}</span>
                </div>
              </div>

              <Link href="/lore" className="btn w-full justify-center">
                Browse Compendium <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Agent Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[var(--black-raised)] border border-[var(--border-subtle)] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[var(--black-elevated)] border border-[var(--border)]">
                  <Bot className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase">Research Agent</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {agentRunning ? (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                      </span>
                    ) : 'Idle'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">Discovery Queue</span>
                  <span className="font-mono">{agentStatus?.queue?.queued || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">Pending Review</span>
                  <span className="font-mono text-amber-500">{pendingCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)]">Approved</span>
                  <span className="font-mono text-emerald-500">{agentStatus?.state?.stats?.entriesApproved || 0}</span>
                </div>
              </div>

              <Link href="/agent" className="btn w-full justify-center">
                Agent Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Sources Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[var(--black-raised)] border border-[var(--border-subtle)] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[var(--black-elevated)] border border-[var(--border)]">
                  <FolderOpen className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase">Sources</h3>
                  <p className="text-xs text-[var(--text-muted)]">Raw Materials</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {sourceStats && Object.entries(sourceStats.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm text-[var(--text-secondary)]">{type}</span>
                    <span className="font-mono text-xs">{count}</span>
                  </div>
                ))}
              </div>

              <Link href="/lore" className="btn w-full justify-center opacity-50 cursor-not-allowed" aria-disabled>
                Browse Sources <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Workflow Status */}
      <section className="py-8 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[var(--black-raised)] border border-[var(--border-subtle)] p-6">
            <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase mb-6">
              Research <span className="text-[var(--red)]">Pipeline</span>
            </h3>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
              {/* Step 1: Sources */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Sources</div>
                  <div className="font-mono text-sm">400+ files</div>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-[var(--text-muted)] hidden md:block" />

              {/* Step 2: Discovery */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Discovery Queue</div>
                  <div className="font-mono text-sm">{agentStatus?.queue?.queued || 0} entities</div>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-[var(--text-muted)] hidden md:block" />

              {/* Step 3: Review */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  pendingCount > 0 
                    ? 'bg-amber-500/20 border border-amber-500/50' 
                    : 'bg-[var(--black-elevated)] border border-[var(--border)]'
                }`}>
                  <Clock className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-500' : 'text-[var(--text-muted)]'}`} />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Pending Review</div>
                  <div className="font-mono text-sm">{pendingCount} entries</div>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-[var(--text-muted)] hidden md:block" />

              {/* Step 4: Published */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Published</div>
                  <div className="font-mono text-sm">{isLoaded ? loreEntries.length : '—'} entries</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-[var(--font-display)] text-xl tracking-wider uppercase">
              Browse by <span className="text-[var(--red)]">Category</span>
            </h2>
            <Link
              href="/lore"
              className="text-xs tracking-wider uppercase text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-2"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categoriesWithCounts.filter(c => c.count > 0).map((category, idx) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  href={`/lore?category=${category.id}`}
                  className="group block p-4 bg-[var(--black-raised)] border border-[var(--border-subtle)] hover:border-[var(--red)]/50 transition-all"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xs tracking-wider uppercase text-white group-hover:text-[var(--red)] transition-colors">
                      {category.name}
                    </h3>
                    <span className="text-xs text-[var(--text-muted)] font-mono">
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
        <section className="py-12 px-6 lg:px-8 bg-[var(--black-raised)]">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-[var(--font-display)] text-xl tracking-wider uppercase mb-8">
              Recent <span className="text-[var(--red)]">Entries</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {featuredEntries.map((entry, idx) => (
                <LoreCard key={entry.id} entry={entry} variant="featured" index={idx} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer Quote */}
      <section className="py-16 border-t border-[var(--border-subtle)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <blockquote className="text-lg italic text-[var(--text-secondary)] leading-relaxed">
            &ldquo;In the darkness, there is no history. There is only survival, 
            and the stories we tell to make sense of the void.&rdquo;
          </blockquote>
          <p className="mt-4 text-xs tracking-[0.2em] uppercase text-[var(--text-muted)]">
            — Unknown Survivor
          </p>
        </div>
      </section>
    </div>
  );
}
