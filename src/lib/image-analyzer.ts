/**
 * Image Analyzer - Claude Vision integration for image matching and description
 * Finds relevant images for entities and generates captions
 */

import fs from 'fs';
import path from 'path';
import { loadConfig } from './agent-core';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

// =============================================================================
// TYPES
// =============================================================================

export interface ImageFile {
  path: string;
  relativePath: string;
  filename: string;
  directory: string;
  type: 'shop' | 'newsletter' | 'artwork' | 'miniature' | 'card';
}

export interface MatchedImage {
  path: string;
  relativePath: string;
  caption: string;
  confidence: number;
  description?: string;
}

export interface ImageAnalysis {
  description: string;
  subjects: string[];
  loreRelevance: string;
  suggestedCaption: string;
}

// =============================================================================
// IMAGE DISCOVERY
// =============================================================================

/**
 * Get all available images from source directories
 */
export function getAllImages(): ImageFile[] {
  const config = loadConfig();
  const images: ImageFile[] = [];
  
  for (const dir of config.sources.imageDirectories) {
    const fullPath = path.join(SOURCES_PATH, dir);
    if (fs.existsSync(fullPath)) {
      scanImagesInDirectory(fullPath, dir, images);
    }
  }
  
  return images;
}

function scanImagesInDirectory(
  dirPath: string, 
  relativeBase: string, 
  results: ImageFile[]
): void {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      scanImagesInDirectory(itemPath, path.join(relativeBase, item), results);
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(item)) {
      const relativePath = path.join(relativeBase, item);
      
      // Determine image type from path
      let type: ImageFile['type'] = 'artwork';
      if (relativeBase.includes('shop')) type = 'shop';
      else if (relativeBase.includes('newsletter')) type = 'newsletter';
      else if (relativeBase.includes('miniature')) type = 'miniature';
      else if (relativeBase.includes('card')) type = 'card';
      
      results.push({
        path: itemPath,
        relativePath,
        filename: item,
        directory: relativeBase,
        type,
      });
    }
  }
}

// =============================================================================
// IMAGE MATCHING
// =============================================================================

/**
 * Find images that might be relevant to an entity by filename matching
 */
export function findImagesByName(entityName: string): ImageFile[] {
  const images = getAllImages();
  const searchTerms = generateSearchTerms(entityName);
  
  return images.filter(img => {
    const lowerFilename = img.filename.toLowerCase();
    return searchTerms.some(term => lowerFilename.includes(term));
  });
}

/**
 * Generate search terms from entity name
 */
function generateSearchTerms(entityName: string): string[] {
  const terms: string[] = [];
  const lower = entityName.toLowerCase();
  
  // Full name with different separators
  terms.push(lower.replace(/\s+/g, '-'));
  terms.push(lower.replace(/\s+/g, '_'));
  terms.push(lower.replace(/\s+/g, ''));
  
  // Individual significant words
  const words = lower.split(/\s+/).filter(w => w.length > 3);
  terms.push(...words);
  
  // Handle common patterns
  if (lower.includes('expansion')) {
    terms.push(lower.replace(/\s*expansion\s*/i, ''));
  }
  
  // Common monster name mappings
  const mappings: Record<string, string[]> = {
    'white lion': ['lion', 'whitelion'],
    'screaming antelope': ['antelope', 'screamingantelope'],
    'phoenix': ['phoenix'],
    'butcher': ['butcher'],
    'kings man': ['kingsman', 'kings-man'],
    'gold smoke knight': ['gsk', 'goldsmoke'],
    'dragon king': ['dragonking', 'dragon'],
    'dung beetle knight': ['dungbeetle', 'dbk'],
    'flower knight': ['flowerknight', 'flower'],
    'lion knight': ['lionknight'],
    'gorm': ['gorm'],
    'spidicules': ['spidicules', 'spider'],
    'sunstalker': ['sunstalker', 'sun'],
    'slenderman': ['slenderman', 'slender'],
    'manhunter': ['manhunter'],
    'lonely tree': ['lonelytree', 'tree'],
    'lion god': ['liongod'],
    'gamblers chest': ['gamblers', 'gce', 'gambler'],
    'crimson crocodile': ['crocodile', 'crimson'],
    'smog singers': ['smog', 'singers'],
  };
  
  for (const [key, values] of Object.entries(mappings)) {
    if (lower.includes(key)) {
      terms.push(...values);
    }
  }
  
  return [...new Set(terms)];
}

/**
 * Score how well an image matches an entity
 */
export function scoreImageMatch(image: ImageFile, entityName: string): number {
  const searchTerms = generateSearchTerms(entityName);
  const lowerFilename = image.filename.toLowerCase();
  
  let score = 0;
  
  // Exact name match in filename
  if (lowerFilename.includes(entityName.toLowerCase().replace(/\s+/g, '-'))) {
    score += 10;
  }
  
  // Term matches
  for (const term of searchTerms) {
    if (lowerFilename.includes(term)) {
      score += term.length > 5 ? 3 : 1;
    }
  }
  
  // Bonus for certain image types
  if (image.type === 'shop') score += 2;
  if (image.type === 'artwork') score += 1;
  
  // Bonus for larger images (usually more detailed)
  if (lowerFilename.includes('1024x1024')) score += 1;
  
  return score;
}

