/**
 * Entity Discovery - Scans sources and extracts entities using Claude
 * Identifies monsters, characters, factions, locations, etc. from source files
 */

import fs from 'fs';
import path from 'path';
import { addToDiscoveryQueue, loadConfig, DiscoveredEntity } from './agent-core';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');
const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export interface SourceFile {
  path: string;
  relativePath: string;
  name: string;
  type: 'shop' | 'rulebook' | 'newsletter' | 'community';
  content: string;
  lastModified: Date;
}

export interface ExtractedEntity {
  name: string;
  type: 'monster' | 'character' | 'faction' | 'location' | 'concept' | 'item' | 'event';
  subType?: string;
  brief: string;
  quotes: string[];
  sourceSection?: string;
}

// =============================================================================
// SOURCE FILE LOADING
// =============================================================================

/**
 * Get all source files, prioritized by type
 */
export function getAllSourceFiles(): SourceFile[] {
  const files: SourceFile[] = [];
  
  const sourceDirectories = [
    { dir: 'official-site/shop', type: 'shop' as const },
    { dir: 'official-site/shop/core-game', type: 'shop' as const },
    { dir: 'official-site/shop/quarry-expansions', type: 'shop' as const },
    { dir: 'official-site/shop/nemesis-expansions', type: 'shop' as const },
    { dir: 'official-site/shop/gameplay-expansions', type: 'shop' as const },
    { dir: 'rulebooks/core-1.6', type: 'rulebook' as const },
    { dir: 'rulebooks/lore-extracted', type: 'rulebook' as const },
    { dir: 'official-site/news/2024', type: 'newsletter' as const },
    { dir: 'official-site/news/2025', type: 'newsletter' as const },
    { dir: 'official-site/guides', type: 'community' as const },
    { dir: 'existing-research', type: 'community' as const },
  ];
  
  for (const { dir, type } of sourceDirectories) {
    const fullPath = path.join(SOURCES_PATH, dir);
    if (fs.existsSync(fullPath)) {
      scanDirectory(fullPath, type, files);
    }
  }
  
  return files;
}

function scanDirectory(dirPath: string, type: SourceFile['type'], results: SourceFile[]): void {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // Skip image directories
      if (!item.includes('image') && !item.startsWith('.')) {
        scanDirectory(itemPath, type, results);
      }
    } else if (item.endsWith('.txt') || item.endsWith('.md')) {
      const content = fs.readFileSync(itemPath, 'utf-8');
      const relativePath = itemPath.replace(SOURCES_PATH + '/', '');
      
      results.push({
        path: itemPath,
        relativePath,
        name: item.replace(/\.(txt|md)$/, ''),
        type,
        content,
        lastModified: stat.mtime,
      });
    }
  }
}

/**
 * Get source files by priority
 */
export function getSourcesByPriority(limit?: number): SourceFile[] {
  const config = loadConfig();
  const allFiles = getAllSourceFiles();
  
  // Sort by priority
  const priorityMap: Record<string, number> = {};
  config.sources.priority.forEach((type, index) => {
    priorityMap[type] = config.sources.priority.length - index;
  });
  
  const sorted = allFiles.sort((a, b) => {
    return (priorityMap[b.type] || 0) - (priorityMap[a.type] || 0);
  });
  
  return limit ? sorted.slice(0, limit) : sorted;
}

// =============================================================================
// EXISTING ENTRIES CHECK
// =============================================================================

/**
 * Get all existing lore entry names
 */
export function getExistingEntryNames(): Set<string> {
  const names = new Set<string>();
  
  const categories = [
    '01-world', '02-factions', '03-locations', '04-monsters',
    '05-characters', '06-concepts', '07-technology', '08-theories',
    '09-philosophy', '10-art', '11-community', '12-future',
  ];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath);
    for (const file of files) {
      if (file.endsWith('.md') && !file.startsWith('_')) {
        // Extract title from filename
        const name = file.replace('.md', '').replace(/-/g, ' ');
        names.add(name.toLowerCase());
        
        // Also try to extract title from frontmatter
        const content = fs.readFileSync(path.join(categoryPath, file), 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          names.add(titleMatch[1].toLowerCase());
        }
      }
    }
  }
  
  return names;
}

// =============================================================================
// ENTITY EXTRACTION (Pattern-based fallback)
// =============================================================================

/**
 * Extract entities from source content using patterns (fallback when AI unavailable)
 */
