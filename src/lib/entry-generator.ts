/**
 * Entry Generator - AI-powered lore entry creation
 * Generates high-quality lore entries matching the existing format
 */

import fs from 'fs';
import path from 'path';
import { 
  DiscoveredEntity, 
  addPendingEntry, 
  updateEntityStatus,
  loadConfig,
  PendingEntry,
} from './agent-core';
import { SourceFile, getAllSourceFiles } from './entity-discovery';
import { matchImagesForEntity, MatchedImage } from './image-analyzer';
import { addCitation, getNextCitationRange } from './citation-manager';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedContent {
  title: string;
  frontmatter: Record<string, unknown>;
  content: string;
  citations: string[];
  connections: Array<{ name: string; relationship: string }>;
}

export interface SourceContext {
  file: SourceFile;
  relevantSection: string;
  quotes: string[];
}

// =============================================================================
// SOURCE GATHERING
// =============================================================================

/**
 * Find all sources that mention an entity
 */
export async function gatherSourcesForEntity(entityName: string): Promise<SourceContext[]> {
  const allSources = getAllSourceFiles();
  const contexts: SourceContext[] = [];
  const searchTerms = [
    entityName.toLowerCase(),
    entityName.toLowerCase().replace(/\s+/g, '-'),
    entityName.toLowerCase().replace(/\s+/g, ''),
  ];
  
  for (const source of allSources) {
    const lowerContent = source.content.toLowerCase();
    
    // Check if source mentions entity
    const mentioned = searchTerms.some(term => lowerContent.includes(term));
    if (!mentioned) continue;
    
    // Extract relevant section
    const relevantSection = extractRelevantSection(source.content, entityName);
    if (relevantSection.length < 50) continue;
    
    // Extract quotes
    const quotes = extractQuotesAboutEntity(source.content, entityName);
    
    contexts.push({
      file: source,
      relevantSection,
      quotes,
    });
  }
  
  // Sort by source type priority
  const config = await loadConfig();
  const priorityMap: Record<string, number> = {};
  config.sources.priority.forEach((type, i) => {
    priorityMap[type] = config.sources.priority.length - i;
  });
  
  return contexts.sort((a, b) => 
    (priorityMap[b.file.type] || 0) - (priorityMap[a.file.type] || 0)
  );
}

/**
 * Extract the most relevant section about an entity
 */
function extractRelevantSection(content: string, entityName: string): string {
  const lines = content.split('\n');
  const searchLower = entityName.toLowerCase();
  
  // Try to find a section header for this entity
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for ### Entity Name pattern
    if (line.match(/^###?\s+/i) && line.toLowerCase().includes(searchLower)) {
      // Gather content until next header or end
      const sectionLines = [line];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^##/)) break;
        sectionLines.push(lines[j]);
        if (sectionLines.length > 30) break; // Limit size
      }
      return sectionLines.join('\n').trim();
    }
  }
  
  // Fallback: find paragraphs mentioning entity
  const paragraphs = content.split(/\n\n+/);
  const relevant = paragraphs.filter(p => 
    p.toLowerCase().includes(searchLower) && p.length > 50
  );
  
  return relevant.slice(0, 3).join('\n\n');
}

/**
 * Extract quotes about an entity
 */
function extractQuotesAboutEntity(content: string, entityName: string): string[] {
  const quotes: string[] = [];
  const searchLower = entityName.toLowerCase();
  
  // Find quoted text near entity mentions
  const quotePattern = /["*]([^"*]{20,200})["*]/g;
  let match;
  
  while ((match = quotePattern.exec(content)) !== null) {
    const quote = match[1];
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(content.length, match.index + match[0].length + 200);
    const context = content.slice(contextStart, contextEnd).toLowerCase();
    
    if (context.includes(searchLower)) {
      quotes.push(quote);
    }
  }
  
  return quotes.slice(0, 3);
}

// =============================================================================
// AI GENERATION
// =============================================================================

/**
 * Generate a lore entry using Claude
 */
