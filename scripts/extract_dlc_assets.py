#!/usr/bin/env python3
"""
Extract assets from Kingdom Death Simulator DLC bundles.
Processes one bundle at a time to manage memory.
"""

import UnityPy
import os
import json
import sys
from pathlib import Path
import gc

KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted")

def extract_bundle(bundle_path, output_dir, extract_images=True):
    """Extract assets from a single bundle."""
    print(f"\nProcessing: {bundle_path.name} ({bundle_path.stat().st_size / 1024 / 1024:.1f} MB)")
    
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  Error: {e}")
        return
    
    (output_dir / "text").mkdir(parents=True, exist_ok=True)
    if extract_images:
        (output_dir / "images").mkdir(parents=True, exist_ok=True)
        (output_dir / "sprites").mkdir(parents=True, exist_ok=True)
    
    counts = {"text": 0, "images": 0, "sprites": 0}
    
    for obj in env.objects:
        try:
            obj_type = obj.type.name
            
            if obj_type == "TextAsset":
                data = obj.read()
                name = data.m_Name
                text = data.m_Script
                
                if isinstance(text, bytes):
                    if text[:4] == b'%PDF':
                        (output_dir / "text" / f"{name}.pdf").write_bytes(text)
                        print(f"  PDF: {name}")
                        counts["text"] += 1
                    else:
                        try:
                            decoded = text.decode('utf-8', errors='ignore')
                            if len(decoded) > 50:
                                (output_dir / "text" / f"{name}.txt").write_text(decoded)
                                counts["text"] += 1
                        except:
                            pass
                elif text and len(str(text)) > 50:
                    (output_dir / "text" / f"{name}.txt").write_text(str(text))
                    counts["text"] += 1
            
            elif obj_type == "Texture2D" and extract_images:
                data = obj.read()
                name = data.m_Name
                
                # Only large, meaningful textures
                if data.m_Width >= 128 and data.m_Height >= 128:
                    # Filter out common noise
                    skip = ['atlas', 'font', 'sdf', 'noise', 'grid', 'gradient', 'default', 'lightmap']
                    if not any(s in name.lower() for s in skip):
                        try:
                            img = data.image
                            if img:
                                (output_dir / "images" / f"{name}.png").save(img)
                                img.save(str(output_dir / "images" / f"{name}.png"))
                                print(f"  Image: {name} ({data.m_Width}x{data.m_Height})")
                                counts["images"] += 1
                        except:
                            pass
            
            elif obj_type == "Sprite" and extract_images:
                data = obj.read()
                name = data.m_Name
                try:
                    img = data.image
                    if img and img.width >= 128 and img.height >= 128:
                        img.save(str(output_dir / "sprites" / f"{name}.png"))
                        print(f"  Sprite: {name}")
                        counts["sprites"] += 1
                except:
                    pass
                    
        except:
            continue
    
    del env
    gc.collect()
    
    print(f"  Extracted: {counts['text']} text, {counts['images']} images, {counts['sprites']} sprites")
    return counts

def main():
    print("=" * 70)
    print("Kingdom Death Simulator - DLC Asset Extraction")
    print("=" * 70)
    
    dlc_path = KD_SIM_PATH / "DLC"
    
    # Process specific DLC or all
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    for dlc_dir in sorted(dlc_path.iterdir()):
        if not dlc_dir.is_dir():
            continue
            
        if target != "all" and target not in dlc_dir.name:
            continue
        
        bundles_dir = dlc_dir / "Bundles"
        if not bundles_dir.exists():
            continue
        
        output_dir = OUTPUT_PATH / dlc_dir.name
        
        for bundle in bundles_dir.glob("*_assets_*.bundle"):
            # Skip huge bundles for images (just extract text)
            size_mb = bundle.stat().st_size / 1024 / 1024
            extract_images = size_mb < 500  # Only extract images from smaller bundles
            
            extract_bundle(bundle, output_dir, extract_images)
    
    print("\n" + "=" * 70)
    print("Done!")
    print("=" * 70)

if __name__ == "__main__":
    main()

