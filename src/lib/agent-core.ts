/**
 * Agent Core - Main agent loop, scheduling, and state management
 * Orchestrates the autonomous research pipeline
 * 
 * Uses storage abstraction for cross-environment compatibility:
 * - Local development: File system
 * - Production/Vercel: Vercel KV
 */

import { storage, STORAGE_KEYS, isUsingKV } from './storage';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentConfig {
  schedule: {
    intervalMinutes: number;
    maxEntriesPerRun: number;
    apiDelayMs: number;
    reviewScanIntervalHours?: number;
  };
  ai: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
  sources: {
    priority: ('shop' | 'rulebook' | 'newsletter' | 'community')[];
    imageDirectories: string[];
  };
}

export interface AgentState {
  status: 'idle' | 'running' | 'paused' | 'error';
  lastRun: string | null;
  nextRun: string | null;
  lastScan: string | null;
  currentTask: string | null;
  error: string | null;
  stats: {
    totalRuns: number;
    entitiesDiscovered: number;
    entriesGenerated: number;
    entriesApproved: number;
    entriesRejected: number;
    entriesReviewed: number;
  };
  history: AgentRunLog[];
}

export interface AgentRunLog {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'success' | 'partial' | 'failed';
  discovered: number;
  generated: number;
  reviewed: number;
  errors: string[];
}

export interface ReviewQueueEntry {
  id: string;
  filePath: string;
  entryName: string;
  category: string;
  issues: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  priority: number;
  score: number;
  queuedAt: string;
  status: 'queued' | 'reviewing' | 'pending_approval' | 'completed' | 'skipped';
}

export interface DiscoveredEntity {
  id: string;
  name: string;
  type: 'monster' | 'character' | 'faction' | 'location' | 'concept' | 'item' | 'event';
  subType?: string;
  brief: string;
  sourceFiles: string[];
  images: string[];
  priority: number;
  discoveredAt: string;
  status: 'queued' | 'generating' | 'pending_review' | 'approved' | 'rejected';
}

export interface PendingEntry {
  id: string;
  entityId: string;
  entityName: string;
  content: string;
  frontmatter: Record<string, unknown>;
  sourceFiles: string[];
  images: Array<{ path: string; caption: string }>;
  citations: string[];
  connections: Array<{ name: string; relationship: string }>;
  confidence: 'confirmed' | 'likely' | 'speculative';
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: AgentConfig = {
  schedule: {
    intervalMinutes: 60,
    maxEntriesPerRun: 3,
    apiDelayMs: 2000,
  },
  ai: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 4096,
    temperature: 0.7,
  },
  sources: {
    priority: ['shop', 'rulebook', 'newsletter', 'community'],
    imageDirectories: [
      'official-site/images/shop',
      'official-site/images/newsletters',
      'official-site/images/artwork',
    ],
  },
};

const DEFAULT_STATE: AgentState = {
  status: 'idle',
  lastRun: null,
  nextRun: null,
  lastScan: null,
  currentTask: null,
  error: null,
  stats: {
    totalRuns: 0,
    entitiesDiscovered: 0,
    entriesGenerated: 0,
    entriesApproved: 0,
    entriesRejected: 0,
    entriesReviewed: 0,
  },
  history: [],
};

// =============================================================================
// STATE MANAGEMENT (Async - supports both file and KV storage)
// =============================================================================

export async function loadConfig(): Promise<AgentConfig> {
  const config = await storage().get<AgentConfig>(STORAGE_KEYS.AGENT_CONFIG, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...config };
}

export async function saveConfig(config: AgentConfig): Promise<boolean> {
  return storage().set(STORAGE_KEYS.AGENT_CONFIG, config);
}

export async function loadState(): Promise<AgentState> {
  const state = await storage().get<AgentState>(STORAGE_KEYS.AGENT_STATE, DEFAULT_STATE);
  return { ...DEFAULT_STATE, ...state };
}

export async function saveState(state: AgentState): Promise<boolean> {
  return storage().set(STORAGE_KEYS.AGENT_STATE, state);
}

export async function updateState(updates: Partial<AgentState>): Promise<AgentState> {
  const state = await loadState();
  const newState = { ...state, ...updates };
  await saveState(newState);
  return newState;
}

// =============================================================================
// DISCOVERY QUEUE
// =============================================================================

export async function loadDiscoveryQueue(): Promise<DiscoveredEntity[]> {
  return storage().get<DiscoveredEntity[]>(STORAGE_KEYS.DISCOVERY_QUEUE, []);
}

export async function saveDiscoveryQueue(queue: DiscoveredEntity[]): Promise<boolean> {
  return storage().set(STORAGE_KEYS.DISCOVERY_QUEUE, queue);
}