export async function generateEntryWithAI(
  entity: DiscoveredEntity,
  sources: SourceContext[],
  images: MatchedImage[],
  apiKey: string
): Promise<GeneratedContent | null> {
  // Build source context for prompt
  const sourceText = sources.slice(0, 5).map(ctx => 
    `--- SOURCE: ${ctx.file.name} (${ctx.file.type}) ---\n${ctx.relevantSection.slice(0, 2000)}`
  ).join('\n\n');
  
  const imageContext = images.length > 0
    ? `\nAvailable images:\n${images.map(img => `- ${img.relativePath}: ${img.caption}`).join('\n')}`
    : '';
  
  const prompt = `You are writing a lore entry for the Kingdom Death: Monster compendium.

Entity: ${entity.name}
Type: ${entity.type}${entity.subType ? ` (${entity.subType})` : ''}
Brief: ${entity.brief}

Source Material:
${sourceText}
${imageContext}

Write a comprehensive lore entry following this exact format:

---
title: "${entity.name}"
category: ${entity.type}
type: [appropriate subtype]
expansion: [expansion name if known, or "Core Game"]
confidence: [confirmed|likely|speculative based on source quality]
sources: [citation references]
images: [list of image objects with path and caption]
lastUpdated: ${new Date().toISOString().split('T')[0]}
generatedBy: agent
---

# ${entity.name}

> *"[Flavor quote from sources if available]"*

**Category:** ${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
**Type:** [Subtype]
**Expansion:** [Expansion name]

---

## Overview

[2-3 paragraphs about what this is and its significance]

## [Appropriate section based on type - e.g., "Physical Description" for monsters, "History" for factions]

[Detailed information from sources]

## Lore Significance

[How this fits into the broader Kingdom Death world]

## Connections

[List of related entities with brief descriptions of relationships]

## Sources

[List source files used]

---

## Related Entries

[Links to related entries]

---

Make the content rich, atmospheric, and true to Kingdom Death's dark fantasy tone. Only include information that can be traced to the provided sources. Mark any speculation clearly.

Return the complete markdown entry.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Find the text block (thinking mode returns thinking + text blocks)
    const textBlock = data.content.find((block: { type: string }) => block.type === 'text');
    if (!textBlock) {
      console.error('No text block in response');
      return null;
    }
    
    const generatedText = textBlock.text;
    
    // Parse the generated content
    return parseGeneratedEntry(generatedText, entity, sources, images);
  } catch (error) {
    console.error('Entry generation error:', error);
    return null;
  }
}

/**
 * Parse generated entry into structured format
 */
function parseGeneratedEntry(
  text: string,
  entity: DiscoveredEntity,
  sources: SourceContext[],
  images: MatchedImage[]
): GeneratedContent {
  // Extract frontmatter
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter: Record<string, unknown> = {};
  
  if (frontmatterMatch) {
    // Simple YAML parsing
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        
        // Handle quoted strings
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        frontmatter[key] = value;
      }
    }
  }
  
  // Ensure required frontmatter fields
  frontmatter = {
    title: entity.name,
    category: entity.type,
    type: entity.subType || entity.type,
    confidence: determineConfidence(sources),
    lastUpdated: new Date().toISOString().split('T')[0],
    generatedBy: 'agent',
    ...frontmatter,
  };
  
  // Add images to frontmatter
  if (images.length > 0) {
    frontmatter.images = images.map(img => ({
      path: img.relativePath,
      caption: img.caption,
    }));
  }
  
  // Extract content (everything after frontmatter)
  let content = text;
  if (frontmatterMatch) {
    content = text.slice(frontmatterMatch[0].length).trim();
  }
  
  // Generate citations
  const citationRange = getNextCitationRange();
  const citations: string[] = [];
  
  for (const source of sources.slice(0, 5)) {
    const citationId = addCitation({
      source: source.file.name,
      type: source.file.type,
      path: source.file.relativePath,
      topic: entity.name,
    });
    citations.push(citationId);
  }
  
  // Extract connections from content
  const connections = extractConnections(content, entity.name);
  
  return {
    title: entity.name,
    frontmatter,
    content,
    citations,
    connections,
  };
}

/**
 * Determine confidence level based on sources
 */
function determineConfidence(sources: SourceContext[]): 'confirmed' | 'likely' | 'speculative' {
  if (sources.length === 0) return 'speculative';
  
  const hasShop = sources.some(s => s.file.type === 'shop');
  const hasRulebook = sources.some(s => s.file.type === 'rulebook');
  
  if (hasShop || hasRulebook) return 'confirmed';
  if (sources.length >= 2) return 'likely';
  return 'speculative';
}

/**
 * Extract connections mentioned in content
 */
function extractConnections(
  content: string, 
  entityName: string
): Array<{ name: string; relationship: string }> {
  const connections: Array<{ name: string; relationship: string }> = [];
  const lowerContent = content.toLowerCase();
  
  // Known entities to look for
  const knownEntities = [
    'White Lion', 'Butcher', 'Phoenix', 'Screaming Antelope',
    'King\'s Man', 'The Hand', 'Gold Smoke Knight', 'Watcher',
    'Dragon King', 'Sunstalker', 'Gorm', 'Spidicules', 'Flower Knight',
    'Lion Knight', 'Dung Beetle Knight', 'Manhunter', 'Slenderman',
    'Twilight Knight', 'White Speaker', 'Twilight Order',
    'Lantern Hoard', 'Settlement', 'People of the Lantern',
    'People of the Sun', 'People of the Stars',
    'Crimson Crocodile', 'Smog Singers', 'The King', 'Gambler',
  ];
  
  for (const entity of knownEntities) {
    if (entity.toLowerCase() === entityName.toLowerCase()) continue;
    
    if (lowerContent.includes(entity.toLowerCase())) {
      // Try to determine relationship
      let relationship = 'Related';
      
      if (lowerContent.includes(`replaces ${entity.toLowerCase()}`)) {
        relationship = 'Replaces in alternate campaign';
      } else if (lowerContent.includes(`hunts ${entity.toLowerCase()}`)) {
        relationship = 'Predator/prey relationship';
      } else if (lowerContent.includes(`${entity.toLowerCase()} appears`)) {
        relationship = 'Appears alongside';
      }
      
      connections.push({ name: entity, relationship });
    }
  }
  
  return connections.slice(0, 5);
}

// =============================================================================
// ENTRY GENERATION PIPELINE
// =============================================================================

/**
 * Generate an entry for a discovered entity
 */
export async function generateEntryForEntity(
  entity: DiscoveredEntity,
  apiKey: string,
  options?: {
    analyzeImages?: boolean;
  }
): Promise<PendingEntry | null> {
  // Update entity status
  await updateEntityStatus(entity.id, 'generating');
  
  try {
    // Gather sources
    const sources = await gatherSourcesForEntity(entity.name);
    
    if (sources.length === 0) {
      console.log(`No sources found for ${entity.name}`);
      await updateEntityStatus(entity.id, 'queued'); // Put back in queue
      return null;
    }
    
    // Match images
    const images = await matchImagesForEntity(
      entity.name,
      entity.brief,
      options?.analyzeImages ? apiKey : undefined,
      options?.analyzeImages
    );
    
    // Generate entry with AI
    const generated = await generateEntryWithAI(entity, sources, images, apiKey);
    
    if (!generated) {
      await updateEntityStatus(entity.id, 'queued'); // Put back in queue
      return null;
    }
    
    // Add to pending entries
    const pending = await addPendingEntry({
      entityId: entity.id,
      entityName: entity.name,
      content: generated.content,
      frontmatter: generated.frontmatter,
      sourceFiles: sources.map(s => s.file.relativePath),
      images: images.map(img => ({ path: img.relativePath, caption: img.caption })),
      citations: generated.citations,
      connections: generated.connections,
      confidence: generated.frontmatter.confidence as 'confirmed' | 'likely' | 'speculative',
    });
    
    // Update entity status
    await updateEntityStatus(entity.id, 'pending_review');
    
    return pending;
  } catch (error) {
    console.error(`Error generating entry for ${entity.name}:`, error);
    await updateEntityStatus(entity.id, 'queued'); // Put back in queue
    return null;
  }
}

// =============================================================================
// ENTRY SAVING
// =============================================================================

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

/**
 * Save an approved entry to the lore directory
 */
export function saveApprovedEntry(entry: PendingEntry): {
  success: boolean;
  path?: string;
  error?: string;
} {
  // Determine directory based on category
  const categoryDirs: Record<string, string> = {
    monster: '04-monsters',
    character: '05-characters',
    faction: '02-factions',
    location: '03-locations',
    concept: '06-concepts',
    item: '07-technology',
    event: '06-concepts',
  };
  
  const category = (entry.frontmatter.category as string) || 'concept';
  const dirName = categoryDirs[category] || '06-concepts';
  const dirPath = path.join(LORE_PATH, dirName);
  
  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  // Generate filename
  const filename = entry.entityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '.md';
  
  const filePath = path.join(dirPath, filename);
  
  // Build full markdown
  const markdown = buildFullMarkdown(entry);
  
  try {
    fs.writeFileSync(filePath, markdown);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Build full markdown content with frontmatter
 */
function buildFullMarkdown(entry: PendingEntry): string {
  // Build clean frontmatter - only include valid keys
  const validKeys = [
    'title', 'category', 'type', 'expansion', 'confidence', 
    'sources', 'images', 'lastUpdated', 'generatedBy'
  ];
  
  let frontmatter = '---\n';
  
  // Add string fields
  for (const key of ['title', 'category', 'type', 'expansion', 'confidence', 'lastUpdated', 'generatedBy']) {
    const value = entry.frontmatter[key];
    if (value && typeof value === 'string') {
      frontmatter += `${key}: "${value}"\n`;
    }
  }
  
  // Add sources if present
  if (entry.frontmatter.sources) {
    const sources = entry.frontmatter.sources;
    if (typeof sources === 'string') {
      frontmatter += `sources: "${sources}"\n`;
    } else if (Array.isArray(sources)) {
      frontmatter += `sources:\n`;
      for (const s of sources) {
        if (typeof s === 'string') {
          frontmatter += `  - "${s}"\n`;
        }
      }
    }
  }
  
  // Add images from entry.images (not frontmatter, which may be corrupted)
  if (entry.images && entry.images.length > 0) {
    frontmatter += `images:\n`;
    for (const img of entry.images) {
      if (img && typeof img === 'object' && img.path) {
        frontmatter += `  - path: "${img.path}"\n`;
        frontmatter += `    caption: "${img.caption || 'Product image'}"\n`;
      }
    }
  }
  
  frontmatter += '---\n\n';
  
  return frontmatter + entry.content;
}

