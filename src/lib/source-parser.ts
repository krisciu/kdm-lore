/**
 * Source Parser - Extracts structured lore from raw source files
 * Parses the docs/lore/sources/ directory to feed the research agent
 */

import fs from 'fs';
import path from 'path';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

export interface ParsedEntity {
  name: string;
  type: 'monster' | 'character' | 'faction' | 'location' | 'concept' | 'item';
  description: string;
  quotes: string[];
  connections: string[];
  sourceFile: string;
  confidence: 'confirmed' | 'likely' | 'speculative';
  tags: string[];
}

export interface SourceFile {
  path: string;
  name: string;
  category: string;
  content: string;
  lastModified: Date;
  entities: ParsedEntity[];
}

/**
 * Get all source files from the sources directory
 */
export function getAllSourceFiles(): SourceFile[] {
  const files: SourceFile[] = [];

  if (!fs.existsSync(SOURCES_PATH)) {
    return files;
  }

  const processDirectory = (dirPath: string, category: string = 'general') => {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Recurse into subdirectories
        processDirectory(itemPath, item);
      } else if (item.endsWith('.txt') || item.endsWith('.md')) {
        const content = fs.readFileSync(itemPath, 'utf-8');
        files.push({
          path: itemPath,
          name: item.replace(/\.(txt|md)$/, ''),
          category,
          content,
          lastModified: stats.mtime,
          entities: parseEntities(content, item),
        });
      }
    }
  };

  processDirectory(SOURCES_PATH);
  return files;
}

/**
 * Parse entities from source content
 */
function parseEntities(content: string, fileName: string): ParsedEntity[] {
  const entities: ParsedEntity[] = [];
  const lines = content.split('\n');
  
  let currentEntity: Partial<ParsedEntity> | null = null;
  let currentDescription: string[] = [];

  // Patterns to identify entity headers
  const entityPatterns = [
    /^([A-Z][A-Za-z\s]+(?:Knight|Speaker|Lady|King|Archivist|Witch|Forsaker|Butcher|Gorm|Ram|Man|Weaver|Dog))$/,
    /^The ([A-Z][A-Za-z\s]+)$/,
    /^([A-Z][A-Za-z\s]+) \((?:Female|Male|ltd)\)$/,
  ];

  const determineType = (name: string, description: string): ParsedEntity['type'] => {
    const lowerName = name.toLowerCase();
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('monster') || lowerDesc.includes('creature') || 
        lowerName.includes('gorm') || lowerName.includes('ram') ||
        lowerName.includes('weaver') || lowerName.includes('butcher')) {
      return 'monster';
    }
    if (lowerDesc.includes('order') || lowerDesc.includes('cult') || 
        lowerDesc.includes('knights')) {
      return 'faction';
    }
    if (lowerDesc.includes('settlement') || lowerDesc.includes('city') ||
        lowerDesc.includes('place') || lowerDesc.includes('location')) {
      return 'location';
    }
    if (lowerName.includes('knight') || lowerName.includes('speaker') ||
        lowerName.includes('archivist') || lowerDesc.includes('survivor')) {
      return 'character';
    }
    return 'concept';
  };

  const extractConnections = (text: string): string[] => {
    const connections: string[] = [];
    const knownEntities = [
      'White Lion', 'Butcher', 'King', 'Phoenix', 'Dragon King',
      'Twilight Knight', 'White Speaker', 'Archivist', 'Gorm',
      'Entity', 'Lantern', 'Darkness', 'Settlement', 'Survivor',
      'Forsaker', 'Satan', 'Slender Man', 'Nightmare Ram',
    ];

    for (const entity of knownEntities) {
      if (text.includes(entity) && !connections.includes(entity)) {
        connections.push(entity);
      }
    }

    return connections;
  };

  const extractTags = (name: string, description: string): string[] => {
    const tags: string[] = [];
    const combined = `${name} ${description}`.toLowerCase();

    const tagPatterns: [RegExp, string][] = [
      [/twilight/i, 'twilight-order'],
      [/white speaker/i, 'white-speakers'],
      [/blood/i, 'blood-magic'],
      [/lantern/i, 'lantern'],
      [/darkness/i, 'darkness'],
      [/entity/i, 'entity'],
      [/settlement/i, 'settlement'],
      [/knight/i, 'knight'],
      [/expansion/i, 'expansion'],
      [/core game/i, 'core-game'],
      [/nemesis/i, 'nemesis'],
      [/quarry/i, 'quarry'],
      [/survivor/i, 'survivor'],
      [/armor/i, 'armor'],
      [/sword|weapon/i, 'weapon'],
      [/relic/i, 'relic'],
    ];

    for (const [pattern, tag] of tagPatterns) {
      if (pattern.test(combined) && !tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip URL lines and navigation
    if (line.startsWith('(http') || line.includes('vibrantlantern.com') || 
        line.startsWith('Vibrant Lantern') || line.match(/^\d+ of \d+/)) {
      continue;
    }

    // Check for entity headers
    for (const pattern of entityPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Save previous entity
        if (currentEntity && currentEntity.name && currentDescription.length > 0) {
          const desc = currentDescription.join(' ').trim();
          entities.push({
            name: currentEntity.name,
            type: determineType(currentEntity.name, desc),
            description: desc,
            quotes: extractQuotes(desc),
            connections: extractConnections(desc),
            sourceFile: fileName,
            confidence: 'confirmed',
            tags: extractTags(currentEntity.name, desc),
          });
        }

        // Start new entity
        currentEntity = { name: match[1] || match[0] };
        currentDescription = [];
        break;
      }
    }

    // Collect description lines
    if (currentEntity && line && !line.match(/^[A-Z][A-Za-z\s]+(Knight|Speaker|Lady)$/) &&
        !line.startsWith('(http') && line.length > 20) {
      currentDescription.push(line);
    }
  }

  // Don't forget the last entity
  if (currentEntity && currentEntity.name && currentDescription.length > 0) {
    const desc = currentDescription.join(' ').trim();
    entities.push({
      name: currentEntity.name,
      type: determineType(currentEntity.name, desc),
      description: desc,
      quotes: extractQuotes(desc),
      connections: extractConnections(desc),
      sourceFile: fileName,
      confidence: 'confirmed',
      tags: extractTags(currentEntity.name, desc),
    });
  }

  return entities;
}

