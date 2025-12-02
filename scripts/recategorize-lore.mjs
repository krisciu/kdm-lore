#!/usr/bin/env node
/**
 * Recategorize lore entries that ended up in wrong directories
 * Run: node scripts/recategorize-lore.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LORE_DIR = path.join(__dirname, '../docs/lore');

// Files to DELETE (not lore - merchandise/accessories)
const TO_DELETE = [
  '06-concepts/8-5-x-11-art-prints-august-2025.md',
  '06-concepts/8-5-x-11-art-prints-halloween-2025.md',
  '06-concepts/8-5-x-11-art-prints-september-2025.md',
  '06-concepts/black-and-red-dice.md',
  '06-concepts/black-friday-death-dice.md',
  '06-concepts/black-out-dice.md',
  '06-concepts/classic-death-die.md',
  '06-concepts/fall-death-dice.md',
  '06-concepts/golden-bat-hunter-death-dice.md',
  '06-concepts/bone-eater-t-shirt.md',
  '06-concepts/crimson-croc-t-shirt.md',
  '06-concepts/dragon-king-t-shirt.md',
  '06-concepts/dungeon-deck-t-shirt.md',
  '06-concepts/god-hand-t-shirt.md',
  '06-concepts/happy-holidays-t-shirt.md',
  '06-concepts/killenium-butcher-t-shirt.md',
  '06-concepts/black-knight-citadel-board-travel-edition.md',
  '06-concepts/echoes-of-death-bundle.md', // Just a bundle listing
  '06-concepts/pinups-of-death-bundle.md', // Just a bundle listing
  '06-concepts/cupid-lucy-painters-scale-copy.md', // Duplicate
];

// Files to MOVE to 10-art (busts and artistic pieces)
const TO_ART = [
  '06-concepts/ashbloom-bust.md',
  '06-concepts/butcher-bust.md',
  '06-concepts/flower-knight-bust.md',
  '06-concepts/gold-smoke-knight-bust.md',
  '06-concepts/hollow-bust.md',
  '06-concepts/phoenix-hunt-reenactment.md',
];

// Files to MOVE to 05-characters (character variants)
const TO_CHARACTERS = [
  '06-concepts/allison-the-twilight-knight.md',
  '06-concepts/ashbloom-of-dedheim.md',
  '06-concepts/astri-the-promised.md',
  '06-concepts/biomech-butcher.md',
  '06-concepts/black-friday-formal-erza-painters-scale.md',
  '06-concepts/blushing-owl-photoresin.md',
  '06-concepts/brave-hollow.md',
  '06-concepts/caster-hunter.md',
  '06-concepts/champion-weaponsmith.md',
  '06-concepts/court-barrister.md',
  '06-concepts/court-investigator.md',
  '06-concepts/cupid-lucy.md',
  '06-concepts/dark-confidant.md',
  '06-concepts/dark-of-star.md',
  '06-concepts/dark-soldier.md',
  '06-concepts/death-high-disciple-of-the-witch-one-2024.md',
  '06-concepts/death-high-disciple-of-the-witch-one.md',
  '06-concepts/death-high-dragon-sacrifice.md',
  '06-concepts/death-high-dung-beetle-knight.md',
  '06-concepts/death-high-enforcer.md',
  '06-concepts/death-high-erza.md',
  '06-concepts/death-high-esther.md',
  '06-concepts/death-high-herb-gatherer.md',
  '06-concepts/death-high-intimacy-couple.md',
  '06-concepts/death-high-lucy.md',
  '06-concepts/death-high-male-preacher-2024.md',
  '06-concepts/death-high-moss.md',
  '06-concepts/death-high-necromancer.md',
  '06-concepts/death-high-satan-twins-painters-scale.md',
  '06-concepts/death-high-satan-x.md',
  '06-concepts/death-high-savior.md',
  '06-concepts/death-high-senior-allister-painters-scale.md',
  '06-concepts/death-high-twilight-knight-2024.md',
  '06-concepts/death-high-white-lion-1.md',
  '06-concepts/death-high-white-speaker-2024.md',
  '06-concepts/death-high-white-speaker.md',
  '06-concepts/death-high-zachary.md',
  '06-concepts/deathmas-cockroach-queen-painters-scale.md',
  '06-concepts/deathmas-cockroach-queen.md',
  '06-concepts/deathmas-percival-painters-scale.md',
  '06-concepts/disciple-of-the-witch-one.md',
  '06-concepts/disciple-of-the-witch-six.md',
  '06-concepts/disciple-of-the-witch-two.md',
  '06-concepts/doll.md',
  '06-concepts/dragon-slayer.md',
  '06-concepts/edlen.md',
  '06-concepts/elsbeth.md',
  '06-concepts/energy-potion-maker.md',
  '06-concepts/entobra-the-walker.md',
  '06-concepts/eod-thief-variant-painter.md',
  '06-concepts/estate-hero.md',
  '06-concepts/forgegod-archival-remaster.md',
  '06-concepts/forsaker.md',
  '06-concepts/generic-male-knight.md',
  '06-concepts/glow.md',
  '06-concepts/grimmory.md',
  '06-concepts/guinevere.md',
  '06-concepts/gunborg-painters-scale.md',
  '06-concepts/gunborg.md',
  '06-concepts/holiday-white-speaker-nico-painters-scale.md',
  '06-concepts/hollowheart-rene-painters-scale.md',
  '06-concepts/hospitalar.md',
  '06-concepts/kingslayer-twilight-knight.md',
  '06-concepts/mox-the-healer.md',
  '06-concepts/painters-scale-black-cat.md',
  '06-concepts/pinup-detective-twilight-knight.md',
  '06-concepts/seed-pattern-jackel.md',
  '06-concepts/snow-the-savior.md',
  '06-concepts/valentines-day-aya.md',
  '06-concepts/visionary-female.md',
  '06-concepts/ammo-slave.md',
];

// Files to MOVE to 03-locations
const TO_LOCATIONS = [
  '06-concepts/before-the-wall.md',
  '06-concepts/beyond-the-wall-1a.md',
];

// Files to MOVE to 04-monsters  
const TO_MONSTERS = [
  '06-concepts/endemic-life.md',
];

function updateFrontmatter(content, newCategory) {
  return content.replace(
    /category: \w+/,
    `category: ${newCategory}`
  );
}

async function main() {
  console.log('🔄 Recategorizing Lore Entries');
  console.log('='.repeat(50));
  
  let deleted = 0;
  let moved = 0;
  
  // Delete non-lore files
  console.log('\n🗑️ Deleting non-lore merchandise files...');
  for (const file of TO_DELETE) {
    const filePath = path.join(LORE_DIR, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  ❌ Deleted: ${file}`);
      deleted++;
    }
  }
  
  // Move to art
  console.log('\n🎨 Moving to 10-art...');
  for (const file of TO_ART) {
    const srcPath = path.join(LORE_DIR, file);
    const filename = path.basename(file);
    const destPath = path.join(LORE_DIR, '10-art', filename);
    
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = updateFrontmatter(content, 'art');
      fs.writeFileSync(destPath, content);
      fs.unlinkSync(srcPath);
      console.log(`  ✅ Moved: ${filename} → 10-art/`);
      moved++;
    }
  }
  
  // Move to characters
  console.log('\n👤 Moving to 05-characters...');
  for (const file of TO_CHARACTERS) {
    const srcPath = path.join(LORE_DIR, file);
    const filename = path.basename(file);
    const destPath = path.join(LORE_DIR, '05-characters', filename);
    
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = updateFrontmatter(content, 'characters');
      fs.writeFileSync(destPath, content);
      fs.unlinkSync(srcPath);
      console.log(`  ✅ Moved: ${filename} → 05-characters/`);
      moved++;
    }
  }
  
  // Move to locations
  console.log('\n📍 Moving to 03-locations...');
  for (const file of TO_LOCATIONS) {
    const srcPath = path.join(LORE_DIR, file);
    const filename = path.basename(file);
    const destPath = path.join(LORE_DIR, '03-locations', filename);
    
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = updateFrontmatter(content, 'locations');
      fs.writeFileSync(destPath, content);
      fs.unlinkSync(srcPath);
      console.log(`  ✅ Moved: ${filename} → 03-locations/`);
      moved++;
    }
  }
  
  // Move to monsters
  console.log('\n👹 Moving to 04-monsters...');
  for (const file of TO_MONSTERS) {
    const srcPath = path.join(LORE_DIR, file);
    const filename = path.basename(file);
    const destPath = path.join(LORE_DIR, '04-monsters', filename);
    
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = updateFrontmatter(content, 'monsters');
      fs.writeFileSync(destPath, content);
      fs.unlinkSync(srcPath);
      console.log(`  ✅ Moved: ${filename} → 04-monsters/`);
      moved++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Deleted: ${deleted} non-lore files`);
  console.log(`✅ Moved: ${moved} files to correct categories`);
}

main().catch(console.error);

