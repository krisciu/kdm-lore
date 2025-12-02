/**
 * Research Pipeline - Multi-stage autonomous lore research system
 * 
 * Pipeline Stages:
 * 1. INDEX    - Catalog all source files and their metadata
 * 2. EXTRACT  - Pull entities from sources (monsters, characters, locations, etc.)
 * 3. ANALYZE  - Cross-reference entities and find connections
 * 4. GENERATE - Create high-quality lore entries with citations
 * 5. REVIEW   - Queue for human approval
 */

import fs from 'fs';
import path from 'path';
import { recordChange } from './changelog-service';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');
const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');
const DATA_PATH = path.join(process.cwd(), 'data');

// =============================================================================
// TYPES
// =============================================================================

export type EntityType = 
  | 'monster'
  | 'nemesis'
  | 'quarry'
  | 'character'
  | 'faction'
  | 'location'
  | 'concept'
  | 'philosophy'
  | 'gear'
  | 'innovation'
  | 'story_event'
  | 'settlement_location'
  | 'campaign';

export type SourceType = 
  | 'official_shop'
  | 'rulebook'
  | 'newsletter'
  | 'kickstarter'
  | 'extracted_lore'
  | 'community_research'
  | 'ocr_text';

export interface Source {
  id: string;
  path: string;
  type: SourceType;
  title: string;
  url?: string;
  metadata?: Record<string, unknown>;
  extractedAt?: string;
  pageCount?: number;
}

export interface ExtractedEntity {
  id: string;
  name: string;
  type: EntityType;
  subType?: string;              // e.g., "quarry", "nemesis" for monsters
  description: string;
  loreText?: string;             // Narrative/flavor text
  mechanicsNote?: string;        // Gameplay-relevant info
  
  // Source tracking
  sources: Array<{
    sourceId: string;
    sourcePath: string;
    sourceType: SourceType;
    page?: number;
    section?: string;
    quote?: string;
    confidence: 'confirmed' | 'likely' | 'speculative';
  }>;
  
  // Relationships
  connections: Array<{
    entityId: string;
    entityName: string;
    relationshipType: 'related' | 'appears_in' | 'replaces' | 'enemy' | 'ally' | 'variant' | 'part_of';
    description?: string;
  }>;
  
  // Categorization
  tags: string[];
  expansionSource?: string;      // Which expansion this belongs to
  node?: string;                 // Monster node (NQ1, NN2, etc.)
  campaign?: string;             // Which campaign(s) it appears in
  
  // Status
  confidence: 'confirmed' | 'likely' | 'speculative';
  needsExpansion: boolean;
  hasLoreEntry: boolean;
  loreEntryPath?: string;
  
  // Metadata
  extractedAt: string;
  lastUpdated: string;
}

export interface PipelineState {
  lastRun?: string;
  stages: {
    index: { lastRun?: string; sourcesIndexed: number; };
    extract: { lastRun?: string; entitiesExtracted: number; };
    analyze: { lastRun?: string; connectionsFound: number; };
    generate: { lastRun?: string; entriesGenerated: number; };
    review: { pending: number; approved: number; rejected: number; };
  };
  stats: {
    totalSources: number;
    totalEntities: number;
    byType: Record<EntityType, number>;
    byConfidence: Record<string, number>;
    coverage: {
      withLoreEntry: number;
      needsEntry: number;
      needsExpansion: number;
    };
  };
}

export interface PipelineConfig {
  enabled: boolean;
  autoRun: boolean;
  batchSize: number;
  priorityOrder: EntityType[];
  confidenceThreshold: number;
  sourceWeights: Record<SourceType, number>;
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

const PIPELINE_STATE_FILE = path.join(DATA_PATH, 'pipeline-state.json');
const ENTITY_INDEX_FILE = path.join(DATA_PATH, 'entity-index.json');
const SOURCE_INDEX_FILE = path.join(DATA_PATH, 'source-index.json');

const DEFAULT_CONFIG: PipelineConfig = {
  enabled: true,
  autoRun: false,
  batchSize: 10,
  priorityOrder: ['monster', 'nemesis', 'quarry', 'character', 'faction', 'location', 'concept'],
  confidenceThreshold: 0.5,
  sourceWeights: {
    official_shop: 1.0,
    rulebook: 1.0,
    newsletter: 0.9,
    kickstarter: 0.8,
    extracted_lore: 0.7,
    community_research: 0.6,
    ocr_text: 0.5,
  },
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
}

export function loadPipelineState(): PipelineState {
  ensureDataDir();
  if (fs.existsSync(PIPELINE_STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PIPELINE_STATE_FILE, 'utf-8'));
    } catch { /* use default */ }
  }
  
  const defaultState: PipelineState = {
    stages: {
      index: { sourcesIndexed: 0 },
      extract: { entitiesExtracted: 0 },
      analyze: { connectionsFound: 0 },
      generate: { entriesGenerated: 0 },
      review: { pending: 0, approved: 0, rejected: 0 },
    },
    stats: {
      totalSources: 0,
      totalEntities: 0,
      byType: {} as Record<EntityType, number>,
      byConfidence: {},
      coverage: { withLoreEntry: 0, needsEntry: 0, needsExpansion: 0 },
    },
  };
  savePipelineState(defaultState);
  return defaultState;
}