/**
 * Extract quoted text from descriptions
 */
function extractQuotes(text: string): string[] {
  const quotes: string[] = [];
  const quotePattern = /"([^"]+)"/g;
  let match;
  
  while ((match = quotePattern.exec(text)) !== null) {
    quotes.push(match[1]);
  }

  return quotes;
}

/**
 * Get all unique entities across all source files
 */
export function getAllParsedEntities(): ParsedEntity[] {
  const files = getAllSourceFiles();
  const entitiesMap = new Map<string, ParsedEntity>();

  for (const file of files) {
    for (const entity of file.entities) {
      const key = entity.name.toLowerCase();
      
      // Merge if entity already exists
      if (entitiesMap.has(key)) {
        const existing = entitiesMap.get(key)!;
        existing.description = existing.description.length > entity.description.length 
          ? existing.description 
          : entity.description;
        existing.connections = [...new Set([...existing.connections, ...entity.connections])];
        existing.tags = [...new Set([...existing.tags, ...entity.tags])];
        existing.quotes = [...new Set([...existing.quotes, ...entity.quotes])];
      } else {
        entitiesMap.set(key, { ...entity });
      }
    }
  }

  return Array.from(entitiesMap.values());
}

/**
 * Find entities that don't have lore entries yet
 */
export function findMissingEntries(existingEntries: string[]): ParsedEntity[] {
  const entities = getAllParsedEntities();
  const existingLower = existingEntries.map(e => e.toLowerCase());
  
  return entities.filter(entity => {
    const nameLower = entity.name.toLowerCase();
    return !existingLower.some(existing => 
      existing.includes(nameLower) || nameLower.includes(existing)
    );
  });
}

/**
 * Get source statistics
 */
export function getSourceStats(): {
  totalFiles: number;
  totalEntities: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  lastUpdated?: Date;
} {
  const files = getAllSourceFiles();
  const entities = getAllParsedEntities();
  
  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let lastUpdated: Date | undefined;

  for (const entity of entities) {
    byType[entity.type] = (byType[entity.type] || 0) + 1;
  }

  for (const file of files) {
    byCategory[file.category] = (byCategory[file.category] || 0) + file.entities.length;
    if (!lastUpdated || file.lastModified > lastUpdated) {
      lastUpdated = file.lastModified;
    }
  }

  return {
    totalFiles: files.length,
    totalEntities: entities.length,
    byType,
    byCategory,
    lastUpdated,
  };
}

/**
 * Search entities by query
 */
export function searchEntities(query: string): ParsedEntity[] {
  const entities = getAllParsedEntities();
  const lowerQuery = query.toLowerCase();

  return entities.filter(entity =>
    entity.name.toLowerCase().includes(lowerQuery) ||
    entity.description.toLowerCase().includes(lowerQuery) ||
    entity.tags.some(t => t.includes(lowerQuery))
  );
}

