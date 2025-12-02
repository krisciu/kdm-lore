/**
 * Agent Scheduler - Autonomous research task scheduling and execution
 * Manages when and how the agent runs research cycles
 */

import fs from 'fs';
import path from 'path';
import {
  loadQueue,
  saveQueue,
  addTask,
  getNextTask,
  updateTaskStatus,
  addFindings,
  setSuggestedEntry,
  loadConfig,
  logSession,
} from './research-agent';
import {
  getAllParsedEntities,
  findMissingEntries,
  ParsedEntity,
  getSourceStats,
} from './source-parser';
import { getAllLoreFiles } from './lore-service';
import { recordChange } from './changelog-service';
import { ResearchTask, ResearchFinding, SuggestedLoreEntry, ResearchSession } from '@/types/researcher';

const SCHEDULER_STATE_FILE = path.join(process.cwd(), 'data', 'scheduler-state.json');

export interface SchedulerState {
  enabled: boolean;
  lastRun?: string;
  nextScheduledRun?: string;
  intervalMinutes: number;
  maxTasksPerRun: number;
  autoCreateTasks: boolean;
  priorityRules: PriorityRule[];
  stats: {
    totalRuns: number;
    totalTasksProcessed: number;
    totalEntriesCreated: number;
    lastSuccessfulRun?: string;
    errors: string[];
  };
}

export interface PriorityRule {
  id: string;
  name: string;
  condition: 'type' | 'tag' | 'source' | 'age';
  value: string;
  priorityBoost: number;
  enabled: boolean;
}

export interface AgentRunResult {
  success: boolean;
  tasksProcessed: number;
  entriesCreated: number;
  errors: string[];
  duration: number;
  findings: ResearchFinding[];
}

const DEFAULT_SCHEDULER_STATE: SchedulerState = {
  enabled: true,
  intervalMinutes: 30,
  maxTasksPerRun: 3,
  autoCreateTasks: true,
  priorityRules: [
    { id: 'rule-1', name: 'Monsters First', condition: 'type', value: 'monster', priorityBoost: 2, enabled: true },
    { id: 'rule-2', name: 'Core Game Priority', condition: 'tag', value: 'core-game', priorityBoost: 3, enabled: true },
    { id: 'rule-3', name: 'Confirmed Sources', condition: 'source', value: 'rulebook', priorityBoost: 2, enabled: true },
  ],
  stats: {
    totalRuns: 0,
    totalTasksProcessed: 0,
    totalEntriesCreated: 0,
    errors: [],
  },
};

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Load scheduler state
 */
export function loadSchedulerState(): SchedulerState {
  ensureDataDir();

  if (fs.existsSync(SCHEDULER_STATE_FILE)) {
    try {
      const data = fs.readFileSync(SCHEDULER_STATE_FILE, 'utf-8');
      return { ...DEFAULT_SCHEDULER_STATE, ...JSON.parse(data) };
    } catch {
      console.error('Failed to load scheduler state');
    }
  }

  saveSchedulerState(DEFAULT_SCHEDULER_STATE);
  return DEFAULT_SCHEDULER_STATE;
}

/**
 * Save scheduler state
 */
