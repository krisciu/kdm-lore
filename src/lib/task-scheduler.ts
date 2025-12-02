/**
 * Task Scheduler - Intelligent prioritization for the research agent
 * 
 * Replaces fixed entry counts with dynamic task selection based on
 * what the lore compendium actually needs.
 * 
 * Priority order:
 * 1. Fix broken content (links, YAML)
 * 2. Review quality issues
 * 3. Expand shallow entries
 * 4. Update stale entries
 * 5. Generate new entries (only when existing content is healthy)
 */

import fs from 'fs';
import path from 'path';
import { loadConfig, updateState, AgentState } from './agent-core';

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export type TaskType = 
  | 'fix_broken'      // Fix broken links, malformed YAML
  | 'review_quality'  // Address quality issues flagged by scanner
  | 'expand_basic'    // Add detail to shallow entries
  | 'update_stale'    // Refresh entries not updated in 30+ days
  | 'generate_new';   // Create new entries from discovery queue

export interface Task {
  id: string;
  type: TaskType;
  priority: number;      // 0-100, higher = more urgent
  target: string;        // File path or entity ID
  description: string;
  estimatedTokens: number;
  metadata?: Record<string, unknown>;
}

export interface TaskStats {
  brokenEntries: number;
  qualityIssues: number;
  basicEntries: number;
  staleEntries: number;
  pendingEntities: number;
  healthScore: number;   // 0-100, overall compendium health
}

export interface SchedulerConfig {
  maxRunTimeMinutes: number;
  maxTokenBudget: number;
  priorityWeights: {
    fix_broken: number;
    review_quality: number;
    expand_basic: number;
    update_stale: number;
    generate_new: number;
  };
  staleThresholdDays: number;
}

export interface TaskBatch {
  tasks: Task[];
  totalEstimatedTokens: number;
  taskCounts: Record<TaskType, number>;
  healthScore: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: SchedulerConfig = {
  maxRunTimeMinutes: 30,
  maxTokenBudget: 100000,
  priorityWeights: {
    fix_broken: 10,
    review_quality: 5,
    expand_basic: 3,
    update_stale: 2,
    generate_new: 1,
  },
  staleThresholdDays: 30,
};

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Analyze the current state of the lore compendium
 */
export async function analyzeCompendiumHealth(): Promise<TaskStats> {
  const stats: TaskStats = {
    brokenEntries: 0,
    qualityIssues: 0,
    basicEntries: 0,
    staleEntries: 0,
    pendingEntities: 0,
    healthScore: 100,
  };
  
  const categories = [
    '01-world', '02-factions', '03-locations', '04-monsters',
    '05-characters', '06-concepts', '07-technology', '08-theories',
  ];
  
  const now = new Date();
  const staleThreshold = DEFAULT_CONFIG.staleThresholdDays * 24 * 60 * 60 * 1000;
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check for broken links
      if (hasBrokenLinks(content)) {
        stats.brokenEntries++;
      }
      
      // Check for malformed YAML
      if (hasMalformedYAML(content)) {
        stats.brokenEntries++;
      }
      
      // Check detail level
      const detailLevel = assessDetailLevel(content);
      if (detailLevel === 'basic') {
        stats.basicEntries++;
      }
      
      // Check staleness
      const lastUpdated = extractLastUpdated(content);
      if (lastUpdated && (now.getTime() - lastUpdated.getTime()) > staleThreshold) {
        stats.staleEntries++;
      }
    }
  }
  
  // Count pending entities from discovery queue
  try {
    const queuePath = path.join(process.cwd(), 'data', 'discovery-queue.json');
    if (fs.existsSync(queuePath)) {
      const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
      stats.pendingEntities = queue.filter((e: { status: string }) => e.status === 'queued').length;
    }
  } catch {
    // Queue file might not exist
  }
  
  // Count quality issues from review queue
  try {
    const reviewPath = path.join(process.cwd(), 'data', 'review-queue.json');
    if (fs.existsSync(reviewPath)) {
      const queue = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
      stats.qualityIssues = queue.filter((e: { status: string }) => e.status === 'queued').length;
    }
  } catch {
    // Queue file might not exist
  }
  
  // Calculate health score (0-100)
  // Deduct points for issues
  let deductions = 0;
  deductions += stats.brokenEntries * 5;      // -5 per broken entry
  deductions += stats.qualityIssues * 2;      // -2 per quality issue
  deductions += stats.basicEntries * 1;       // -1 per basic entry
  deductions += Math.floor(stats.staleEntries / 5); // -1 per 5 stale entries
  
  stats.healthScore = Math.max(0, Math.min(100, 100 - deductions));
  
  return stats;
}

