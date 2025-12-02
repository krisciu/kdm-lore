'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Database,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Eye,
  ChevronRight,
  Activity,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Search,
  Filter,
  Layers,
  GitBranch,
  Target,
  Cpu,
} from 'lucide-react';

interface SchedulerState {
  enabled: boolean;
  lastRun?: string;
  nextScheduledRun?: string;
  intervalMinutes: number;
  maxTasksPerRun: number;
  autoCreateTasks: boolean;
  stats: {
    totalRuns: number;
    totalTasksProcessed: number;
    totalEntriesCreated: number;
    lastSuccessfulRun?: string;
  };
}

interface SourceStats {
  totalFiles: number;
  totalEntities: number;
  byType: Record<string, number>;
  lastUpdated?: string;
}

interface Task {
  id: string;
  type: string;
  status: string;
  topic: string;
  description: string;
  priority: number;
  createdAt: string;
  suggestedEntry?: {
    title: string;
    category: string;
    summary: string;
    confidence: string;
  };
}

interface ParsedEntity {
  name: string;
  type: string;
  description: string;
  tags: string[];
  sourceFile: string;
}

interface PipelineState {
  lastRun?: string;
  stages: {
    index: { lastRun?: string; sourcesIndexed: number };
    extract: { lastRun?: string; entitiesExtracted: number };
    analyze: { lastRun?: string; connectionsFound: number };
    generate: { lastRun?: string; entriesGenerated: number };
    review: { pending: number; approved: number; rejected: number };
  };
  stats: {
    totalSources: number;
    totalEntities: number;
    byType: Record<string, number>;
    coverage: {
      withLoreEntry: number;
      needsEntry: number;
      needsExpansion: number;
    };
  };
}

interface ExtractedEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  confidence: string;
  hasLoreEntry: boolean;
  sources: Array<{ sourcePath: string; sourceType: string }>;
  tags: string[];
  node?: string;
  expansionSource?: string;
}

