/**
 * Entry Reviewer - AI-powered lore entry improvement
 * Uses Claude to analyze existing entries and generate improved versions
 * with proper citations, confidence levels, and formatting
 * 
 * Also supports "expansion mode" - finding new sources and adding details
 * like gear cards, AI cards, events, and relationships.
 */

import fs from 'fs';
import path from 'path';
import {
  loadConfig,
  addPendingEntry,
  updateReviewEntryStatus,
  ReviewQueueEntry,
  PendingEntry,
} from './agent-core';
import { ScannedEntry } from './entry-scanner';
import { getAllSourceFiles, SourceFile } from './entity-discovery';
import { extractContent, GearCard, AICard, HuntEvent } from './content-extractors';
import { classifyContentWithContext } from './content-classifier';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');
const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export interface ReviewedEntry {
  originalPath: string;
  originalContent: string;
  improvedContent: string;
  changes: string[];
  citationsAdded: number;
  confidenceMarkers: number;
  fixedLinks: number;
}

interface SourceExcerpt {
  file: string;
  content: string;
  relevance: string;
}

// =============================================================================
// SOURCE GATHERING
// =============================================================================

/**
 * Find relevant source files for an entry
 */
function findRelevantSources(entryName: string, content: string): SourceExcerpt[] {
  const excerpts: SourceExcerpt[] = [];
  const searchTerms = extractSearchTerms(entryName, content);
  
  // Search through different source directories
  const sourceDirs = [
    'official-site/shop',
    'rulebooks/extracted/core',
    'existing-research',
    'official-site/news',
  ];
  
  for (const dir of sourceDirs) {
    const dirPath = path.join(SOURCES_PATH, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const files = getAllTextFiles(dirPath);
    
    for (const file of files) {
      try {
        const fileContent = fs.readFileSync(file, 'utf-8');
        const matches = findMatches(fileContent, searchTerms);
        
        if (matches.length > 0) {
          // Extract relevant sections
          const relevantSections = extractRelevantSections(fileContent, searchTerms);
          if (relevantSections) {
            excerpts.push({
              file: path.relative(SOURCES_PATH, file),
              content: relevantSections.slice(0, 2000), // Limit length
              relevance: matches.join(', '),
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
      
      // Limit number of sources to avoid context overflow
      if (excerpts.length >= 10) break;
    }
    
    if (excerpts.length >= 10) break;
  }
  
  return excerpts;
}

/**
 * Extract search terms from entry name and content
 */
function extractSearchTerms(name: string, content: string): string[] {
  const terms: string[] = [name.toLowerCase()];
  
  // Add words from title (excluding common words)
  const titleWords = name.split(/\s+/).filter(w => 
    w.length > 3 && !['the', 'and', 'for', 'with'].includes(w.toLowerCase())
  );
  terms.push(...titleWords.map(w => w.toLowerCase()));
  
  // Extract key phrases from content
  const keyPhrases = content.match(/\*\*([^*]+)\*\*/g) || [];
  for (const phrase of keyPhrases) {
    const clean = phrase.replace(/\*\*/g, '').toLowerCase();
    if (clean.length > 3) terms.push(clean);
  }
  
  return [...new Set(terms)];
}

/**
 * Get all text files in a directory recursively
 */
function getAllTextFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...getAllTextFiles(fullPath));
      } else if (entry.name.endsWith('.txt') || entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
  
  return files;
}

/**
 * Find matches for search terms in content
 */
function findMatches(content: string, terms: string[]): string[] {
  const matches: string[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const term of terms) {
    if (lowerContent.includes(term)) {
      matches.push(term);
    }
  }
  
  return matches;
}

/**
 * Extract relevant sections from content
 */
function extractRelevantSections(content: string, terms: string[]): string | null {
  const lines = content.split('\n');
  const relevantLines: string[] = [];
  let capturing = false;
  let captureCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Check if line contains any search terms
    const hasMatch = terms.some(term => lowerLine.includes(term));
    
    if (hasMatch) {
      // Include surrounding context (3 lines before and after)
      const start = Math.max(0, i - 3);
      const end = Math.min(lines.length, i + 4);
      
      for (let j = start; j < end; j++) {
        if (!relevantLines.includes(lines[j])) {
          relevantLines.push(lines[j]);
        }
      }
      
      captureCount++;
      if (captureCount >= 5) break; // Limit captures
    }
  }
  
  return relevantLines.length > 0 ? relevantLines.join('\n') : null;
}

// =============================================================================
// AI REVIEW
// =============================================================================

/**
 * Review an entry using Claude
 */
export async function reviewEntry(
  reviewEntry: ReviewQueueEntry,
  scannedEntry: ScannedEntry
): Promise<ReviewedEntry | null> {
  const config = await loadConfig();
  
  // Load original content
  const originalContent = fs.readFileSync(reviewEntry.filePath, 'utf-8');
  
  // Find relevant sources
  const sources = findRelevantSources(reviewEntry.entryName, originalContent);
  
  // Prepare issues list
  const issuesList = scannedEntry.issues
    .map(i => `- ${i.type}: ${i.description}`)
    .join('\n');
  
  // Prepare sources text
  const sourcesText = sources.length > 0
    ? sources.map(s => `### ${s.file}\n\`\`\`\n${s.content}\n\`\`\``).join('\n\n')
    : 'No specific source files found. Use general Kingdom Death knowledge.';
  
  const prompt = `You are reviewing an existing Kingdom Death: Monster lore entry for accuracy, citations, and formatting.

## ORIGINAL ENTRY (${reviewEntry.entryName})
\`\`\`markdown
${originalContent}
\`\`\`

## DETECTED ISSUES
${issuesList}

## AVAILABLE SOURCE MATERIAL
${sourcesText}

## YOUR TASK
Generate an improved version of this lore entry that:

1. **Adds YAML Frontmatter** (if missing):
   \`\`\`yaml
   ---
   title: "Entry Title"
   category: monster|character|faction|location|concept
   type: specific type (e.g., Nemesis, Quarry, Settlement Location)
   confidence: confirmed|likely|speculative
   expansion: "Core Game" or expansion name
   sources: ["source-file:line-range"]
   lastUpdated: "${new Date().toISOString().split('T')[0]}"
   generatedBy: "agent-review"
   published: true
   ---
   \`\`\`

2. **Adds inline citations** to factual claims using format: [source-file:line-range]
   - Example: "The Butcher arrives at Lantern Year 4 [core-rules-01-ocr:45-47]"
   - Only cite if you can verify from the provided sources
   - If no source verifies a claim, mark it as (speculative)

3. **Marks speculation clearly**:
   - Use (confirmed), (likely), or (speculative) after claims
   - Theories section should have confidence levels

4. **Fixes or removes broken links** that reference non-existent files

5. **Maintains the existing structure** but ensures:
   - Has ## Overview section
   - Proper heading hierarchy
   - Clean markdown formatting

6. **Does NOT invent information** - only include what's verifiable from sources or clearly marked as speculation

IMPORTANT: Return ONLY the improved markdown content, no explanations. The entry should be publication-ready.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[EntryReviewer] No ANTHROPIC_API_KEY configured');
    return null;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        thinking: {
          type: 'enabled',
          budget_tokens: 8000,
        },
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[EntryReviewer] Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Extract the text response
    let improvedContent = '';
    for (const block of data.content) {
      if (block.type === 'text') {
        improvedContent = block.text;
        break;
      }
    }
    
    if (!improvedContent) {
      console.error('[EntryReviewer] No content in response');
      return null;
    }
    
    // Clean up the response (remove code fences if present)
    improvedContent = improvedContent
      .replace(/^```markdown\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    
    // Calculate changes
    const changes = calculateChanges(originalContent, improvedContent);
    
    return {
      originalPath: reviewEntry.filePath,
      originalContent,
      improvedContent,
      changes: changes.descriptions,
      citationsAdded: changes.citations,
      confidenceMarkers: changes.confidenceMarkers,
      fixedLinks: changes.fixedLinks,
    };
    
  } catch (error) {
    console.error('[EntryReviewer] Claude API error:', error);
    return null;
  }
}

/**
 * Calculate what changed between original and improved
 */
function calculateChanges(original: string, improved: string): {
  descriptions: string[];
  citations: number;
  confidenceMarkers: number;
  fixedLinks: number;
} {
  const descriptions: string[] = [];
  
  // Check for frontmatter addition
  const hadFrontmatter = original.startsWith('---');
  const hasFrontmatter = improved.startsWith('---');
  if (!hadFrontmatter && hasFrontmatter) {
    descriptions.push('Added YAML frontmatter');
  }
  
  // Count citations
  const originalCitations = (original.match(/\[[a-z0-9-]+:\d+-?\d*\]/gi) || []).length;
  const improvedCitations = (improved.match(/\[[a-z0-9-]+:\d+-?\d*\]/gi) || []).length;
  const citationsAdded = improvedCitations - originalCitations;
  if (citationsAdded > 0) {
    descriptions.push(`Added ${citationsAdded} inline citations`);
  }
  
  // Count confidence markers
  const originalConfidence = (original.match(/\((confirmed|likely|speculative)\)/gi) || []).length;
  const improvedConfidence = (improved.match(/\((confirmed|likely|speculative)\)/gi) || []).length;
  const confidenceAdded = improvedConfidence - originalConfidence;
  if (confidenceAdded > 0) {
    descriptions.push(`Added ${confidenceAdded} confidence markers`);
  }
  
  // Check for Overview section
  const hadOverview = original.includes('## Overview');
  const hasOverview = improved.includes('## Overview');
  if (!hadOverview && hasOverview) {
    descriptions.push('Added Overview section');
  }
  
  // Count broken link fixes (approximate by checking removed links)
  const originalLinks = (original.match(/\]\([^)]+\.md\)/g) || []).length;
  const improvedLinks = (improved.match(/\]\([^)]+\.md\)/g) || []).length;
  const fixedLinks = Math.max(0, originalLinks - improvedLinks);
  if (fixedLinks > 0) {
    descriptions.push(`Removed/fixed ${fixedLinks} broken links`);
  }
  
  return {
    descriptions,
    citations: citationsAdded,
    confidenceMarkers: confidenceAdded,
    fixedLinks,
  };
}