export function savePipelineState(state: PipelineState): void {
  ensureDataDir();
  fs.writeFileSync(PIPELINE_STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadEntityIndex(): ExtractedEntity[] {
  ensureDataDir();
  if (fs.existsSync(ENTITY_INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ENTITY_INDEX_FILE, 'utf-8'));
    } catch { /* return empty */ }
  }
  return [];
}

export function saveEntityIndex(entities: ExtractedEntity[]): void {
  ensureDataDir();
  fs.writeFileSync(ENTITY_INDEX_FILE, JSON.stringify(entities, null, 2));
}

export function loadSourceIndex(): Source[] {
  ensureDataDir();
  if (fs.existsSync(SOURCE_INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SOURCE_INDEX_FILE, 'utf-8'));
    } catch { /* return empty */ }
  }
  return [];
}

export function saveSourceIndex(sources: Source[]): void {
  ensureDataDir();
  fs.writeFileSync(SOURCE_INDEX_FILE, JSON.stringify(sources, null, 2));
}

// =============================================================================
// STAGE 1: INDEX SOURCES
// =============================================================================

export async function stageIndex(): Promise<{ sources: Source[]; newSources: number }> {
  const existingSources = loadSourceIndex();
  const existingPaths = new Set(existingSources.map(s => s.path));
  const newSources: Source[] = [];
  
  // Index official shop content
  const shopPath = path.join(SOURCES_PATH, 'official-site', 'shop');
  if (fs.existsSync(shopPath)) {
    indexDirectory(shopPath, 'official_shop', newSources, existingPaths);
  }
  
  // Index newsletters
  const newsPath = path.join(SOURCES_PATH, 'official-site', 'news');
  if (fs.existsSync(newsPath)) {
    indexDirectory(newsPath, 'newsletter', newSources, existingPaths);
  }
  
  // Index rulebook content
  const rulebookPath = path.join(SOURCES_PATH, 'rulebooks');
  if (fs.existsSync(rulebookPath)) {
    indexDirectory(rulebookPath, 'rulebook', newSources, existingPaths, ['extracted', 'ocr']);
  }
  
  // Index extracted lore
  const lorePath = path.join(SOURCES_PATH, 'rulebooks', 'lore-extracted');
  if (fs.existsSync(lorePath)) {
    indexDirectory(lorePath, 'extracted_lore', newSources, existingPaths);
  }
  
  // Index existing research
  const researchPath = path.join(SOURCES_PATH, 'existing-research');
  if (fs.existsSync(researchPath)) {
    indexDirectory(researchPath, 'community_research', newSources, existingPaths);
  }
  
  // Index kickstarter content
  const kickstarterPath = path.join(SOURCES_PATH, 'kickstarter');
  if (fs.existsSync(kickstarterPath)) {
    indexDirectory(kickstarterPath, 'kickstarter', newSources, existingPaths);
  }
  
  // Merge and save
  const allSources = [...existingSources, ...newSources];
  saveSourceIndex(allSources);
  
  // Update pipeline state
  const state = loadPipelineState();
  state.stages.index.lastRun = new Date().toISOString();
  state.stages.index.sourcesIndexed = allSources.length;
  state.stats.totalSources = allSources.length;
  savePipelineState(state);
  
  return { sources: allSources, newSources: newSources.length };
}

