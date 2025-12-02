/**
 * Frontmatter Fixer - Repairs malformed YAML and adds missing fields
 * 
 * Handles:
 * - Quoted JSON arrays: sources: "["a", "b"]" -> sources: ["a", "b"]
 * - Missing published field
 * - Missing detailLevel field
 * - Invalid YAML syntax
 */

import fs from 'fs';
import path from 'path';

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export interface FrontmatterIssue {
  type: 'quoted_array' | 'missing_published' | 'missing_detail_level' | 'invalid_yaml' | 'missing_frontmatter';
  field?: string;
  originalValue?: string;
  suggestedValue?: string;
}

export interface FrontmatterFixResult {
  filePath: string;
  issues: FrontmatterIssue[];
  fixedContent?: string;
  fixedCount: number;
}

export interface FrontmatterReport {
  totalFiles: number;
  filesWithIssues: number;
  totalIssues: number;
  byType: Record<string, number>;
  details: FrontmatterFixResult[];
}

// =============================================================================
// FRONTMATTER PARSING
// =============================================================================

/**
 * Extract frontmatter from content
 */
function extractFrontmatter(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) {
    return { frontmatter: match[1], body: match[2] };
  }
  return null;
}

/**
 * Parse frontmatter into object (used internally)
 */
function _parseFrontmatter(frontmatterText: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = frontmatterText.split('\n');
  let currentKey: string | null = null;
  const currentValue: string[] = [];
  let inArray = false;
  
  for (const line of lines) {
    // Handle array items
    if (line.trim().startsWith('- ') && inArray && currentKey) {
      const item = line.trim().slice(2).trim();
      // Remove quotes if present
      const cleanItem = item.replace(/^["']|["']$/g, '');
      (result[currentKey] as string[]).push(cleanItem);
      continue;
    }
    
    // Handle nested object properties (like images)
    if (line.match(/^\s+\w+:/) && currentKey) {
      continue; // Skip nested properties for now
    }
    
    // Handle key: value lines
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      // Save previous key if in array
      if (inArray && currentKey && currentValue.length > 0) {
        // Array was completed
      }
      
      currentKey = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Check if starting an array
      if (value === '' || value === '[]') {
        result[currentKey] = [];
        inArray = true;
        continue;
      }
      
      inArray = false;
      
      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Handle booleans
      if (value === 'true') {
        result[currentKey] = true;
        continue;
      }
      if (value === 'false') {
        result[currentKey] = false;
        continue;
      }
      
      result[currentKey] = value;
    }
  }
  
  return result;
}

// =============================================================================
// ISSUE DETECTION
// =============================================================================

/**
 * Find issues in frontmatter
 */
export function findFrontmatterIssues(content: string): FrontmatterIssue[] {
  const issues: FrontmatterIssue[] = [];
  
  // Check for missing frontmatter
  if (!content.startsWith('---')) {
    // Only flag if it looks like it should have frontmatter
    if (content.includes('generatedBy') || content.includes('category:')) {
      issues.push({ type: 'missing_frontmatter' });
    }
    return issues;
  }
  
  const extracted = extractFrontmatter(content);
  if (!extracted) {
    issues.push({ type: 'invalid_yaml' });
    return issues;
  }
  
  const { frontmatter } = extracted;
  
  // Check for quoted JSON arrays (common AI generation bug)
  const quotedArrayPattern = /^(\w+):\s*"\[([^\]]*)\]"$/gm;
  let match;
  while ((match = quotedArrayPattern.exec(frontmatter)) !== null) {
    const field = match[1];
    const arrayContent = match[2];
    
    // Try to parse the quoted array
    try {
      const cleanedContent = `[${arrayContent}]`.replace(/'/g, '"');
      const parsed = JSON.parse(cleanedContent);
      
      issues.push({
        type: 'quoted_array',
        field,
        originalValue: match[0],
        suggestedValue: `${field}:\n${parsed.map((s: string) => `  - "${s}"`).join('\n')}`,
      });
    } catch {
      // If we can't parse it, try a simpler fix
      const items = arrayContent.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      issues.push({
        type: 'quoted_array',
        field,
        originalValue: match[0],
        suggestedValue: `${field}:\n${items.map(s => `  - "${s}"`).join('\n')}`,
      });
    }
  }
  
  // Also check for unquoted JSON-like arrays
  const unquotedArrayPattern = /^(\w+):\s*\[([^\]]+)\]$/gm;
  while ((match = unquotedArrayPattern.exec(frontmatter)) !== null) {
    const field = match[1];
    const arrayContent = match[2];
    
    // Skip if it's already proper YAML (no commas with quotes inside)
    if (!arrayContent.includes('"') && !arrayContent.includes("'")) continue;
    
    const items = arrayContent.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    issues.push({
      type: 'quoted_array',
      field,
      originalValue: match[0],
      suggestedValue: `${field}:\n${items.map(s => `  - "${s}"`).join('\n')}`,
    });
  }
  
  // Check for missing published field
  if (!frontmatter.includes('published:')) {
    // Only add if it's an agent-generated or quality entry
    const isQualityEntry = frontmatter.includes('generatedBy') || 
                           frontmatter.includes('confidence:') ||
                           content.includes('## Overview');
    if (isQualityEntry) {
      issues.push({
        type: 'missing_published',
        field: 'published',
        suggestedValue: 'published: true',
      });
    }
  }
  
  // Check for missing detailLevel
  if (!frontmatter.includes('detailLevel:')) {
    const detailLevel = assessDetailLevel(content);
    if (detailLevel !== 'unknown') {
      issues.push({
        type: 'missing_detail_level',
        field: 'detailLevel',
        suggestedValue: `detailLevel: ${detailLevel}`,
      });
    }
  }
  
  return issues;
}

/**
 * Assess detail level of content
 */
function assessDetailLevel(content: string): 'basic' | 'moderate' | 'comprehensive' | 'unknown' {
  let score = 0;
  
  // Check for sections
  const sections = content.match(/^##\s+/gm) || [];
  score += Math.min(sections.length, 5);
  
  // Check for specific content sections
  if (/## (gear|equipment)/i.test(content)) score += 2;
  if (/## (ai cards|behavior)/i.test(content)) score += 2;
  if (/## (events|hunt events)/i.test(content)) score += 2;
  if (/## (connections|relationships)/i.test(content)) score += 1;
  
  // Content length
  if (content.length > 3000) score += 2;
  if (content.length > 6000) score += 2;
  
  // Citations
  const citations = content.match(/\[[a-z0-9-]+:\d+-?\d*\]/gi) || [];
  score += Math.min(citations.length, 3);
  
  if (score >= 12) return 'comprehensive';
  if (score >= 6) return 'moderate';
  if (score >= 2) return 'basic';
  return 'unknown';
}

// =============================================================================
// FIXING
// =============================================================================

/**
 * Fix frontmatter issues in content
 */
export function fixFrontmatter(content: string): { content: string; fixedCount: number } {
  const issues = findFrontmatterIssues(content);
  
  if (issues.length === 0) {
    return { content, fixedCount: 0 };
  }
  
  let fixedContent = content;
  let fixedCount = 0;
  
  // Handle missing frontmatter case
  const hasMissingFrontmatter = issues.some(i => i.type === 'missing_frontmatter');
  if (hasMissingFrontmatter) {
    // Can't auto-fix missing frontmatter easily
    return { content, fixedCount: 0 };
  }
  
  const extracted = extractFrontmatter(content);
  if (!extracted) {
    return { content, fixedCount: 0 };
  }
  
  let { frontmatter } = extracted;
  const { body } = extracted;
  
  // Fix quoted arrays
  for (const issue of issues.filter(i => i.type === 'quoted_array')) {
    if (issue.originalValue && issue.suggestedValue) {
      frontmatter = frontmatter.replace(issue.originalValue, issue.suggestedValue);
      fixedCount++;
    }
  }
  
  // Add missing fields at the end of frontmatter
  const fieldsToAdd: string[] = [];
  
  for (const issue of issues) {
    if (issue.type === 'missing_published' && issue.suggestedValue) {
      fieldsToAdd.push(issue.suggestedValue);
      fixedCount++;
    }
    if (issue.type === 'missing_detail_level' && issue.suggestedValue) {
      fieldsToAdd.push(issue.suggestedValue);
      fixedCount++;
    }
  }
  
  if (fieldsToAdd.length > 0) {
    frontmatter = frontmatter.trimEnd() + '\n' + fieldsToAdd.join('\n');
  }
  
  fixedContent = `---\n${frontmatter}\n---\n${body}`;
  
  return { content: fixedContent, fixedCount };
}

/**
 * Analyze a single file for frontmatter issues
 */
export function analyzeFile(filePath: string): FrontmatterFixResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = findFrontmatterIssues(content);
  
  let fixedContent: string | undefined;
  let fixedCount = 0;
  
  if (issues.length > 0) {
    const result = fixFrontmatter(content);
    fixedContent = result.content;
    fixedCount = result.fixedCount;
  }
  
  return {
    filePath,
    issues,
    fixedContent,
    fixedCount,
  };
}

/**
 * Fix frontmatter in a file and save
 */
export function fixFileFrontmatter(filePath: string): FrontmatterFixResult {
  const result = analyzeFile(filePath);
  
  if (result.fixedContent && result.fixedCount > 0) {
    fs.writeFileSync(filePath, result.fixedContent);
  }
  
  return result;
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Generate a report for all lore files
 */
export function generateFrontmatterReport(): FrontmatterReport {
  const report: FrontmatterReport = {
    totalFiles: 0,
    filesWithIssues: 0,
    totalIssues: 0,
    byType: {
      quoted_array: 0,
      missing_published: 0,
      missing_detail_level: 0,
      invalid_yaml: 0,
      missing_frontmatter: 0,
    },
    details: [],
  };
  
  const categories = [
    '01-world', '02-factions', '03-locations', '04-monsters',
    '05-characters', '06-concepts', '07-technology', '08-theories',
    '09-philosophy', '10-art', '11-community', '12-future',
  ];
  
  for (const category of categories) {
    const categoryPath = path.join(LORE_PATH, category);
    if (!fs.existsSync(categoryPath)) continue;
    
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      report.totalFiles++;
      
      const result = analyzeFile(filePath);
      
      if (result.issues.length > 0) {
        report.filesWithIssues++;
        report.totalIssues += result.issues.length;
        report.details.push(result);
        
        for (const issue of result.issues) {
          report.byType[issue.type] = (report.byType[issue.type] || 0) + 1;
        }
      }
    }
  }
  
  return report;
}

/**
 * Fix all frontmatter issues across the lore directory
 */
export function fixAllFrontmatter(): {
  filesFixed: number;
  issuesFixed: number;
  results: FrontmatterFixResult[];
} {
  const report = generateFrontmatterReport();
  let filesFixed = 0;
  let issuesFixed = 0;
  const results: FrontmatterFixResult[] = [];
  
  for (const detail of report.details) {
    if (detail.issues.length > 0) {
      const result = fixFileFrontmatter(detail.filePath);
      results.push(result);
      
      if (result.fixedCount > 0) {
        filesFixed++;
        issuesFixed += result.fixedCount;
      }
    }
  }
  
  return {
    filesFixed,
    issuesFixed,
    results,
  };
}

/**
 * Preview fixes without applying them
 */
export function previewFrontmatterFixes(): FrontmatterReport {
  return generateFrontmatterReport();
}