// =============================================================================
// REVIEW WORKFLOW
// =============================================================================

/**
 * Process a review queue entry and add to pending review
 */
export async function processReviewEntry(
  reviewQueueEntry: ReviewQueueEntry,
  scannedEntry: ScannedEntry
): Promise<PendingEntry | null> {
  // Update status to reviewing
  await updateReviewEntryStatus(reviewQueueEntry.id, 'reviewing');
  
  try {
    // Run AI review
    const result = await reviewEntry(reviewQueueEntry, scannedEntry);
    
    if (!result) {
      await updateReviewEntryStatus(reviewQueueEntry.id, 'skipped');
      return null;
    }
    
    // Create pending entry for approval
    const pendingEntry = await addPendingEntry({
      entityId: reviewQueueEntry.id,
      entityName: reviewQueueEntry.entryName,
      content: result.improvedContent,
      frontmatter: {
        reviewType: 'improvement',
        originalPath: result.originalPath,
        changes: result.changes,
        citationsAdded: result.citationsAdded,
      },
      sourceFiles: [],
      images: [],
      citations: [],
      connections: [],
      confidence: 'confirmed', // Review is for existing entries
    });
    
    // Update review queue status
    await updateReviewEntryStatus(reviewQueueEntry.id, 'pending_approval');
    
    return pendingEntry;
    
  } catch (error) {
    console.error('[EntryReviewer] Error processing review:', error);
    await updateReviewEntryStatus(reviewQueueEntry.id, 'skipped');
    return null;
  }
}