/**
 * Check if content has broken links
 */
function hasBrokenLinks(content: string): boolean {
  // Wiki-style links [[text]]
  if (/\[\[[^\]]+\]\]/.test(content)) return true;
  
  // Bare brackets [text] without (path)
  const bareLinks = content.match(/\[([^\]]+)\](?!\()/g) || [];
  // Filter out valid markdown like checkboxes [x] and reference links [1]
  const invalidBare = bareLinks.filter(link => {
    const text = link.slice(1, -1);
    return text.length > 2 && !/^[x\s\d]$/.test(text);
  });
  if (invalidBare.length > 0) return true;
  
  return false;
}

/**
 * Check if content has malformed YAML frontmatter
 */
function hasMalformedYAML(content: string): boolean {
  // Check for quoted JSON arrays in YAML
  if (/^sources:\s*"\[/.test(content)) return true;
  if (/sources:\s*"\[/.test(content)) return true;
  
  // Check for missing frontmatter on agent-generated entries
  if (content.includes('generatedBy') && !content.startsWith('---')) return true;
  
  return false;
}

/**
 * Assess detail level of an entry
 */
function assessDetailLevel(content: string): 'basic' | 'moderate' | 'comprehensive' {
  let score = 0;
  
  // Check for YAML frontmatter
  if (content.startsWith('---')) score += 1;
  
  // Check for sections
  const sections = content.match(/^##\s+/gm) || [];
  score += Math.min(sections.length, 5);
  
  // Check for citations
  const citations = content.match(/\[[a-z0-9-]+:\d+-?\d*\]/gi) || [];
  score += Math.min(citations.length, 5);
  
  // Check for specific content sections
  if (/## (gear|equipment)/i.test(content)) score += 2;
  if (/## (ai cards|behavior)/i.test(content)) score += 2;
  if (/## (events|hunt events)/i.test(content)) score += 2;
  if (/## (connections|relationships)/i.test(content)) score += 1;
  
  // Content length
  if (content.length > 3000) score += 2;
  if (content.length > 6000) score += 2;
  
  if (score >= 12) return 'comprehensive';
  if (score >= 6) return 'moderate';
  return 'basic';
}

/**
 * Extract last updated date from frontmatter
 */
function extractLastUpdated(content: string): Date | null {
  const match = content.match(/lastUpdated:\s*"?(\d{4}-\d{2}-\d{2})"?/);
  if (match) {
    return new Date(match[1]);
  }
  return null;
}

// =============================================================================
// TASK GENERATION
// =============================================================================

/**
 * Generate tasks for broken entries (highest priority)
 */
async function generateBrokenTasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  
  const categories = [
    '01-world', '02-factions', '03-locations', '04-monsters',
    '05-characters', '06-concepts', '07-technology', '08-theories',
  ];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const issues: string[] = [];
      
      if (hasBrokenLinks(content)) {
        issues.push('broken links');
      }
      
      if (hasMalformedYAML(content)) {
        issues.push('malformed YAML');
      }
      
      if (issues.length > 0) {
        tasks.push({
          id: `fix-${file.replace('.md', '')}-${Date.now()}`,
          type: 'fix_broken',
          priority: 90 + Math.min(issues.length * 5, 10), // 90-100
          target: filePath,
          description: `Fix ${issues.join(', ')} in ${file}`,
          estimatedTokens: 500, // Fixes are cheap
          metadata: { issues },
        });
      }
    }
  }
  
  return tasks;
}

/**
 * Generate tasks for quality issues
 */
async function generateQualityTasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  
  try {
    const reviewPath = path.join(process.cwd(), 'data', 'review-queue.json');
    if (fs.existsSync(reviewPath)) {
      const queue = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
      
      for (const entry of queue) {
        if (entry.status !== 'queued') continue;
        
        tasks.push({
          id: entry.id,
          type: 'review_quality',
          priority: 60 + Math.min(entry.priority || 0, 30), // 60-90
          target: entry.filePath,
          description: `Review quality issues in ${entry.entryName}`,
          estimatedTokens: 8000, // Reviews need AI
          metadata: { issues: entry.issues, score: entry.score },
        });
      }
    }
  } catch {
    // Queue might not exist
  }
  
  return tasks;
}

/**
 * Generate tasks for expanding basic entries
 */
async function generateExpansionTasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  
  const categories = ['04-monsters', '05-characters', '02-factions', '03-locations'];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const detailLevel = assessDetailLevel(content);
      
      if (detailLevel === 'basic') {
        // Extract title
        const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/title:\s*"?([^"\n]+)"?/);
        const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
        
        tasks.push({
          id: `expand-${file.replace('.md', '')}-${Date.now()}`,
          type: 'expand_basic',
          priority: 40 + (category === '04-monsters' ? 10 : 0), // Monsters get priority
          target: filePath,
          description: `Expand ${title} from basic to moderate detail`,
          estimatedTokens: 12000, // Expansions need lots of AI
          metadata: { currentLevel: detailLevel, category },
        });
      }
    }
  }
  
  return tasks;
}