export async function addToDiscoveryQueue(
  entity: Omit<DiscoveredEntity, 'id' | 'discoveredAt' | 'status'>
): Promise<DiscoveredEntity> {
  const queue = await loadDiscoveryQueue();
  
  // Check for duplicates
  const existing = queue.find(e => e.name.toLowerCase() === entity.name.toLowerCase());
  if (existing) {
    // Merge source files and images
    existing.sourceFiles = [...new Set([...existing.sourceFiles, ...entity.sourceFiles])];
    existing.images = [...new Set([...existing.images, ...entity.images])];
    await saveDiscoveryQueue(queue);
    return existing;
  }
  
  const newEntity: DiscoveredEntity = {
    ...entity,
    id: `entity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    discoveredAt: new Date().toISOString(),
    status: 'queued',
  };
  
  queue.push(newEntity);
  await saveDiscoveryQueue(queue);
  return newEntity;
}

export async function getNextEntityToProcess(): Promise<DiscoveredEntity | null> {
  const queue = await loadDiscoveryQueue();
  const queued = queue
    .filter(e => e.status === 'queued')
    .sort((a, b) => b.priority - a.priority);
  return queued[0] || null;
}

export async function updateEntityStatus(
  entityId: string, 
  status: DiscoveredEntity['status']
): Promise<void> {
  const queue = await loadDiscoveryQueue();
  const entity = queue.find(e => e.id === entityId);
  if (entity) {
    entity.status = status;
    await saveDiscoveryQueue(queue);
  }
}

// =============================================================================
// PENDING ENTRIES
// =============================================================================

export async function loadPendingEntries(): Promise<PendingEntry[]> {
  return storage().get<PendingEntry[]>(STORAGE_KEYS.PENDING_ENTRIES, []);
}

export async function savePendingEntries(entries: PendingEntry[]): Promise<boolean> {
  return storage().set(STORAGE_KEYS.PENDING_ENTRIES, entries);
}

export async function addPendingEntry(
  entry: Omit<PendingEntry, 'id' | 'createdAt' | 'status'>
): Promise<PendingEntry> {
  const entries = await loadPendingEntries();
  
  const newEntry: PendingEntry = {
    ...entry,
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  entries.push(newEntry);
  await savePendingEntries(entries);
  return newEntry;
}

export async function getPendingForReview(): Promise<PendingEntry[]> {
  const entries = await loadPendingEntries();
  return entries.filter(e => e.status === 'pending');
}

export async function updatePendingEntryStatus(
  entryId: string,
  status: PendingEntry['status'],
  notes?: string
): Promise<PendingEntry | null> {
  const entries = await loadPendingEntries();
  const entry = entries.find(e => e.id === entryId);
  
  if (!entry) return null;
  
  entry.status = status;
  if (notes) entry.reviewNotes = notes;
  
  await savePendingEntries(entries);
  return entry;
}

// =============================================================================
// REVIEW QUEUE (for existing entry improvements)
// =============================================================================

export async function loadReviewQueue(): Promise<ReviewQueueEntry[]> {
  return storage().get<ReviewQueueEntry[]>(STORAGE_KEYS.REVIEW_QUEUE, []);
}

export async function saveReviewQueue(queue: ReviewQueueEntry[]): Promise<boolean> {
  return storage().set(STORAGE_KEYS.REVIEW_QUEUE, queue);
}

export async function addToReviewQueue(
  entry: Omit<ReviewQueueEntry, 'id' | 'queuedAt' | 'status'>
): Promise<ReviewQueueEntry> {
  const queue = await loadReviewQueue();
  
  // Check if already in queue
  const existing = queue.find(e => e.filePath === entry.filePath);
  if (existing && existing.status === 'queued') {
    // Update issues and priority
    existing.issues = entry.issues;
    existing.priority = entry.priority;
    existing.score = entry.score;
    await saveReviewQueue(queue);
    return existing;
  }
  
  const newEntry: ReviewQueueEntry = {
    ...entry,
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    status: 'queued',
  };
  
  queue.push(newEntry);
  await saveReviewQueue(queue);
  return newEntry;
}

export async function getNextReviewEntry(): Promise<ReviewQueueEntry | null> {
  const queue = await loadReviewQueue();
  const queued = queue
    .filter(e => e.status === 'queued')
    .sort((a, b) => b.priority - a.priority);
  return queued[0] || null;
}

export async function updateReviewEntryStatus(
  entryId: string,
  status: ReviewQueueEntry['status']
): Promise<ReviewQueueEntry | null> {
  const queue = await loadReviewQueue();
  const entry = queue.find(e => e.id === entryId);
  
  if (!entry) return null;
  
  entry.status = status;
  await saveReviewQueue(queue);
  return entry;
}

export async function getReviewQueueStats(): Promise<{
  total: number;
  queued: number;
  reviewing: number;
  completed: number;
  byCategory: Record<string, number>;
  byIssueType: Record<string, number>;
}> {
  const queue = await loadReviewQueue();
  
  const byCategory: Record<string, number> = {};
  const byIssueType: Record<string, number> = {};
  
  for (const entry of queue) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    for (const issue of entry.issues) {
      byIssueType[issue.type] = (byIssueType[issue.type] || 0) + 1;
    }
  }
  
  return {
    total: queue.length,
    queued: queue.filter(e => e.status === 'queued').length,
    reviewing: queue.filter(e => e.status === 'reviewing').length,
    completed: queue.filter(e => e.status === 'completed').length,
    byCategory,
    byIssueType,
  };
}

export async function shouldRunScan(): Promise<boolean> {
  const state = await loadState();
  const config = await loadConfig();
  
  // Never scanned before
  if (!state.lastScan) {
    return true;
  }
  
  // Check if enough time has passed since last scan
  const lastScan = new Date(state.lastScan);
  const now = new Date();
  const hoursSinceLastScan = (now.getTime() - lastScan.getTime()) / (1000 * 60 * 60);
  
  const scanInterval = config.schedule.reviewScanIntervalHours || 24;
  return hoursSinceLastScan >= scanInterval;
}

export async function recordScanComplete(): Promise<void> {
  await updateState({ lastScan: new Date().toISOString() });
}

// =============================================================================
// SCHEDULING
// =============================================================================

export async function shouldRunAgent(): Promise<boolean> {
  const state = await loadState();
  const config = await loadConfig();
  
  // Don't run if paused or already running
  if (state.status === 'paused' || state.status === 'running') {
    return false;
  }
  
  // Always run if never run before
  if (!state.lastRun) {
    return true;
  }
  
  // Check if enough time has passed
  const lastRun = new Date(state.lastRun);
  const now = new Date();
  const minutesSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60);
  
  return minutesSinceLastRun >= config.schedule.intervalMinutes;
}

export async function calculateNextRun(): Promise<string> {
  const config = await loadConfig();
  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + config.schedule.intervalMinutes);
  return nextRun.toISOString();
}

export async function startRun(): Promise<AgentRunLog> {
  const runLog: AgentRunLog = {
    id: `run-${Date.now()}`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'success',
    discovered: 0,
    generated: 0,
    reviewed: 0,
    errors: [],
  };
  
  await updateState({
    status: 'running',
    currentTask: 'Starting research cycle',
    error: null,
  });
  
  return runLog;
}

export async function completeRun(
  runLog: AgentRunLog, 
  status: 'success' | 'partial' | 'failed'
): Promise<void> {
  runLog.completedAt = new Date().toISOString();
  runLog.status = status;
  
  const state = await loadState();
  state.history = [runLog, ...state.history.slice(0, 49)]; // Keep last 50 runs
  state.stats.totalRuns++;
  state.stats.entitiesDiscovered += runLog.discovered;
  state.stats.entriesGenerated += runLog.generated;
  state.stats.entriesReviewed += runLog.reviewed;
  state.lastRun = runLog.completedAt;
  state.nextRun = await calculateNextRun();
  state.status = 'idle';
  state.currentTask = null;
  
  if (status === 'failed' && runLog.errors.length > 0) {
    state.error = runLog.errors[0];
  }
  
  await saveState(state);
}

export async function pauseAgent(): Promise<void> {
  await updateState({ status: 'paused' });
}

export async function resumeAgent(): Promise<void> {
  const state = await loadState();
  if (state.status === 'paused') {
    await updateState({ 
      status: 'idle',
      nextRun: await calculateNextRun(),
    });
  }
}

// =============================================================================
// STATUS
// =============================================================================

/**
 * Check if we're using KV storage (production) or file storage (local)
 */
export function isUsingKVStorage(): boolean {
  return isUsingKV();
}

export async function getAgentStatus(): Promise<{
  state: AgentState;
  config: AgentConfig;
  queue: {
    discovered: number;
    queued: number;
    generating: number;
    pendingReview: number;
  };
  storageMode: 'kv' | 'file';
}> {
  const state = await loadState();
  const config = await loadConfig();
  const discoveryQueue = await loadDiscoveryQueue();
  const pendingEntries = await loadPendingEntries();
  
  return {
    state,
    config,
    queue: {
      discovered: discoveryQueue.length,
      queued: discoveryQueue.filter(e => e.status === 'queued').length,
      generating: discoveryQueue.filter(e => e.status === 'generating').length,
      pendingReview: pendingEntries.filter(e => e.status === 'pending').length,
    },
    storageMode: isUsingKV() ? 'kv' : 'file',
  };
}
