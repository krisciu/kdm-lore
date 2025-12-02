# Kingdom Death Simulator - Data Extraction Summary

**Extraction Date:** December 2, 2025
**Source:** Kingdom Death Simulator v0.1.250
**Location:** `/Users/krisciu/.local/share/Launcher Of Death/KingdomDeathSimulator/`

## Extracted Content

### Core 1.6 Rulebook (`core-1.6/`)

| File | Lines | Size | Description |
|------|-------|------|-------------|
| `game-rules-clean.txt` | 15,684 | ~500KB | Cleaned game rules, mechanics, phases |
| `lore-content.txt` | 29,042 | 741KB | Monster names, locations, factions, story |
| `events-content.txt` | 9,310 | 267KB | Story events, hunt events, settlement events |
| `rules-content.txt` | 22,398 | 721KB | Game terminology and mechanics |
| `readable-text.txt` | 190,644 | 4.2MB | All readable text (unfiltered) |
| `rulebook-pages.txt` | 239 | 2.9KB | Rulebook page references |
| `core-expansion-readable.txt` | 7,459 | 223KB | Core expansion assets |

### Expansions (`expansions/`)

| File | Lines | Size | Description |
|------|-------|------|-------------|
| `gamblers-chest-readable.txt` | 14,532 | 538KB | Gambler's Chest content |
| `gamblers-chest-content.txt` | 648 | 15KB | GC game-specific content |
| `gamblers-chest-prose.txt` | 200 | 7.9KB | GC prose text |
| `expansions-of-death-001-readable.txt` | 135,793 | 4.5MB | Expansion monsters (Gorm, Spidicules, DBK, etc.) |
| `expansions-of-death-001-content.txt` | 372 | 8KB | Expansion game content |
| `heirlooms-readable.txt` | 2,600 | 85KB | Heirlooms content |
| `miscellaneous-001-readable.txt` | 22,582 | 762KB | Misc expansion content |

## Content Types Extracted

### Rules & Mechanics
- Settlement phase rules
- Hunt phase rules  
- Showdown phase rules
- Gear and equipment
- Innovations
- Hit locations and injuries
- Monster AI behavior

### Lore & Story
- Monster descriptions (White Lion, Butcher, Phoenix, etc.)
- Location references (Holy Lands, Lantern Hoard, etc.)
- Story events and hunt events
- Character archetypes (Twilight Knight, etc.)
- Settlement events

### Expansion Content
- Gambler's Chest (Crimson Crocodile, Smog Singers, Atnas, Philosophies)
- Expansions of Death (Gorm, Spidicules, Dung Beetle Knight, Sunstalker, etc.)
- Heirlooms system
- Additional monsters and content

## Extraction Method

Used `strings` command to extract readable text from Unity asset bundles:
- Main game: `resources.assets` (62MB)
- DLC bundles: Various `.bundle` files (940MB - 1.1GB each)

Filtered using grep to separate:
1. Game rules and mechanics
2. Lore and story content
3. Event text
4. Monster-specific content

## Notes

- Text is OCR'd from rulebook pages, may contain minor OCR errors
- Some text fragments are partial due to asset bundling
- Unity internal references have been filtered out where possible
- Raw extraction file preserved for reference (`raw-strings-extract.txt`)

## Usage

For lore research, start with:
- `lore-content.txt` - Monster and location references
- `events-content.txt` - Story and hunt events
- `game-rules-clean.txt` - Core game mechanics

For expansion research:
- Check corresponding expansion files in `expansions/`