/**
 * Generate tasks for stale entries
 */
async function generateStaleTasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  const now = new Date();
  const staleThreshold = DEFAULT_CONFIG.staleThresholdDays * 24 * 60 * 60 * 1000;
  
  const categories = ['04-monsters', '05-characters', '02-factions'];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const lastUpdated = extractLastUpdated(content);
      
      if (lastUpdated && (now.getTime() - lastUpdated.getTime()) > staleThreshold) {
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (24 * 60 * 60 * 1000));
        
        const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/title:\s*"?([^"\n]+)"?/);
        const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
        
        tasks.push({
          id: `update-${file.replace('.md', '')}-${Date.now()}`,
          type: 'update_stale',
          priority: 20 + Math.min(Math.floor(daysSinceUpdate / 10), 20), // Older = higher priority
          target: filePath,
          description: `Update ${title} (${daysSinceUpdate} days old)`,
          estimatedTokens: 8000,
          metadata: { lastUpdated: lastUpdated.toISOString(), daysSinceUpdate },
        });
      }
    }
  }
  
  return tasks;
}

/**
 * Generate tasks for new entries
 */
async function generateNewTasks(): Promise<Task[]> {
  const tasks: Task[] = [];
  
  try {
    const queuePath = path.join(process.cwd(), 'data', 'discovery-queue.json');
    if (fs.existsSync(queuePath)) {
      const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
      
      for (const entity of queue) {
        if (entity.status !== 'queued') continue;
        
        tasks.push({
          id: entity.id,
          type: 'generate_new',
          priority: Math.min(entity.priority || 1, 20), // Max 20 for new entries
          target: entity.id,
          description: `Generate entry for ${entity.name} (${entity.type})`,
          estimatedTokens: 15000, // New entries are expensive
          metadata: { 
            entityName: entity.name, 
            entityType: entity.type,
            sourceCount: entity.sourceFiles?.length || 0,
          },
        });
      }
    }
  } catch {
    // Queue might not exist
  }
  
  return tasks;
}

