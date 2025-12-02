# Kingdom Death Lore - Image Collection

This directory contains images scraped from official Kingdom Death sources for OCR processing and lore extraction.

## Directory Structure

```
images/
├── newsletter-banners/     # KDU newsletter header images
├── newsletter-content/     # Content images from newsletters
├── shop-products/          # Product images with lore descriptions
├── rulebook-pages/         # Scanned/photographed rulebook pages
├── card-scans/             # Game card images
├── story-events/           # Story event illustrations
├── artwork/                # Official artwork
├── miniatures/             # Miniature photos with lore context
├── community-paint/        # Community paint jobs (for reference)
└── ocr-results/           # OCR output files
```

## Image Naming Convention

Images should follow this naming pattern:
```
[source]-[content-type]-[identifier].[ext]

Examples:
- kdu-109-banner-gencon-2025.png
- shop-gamblers-chest-description.jpg
- rulebook-core-page-042.png
- card-twilight-sword-gear.png
```

## OCR Processing

Images are processed with Tesseract OCR to extract text. Results are stored in `ocr-results/` with the same base name as the image.

### Running OCR

```bash
# Check status
npx ts-node scripts/process-images.ts status

# Scan for new images
npx ts-node scripts/process-images.ts scan

# Process with OCR
npx ts-node scripts/process-images.ts ocr

# Export reports
npx ts-node scripts/process-images.ts export
```

## Image Categories

| Category | Description | Priority |
|----------|-------------|----------|
| `newsletter-banners` | KDU header images | High |
| `newsletter-content` | In-newsletter images | High |
| `shop-products` | Product page images | Medium |
| `rulebook-pages` | Core/expansion rulebook scans | High |
| `card-scans` | Card text/art scans | High |
| `story-events` | Story event illustrations | Medium |
| `artwork` | Official concept/promo art | Low |
| `miniatures` | Mini photos with lore | Low |

## Tags

Images are tagged for easy filtering:

### Content Type Tags
- `lore-text` - Contains narrative/lore text
- `flavor-text` - Has flavor text
- `rules-text` - Contains game rules

### Monster Tags
- `white-lion`, `screaming-antelope`, `phoenix`
- `butcher`, `kings-man`, `hand`, `watcher`
- `gold-smoke-knight`

### Expansion Tags
- `gamblers-chest`, `dragon-king`, `sunstalker`
- `gorm`, `flower-knight`, `spidicules`
- `lion-knight`, `black-knight`, `slenderman`

### Character Tags
- `twilight-knight`, `white-speaker`, `survivor`

### Quality Tags
- `high-res` - High resolution source
- `needs-enhancement` - Requires preprocessing
- `ocr-ready` - Optimized for OCR

## Adding New Images

1. **Download the image** to the appropriate category folder
2. **Name it** following the convention above
3. **Run the scanner** to register it:
   ```bash
   npx ts-node scripts/process-images.ts scan
   ```
4. **Process OCR** to extract text:
   ```bash
   npx ts-node scripts/process-images.ts ocr
   ```

## Image Index

All images are tracked in `../images-index.json`. This index contains:
- Original source URL
- Local file path
- Category and tags
- OCR processing status
- Related lore files

## Priority Images Needed

### High Priority
1. **KDU Newsletter Banners** (#1-109) - Contain exclusive artwork
2. **Rulebook Story Events** - Full narrative text
3. **Expansion Rulebook Pages** - Campaign-specific lore
4. **Card Flavor Text** - Especially gear and AI cards

### Medium Priority
5. **Shop Product Descriptions** - Expansion lore summaries
6. **Kickstarter Update Images** - Monster reveals
7. **Community Spotlight Art** - Sometimes contains lore hints

### Low Priority
8. **Promotional Artwork** - Mostly visual, little text
9. **Painted Miniature Showcases** - Reference only

## OCR Tips

### Best Practices
- Use high-resolution sources when possible
- Crop to text areas for better accuracy
- Note: Some stylized fonts may have lower accuracy
- Manual review recommended for complex layouts

### Common Issues
- Newsletter banners often have stylized text
- Card text may be small and require preprocessing
- Rulebook scans vary in quality

## Contributing

When adding images:
1. Verify you have rights to use the image
2. Don't include watermarked content
3. Tag appropriately for easy discovery
4. Link to related lore files when possible

