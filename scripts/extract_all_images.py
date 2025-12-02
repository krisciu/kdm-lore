#!/usr/bin/env python3
"""
Extract images from all KD Simulator bundles in batches.
Handles memory by processing limited images per bundle.
"""

import UnityPy
from pathlib import Path
import gc
import sys

KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted/images")

def extract_from_bundle(bundle_path, output_dir, max_images=100, min_size=256):
    """Extract images from a single bundle."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    size_mb = bundle_path.stat().st_size / 1024 / 1024
    print(f"\n{bundle_path.name} ({size_mb:.1f} MB)")
    
    if size_mb > 500:
        print("  Skipping (too large)")
        return 0
    
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  Error: {e}")
        return 0
    
    count = 0
    skip_names = ['atlas', 'font', 'sdf', 'noise', 'lightmap', 'shadow', 'default', 'gradient']
    
    for obj in env.objects:
        if obj.type.name != "Texture2D":
            continue
        
        try:
            data = obj.read()
            name = data.m_Name
            
            if data.m_Width < min_size or data.m_Height < min_size:
                continue
            
            if any(s in name.lower() for s in skip_names):
                continue
            
            img = data.image
            if img:
                output_file = output_dir / f"{name}.png"
                if not output_file.exists():  # Don't overwrite
                    img.save(str(output_file))
                    print(f"  {name} ({data.m_Width}x{data.m_Height})")
                    count += 1
                
                del img
                gc.collect()
                
                if count >= max_images:
                    print(f"  Reached limit ({max_images})")
                    break
                    
        except:
            continue
    
    del env
    gc.collect()
    
    return count

def main():
    total = 0
    
    # Define bundles to process with their output folders
    bundles_config = [
        ("heirlooms-mac_0.1.247", "heirlooms", 100),
        ("system-ui-mac_0.1.247", "system-ui", 50),
        ("common-content-mac_0.1.247", "common-content", 100),
        ("train-scene-mac_0.1.235", "train-scene", 50),
        ("entrance-scene-mac_0.1.235", "entrance-scene", 50),
        ("common-scene-content-mac_0.1.235", "common-scene", 30),
    ]
    
    for dlc_name, output_name, max_imgs in bundles_config:
        dlc_path = KD_SIM_PATH / "DLC" / dlc_name / "Bundles"
        if dlc_path.exists():
            for bundle in dlc_path.glob("*_assets_*.bundle"):
                output_dir = OUTPUT_PATH / output_name
                total += extract_from_bundle(bundle, output_dir, max_imgs)
    
    print(f"\n{'='*60}")
    print(f"Total: {total} images extracted")
    print(f"Output: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()