// =============================================================================
// MAIN SCHEDULER
// =============================================================================

/**
 * Get all available tasks, sorted by priority
 */
export async function getAllTasks(): Promise<Task[]> {
  const [broken, quality, expansion, stale, newEntries] = await Promise.all([
    generateBrokenTasks(),
    generateQualityTasks(),
    generateExpansionTasks(),
    generateStaleTasks(),
    generateNewTasks(),
  ]);
  
  const allTasks = [...broken, ...quality, ...expansion, ...stale, ...newEntries];
  
  // Sort by priority (highest first)
  return allTasks.sort((a, b) => b.priority - a.priority);
}

/**
 * Schedule a batch of tasks within token budget
 */
export async function scheduleTasks(tokenBudget?: number): Promise<TaskBatch> {
  const config = await loadSchedulerConfig();
  const budget = tokenBudget || config.maxTokenBudget;
  
  const allTasks = await getAllTasks();
  const stats = await analyzeCompendiumHealth();
  
  const batch: Task[] = [];
  let totalTokens = 0;
  const taskCounts: Record<TaskType, number> = {
    fix_broken: 0,
    review_quality: 0,
    expand_basic: 0,
    update_stale: 0,
    generate_new: 0,
  };
  
  // Select tasks until budget is exhausted
  for (const task of allTasks) {
    if (totalTokens + task.estimatedTokens > budget) {
      // Skip tasks that would exceed budget, but keep looking for smaller ones
      if (task.estimatedTokens < budget - totalTokens) {
        continue;
      }
      break;
    }
    
    // Enforce minimum health score before generating new entries
    if (task.type === 'generate_new' && stats.healthScore < 70) {
      // Skip new generation if compendium isn't healthy enough
      continue;
    }
    
    batch.push(task);
    totalTokens += task.estimatedTokens;
    taskCounts[task.type]++;
  }
  
  return {
    tasks: batch,
    totalEstimatedTokens: totalTokens,
    taskCounts,
    healthScore: stats.healthScore,
  };
}

/**
 * Get the next task to work on
 */
export async function getNextTask(): Promise<Task | null> {
  const tasks = await getAllTasks();
  return tasks[0] || null;
}

/**
 * Load scheduler config from agent config
 */
async function loadSchedulerConfig(): Promise<SchedulerConfig> {
  try {
    const config = await loadConfig();
    return {
      maxRunTimeMinutes: config.schedule.maxRunTimeMinutes || DEFAULT_CONFIG.maxRunTimeMinutes,
      maxTokenBudget: config.schedule.maxTokenBudget || DEFAULT_CONFIG.maxTokenBudget,
      priorityWeights: config.schedule.priorityWeights || DEFAULT_CONFIG.priorityWeights,
      staleThresholdDays: config.schedule.staleThresholdDays || DEFAULT_CONFIG.staleThresholdDays,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Get scheduler statistics for dashboard
 */
export async function getSchedulerStats(): Promise<{
  health: TaskStats;
  pendingTasks: Record<TaskType, number>;
  nextBatch: TaskBatch;
}> {
  const health = await analyzeCompendiumHealth();
  const allTasks = await getAllTasks();
  
  const pendingTasks: Record<TaskType, number> = {
    fix_broken: 0,
    review_quality: 0,
    expand_basic: 0,
    update_stale: 0,
    generate_new: 0,
  };
  
  for (const task of allTasks) {
    pendingTasks[task.type]++;
  }
  
  const nextBatch = await scheduleTasks();
  
  return {
    health,
    pendingTasks,
    nextBatch,
  };
}

/**
 * Update agent state with health score
 */
export async function updateHealthScore(): Promise<void> {
  const health = await analyzeCompendiumHealth();
  await updateState({ 
    healthScore: health.healthScore,
    lastHealthCheck: new Date().toISOString(),
  } as Partial<AgentState>);
}

