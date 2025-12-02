# Kingdom Death Simulator - Complete Asset Extraction

**Extraction Date:** December 2, 2025  
**Source:** Kingdom Death Simulator v0.1.250  
**Location:** `/Users/krisciu/.local/share/Launcher Of Death/KingdomDeathSimulator/`  
**Method:** UnityPy (Unity asset parsing)  
**Total Size:** 3.3 GB extracted

## Extraction Summary

| Content | Count | Location |
|---------|-------|----------|
| **Core Rulebook Pages** | 246 | `images/rulebook-pages/` |
| **Gambler's Chest** | 695 | `images/gamblers-chest/` |
| **Expansions of Death** | 436 | `images/expansions-of-death/` |
| **Miscellaneous Expansions** | 434 | `images/miscellaneous/` |
| **Game Content** | 97 | `images/game-content/` |
| **Other Assets** | ~1,000 | Various folders |
| **TOTAL IMAGES** | ~2,825 | |

## Expansion Rulebook Pages Extracted

### Core 1.6 Rulebook
- `kd-rulebook-1.6-2.png` through `kd-rulebook-1.6-242.png` (246 pages)
- Complete 1.6 rulebook at 2048x2048 resolution

### Gambler's Chest
- `Gamblers Chest - Page - 1.png` through `Gamblers Chest - Page - 200+.png`
- Ark Settlement sheets
- Crimson Crocodile, Smog Singers, Atnas content
- Philosophy cards and content

### Expansions of Death 001
- **Gorm**: `gorm-*.png`, `Page *.png` (14+ pages)
- **Spidicules**: `sp-Page *.png` (19 pages)
- **Dragon King**: `DK_Book_Page*.png` (31 pages)
- **Sunstalker**: `ss-Page *.png` (35 pages)
- **Flower Knight**: `Flower-Knight-*.png` (24 pages)
- **Lion Knight**: `LionKnightBook-Page *.png` (19 pages)
- **Slenderman**: `sm-Page *.png` (15 pages)
- **Dung Beetle Knight**: `dbk-Page *.png` (19 pages)
- **Lonely Tree**: `LT-Page *.png` (11 pages)
- **Lion God**, **Manhunter** content

### Miscellaneous Expansions
- **Black Knight**: `Black Knight complete book-*.png` (40 pages)
- **Red Witch**: `Red-Witch-Expansion-Book-*.png` (44 pages)
- **Pariah**: `Pariah-Complete-book-NEW-May-2025-*.png` (28 pages)
- **Frog Dog**: `Frog-Dog-complete-book-CE-*.png` (24 pages)
- **White Gigalion**: `White Gigalion Booklet-*.png` (12 pages)
- **Killenium Butcher**: Vignette rulebook pages (36 pages)
- Terrain tiles (Citadel, Rubble)

## Game Content Extracted

### Card Backs
- AI cards, Hit Location cards, Resource cards
- Fighting Arts, Disorders, Secret Fighting Arts
- Settlement Events, Hunt Events
- Innovation cards, Gear cards, Terrain cards

### Boards & Sheets
- Settlement boards (left, mid, right)
- Hunt boards
- Showdown boards
- Settlement record sheets
- Gear grids

### Settlement Sheets (Various Campaigns)
- People of the Stars sheets
- People of the Sun sheets
- Squires settlement sheets

## Text Content

### OCR'd Rulebook Text
- `core-1.6/FULL-RULEBOOK.txt` - 4,679 lines
- Individual page text in `extracted/core/text/`

## File Structure

```
docs/lore/sources/rulebooks/extracted/
├── images/
│   ├── rulebook-pages/       # 246 core rulebook pages
│   ├── gamblers-chest/       # 695 GC images
│   ├── expansions-of-death/  # 436 expansion pages
│   ├── miscellaneous/        # 434 misc expansion pages
│   ├── game-content/         # 97 cards/boards
│   ├── heirlooms/           # Heirloom system
│   ├── train-scene/         # Train scene textures
│   ├── entrance-scene/      # Entrance textures
│   └── common-content/      # Shared assets
└── core/
    └── text/                # OCR text files
```

## Extraction Scripts

Located in `scripts/`:
- `extract_unity_text.py` - Text extraction
- `extract_all_images.py` - Batch image extraction  
- `extract_rulebook_images.py` - Targeted rulebook extraction
- `analyze_bundle.py` - Bundle analysis

## Notes

- All rulebook images are 2048x2048 PNG
- Settlement sheets are ~1600x2048
- Some expansions have cover and inner page variants
- May 2025 content (Pariah) represents latest updates
