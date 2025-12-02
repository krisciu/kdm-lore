/**
 * Autonomous Lore Researcher Agent
 * Manages research tasks, processes them asynchronously, and generates lore content
 */

import fs from 'fs';
import path from 'path';
import {
  ResearchTask,
  ResearchQueue,
  ResearchAgentConfig,
  ResearchFinding,
  SuggestedLoreEntry,
  ResearchSession,
  createResearchTask,
  ResearchTaskType,
} from '@/types/researcher';
import { saveLoreEntry, searchLoreFiles, getAllLoreFiles, LORE_DIRECTORIES } from './lore-service';

const QUEUE_FILE = path.join(process.cwd(), 'data', 'research-queue.json');
const SESSIONS_FILE = path.join(process.cwd(), 'data', 'research-sessions.json');
const CONFIG_FILE = path.join(process.cwd(), 'data', 'research-config.json');

// Default configuration
const DEFAULT_CONFIG: ResearchAgentConfig = {
  enabled: true,
  maxConcurrentTasks: 1,
  autoApprove: false,
  minConfidenceForAutoApprove: 0.9,
  researchIntervalMs: 60000, // 1 minute
  webResearchEnabled: true,
  sources: {
    rulebooks: true,
    kickstarter: true,
    communityWiki: true,
    forums: true,
    webSearch: true,
  },
};

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Load the research queue from disk
 */
export function loadQueue(): ResearchQueue {
  ensureDataDir();
  
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      console.error('Failed to load research queue, creating new one');
    }
  }

  const queue: ResearchQueue = {
    tasks: [],
    lastUpdated: new Date().toISOString(),
    stats: {
      queued: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      needsReview: 0,
    },
  };

  saveQueue(queue);
  return queue;
}

/**
 * Save the research queue to disk
 */
export function saveQueue(queue: ResearchQueue): void {
  ensureDataDir();
  queue.lastUpdated = new Date().toISOString();
  
  // Update stats
  queue.stats = {
    queued: queue.tasks.filter(t => t.status === 'queued').length,
    inProgress: queue.tasks.filter(t => t.status === 'in_progress').length,
    completed: queue.tasks.filter(t => t.status === 'completed' || t.status === 'approved').length,
    failed: queue.tasks.filter(t => t.status === 'failed' || t.status === 'rejected').length,
    needsReview: queue.tasks.filter(t => t.status === 'needs_review').length,
  };

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/**
 * Load agent configuration
 */
export function loadConfig(): ResearchAgentConfig {
  ensureDataDir();
  
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      console.error('Failed to load research config, using defaults');
    }
  }

  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Save agent configuration
 */
export function saveConfig(config: ResearchAgentConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Add a new research task to the queue
 */
export function addTask(
  type: ResearchTaskType,
  topic: string,
  description: string,
  options?: Partial<ResearchTask>
): ResearchTask {
  const queue = loadQueue();
  const task = createResearchTask(type, topic, description, options);
  
  queue.tasks.push(task);
  saveQueue(queue);
  
  return task;
}

/**
 * Get the next task to process
 */
export function getNextTask(): ResearchTask | null {
  const queue = loadQueue();
  
  // Find highest priority queued task
  const queuedTasks = queue.tasks
    .filter(t => t.status === 'queued')
    .sort((a, b) => b.priority - a.priority);

  return queuedTasks[0] || null;
}

/**
 * Update a task's status
 */
export function updateTaskStatus(
  taskId: string,
  status: ResearchTask['status'],
  updates?: Partial<ResearchTask>
): ResearchTask | null {
  const queue = loadQueue();
  const taskIndex = queue.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) return null;

  queue.tasks[taskIndex] = {
    ...queue.tasks[taskIndex],
    ...updates,
    status,
  };

  if (status === 'in_progress' && !queue.tasks[taskIndex].startedAt) {
    queue.tasks[taskIndex].startedAt = new Date().toISOString();
    queue.currentTask = taskId;
  }

  if (status === 'completed' || status === 'failed' || status === 'needs_review') {
    queue.tasks[taskIndex].completedAt = new Date().toISOString();
    if (queue.currentTask === taskId) {
      queue.currentTask = undefined;
    }
  }

  saveQueue(queue);
  return queue.tasks[taskIndex];
}

/**
 * Add findings to a task
 */
export function addFindings(taskId: string, findings: ResearchFinding[]): void {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  
  if (!task) return;

  task.findings = [...(task.findings || []), ...findings];
  saveQueue(queue);
}

/**
 * Set suggested entry for a task
 */
export function setSuggestedEntry(taskId: string, entry: SuggestedLoreEntry): void {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  
  if (!task) return;

  task.suggestedEntry = entry;
  saveQueue(queue);
}

/**
 * Approve a research task and save the generated entry
 * Now with changelog integration for tracking
 */