export function saveSchedulerState(state: SchedulerState): void {
  ensureDataDir();
  fs.writeFileSync(SCHEDULER_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Auto-generate research tasks from parsed sources
 */
export function generateTasksFromSources(): ResearchTask[] {
  const existingFiles = getAllLoreFiles();
  const existingTitles = existingFiles.map(f => f.title);
  const missingEntities = findMissingEntries(existingTitles);
  const queue = loadQueue();
  const existingTopics = new Set(queue.tasks.map(t => t.topic.toLowerCase()));
  
  const newTasks: ResearchTask[] = [];
  const state = loadSchedulerState();

  // Create tasks for missing entities
  for (const entity of missingEntities) {
    const topicKey = entity.name.toLowerCase();
    if (existingTopics.has(topicKey)) continue;

    // Calculate priority based on rules
    let priority = 5;
    for (const rule of state.priorityRules) {
      if (!rule.enabled) continue;
      
      switch (rule.condition) {
        case 'type':
          if (entity.type === rule.value) priority += rule.priorityBoost;
          break;
        case 'tag':
          if (entity.tags.includes(rule.value)) priority += rule.priorityBoost;
          break;
      }
    }

    // Cap priority at 10
    priority = Math.min(priority, 10);

    // Map entity type to lore category
    const categoryMap: Record<string, string> = {
      monster: 'monsters',
      character: 'characters',
      faction: 'factions',
      location: 'locations',
      concept: 'concepts',
      item: 'technology',
    };

    const task = addTask(
      'create_entry',
      entity.name,
      `Create lore entry for ${entity.name} based on source material`,
      {
        priority,
        targetCategory: categoryMap[entity.type] || 'concepts',
        relatedEntries: entity.connections.map(c => c.toLowerCase().replace(/\s+/g, '-')),
      }
    );

    // Attach parsed entity data to task
    (task as any).parsedEntity = entity;
    newTasks.push(task);
    existingTopics.add(topicKey);
  }

  return newTasks;
}

/**
 * Process a single research task using source material
 */
export async function processTaskFromSource(task: ResearchTask): Promise<{
  success: boolean;
  findings: ResearchFinding[];
  suggestedEntry?: SuggestedLoreEntry;
  error?: string;
}> {
  try {
    // Get parsed entity if attached, otherwise search for it
    let entity: ParsedEntity | undefined = (task as any).parsedEntity;
    
    if (!entity) {
      const allEntities = getAllParsedEntities();
      entity = allEntities.find(e => 
        e.name.toLowerCase() === task.topic.toLowerCase()
      );
    }

    if (!entity) {
      return {
        success: false,
        findings: [],
        error: `No source material found for: ${task.topic}`,
      };
    }

    // Create findings from the entity
    const findings: ResearchFinding[] = [
      {
        id: `finding-${task.id}-main`,
        content: entity.description,
        source: 'rulebook',
        confidence: entity.confidence,
        relevance: 1.0,
        timestamp: new Date().toISOString(),
      },
    ];

    // Add connection findings
    if (entity.connections.length > 0) {
      findings.push({
        id: `finding-${task.id}-connections`,
        content: `Connected to: ${entity.connections.join(', ')}`,
        source: 'ai_inference',
        confidence: 'likely',
        relevance: 0.8,
        timestamp: new Date().toISOString(),
      });
    }

    // Generate suggested entry
    const suggestedEntry: SuggestedLoreEntry = {
      title: entity.name,
      category: entity.type,
      summary: entity.description.slice(0, 200) + (entity.description.length > 200 ? '...' : ''),
      content: generateMarkdownContent(entity),
      tags: entity.tags,
      confidence: entity.confidence,
      sources: [
        {
          name: entity.sourceFile,
          type: 'rulebook',
        },
      ],
      connections: entity.connections.map(c => ({
        slug: c.toLowerCase().replace(/\s+/g, '-'),
        type: 'related' as const,
      })),
    };

    return {
      success: true,
      findings,
      suggestedEntry,
    };
  } catch (error) {
    return {
      success: false,
      findings: [],
      error: String(error),
    };
  }
}

/**
 * Generate markdown content from parsed entity
 */
function generateMarkdownContent(entity: ParsedEntity): string {
  let content = `# ${entity.name}\n\n`;
  
  // Add metadata header
  content += `> **Type:** ${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}  \n`;
  content += `> **Source:** ${entity.sourceFile}  \n`;
  content += `> **Confidence:** ${entity.confidence}\n\n`;

  content += `---\n\n`;

  // Main description
  content += `## Overview\n\n`;
  content += `${entity.description}\n\n`;

  // Quotes if any
  if (entity.quotes.length > 0) {
    content += `## Notable Quotes\n\n`;
    for (const quote of entity.quotes) {
      content += `> "${quote}"\n\n`;
    }
  }

  // Connections
  if (entity.connections.length > 0) {
    content += `## Connections\n\n`;
    content += `This entry is connected to:\n\n`;
    for (const connection of entity.connections) {
      const slug = connection.toLowerCase().replace(/\s+/g, '-');
      content += `- [${connection}](/lore/${slug})\n`;
    }
    content += `\n`;
  }

  // Tags
  if (entity.tags.length > 0) {
    content += `## Tags\n\n`;
    content += entity.tags.map(t => `\`${t}\``).join(' ') + '\n\n';
  }

  // Footer
  content += `---\n\n`;
  content += `*This entry was generated by the Research Agent from source material.*\n`;
  content += `*Last updated: ${new Date().toISOString().split('T')[0]}*\n`;

  return content;
}

/**
 * Run a complete research cycle
 */
export async function runResearchCycle(): Promise<AgentRunResult> {
  const startTime = Date.now();
  const state = loadSchedulerState();
  const config = loadConfig();

  if (!state.enabled || !config.enabled) {
    return {
      success: false,
      tasksProcessed: 0,
      entriesCreated: 0,
      errors: ['Agent or scheduler is disabled'],
      duration: 0,
      findings: [],
    };
  }

  const result: AgentRunResult = {
    success: true,
    tasksProcessed: 0,
    entriesCreated: 0,
    errors: [],
    duration: 0,
    findings: [],
  };

  const session: ResearchSession = {
    id: `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    tasksProcessed: 0,
    entriesCreated: 0,
    findingsGenerated: 0,
    errors: [],
  };

  try {
    // Auto-generate tasks if enabled
    if (state.autoCreateTasks) {
      const newTasks = generateTasksFromSources();
      if (newTasks.length > 0) {
        console.log(`Generated ${newTasks.length} new research tasks`);
      }
    }

    // Process tasks up to the limit
    for (let i = 0; i < state.maxTasksPerRun; i++) {
      const task = getNextTask();
      if (!task) break;

      // Mark as in progress
      updateTaskStatus(task.id, 'in_progress');

      // Process the task
      const taskResult = await processTaskFromSource(task);

      if (taskResult.success) {
        // Add findings
        addFindings(task.id, taskResult.findings);
        result.findings.push(...taskResult.findings);
        session.findingsGenerated += taskResult.findings.length;

        // Set suggested entry
        if (taskResult.suggestedEntry) {
          setSuggestedEntry(task.id, taskResult.suggestedEntry);
        }

        // Auto-approve if high confidence
        if (taskResult.suggestedEntry?.confidence === 'confirmed' && config.autoApprove) {
          updateTaskStatus(task.id, 'approved');
          result.entriesCreated++;
          session.entriesCreated++;
        } else {
          updateTaskStatus(task.id, 'needs_review');
        }

        result.tasksProcessed++;
        session.tasksProcessed++;
      } else {
        updateTaskStatus(task.id, 'failed', { error: taskResult.error });
        result.errors.push(taskResult.error || 'Unknown error');
        session.errors.push(taskResult.error || 'Unknown error');
      }
    }

    // Update scheduler state
    state.lastRun = new Date().toISOString();
    state.nextScheduledRun = new Date(Date.now() + state.intervalMinutes * 60000).toISOString();
    state.stats.totalRuns++;
    state.stats.totalTasksProcessed += result.tasksProcessed;
    state.stats.totalEntriesCreated += result.entriesCreated;
    
    if (result.tasksProcessed > 0) {
      state.stats.lastSuccessfulRun = new Date().toISOString();
    }
    
    saveSchedulerState(state);

    // Log session
    session.endedAt = new Date().toISOString();
    logSession(session);

    // Record in changelog
    if (result.tasksProcessed > 0) {
      await recordChange(
        'metadata',
        'system',
        `Research cycle completed: ${result.tasksProcessed} tasks processed`,
        [],
        {
          description: `Agent ran research cycle. Processed ${result.tasksProcessed} tasks, created ${result.entriesCreated} entries.`,
          sessionId: session.id,
          findings: result.findings.map(f => f.content.slice(0, 100)),
        }
      );
    }

  } catch (error) {
    result.success = false;
    result.errors.push(String(error));
    session.errors.push(String(error));
    session.endedAt = new Date().toISOString();
    logSession(session);
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Get scheduler status for display
 */
export function getSchedulerStatus(): {
  state: SchedulerState;
  sourceStats: ReturnType<typeof getSourceStats>;
  queueSize: number;
  pendingReview: number;
  isRunning: boolean;
} {
  const state = loadSchedulerState();
  const sourceStats = getSourceStats();
  const queue = loadQueue();
  
  return {
    state,
    sourceStats,
    queueSize: queue.stats.queued,
    pendingReview: queue.stats.needsReview,
    isRunning: queue.stats.inProgress > 0,
  };
}

/**
 * Toggle scheduler enabled state
 */
export function toggleScheduler(enabled: boolean): SchedulerState {
  const state = loadSchedulerState();
  state.enabled = enabled;
  saveSchedulerState(state);
  return state;
}

/**
 * Update scheduler settings
 */
export function updateSchedulerSettings(updates: Partial<SchedulerState>): SchedulerState {
  const state = loadSchedulerState();
  const newState = { ...state, ...updates };
  saveSchedulerState(newState);
  return newState;
}

