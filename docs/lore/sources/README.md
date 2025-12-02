# KDM Lore Sources

This directory contains scraped and processed source material for the Kingdom Death: Monster lore compendium.

## Directory Structure

```
sources/
├── official-site/
│   ├── shop/           # Product descriptions from kingdomdeath.com
│   │   └── images/     # Downloaded product images
│   └── news/           # KDU newsletters and announcements
│       └── images/     # Newsletter images
├── kickstarter/
│   ├── updates/        # Kickstarter update posts
│   └── images/         # Campaign and update images
├── rulebooks/
│   ├── core-1.5/       # Core rulebook content
│   ├── expansions/     # Expansion rulebook content
│   └── ocr/            # OCR'd text from rulebook images
├── community/          # Fan-researched content (verified)
├── index.json          # Master index of all scraped sources
└── ocr-index.json      # Index of processed OCR images
```

## Source Types

### Official Site (`official-site`)
- **Shop**: Product descriptions contain official lore summaries for monsters, survivors, and expansions
- **News**: KDU (Kingdom Death Updates) newsletters contain announcements, lore reveals, and community content

### Kickstarter (`kickstarter`)
- **Campaign**: Main campaign page content
- **Updates**: Kickstarter update posts with detailed lore reveals

### Rulebooks (`rulebooks`)
- **Core-1.5**: Core game rulebook text
- **Expansions**: Expansion rulebook content
- **OCR**: Text extracted from rulebook images via OCR

### Community (`community`)
- Verified fan-researched content
- Must be cross-referenced with official sources

## File Formats

### Text Files (`.txt`)
Plain text extracts of source content with metadata headers:
```
# Source Title
Source: [URL]
Scraped: [Date]

---

[Content]
```

### Metadata Files (`.meta.json`)
```json
{
  "url": "https://...",
  "scrapedAt": "2025-12-02T...",
  "category": "product|newsletter|campaign|rules",
  "source": "official-site|kickstarter|rulebook|community",
  "subCategory": "...",
  "title": "..."
}
```

### OCR Files (`.ocr.txt`)
Text extracted from images via OCR, stored alongside source images.

## Usage

### Scraping New Content

Use the scraper utility in `src/lib/scraper.ts`:

```typescript
import { saveScrapedPage, addToSourcesIndex } from '@/lib/scraper';

// After scraping a page, save it:
saveScrapedPage(scrapedPage, 'official-site/shop');
addToSourcesIndex(key, pageMetadata);
```

### OCR Processing

Use the OCR utility in `src/lib/ocr.ts`:

```typescript
import { processImageWithOpenAI, getUnprocessedImages } from '@/lib/ocr';

// Process images for text extraction
const images = getUnprocessedImages();
for (const img of images) {
  await processImageWithOpenAI(img, openaiClient);
}
```

### API Endpoints

- `GET /api/ocr?action=status` - Get OCR processing status
- `POST /api/ocr` - Process images

## Adding New Sources

1. Create appropriate subdirectory
2. Add source file with proper metadata header
3. Update `index.json` with source metadata
4. If adding images, run OCR processing

## Quality Guidelines

- All sources should include URL and scrape date
- Distinguish between confirmed canon and speculation
- Cross-reference with multiple sources when possible
- Note any inaccuracies or contradictions found

