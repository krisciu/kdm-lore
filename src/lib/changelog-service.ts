/**
 * Changelog Service - Tracks all modifications made by the research agent
 * Provides full transparency into autonomous changes with git integration
 */

import fs from 'fs';
import path from 'path';
import {
  ChangelogEntry,
  ChangelogStats,
  ChangelogFilter,
  ChangelogConfig,
  ChangeType,
  ChangeSource,
  createChangelogEntry,
  DEFAULT_CHANGELOG_CONFIG,
} from '@/types/changelog';
import {
  createCommit,
  getGitStatus,
  getGitLog,
  createTextDiff,
  isGitAvailable,
  GitLogEntry,
} from './git-service';

const DATA_DIR = path.join(process.cwd(), 'data');
const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');
const CONFIG_FILE = path.join(DATA_DIR, 'changelog-config.json');

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load changelog entries from disk
 */
export function loadChangelog(): ChangelogEntry[] {
  ensureDataDir();

  if (fs.existsSync(CHANGELOG_FILE)) {
    try {
      const data = fs.readFileSync(CHANGELOG_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      console.error('Failed to load changelog, starting fresh');
    }
  }

  return [];
}

/**
 * Save changelog entries to disk
 */
export function saveChangelog(entries: ChangelogEntry[]): void {
  ensureDataDir();
  
  const config = loadChangelogConfig();
  
  // Trim old entries if needed
  if (config.retainDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - config.retainDays);
    entries = entries.filter(e => new Date(e.timestamp) > cutoff);
  }

  // Limit entries in file
  if (entries.length > config.maxEntriesInMemory) {
    entries = entries.slice(-config.maxEntriesInMemory);
  }

  fs.writeFileSync(CHANGELOG_FILE, JSON.stringify(entries, null, 2));
}

/**
 * Load changelog configuration
 */
export function loadChangelogConfig(): ChangelogConfig {
  ensureDataDir();

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CHANGELOG_CONFIG, ...JSON.parse(data) };
    } catch {
      console.error('Failed to load changelog config, using defaults');
    }
  }

  saveChangelogConfig(DEFAULT_CHANGELOG_CONFIG);
  return DEFAULT_CHANGELOG_CONFIG;
}

/**
 * Save changelog configuration
 */