export default function AgentDashboard() {
  const [schedulerState, setSchedulerState] = useState<SchedulerState | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [entities, setEntities] = useState<ParsedEntity[]>([]);
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningStage, setRunningStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'entities' | 'queue' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, pendingRes, entitiesRes, pipelineRes, extractedRes] = await Promise.all([
        fetch('/api/agent?action=status'),
        fetch('/api/agent?action=pending'),
        fetch('/api/agent?action=entities&limit=20'),
        fetch('/api/pipeline?action=status'),
        fetch('/api/pipeline?action=entities&limit=50'),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setSchedulerState(data.state);
        setSourceStats(data.sourceStats);
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingTasks(data.tasks || []);
      }

      if (entitiesRes.ok) {
        const data = await entitiesRes.json();
        setEntities(data.entities || []);
      }

      if (pipelineRes.ok) {
        const data = await pipelineRes.json();
        setPipelineState(data.state);
      }

      if (extractedRes.ok) {
        const data = await extractedRes.json();
        setExtractedEntities(data.entities || []);
      }
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const runAgent = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      
      if (res.ok) {
        const result = await res.json();
        console.log('Agent run result:', result);
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to run agent:', error);
    } finally {
      setRunning(false);
    }
  };

  const toggleAgent = async () => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'toggle', 
          enabled: !schedulerState?.enabled 
        }),
      });
      
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  const approveTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', taskId }),
      });
      
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to approve task:', error);
    }
  };

  const rejectTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', taskId }),
      });
      
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to reject task:', error);
    }
  };

  const generateTasks = async () => {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_tasks' }),
      });
      
      if (res.ok) {
        const result = await res.json();
        console.log('Generated tasks:', result);
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to generate tasks:', error);
    }
  };

  const runPipelineStage = async (stage: 'index' | 'extract' | 'analyze' | 'generate' | 'all') => {
    setRunningStage(stage);
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: stage === 'all' ? 'run' : stage,
          generateLimit: 10,
        }),
      });
      
      if (res.ok) {
        const result = await res.json();
        console.log(`Pipeline ${stage} result:`, result);
        await fetchData();
      }
    } catch (error) {
      console.error(`Failed to run pipeline ${stage}:`, error);
    } finally {
      setRunningStage(null);
    }
  };

  const createEntityEntry = async (entityId: string) => {
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_entry', entityId }),
      });
      
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to create entry:', error);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Bot className="w-12 h-12 text-violet-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-[var(--weathered-bone)]/20">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-transparent to-emerald-900/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 70% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 40%)
          `,
        }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <motion.div
                  animate={schedulerState?.enabled ? { 
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 1, 0.5] 
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-violet-500/30 rounded-full blur-xl"
                />
                <div className={`relative p-4 rounded-2xl ${
                  schedulerState?.enabled 
                    ? 'bg-gradient-to-br from-violet-500/20 to-emerald-500/20 border border-violet-500/30' 
                    : 'bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/20'
                }`}>
                  <Bot className={`w-10 h-10 ${schedulerState?.enabled ? 'text-violet-400' : 'text-[var(--text-muted)]'}`} />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-[var(--font-display)] tracking-wider">
                  RESEARCH <span className="text-violet-400">AGENT</span>
                </h1>
                <p className="text-[var(--text-muted)] flex items-center gap-2">
                  {schedulerState?.enabled ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Active • Next run {formatDate(schedulerState.nextScheduledRun)}
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Paused
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleAgent}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  schedulerState?.enabled
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                }`}
              >
                {schedulerState?.enabled ? (
                  <><Pause className="w-4 h-4" /> Pause</>
                ) : (
                  <><Play className="w-4 h-4" /> Enable</>
                )}
              </button>
              
              <button
                onClick={runAgent}
                disabled={running}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30 transition-all disabled:opacity-50"
              >
                {running ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Run Now
              </button>

              <Link
                href="/changelog"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--dark-stone)] text-[var(--text-secondary)] rounded-lg hover:text-white transition-all"
              >
                <Activity className="w-4 h-4" />
                Changelog
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--dark-stone)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--weathered-bone)]/20"
            >
              <div className="text-2xl font-bold text-violet-400">
                {schedulerState?.stats.totalRuns || 0}
              </div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Runs</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[var(--dark-stone)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--weathered-bone)]/20"
            >
              <div className="text-2xl font-bold text-emerald-400">
                {schedulerState?.stats.totalEntriesCreated || 0}
              </div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Entries Created</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[var(--dark-stone)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--weathered-bone)]/20"
            >
              <div className="text-2xl font-bold text-amber-400">
                {pendingTasks.length}
              </div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Pending Review</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[var(--dark-stone)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--weathered-bone)]/20"
            >
              <div className="text-2xl font-bold text-sky-400">
                {sourceStats?.totalEntities || 0}
              </div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Source Entities</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[var(--dark-stone)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--weathered-bone)]/20"
            >
              <div className="text-2xl font-bold text-rose-400">
                {sourceStats?.totalFiles || 0}
              </div>
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Source Files</div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 border-b border-[var(--weathered-bone)]/20 pb-4 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'queue', label: 'Review Queue', icon: Clock, badge: pendingTasks.length },
            { id: 'sources', label: 'Source Data', icon: Database },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-[var(--text-muted)] hover:text-white hover:bg-[var(--weathered-bone)]/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge ? (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Recent Activity */}
              <div className="bg-[var(--dark-stone)]/30 rounded-lg p-6 border border-[var(--weathered-bone)]/20">
                <h3 className="text-lg font-[var(--font-display)] tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  Agent Activity
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Last Run</span>
                    <span>{formatDate(schedulerState?.lastRun)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Last Success</span>
                    <span className="text-emerald-400">{formatDate(schedulerState?.stats.lastSuccessfulRun)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Tasks Processed</span>
                    <span>{schedulerState?.stats.totalTasksProcessed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-muted)]">Run Interval</span>
                    <span>{schedulerState?.intervalMinutes || 30} minutes</span>
                  </div>
                </div>
              </div>

              {/* Source Stats */}
              <div className="bg-[var(--dark-stone)]/30 rounded-lg p-6 border border-[var(--weathered-bone)]/20">
                <h3 className="text-lg font-[var(--font-display)] tracking-wider mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-400" />
                  Source Breakdown
                </h3>
                <div className="space-y-3">
                  {sourceStats?.byType && Object.entries(sourceStats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-muted)] capitalize">{type}s</span>
                      <span className="px-2 py-0.5 bg-[var(--weathered-bone)]/10 rounded text-xs">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="md:col-span-2 bg-[var(--dark-stone)]/30 rounded-lg p-6 border border-[var(--weathered-bone)]/20">
                <h3 className="text-lg font-[var(--font-display)] tracking-wider mb-4">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={generateTasks}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-all"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Generate Tasks from Sources
                  </button>
                  <button
                    onClick={() => {/* TODO */}}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500/20 text-sky-300 rounded-lg hover:bg-sky-500/30 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve All Pending
                  </button>
                  <Link
                    href="/lore"
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--weathered-bone)]/10 text-[var(--text-secondary)] rounded-lg hover:text-white transition-all"
                  >
                    <BookOpen className="w-4 h-4" />
                    View Compendium
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'queue' && (
            <motion.div
              key="queue"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {pendingTasks.length === 0 ? (
                <div className="text-center py-20">
                  <CheckCircle className="w-16 h-16 text-emerald-400/50 mx-auto mb-4" />
                  <h3 className="text-xl font-[var(--font-display)] tracking-wider mb-2">All Caught Up!</h3>
                  <p className="text-[var(--text-muted)]">No tasks pending review.</p>
                  <button
                    onClick={generateTasks}
                    className="mt-4 px-4 py-2 bg-violet-500/20 text-violet-300 rounded-lg hover:bg-violet-500/30 transition-all"
                  >
                    Generate New Tasks
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[var(--dark-stone)]/30 rounded-lg p-4 border border-[var(--weathered-bone)]/20 hover:border-violet-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{task.topic}</h4>
                            <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded-full">
                              {task.type.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              task.suggestedEntry?.confidence === 'confirmed' 
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : task.suggestedEntry?.confidence === 'likely'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-orange-500/20 text-orange-300'
                            }`}>
                              {task.suggestedEntry?.confidence || 'speculative'}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-muted)] mb-2">
                            {task.suggestedEntry?.summary || task.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                            <span>Priority: {task.priority}/10</span>
                            <span>Created: {formatDate(task.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveTask(task.id)}
                            className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-all"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => rejectTask(task.id)}
                            className="p-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-all"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                          <button
                            className="p-2 bg-[var(--weathered-bone)]/10 text-[var(--text-secondary)] rounded-lg hover:text-white transition-all"
                            title="Preview"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'sources' && (
            <motion.div
              key="sources"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search parsed entities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/30 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entities
                  .filter(e => 
                    !searchQuery || 
                    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    e.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((entity, index) => (
                    <motion.div
                      key={`${entity.name}-${index}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-[var(--dark-stone)]/30 rounded-lg p-4 border border-[var(--weathered-bone)]/20 hover:border-violet-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{entity.name}</h4>
                        <span className="px-2 py-0.5 text-xs bg-sky-500/20 text-sky-300 rounded-full capitalize">
                          {entity.type}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-3">
                        {entity.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {entity.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-[var(--weathered-bone)]/10 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))
                }
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl"
            >
              <div className="bg-[var(--dark-stone)]/30 rounded-lg p-6 border border-[var(--weathered-bone)]/20 space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Run Interval (minutes)</label>
                  <input
                    type="number"
                    value={schedulerState?.intervalMinutes || 30}
                    className="w-full px-4 py-2 bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/30 rounded-lg"
                    disabled
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">How often the agent checks for new tasks</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Tasks Per Run</label>
                  <input
                    type="number"
                    value={schedulerState?.maxTasksPerRun || 3}
                    className="w-full px-4 py-2 bg-[var(--dark-stone)] border border-[var(--weathered-bone)]/30 rounded-lg"
                    disabled
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">Maximum tasks to process in a single run</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">Auto-Generate Tasks</label>
                    <p className="text-xs text-[var(--text-muted)]">Automatically create tasks from sources</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-all ${
                    schedulerState?.autoCreateTasks ? 'bg-emerald-500' : 'bg-[var(--weathered-bone)]/30'
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-all ${
                      schedulerState?.autoCreateTasks ? 'translate-x-6' : 'translate-x-0.5'
                    } mt-0.5`} />
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--weathered-bone)]/20">
                  <p className="text-sm text-[var(--text-muted)]">
                    <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-400" />
                    Settings modification coming soon. Current values are read-only.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