export async function approveTask(taskId: string, reviewedBy?: string): Promise<{ success: boolean; path?: string; error?: string; changelogId?: string }> {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  
  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  if (!task.suggestedEntry) {
    return { success: false, error: 'No suggested entry to approve' };
  }

  // Determine the directory based on category
  const category = task.suggestedEntry.category || task.targetCategory || 'concepts';
  const directory = Object.entries(LORE_DIRECTORIES).find(
    ([, config]) => config.category === category
  )?.[0] || 'concepts';

  // Convert findings to string array for changelog
  const findingStrings = task.findings?.map(f => f.content) || [];

  // Save the entry with changelog tracking
  const result = await saveLoreEntry(
    {
      title: task.suggestedEntry.title,
      category: task.suggestedEntry.category as any,
      summary: task.suggestedEntry.summary,
      content: task.suggestedEntry.content,
      tags: task.suggestedEntry.tags,
      confidence: task.suggestedEntry.confidence,
    },
    directory as any,
    {
      source: 'agent_research',
      taskId: task.id,
      findings: findingStrings,
    }
  );

  if (result.success) {
    updateTaskStatus(taskId, 'approved', {
      reviewedAt: new Date().toISOString(),
      reviewedBy,
    });
  }

  return result;
}

/**
 * Reject a research task
 */
export function rejectTask(taskId: string, reviewedBy?: string): void {
  updateTaskStatus(taskId, 'rejected', {
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  });
}

/**
 * Get queue statistics
 */
export function getQueueStats(): ResearchQueue['stats'] {
  const queue = loadQueue();
  return queue.stats;
}

/**
 * Get all tasks with optional filtering
 */
export function getTasks(filter?: {
  status?: ResearchTask['status'];
  type?: ResearchTaskType;
  limit?: number;
}): ResearchTask[] {
  const queue = loadQueue();
  let tasks = queue.tasks;

  if (filter?.status) {
    tasks = tasks.filter(t => t.status === filter.status);
  }

  if (filter?.type) {
    tasks = tasks.filter(t => t.type === filter.type);
  }

  if (filter?.limit) {
    tasks = tasks.slice(0, filter.limit);
  }

  return tasks;
}

/**
 * Clear completed/failed tasks older than specified days
 */
export function cleanupOldTasks(daysOld: number = 30): number {
  const queue = loadQueue();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const originalLength = queue.tasks.length;
  queue.tasks = queue.tasks.filter(task => {
    if (task.status === 'queued' || task.status === 'in_progress' || task.status === 'needs_review') {
      return true; // Keep active tasks
    }
    
    const completedDate = task.completedAt ? new Date(task.completedAt) : null;
    return completedDate && completedDate > cutoff;
  });

  saveQueue(queue);
  return originalLength - queue.tasks.length;
}

/**
 * Generate automatic research tasks based on existing lore
 */
export function generateAutoTasks(): ResearchTask[] {
  const files = getAllLoreFiles();
  const queue = loadQueue();
  const existingTopics = new Set(queue.tasks.map(t => t.topic.toLowerCase()));
  const newTasks: ResearchTask[] = [];

  // Find entries that could use expansion
  files.forEach(file => {
    const content = fs.readFileSync(file.path, 'utf-8');
    
    // Short entries might need expansion
    if (content.length < 1000 && !existingTopics.has(file.title.toLowerCase())) {
      const task = addTask(
        'expand_entry',
        file.title,
        `Expand the entry for "${file.title}" with more detail`,
        { priority: 3, relatedEntries: [file.slug], targetCategory: file.category }
      );
      newTasks.push(task);
    }

    // Check for "needs research" markers
    if (content.includes('TODO') || content.includes('needs research') || content.includes('TBD')) {
      if (!existingTopics.has(`verify-${file.title.toLowerCase()}`)) {
        const task = addTask(
          'verify_facts',
          `verify-${file.title}`,
          `Verify and complete missing information in "${file.title}"`,
          { priority: 5, relatedEntries: [file.slug] }
        );
        newTasks.push(task);
      }
    }
  });

  return newTasks;
}

/**
 * Log a research session
 */
export function logSession(session: ResearchSession): void {
  ensureDataDir();
  
  let sessions: ResearchSession[] = [];
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    } catch {
      sessions = [];
    }
  }

  sessions.push(session);
  
  // Keep only last 100 sessions
  if (sessions.length > 100) {
    sessions = sessions.slice(-100);
  }

  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

/**
 * Get recent research sessions
 */
export function getRecentSessions(limit: number = 10): ResearchSession[] {
  if (!fs.existsSync(SESSIONS_FILE)) {
    return [];
  }

  try {
    const sessions: ResearchSession[] = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    return sessions.slice(-limit).reverse();
  } catch {
    return [];
  }
}