export function saveChangelogConfig(config: ChangelogConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Record a new change
 */
export async function recordChange(
  type: ChangeType,
  source: ChangeSource,
  title: string,
  files: string[],
  options?: {
    description?: string;
    taskId?: string;
    sessionId?: string;
    findings?: string[];
    sources?: Array<{ name: string; type: string; url?: string; page?: string }>;
    confidence?: 'confirmed' | 'likely' | 'speculative';
    beforeContent?: string;
    afterContent?: string;
    autoCommit?: boolean;
  }
): Promise<ChangelogEntry> {
  const config = loadChangelogConfig();
  
  // Calculate diff if content is provided
  let linesAdded = 0;
  let linesRemoved = 0;
  
  if (options?.beforeContent !== undefined && options?.afterContent !== undefined) {
    const diff = createTextDiff(options.beforeContent, options.afterContent);
    linesAdded = diff.additions;
    linesRemoved = diff.deletions;
  }

  // Create the changelog entry
  const entry = createChangelogEntry(type, source, title, files, {
    description: options?.description,
    taskId: options?.taskId,
    sessionId: options?.sessionId,
    findings: options?.findings,
    sources: options?.sources,
    confidence: options?.confidence || 'speculative',
    beforeContent: options?.beforeContent,
    afterContent: options?.afterContent,
    linesAdded,
    linesRemoved,
    reviewStatus: config.requireReview ? 'pending_review' : 'auto_approved',
  });

  // Auto-commit if enabled
  if (config.autoCommit && (options?.autoCommit !== false)) {
    const commitResult = await createCommit(title, {
      prefix: config.commitPrefix,
      files,
      author: source === 'agent_research' ? 'KDM Research Agent <agent@kdm-lore.local>' : undefined,
    });

    if (commitResult.success) {
      entry.gitCommit = commitResult.commitHash;
      entry.gitBranch = config.branchName;
    }
  }

  // Save to changelog
  const entries = loadChangelog();
  entries.push(entry);
  saveChangelog(entries);

  return entry;
}

/**
 * Get changelog entries with optional filtering
 */
export function getChangelogEntries(filter?: ChangelogFilter): ChangelogEntry[] {
  let entries = loadChangelog();

  if (!filter) {
    return entries.slice().reverse(); // Most recent first
  }

  // Apply filters
  if (filter.type && filter.type.length > 0) {
    entries = entries.filter(e => filter.type!.includes(e.type));
  }

  if (filter.source && filter.source.length > 0) {
    entries = entries.filter(e => filter.source!.includes(e.source));
  }

  if (filter.reviewStatus && filter.reviewStatus.length > 0) {
    entries = entries.filter(e => filter.reviewStatus!.includes(e.reviewStatus));
  }

  if (filter.dateFrom) {
    const from = new Date(filter.dateFrom);
    entries = entries.filter(e => new Date(e.timestamp) >= from);
  }

  if (filter.dateTo) {
    const to = new Date(filter.dateTo);
    entries = entries.filter(e => new Date(e.timestamp) <= to);
  }

  if (filter.filePattern) {
    const pattern = new RegExp(filter.filePattern, 'i');
    entries = entries.filter(e => e.files.some(f => pattern.test(f)));
  }

  if (filter.searchTerm) {
    const term = filter.searchTerm.toLowerCase();
    entries = entries.filter(e => 
      e.title.toLowerCase().includes(term) ||
      e.description.toLowerCase().includes(term) ||
      e.files.some(f => f.toLowerCase().includes(term))
    );
  }

  // Sort by timestamp (most recent first)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply pagination
  if (filter.offset) {
    entries = entries.slice(filter.offset);
  }

  if (filter.limit) {
    entries = entries.slice(0, filter.limit);
  }

  return entries;
}

/**
 * Get a specific changelog entry by ID
 */
export function getChangelogEntry(id: string): ChangelogEntry | null {
  const entries = loadChangelog();
  return entries.find(e => e.id === id) || null;
}

/**
 * Update a changelog entry (e.g., for review)
 */
export function updateChangelogEntry(
  id: string,
  updates: Partial<ChangelogEntry>
): ChangelogEntry | null {
  const entries = loadChangelog();
  const index = entries.findIndex(e => e.id === id);

  if (index === -1) return null;

  entries[index] = { ...entries[index], ...updates };
  saveChangelog(entries);

  return entries[index];
}

/**
 * Approve a changelog entry
 */
export function approveChangelogEntry(
  id: string,
  reviewedBy?: string,
  note?: string
): ChangelogEntry | null {
  return updateChangelogEntry(id, {
    reviewStatus: 'approved',
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    reviewNote: note,
  });
}

/**
 * Reject a changelog entry
 */
export function rejectChangelogEntry(
  id: string,
  reviewedBy?: string,
  note?: string
): ChangelogEntry | null {
  return updateChangelogEntry(id, {
    reviewStatus: 'rejected',
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    reviewNote: note,
  });
}

/**
 * Get changelog statistics
 */
export function getChangelogStats(): ChangelogStats {
  const entries = loadChangelog();
  
  const byType: Record<ChangeType, number> = {
    create: 0,
    update: 0,
    delete: 0,
    expand: 0,
    verify: 0,
    link: 0,
    citation: 0,
    metadata: 0,
  };

  const bySource: Record<ChangeSource, number> = {
    agent_research: 0,
    agent_expansion: 0,
    agent_verification: 0,
    human_review: 0,
    human_edit: 0,
    import: 0,
    system: 0,
  };

  const byStatus: Record<string, number> = {};
  const files = new Set<string>();
  let totalAdded = 0;
  let totalRemoved = 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setMonth(monthStart.getMonth() - 1);

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  entries.forEach(entry => {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    byStatus[entry.reviewStatus] = (byStatus[entry.reviewStatus] || 0) + 1;
    
    entry.files.forEach(f => files.add(f));
    totalAdded += entry.linesAdded || 0;
    totalRemoved += entry.linesRemoved || 0;

    const entryDate = new Date(entry.timestamp);
    if (entryDate >= todayStart) today++;
    if (entryDate >= weekStart) thisWeek++;
    if (entryDate >= monthStart) thisMonth++;
  });

  return {
    totalChanges: entries.length,
    byType,
    bySource,
    byStatus,
    recentActivity: {
      today,
      thisWeek,
      thisMonth,
    },
    filesModified: files.size,
    linesAdded: totalAdded,
    linesRemoved: totalRemoved,
  };
}

/**
 * Get combined changelog from local storage and git history
 */
export async function getCombinedHistory(limit: number = 50): Promise<{
  changelog: ChangelogEntry[];
  gitLog: GitLogEntry[];
  combined: Array<{
    type: 'changelog' | 'git';
    timestamp: string;
    data: ChangelogEntry | GitLogEntry;
  }>;
}> {
  const changelog = getChangelogEntries({ limit });
  const gitLog = await getGitLog(limit);

  // Combine and sort by date
  const combined: Array<{
    type: 'changelog' | 'git';
    timestamp: string;
    data: ChangelogEntry | GitLogEntry;
  }> = [
    ...changelog.map(c => ({ type: 'changelog' as const, timestamp: c.timestamp, data: c })),
    ...gitLog
      .filter(g => !changelog.some(c => c.gitCommit === g.hash))
      .map(g => ({ type: 'git' as const, timestamp: g.date, data: g })),
  ];

  combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    changelog,
    gitLog,
    combined: combined.slice(0, limit),
  };
}

