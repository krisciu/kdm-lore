import fs from 'fs';
import path from 'path';
import { LoreEntry, LoreCategory, LoreSource } from '@/types/lore';

const DOCS_PATH = path.join(process.cwd(), 'docs', 'lore');

// Map directory names to categories
const DIRECTORY_TO_CATEGORY: Record<string, LoreCategory> = {
  '01-world': 'location',
  '02-factions': 'faction',
  '03-locations': 'location',
  '04-monsters': 'monster',
  '05-characters': 'character',
  '06-concepts': 'concept',
  '07-technology': 'technology',
  '08-theories': 'philosophy',
  '09-philosophy': 'philosophy',
  '10-art': 'concept',
  '11-community': 'concept',
  '12-future': 'concept',
};

interface MarkdownFrontmatter {
  title?: string;
  category?: string;
  type?: string;
  difficulty?: string;
  expansion?: string;
  status?: string;
  release?: string;
  alignment?: string;
  source?: string;
  // Quality/publishing fields
  generatedBy?: string;
  published?: string;
  confidence?: string;
}

// ParsedMarkdown interface - for future use with full document parsing
// interface ParsedMarkdown {
//   frontmatter: MarkdownFrontmatter;
//   content: string;
//   quotes: string[];
//   summary: string;
// }

/**
 * Parse frontmatter from markdown content
 * Supports both YAML frontmatter (---) and inline metadata (**Key:** Value)
 */
