/**
 * Lore Service - Centralized service for lore operations
 * Handles reading, writing, and linking between markdown files and the site
 */

import fs from 'fs';
import path from 'path';
import { LoreEntry, LoreCategory, LoreSource } from '@/types/lore';

const DOCS_PATH = path.join(process.cwd(), 'docs', 'lore');

// Directory structure mapping
export const LORE_DIRECTORIES: Record<string, { path: string; category: LoreCategory; name: string }> = {
  'world': { path: '01-world', category: 'location', name: 'World Overview' },
  'factions': { path: '02-factions', category: 'faction', name: 'Factions' },
  'locations': { path: '03-locations', category: 'location', name: 'Locations' },
  'monsters': { path: '04-monsters', category: 'monster', name: 'Monsters' },
  'characters': { path: '05-characters', category: 'character', name: 'Characters' },
  'concepts': { path: '06-concepts', category: 'concept', name: 'Concepts' },
  'technology': { path: '07-technology', category: 'technology', name: 'Technology' },
  'theories': { path: '08-theories', category: 'philosophy', name: 'Theories' },
  'philosophy': { path: '09-philosophy', category: 'philosophy', name: 'Philosophy' },
  'art': { path: '10-art', category: 'concept', name: 'Art & Aesthetics' },
  'community': { path: '11-community', category: 'concept', name: 'Community' },
  'future': { path: '12-future', category: 'concept', name: 'Future' },
};

export interface LoreLink {
  text: string;
  slug: string;
  category: string;
  exists: boolean;
}

export interface LoreFile {
  path: string;
  slug: string;
  title: string;
  category: LoreCategory;
  directory: string;
  lastModified: Date;
}

/**
 * Get all lore files in the docs directory
 */
export function getAllLoreFiles(): LoreFile[] {
  const files: LoreFile[] = [];

  if (!fs.existsSync(DOCS_PATH)) {
    return files;
  }

  Object.entries(LORE_DIRECTORIES).forEach(([key, config]) => {
    const dirPath = path.join(DOCS_PATH, config.path);
    
    if (!fs.existsSync(dirPath)) return;

    const dirFiles = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.md') && !f.startsWith('_'));

    dirFiles.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const titleMatch = content.match(/^#\s+(.+?)$/m);
      
      files.push({
        path: filePath,
        slug: file.replace('.md', '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: titleMatch ? titleMatch[1].trim() : file.replace('.md', ''),
        category: config.category,
        directory: key,
        lastModified: stats.mtime,
      });
    });
  });

  return files;
}

/**
 * Extract all internal links from markdown content
 */
