#!/usr/bin/env node
/**
 * Extract lore content from the already-extracted rulebook text
 * Identifies story events, monster descriptions, and narrative content
 * Run: node scripts/extract-rulebook-lore.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULEBOOK_PATH = path.join(__dirname, '../docs/lore/sources/rulebooks/core-1.6/FULL-RULEBOOK.txt');
const OUTPUT_DIR = path.join(__dirname, '../docs/lore/sources/rulebooks/lore-extracted');

// Patterns to identify lore content
const LORE_PATTERNS = {
  storyEvent: /Story Event[s]?\s*[-–]?\s*(.+?)(?=Story Event|RULEBOOK PAGE|\n\n\n)/gis,
  monsterLore: /(White Lion|Butcher|Phoenix|Screaming Antelope|King'?s Man|The Hand|Watcher|Gold Smoke Knight|Gorm|Dragon King|Sunstalker|Flower Knight|Spidicules|Lion Knight|Slenderman|Dung Beetle Knight|Lion God)\s*[:\n]([^]*?)(?=RULEBOOK PAGE|\n\n\n)/gi,
  narrativeText: /["""']([^"""']{50,500})["""']/g,
  settingDescriptions: /(The darkness|In the darkness|survivors?|settlement|lantern|stone face)/gi,
};

// Key story events to extract
const STORY_EVENTS = [
  'Prologue',
  'First Story',
  'Returning Survivors',
  'Age',
  'Armored Strangers',
  'Birth of a Savior',
  'Bold',
  'Bone Witch',
  'Cooking',
  'Crush and Devour',
  'Endless Screams',
  'Game Over',
  'Hands of Heat',
  'Herb Gathering',
  'Hooded Knight',
  'Insight',
  'Intimacy',
  'King\'s Curse',
  'King\'s Step',
  'Lantern Research',
  'Legendary Lungs',
  'Legendary Monsters',
  'Mineral Gathering',
  'Overwhelming Darkness',
  'Oxidation',
  'Phoenix Feather',
  'Principle: Conviction',
  'Principle: Death',
  'Principle: New Life',
  'Principle: Society',
  'Regal Visit',
  'Run Away',
  'See the Truth',
  'White Secret',
  'White Speaker',
  'Zero Presence',
  'Watched',
  'Blackout',
  'Hammer and Nail',
];

// Monster showdown events
const SHOWDOWNS = [
  'Showdown: Butcher',
  'Showdown: The Hand',
  'Showdown: King\'s Man',
  'Showdown: Phoenix',
  'Showdown: Screaming Antelope',
  'Showdown: White Lion',
  'Showdown: Watcher',
  'Showdown: Gold Smoke Knight',
];

function extractSections(content) {
  const sections = [];
  
  // Split by page markers
  const pages = content.split(/={50,}\nRULEBOOK PAGE (\d+)\n={50,}/);
  
  for (let i = 1; i < pages.length; i += 2) {
    const pageNum = parseInt(pages[i]);
    const pageContent = pages[i + 1] || '';
    
    if (pageContent.trim().length > 50) {
      sections.push({
        page: pageNum,
        content: pageContent.trim(),
      });
    }
  }
  
  return sections;
}

function identifyLoreContent(sections) {
  const lore = {
    storyEvents: [],
    monsterDescriptions: [],
    narrativeQuotes: [],
    worldbuilding: [],
  };
  
  for (const section of sections) {
    const content = section.content;
    
    // Check for story events
    for (const event of STORY_EVENTS) {
      if (content.toLowerCase().includes(event.toLowerCase())) {
        // Extract surrounding context
        const eventPattern = new RegExp(`(${event.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,2000})`, 'i');
        const match = content.match(eventPattern);
        if (match) {
          lore.storyEvents.push({
            event,
            page: section.page,
            excerpt: match[1].slice(0, 1500).trim(),
          });
        }
      }
    }
    
    // Check for showdown events
    for (const showdown of SHOWDOWNS) {
      if (content.toLowerCase().includes(showdown.toLowerCase())) {
        lore.storyEvents.push({
          event: showdown,
          page: section.page,
          excerpt: content.slice(0, 1000).trim(),
        });
      }
    }
    
    // Extract narrative quotes (text in quotes)
    const quotes = content.match(/["""]([^"""]{50,300})["""]/g);
    if (quotes) {
      quotes.forEach(q => {
        lore.narrativeQuotes.push({
          quote: q.replace(/["""]/g, ''),
          page: section.page,
        });
      });
    }
    
    // Look for descriptive worldbuilding content
    if (content.match(/darkness|lantern|settlement|survivor|monster|stone face/gi)) {
      // Find paragraphs with narrative content
      const paragraphs = content.split(/\n\n+/);
      paragraphs.forEach(p => {
        if (p.length > 100 && p.length < 1000 && 
            p.match(/darkness|lantern|survivor/gi) &&
            !p.match(/^\d+\s*x\s/i) && // Not a product list
            !p.match(/^-\s/) // Not a bullet point
        ) {
          lore.worldbuilding.push({
            text: p.trim(),
            page: section.page,
          });
        }
      });
    }
  }
  
  // Deduplicate
  lore.storyEvents = [...new Map(lore.storyEvents.map(e => [e.event, e])).values()];
  lore.narrativeQuotes = [...new Map(lore.narrativeQuotes.map(q => [q.quote.slice(0, 50), q])).values()];
  lore.worldbuilding = lore.worldbuilding.filter((w, i, arr) => 
    arr.findIndex(x => x.text.slice(0, 100) === w.text.slice(0, 100)) === i
  );
  
  return lore;
}

function generateLoreFiles(lore) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Story Events file
  let storyEventsContent = `# Kingdom Death: Monster - Story Events
Extracted from Core Rulebook 1.6
Total Events: ${lore.storyEvents.length}

---

`;
  
  for (const event of lore.storyEvents) {
    storyEventsContent += `## ${event.event}
*Page ${event.page}*

${event.excerpt}

---

`;
  }
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'story-events.txt'), storyEventsContent);
  console.log(`✅ story-events.txt (${lore.storyEvents.length} events)`);
  
  // Narrative Quotes file
  let quotesContent = `# Kingdom Death: Monster - Narrative Quotes
Extracted from Core Rulebook 1.6
Total Quotes: ${lore.narrativeQuotes.length}

---

`;
  
  for (const quote of lore.narrativeQuotes) {
    quotesContent += `> "${quote.quote}"
*Page ${quote.page}*

`;
  }
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'narrative-quotes.txt'), quotesContent);
  console.log(`✅ narrative-quotes.txt (${lore.narrativeQuotes.length} quotes)`);
  
  // Worldbuilding file
  let worldContent = `# Kingdom Death: Monster - Worldbuilding
Extracted from Core Rulebook 1.6
Total Passages: ${lore.worldbuilding.length}

---

`;
  
  for (const passage of lore.worldbuilding) {
    worldContent += `${passage.text}

*Page ${passage.page}*

---

`;
  }
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'worldbuilding.txt'), worldContent);
  console.log(`✅ worldbuilding.txt (${lore.worldbuilding.length} passages)`);
  
  // Summary index
  const index = {
    extractedAt: new Date().toISOString(),
    source: 'Core Rulebook 1.6',
    counts: {
      storyEvents: lore.storyEvents.length,
      narrativeQuotes: lore.narrativeQuotes.length,
      worldbuilding: lore.worldbuilding.length,
    },
    storyEventsList: lore.storyEvents.map(e => e.event),
  };
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'lore-index.json'), JSON.stringify(index, null, 2));
  console.log(`✅ lore-index.json`);
}

async function main() {
  console.log('📖 Kingdom Death Rulebook Lore Extractor');
  console.log('='.repeat(50));
  
  if (!fs.existsSync(RULEBOOK_PATH)) {
    console.log(`❌ Rulebook not found at: ${RULEBOOK_PATH}`);
    return;
  }
  
  console.log('📄 Reading rulebook...');
  const content = fs.readFileSync(RULEBOOK_PATH, 'utf-8');
  console.log(`   ${content.length} characters`);
  
  console.log('\n📋 Extracting sections...');
  const sections = extractSections(content);
  console.log(`   ${sections.length} pages extracted`);
  
  console.log('\n🔍 Identifying lore content...');
  const lore = identifyLoreContent(sections);
  
  console.log('\n💾 Generating lore files...');
  generateLoreFiles(lore);
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete! Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);