function parseFrontmatter(content: string): { frontmatter: MarkdownFrontmatter; body: string } {
  const frontmatter: MarkdownFrontmatter = {};
  let body = content;

  // First, try to parse YAML frontmatter (between --- delimiters)
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (yamlMatch) {
    const yamlContent = yamlMatch[1];
    body = yamlMatch[2];
    
    // Simple YAML parsing for our frontmatter fields
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      // Skip array items and complex structures
      if (line.trim().startsWith('-') || line.trim().startsWith('{')) continue;
      
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Map YAML keys to our frontmatter structure
        if (key && value) {
          (frontmatter as Record<string, string>)[key] = value;
        }
      }
    }
  }

  // Extract title from first H1 if not in frontmatter
  if (!frontmatter.title) {
    const titleMatch = body.match(/^#\s+(.+?)$/m);
    if (titleMatch) {
      frontmatter.title = titleMatch[1].trim();
    }
  }

  // Extract inline metadata (like **Category:** Monster) as fallback
  const metadataPatterns = [
    { key: 'category', pattern: /\*\*Category:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'type', pattern: /\*\*Type:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'difficulty', pattern: /\*\*Difficulty:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'expansion', pattern: /\*\*Expansion:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'status', pattern: /\*\*Status:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'release', pattern: /\*\*Release:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'alignment', pattern: /\*\*Alignment:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
    { key: 'source', pattern: /\*\*Source:\*\*\s*(.+?)(?:\s{2,}|\n|$)/i },
  ];

  metadataPatterns.forEach(({ key, pattern }) => {
    // Only use inline metadata if not already in YAML frontmatter
    if (!(frontmatter as Record<string, string>)[key]) {
      const match = body.match(pattern);
      if (match) {
        (frontmatter as Record<string, string>)[key] = match[1].trim();
      }
    }
  });

  return { frontmatter, body };
}

/**
 * Extract quotes from markdown content
 */
function extractQuotes(content: string): string[] {
  const quotes: string[] = [];
  
  // Match blockquotes that look like character quotes
  const quotePattern = />\s*\*"(.+?)"\*/g;
  let match;
  
  while ((match = quotePattern.exec(content)) !== null) {
    quotes.push(`"${match[1]}"`);
  }

  // Also match regular blockquotes under ## Quotes section
  const quotesSection = content.match(/## Quotes\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (quotesSection) {
    const sectionQuotes = quotesSection[1].match(/>\s*\*"(.+?)"\*/g);
    if (sectionQuotes) {
      sectionQuotes.forEach(q => {
        const cleaned = q.replace(/>\s*\*"/, '"').replace(/"\*/, '"');
        if (!quotes.includes(cleaned)) {
          quotes.push(cleaned);
        }
      });
    }
  }

  return quotes;
}

/**
 * Extract the first meaningful paragraph as summary
 */
function extractSummary(content: string): string {
  // Look for Overview section first
  const overviewMatch = content.match(/## Overview\s*\n\n([^\n]+)/);
  if (overviewMatch) {
    return overviewMatch[1].trim().slice(0, 300);
  }

  // Otherwise find first paragraph after title
  const paragraphMatch = content.match(/^#[^\n]+\n+(?:>[^\n]+\n+)?(?:\*\*[^\n]+\n+)*\n*([^\n]+)/);
  if (paragraphMatch) {
    return paragraphMatch[1].trim().slice(0, 300);
  }

  return '';
}

/**
 * Extract sources/citations from markdown
 */
function extractSources(content: string): LoreSource[] {
  const sources: LoreSource[] = [];
  
  // Match source section
  const sourcesSection = content.match(/## Sources?\s*\n([\s\S]*?)(?=\n---|\n##|$)/i);
  if (sourcesSection) {
    const lines = sourcesSection[1].split('\n');
    lines.forEach(line => {
      // Match patterns like "- [80-85] Kingdom Death: Monster Core Game Rulebook"
      const sourceMatch = line.match(/-\s*(?:\[[\d-]+\])?\s*(.+?)(?:,\s*pp?\.\s*([\d-]+))?$/);
      if (sourceMatch) {
        sources.push({
          name: sourceMatch[1].trim(),
          type: sourceMatch[1].toLowerCase().includes('community') ? 'community' : 'rulebook',
          page: sourceMatch[2],
          verified: !sourceMatch[1].toLowerCase().includes('speculation'),
        });
      }
    });
  }

  // If no sources found, add a default
  if (sources.length === 0) {
    sources.push({
      name: 'Community Research',
      type: 'community',
      verified: false,
    });
  }

  return sources;
}

/**
 * Extract tags from content
 */
function extractTags(content: string, frontmatter: MarkdownFrontmatter): string[] {
  const tags: string[] = [];

  // Add category-based tags
  if (frontmatter.category) {
    tags.push(frontmatter.category.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }
  if (frontmatter.type) {
    tags.push(frontmatter.type.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  }
  if (frontmatter.expansion) {
    tags.push(frontmatter.expansion.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'));
  }
  if (frontmatter.difficulty) {
    tags.push(frontmatter.difficulty.toLowerCase());
  }

  // Extract keywords from section headers
  const headers = content.match(/^##\s+(.+)$/gm);
  if (headers) {
    headers.forEach(h => {
      const header = h.replace(/^##\s+/, '').toLowerCase();
      if (!['overview', 'sources', 'related entries', 'quotes'].includes(header)) {
        tags.push(header.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'));
      }
    });
  }

  return [...new Set(tags)].slice(0, 10); // Dedupe and limit
}

/**
 * Check if an entry is high enough quality to show in the compendium
 */
function isPublishableEntry(content: string, frontmatter: MarkdownFrontmatter, summary: string): boolean {
  // Skip if explicitly marked as unpublished
  if (frontmatter.published === 'false') return false;
  
  // Explicitly published entries are always shown
  if (frontmatter.published === 'true') return true;
  
  // Agent-generated entries are quality checked
  if (frontmatter.generatedBy === 'agent') return true;
  
  // Skip if explicitly marked as draft, product, or research-notes
  if (frontmatter.status === 'draft' || frontmatter.status === 'product' || 
      frontmatter.type === 'research-notes') return false;
  
  // Skip generic "Lore entry for X" summaries (auto-generated stubs)
  if (summary.startsWith('Lore entry for ')) return false;
  
  // Skip product listings (check for product-specific content)
  const productIndicators = [
    'packaged in a',
    'includes:',
    'x Hard plastic',
    'x Gear Cards',
    'x AI cards',
    'Art:',
    'Sculpture:',
    'Limit 1 per customer',
    'Limit 2 per customer',
    'First Run Collector',
    'Deathgrey edition',
    'This entry was extracted from official Kingdom Death product descriptions',
  ];
  
  const lowerContent = content.toLowerCase();
  const productMatches = productIndicators.filter(indicator => 
    lowerContent.includes(indicator.toLowerCase())
  ).length;
  
  // If it has 3+ product indicators, it's probably a product page
  if (productMatches >= 3) return false;
  
  // Check for quality content indicators
  const hasOverview = content.includes('## Overview');
  const hasSubstantialContent = content.length > 1500;
  const hasLoreSection = content.includes('## Lore') || content.includes('## History') || 
                         content.includes('## Behavior') || content.includes('## Significance');
  
  // If it has good structure and content, show it
  if (hasOverview && hasSubstantialContent) return true;
  if (hasLoreSection) return true;
  
  // Default: don't show uncertain entries
  return false;
}

/**
 * Parse a markdown file into a LoreEntry
 */
export function parseMarkdownFile(filePath: string, category: LoreCategory): LoreEntry | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    // Skip index files
    if (filePath.endsWith('_index.md')) {
      return null;
    }

    const title = frontmatter.title || path.basename(filePath, '.md').replace(/-/g, ' ');
    const slug = path.basename(filePath, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const quotes = extractQuotes(content);
    const summary = extractSummary(content);
    const sources = extractSources(content);
    const tags = extractTags(content, frontmatter);
    
    // Filter out low-quality entries
    if (!isPublishableEntry(content, frontmatter, summary)) {
      return null;
    }

    // Determine monster type if applicable
    let monsterType: LoreEntry['monsterType'];
    if (category === 'monster' && frontmatter.category) {
      const typeStr = frontmatter.category.toLowerCase();
      if (typeStr.includes('quarry')) monsterType = 'quarry';
      else if (typeStr.includes('nemesis')) monsterType = 'nemesis';
      else if (typeStr.includes('unique')) monsterType = 'unique';
      else if (typeStr.includes('legendary')) monsterType = 'legendary';
    }

    // Determine confidence
    let confidence: LoreEntry['confidence'] = 'confirmed';
    if (content.toLowerCase().includes('speculation') || content.toLowerCase().includes('theory')) {
      confidence = 'speculative';
    } else if (content.toLowerCase().includes('likely') || content.toLowerCase().includes('may be')) {
      confidence = 'likely';
    }

    const entry: LoreEntry = {
      id: slug,
      slug,
      title: title.replace(/^The\s+/i, '').trim() || title,
      category,
      summary: summary || `Lore entry for ${title}`,
      content: body,
      quotes: quotes.length > 0 ? quotes : undefined,
      tags,
      sources,
      monsterType,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      confidence,
    };

    return entry;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all lore entries from the docs directory
 */
export function loadLoreFromDocs(): LoreEntry[] {
  const entries: LoreEntry[] = [];

  if (!fs.existsSync(DOCS_PATH)) {
    console.warn('Docs path does not exist:', DOCS_PATH);
    return entries;
  }

  const directories = fs.readdirSync(DOCS_PATH, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'));

  directories.forEach(dir => {
    const dirPath = path.join(DOCS_PATH, dir.name);
    const category = DIRECTORY_TO_CATEGORY[dir.name] || 'concept';

    // Get all markdown files in this directory
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.md') && !f.startsWith('_'));

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const entry = parseMarkdownFile(filePath, category);
      if (entry) {
        entries.push(entry);
      }
    });
  });

  return entries;
}

/**
 * Get category counts from loaded entries
 */
export function getCategoryCounts(entries: LoreEntry[]): Record<LoreCategory, number> {
  const counts: Record<string, number> = {};
  
  entries.forEach(entry => {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
  });

  return counts as Record<LoreCategory, number>;
}

