/**
 * OCR Processing Utility for Kingdom Death Lore Images
 * 
 * Uses Tesseract.js for optical character recognition
 * Optimized for extracting text from:
 * - Newsletter banners and headers
 * - Rulebook pages
 * - Card text
 * - Story event illustrations with text
 */

import fs from 'fs';
import path from 'path';

// OCR Result interface
export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  processingTime: number;
  imagePath: string;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OCRWord[];
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCROptions {
  language?: string;
  psm?: number; // Page segmentation mode
  oem?: number; // OCR Engine mode
  preserveInterwordSpaces?: boolean;
  minConfidence?: number;
}

// Default OCR options optimized for KDM content
const DEFAULT_OPTIONS: OCROptions = {
  language: 'eng',
  psm: 3, // Fully automatic page segmentation
  oem: 3, // Default (best available)
  preserveInterwordSpaces: true,
  minConfidence: 60,
};

/**
 * OCR Processing Queue for batch operations
 */
export class OCRQueue {
  private queue: Array<{ imagePath: string; options?: OCROptions; resolve: (result: OCRResult) => void; reject: (error: Error) => void }> = [];
  private processing = false;
  private concurrency = 2;
  private activeJobs = 0;

  async add(imagePath: string, options?: OCROptions): Promise<OCRResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ imagePath, options, resolve, reject });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.activeJobs >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeJobs++;

    try {
      const result = await processImage(job.imagePath, job.options);
      job.resolve(result);
    } catch (error) {
      job.reject(error as Error);
    } finally {
      this.activeJobs--;
      this.processNext();
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.activeJobs;
  }
}

/**
 * Process a single image with OCR
 * Note: Actual Tesseract processing requires tesseract.js to be installed
 * This provides the interface and will work once the package is added
 */
export async function processImage(imagePath: string, options: OCROptions = {}): Promise<OCRResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Verify file exists
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  // For now, return a placeholder result
  // When tesseract.js is installed, this will be replaced with actual OCR
  console.log(`[OCR] Processing: ${imagePath}`);
  
  // Placeholder implementation - to be replaced with actual Tesseract.js
  const result: OCRResult = {
    text: `[OCR Placeholder - Install tesseract.js for actual processing]\nImage: ${path.basename(imagePath)}`,
    confidence: 0,
    words: [],
    lines: [],
    processingTime: Date.now() - startTime,
    imagePath,
  };

  return result;
}

/**
 * Process multiple images in batch
 */
export async function processBatch(
  imagePaths: string[],
  options: OCROptions = {},
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<Map<string, OCRResult>> {
  const results = new Map<string, OCRResult>();
  const queue = new OCRQueue();

  const promises = imagePaths.map(async (imagePath, index) => {
    const result = await queue.add(imagePath, options);
    results.set(imagePath, result);
    onProgress?.(index + 1, imagePaths.length, imagePath);
    return result;
  });

  await Promise.all(promises);
  return results;
}

/**
 * Extract text regions likely to contain lore content
 * Filters out UI elements, watermarks, etc.
 */
export function extractLoreText(result: OCRResult): string {
  if (!result.lines.length) {
    return result.text;
  }

  // Filter lines by confidence and content
  const loreLines = result.lines
    .filter(line => {
      // Skip low confidence lines
      if (line.confidence < (DEFAULT_OPTIONS.minConfidence || 60)) {
        return false;
      }
      
      // Skip lines that look like UI elements
      const text = line.text.toLowerCase();
      if (text.includes('copyright') || 
          text.includes('©') || 
          text.includes('all rights reserved') ||
          text.includes('kingdom death') && text.length < 20) {
        return false;
      }
      
      return true;
    })
    .map(line => line.text);

  return loreLines.join('\n');
}

/**
 * Clean and format OCR text for lore entries
 */
export function cleanOCRText(text: string): string {
  let cleaned = text;
  
  // Fix common OCR errors
  const corrections: [RegExp, string][] = [
    [/\bl\b/g, 'I'], // lowercase L to uppercase I in isolation
    [/\bIl\b/g, 'II'], // Il to II (Roman numerals)
    [/\bIII\b/g, 'III'], // Ensure III stays
    [/0(?=[a-zA-Z])/g, 'O'], // 0 before letters to O
    [/(?<=[a-zA-Z])0/g, 'O'], // 0 after letters to O
    [/\brn\b/g, 'm'], // rn to m
    [/\bvv\b/g, 'w'], // vv to w
    [/\s+/g, ' '], // Multiple spaces to single
    [/^\s+|\s+$/gm, ''], // Trim lines
  ];
  
  corrections.forEach(([pattern, replacement]) => {
    cleaned = cleaned.replace(pattern, replacement);
  });
  
  // Remove empty lines
  cleaned = cleaned
    .split('\n')
    .filter(line => line.trim())
    .join('\n');
  
  return cleaned;
}

/**
 * Detect image type for optimal OCR settings
 */
export function detectImageType(imagePath: string): 'newsletter' | 'rulebook' | 'card' | 'art' | 'unknown' {
  const filename = path.basename(imagePath).toLowerCase();
  const dir = path.dirname(imagePath).toLowerCase();
  
  if (filename.includes('kdu') || filename.includes('newsletter') || dir.includes('news')) {
    return 'newsletter';
  }
  
  if (filename.includes('rule') || filename.includes('page') || dir.includes('rulebook')) {
    return 'rulebook';
  }
  
  if (filename.includes('card') || filename.includes('gear') || filename.includes('ai')) {
    return 'card';
  }
  
  if (filename.includes('art') || filename.includes('illustration')) {
    return 'art';
  }
  
  return 'unknown';
}

/**
 * Get optimal OCR options for image type
 */
export function getOptionsForImageType(imageType: ReturnType<typeof detectImageType>): OCROptions {
  switch (imageType) {
    case 'newsletter':
      return {
        psm: 3, // Full auto
        minConfidence: 50,
      };
    case 'rulebook':
      return {
        psm: 6, // Assume uniform text block
        minConfidence: 70,
      };
    case 'card':
      return {
        psm: 11, // Sparse text
        minConfidence: 60,
      };
    case 'art':
      return {
        psm: 11, // Sparse text
        minConfidence: 40, // Lower threshold for artistic text
      };
    default:
      return DEFAULT_OPTIONS;
  }
}

/**
 * Save OCR results to file
 */
export function saveOCRResult(result: OCRResult, outputDir: string): string {
  const basename = path.basename(result.imagePath, path.extname(result.imagePath));
  const outputPath = path.join(outputDir, `${basename}.ocr.txt`);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const content = `# OCR Result: ${path.basename(result.imagePath)}
Source: ${result.imagePath}
Confidence: ${result.confidence.toFixed(2)}%
Processing Time: ${result.processingTime}ms

---

${result.text}

---

## Word Details (${result.words.length} words)
${result.words.slice(0, 50).map(w => `- "${w.text}" (${w.confidence.toFixed(1)}%)`).join('\n')}
${result.words.length > 50 ? `\n... and ${result.words.length - 50} more words` : ''}
`;

  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

/**
 * Load previously saved OCR results
 */
export function loadOCRResult(ocrFilePath: string): string | null {
  if (!fs.existsSync(ocrFilePath)) {
    return null;
  }
  
  const content = fs.readFileSync(ocrFilePath, 'utf-8');
  const match = content.match(/---\n\n([\s\S]*?)\n\n---/);
  return match ? match[1] : content;
}

// Export default queue instance
export const ocrQueue = new OCRQueue();
