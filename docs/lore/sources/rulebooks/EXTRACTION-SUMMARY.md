# Kingdom Death Simulator - Text Extraction Summary

**Extraction Date:** December 2, 2025  
**Source:** Kingdom Death Simulator v0.1.250  
**Location:** `/Users/krisciu/.local/share/Launcher Of Death/KingdomDeathSimulator/`  
**Method:** UnityPy (proper Unity asset parsing)

## Extracted Content

### Core Rulebook (`core-1.6/FULL-RULEBOOK.txt`)

**4,679 lines** of clean, readable rulebook text including:

- Table of Contents (page 3)
- Prologue & First Story (pages 5-35)
- Survival Guide (page 36+)
- Core Rules: Survivors, Monsters, Resources, Terrain
- Hunt Phase rules (page 61+)
- Showdown Phase rules (page 65+)
- Settlement Phase rules (page 81+)
- Severe Injuries & Brain Trauma (pages 86-89)
- Hunt Events (page 90+)
- Story Events (pages 107-185)
- Finale events (pages 187-195)
- Game Variants & Glossary (pages 226-228)

### Individual Pages (`extracted/core/`)

130 individual rulebook page files:
- `RuleBook_3.txt` through `RuleBook_237.txt`
- Each file contains one rulebook page with OCR'd text

### DLC Content (`extracted/*/`)

MonoBehaviour JSON data for:
- Gambler's Chest expansion
- Expansions of Death 001
- Heirlooms
- Common content
- System UI elements

## Content Quality

The UnityPy extraction provides:
- ✅ Clean, readable text
- ✅ Proper page formatting preserved
- ✅ Tables and columns maintained
- ✅ Rules text complete and usable

## Usage

For lore research, use:
- `core-1.6/FULL-RULEBOOK.txt` - Complete rulebook in one file
- `extracted/core/RuleBook_*.txt` - Individual pages

## Extraction Script

Located at: `scripts/extract_unity_text.py`

Run with:
```bash
python3 scripts/extract_unity_text.py
```