/**
 * Save an approved review (overwrites original file)
 */
export async function saveApprovedReview(
  pendingEntry: PendingEntry
): Promise<boolean> {
  const originalPath = pendingEntry.frontmatter.originalPath as string;
  
  if (!originalPath || !fs.existsSync(originalPath)) {
    console.error('[EntryReviewer] Original path not found:', originalPath);
    return false;
  }
  
  try {
    // Backup original
    const backupPath = originalPath.replace('.md', '.backup.md');
    fs.copyFileSync(originalPath, backupPath);
    
    // Write improved content
    fs.writeFileSync(originalPath, pendingEntry.content);
    
    // Remove backup after successful write
    fs.unlinkSync(backupPath);
    
    return true;
  } catch (error) {
    console.error('[EntryReviewer] Error saving review:', error);
    return false;
  }
}

// =============================================================================
// EXPANSION MODE - Find and add new details to existing entries
// =============================================================================

export interface ExpansionResult {
  entryPath: string;
  entryName: string;
  newSourcesFound: number;
  gearCardsFound: GearCard[];
  aiCardsFound: AICard[];
  eventsFound: HuntEvent[];
  expandedContent: string;
  addedSections: string[];
}

export interface EntryExpansionCandidate {
  filePath: string;
  entryName: string;
  category: string;
  currentDetailLevel: 'basic' | 'moderate' | 'comprehensive';
  lastExpanded?: string;
  potentialSources: number;
}

