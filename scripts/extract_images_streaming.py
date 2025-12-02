#!/usr/bin/env python3
"""
Memory-efficient image extraction from Unity bundles.
Uses object filtering and immediate cleanup.
"""

import UnityPy
from pathlib import Path
import gc
import sys

KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted/images")

def extract_images_from_bundle(bundle_path, output_subdir, keywords=None):
    """Extract images matching keywords from bundle."""
    output_dir = OUTPUT_PATH / output_subdir
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Processing: {bundle_path.name}")
    size_mb = bundle_path.stat().st_size / 1024 / 1024
    print(f"  Size: {size_mb:.1f} MB")
    
    if size_mb > 600:
        print("  Skipping (too large for memory)")
        return 0
    
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  Error: {e}")
        return 0
    
    count = 0
    
    for obj in env.objects:
        if obj.type.name != "Texture2D":
            continue
        
        try:
            data = obj.read()
            name = data.m_Name
            
            # Filter by keywords if provided
            if keywords:
                if not any(k.lower() in name.lower() for k in keywords):
                    continue
            
            # Skip small textures
            if data.m_Width < 256 or data.m_Height < 256:
                continue
            
            # Skip common noise
            skip = ['atlas', 'font', 'sdf', 'noise', 'grid', 'default', 'lightmap', 'shadow']
            if any(s in name.lower() for s in skip):
                continue
            
            img = data.image
            if img:
                output_file = output_dir / f"{name}.png"
                img.save(str(output_file))
                print(f"  {name} ({data.m_Width}x{data.m_Height})")
                count += 1
                
                # Cleanup
                del img
                gc.collect()
                
        except Exception as e:
            continue
    
    del env
    gc.collect()
    
    print(f"  Total: {count} images")
    return count

def main():
    total = 0
    
    # Process heirlooms (smaller bundle)
    heirlooms = KD_SIM_PATH / "DLC/heirlooms-mac_0.1.247/Bundles"
    for b in heirlooms.glob("*_assets_*.bundle"):
        total += extract_images_from_bundle(b, "heirlooms")
    
    # Process system-ui
    system_ui = KD_SIM_PATH / "DLC/system-ui-mac_0.1.247/Bundles"
    for b in system_ui.glob("*_assets_*.bundle"):
        total += extract_images_from_bundle(b, "system-ui")
    
    # Process common-content
    common = KD_SIM_PATH / "DLC/common-content-mac_0.1.247/Bundles"
    for b in common.glob("*_assets_*.bundle"):
        total += extract_images_from_bundle(b, "common-content")
    
    # Process train-scene (smaller)
    train = KD_SIM_PATH / "DLC/train-scene-mac_0.1.235/Bundles"
    for b in train.glob("*_assets_*.bundle"):
        total += extract_images_from_bundle(b, "train-scene")
    
    # Process entrance-scene
    entrance = KD_SIM_PATH / "DLC/entrance-scene-mac_0.1.235/Bundles"
    for b in entrance.glob("*_assets_*.bundle"):
        total += extract_images_from_bundle(b, "entrance-scene")
    
    print(f"\n{'='*60}")
    print(f"Total extracted: {total} images")
    print(f"Output: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()

