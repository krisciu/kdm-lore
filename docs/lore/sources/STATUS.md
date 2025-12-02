# KDM Lore Sources - Status Tracker
Last Updated: 2025-12-02 (Session 5 - OCR Complete + Scraping Analysis)

## 📊 COLLECTION SUMMARY

| Category | Count | Notes |
|----------|-------|-------|
| **Shop Products** | 172 | Unique products from shop |
| **Newsletters** | 11 | KDU #97, 99, 101-109 |
| **Kickstarter Updates** | 67 | #117-134 + older posts |
| **Kickstarter Images** | 677 | From various updates |
| **Rulebook Text** | 277 | Extracted from core 1.6 |
| **Rulebook Images** | 2,825 | Card art, UI, sprites |
| **Newsletter Images** | 141 | Banners and content |
| **OCR Results** | 398 | Processed image texts |
| **Research Files** | 17 | Existing curated lore |
| **TOTAL FILES** | ~4,500+ | 3.5GB+ total |

---

## 🗂️ DIRECTORY STRUCTURE

```
sources/
├── official-site/
│   ├── shop/
│   │   ├── smart-scraped/     # 172 files (PRIMARY SOURCE)
│   │   ├── batch-scraped/     # 38 files (SECONDARY)
│   │   ├── [subdirectories]/  # Categorized duplicates
│   │   └── master-product-index.json
│   ├── news/
│   │   ├── 2024/              # 3 newsletters
│   │   └── 2025/              # 8 newsletters
│   ├── guides/                # 4 game guides
│   └── images/                # 230+ images
├── rulebooks/
│   ├── core-1.6/
│   │   └── FULL-RULEBOOK.txt  # 4,680 lines, complete
│   ├── lore-extracted/        # Story events, worldbuilding
│   └── extracted/             # 3,500+ files from Unity
├── existing-research/         # 17 curated lore files
└── kickstarter/               # Campaign page
```

---

## ✅ COMPLETED SOURCES

### Shop Products (194 unique)
| Source | Count | Quality |
|--------|-------|---------|
| smart-scraped/ | 172 | ⭐ Best - clean descriptions |
| batch-scraped/ | 7 | Good - some nav pollution |
| subdirectories | 13 | Manual scrapes |
| root files | 2 | Manual scrapes |

### Newsletters Collected
| ID | Date | Content |
|----|------|---------|
| KDU #97 | Aug 2024 | General update |
| KDU #99 | Oct 2024 | Erza of Dedheim |
| KDU #101 | Dec 2024 | Year recap |
| KDU #102 | Jan 2025 | New year |
| KDU #103 | Feb 2025 | Monthly update |
| KDU #104 | Mar 2025 | Rain Stalker, Tachyon Nodachi |
| KDU #105 | Apr 2025 | Lagomorphs, Sunstalker lifecycle |
| KDU #106 | May 2025 | Mole (Talpagoria) |
| KDU #107 | Jun 2025 | Summer content |
| KDU #108 | Jul 2025 | Killennium Butcher |
| KDU #109 | Aug 2025 | Gen Con 2025 |

### Rulebook Content
- ✅ FULL-RULEBOOK.txt (4,680 lines)
- ✅ 44 story events extracted
- ✅ 27 worldbuilding passages
- ✅ 6 narrative quotes

---

## ❌ STILL NEEDED

### High Priority (Difficult - Requires Auth/Manual)
| Source | Count | Notes |
|--------|-------|-------|
| **Kickstarter #1-116** | 116 updates | Blocked by Kickstarter (403/auth required) |
| **Newsletters #1-96** | 96 issues | Email-only, need Wayback Machine |
| **Newsletter #98, #100** | 2 issues | Links broken, need archives |

### Medium Priority
| Source | Notes |
|--------|-------|
| Expansion Rulebooks | DK, Sunstalker, Lion God, etc. |
| Remaining Image OCR | ~170 images (large files) |
| Story Event Full Text | Complete narrative passages |

### Low Priority
| Source | Notes |
|--------|-------|
| Pinup Lore | Character backgrounds from product pages |
| Community Theories | Reddit, BGG discussions |
| Convention Reveals | GenCon, PAX exclusive info |

### ⚠️ Scraping Challenges
- **Kickstarter**: Blocks headless browsers (403), requires login for older posts
- **Newsletters**: Email-only distribution, no public archive
- **Solutions**: 
  1. Wayback Machine for archived pages
  2. Manual copy-paste for authenticated content
  3. RSS feed for recent updates (already using)

---

## 🔧 MAINTENANCE NOTES

### Consolidation Complete
- Ran `consolidate-sources.mjs` 
- Created `master-product-index.json` with 194 products
- smart-scraped is authoritative source

### Files Cleaned Up
- Deleted: `settlement-phase-is-a-great-place-to-start-and.md` (hallucinated)
- Deleted: Duplicate newsletter files

### Scripts Available
| Script | Purpose |
|--------|---------|
| `smart-scraper.mjs` | Auto-discover & scrape shop |
| `batch-scrape.mjs` | Batch scrape known URLs |
| `extract-rulebook-lore.mjs` | Extract story events |
| `consolidate-sources.mjs` | Deduplicate shop files |

---

## 📝 NEXT STEPS

1. **Generate Lore Entries** - Convert 194 shop sources to markdown lore
2. **Populate Directories** - Fill 01-world through 12-future
3. **Cross-Reference** - Link related entries
4. **Add Missing Newsletters** - KDU #90-100
5. **OCR Newsletter Images** - Extract text from images
