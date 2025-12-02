/**
 * Entry Scanner - Detects quality issues in existing lore entries
 * Scans entries for missing citations, broken links, formatting issues, etc.
 * 
 * Now includes link and YAML validation via link-fixer and frontmatter-fixer.
 */

import fs from 'fs';
import path from 'path';
import { findBrokenLinks as findBrokenLinksDetailed, BrokenLink } from './link-fixer';
import { findFrontmatterIssues, FrontmatterIssue } from './frontmatter-fixer';

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export interface ScanIssue {
  type: 
    | 'missing_frontmatter'
    | 'missing_citations'
    | 'uncited_sources'
    | 'unmarked_speculation'
    | 'broken_link'
    | 'wiki_style_link'      // NEW: [[text]] links
    | 'bare_bracket_link'    // NEW: [text] without path
    | 'malformed_yaml'       // NEW: Quoted arrays, etc.
    | 'missing_published'    // NEW: Missing published field
    | 'missing_detail_level' // NEW: Missing detailLevel field
    | 'missing_overview'
    | 'no_confidence_level'
    | 'outdated_format';
  severity: 'high' | 'medium' | 'low';
  description: string;
  line?: number;
  suggestion?: string;
}

export interface ScannedEntry {
  filePath: string;
  fileName: string;
  entryName: string;
  category: string;
  issues: ScanIssue[];
  score: number; // 0-100, higher = better quality
  lastScanned: string;
}

export interface ScanResult {
  totalScanned: number;
  entriesWithIssues: number;
  issuesByType: Record<string, number>;
  entries: ScannedEntry[];
  scanDuration: number;
}

// =============================================================================
// ISSUE DETECTION
// =============================================================================

/**
 * Check if entry has valid YAML frontmatter
 */
