/**
 * Types for the Autonomous Agent Changelog System
 * Tracks all modifications made by the research agent for full transparency
 */

export type ChangeType = 
  | 'create'      // New lore entry created
  | 'update'      // Existing entry modified
  | 'delete'      // Entry removed
  | 'expand'      // Content expanded/added to
  | 'verify'      // Facts verified/corrected
  | 'link'        // Cross-references added
  | 'citation'    // Sources/citations updated
  | 'metadata';   // Tags, categories, confidence updated

export type ChangeSource = 
  | 'agent_research'      // Automated research task
  | 'agent_expansion'     // Automated content expansion
  | 'agent_verification'  // Fact verification
  | 'human_review'        // Human-approved change
  | 'human_edit'          // Direct human edit
  | 'import'              // Imported from source
  | 'system';             // System-generated

export interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

export interface ChangelogEntry {
  id: string;
  timestamp: string;
  
  // What changed
  type: ChangeType;
  source: ChangeSource;
  
  // The affected files
  files: string[];
  
  // Human-readable description
  title: string;
  description: string;
  
  // Detailed changes
  diff?: FileDiff[];
  beforeContent?: string;
  afterContent?: string;
  
  // Research context
  taskId?: string;          // Link to research task that caused this
  sessionId?: string;       // Research session ID
  findings?: string[];      // Key findings that led to this change
  sources?: Array<{
    name: string;
    type: string;
    url?: string;
    page?: string;
  }>;
  
  // Git integration
  gitCommit?: string;       // Git commit hash
  gitBranch?: string;       // Branch name
  
  // Review info
  confidence: 'confirmed' | 'likely' | 'speculative';
  reviewStatus: 'auto_approved' | 'pending_review' | 'approved' | 'rejected' | 'rolled_back';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  
  // Stats
  linesAdded?: number;
  linesRemoved?: number;
  wordsAdded?: number;
}

export interface ChangelogStats {
  totalChanges: number;
  byType: Record<ChangeType, number>;
  bySource: Record<ChangeSource, number>;
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

export interface ChangelogFilter {
  type?: ChangeType[];
  source?: ChangeSource[];
  reviewStatus?: string[];
  dateFrom?: string;
  dateTo?: string;
  filePattern?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface ChangelogConfig {
  enabled: boolean;
  autoCommit: boolean;           // Auto-commit to git
  commitPrefix: string;          // Prefix for commit messages
  branchName: string;            // Branch for agent changes
  requireReview: boolean;        // Require human review before commit
  retainDays: number;            // How long to keep changelog entries
  maxEntriesInMemory: number;    // Memory limit for entries
}

export const DEFAULT_CHANGELOG_CONFIG: ChangelogConfig = {
  enabled: true,
  autoCommit: true,
  commitPrefix: '[agent]',
  branchName: 'main',
  requireReview: false,
  retainDays: 365,
  maxEntriesInMemory: 1000,
};

/**
 * Create a new changelog entry
 */
export function createChangelogEntry(
  type: ChangeType,
  source: ChangeSource,
  title: string,
  files: string[],
  options?: Partial<ChangelogEntry>
): ChangelogEntry {
  return {
    id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type,
    source,
    title,
    description: options?.description || title,
    files,
    confidence: options?.confidence || 'speculative',
    reviewStatus: options?.reviewStatus || 'pending_review',
    linesAdded: options?.linesAdded || 0,
    linesRemoved: options?.linesRemoved || 0,
    ...options,
  };
}

/**
 * Generate a human-readable summary of changes
 */
export function summarizeChanges(entries: ChangelogEntry[]): string {
  const byType: Record<string, number> = {};
  const files = new Set<string>();
  let totalAdded = 0;
  let totalRemoved = 0;

  entries.forEach(entry => {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    entry.files.forEach(f => files.add(f));
    totalAdded += entry.linesAdded || 0;
    totalRemoved += entry.linesRemoved || 0;
  });

  const typeSummary = Object.entries(byType)
    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    .join(', ');

  return `${entries.length} changes (${typeSummary}) affecting ${files.size} files (+${totalAdded}/-${totalRemoved} lines)`;
}

