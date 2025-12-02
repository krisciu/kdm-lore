/**
 * Lore Generator - AI-powered lore entry generation
 * Takes source material and generates high-quality, reviewed entries
 */

import fs from 'fs';
import path from 'path';
import { generateLoreEntry, extractEntities, getAIConfig, isAIConfigured, SourceContext, GeneratedLoreEntry } from './ai-service';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');
const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');
const DATA_PATH = path.join(process.cwd(), 'data');
const PENDING_PATH = path.join(DATA_PATH, 'pending-entries.json');
const ENTITY_QUEUE_PATH = path.join(DATA_PATH, 'entity-queue.json');

// =============================================================================
// TYPES
// =============================================================================

export interface PendingEntry {
  id: string;
  entityName: string;
  generated: GeneratedLoreEntry;
  sources: string[];
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  reviewNotes?: string;
}

export interface QueuedEntity {
  id: string;
  name: string;
  type: string;
  brief: string;
  sourceFiles: string[];
  priority: number;
  status: 'queued' | 'generating' | 'generated' | 'failed';
  createdAt: string;
  error?: string;
}

// =============================================================================
// SOURCE LOADING
// =============================================================================

/**
 * Load a source file and prepare it for AI processing
 */
export function loadSource(relativePath: string): SourceContext | null {
  const fullPath = path.join(SOURCES_PATH, relativePath);
  
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fileName = path.basename(relativePath);
  
  // Determine source type
  let type: SourceContext['type'] = 'community';
  if (relativePath.includes('shop')) type = 'shop';
  else if (relativePath.includes('rulebook') || relativePath.includes('rules')) type = 'rulebook';
  else if (relativePath.includes('news') || relativePath.includes('newsletter')) type = 'newsletter';
  
  return {
    fileName,
    filePath: relativePath,
    content,
    type,
  };
}

/**
 * Find all sources that mention an entity
 */
export function findSourcesForEntity(entityName: string): SourceContext[] {
  const sources: SourceContext[] = [];
  const searchTerm = entityName.toLowerCase();
  
  function searchDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Skip image directories
        if (!item.includes('image')) {
          searchDirectory(itemPath);
        }
      } else if (item.endsWith('.txt') || item.endsWith('.md')) {
        const content = fs.readFileSync(itemPath, 'utf-8');
        
        if (content.toLowerCase().includes(searchTerm)) {
          const relativePath = itemPath.replace(SOURCES_PATH + '/', '');
          const source = loadSource(relativePath);
          if (source) {
            sources.push(source);
          }
        }
      }
    }
  }
  
  searchDirectory(SOURCES_PATH);
  return sources;
}

/**
 * Get the best sources for an entity (prioritized and limited)
 */
export function getBestSources(entityName: string, limit: number = 5): SourceContext[] {
  const allSources = findSourcesForEntity(entityName);
  
  // Priority: shop > rulebook > newsletter > community
  const priority: Record<SourceContext['type'], number> = {
    shop: 4,
    rulebook: 3,
    newsletter: 2,
    community: 1,
  };
  
  return allSources
    .sort((a, b) => priority[b.type] - priority[a.type])
    .slice(0, limit);
}

// =============================================================================
// ENTITY QUEUE MANAGEMENT
// =============================================================================

function ensureDataDir() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
}

