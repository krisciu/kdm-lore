#!/usr/bin/env npx ts-node
/**
 * Analyze Kickstarter images using Claude Vision
 * Much better than OCR for artwork and game content!
 */

import fs from 'fs';
import path from 'path';

const IMAGES_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter', 'images');
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'lore', 'sources', 'kickstarter', 'image-descriptions');

interface ImageAnalysis {
  description: string;
  subjects: string[];
  loreContent: string;
  textVisible: string;
  imageType: 'artwork' | 'card' | 'miniature' | 'rules' | 'photo' | 'diagram';
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function analyzeImage(imagePath: string, apiKey: string): Promise<ImageAnalysis | null> {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const ext = path.extname(imagePath).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' : 
                      ext === '.gif' ? 'image/gif' : 'image/jpeg';
    
    const prompt = `Analyze this Kingdom Death: Monster image.

Provide a detailed analysis in JSON format:
{
  "description": "Detailed description of what's shown (2-3 sentences)",
  "subjects": ["list", "of", "key", "subjects", "shown"],
  "loreContent": "Any lore, story, or game information visible or implied",
  "textVisible": "Any readable text in the image (card names, rules, etc)",
  "imageType": "artwork|card|miniature|rules|photo|diagram"
}

Focus on:
- Monster names, survivor details, gear/items shown
- Any game mechanics or rules visible
- Story elements or lore hints
- Card text, stats, or abilities if visible`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
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
      const error = await response.text();
      console.log(`    ⚠ API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ImageAnalysis;
    }
    
    return null;
  } catch (error: any) {
    console.log(`    ⚠ Error: ${error.message?.slice(0, 50)}`);
    return null;
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.log('\n❌ ANTHROPIC_API_KEY not set!');
    console.log('   Run: export ANTHROPIC_API_KEY=your-key-here\n');
    return;
  }
  
  console.log('\n🔍 Analyzing Kickstarter Images with Claude Vision\n');
  
  ensureDir(OUTPUT_PATH);
  
  // Get all image directories
  const updateDirs = fs.readdirSync(IMAGES_PATH).filter(d => 
    fs.statSync(path.join(IMAGES_PATH, d)).isDirectory()
  );
  
  console.log(`Found ${updateDirs.length} update directories\n`);
  
  let totalAnalyzed = 0;
  let totalSkipped = 0;
  
  for (const updateDir of updateDirs) {
    const dirPath = path.join(IMAGES_PATH, updateDir);
    const outputDir = path.join(OUTPUT_PATH, updateDir);
    ensureDir(outputDir);
    
    const images = fs.readdirSync(dirPath).filter(f => 
      /\.(jpg|jpeg|png)$/i.test(f)
    );
    
    if (images.length === 0) continue;
    
    console.log(`📁 ${updateDir} (${images.length} images)`);
    
    const analyses: Record<string, ImageAnalysis> = {};
    
    for (const image of images) {
      const imagePath = path.join(dirPath, image);
      const outputFile = path.join(outputDir, image.replace(/\.[^.]+$/, '.json'));
      
      // Skip if already analyzed
      if (fs.existsSync(outputFile)) {
        totalSkipped++;
        continue;
      }
      
      // Skip tiny files
      const stats = fs.statSync(imagePath);
      if (stats.size < 1000) {
        continue;
      }
      
      process.stdout.write(`  🖼 ${image}...`);
      
      const analysis = await analyzeImage(imagePath, apiKey);
      
      if (analysis) {
        fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
        analyses[image] = analysis;
        console.log(` ✓ ${analysis.imageType}`);
        totalAnalyzed++;
      } else {
        console.log(' ✗');
      }
      
      // Rate limiting - be nice to the API
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Save combined analysis for this update
    if (Object.keys(analyses).length > 0) {
      const combinedPath = path.join(outputDir, '_summary.json');
      fs.writeFileSync(combinedPath, JSON.stringify({
        update: updateDir,
        imageCount: Object.keys(analyses).length,
        analyses,
      }, null, 2));
    }
  }
  
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Analysis Complete`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Analyzed: ${totalAnalyzed}`);
  console.log(`  Skipped (already done): ${totalSkipped}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
}

main().catch(console.error);

