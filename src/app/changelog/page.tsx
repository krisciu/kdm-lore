'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
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
  Minus,
  Calendar,
  Activity,
  Eye,
  Sparkles,
  AlertTriangle,
  TrendingUp,
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
  reviewNote?: string;
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
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
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

const TYPE_ICONS: Record<string, typeof FileText> = {
  create: Plus,
  update: FileText,
  expand: TrendingUp,
  verify: CheckCircle,
  delete: Minus,
  link: GitBranch,
  citation: FileText,
  metadata: Activity,
};

const TYPE_COLORS: Record<string, string> = {
  create: 'text-emerald-400',
  update: 'text-sky-400',
  expand: 'text-violet-400',
  verify: 'text-green-400',
  delete: 'text-red-400',
  link: 'text-amber-400',
  citation: 'text-orange-400',
  metadata: 'text-slate-400',
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle }> = {
  auto_approved: { color: 'text-emerald-400', icon: CheckCircle },
  approved: { color: 'text-green-400', icon: CheckCircle },
  pending_review: { color: 'text-amber-400', icon: Clock },
  rejected: { color: 'text-red-400', icon: XCircle },
  rolled_back: { color: 'text-slate-400', icon: History },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [stats, setStats] = useState<ChangelogStats | null>(null);
  const [activity, setActivity] = useState<AgentActivity | null>(null);
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'changelog' | 'git' | 'combined'>('combined');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch changelog entries and stats
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
      
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to approve entry:', error);
    }
  };

  const handleReject = async (entryId: string) => {
    try {
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', entryId, reviewedBy: 'User' }),
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to reject entry:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (searchTerm && !entry.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !entry.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && entry.type !== filterType) return false;
    if (filterSource !== 'all' && entry.source !== filterSource) return false;
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

  const renderDiffStats = (added?: number, removed?: number) => {
    if (!added && !removed) return null;
    return (
      <div className="flex items-center gap-2 text-xs">
        {added ? (
          <span className="text-emerald-400">+{added}</span>
        ) : null}
        {removed ? (
          <span className="text-red-400">-{removed}</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-emerald-900/10" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 80% 50%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)`,
        }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <History className="w-12 h-12 text-violet-400" />
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Bot className="w-5 h-5 text-emerald-400" />
              </motion.div>
            </div>
            <div>
              <h1 className="text-3xl font-[var(--font-display)] tracking-wider">
                AGENT <span className="text-violet-400">CHANGELOG</span>
              </h1>
              <p className="text-[var(--text-muted)]">
                Transparent tracking of all autonomous lore modifications
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          {(stats || activity) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--black-raised)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Today</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {activity?.todayStats.changes || 0}
                </div>
                <div className="text-xs text-[var(--text-muted)]">changes made</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[var(--black-raised)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Pending</span>
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  {activity?.todayStats.pendingReview || 0}
                </div>
                <div className="text-xs text-[var(--text-muted)]">need review</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[var(--black-raised)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">This Week</span>
                </div>
                <div className="text-2xl font-bold text-sky-400">
                  {activity?.weeklyStats.filesAffected || 0}
                </div>
                <div className="text-xs text-[var(--text-muted)]">files affected</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[var(--black-raised)]/50 backdrop-blur-sm rounded-lg p-4 border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Total</span>
                </div>
                <div className="text-2xl font-bold text-violet-400">
                  {stats?.totalChanges || 0}
                </div>
                <div className="text-xs text-[var(--text-muted)]">all time changes</div>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-[var(--black-raised)] rounded-lg p-1">
            {['combined', 'changelog', 'git'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as typeof viewMode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === mode
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {mode === 'combined' && <Activity className="w-4 h-4 inline mr-2" />}
                {mode === 'changelog' && <Bot className="w-4 h-4 inline mr-2" />}
                {mode === 'git' && <GitCommit className="w-4 h-4 inline mr-2" />}
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3 flex-1 md:flex-initial">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search changes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-[var(--black-raised)] border border-[var(--border)] rounded-lg text-sm w-full md:w-64"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-[var(--black-raised)] border border-[var(--border)] rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="expand">Expand</option>
              <option value="verify">Verify</option>
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-2 bg-[var(--black-raised)] border border-[var(--border)] rounded-lg text-sm"
            >
              <option value="all">All Sources</option>
              <option value="agent_research">Agent Research</option>
              <option value="agent_expansion">Agent Expansion</option>
              <option value="human_edit">Human Edit</option>
            </select>

            <button
              onClick={fetchData}
              className="p-2 bg-[var(--black-raised)] border border-[var(--border)] rounded-lg hover:border-violet-500/50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-8 h-8 text-violet-400" />
            </motion.div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Changelog Entries */}
            {(viewMode === 'changelog' || viewMode === 'combined') && filteredEntries.length > 0 && (
              <AnimatePresence>
                {filteredEntries.map((entry, index) => {
                  const TypeIcon = TYPE_ICONS[entry.type] || FileText;
                  const typeColor = TYPE_COLORS[entry.type] || 'text-slate-400';
                  const statusConfig = STATUS_CONFIG[entry.reviewStatus] || STATUS_CONFIG.pending_review;
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandedEntry === entry.id;

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group"
                    >
                      <div
                        className={`bg-[var(--black-raised)]/50 rounded-lg border transition-all cursor-pointer ${
                          isExpanded
                            ? 'border-violet-500/50'
                            : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                        }`}
                        onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Type Icon */}
                            <div className={`p-2 rounded-lg bg-[var(--black-elevated)] ${typeColor}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-[var(--text-primary)] truncate">
                                  {entry.title}
                                </h3>
                                {entry.source.startsWith('agent_') ? (
                                  <span className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded-full flex items-center gap-1">
                                    <Bot className="w-3 h-3" />
                                    Agent
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs bg-sky-500/20 text-sky-300 rounded-full flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    Human
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(entry.timestamp)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {entry.files.length} file{entry.files.length !== 1 ? 's' : ''}
                                </span>
                                {renderDiffStats(entry.linesAdded, entry.linesRemoved)}
                                <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {entry.reviewStatus.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              {entry.gitCommit && (
                                <span className="px-2 py-1 text-xs bg-[var(--black-elevated)] rounded font-mono text-[var(--text-muted)]">
                                  {entry.gitCommit.slice(0, 7)}
                                </span>
                              )}
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                              >
                                <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
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
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)]">
                                <div className="grid md:grid-cols-2 gap-6">
                                  {/* Left: Description & Findings */}
                                  <div>
                                    <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Description</h4>
                                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                                      {entry.description}
                                    </p>

                                    {entry.findings && entry.findings.length > 0 && (
                                      <>
                                        <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Findings</h4>
                                        <ul className="space-y-1">
                                          {entry.findings.map((finding, i) => (
                                            <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
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
                                    <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Affected Files</h4>
                                    <div className="space-y-1 mb-4">
                                      {entry.files.map((file, i) => (
                                        <div
                                          key={i}
                                          className="text-sm text-[var(--text-secondary)] font-mono bg-[var(--black-elevated)] px-2 py-1 rounded"
                                        >
                                          {file.replace('docs/lore/', '')}
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                                      <span className={`text-sm ${
                                        entry.confidence === 'confirmed' ? 'text-emerald-400' :
                                        entry.confidence === 'likely' ? 'text-amber-400' :
                                        'text-orange-400'
                                      }`}>
                                        <AlertTriangle className="w-3 h-3 inline mr-1" />
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
                                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                          Approve
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReject(entry.id);
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                                        >
                                          <XCircle className="w-4 h-4" />
                                          Reject
                                        </button>
                                        <button
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--black-elevated)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--black-surface)] transition-colors text-sm"
                                        >
                                          <Eye className="w-4 h-4" />
                                          View Diff
                                        </button>
                                      </div>
                                    )}

                                    {entry.reviewedAt && (
                                      <div className="text-xs text-[var(--text-muted)] mt-3">
                                        Reviewed by {entry.reviewedBy || 'Unknown'} on {new Date(entry.reviewedAt).toLocaleString()}
                                        {entry.reviewNote && (
                                          <p className="mt-1 italic">&quot;{entry.reviewNote}&quot;</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}

            {/* Git Log */}
            {(viewMode === 'git' || viewMode === 'combined') && gitLog.length > 0 && (
              <div className={viewMode === 'combined' && filteredEntries.length > 0 ? 'mt-8' : ''}>
                {viewMode === 'combined' && (
                  <h2 className="text-lg font-[var(--font-display)] tracking-wider text-[var(--text-muted)] mb-4 flex items-center gap-2">
                    <GitCommit className="w-5 h-5" />
                    Git History
                  </h2>
                )}
                <div className="space-y-2">
                  {gitLog.map((commit, index) => (
                    <motion.div
                      key={commit.hash}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-[var(--black-raised)]/30 rounded-lg p-3 border border-[var(--border-subtle)] hover:border-[var(--border)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <GitCommit className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="font-mono text-xs text-violet-400">{commit.shortHash}</span>
                        <span className="text-sm text-[var(--text-primary)] flex-1 truncate">
                          {commit.message}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDate(commit.date)}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {commit.author.split(' ')[0]}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredEntries.length === 0 && gitLog.length === 0 && (
              <div className="text-center py-20">
                <History className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-xl font-[var(--font-display)] tracking-wider mb-2">No Changes Yet</h3>
                <p className="text-[var(--text-muted)]">
                  The research agent hasn&apos;t made any modifications yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
