#!/usr/bin/env node
/**
 * Update all _index.md files with listings of their contents
 * Run: node scripts/update-indexes.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LORE_DIR = path.join(__dirname, '../docs/lore');

const CATEGORY_INFO = {
  '00-introduction': { name: 'Introduction', emoji: '📖', desc: 'Author notes and introduction to the compendium' },
  '01-world': { name: 'The World', emoji: '🌍', desc: 'The World of Kingdom Death - setting and cosmology' },
  '02-factions': { name: 'Factions', emoji: '⚔️', desc: 'Major factions, organizations, and groups' },
  '03-locations': { name: 'Locations', emoji: '📍', desc: 'Key locations in the Kingdom Death universe' },
  '04-monsters': { name: 'Monsters', emoji: '👹', desc: 'Monsters, nemeses, and creatures' },
  '05-characters': { name: 'Characters', emoji: '👤', desc: 'Named characters, survivors, and figures' },
  '06-concepts': { name: 'Concepts', emoji: '💡', desc: 'Concepts, phenomena, and crossover content' },
  '07-technology': { name: 'Technology', emoji: '⚙️', desc: 'Technology, gear, and artifacts' },
  '08-theories': { name: 'Theories', emoji: '🔮', desc: 'Fan theories and speculations' },
  '09-philosophy': { name: 'Philosophy', emoji: '🧠', desc: 'Philosophical themes and in-game philosophies' },
  '10-art': { name: 'Art', emoji: '🎨', desc: 'Art pieces, busts, and collectibles' },
  '11-community': { name: 'Community', emoji: '👥', desc: 'Community resources and meta-aspects' },
  '12-future': { name: 'Future', emoji: '🔜', desc: 'Upcoming and unreleased content' },
};

function extractTitle(content) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

function generateIndex(dirPath, info) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md') && f !== '_index.md')
    .sort();
  
  let content = `---
title: "${info.name}"
---

# ${info.emoji} ${info.name}

${info.desc}

---

## Entries (${files.length})

`;

  if (files.length === 0) {
    content += `*No entries yet. Check back as the compendium grows!*\n`;
  } else {
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const title = extractTitle(fileContent) || file.replace('.md', '').replace(/-/g, ' ');
      const slug = file.replace('.md', '');
      
      content += `- [${title}](./${slug}.md)\n`;
    }
  }

  content += `
---

[← Back to Compendium](../README.md)
`;

  return content;
}

async function main() {
  console.log('📋 Updating Index Files');
  console.log('='.repeat(50));
  
  const dirs = fs.readdirSync(LORE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.match(/^\d{2}-/))
    .map(d => d.name)
    .sort();
  
  for (const dir of dirs) {
    const info = CATEGORY_INFO[dir];
    if (!info) {
      console.log(`  ⚠️ No info for ${dir}, skipping`);
      continue;
    }
    
    const dirPath = path.join(LORE_DIR, dir);
    const indexPath = path.join(dirPath, '_index.md');
    
    const indexContent = generateIndex(dirPath, info);
    fs.writeFileSync(indexPath, indexContent);
    
    const fileCount = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== '_index.md').length;
    console.log(`  ✅ ${dir}/_index.md (${fileCount} entries)`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All index files updated!');
}

main().catch(console.error);