export function extractEntitiesFromPatterns(source: SourceFile): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const content = source.content;
  
  // Pattern 1: Shop page format with ## and ### headers
  // ## NEW MONSTERS
  // ### Monster Name
  // Description...
  const sectionPattern = /##\s+(NEW MONSTERS|MONSTERS|CHARACTERS|FACTIONS|LOCATIONS|SYSTEMS|CAMPAIGNS?)\s*\n([\s\S]*?)(?=\n##\s|$)/gi;
  
  let sectionMatch;
  while ((sectionMatch = sectionPattern.exec(content)) !== null) {
    const sectionType = sectionMatch[1].toUpperCase();
    const sectionContent = sectionMatch[2];
    
    // Extract individual entities from section
    const entityPattern = /###\s+([A-Z][^#\n]+)\n([\s\S]*?)(?=\n###|\n##|$)/g;
    let entityMatch;
    
    while ((entityMatch = entityPattern.exec(sectionContent)) !== null) {
      const name = entityMatch[1].trim();
      const description = entityMatch[2].trim();
      
      // Skip generic section names
      if (['Overview', 'Key Features', 'Component List', 'Lore Notes', 'Sources'].includes(name)) {
        continue;
      }
      
      const type = determineEntityType(sectionType, name, description);
      
      entities.push({
        name,
        type,
        brief: description.slice(0, 300).replace(/\n/g, ' ').trim(),
        quotes: extractQuotes(description),
        sourceSection: sectionType,
      });
    }
  }
  
  // Pattern 2: Product page title extraction
  // # Product Name - Official Product Page
  const titleMatch = content.match(/^#\s+([^-\n]+?)(?:\s+-|$)/m);
  if (titleMatch && entities.length === 0) {
    const name = titleMatch[1].trim();
    if (!name.toLowerCase().includes('product page') && name.length > 3) {
      // This might be an expansion or product, extract what we can
      const overviewMatch = content.match(/##\s+Overview\s*\n+([\s\S]*?)(?=\n##|$)/i);
      const description = overviewMatch ? overviewMatch[1].trim() : content.slice(0, 500);
      
      // Determine if this is a monster expansion
      const isMonster = /quarry|nemesis|monster|hunt/i.test(content);
      
      entities.push({
        name: name.replace(/\s+Expansion.*$/i, ''),
        type: isMonster ? 'monster' : 'concept',
        brief: description.slice(0, 300).replace(/\n/g, ' ').trim(),
        quotes: extractQuotes(content),
      });
    }
  }
  
  return entities;
}

function determineEntityType(
  sectionType: string,
  name: string,
  description: string
): ExtractedEntity['type'] {
  const lowerName = name.toLowerCase();
  const lowerDesc = description.toLowerCase();
  
  // Direct section mapping
  if (sectionType.includes('MONSTER')) return 'monster';
  if (sectionType.includes('CHARACTER')) return 'character';
  if (sectionType.includes('FACTION')) return 'faction';
  if (sectionType.includes('LOCATION')) return 'location';
  if (sectionType.includes('CAMPAIGN')) return 'event';
  
  // Name-based detection
  const monsterKeywords = ['lion', 'gorm', 'antelope', 'phoenix', 'dragon', 'crocodile', 'singer', 'eater', 'king', 'knight', 'butcher', 'hand'];
  const characterKeywords = ['survivor', 'knight', 'speaker', 'archivist', 'witch', 'ritika', 'kale', 'scarlet'];
  const locationKeywords = ['city', 'woods', 'lands', 'plain', 'hoard', 'settlement'];
  
  if (monsterKeywords.some(k => lowerName.includes(k))) {
    return 'monster';
  }
  if (characterKeywords.some(k => lowerName.includes(k))) {
    return 'character';
  }
  if (locationKeywords.some(k => lowerName.includes(k))) {
    return 'location';
  }
  
  // Description-based detection
  if (lowerDesc.includes('monster') || lowerDesc.includes('quarry') || lowerDesc.includes('nemesis') || lowerDesc.includes('hunt')) {
    return 'monster';
  }
  if (lowerDesc.includes('survivor') || lowerDesc.includes('character')) {
    return 'character';
  }
  if (lowerDesc.includes('faction') || lowerDesc.includes('order') || lowerDesc.includes('cult')) {
    return 'faction';
  }
  if (lowerDesc.includes('location') || lowerDesc.includes('place') || lowerDesc.includes('settlement')) {
    return 'location';
  }
  
  return 'concept';
}

function extractQuotes(text: string): string[] {
  const quotes: string[] = [];
  
  // Match quoted text
  const quotePattern = /"([^"]+)"/g;
  let match;
  while ((match = quotePattern.exec(text)) !== null) {
    if (match[1].length > 20 && match[1].length < 300) {
      quotes.push(match[1]);
    }
  }
  
  // Match italicized text that looks like flavor text
  const italicPattern = /\*([^*]+)\*/g;
  while ((match = italicPattern.exec(text)) !== null) {
    if (match[1].length > 20 && match[1].length < 300) {
      quotes.push(match[1]);
    }
  }
  
  return quotes.slice(0, 3); // Limit to 3 quotes
}

