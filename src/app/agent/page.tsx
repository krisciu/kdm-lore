'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Database,
  Zap,
  Eye,
  X,
} from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

// =============================================================================
// TYPES
// =============================================================================

interface AgentState {
  status: 'idle' | 'running' | 'paused' | 'error';
  lastRun: string | null;
  nextRun: string | null;
  currentTask: string | null;
  error: string | null;
  stats: {
    totalRuns: number;
    entitiesDiscovered: number;
    entriesGenerated: number;
    entriesApproved: number;
    entriesRejected: number;
  };
}

interface QueueEntity {
  id: string;
  name: string;
  type: string;
  brief: string;
  sourceFiles: string[];
  images: string[];
  priority: number;
  status: string;
  discoveredAt: string;
}

interface PendingEntry {
  id: string;
  entityName: string;
  content: string;
  frontmatter: Record<string, unknown>;
  sourceFiles: string[];
  images: Array<{ path: string; caption: string }>;
  confidence: string;
  createdAt: string;
}

interface AgentStatus {
  state: AgentState;
  config: {
    schedule: { intervalMinutes: number; maxEntriesPerRun: number };
  };
  queue: {
    discovered: number;
    queued: number;
    generating: number;
    pendingReview: number;
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AgentDashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [queue, setQueue] = useState<QueueEntity[]>([]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'review' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewEntry, setPreviewEntry] = useState<PendingEntry | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [statusRes, queueRes, pendingRes] = await Promise.all([
        fetch('/api/agent?action=status'),
        fetch('/api/agent?action=queue'),
        fetch('/api/agent?action=pending'),
      ]);

      if (statusRes.ok) setStatus(await statusRes.json());
      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueue(data.entities || []);
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPending(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    // Poll every 10 seconds when agent is running
    const interval = setInterval(() => {
      if (status?.state?.status === 'running') {
        loadData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, status?.state?.status]);

  // Actions
  const runAgent = async () => {
    setActionLoading('run');
    setMessage(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Discovered ${data.discovered} entities, generated ${data.generated} entries` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Run failed' });
      }
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to run agent' });
    }
    setActionLoading(null);
  };

  const togglePause = async () => {
    const action = status?.state?.status === 'paused' ? 'resume' : 'pause';
    setActionLoading(action);
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
    setActionLoading(null);
  };

  const approveEntry = async (entryId: string) => {
    setActionLoading(`approve-${entryId}`);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', entryId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Entry approved and saved!' });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Approval failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to approve entry' });
    }
    setActionLoading(null);
  };

  const rejectEntry = async (entryId: string) => {
    setActionLoading(`reject-${entryId}`);
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', entryId }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to reject entry:', error);
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--red)] border-t-transparent" />
      </div>
    );
  }

  const state = status?.state;
  const isRunning = state?.status === 'running';
  const isPaused = state?.status === 'paused';

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-[var(--font-display)] text-3xl tracking-wider uppercase mb-2">
              <Bot className="inline w-8 h-8 mr-3 text-[var(--red)]" />
              Research <span className="text-[var(--red)]">Agent</span>
            </h1>
            <p className="text-[var(--text-secondary)]">
              Autonomous lore discovery and generation
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePause}
              disabled={actionLoading !== null || isRunning}
              className={`btn ${isPaused ? 'btn-primary' : ''}`}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={runAgent}
              disabled={actionLoading !== null || isPaused}
              className="btn btn-primary"
            >
              {actionLoading === 'run' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Run Now
            </button>
          </div>
        </div>

        {/* Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-4 rounded-lg border ${
            isRunning 
              ? 'bg-yellow-500/10 border-yellow-500/30' 
              : isPaused
                ? 'bg-[var(--border)]/50 border-[var(--border)]'
                : state?.error
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-green-500/10 border-green-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isRunning ? (
                <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
              ) : isPaused ? (
                <Pause className="w-5 h-5 text-[var(--text-muted)]" />
              ) : state?.error ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              <div>
                <div className="font-semibold">
                  {isRunning ? 'Agent Running' : isPaused ? 'Agent Paused' : state?.error ? 'Error' : 'Agent Ready'}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {state?.currentTask || (state?.lastRun ? `Last run: ${formatTime(state.lastRun)}` : 'Never run')}
                </div>
              </div>
            </div>
            {state?.nextRun && !isPaused && (
              <div className="text-sm text-[var(--text-muted)]">
                Next run: {formatTime(state.nextRun)}
              </div>
            )}
          </div>
        </motion.div>

        {/* Message */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-500/10 text-green-400' 
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Runs" value={state?.stats?.totalRuns ?? 0} icon={<Sparkles />} />
          <StatCard label="Discovered" value={state?.stats?.entitiesDiscovered ?? 0} icon={<Database />} />
          <StatCard label="Generated" value={state?.stats?.entriesGenerated ?? 0} icon={<FileText />} />
          <StatCard label="Approved" value={state?.stats?.entriesApproved ?? 0} icon={<CheckCircle className="text-green-500" />} />
          <StatCard label="Pending" value={pending.length} icon={<Clock className="text-yellow-500" />} highlight />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border-subtle)]">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'queue', label: 'Discovery Queue', count: status?.queue?.queued },
            { id: 'review', label: 'Pending Review', count: pending.length },
            { id: 'history', label: 'History' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm tracking-wider uppercase border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--red)] text-white'
                  : 'border-transparent text-[var(--text-muted)] hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-[var(--red)] rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab status={status} queue={queue} pending={pending} />
          )}
          {activeTab === 'queue' && (
            <QueueTab queue={queue} />
          )}
          {activeTab === 'review' && (
            <ReviewTab
              pending={pending}
              expandedEntry={expandedEntry}
              setExpandedEntry={setExpandedEntry}
              onApprove={approveEntry}
              onReject={rejectEntry}
              onPreview={setPreviewEntry}
              actionLoading={actionLoading}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab />
          )}
        </AnimatePresence>

        {/* Preview Modal */}
        <AnimatePresence>
          {previewEntry && (
            <PreviewModal
              entry={previewEntry}
              onClose={() => setPreviewEntry(null)}
              onApprove={() => {
                approveEntry(previewEntry.id);
                setPreviewEntry(null);
              }}
              onReject={() => {
                rejectEntry(previewEntry.id);
                setPreviewEntry(null);
              }}
              actionLoading={actionLoading}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ 
  label, 
  value, 
  icon, 
  highlight 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${
      highlight 
        ? 'bg-[var(--red)]/10 border-[var(--red)]/30' 
        : 'bg-[var(--black-raised)] border-[var(--border-subtle)]'
    }`}>
      <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
        <span className="w-4 h-4">{icon}</span>
        <span className="text-xs tracking-wider uppercase">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function OverviewTab({ 
  status, 
  queue, 
  pending 
}: { 
  status: AgentStatus | null;
  queue: QueueEntity[];
  pending: PendingEntry[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid md:grid-cols-2 gap-6"
    >
      {/* Recent Queue */}
      <div className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg p-6">
        <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase mb-4">
          Recent Discoveries
        </h3>
        {queue.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No entities discovered yet</p>
        ) : (
          <div className="space-y-3">
            {queue.slice(0, 5).map(entity => (
              <div key={entity.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{entity.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{entity.type}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  entity.status === 'queued' ? 'bg-[var(--border)]' :
                  entity.status === 'generating' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {entity.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Review */}
      <div className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg p-6">
        <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase mb-4">
          Awaiting Review
        </h3>
        {pending.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No entries pending review</p>
        ) : (
          <div className="space-y-3">
            {pending.slice(0, 5).map(entry => (
              <div key={entry.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{entry.entityName}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {entry.sourceFiles.length} sources, {entry.images.length} images
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  entry.confidence === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                  entry.confidence === 'likely' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-[var(--border)]'
                }`}>
                  {entry.confidence}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Config Summary */}
      <div className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg p-6 md:col-span-2">
        <h3 className="font-[var(--font-display)] text-sm tracking-wider uppercase mb-4">
          Configuration
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[var(--text-muted)]">Run Interval</div>
            <div>{status?.config?.schedule?.intervalMinutes || 60} minutes</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Entries Per Run</div>
            <div>{status?.config?.schedule?.maxEntriesPerRun || 3}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Queue Size</div>
            <div>{status?.queue?.queued || 0} entities</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)]">Total Discovered</div>
            <div>{status?.queue?.discovered || 0}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QueueTab({ queue }: { queue: QueueEntity[] }) {
  const queued = queue.filter(e => e.status === 'queued').sort((a, b) => b.priority - a.priority);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {queued.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Discovery queue is empty</p>
          <p className="text-sm mt-2">Run the agent to discover new entities</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queued.map((entity, idx) => (
            <div
              key={entity.id}
              className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)] text-sm">#{idx + 1}</span>
                    <h3 className="font-semibold">{entity.name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-[var(--border)] rounded">
                      {entity.type}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">
                    {entity.brief}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
                    <span><FileText className="inline w-3 h-3 mr-1" />{entity.sourceFiles.length} sources</span>
                    <span><ImageIcon className="inline w-3 h-3 mr-1" />{entity.images.length} images</span>
                    <span>Priority: {entity.priority}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ReviewTab({
  pending,
  expandedEntry,
  setExpandedEntry,
  onApprove,
  onReject,
  onPreview,
  actionLoading,
}: {
  pending: PendingEntry[];
  expandedEntry: string | null;
  setExpandedEntry: (id: string | null) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPreview: (entry: PendingEntry) => void;
  actionLoading: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {pending.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No entries pending review</p>
          <p className="text-sm mt-2">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(entry => (
            <div
              key={entry.id}
              className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--black)] transition-colors"
                onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{entry.entityName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      entry.confidence === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                      entry.confidence === 'likely' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-[var(--border)]'
                    }`}>
                      {entry.confidence}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                    <span><FileText className="inline w-3 h-3 mr-1" />{entry.sourceFiles.length} sources</span>
                    <span><ImageIcon className="inline w-3 h-3 mr-1" />{entry.images.length} images</span>
                    <span>Created {formatTime(entry.createdAt)}</span>
                  </div>
                </div>
                {expandedEntry === entry.id ? <ChevronUp /> : <ChevronDown />}
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {expandedEntry === entry.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <div className="p-4 space-y-4">
                      {/* Preview */}
                      <div>
                        <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-2">
                          Content Preview
                        </h4>
                        <div className="prose prose-invert prose-sm max-h-64 overflow-y-auto p-4 bg-[var(--black)] rounded">
                          <pre className="whitespace-pre-wrap text-sm">
                            {entry.content.slice(0, 2000)}
                            {entry.content.length > 2000 && '...'}
                          </pre>
                        </div>
                      </div>

                      {/* Sources */}
                      <div>
                        <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-2">
                          Sources
                        </h4>
                        <ul className="text-sm space-y-1">
                          {entry.sourceFiles.slice(0, 5).map((source, i) => (
                            <li key={i} className="text-[var(--text-secondary)]">
                              <FileText className="inline w-3 h-3 mr-2" />
                              {source}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Images */}
                      {entry.images.length > 0 && (
                        <div>
                          <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-2">
                            Images
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {entry.images.map((img, i) => (
                              <div key={i} className="text-xs bg-[var(--border)] px-2 py-1 rounded">
                                <ImageIcon className="inline w-3 h-3 mr-1" />
                                {img.caption}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 pt-4 border-t border-[var(--border-subtle)]">
                        <button
                          onClick={() => onApprove(entry.id)}
                          disabled={actionLoading !== null}
                          className="btn btn-primary flex-1"
                        >
                          {actionLoading === `approve-${entry.id}` ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve & Publish
                        </button>
                        <button
                          onClick={() => onReject(entry.id)}
                          disabled={actionLoading !== null}
                          className="btn flex-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => onPreview(entry)}
                          className="btn"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function HistoryTab() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agent?action=history')
      .then(res => res.json())
      .then(data => {
        setHistory(data.runs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {history.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No run history yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(run => (
            <div
              key={run.id}
              className="bg-[var(--black-raised)] border border-[var(--border-subtle)] rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {run.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : run.status === 'partial' ? (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium">{formatTime(run.startedAt)}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Discovered {run.discovered}, Generated {run.generated}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  run.status === 'success' ? 'bg-green-500/20 text-green-400' :
                  run.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {run.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function PreviewModal({
  entry,
  onClose,
  onApprove,
  onReject,
  actionLoading,
}: {
  entry: PendingEntry;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  actionLoading: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--black-raised)] border border-[var(--border)] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="font-[var(--font-display)] text-xl tracking-wider uppercase">
              {entry.entityName}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {entry.sourceFiles.length} sources • {entry.images.length} images • {entry.confidence} confidence
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--border)] rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-invert prose-sm max-w-none">
            <MarkdownRenderer content={entry.content} />
          </div>

          {/* Metadata */}
          <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] grid md:grid-cols-2 gap-6">
            {/* Sources */}
            <div>
              <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-3">
                Sources
              </h4>
              <ul className="space-y-1 text-sm">
                {entry.sourceFiles.map((source, i) => (
                  <li key={i} className="text-[var(--text-secondary)] truncate">
                    <FileText className="inline w-3 h-3 mr-2" />
                    {source.split('/').pop()}
                  </li>
                ))}
              </ul>
            </div>

            {/* Images */}
            {entry.images.length > 0 && (
              <div>
                <h4 className="text-xs tracking-wider uppercase text-[var(--text-muted)] mb-3">
                  Images
                </h4>
                <ul className="space-y-1 text-sm">
                  {entry.images.map((img, i) => (
                    <li key={i} className="text-[var(--text-secondary)]">
                      <ImageIcon className="inline w-3 h-3 mr-2" />
                      {img.caption || img.path.split('/').pop()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex gap-3">
          <button
            onClick={onApprove}
            disabled={actionLoading !== null}
            className="btn btn-primary flex-1"
          >
            {actionLoading?.startsWith('approve') ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Approve & Publish
          </button>
          <button
            onClick={onReject}
            disabled={actionLoading !== null}
            className="btn flex-1"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
