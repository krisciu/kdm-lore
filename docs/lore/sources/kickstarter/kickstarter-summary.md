# Kingdom Death Monster 1.5 - Kickstarter Updates

**Source:** https://www.kickstarter.com/projects/poots/kingdom-death-monster-15
**Total Updates:** 134
**Scraped:** 10 (via RSS feed - most recent)
**Images Downloaded:** 266 (226 MB)
**Last Updated:** 2025-12-02

## Scraping Method

**RSS Feed Discovery:** The Kickstarter RSS feed (`/posts.atom`) contains FULL HTML content and image URLs, enabling rapid batch scraping without browser automation!

## Content Scraped

### Update #134 - Black Friday 2025 (48 images)
- **Abyssal Woods Expansion** - Major lore reveal with story content
- **Honeycomb Weaver & Titan Bee Expansion** - New monsters
- **Screaming God Expansion** - Elevated to double crest expansion (Node 4 Quarry + Final Node)
- **Kingdom Death: Simulator** - Video game updates
- **Showdown Terrain Update** - Cap-based system for hard plastic boards
- **Campaigns of Death** - Print deadline updates
- **Phobia Comic Part 2+** - Pawel's fan perspective comics (6 total planned)
- **Legendary Card Pack 2** - Going to print
- **Animation Team** - New illustrators/animators for marketing

### Update #133 - Halloween 2025 (65 images)
- **Screaming God** - Final sizing and tolerances determined
- **Expansions of Death Painting Contest Winners**
  - Best in Show: Black Knight by Tyrant's Brush
  - Black Knight category winners
  - Dung Beetle Knight category winners
  - Community showcase

### Update #132 - September 2025 (11 images)
- Screaming God production updates
- Manufacturing partnership details

### Update #131 - August 2025 GenCon (50 images)
- GenCon 2025 coverage
- Revamped Shipping Wave 1 fulfillment
- Convention reveals and community

### Update #130 - June 2025 (27 images)
- REVAMPED SHIPPING WAVE 1 ON BOATS
- Shipping address confirmation
- GenCon prep
- Preorders announcements

### Update #129 - May 2025 (13 images)
- Revamped Shipping Wave 1 Production COMPLETE
- Fulfillment timeline updates

### Update #128 - April 2025 (11 images)
- Tariffs & trade war discussions
- "EMBRACING THE CHAOS" mindset
- Production adaptations

### Update #127 - March 2025 (32 images)
- Remastered Wave 1 - Fulfillment July 2025
- Screaming God delayed
- Philosophies of Death Gatherism delivered
- Production samples

### Update #126 - February 2025 (5 images)
- Valentine's Day theme
- Tariff situation updates
- Community engagement

### Update #125 - January 2025 (4 images)
- A New Lantern Year
- Pariah expansion samples
- Dwindling Core Game supplies warning

## Key Lore Discoveries

### New Expansions Revealed
- **Abyssal Woods** - Unique campaign start, fairy tale themes
- **Honeycomb Weaver & Titan Bee** - New monster expansion
- **Screaming God** - Double crest (NQ4 + Final Node), hoard of screaming antelopes gameboard

### Characters & Content
- **Phobia Comic Series** - 6 comics planned, fan interpretation of KD world
- **Legendary Card Pack 2** - Including Dark Impulse 3
- **Discord Emotes** - 4 survivors from Screaming Nukealope Vignette

### Production Milestones
- Remastered Wave 1 complete
- Screaming God in production
- Animation team expanded

## File Structure

```
kickstarter/
├── updates/
│   ├── update-125.txt through update-134.txt (10 files)
├── images/
│   ├── update-125/ through update-134/ (266 images total)
├── updates-index.json
└── kickstarter-summary.md
```

## Next Steps

1. **Historical Updates (1-124)** - Need alternative scraping method:
   - Wayback Machine archives
   - Browser automation for older content
   - Post ID pattern discovery

2. **OCR Processing** - Run Tesseract on card/rules images

3. **Lore Extraction** - Parse text content for wiki entries

## Technical Notes

- RSS feed only contains ~10 most recent updates
- Image URLs on `i.kickstarter.com` with signed parameters
- Full HTML content included (headers, paragraphs, images)
- Videos referenced via YouTube URLs
