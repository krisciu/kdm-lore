/**
 * Entry Reviewer - AI-powered lore entry improvement
 * Uses Claude to analyze existing entries and generate improved versions
 * with proper citations, confidence levels, and formatting
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