export function loadEntityQueue(): QueuedEntity[] {
  ensureDataDir();
  if (fs.existsSync(ENTITY_QUEUE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(ENTITY_QUEUE_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

export function saveEntityQueue(queue: QueuedEntity[]): void {
  ensureDataDir();
  fs.writeFileSync(ENTITY_QUEUE_PATH, JSON.stringify(queue, null, 2));
}

export function addToQueue(entity: Omit<QueuedEntity, 'id' | 'createdAt' | 'status'>): QueuedEntity {
  const queue = loadEntityQueue();
  
  // Check if already queued
  const existing = queue.find(e => e.name.toLowerCase() === entity.name.toLowerCase());
  if (existing) {
    return existing;
  }
  
  const newEntity: QueuedEntity = {
    ...entity,
    id: `entity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
  
  queue.push(newEntity);
  saveEntityQueue(queue);
  return newEntity;
}

// =============================================================================
// PENDING ENTRIES MANAGEMENT
// =============================================================================

export function loadPendingEntries(): PendingEntry[] {
  ensureDataDir();
  if (fs.existsSync(PENDING_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(PENDING_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

export function savePendingEntries(entries: PendingEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(PENDING_PATH, JSON.stringify(entries, null, 2));
}

export function addPendingEntry(entry: Omit<PendingEntry, 'id' | 'createdAt' | 'status'>): PendingEntry {
  const entries = loadPendingEntries();
  
  const newEntry: PendingEntry = {
    ...entry,
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  entries.push(newEntry);
  savePendingEntries(entries);
  return newEntry;
}

// =============================================================================
// LORE GENERATION
// =============================================================================

/**
 * Generate a lore entry for an entity using AI
 */
export async function generateEntry(entityName: string): Promise<{
  success: boolean;
  entry?: PendingEntry;
  error?: string;
}> {
  const config = getAIConfig();
  
  if (!config) {
    return {
      success: false,
      error: 'No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment.',
    };
  }
  
  // Find sources
  const sources = getBestSources(entityName);
  
  if (sources.length === 0) {
    return {
      success: false,
      error: `No sources found mentioning "${entityName}"`,
    };
  }
  
  // Generate using AI
  const generated = await generateLoreEntry(entityName, sources, config);
  
  if (!generated) {
    return {
      success: false,
      error: 'AI generation failed',
    };
  }
  
  // Add to pending entries
  const entry = addPendingEntry({
    entityName,
    generated,
    sources: sources.map(s => s.filePath),
  });
  
  return {
    success: true,
    entry,
  };
}

/**
 * Scan sources and extract entities to queue
 */
export async function scanForEntities(sourceFile?: string): Promise<{
  success: boolean;
  entities: Array<{ name: string; type: string }>;
  error?: string;
}> {
  const config = getAIConfig();
  
  if (!config) {
    return {
      success: false,
      entities: [],
      error: 'No AI API key configured',
    };
  }
  
  const entities: Array<{ name: string; type: string; brief: string }> = [];
  
  if (sourceFile) {
    // Scan single file
    const source = loadSource(sourceFile);
    if (!source) {
      return { success: false, entities: [], error: 'Source file not found' };
    }
    
    const extracted = await extractEntities(source, config);
    entities.push(...extracted);
  } else {
    // Scan key source files
    const keyFiles = [
      'official-site/shop/core-game/kingdom-death-monster-1-6.txt',
      'official-site/shop/gamblers-chest-expansion.txt',
      'official-site/shop/dragon-king-expansion-1-6.txt',
    ];
    
    for (const file of keyFiles) {
      const source = loadSource(file);
      if (source) {
        const extracted = await extractEntities(source, config);
        entities.push(...extracted);
      }
    }
  }
  
  // Add unique entities to queue
  const uniqueEntities = new Map<string, { name: string; type: string; brief: string }>();
  for (const entity of entities) {
    const key = entity.name.toLowerCase();
    if (!uniqueEntities.has(key)) {
      uniqueEntities.set(key, entity);
    }
  }
  
  for (const entity of uniqueEntities.values()) {
    addToQueue({
      name: entity.name,
      type: entity.type,
      brief: entity.brief,
      sourceFiles: [],
      priority: 5,
    });
  }
  
  return {
    success: true,
    entities: Array.from(uniqueEntities.values()),
  };
}

// =============================================================================
// APPROVAL & PUBLISHING
// =============================================================================

/**
 * Approve a pending entry and save it to the lore directory
 */
export function approveEntry(entryId: string): {
  success: boolean;
  path?: string;
  error?: string;
} {
  const entries = loadPendingEntries();
  const entry = entries.find(e => e.id === entryId);
  
  if (!entry) {
    return { success: false, error: 'Entry not found' };
  }
  
  // Determine directory
  const typeToDir: Record<string, string> = {
    monster: '04-monsters',
    character: '05-characters',
    faction: '02-factions',
    location: '03-locations',
    concept: '06-concepts',
    item: '07-technology',
    event: '06-concepts',
  };
  
  const dir = typeToDir[entry.generated.type] || '06-concepts';
  const dirPath = path.join(LORE_PATH, dir);
  
  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Generate filename
  const filename = entry.generated.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '.md';
  
  const filePath = path.join(dirPath, filename);
  
  // Build markdown content
  const markdown = buildMarkdown(entry.generated, entry.sources);
  
  // Save file
  fs.writeFileSync(filePath, markdown);
  
  // Update entry status
  entry.status = 'approved';
  savePendingEntries(entries);
  
  return {
    success: true,
    path: filePath,
  };
}

/**
 * Reject a pending entry
 */
export function rejectEntry(entryId: string, reason?: string): boolean {
  const entries = loadPendingEntries();
  const entry = entries.find(e => e.id === entryId);
  
  if (!entry) return false;
  
  entry.status = 'rejected';
  entry.reviewNotes = reason;
  savePendingEntries(entries);
  
  return true;
}

/**
 * Build markdown content for a lore entry
 */
function buildMarkdown(entry: GeneratedLoreEntry, sourceFiles: string[]): string {
  const tags = entry.tags.map(t => `\`${t}\``).join(' ');
  
  const connections = entry.connections.length > 0
    ? entry.connections.map(c => `- **${c.name}**: ${c.relationship}`).join('\n')
    : '_No known connections_';
  
  const citations = entry.citations.length > 0
    ? entry.citations.map(c => {
        let citation = `- ${c.source}`;
        if (c.quote) citation += `\n  > "${c.quote}"`;
        return citation;
      }).join('\n')
    : sourceFiles.map(f => `- ${f}`).join('\n');

  return `---
title: "${entry.title}"
type: ${entry.type}
confidence: ${entry.confidence}
tags: [${entry.tags.map(t => `"${t}"`).join(', ')}]
lastUpdated: ${new Date().toISOString().split('T')[0]}
---

# ${entry.title}

> **Type:** ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}  
> **Confidence:** ${entry.confidence}

---

${entry.content}

## Connections

${connections}

## Tags

${tags}

## Sources & Citations

${citations}

---

*This entry was generated by the Research Agent and is pending human verification.*
`;
}

// =============================================================================
// STATUS
// =============================================================================

export function getGeneratorStatus(): {
  configured: boolean;
  provider?: string;
  queuedEntities: number;
  pendingReview: number;
  approved: number;
  rejected: number;
} {
  const config = getAIConfig();
  const queue = loadEntityQueue();
  const pending = loadPendingEntries();
  
  return {
    configured: isAIConfigured(),
    provider: config?.provider,
    queuedEntities: queue.filter(e => e.status === 'queued').length,
    pendingReview: pending.filter(e => e.status === 'pending').length,
    approved: pending.filter(e => e.status === 'approved').length,
    rejected: pending.filter(e => e.status === 'rejected').length,
  };
}

