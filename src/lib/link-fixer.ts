/**
 * Link Fixer - Detects and fixes broken links in lore entries
 * 
 * Handles:
 * - Wiki-style [[Entity Name]] links -> [Entity Name](./entity-name.md)
 * - Bare [Entity Name] links without paths
 * - Invalid paths to non-existent files
 * - Relative path corrections
 */

import fs from 'fs';
import path from 'path';

const LORE_PATH = path.join(process.cwd(), 'docs', 'lore');

// =============================================================================
// TYPES
// =============================================================================

export interface BrokenLink {
  original: string;
  line: number;
  type: 'wiki_style' | 'bare_bracket' | 'invalid_path' | 'missing_file';
  suggestedFix?: string;
}

export interface LinkFixResult {
  filePath: string;
  brokenLinks: BrokenLink[];
  fixedContent?: string;
  fixedCount: number;
}

export interface LinkValidationReport {
  totalFiles: number;
  filesWithIssues: number;
  totalBrokenLinks: number;
  byType: Record<string, number>;
  details: LinkFixResult[];
}

// =============================================================================
// KNOWN ENTITIES MAP
// =============================================================================

/**
 * Build a map of known entity names to their file paths
 */
export function buildEntityMap(): Map<string, string> {
  const map = new Map<string, string>();
  
  const categories = [
    { dir: '01-world', prefix: '../01-world' },
    { dir: '02-factions', prefix: '../02-factions' },
    { dir: '03-locations', prefix: '../03-locations' },
    { dir: '04-monsters', prefix: '../04-monsters' },
    { dir: '05-characters', prefix: '../05-characters' },
    { dir: '06-concepts', prefix: '../06-concepts' },
    { dir: '07-technology', prefix: '../07-technology' },
    { dir: '08-theories', prefix: '../08-theories' },
    { dir: '09-philosophy', prefix: '../09-philosophy' },
    { dir: '10-art', prefix: '../10-art' },
  ];
  
  for (const { dir, prefix } of categories) {
    const dirPath = path.join(LORE_PATH, dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract title from content
      const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/title:\s*"?([^"\n]+)"?/);
      const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '').replace(/-/g, ' ');
      
      // Add multiple variations
      const slug = file.replace('.md', '');
      const relativePath = `${prefix}/${file}`;
      
      // Title as-is
      map.set(title.toLowerCase(), relativePath);
      
      // Title without "The "
      if (title.toLowerCase().startsWith('the ')) {
        map.set(title.slice(4).toLowerCase(), relativePath);
      }
      
      // Slug form
      map.set(slug.toLowerCase(), relativePath);
      
      // Space-separated slug
      map.set(slug.replace(/-/g, ' ').toLowerCase(), relativePath);
    }
  }
  
  return map;
}

// =============================================================================
// LINK DETECTION
// =============================================================================

/**
 * Find all broken links in content
 */
export function findBrokenLinks(content: string, filePath: string): BrokenLink[] {
  const broken: BrokenLink[] = [];
  const lines = content.split('\n');
  const entityMap = buildEntityMap();
  const currentDir = path.dirname(filePath);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // 1. Wiki-style links [[Entity Name]]
    const wikiLinks = line.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of wikiLinks) {
      const entityName = match[1];
      const targetPath = findEntityPath(entityName, entityMap, currentDir);
      
      broken.push({
        original: match[0],
        line: lineNum,
        type: 'wiki_style',
        suggestedFix: targetPath 
          ? `[${entityName}](${targetPath})`
          : `[${entityName}](#)`,
      });
    }
    
    // 2. Bare brackets [Entity Name] without (path)
    // But skip valid markdown patterns
    const bareBrackets = line.matchAll(/\[([^\]]+)\](?!\()/g);
    for (const match of bareBrackets) {
      const text = match[1];
      
      // Skip valid markdown patterns
      if (text.length <= 2) continue;                    // [x], [1], etc.
      if (/^\d+$/.test(text)) continue;                  // [123]
      if (/^[x\s]$/.test(text)) continue;                // Checkboxes
      if (text.startsWith('!')) continue;                // Image alt text
      if (line.includes(`[${text}]:`)) continue;         // Reference definitions
      
      // Check if this looks like an entity reference
      const targetPath = findEntityPath(text, entityMap, currentDir);
      
      if (targetPath || looksLikeEntityName(text)) {
        broken.push({
          original: match[0],
          line: lineNum,
          type: 'bare_bracket',
          suggestedFix: targetPath 
            ? `[${text}](${targetPath})`
            : `[${text}](#)`,
        });
      }
    }
    
    // 3. Links with paths that don't exist
    const pathLinks = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of pathLinks) {
      const linkText = match[1];
      const linkPath = match[2];
      
      // Skip external links and anchors
      if (linkPath.startsWith('http') || linkPath.startsWith('#') || linkPath.startsWith('mailto:')) {
        continue;
      }
      
      // Resolve the path
      const resolvedPath = path.resolve(currentDir, linkPath);
      
      if (!fs.existsSync(resolvedPath)) {
        // Try to find the correct path
        const correctPath = findEntityPath(linkText, entityMap, currentDir);
        
        broken.push({
          original: match[0],
          line: lineNum,
          type: 'missing_file',
          suggestedFix: correctPath 
            ? `[${linkText}](${correctPath})`
            : undefined,
        });
      }
    }
  }
  
  return broken;
}