/**
 * Create a summary of recent agent activity
 */
export function getAgentActivitySummary(): {
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
} {
  const entries = loadChangelog();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const todayEntries = entries.filter(e => new Date(e.timestamp) >= todayStart);
  const weekEntries = entries.filter(e => new Date(e.timestamp) >= weekStart);
  const agentEntries = entries.filter(e => e.source.startsWith('agent_'));

  const lastAgentEntry = agentEntries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  const weekFiles = new Set<string>();
  weekEntries.forEach(e => e.files.forEach(f => weekFiles.add(f)));

  return {
    isActive: agentEntries.length > 0,
    lastActivity: lastAgentEntry?.timestamp,
    todayStats: {
      changes: todayEntries.length,
      created: todayEntries.filter(e => e.type === 'create').length,
      updated: todayEntries.filter(e => e.type === 'update' || e.type === 'expand').length,
      pendingReview: todayEntries.filter(e => e.reviewStatus === 'pending_review').length,
    },
    weeklyStats: {
      changes: weekEntries.length,
      filesAffected: weekFiles.size,
      linesAdded: weekEntries.reduce((sum, e) => sum + (e.linesAdded || 0), 0),
    },
  };
}

/**
 * Export changelog to markdown (for documentation)
 */
export function exportChangelogToMarkdown(entries?: ChangelogEntry[]): string {
  const data = entries || getChangelogEntries({ limit: 100 });
  
  let md = `# Lore Changelog\n\n`;
  md += `> Auto-generated changelog of agent and human modifications\n\n`;
  md += `**Last Updated:** ${new Date().toISOString()}\n\n`;
  md += `---\n\n`;

  // Group by date
  const byDate: Record<string, ChangelogEntry[]> = {};
  data.forEach(entry => {
    const date = entry.timestamp.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);
  });

  Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([date, dayEntries]) => {
      md += `## ${date}\n\n`;
      
      dayEntries.forEach(entry => {
        const icon = entry.type === 'create' ? '✨' 
          : entry.type === 'update' ? '📝'
          : entry.type === 'expand' ? '📚'
          : entry.type === 'verify' ? '✅'
          : '🔧';
        
        const badge = entry.source.startsWith('agent_') ? '🤖' : '👤';
        
        md += `### ${icon} ${entry.title} ${badge}\n\n`;
        md += `- **Type:** ${entry.type}\n`;
        md += `- **Source:** ${entry.source}\n`;
        md += `- **Files:** ${entry.files.join(', ')}\n`;
        md += `- **Confidence:** ${entry.confidence}\n`;
        
        if (entry.gitCommit) {
          md += `- **Commit:** \`${entry.gitCommit.slice(0, 7)}\`\n`;
        }
        
        if (entry.description !== entry.title) {
          md += `\n${entry.description}\n`;
        }
        
        md += `\n`;
      });
    });

  return md;
}