/**
 * Get best matching images for an entity
 */
export function getBestImagesForEntity(
  entityName: string, 
  limit: number = 5
): ImageFile[] {
  const candidates = findImagesByName(entityName);
  
  return candidates
    .map(img => ({ img, score: scoreImageMatch(img, entityName) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ img }) => img);
}

// =============================================================================
// CLAUDE VISION ANALYSIS
// =============================================================================

/**
 * Analyze an image using Claude Vision
 */
export async function analyzeImageWithVision(
  imagePath: string,
  entityContext: string,
  apiKey: string
): Promise<ImageAnalysis | null> {
  try {
    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine media type
    const ext = path.extname(imagePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
    
    const prompt = `Analyze this Kingdom Death: Monster image in the context of: "${entityContext}"

Provide:
1. A brief description of what's shown (1-2 sentences)
2. Key subjects/elements visible
3. How it relates to Kingdom Death lore
4. A suggested caption for use in a lore compendium

Respond in JSON format:
{
  "description": "What the image shows",
  "subjects": ["subject1", "subject2"],
  "loreRelevance": "How it connects to KD:M lore",
  "suggestedCaption": "Brief caption for the image"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.error('Claude Vision API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.content[0].text;
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ImageAnalysis;
    }
    
    return null;
  } catch (error) {
    console.error('Image analysis error:', error);
    return null;
  }
}

/**
 * Match and analyze images for an entity
 */
export async function matchImagesForEntity(
  entityName: string,
  entityBrief: string,
  apiKey?: string,
  analyzeWithVision: boolean = false
): Promise<MatchedImage[]> {
  const candidates = getBestImagesForEntity(entityName);
  const matched: MatchedImage[] = [];
  
  for (const image of candidates) {
    const score = scoreImageMatch(image, entityName);
    
    let caption = generateDefaultCaption(image, entityName);
    let description: string | undefined;
    
    // Optionally analyze with Vision API
    if (analyzeWithVision && apiKey && score >= 5) {
      const analysis = await analyzeImageWithVision(
        image.path,
        `${entityName}: ${entityBrief}`,
        apiKey
      );
      
      if (analysis) {
        caption = analysis.suggestedCaption;
        description = analysis.description;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    matched.push({
      path: image.path,
      relativePath: image.relativePath,
      caption,
      confidence: Math.min(score / 10, 1),
      description,
    });
  }
  
  return matched;
}

/**
 * Generate a default caption based on image metadata
 */
function generateDefaultCaption(image: ImageFile, entityName: string): string {
  const typeDescriptions: Record<ImageFile['type'], string> = {
    shop: 'Product image',
    newsletter: 'Newsletter image',
    artwork: 'Artwork',
    miniature: 'Miniature',
    card: 'Card artwork',
  };
  
  const typeDesc = typeDescriptions[image.type] || 'Image';
  return `${entityName} - ${typeDesc}`;
}

// =============================================================================
// IMAGE INDEX MANAGEMENT
// =============================================================================

const IMAGE_INDEX_FILE = path.join(process.cwd(), 'data', 'image-index.json');

interface ImageIndex {
  lastUpdated: string;
  totalImages: number;
  byEntity: Record<string, MatchedImage[]>;
}

export function loadImageIndex(): ImageIndex {
  if (fs.existsSync(IMAGE_INDEX_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(IMAGE_INDEX_FILE, 'utf-8'));
    } catch {
      // Return empty
    }
  }
  return {
    lastUpdated: new Date().toISOString(),
    totalImages: 0,
    byEntity: {},
  };
}

export function saveImageIndex(index: ImageIndex): void {
  const dataDir = path.dirname(IMAGE_INDEX_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  index.lastUpdated = new Date().toISOString();
  fs.writeFileSync(IMAGE_INDEX_FILE, JSON.stringify(index, null, 2));
}

export function addEntityImages(entityName: string, images: MatchedImage[]): void {
  const index = loadImageIndex();
  index.byEntity[entityName.toLowerCase()] = images;
  index.totalImages = Object.values(index.byEntity).flat().length;
  saveImageIndex(index);
}

export function getEntityImages(entityName: string): MatchedImage[] {
  const index = loadImageIndex();
  return index.byEntity[entityName.toLowerCase()] || [];
}

// =============================================================================
// STATISTICS
// =============================================================================

export function getImageStats(): {
  totalImages: number;
  byType: Record<string, number>;
  byDirectory: Record<string, number>;
  indexedEntities: number;
} {
  const allImages = getAllImages();
  const index = loadImageIndex();
  
  const byType: Record<string, number> = {};
  const byDirectory: Record<string, number> = {};
  
  for (const img of allImages) {
    byType[img.type] = (byType[img.type] || 0) + 1;
    byDirectory[img.directory] = (byDirectory[img.directory] || 0) + 1;
  }
  
  return {
    totalImages: allImages.length,
    byType,
    byDirectory,
    indexedEntities: Object.keys(index.byEntity).length,
  };
}

