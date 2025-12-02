#!/usr/bin/env npx ts-node
/**
 * Batch scrape Kingdom Death newsletters
 * Run: npx ts-node scripts/batch-scrape-news.ts
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../docs/lore/sources/official-site/news/scraped');

// Known newsletter URL patterns - we'll try variations
const KNOWN_NEWSLETTER_IDS = [
  // 2025
  'mc-38e1aabf18', // KDU #109 Aug 2025
  'mc-10c7f47ad6', // KDU #108 July 2025  
  'mc-cfd1d672',   // KDU #107 June 2025
  'mc-abc123',     // Placeholder - we'll discover more
  
  // Try these known patterns
  'mc-83970b9b56', // KDU #101
  'mc-fa567e6a76', // KDU #102
  'mc-e8badbb129', // KDU #103
  'mc-059aa211d2', // KDU #99
];

// We'll also crawl the news listing page to find more
async function discoverNewsletterUrls(page: Page): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    await page.goto('https://kingdomdeath.com/news', { waitUntil: 'networkidle' });
    
    // Click the Newsletter filter
    await page.click('button:has-text("Newsletter")').catch(() => {});
    await page.waitForTimeout(2000);
    
    // Get all links
    const links = await page.$$eval('a[href*="/news/"]', els => 
      els.map(el => el.getAttribute('href')).filter(h => h && h.includes('/news/mc-'))
    );
    
    for (const link of links) {
      if (link && !urls.includes(link)) {
        urls.push(link.startsWith('http') ? link : `https://kingdomdeath.com${link}`);
      }
    }
    
    // Scroll to load more
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('End');
      await page.waitForTimeout(1500);
      
      const moreLinks = await page.$$eval('a[href*="/news/"]', els => 
        els.map(el => el.getAttribute('href')).filter(h => h && h.includes('/news/mc-'))
      );
      
      for (const link of moreLinks) {
        if (link && !urls.includes(link)) {
          urls.push(link.startsWith('http') ? link : `https://kingdomdeath.com${link}`);
        }
      }
    }
    
  } catch (error) {
    console.log('Error discovering URLs:', error);
  }
  
  return [...new Set(urls)];
}

interface ScrapedNewsletter {
  url: string;
  title: string;
  content: string;
  images: string[];
  date: string;
  timestamp: string;
}

async function scrapeNewsletter(page: Page, url: string): Promise<ScrapedNewsletter | null> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    const title = await page.title();
    if (title.includes('404')) {
      return null;
    }
    
    // Extract newsletter title from page title
    const newsletterTitle = title.replace(' | Kingdom Death', '').replace('Kingdom Death | News of Death | ', '').trim();
    
    // Get main content
    const content = await page.evaluate(() => {
      const body = document.body;
      // Remove header/footer/nav
      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('header, footer, nav, script, style').forEach(el => el.remove());
      return clone.textContent?.trim().slice(0, 20000) || '';
    });
    
    // Get images
    const images = await page.$$eval('img[src*="datocms"]', els => 
      els.map(el => el.getAttribute('src') || '').filter(s => s.length > 10)
    );
    
    // Try to extract date from content or title
    const dateMatch = content.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
    const date = dateMatch ? dateMatch[0] : 'Unknown';
    
    return {
      url,
      title: newsletterTitle,
      content,
      images,
      date,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`  ❌ Error: ${url}`);
    return null;
  }
}

function saveNewsletter(newsletter: ScrapedNewsletter) {
  const slug = newsletter.url.split('/').pop() || 'unknown';
  const filename = `${slug}.txt`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  const content = `# ${newsletter.title}
Source: ${newsletter.url}
Date: ${newsletter.date}
Scraped: ${newsletter.timestamp}

---

## Content

${newsletter.content}

---

## Images Found
${newsletter.images.map(i => `- ${i}`).join('\n')}
`;

  fs.writeFileSync(filepath, content);
  console.log(`  ✅ Saved: ${filename} (${newsletter.title})`);
}

async function main() {
  console.log('📰 Kingdom Death Newsletter Batch Scraper');
  console.log('=' .repeat(50));
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // First discover URLs from the news page
  console.log('\n🔍 Discovering newsletter URLs...');
  const discoveredUrls = await discoverNewsletterUrls(page);
  console.log(`Found ${discoveredUrls.length} potential newsletter URLs`);
  
  // Add known URLs
  const allUrls = [...new Set([
    ...discoveredUrls,
    ...KNOWN_NEWSLETTER_IDS.map(id => `https://kingdomdeath.com/news/${id}`)
  ])];
  
  console.log(`\n📰 Scraping ${allUrls.length} newsletters...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const url of allUrls) {
    const result = await scrapeNewsletter(page, url);
    if (result && result.content.length > 500) {
      saveNewsletter(result);
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay
    await page.waitForTimeout(500);
  }
  
  await browser.close();
  
  console.log('\n' + '=' .repeat(50));
  console.log(`✅ Complete! Scraped ${successCount} newsletters, ${failCount} failed/empty`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);