/**
 * Check if text looks like an entity name
 */
function looksLikeEntityName(text: string): boolean {
  // Entity names typically:
  // - Start with capital letter
  // - Are 2+ words or proper nouns
  // - Don't contain special characters (except spaces, hyphens, apostrophes)
  
  if (!/^[A-Z]/.test(text)) return false;
  if (/[<>{}[\]|\\]/.test(text)) return false;
  if (text.length < 3 || text.length > 50) return false;
  
  // Known entity patterns
  const entityPatterns = [
    /^The\s+\w+/,           // The Butcher, The Hand
    /\w+\s+Knight$/,        // Lion Knight, Flower Knight
    /\w+\s+King$/,          // Dragon King
    /\w+\s+Order$/,         // Twilight Order
    /\w+'s\s+Chest$/,       // Gambler's Chest
    /^[A-Z][a-z]+$/,        // Gorm, Phoenix
  ];
  
  return entityPatterns.some(p => p.test(text)) || text.includes(' ');
}

/**
 * Find the correct path for an entity
 */
function findEntityPath(entityName: string, entityMap: Map<string, string>, _currentDir: string): string | null {
  const key = entityName.toLowerCase().trim();
  
  // Direct match
  if (entityMap.has(key)) {
    return entityMap.get(key)!;
  }
  
  // Try variations
  const variations = [
    key,
    key.replace(/^the\s+/, ''),           // Remove "The "
    key.replace(/\s+/g, '-'),              // Space to hyphen
    key.replace(/-/g, ' '),                // Hyphen to space
    key.replace(/['']/g, ''),              // Remove apostrophes
    key.replace(/expansion$/i, '').trim(), // Remove "Expansion"
  ];
  
  for (const variant of variations) {
    if (entityMap.has(variant)) {
      return entityMap.get(variant)!;
    }
  }
  
  return null;
}

// =============================================================================
// LINK FIXING
// =============================================================================

/**
 * Fix all broken links in content
 */
export function fixBrokenLinks(content: string, filePath: string): { content: string; fixedCount: number } {
  const brokenLinks = findBrokenLinks(content, filePath);
  let fixedContent = content;
  let fixedCount = 0;
  
  // Sort by position (reverse order to maintain indices)
  const sortedLinks = [...brokenLinks].sort((a, b) => b.line - a.line);
  
  for (const link of sortedLinks) {
    if (!link.suggestedFix) continue;
    
    // Replace the original with the fix
    const escaped = link.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    
    const before = fixedContent;
    fixedContent = fixedContent.replace(regex, link.suggestedFix);
    
    if (before !== fixedContent) {
      fixedCount++;
    }
  }
  
  return { content: fixedContent, fixedCount };
}

/**
 * Analyze a single file for broken links
 */
export function analyzeFile(filePath: string): LinkFixResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const brokenLinks = findBrokenLinks(content, filePath);
  
  let fixedContent: string | undefined;
  let fixedCount = 0;
  
  if (brokenLinks.length > 0) {
    const result = fixBrokenLinks(content, filePath);
    fixedContent = result.content;
    fixedCount = result.fixedCount;
  }
  
  return {
    filePath,
    brokenLinks,
    fixedContent,
    fixedCount,
  };
}

/**
 * Fix links in a file and save
 */
export function fixFileLinks(filePath: string): LinkFixResult {
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
 * Generate a validation report for all lore files
 */
export function generateValidationReport(): LinkValidationReport {
  const report: LinkValidationReport = {
    totalFiles: 0,
    filesWithIssues: 0,
    totalBrokenLinks: 0,
    byType: {
      wiki_style: 0,
      bare_bracket: 0,
      invalid_path: 0,
      missing_file: 0,
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
      
      if (result.brokenLinks.length > 0) {
        report.filesWithIssues++;
        report.totalBrokenLinks += result.brokenLinks.length;
        report.details.push(result);
        
        for (const link of result.brokenLinks) {
          report.byType[link.type] = (report.byType[link.type] || 0) + 1;
        }
      }
    }
  }
  
  return report;
}

/**
 * Fix all broken links across the entire lore directory
 */
export function fixAllLinks(): {
  filesFixed: number;
  linksFixed: number;
  results: LinkFixResult[];
} {
  const report = generateValidationReport();
  let filesFixed = 0;
  let linksFixed = 0;
  const results: LinkFixResult[] = [];
  
  for (const detail of report.details) {
    if (detail.brokenLinks.length > 0) {
      const result = fixFileLinks(detail.filePath);
      results.push(result);
      
      if (result.fixedCount > 0) {
        filesFixed++;
        linksFixed += result.fixedCount;
      }
    }
  }
  
  return {
    filesFixed,
    linksFixed,
    results,
  };
}

/**
 * Preview fixes without applying them
 */
export function previewFixes(): LinkValidationReport {
  return generateValidationReport();
}

