#!/bin/bash
# Quick Capture Helper
# Usage: ./quick-capture.sh <screenshot-filename> <page-id>
# Example: ./quick-capture.sh kdu-99-october-2024-full.png kdu-99-october-2024

TEMP_DIR="/var/folders/wb/8kn3bbq56_xb28j403glx14r0000gn/T/cursor/screenshots"
TARGET_DIR="$(dirname "$0")/../docs/lore/sources/official-site/images/newsletter-banners"

if [ -z "$1" ]; then
    echo "Usage: $0 <screenshot-filename> [page-id]"
    echo "Example: $0 kdu-99-october-2024-full.png kdu-99-october-2024"
    exit 1
fi

FILENAME="$1"
PAGE_ID="${2:-${FILENAME%-full.png}}"

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

# Copy screenshot
if [ -f "$TEMP_DIR/$FILENAME" ]; then
    cp "$TEMP_DIR/$FILENAME" "$TARGET_DIR/"
    echo "✓ Copied $FILENAME to $TARGET_DIR"
else
    echo "✗ Screenshot not found: $TEMP_DIR/$FILENAME"
    exit 1
fi

# Mark as captured
if [ -n "$PAGE_ID" ]; then
    cd "$(dirname "$0")/.." && npx ts-node scripts/backfill-images.ts mark "$PAGE_ID" 1
fi

