/**
 * KDM Lore OCR Utility
 * Handles OCR processing for images containing lore text
 */

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const SOURCES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources');

export interface OCRResult {
  imagePath: string;
  text: string;
  confidence: number;
  processedAt: string;
  method: 'openai-vision' | 'tesseract' | 'manual';
}

export interface OCRBatchResult {
  results: OCRResult[];
  totalImages: number;
  successCount: number;
  failCount: number;
  processedAt: string;
}

/**
 * Get all images from the sources directories
 */
export function getAllSourceImages(): string[] {
  const images: string[] = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  
  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        scanDirectory(fullPath);
      } else if (imageExtensions.includes(path.extname(item.name).toLowerCase())) {
        images.push(fullPath);
      }
    }
  }
  
  scanDirectory(SOURCES_PATH);
  return images;
}

/**
 * Get images that haven't been OCR'd yet
 */
export function getUnprocessedImages(): string[] {
  const allImages = getAllSourceImages();
  const ocrIndex = loadOCRIndex();
  
  return allImages.filter(img => !ocrIndex[img]);
}

/**
 * Load existing OCR results index
 */
export function loadOCRIndex(): Record<string, OCRResult> {
  const indexPath = path.join(SOURCES_PATH, 'ocr-index.json');
  
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  
  return {};
}

/**
 * Save OCR results index
 */
export function saveOCRIndex(index: Record<string, OCRResult>): void {
  const indexPath = path.join(SOURCES_PATH, 'ocr-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Save OCR result text to file alongside image
 */
export function saveOCRText(imagePath: string, text: string): string {
  const textPath = imagePath.replace(/\.[^.]+$/, '.ocr.txt');
  
  const content = `# OCR Text from: ${path.basename(imagePath)}
Processed: ${new Date().toISOString()}

---

${text}
`;
  
  fs.writeFileSync(textPath, content, 'utf-8');
  return textPath;
}

/**
 * Process an image using OpenAI Vision API
 */
export async function processImageWithOpenAI(
  imagePath: string,
  openai: OpenAI
): Promise<OCRResult> {
  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all readable text from this Kingdom Death: Monster game image. 
              
Focus on:
- Card text (AI cards, hit location cards, gear cards, etc.)
- Story event text
- Rulebook text
- Settlement event text
- Any lore descriptions

Return ONLY the extracted text, maintaining original formatting where possible.
If there are multiple sections, separate them with "---".
If no readable text is found, respond with "NO_TEXT_FOUND".`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });
    
    const extractedText = response.choices[0]?.message?.content || '';
    
    // Save the text to file
    if (extractedText && extractedText !== 'NO_TEXT_FOUND') {
      saveOCRText(imagePath, extractedText);
    }
    
    const result: OCRResult = {
      imagePath,
      text: extractedText,
      confidence: extractedText === 'NO_TEXT_FOUND' ? 0 : 0.9,
      processedAt: new Date().toISOString(),
      method: 'openai-vision',
    };
    
    // Update index
    const index = loadOCRIndex();
    index[imagePath] = result;
    saveOCRIndex(index);
    
    return result;
  } catch (error) {
    console.error('OpenAI Vision OCR error:', error);
    throw error;
  }
}

/**
 * Process all unprocessed images
 */
export async function processAllImages(
  openai: OpenAI,
  maxImages?: number
): Promise<OCRBatchResult> {
  const unprocessed = getUnprocessedImages();
  const toProcess = maxImages ? unprocessed.slice(0, maxImages) : unprocessed;
  
  const results: OCRResult[] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const imagePath of toProcess) {
    try {
      console.log(`Processing: ${path.basename(imagePath)}`);
      const result = await processImageWithOpenAI(imagePath, openai);
      results.push(result);
      successCount++;
      
      // Rate limit: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to process ${imagePath}:`, error);
      failCount++;
    }
  }
  
  return {
    results,
    totalImages: unprocessed.length,
    successCount,
    failCount,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Get MIME type for image
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/png';
}

/**
 * Extract lore-relevant text from OCR results
 */
export function extractLoreFromOCR(ocrText: string): {
  cardText: string[];
  storyText: string[];
  ruleText: string[];
  loreSnippets: string[];
} {
  const sections = ocrText.split('---').map(s => s.trim()).filter(Boolean);
  
  const cardText: string[] = [];
  const storyText: string[] = [];
  const ruleText: string[] = [];
  const loreSnippets: string[] = [];
  
  for (const section of sections) {
    // Simple categorization based on content patterns
    if (section.includes('Action:') || section.includes('Reaction:') || 
        section.includes('Persistent:') || section.includes('Hit Location:')) {
      cardText.push(section);
    } else if (section.includes('Story Event') || section.includes('Read aloud:') ||
               section.includes('The survivors') || section.includes('settlement')) {
      storyText.push(section);
    } else if (section.includes('rule') || section.includes('Phase') ||
               section.includes('may not') || section.includes('must')) {
      ruleText.push(section);
    } else {
      loreSnippets.push(section);
    }
  }
  
  return { cardText, storyText, ruleText, loreSnippets };
}

/**
 * Generate OCR processing report
 */
export function generateOCRReport(): {
  totalImages: number;
  processedImages: number;
  unprocessedImages: number;
  totalTextExtracted: number;
  recentResults: OCRResult[];
} {
  const allImages = getAllSourceImages();
  const index = loadOCRIndex();
  const processedPaths = Object.keys(index);
  
  const totalTextExtracted = Object.values(index)
    .reduce((sum, result) => sum + result.text.length, 0);
  
  const recentResults = Object.values(index)
    .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
    .slice(0, 10);
  
  return {
    totalImages: allImages.length,
    processedImages: processedPaths.length,
    unprocessedImages: allImages.length - processedPaths.length,
    totalTextExtracted,
    recentResults,
  };
}