function checkFrontmatter(content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Check for YAML frontmatter block
  const hasFrontmatter = content.startsWith('---\n') && content.indexOf('\n---', 4) > 0;
  
  if (!hasFrontmatter) {
    issues.push({
      type: 'missing_frontmatter',
      severity: 'high',
      description: 'Entry lacks YAML frontmatter with metadata (title, category, confidence, etc.)',
      suggestion: 'Add frontmatter block with title, category, type, confidence, and sources fields',
    });
  } else {
    // Check for required frontmatter fields
    const frontmatterEnd = content.indexOf('\n---', 4);
    const frontmatterContent = content.slice(4, frontmatterEnd);
    
    const requiredFields = ['title', 'category', 'confidence'];
    const recommendedFields = ['type', 'sources', 'lastUpdated'];
    
    for (const field of requiredFields) {
      if (!frontmatterContent.includes(`${field}:`)) {
        issues.push({
          type: 'missing_frontmatter',
          severity: 'medium',
          description: `Frontmatter missing required field: ${field}`,
          suggestion: `Add ${field} field to frontmatter`,
        });
      }
    }
    
    for (const field of recommendedFields) {
      if (!frontmatterContent.includes(`${field}:`)) {
        issues.push({
          type: 'outdated_format',
          severity: 'low',
          description: `Frontmatter missing recommended field: ${field}`,
          suggestion: `Consider adding ${field} field`,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check for inline citations
 */
function checkCitations(content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Look for citation patterns: [source:lines], [1], [core-rules], etc.
  const citationPatterns = [
    /\[\d+\]/g,                          // [1], [2], etc.
    /\[[a-z-]+:\d+-\d+\]/gi,             // [source-file:10-20]
    /\[[a-z-]+\]/gi,                     // [core-rules]
    /\[GC-\d+\]/g,                       // [GC-1]
  ];
  
  let hasCitations = false;
  for (const pattern of citationPatterns) {
    if (pattern.test(content)) {
      hasCitations = true;
      break;
    }
  }
  
  if (!hasCitations) {
    // Check if there's factual content that should be cited
    const factualIndicators = [
      /arrives? at/i,
      /appears? in/i,
      /according to/i,
      /lantern year \d+/i,
      /was once/i,
      /is a/i,
      /are known/i,
      /first appeared?/i,
    ];
    
    let hasFactualContent = false;
    for (const indicator of factualIndicators) {
      if (indicator.test(content)) {
        hasFactualContent = true;
        break;
      }
    }
    
    if (hasFactualContent) {
      issues.push({
        type: 'missing_citations',
        severity: 'high',
        description: 'Entry contains factual claims but no inline citations',
        suggestion: 'Add [source-file:line-range] citations to factual statements',
      });
    }
  }
  
  return issues;
}

/**
 * Check for uncited sources section
 */
function checkSourcesSection(content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Look for Sources section
  const sourcesMatch = content.match(/##\s*Sources?\s*\n([\s\S]*?)(?=\n##|\n---|\n\[|$)/i);
  
  if (sourcesMatch) {
    const sourcesContent = sourcesMatch[1];
    
    // Check if sources are just bullet points without proper citations
    const lines = sourcesContent.split('\n').filter(l => l.trim().startsWith('-'));
    
    if (lines.length > 0) {
      // Check if any line has a proper file reference
      const hasFileRef = lines.some(line => 
        line.includes('.txt') || 
        line.includes('.md') ||
        line.includes('[') ||
        /\d+-\d+/.test(line)
      );
      
      if (!hasFileRef) {
        issues.push({
          type: 'uncited_sources',
          severity: 'medium',
          description: 'Sources section lists references but without specific file/line citations',
          suggestion: 'Link sources to actual source files in docs/lore/sources/',
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check for unmarked speculation/theories
 */
function checkSpeculation(content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Words that indicate speculation
  const speculativeIndicators = [
    /\bmay\b/gi,
    /\bmight\b/gi,
    /\bperhaps\b/gi,
    /\bpossibly\b/gi,
    /\btheor(y|ies|ize)/gi,
    /\bspeculat/gi,
    /\bsome believe/gi,
    /\bsome think/gi,
    /\bit is thought/gi,
    /\bcould be/gi,
  ];
  
  let speculativeCount = 0;
  for (const pattern of speculativeIndicators) {
    const matches = content.match(pattern);
    if (matches) {
      speculativeCount += matches.length;
    }
  }
  
  // Check if confidence level is set in frontmatter
  const hasConfidenceLevel = /confidence:\s*(confirmed|likely|speculative)/i.test(content);
  
  // Check for confidence markers in text
  const hasInlineConfidence = 
    /\*\*Confidence:\*\*/i.test(content) ||
    /\(speculative\)/i.test(content) ||
    /\(likely\)/i.test(content) ||
    /\(confirmed\)/i.test(content);
  
  if (speculativeCount > 2 && !hasConfidenceLevel && !hasInlineConfidence) {
    issues.push({
      type: 'unmarked_speculation',
      severity: 'medium',
      description: `Entry contains ${speculativeCount} speculative statements without confidence markers`,
      suggestion: 'Mark speculative content with (speculative) or (likely) tags',
    });
  }
  
  // Check for theory sections without confidence markers
  const theorySection = content.match(/###?\s*Theor(y|ies)/i);
  if (theorySection && !hasInlineConfidence) {
    issues.push({
      type: 'no_confidence_level',
      severity: 'medium',
      description: 'Theory section found without confidence level markers',
      suggestion: 'Add confidence levels to each theory (confirmed/likely/speculative)',
    });
  }
  
  return issues;
}

/**
 * Check for broken internal links using the detailed link fixer
 */
function checkBrokenLinks(content: string, filePath: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Use the detailed link fixer for comprehensive detection
  const brokenLinks = findBrokenLinksDetailed(content, filePath);
  
  for (const link of brokenLinks) {
    let issueType: ScanIssue['type'] = 'broken_link';
    let severity: ScanIssue['severity'] = 'medium';
    
    // Map link types to issue types
    switch (link.type) {
      case 'wiki_style':
        issueType = 'wiki_style_link';
        severity = 'high'; // Wiki links won't render at all
        break;
      case 'bare_bracket':
        issueType = 'bare_bracket_link';
        severity = 'high'; // Bare brackets won't render as links
        break;
      case 'missing_file':
        issueType = 'broken_link';
        severity = 'medium';
        break;
      case 'invalid_path':
        issueType = 'broken_link';
        severity = 'medium';
        break;
    }
    
    issues.push({
      type: issueType,
      severity,
      description: `${link.type.replace(/_/g, ' ')}: ${link.original}`,
      line: link.line,
      suggestion: link.suggestedFix || 'Fix or remove the broken link',
    });
  }
  
  return issues;
}

/**
 * Check for YAML frontmatter issues using the detailed frontmatter fixer
 */
function checkYAMLIssues(content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Use the detailed frontmatter fixer
  const fmIssues = findFrontmatterIssues(content);
  
  for (const fmIssue of fmIssues) {
    let issueType: ScanIssue['type'] = 'malformed_yaml';
    let severity: ScanIssue['severity'] = 'medium';
    
    switch (fmIssue.type) {
      case 'quoted_array':
        issueType = 'malformed_yaml';
        severity = 'high'; // Breaks YAML parsing
        break;
      case 'missing_published':
        issueType = 'missing_published';
        severity = 'medium';
        break;
      case 'missing_detail_level':
        issueType = 'missing_detail_level';
        severity = 'low';
        break;
      case 'invalid_yaml':
        issueType = 'malformed_yaml';
        severity = 'high';
        break;
      case 'missing_frontmatter':
        issueType = 'missing_frontmatter';
        severity = 'high';
        break;
    }
    
    issues.push({
      type: issueType,
      severity,
      description: fmIssue.field 
        ? `${fmIssue.type.replace(/_/g, ' ')}: ${fmIssue.field}`
        : fmIssue.type.replace(/_/g, ' '),
      suggestion: fmIssue.suggestedValue || undefined,
    });
  }
  
  return issues;
}

/**
 * Check for proper structure (Overview section, etc.)
 */
function checkStructure(content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  // Check for Overview section
  if (!content.includes('## Overview')) {
    issues.push({
      type: 'missing_overview',
      severity: 'medium',
      description: 'Entry lacks ## Overview section',
      suggestion: 'Add an Overview section summarizing the entry',
    });
  }
  
  // Check for proper heading hierarchy
  const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
  let hasH1 = false;
  let hasH2 = false;
  
  for (const heading of headings) {
    if (heading.startsWith('# ') && !heading.startsWith('## ')) {
      hasH1 = true;
    }
    if (heading.startsWith('## ')) {
      hasH2 = true;
    }
  }
  
  if (!hasH1) {
    issues.push({
      type: 'outdated_format',
      severity: 'low',
      description: 'Entry lacks main title (# heading)',
      suggestion: 'Add a main title using # Heading syntax',
    });
  }
  
  return issues;
}

// =============================================================================
// SCANNER
// =============================================================================

/**
 * Calculate quality score based on issues
 */
function calculateScore(issues: ScanIssue[]): number {
  let score = 100;
  
  for (const issue of issues) {
    switch (issue.severity) {
      case 'high':
        score -= 20;
        break;
      case 'medium':
        score -= 10;
        break;
      case 'low':
        score -= 5;
        break;
    }
  }
  
  return Math.max(0, score);
}

/**
 * Scan a single entry file
 */
export function scanEntry(filePath: string): ScannedEntry {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const category = path.basename(path.dirname(filePath));
  
  // Extract entry name from content
  const titleMatch = content.match(/^#\s+(.+)$/m) || 
                     content.match(/title:\s*"?([^"\n]+)"?/);
  const entryName = titleMatch ? titleMatch[1].trim() : fileName.replace('.md', '');
  
  // Collect all issues
  const issues: ScanIssue[] = [
    ...checkFrontmatter(content),
    ...checkYAMLIssues(content),    // NEW: Detailed YAML checks
    ...checkCitations(content),
    ...checkSourcesSection(content),
    ...checkSpeculation(content),
    ...checkBrokenLinks(content, filePath),  // Uses detailed link checker
    ...checkStructure(content),
  ];
  
  // Dedupe issues by type + description
  const seen = new Set<string>();
  const deduped = issues.filter(issue => {
    const key = `${issue.type}:${issue.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return {
    filePath,
    fileName,
    entryName,
    category,
    issues: deduped,
    score: calculateScore(deduped),
    lastScanned: new Date().toISOString(),
  };
}

/**
 * Scan all lore entries in a category directory
 */
export function scanCategory(categoryDir: string): ScannedEntry[] {
  const entries: ScannedEntry[] = [];
  const dirPath = path.join(LORE_PATH, categoryDir);
  
  if (!fs.existsSync(dirPath)) {
    return entries;
  }
  
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'));
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      entries.push(scanEntry(filePath));
    } catch (error) {
      console.error(`Error scanning ${filePath}:`, error);
    }
  }
  
  return entries;
}

/**
 * Scan all lore entries
 */
export function scanAllEntries(): ScanResult {
  const startTime = Date.now();
  const allEntries: ScannedEntry[] = [];
  const issuesByType: Record<string, number> = {};
  
  // Category directories
  const categories = [
    '00-introduction',
    '01-world',
    '02-factions',
    '03-locations',
    '04-monsters',
    '05-characters',
    '06-concepts',
    '07-technology',
    '08-theories',
    '09-philosophy',
    '10-art',
    '11-community',
    '12-future',
  ];
  
  for (const category of categories) {
    const entries = scanCategory(category);
    allEntries.push(...entries);
  }
  
  // Count issues by type
  for (const entry of allEntries) {
    for (const issue of entry.issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    }
  }
  
  // Sort by score (worst first)
  allEntries.sort((a, b) => a.score - b.score);
  
  return {
    totalScanned: allEntries.length,
    entriesWithIssues: allEntries.filter(e => e.issues.length > 0).length,
    issuesByType,
    entries: allEntries,
    scanDuration: Date.now() - startTime,
  };
}

/**
 * Get entries that need review (score below threshold)
 */
export function getEntriesNeedingReview(threshold: number = 70): ScannedEntry[] {
  const result = scanAllEntries();
  return result.entries.filter(e => e.score < threshold);
}

/**
 * Calculate priority for review queue
 * Higher priority = more urgent
 */
export function calculateReviewPriority(entry: ScannedEntry): number {
  let priority = 0;
  
  // Base priority on inverse score
  priority += (100 - entry.score);
  
  // High severity issues add extra priority
  const highSeverityCount = entry.issues.filter(i => i.severity === 'high').length;
  priority += highSeverityCount * 20;
  
  // Missing citations is especially important
  if (entry.issues.some(i => i.type === 'missing_citations')) {
    priority += 15;
  }
  
  // Missing frontmatter is important for publishing
  if (entry.issues.some(i => i.type === 'missing_frontmatter')) {
    priority += 10;
  }
  
  return priority;
}

