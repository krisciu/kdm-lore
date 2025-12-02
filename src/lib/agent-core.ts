/**
 * Agent Core - Main agent loop, scheduling, and state management
 * Orchestrates the autonomous research pipeline
 */

import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_PATH, 'agent-state.json');
const CONFIG_FILE = path.join(DATA_PATH, 'agent-config.json');

// =============================================================================
// TYPES
// =============================================================================

export interface AgentConfig {
  schedule: {
    intervalMinutes: number;
    maxEntriesPerRun: number;
    apiDelayMs: number;
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
  currentTask: string | null;
  error: string | null;
  stats: {
    totalRuns: number;
    entitiesDiscovered: number;
    entriesGenerated: number;
    entriesApproved: number;
    entriesRejected: number;
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
  errors: string[];
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
    model: 'claude-sonnet-4-20250514',
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
  currentTask: null,
  error: null,
  stats: {
    totalRuns: 0,
    entitiesDiscovered: 0,
    entriesGenerated: 0,
    entriesApproved: 0,
    entriesRejected: 0,
  },
  history: [],
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
}

export function loadConfig(): AgentConfig {
  ensureDataDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    } catch {
      // Return default on error
    }
  }
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

export function saveConfig(config: AgentConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadState(): AgentState {
  ensureDataDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return { ...DEFAULT_STATE, ...data };
    } catch {
      // Return default on error
    }
  }
  saveState(DEFAULT_STATE);
  return DEFAULT_STATE;
}

export function saveState(state: AgentState): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function updateState(updates: Partial<AgentState>): AgentState {
  const state = loadState();
  const newState = { ...state, ...updates };
  saveState(newState);
  return newState;
}

// =============================================================================
// DISCOVERY QUEUE
// =============================================================================

const DISCOVERY_QUEUE_FILE = path.join(DATA_PATH, 'discovery-queue.json');

export function loadDiscoveryQueue(): DiscoveredEntity[] {
  ensureDataDir();
  if (fs.existsSync(DISCOVERY_QUEUE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DISCOVERY_QUEUE_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

export function saveDiscoveryQueue(queue: DiscoveredEntity[]): void {
  ensureDataDir();
  fs.writeFileSync(DISCOVERY_QUEUE_FILE, JSON.stringify(queue, null, 2));
}

export function addToDiscoveryQueue(entity: Omit<DiscoveredEntity, 'id' | 'discoveredAt' | 'status'>): DiscoveredEntity {
  const queue = loadDiscoveryQueue();
  
  // Check for duplicates
  const existing = queue.find(e => e.name.toLowerCase() === entity.name.toLowerCase());
  if (existing) {
    // Merge source files and images
    existing.sourceFiles = [...new Set([...existing.sourceFiles, ...entity.sourceFiles])];
    existing.images = [...new Set([...existing.images, ...entity.images])];
    saveDiscoveryQueue(queue);
    return existing;
  }
  
  const newEntity: DiscoveredEntity = {
    ...entity,
    id: `entity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    discoveredAt: new Date().toISOString(),
    status: 'queued',
  };
  
  queue.push(newEntity);
  saveDiscoveryQueue(queue);
  return newEntity;
}

export function getNextEntityToProcess(): DiscoveredEntity | null {
  const queue = loadDiscoveryQueue();
  const queued = queue
    .filter(e => e.status === 'queued')
    .sort((a, b) => b.priority - a.priority);
  return queued[0] || null;
}

export function updateEntityStatus(
  entityId: string, 
  status: DiscoveredEntity['status']
): void {
  const queue = loadDiscoveryQueue();
  const entity = queue.find(e => e.id === entityId);
  if (entity) {
    entity.status = status;
    saveDiscoveryQueue(queue);
  }
}

// =============================================================================
// PENDING ENTRIES
// =============================================================================

const PENDING_ENTRIES_FILE = path.join(DATA_PATH, 'pending-entries.json');

export function loadPendingEntries(): PendingEntry[] {
  ensureDataDir();
  if (fs.existsSync(PENDING_ENTRIES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PENDING_ENTRIES_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

export function savePendingEntries(entries: PendingEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(PENDING_ENTRIES_FILE, JSON.stringify(entries, null, 2));
}

export function addPendingEntry(entry: Omit<PendingEntry, 'id' | 'createdAt' | 'status'>): PendingEntry {
  const entries = loadPendingEntries();
  
  const newEntry: PendingEntry = {
    ...entry,
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  
  entries.push(newEntry);
  savePendingEntries(entries);
  return newEntry;
}

export function getPendingForReview(): PendingEntry[] {
  return loadPendingEntries().filter(e => e.status === 'pending');
}

export function updatePendingEntryStatus(
  entryId: string,
  status: PendingEntry['status'],
  notes?: string
): PendingEntry | null {
  const entries = loadPendingEntries();
  const entry = entries.find(e => e.id === entryId);
  
  if (!entry) return null;
  
  entry.status = status;
  if (notes) entry.reviewNotes = notes;
  
  savePendingEntries(entries);
  return entry;
}

// =============================================================================
// SCHEDULING
// =============================================================================

export function shouldRunAgent(): boolean {
  const state = loadState();
  const config = loadConfig();
  
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

export function calculateNextRun(): string {
  const config = loadConfig();
  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + config.schedule.intervalMinutes);
  return nextRun.toISOString();
}

export function startRun(): AgentRunLog {
  const runLog: AgentRunLog = {
    id: `run-${Date.now()}`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'success',
    discovered: 0,
    generated: 0,
    errors: [],
  };
  
  updateState({
    status: 'running',
    currentTask: 'Starting research cycle',
    error: null,
  });
  
  return runLog;
}

export function completeRun(runLog: AgentRunLog, status: 'success' | 'partial' | 'failed'): void {
  runLog.completedAt = new Date().toISOString();
  runLog.status = status;
  
  const state = loadState();
  state.history = [runLog, ...state.history.slice(0, 49)]; // Keep last 50 runs
  state.stats.totalRuns++;
  state.stats.entitiesDiscovered += runLog.discovered;
  state.stats.entriesGenerated += runLog.generated;
  state.lastRun = runLog.completedAt;
  state.nextRun = calculateNextRun();
  state.status = 'idle';
  state.currentTask = null;
  
  if (status === 'failed' && runLog.errors.length > 0) {
    state.error = runLog.errors[0];
  }
  
  saveState(state);
}

export function pauseAgent(): void {
  updateState({ status: 'paused' });
}

export function resumeAgent(): void {
  const state = loadState();
  if (state.status === 'paused') {
    updateState({ 
      status: 'idle',
      nextRun: calculateNextRun(),
    });
  }
}

// =============================================================================
// STATUS
// =============================================================================

export function getAgentStatus(): {
  state: AgentState;
  config: AgentConfig;
  queue: {
    discovered: number;
    queued: number;
    generating: number;
    pendingReview: number;
  };
} {
  const state = loadState();
  const config = loadConfig();
  const discoveryQueue = loadDiscoveryQueue();
  const pendingEntries = loadPendingEntries();
  
  return {
    state,
    config,
    queue: {
      discovered: discoveryQueue.length,
      queued: discoveryQueue.filter(e => e.status === 'queued').length,
      generating: discoveryQueue.filter(e => e.status === 'generating').length,
      pendingReview: pendingEntries.filter(e => e.status === 'pending').length,
    },
  };
}