/**
 * Find entries that could benefit from expansion
 */
export async function findExpansionCandidates(limit = 20): Promise<EntryExpansionCandidate[]> {
  const candidates: EntryExpansionCandidate[] = [];
  const allSources = getAllSourceFiles();
  
  const categories = [
    '04-monsters', '05-characters', '06-concepts',
    '02-factions', '03-locations',
  ];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath);
    
    for (const file of files) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract entry name
      const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/title:\s*"?([^"\n]+)"?/);
      const entryName = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');
      
      // Determine current detail level
      const detailLevel = assessDetailLevel(content);
      
      // Check for lastExpanded in frontmatter
      const lastExpandedMatch = content.match(/lastExpanded:\s*"?([^"\n]+)"?/);
      const lastExpanded = lastExpandedMatch ? lastExpandedMatch[1] : undefined;
      
      // Skip if recently expanded (within last 7 days)
      if (lastExpanded) {
        const expandedDate = new Date(lastExpanded);
        const daysSinceExpanded = (Date.now() - expandedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceExpanded < 7) continue;
      }
      
      // Count potential sources that mention this entry
      const potentialSources = countPotentialSources(entryName, allSources);
      
      // Only include if there are potential new sources and detail is not comprehensive
      if (potentialSources > 0 && detailLevel !== 'comprehensive') {
        candidates.push({
          filePath,
          entryName,
          category,
          currentDetailLevel: detailLevel,
          lastExpanded,
          potentialSources,
        });
      }
    }
  }
  
  // Sort by potential sources (highest first) and detail level (basic first)
  candidates.sort((a, b) => {
    const levelPriority: Record<string, number> = { basic: 0, moderate: 1, comprehensive: 2 };
    const levelDiff = levelPriority[a.currentDetailLevel] - levelPriority[b.currentDetailLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.potentialSources - a.potentialSources;
  });
  
  return candidates.slice(0, limit);
}

/**
 * Assess the current detail level of an entry
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
  
  // Check for gear info
  if (content.toLowerCase().includes('## gear') || content.toLowerCase().includes('## equipment')) {
    score += 2;
  }
  
  // Check for AI card info
  if (content.toLowerCase().includes('## ai cards') || content.toLowerCase().includes('## behavior')) {
    score += 2;
  }
  
  // Check for events
  if (content.toLowerCase().includes('## events') || content.toLowerCase().includes('hunt event')) {
    score += 2;
  }
  
  // Check for relationships
  if (content.toLowerCase().includes('## connections') || content.toLowerCase().includes('## relationships')) {
    score += 1;
  }
  
  if (score >= 12) return 'comprehensive';
  if (score >= 6) return 'moderate';
  return 'basic';
}

/**
 * Count how many sources might have information about an entry
 */