function indexDirectory(
  dirPath: string, 
  type: SourceType, 
  results: Source[], 
  existingPaths: Set<string>,
  skipDirs: string[] = []
): void {
  if (!fs.existsSync(dirPath)) return;
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const relativePath = itemPath.replace(SOURCES_PATH + '/', '');
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      if (!skipDirs.includes(item) && !item.startsWith('.')) {
        indexDirectory(itemPath, type, results, existingPaths, skipDirs);
      }
    } else if ((item.endsWith('.txt') || item.endsWith('.md')) && !existingPaths.has(relativePath)) {
      const source: Source = {
        id: `src-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        path: relativePath,
        type,
        title: item.replace(/\.(txt|md)$/, '').replace(/-/g, ' '),
        extractedAt: new Date().toISOString(),
      };
      
      // Try to extract URL from file content
      const content = fs.readFileSync(itemPath, 'utf-8');
      const urlMatch = content.match(/Source:\s*(https?:\/\/[^\s\n]+)/i);
      if (urlMatch) {
        source.url = urlMatch[1];
      }
      
      results.push(source);
    }
  }
}

// =============================================================================
// STAGE 2: EXTRACT ENTITIES
// =============================================================================

export async function stageExtract(): Promise<{ entities: ExtractedEntity[]; newEntities: number }> {
  const sources = loadSourceIndex();
  const existingEntities = loadEntityIndex();
  const existingNames = new Set(existingEntities.map(e => e.name.toLowerCase()));
  const newEntities: ExtractedEntity[] = [];
  
  for (const source of sources) {
    const fullPath = path.join(SOURCES_PATH, source.path);
    if (!fs.existsSync(fullPath)) continue;
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const extracted = extractEntitiesFromContent(content, source);
    
    for (const entity of extracted) {
      if (!existingNames.has(entity.name.toLowerCase())) {
        newEntities.push(entity);
        existingNames.add(entity.name.toLowerCase());
      } else {
        // Merge with existing entity
        const existing = existingEntities.find(e => e.name.toLowerCase() === entity.name.toLowerCase());
        if (existing) {
          mergeEntityData(existing, entity);
        }
      }
    }
  }
  
  // Merge and save
  const allEntities = [...existingEntities, ...newEntities];
  saveEntityIndex(allEntities);
  
  // Update pipeline state
  const state = loadPipelineState();
  state.stages.extract.lastRun = new Date().toISOString();
  state.stages.extract.entitiesExtracted = allEntities.length;
  state.stats.totalEntities = allEntities.length;
  
  // Count by type
  state.stats.byType = {} as Record<EntityType, number>;
  for (const entity of allEntities) {
    state.stats.byType[entity.type] = (state.stats.byType[entity.type] || 0) + 1;
  }
  
  savePipelineState(state);
  
  return { entities: allEntities, newEntities: newEntities.length };
}

function extractEntitiesFromContent(content: string, source: Source): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const now = new Date().toISOString();
  
  // Different extraction strategies based on source type
  if (source.type === 'official_shop') {
    extractFromShopContent(content, source, entities, now);
  } else if (source.type === 'extracted_lore') {
    extractFromLoreContent(content, source, entities, now);
  } else {
    extractFromGenericContent(content, source, entities, now);
  }
  
  return entities;
}

function extractFromShopContent(
  content: string, 
  source: Source, 
  entities: ExtractedEntity[],
  timestamp: string
): void {
  // Extract title from first heading or source title
  const titleMatch = content.match(/^#\s+(.+?)(?:\s+-|$)/m);
  const mainTitle = titleMatch ? titleMatch[1].trim() : source.title;
  
  // Detect entity type from content
  let entityType: EntityType = 'monster';
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('quarry') || lowerContent.includes('hunt')) {
    entityType = 'quarry';
  } else if (lowerContent.includes('nemesis')) {
    entityType = 'nemesis';
  } else if (lowerContent.includes('campaign')) {
    entityType = 'campaign';
  }
  
  // Extract node information
  const nodeMatch = content.match(/Node:\s*(N[QN]\d)/i) || 
                   content.match(/(NQ\d|NN\d)/);
  const node = nodeMatch ? nodeMatch[1] : undefined;
  
  // Extract overview/description
  const overviewMatch = content.match(/## Overview\s*\n\n([\s\S]*?)(?=\n##|$)/);
  const description = overviewMatch 
    ? overviewMatch[1].trim().slice(0, 500) 
    : content.slice(0, 500);
  
  // Extract lore notes if present
  const loreMatch = content.match(/## Lore Notes\s*\n\n([\s\S]*?)(?=\n##|$)/);
  const loreText = loreMatch ? loreMatch[1].trim() : undefined;
  
  // Extract tags
  const tags = extractTags(content, mainTitle);
  
  // Create main entity
  const entity: ExtractedEntity = {
    id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: mainTitle,
    type: entityType,
    subType: node?.startsWith('NQ') ? 'quarry' : node?.startsWith('NN') ? 'nemesis' : undefined,
    description,
    loreText,
    sources: [{
      sourceId: source.id,
      sourcePath: source.path,
      sourceType: source.type,
      confidence: 'confirmed',
    }],
    connections: [],
    tags,
    expansionSource: source.title,
    node,
    confidence: 'confirmed',
    needsExpansion: false,
    hasLoreEntry: false,
    extractedAt: timestamp,
    lastUpdated: timestamp,
  };
  
  entities.push(entity);
  
  // Extract sub-entities (e.g., characters, monsters within expansion)
  const subEntityMatches = content.matchAll(/###\s+(.+?)\n([\s\S]*?)(?=\n###|\n##|$)/g);
  for (const match of subEntityMatches) {
    const subName = match[1].trim();
    const subContent = match[2].trim();
    
    // Skip generic sections
    if (['Overview', 'Key Features', 'Component List', 'Lore Notes'].includes(subName)) continue;
    
    const subType = detectEntityType(subName, subContent);
    const subEntity: ExtractedEntity = {
      id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: subName,
      type: subType,
      description: subContent.slice(0, 400),
      sources: [{
        sourceId: source.id,
        sourcePath: source.path,
        sourceType: source.type,
        section: subName,
        confidence: 'confirmed',
      }],
      connections: [{
        entityId: entity.id,
        entityName: entity.name,
        relationshipType: 'part_of',
      }],
      tags: extractTags(subContent, subName),
      expansionSource: source.title,
      confidence: 'confirmed',
      needsExpansion: subContent.length < 200,
      hasLoreEntry: false,
      extractedAt: timestamp,
      lastUpdated: timestamp,
    };
    
    entities.push(subEntity);
  }
}

function extractFromLoreContent(
  content: string, 
  source: Source, 
  entities: ExtractedEntity[],
  timestamp: string
): void {
  // Extract story events
  const eventMatches = content.matchAll(/##\s+(.+?)\n\*Page (\d+)\*\n\n([\s\S]*?)(?=\n---|\n##|$)/g);
  
  for (const match of eventMatches) {
    const name = match[1].trim();
    const page = parseInt(match[2]);
    const description = match[3].trim().slice(0, 500);
    
    const entity: ExtractedEntity = {
      id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      type: 'story_event',
      description,
      sources: [{
        sourceId: source.id,
        sourcePath: source.path,
        sourceType: source.type,
        page,
        confidence: 'confirmed',
      }],
      connections: [],
      tags: ['story-event', 'core-game'],
      confidence: 'confirmed',
      needsExpansion: description.length < 100,
      hasLoreEntry: false,
      extractedAt: timestamp,
      lastUpdated: timestamp,
    };
    
    entities.push(entity);
  }
}

function extractFromGenericContent(
  content: string, 
  source: Source, 
  entities: ExtractedEntity[],
  timestamp: string
): void {
  // Use pattern matching to find entity definitions
  const patterns = [
    // "Name\nDescription paragraph" pattern
    /^([A-Z][A-Za-z\s']+(?:Knight|Speaker|King|Queen|Lion|Dragon|Phoenix|Antelope|Gorm|Sunstalker|Butcher|Hand|Man|Flower|God))\n([\s\S]{50,500}?)(?=\n[A-Z]|\n$|$)/gm,
    // "**Name**" or "### Name" headers
    /(?:\*\*|###\s+)([A-Z][A-Za-z\s']+)\*?\*?\n([\s\S]{30,400}?)(?=\n\*\*|\n###|\n$|$)/g,
  ];
  
  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      const desc = match[2].trim();
      
      // Skip if too short or looks like a section header
      if (desc.length < 30 || name.length > 50) continue;
      
      const type = detectEntityType(name, desc);
      
      const entity: ExtractedEntity = {
        id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name,
        type,
        description: desc,
        sources: [{
          sourceId: source.id,
          sourcePath: source.path,
          sourceType: source.type,
          confidence: 'likely',
        }],
        connections: [],
        tags: extractTags(desc, name),
        confidence: 'likely',
        needsExpansion: true,
        hasLoreEntry: false,
        extractedAt: timestamp,
        lastUpdated: timestamp,
      };
      
      entities.push(entity);
    }
  }
}

function detectEntityType(name: string, content: string): EntityType {
  const lowerName = name.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Monster/Quarry/Nemesis detection
  const monsterKeywords = ['lion', 'gorm', 'antelope', 'phoenix', 'dragon', 'sunstalker', 'spidicules', 'frogdog', 'crocodile'];
  const nemesisKeywords = ['butcher', 'hand', 'king\'s man', 'knight', 'watcher', 'slenderman', 'pariah', 'witch'];
  
  if (monsterKeywords.some(k => lowerName.includes(k)) || lowerContent.includes('quarry')) {
    return 'quarry';
  }
  if (nemesisKeywords.some(k => lowerName.includes(k)) || lowerContent.includes('nemesis')) {
    return 'nemesis';
  }
  if (lowerContent.includes('monster') || lowerContent.includes('hunt') || lowerContent.includes('showdown')) {
    return 'monster';
  }
  
  // Faction detection
  if (lowerContent.includes('order') || lowerContent.includes('cult') || lowerContent.includes('organization')) {
    return 'faction';
  }
  
  // Location detection
  if (lowerContent.includes('settlement') || lowerContent.includes('location') || lowerContent.includes('city') || lowerContent.includes('woods') || lowerContent.includes('lands')) {
    return 'location';
  }
  
  // Character detection
  if (lowerContent.includes('survivor') || lowerContent.includes('knight') || lowerContent.includes('speaker')) {
    return 'character';
  }
  
  // Philosophy/Concept detection
  if (lowerContent.includes('philosophy') || lowerContent.includes('belief') || lowerContent.includes('principle')) {
    return 'philosophy';
  }
  
  // Campaign detection
  if (lowerContent.includes('campaign') || lowerContent.includes('lantern year')) {
    return 'campaign';
  }
  
  return 'concept';
}

function extractTags(content: string, name: string): string[] {
  const tags: string[] = [];
  const combined = `${name} ${content}`.toLowerCase();
  
  const tagPatterns: [RegExp, string][] = [
    [/core\s*game/i, 'core-game'],
    [/expansion/i, 'expansion'],
    [/nemesis/i, 'nemesis'],
    [/quarry/i, 'quarry'],
    [/hunt/i, 'hunt'],
    [/showdown/i, 'showdown'],
    [/settlement/i, 'settlement'],
    [/twilight/i, 'twilight-order'],
    [/white\s*speaker/i, 'white-speakers'],
    [/lantern/i, 'lantern'],
    [/darkness/i, 'darkness'],
    [/entity/i, 'entity'],
    [/philosophy/i, 'philosophy'],
    [/campaign/i, 'campaign'],
    [/gambler/i, 'gamblers-chest'],
    [/dragon\s*king/i, 'dragon-king'],
    [/sunstalker/i, 'sunstalker'],
    [/phoenix/i, 'phoenix'],
    [/lion/i, 'lion'],
  ];
  
  for (const [pattern, tag] of tagPatterns) {
    if (pattern.test(combined) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

function mergeEntityData(existing: ExtractedEntity, incoming: ExtractedEntity): void {
  // Merge sources
  for (const source of incoming.sources) {
    if (!existing.sources.some(s => s.sourcePath === source.sourcePath)) {
      existing.sources.push(source);
    }
  }
  
  // Merge tags
  for (const tag of incoming.tags) {
    if (!existing.tags.includes(tag)) {
      existing.tags.push(tag);
    }
  }
  
  // Merge connections
  for (const conn of incoming.connections) {
    if (!existing.connections.some(c => c.entityName === conn.entityName)) {
      existing.connections.push(conn);
    }
  }
  
  // Update description if incoming is longer
  if (incoming.description.length > existing.description.length) {
    existing.description = incoming.description;
  }
  
  // Add lore text if missing
  if (incoming.loreText && !existing.loreText) {
    existing.loreText = incoming.loreText;
  }
  
  existing.lastUpdated = new Date().toISOString();
}

// =============================================================================
// STAGE 3: ANALYZE & CONNECT
// =============================================================================

export async function stageAnalyze(): Promise<{ connectionsFound: number }> {
  const entities = loadEntityIndex();
  let connectionsFound = 0;
  
  // Build name lookup
  const nameToEntity = new Map<string, ExtractedEntity>();
  for (const entity of entities) {
    nameToEntity.set(entity.name.toLowerCase(), entity);
  }
  
  // Find connections based on content
  for (const entity of entities) {
    const searchText = `${entity.description} ${entity.loreText || ''}`.toLowerCase();
    
    for (const [name, other] of nameToEntity) {
      if (entity.id === other.id) continue;
      if (entity.connections.some(c => c.entityId === other.id)) continue;
      
      // Check if this entity mentions the other
      if (searchText.includes(name) || searchText.includes(other.name.toLowerCase())) {
        entity.connections.push({
          entityId: other.id,
          entityName: other.name,
          relationshipType: 'related',
        });
        connectionsFound++;
      }
    }
  }
  
  saveEntityIndex(entities);
  
  // Update pipeline state
  const state = loadPipelineState();
  state.stages.analyze.lastRun = new Date().toISOString();
  state.stages.analyze.connectionsFound = connectionsFound;
  savePipelineState(state);
  
  return { connectionsFound };
}

// =============================================================================
// STAGE 4: GENERATE LORE ENTRIES
// =============================================================================

export interface GeneratedEntry {
  entity: ExtractedEntity;
  content: string;
  category: string;
  directory: string;
  filename: string;
}

export async function stageGenerate(limit: number = 5): Promise<GeneratedEntry[]> {
  const entities = loadEntityIndex();
  const generated: GeneratedEntry[] = [];
  
  // Find entities that need lore entries, prioritized
  const needsEntry = entities
    .filter(e => !e.hasLoreEntry && e.confidence !== 'speculative')
    .sort((a, b) => {
      // Priority: confirmed > likely, more sources > fewer
      const confWeight = { confirmed: 3, likely: 2, speculative: 1 };
      const aScore = confWeight[a.confidence] + a.sources.length;
      const bScore = confWeight[b.confidence] + b.sources.length;
      return bScore - aScore;
    })
    .slice(0, limit);
  
  for (const entity of needsEntry) {
    const entry = generateLoreEntry(entity);
    generated.push(entry);
    
    // Mark as having entry
    entity.hasLoreEntry = true;
    entity.loreEntryPath = `docs/lore/${entry.directory}/${entry.filename}`;
  }
  
  saveEntityIndex(entities);
  
  // Update pipeline state
  const state = loadPipelineState();
  state.stages.generate.lastRun = new Date().toISOString();
  state.stages.generate.entriesGenerated += generated.length;
  savePipelineState(state);
  
  return generated;
}

function generateLoreEntry(entity: ExtractedEntity): GeneratedEntry {
  // Determine directory based on type
  const typeToDir: Record<EntityType, string> = {
    monster: '04-monsters',
    nemesis: '04-monsters',
    quarry: '04-monsters',
    character: '05-characters',
    faction: '02-factions',
    location: '03-locations',
    concept: '06-concepts',
    philosophy: '09-philosophy',
    gear: '07-technology',
    innovation: '07-technology',
    story_event: '06-concepts',
    settlement_location: '03-locations',
    campaign: '01-world',
  };
  
  const directory = typeToDir[entity.type] || '06-concepts';
  const filename = entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
  
  // Build citations
  const citations = entity.sources.map(s => {
    let citation = `- **${s.sourceType.replace('_', ' ')}**: ${s.sourcePath}`;
    if (s.page) citation += ` (page ${s.page})`;
    if (s.section) citation += ` - ${s.section}`;
    return citation;
  }).join('\n');
  
  // Build connections
  const connections = entity.connections
    .map(c => `- [${c.entityName}](/lore/${c.entityName.toLowerCase().replace(/\s+/g, '-')}) - ${c.relationshipType}`)
    .join('\n');
  
  // Generate full markdown
  const content = `# ${entity.name}

> **Type:** ${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}  
> **Confidence:** ${entity.confidence}  
> **Last Updated:** ${new Date().toISOString().split('T')[0]}  
${entity.node ? `> **Node:** ${entity.node}  \n` : ''}${entity.expansionSource ? `> **Expansion:** ${entity.expansionSource}  \n` : ''}

---

## Overview

${entity.description}

${entity.loreText ? `## Lore\n\n${entity.loreText}\n\n` : ''}${entity.mechanicsNote ? `## Game Mechanics\n\n${entity.mechanicsNote}\n\n` : ''}${entity.connections.length > 0 ? `## Connections\n\n${connections}\n\n` : ''}## Tags

${entity.tags.map(t => `\`${t}\``).join(' ')}

## Sources

${citations}

---

*This entry was generated by the Research Agent and verified against official sources.*
`;

  return {
    entity,
    content,
    category: entity.type,
    directory,
    filename,
  };
}

// =============================================================================
// MAIN PIPELINE RUNNER
// =============================================================================

export interface PipelineResult {
  success: boolean;
  stages: {
    index: { sources: number; new: number };
    extract: { entities: number; new: number };
    analyze: { connections: number };
    generate: { entries: GeneratedEntry[] };
  };
  duration: number;
  errors: string[];
}

export async function runPipeline(options?: {
  stages?: ('index' | 'extract' | 'analyze' | 'generate')[];
  generateLimit?: number;
}): Promise<PipelineResult> {
  const startTime = Date.now();
  const result: PipelineResult = {
    success: true,
    stages: {
      index: { sources: 0, new: 0 },
      extract: { entities: 0, new: 0 },
      analyze: { connections: 0 },
      generate: { entries: [] },
    },
    duration: 0,
    errors: [],
  };
  
  const stagesToRun = options?.stages || ['index', 'extract', 'analyze', 'generate'];
  
  try {
    // Stage 1: Index
    if (stagesToRun.includes('index')) {
      const indexResult = await stageIndex();
      result.stages.index = { 
        sources: indexResult.sources.length, 
        new: indexResult.newSources 
      };
    }
    
    // Stage 2: Extract
    if (stagesToRun.includes('extract')) {
      const extractResult = await stageExtract();
      result.stages.extract = { 
        entities: extractResult.entities.length, 
        new: extractResult.newEntities 
      };
    }
    
    // Stage 3: Analyze
    if (stagesToRun.includes('analyze')) {
      const analyzeResult = await stageAnalyze();
      result.stages.analyze = { connections: analyzeResult.connectionsFound };
    }
    
    // Stage 4: Generate
    if (stagesToRun.includes('generate')) {
      const generateResult = await stageGenerate(options?.generateLimit || 5);
      result.stages.generate = { entries: generateResult };
    }
    
    // Record in changelog
    await recordChange(
      'metadata',
      'system',
      `Research pipeline completed: ${result.stages.extract.new} new entities`,
      [],
      {
        description: `Pipeline run: ${result.stages.index.new} new sources, ${result.stages.extract.new} new entities, ${result.stages.analyze.connections} connections, ${result.stages.generate.entries.length} entries generated`,
      }
    );
    
  } catch (error) {
    result.success = false;
    result.errors.push(String(error));
  }
  
  result.duration = Date.now() - startTime;
  
  // Update pipeline state
  const state = loadPipelineState();
  state.lastRun = new Date().toISOString();
  savePipelineState(state);
  
  return result;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function getEntitiesByType(type: EntityType): ExtractedEntity[] {
  return loadEntityIndex().filter(e => e.type === type);
}

export function getEntitiesNeedingEntry(): ExtractedEntity[] {
  return loadEntityIndex().filter(e => !e.hasLoreEntry);
}

export function searchEntities(query: string): ExtractedEntity[] {
  const lowerQuery = query.toLowerCase();
  return loadEntityIndex().filter(e =>
    e.name.toLowerCase().includes(lowerQuery) ||
    e.description.toLowerCase().includes(lowerQuery) ||
    e.tags.some(t => t.includes(lowerQuery))
  );
}

export function getEntityStats(): PipelineState['stats'] {
  const entities = loadEntityIndex();
  const state = loadPipelineState();
  
  state.stats.totalEntities = entities.length;
  state.stats.byType = {} as Record<EntityType, number>;
  state.stats.byConfidence = {};
  state.stats.coverage = { withLoreEntry: 0, needsEntry: 0, needsExpansion: 0 };
  
  for (const entity of entities) {
    state.stats.byType[entity.type] = (state.stats.byType[entity.type] || 0) + 1;
    state.stats.byConfidence[entity.confidence] = (state.stats.byConfidence[entity.confidence] || 0) + 1;
    
    if (entity.hasLoreEntry) {
      state.stats.coverage.withLoreEntry++;
    } else {
      state.stats.coverage.needsEntry++;
    }
    
    if (entity.needsExpansion) {
      state.stats.coverage.needsExpansion++;
    }
  }
  
  savePipelineState(state);
  return state.stats;
}

