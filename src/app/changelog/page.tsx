'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommit,
  History,
  Bot,
  User,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronRight,
  RefreshCw,
  Search,
  Plus,
  Calendar,
  Activity,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  X,
} from 'lucide-react';

interface ChangelogEntry {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  title: string;
  description: string;
  files: string[];
  confidence: 'confirmed' | 'likely' | 'speculative';
  reviewStatus: string;
  gitCommit?: string;
  linesAdded?: number;
  linesRemoved?: number;
  findings?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
}

interface ChangelogStats {
  totalChanges: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  recentActivity: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

interface AgentActivity {
  isActive: boolean;
  lastActivity?: string;
  todayStats: {
    changes: number;
    created: number;
    updated: number;
    pendingReview: number;
  };
  weeklyStats: {
    changes: number;
    filesAffected: number;
    linesAdded: number;
  };
}

interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  create: { icon: Plus, color: 'text-emerald-400', label: 'Created' },
  update: { icon: FileText, color: 'text-sky-400', label: 'Updated' },
  expand: { icon: TrendingUp, color: 'text-violet-400', label: 'Expanded' },
  verify: { icon: CheckCircle, color: 'text-green-400', label: 'Verified' },
};

const STATUS_CONFIG: Record<string, { color: string; bgColor: string }> = {
  auto_approved: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  approved: { color: 'text-green-400', bgColor: 'bg-green-500/10' },
  pending_review: { color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  rejected: { color: 'text-red-400', bgColor: 'bg-red-500/10' },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [stats, setStats] = useState<ChangelogStats | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'changelog' | 'git'>('changelog');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [changelogRes, activityRes, gitLogRes] = await Promise.all([
        fetch('/api/changelog?action=list&limit=50'),
        fetch('/api/changelog?action=activity'),
        fetch('/api/changelog?action=git-log&limit=20'),
      ]);

      if (changelogRes.ok) {
        const data = await changelogRes.json();
        setEntries(data.entries || []);
        setStats(data.stats || null);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivity(data);
      }

      if (gitLogRes.ok) {
        const data = await gitLogRes.json();
        setGitLog(data.log || []);
      }
    } catch (error) {
      console.error('Failed to fetch changelog:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (entryId: string) => {
    try {
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', entryId, reviewedBy: 'User' }),
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (entryId: string) => {
    try {
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', entryId, reviewedBy: 'User' }),
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (searchTerm && !entry.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !entry.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && entry.type !== filterType) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-start gap-4 mb-8">
            <div className="p-4 bg-[var(--shadow)] border border-[var(--border)] rounded-lg">
              <History className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl tracking-[0.15em] uppercase mb-1">
                Agent <span className="text-violet-400">Changelog</span>
              </h1>
              <p className="text-[var(--dust)]">
                Track all autonomous modifications to the lore compendium
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          {(stats || activity) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[var(--shadow)] border border-[var(--border-subtle)] rounded-lg">
                <div className="flex items-center gap-2 text-[var(--dust)] mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px] tracking-wider uppercase">Today</span>
                </div>
                <div className="font-mono text-2xl text-emerald-400">
                  {activity?.todayStats.changes || 0}
                </div>
                <div className="text-xs text-[var(--dust)]">changes</div>
              </div>

              <div className="p-4 bg-[var(--shadow)] border border-[var(--border-subtle)] rounded-lg">
                <div className="flex items-center gap-2 text-[var(--dust)] mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] tracking-wider uppercase">Pending</span>
                </div>
                <div className="font-mono text-2xl text-amber-400">
                  {activity?.todayStats.pendingReview || 0}
                </div>
                <div className="text-xs text-[var(--dust)]">review</div>
              </div>

              <div className="p-4 bg-[var(--shadow)] border border-[var(--border-subtle)] rounded-lg">
                <div className="flex items-center gap-2 text-[var(--dust)] mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-[10px] tracking-wider uppercase">This Week</span>
                </div>
                <div className="font-mono text-2xl text-sky-400">
                  {activity?.weeklyStats.filesAffected || 0}
                </div>
                <div className="text-xs text-[var(--dust)]">files</div>
              </div>

              <div className="p-4 bg-[var(--shadow)] border border-[var(--border-subtle)] rounded-lg">
                <div className="flex items-center gap-2 text-[var(--dust)] mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[10px] tracking-wider uppercase">Total</span>
                </div>
                <div className="font-mono text-2xl text-violet-400">
                  {stats?.totalChanges || 0}
                </div>
                <div className="text-xs text-[var(--dust)]">all time</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[var(--shadow)] rounded-lg border border-[var(--border-subtle)]">
            <button
              onClick={() => setViewMode('changelog')}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-all ${
                viewMode === 'changelog'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-[var(--dust)] hover:text-[var(--bone)]'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Agent Changes</span>
            </button>
            <button
              onClick={() => setViewMode('git')}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-all ${
                viewMode === 'git'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-[var(--dust)] hover:text-[var(--bone)]'
              }`}
            >
              <GitCommit className="w-4 h-4" />
              <span className="hidden sm:inline">Git History</span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3 flex-1 md:flex-initial">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dust)]" />
              <input
                type="text"
                placeholder="Search changes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--shadow)] border border-[var(--border)] rounded-lg text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dust)] hover:text-[var(--bone)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 bg-[var(--shadow)] border border-[var(--border)] rounded-lg text-sm min-w-[120px]"
            >
              <option value="all">All Types</option>
              <option value="create">Created</option>
              <option value="update">Updated</option>
              <option value="expand">Expanded</option>
              <option value="verify">Verified</option>
            </select>

            <button
              onClick={fetchData}
              className="p-2.5 bg-[var(--shadow)] border border-[var(--border)] rounded-lg hover:border-violet-500/50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading-spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Changelog Entries */}
            {viewMode === 'changelog' && (
              filteredEntries.length > 0 ? (
                <AnimatePresence>
                  {filteredEntries.map((entry, index) => {
                    const typeConfig = TYPE_CONFIG[entry.type] || TYPE_CONFIG.update;
                    const statusConfig = STATUS_CONFIG[entry.reviewStatus] || STATUS_CONFIG.pending_review;
                    const TypeIcon = typeConfig.icon;
                    const isExpanded = expandedEntry === entry.id;
                    const isAgent = entry.source.startsWith('agent_');

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="card overflow-hidden"
                      >
                        <div
                          className={`p-5 cursor-pointer transition-colors ${
                            isExpanded ? 'bg-[var(--obsidian)]/50' : 'hover:bg-[var(--obsidian)]/30'
                          }`}
                          onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                        >
                          <div className="flex items-start gap-4">
                            {/* Type Icon */}
                            <div className={`p-2.5 rounded-lg bg-[var(--darkness)] ${typeConfig.color}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1.5">
                                <h3 className="font-medium text-[var(--bone)] truncate">
                                  {entry.title}
                                </h3>
                                <span className={`flex items-center gap-1 text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full ${
                                  isAgent 
                                    ? 'bg-violet-500/10 text-violet-300' 
                                    : 'bg-sky-500/10 text-sky-300'
                                }`}>
                                  {isAgent ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                  {isAgent ? 'Agent' : 'Human'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--dust)]">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(entry.timestamp)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {entry.files.length} file{entry.files.length !== 1 ? 's' : ''}
                                </span>
                                {(entry.linesAdded || entry.linesRemoved) && (
                                  <span className="flex items-center gap-2">
                                    {entry.linesAdded ? <span className="text-emerald-400">+{entry.linesAdded}</span> : null}
                                    {entry.linesRemoved ? <span className="text-red-400">-{entry.linesRemoved}</span> : null}
                                  </span>
                                )}
                                <span className={`${statusConfig.color}`}>
                                  {entry.reviewStatus.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            {/* Right side */}
                            <div className="flex items-center gap-3">
                              {entry.gitCommit && (
                                <span className="hidden sm:block px-2 py-1 text-xs bg-[var(--darkness)] rounded font-mono text-[var(--dust)]">
                                  {entry.gitCommit.slice(0, 7)}
                                </span>
                              )}
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronRight className="w-5 h-5 text-[var(--dust)]" />
                              </motion.div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="border-t border-[var(--border-subtle)]"
                            >
                              <div className="p-5 grid md:grid-cols-2 gap-6">
                                {/* Left: Description & Findings */}
                                <div>
                                  <h4 className="text-[10px] tracking-wider uppercase text-[var(--dust)] mb-2">
                                    Description
                                  </h4>
                                  <p className="text-sm text-[var(--ash)] mb-4">
                                    {entry.description}
                                  </p>

                                  {entry.findings && entry.findings.length > 0 && (
                                    <>
                                      <h4 className="text-[10px] tracking-wider uppercase text-[var(--dust)] mb-2">
                                        Key Findings
                                      </h4>
                                      <ul className="space-y-2">
                                        {entry.findings.map((finding, i) => (
                                          <li key={i} className="text-sm text-[var(--ash)] flex items-start gap-2">
                                            <Sparkles className="w-3 h-3 text-amber-400 mt-1 flex-shrink-0" />
                                            {finding}
                                          </li>
                                        ))}
                                      </ul>
                                    </>
                                  )}
                                </div>

                                {/* Right: Files & Actions */}
                                <div>
                                  <h4 className="text-[10px] tracking-wider uppercase text-[var(--dust)] mb-2">
                                    Affected Files
                                  </h4>
                                  <div className="space-y-1 mb-4">
                                    {entry.files.slice(0, 5).map((file, i) => (
                                      <div
                                        key={i}
                                        className="text-sm text-[var(--ash)] font-mono bg-[var(--darkness)] px-2 py-1.5 rounded truncate"
                                      >
                                        {file.replace('docs/lore/', '')}
                                      </div>
                                    ))}
                                    {entry.files.length > 5 && (
                                      <div className="text-xs text-[var(--dust)]">
                                        +{entry.files.length - 5} more files
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
                                    <span className={`text-sm flex items-center gap-1 ${
                                      entry.confidence === 'confirmed' ? 'text-emerald-400' :
                                      entry.confidence === 'likely' ? 'text-amber-400' :
                                      'text-orange-400'
                                    }`}>
                                      <AlertTriangle className="w-3 h-3" />
                                      {entry.confidence}
                                    </span>
                                  </div>

                                  {entry.reviewStatus === 'pending_review' && (
                                    <div className="flex items-center gap-2 mt-4">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleApprove(entry.id);
                                        }}
                                        className="btn btn-sm flex-1"
                                        style={{ background: 'var(--success)', borderColor: 'var(--success-light)' }}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReject(entry.id);
                                        }}
                                        className="btn btn-sm flex-1"
                                      >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                      </button>
                                    </div>
                                  )}

                                  {entry.reviewedAt && (
                                    <div className="text-xs text-[var(--dust)] mt-3">
                                      Reviewed by {entry.reviewedBy || 'Unknown'} • {formatDate(entry.reviewedAt)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div className="empty-state">
                  <History className="empty-state-icon" />
                  <p className="empty-state-title">No Changes Yet</p>
                  <p className="empty-state-description">
                    The research agent hasn&apos;t made any modifications yet.
                  </p>
                </div>
              )
            )}

            {/* Git Log */}
            {viewMode === 'git' && (
              gitLog.length > 0 ? (
                <div className="space-y-2">
                  {gitLog.map((commit, index) => (
                    <motion.div
                      key={commit.hash}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="card p-4 flex items-center gap-4"
                    >
                      <GitCommit className="w-4 h-4 text-[var(--dust)] flex-shrink-0" />
                      <span className="font-mono text-xs text-violet-400 flex-shrink-0">
                        {commit.shortHash}
                      </span>
                      <span className="text-sm text-[var(--bone)] flex-1 truncate">
                        {commit.message}
                      </span>
                      <span className="text-xs text-[var(--dust)] flex-shrink-0 hidden sm:block">
                        {formatDate(commit.date)}
                      </span>
                      <span className="text-xs text-[var(--dust)] flex-shrink-0 hidden md:block">
                        {commit.author.split(' ')[0]}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <GitCommit className="empty-state-icon" />
                  <p className="empty-state-title">No Commits</p>
                  <p className="empty-state-description">Git history is empty or unavailable.</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