export function extractLoreLinks(content: string): LoreLink[] {
  const links: LoreLink[] = [];
  const allFiles = getAllLoreFiles();
  const existingSlugs = new Set(allFiles.map(f => f.slug));

  // Match markdown links: [text](path)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const [, text, href] = match;
    
    // Only process internal links (relative paths or /lore/ paths)
    if (href.startsWith('http') || href.startsWith('#')) continue;

    // Extract slug from path
    const slug = href
      .replace(/^\.\.\//, '')
      .replace(/^\.\//, '')
      .replace(/\/_index\.md$/, '')
      .replace(/\.md$/, '')
      .split('/')
      .pop() || '';

    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Determine category from path
    let category = 'concept';
    for (const [, config] of Object.entries(LORE_DIRECTORIES)) {
      if (href.includes(config.path)) {
        category = config.category;
        break;
      }
    }

    links.push({
      text,
      slug: normalizedSlug,
      category,
      exists: existingSlugs.has(normalizedSlug),
    });
  }

  return links;
}

/**
 * Find broken links in a markdown file
 */
export function findBrokenLinks(filePath: string): LoreLink[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const links = extractLoreLinks(content);
  return links.filter(link => !link.exists);
}

/**
 * Get all entries that link to a specific slug
 */
export function getBacklinks(slug: string): LoreFile[] {
  const allFiles = getAllLoreFiles();
  const backlinks: LoreFile[] = [];

  allFiles.forEach(file => {
    const content = fs.readFileSync(file.path, 'utf-8');
    const links = extractLoreLinks(content);
    
    if (links.some(link => link.slug === slug)) {
      backlinks.push(file);
    }
  });

  return backlinks;
}

/**
 * Generate a new lore entry markdown file
 */
export function generateLoreMarkdown(entry: Partial<LoreEntry>): string {
  const title = entry.title || 'Untitled Entry';
  const category = entry.category || 'concept';
  const summary = entry.summary || '';
  const content = entry.content || '';
  const tags = entry.tags || [];
  const confidence = entry.confidence || 'speculative';

  const confidenceWarning = confidence === 'speculative' 
    ? '\n> ⚠️ **Note:** This entry contains speculation and may not be confirmed canon.\n'
    : confidence === 'likely'
    ? '\n> 📌 **Note:** This entry is based on likely interpretations but not fully confirmed.\n'
    : '';

  return `# ${title}

> *"${summary.slice(0, 100)}..."*

**Category:** ${category.charAt(0).toUpperCase() + category.slice(1)}  
**Confidence:** ${confidence.charAt(0).toUpperCase() + confidence.slice(1)}  
**Last Updated:** ${new Date().toISOString().split('T')[0]}
${confidenceWarning}
---

## Overview

${summary}

## Details

${content}

## Tags

${tags.map(t => `\`${t}\``).join(' ')}

## Sources

- Research generated entry - needs verification

---

## Related Entries

*Links to be added*

---

[← Back to Index](../README.md)
`;
}

/**
 * Save a new lore entry to the docs directory
 */
export function saveLoreEntry(
  entry: Partial<LoreEntry>,
  directory: keyof typeof LORE_DIRECTORIES
): { success: boolean; path?: string; error?: string } {
  try {
    const config = LORE_DIRECTORIES[directory];
    if (!config) {
      return { success: false, error: `Invalid directory: ${directory}` };
    }

    const dirPath = path.join(DOCS_PATH, config.path);
    
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Generate slug from title
    const slug = (entry.title || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);

    const filePath = path.join(dirPath, `${slug}.md`);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return { success: false, error: `File already exists: ${slug}.md` };
    }

    // Generate and save markdown
    const markdown = generateLoreMarkdown(entry);
    fs.writeFileSync(filePath, markdown, 'utf-8');

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get lore directory statistics
 */
export function getLoreStats(): {
  totalFiles: number;
  byCategory: Record<string, number>;
  byDirectory: Record<string, number>;
  brokenLinks: number;
  recentlyUpdated: LoreFile[];
} {
  const files = getAllLoreFiles();
  const byCategory: Record<string, number> = {};
  const byDirectory: Record<string, number> = {};
  let brokenLinks = 0;

  files.forEach(file => {
    byCategory[file.category] = (byCategory[file.category] || 0) + 1;
    byDirectory[file.directory] = (byDirectory[file.directory] || 0) + 1;
    brokenLinks += findBrokenLinks(file.path).length;
  });

  // Get recently updated (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const recentlyUpdated = files
    .filter(f => f.lastModified > weekAgo)
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
    .slice(0, 10);

  return {
    totalFiles: files.length,
    byCategory,
    byDirectory,
    brokenLinks,
    recentlyUpdated,
  };
}

/**
 * Search lore files by content
 */
export function searchLoreFiles(query: string): LoreFile[] {
  const files = getAllLoreFiles();
  const lowerQuery = query.toLowerCase();

  return files.filter(file => {
    const content = fs.readFileSync(file.path, 'utf-8').toLowerCase();
    return (
      file.title.toLowerCase().includes(lowerQuery) ||
      file.slug.includes(lowerQuery) ||
      content.includes(lowerQuery)
    );
  });
}