function countPotentialSources(entryName: string, sources: SourceFile[]): number {
  const searchTerms = entryName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let count = 0;
  
  for (const source of sources) {
    const lowerContent = source.content.toLowerCase();
    const matches = searchTerms.filter(term => lowerContent.includes(term));
    if (matches.length >= Math.min(2, searchTerms.length)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Expand an entry with new information from sources
 */
export async function expandEntry(
  candidate: EntryExpansionCandidate
): Promise<ExpansionResult | null> {
  const config = await loadConfig();
  const originalContent = fs.readFileSync(candidate.filePath, 'utf-8');
  const allSources = getAllSourceFiles();
  
  // Find relevant sources for this entry
  const relevantSources = findRelevantSourcesForExpansion(
    candidate.entryName,
    allSources
  );
  
  if (relevantSources.length === 0) {
    return null;
  }
  
  // Extract structured content from sources
  const gearCards: GearCard[] = [];
  const aiCards: AICard[] = [];
  const events: HuntEvent[] = [];
  const additionalInfo: string[] = [];
  
  for (const source of relevantSources) {
    const extracted = extractContent(source.content, source.name, source.relativePath);
    
    switch (extracted.type) {
      case 'gear_card':
        gearCards.push(extracted.data);
        break;
      case 'ai_card':
        aiCards.push(extracted.data);
        break;
      case 'hunt_event':
        events.push(...extracted.data);
        break;
      case 'general':
        if (extracted.data.summary.length > 50) {
          additionalInfo.push(`From ${source.relativePath}:\n${extracted.data.summary}`);
        }
        break;
    }
  }
  
  // Build expansion prompt
  const prompt = buildExpansionPrompt(
    candidate.entryName,
    originalContent,
    gearCards,
    aiCards,
    events,
    additionalInfo.slice(0, 5),
    relevantSources.slice(0, 10)
  );
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[EntryExpansion] No ANTHROPIC_API_KEY configured');
    return null;
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000,
        },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) {
      console.error('[EntryExpansion] Claude API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Extract text response
    let expandedContent = '';
    for (const block of data.content) {
      if (block.type === 'text') {
        expandedContent = block.text;
        break;
      }
    }
    
    if (!expandedContent) {
      return null;
    }
    
    // Clean up response
    expandedContent = expandedContent
      .replace(/^```markdown\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    
    // Determine what sections were added
    const addedSections: string[] = [];
    if (!originalContent.includes('## Gear') && expandedContent.includes('## Gear')) {
      addedSections.push('Gear');
    }
    if (!originalContent.includes('## AI Cards') && expandedContent.includes('## AI Cards')) {
      addedSections.push('AI Cards');
    }
    if (!originalContent.includes('## Hunt Events') && expandedContent.includes('## Hunt Events')) {
      addedSections.push('Hunt Events');
    }
    if (!originalContent.includes('## Connections') && expandedContent.includes('## Connections')) {
      addedSections.push('Connections');
    }
    
    return {
      entryPath: candidate.filePath,
      entryName: candidate.entryName,
      newSourcesFound: relevantSources.length,
      gearCardsFound: gearCards,
      aiCardsFound: aiCards,
      eventsFound: events,
      expandedContent,
      addedSections,
    };
    
  } catch (error) {
    console.error('[EntryExpansion] Error:', error);
    return null;
  }
}

/**
 * Find relevant sources specifically for expansion
 */
function findRelevantSourcesForExpansion(
  entryName: string,
  sources: SourceFile[]
): SourceFile[] {
  const relevant: SourceFile[] = [];
  const searchTerms = entryName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  // Also add common related terms based on entry name
  const relatedTerms = getRelatedTerms(entryName);
  searchTerms.push(...relatedTerms);
  
  for (const source of sources) {
    const lowerContent = source.content.toLowerCase();
    const lowerName = source.name.toLowerCase();
    
    // Check filename first (high relevance)
    const nameMatches = searchTerms.filter(term => lowerName.includes(term));
    if (nameMatches.length > 0) {
      relevant.push(source);
      continue;
    }
    
    // Check content
    const contentMatches = searchTerms.filter(term => lowerContent.includes(term));
    if (contentMatches.length >= Math.min(2, searchTerms.length)) {
      relevant.push(source);
    }
  }
  
  return relevant.slice(0, 50); // Limit to prevent token overflow
}

/**
 * Get related search terms for an entity
 */
function getRelatedTerms(entryName: string): string[] {
  const related: string[] = [];
  const lower = entryName.toLowerCase();
  
  // Monster-related terms
  const monsters = ['gorm', 'phoenix', 'dragon', 'lion', 'antelope', 'butcher', 'king'];
  for (const monster of monsters) {
    if (lower.includes(monster)) {
      related.push(`${monster}-ai`, `${monster} gear`, `${monster} hunt`);
    }
  }
  
  return related;
}

/**
 * Build the expansion prompt
 */
function buildExpansionPrompt(
  entryName: string,
  originalContent: string,
  gearCards: GearCard[],
  aiCards: AICard[],
  events: HuntEvent[],
  additionalInfo: string[],
  sources: SourceFile[]
): string {
  let prompt = `You are expanding a Kingdom Death: Monster lore entry with new information from sources.

## ORIGINAL ENTRY: ${entryName}
\`\`\`markdown
${originalContent}
\`\`\`

## NEW INFORMATION FOUND

`;

  // Add gear card info
  if (gearCards.length > 0) {
    prompt += `### Gear Cards (${gearCards.length} found)
`;
    for (const gear of gearCards.slice(0, 10)) {
      prompt += `- **${gear.name}** (${gear.type}): ${gear.effect.slice(0, 100)}... [${gear.sourceFile}]\n`;
      if (gear.stats.speed || gear.stats.accuracy || gear.stats.strength) {
        prompt += `  Stats: Speed ${gear.stats.speed || '-'}, Accuracy ${gear.stats.accuracy || '-'}, Strength ${gear.stats.strength || '-'}\n`;
      }
      if (gear.keywords.length > 0) {
        prompt += `  Keywords: ${gear.keywords.join(', ')}\n`;
      }
    }
    prompt += '\n';
  }

  // Add AI card info
  if (aiCards.length > 0) {
    prompt += `### AI Cards (${aiCards.length} found)
`;
    for (const ai of aiCards.slice(0, 15)) {
      prompt += `- **${ai.name}** (${ai.phase}): Speed ${ai.speed}, ${ai.accuracy}, Damage ${ai.damage} [${ai.sourceFile}]\n`;
      if (ai.effects.length > 0) {
        prompt += `  Effects: ${ai.effects.slice(0, 2).join('; ')}\n`;
      }
    }
    prompt += '\n';
  }

  // Add event info
  if (events.length > 0) {
    prompt += `### Hunt Events (${events.length} found)
`;
    for (const event of events.slice(0, 5)) {
      prompt += `- **${event.number}: ${event.name}** - ${event.description.slice(0, 100)}... [${event.sourceFile}]\n`;
    }
    prompt += '\n';
  }

  // Add additional info
  if (additionalInfo.length > 0) {
    prompt += `### Additional Sources
`;
    for (const info of additionalInfo) {
      prompt += `${info}\n\n`;
    }
  }

  // List source files
  prompt += `### Source Files Referenced
`;
  for (const source of sources.slice(0, 10)) {
    prompt += `- ${source.relativePath}\n`;
  }

  prompt += `

## YOUR TASK

Expand the original entry with the new information. You MUST:

1. **Keep ALL existing content** - do not remove or significantly alter existing sections
2. **Add new sections** for:
   - ## Gear (if gear cards found and not present)
   - ## AI Cards (if AI cards found and not present)  
   - ## Hunt Events (if events found and not present)
   - ## Connections (relationships to other entities)
3. **Add inline citations** [source-file:line-range] to new content
4. **Update frontmatter**:
   - Set \`detailLevel: moderate\` or \`comprehensive\`
   - Add \`hasGearInfo: true/false\`
   - Add \`hasAICards: true/false\`  
   - Add \`hasEvents: true/false\`
   - Set \`lastExpanded: "${new Date().toISOString().split('T')[0]}"\`
5. **Maintain quality** - only add verifiable information from the sources

IMPORTANT: Return ONLY the expanded markdown content, no explanations.`;

  return prompt;
}

/**
 * Process entry expansion and add to pending review
 */
export async function processEntryExpansion(
  candidate: EntryExpansionCandidate
): Promise<PendingEntry | null> {
  try {
    const result = await expandEntry(candidate);
    
    if (!result || result.addedSections.length === 0) {
      return null;
    }
    
    // Create pending entry for approval
    const pendingEntry = await addPendingEntry({
      entityId: `expand-${Date.now()}`,
      entityName: candidate.entryName,
      content: result.expandedContent,
      frontmatter: {
        reviewType: 'expansion',
        originalPath: candidate.filePath,
        addedSections: result.addedSections,
        gearCardsAdded: result.gearCardsFound.length,
        aiCardsAdded: result.aiCardsFound.length,
        eventsAdded: result.eventsFound.length,
        newSourcesFound: result.newSourcesFound,
      },
      sourceFiles: [],
      images: [],
      citations: [],
      connections: [],
      confidence: 'confirmed',
    });
    
    return pendingEntry;
    
  } catch (error) {
    console.error('[EntryExpansion] Error processing expansion:', error);
    return null;
  }
}