// =============================================================================
// AI-POWERED ENTITY EXTRACTION
// =============================================================================

/**
 * Extract entities using Claude AI
 */
export async function extractEntitiesWithAI(
  source: SourceFile,
  apiKey: string
): Promise<ExtractedEntity[]> {
  const prompt = `Analyze this Kingdom Death: Monster source file and extract all named entities.

SOURCE FILE: ${source.name} (${source.type})
---
${source.content.slice(0, 12000)}
---

Extract entities (monsters, characters, factions, locations, concepts, items, events) that are:
1. Explicitly named and described
2. Unique to Kingdom Death lore
3. Not generic game terms

Return a JSON array:
[
  {
    "name": "Entity Name",
    "type": "monster|character|faction|location|concept|item|event",
    "subType": "quarry|nemesis|null for non-monsters",
    "brief": "1-2 sentence description from the source",
    "quotes": ["Flavor text or notable quotes if any"]
  }
]

Only include entities with clear descriptions. Be thorough but accurate.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return extractEntitiesFromPatterns(source); // Fallback
    }

    const data = await response.json();
    const text = data.content[0].text;
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const entities = JSON.parse(jsonMatch[0]) as ExtractedEntity[];
      return entities;
    }
    
    return extractEntitiesFromPatterns(source); // Fallback
  } catch (error) {
    console.error('Entity extraction error:', error);
    return extractEntitiesFromPatterns(source); // Fallback
  }
}

// =============================================================================
// DISCOVERY PIPELINE
// =============================================================================

/**
 * Run entity discovery on sources
 */
export async function runDiscovery(options?: {
  useAI?: boolean;
  apiKey?: string;
  maxSources?: number;
}): Promise<{
  sourcesScanned: number;
  entitiesFound: number;
  newEntities: number;
  entities: DiscoveredEntity[];
}> {
  const existingNames = getExistingEntryNames();
  const sources = getSourcesByPriority(options?.maxSources || 20);
  
  const allEntities: ExtractedEntity[] = [];
  const entitySources: Map<string, string[]> = new Map();
  
  for (const source of sources) {
    let entities: ExtractedEntity[];
    
    if (options?.useAI && options?.apiKey) {
      entities = await extractEntitiesWithAI(source, options.apiKey);
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      entities = extractEntitiesFromPatterns(source);
    }
    
    for (const entity of entities) {
      const key = entity.name.toLowerCase();
      
      // Track which sources mention this entity
      if (!entitySources.has(key)) {
        entitySources.set(key, []);
      }
      entitySources.get(key)!.push(source.relativePath);
      
      // Add to list if not already present
      if (!allEntities.find(e => e.name.toLowerCase() === key)) {
        allEntities.push(entity);
      }
    }
  }
  
  // Filter out existing entries and add to queue
  const newEntities: DiscoveredEntity[] = [];
  
  for (const entity of allEntities) {
    const key = entity.name.toLowerCase();
    
    // Skip if already exists in lore
    if (existingNames.has(key)) {
      continue;
    }
    
    const sourceFiles = entitySources.get(key) || [];
    
    // Calculate priority based on source count and type
    let priority = sourceFiles.length;
    if (entity.type === 'monster') priority += 3;
    if (entity.type === 'character') priority += 2;
    
    const discovered = addToDiscoveryQueue({
      name: entity.name,
      type: entity.type,
      subType: entity.subType,
      brief: entity.brief,
      sourceFiles,
      images: [], // Will be populated by image analyzer
      priority,
    });
    
    newEntities.push(discovered);
  }
  
  return {
    sourcesScanned: sources.length,
    entitiesFound: allEntities.length,
    newEntities: newEntities.length,
    entities: newEntities,
  };
}

/**
 * Get discovery statistics
 */
export function getDiscoveryStats(): {
  totalSources: number;
  byType: Record<string, number>;
  recentSources: string[];
} {
  const sources = getAllSourceFiles();
  const byType: Record<string, number> = {};
  
  for (const source of sources) {
    byType[source.type] = (byType[source.type] || 0) + 1;
  }
  
  const recentSources = sources
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
    .slice(0, 10)
    .map(s => s.relativePath);
  
  return {
    totalSources: sources.length,
    byType,
    recentSources,
  };
}

