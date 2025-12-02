#!/usr/bin/env python3
"""
Extract assets from Kingdom Death Simulator - Core game only.
Handles memory better by processing one file at a time.
"""

import UnityPy
import os
import json
from pathlib import Path

# Paths
KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted")

def extract_assets(bundle_path, output_dir):
    """Extract assets from a Unity bundle."""
    print(f"\nProcessing: {bundle_path.name}")
    
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  Error loading bundle: {e}")
        return {"text": 0, "images": 0, "sprites": 0}
    
    counts = {"text": 0, "images": 0, "sprites": 0}
    
    # Create subdirectories
    (output_dir / "text").mkdir(parents=True, exist_ok=True)
    (output_dir / "images").mkdir(parents=True, exist_ok=True)
    (output_dir / "sprites").mkdir(parents=True, exist_ok=True)
    
    for obj in env.objects:
        try:
            obj_type = obj.type.name
            
            # TextAsset
            if obj_type == "TextAsset":
                data = obj.read()
                name = data.m_Name
                text = data.m_Script
                
                if isinstance(text, bytes):
                    if text[:4] == b'%PDF':
                        output_file = output_dir / "text" / f"{name}.pdf"
                        output_file.write_bytes(text)
                        print(f"  PDF: {name}")
                        counts["text"] += 1
                    else:
                        try:
                            text = text.decode('utf-8', errors='ignore')
                            if len(text) > 20:
                                output_file = output_dir / "text" / f"{name}.txt"
                                output_file.write_text(text)
                                counts["text"] += 1
                        except:
                            pass
                elif len(str(text)) > 20:
                    output_file = output_dir / "text" / f"{name}.txt"
                    output_file.write_text(str(text))
                    counts["text"] += 1
            
            # Texture2D - larger images only
            elif obj_type == "Texture2D":
                data = obj.read()
                name = data.m_Name
                
                # Only extract meaningful images
                if data.m_Width < 64 or data.m_Height < 64:
                    continue
                
                # Skip common Unity textures
                skip_names = ['unity', 'default', 'uisprite', 'background', 'white', 'black', 'noise']
                if any(s in name.lower() for s in skip_names):
                    continue
                
                try:
                    img = data.image
                    if img:
                        output_file = output_dir / "images" / f"{name}.png"
                        img.save(str(output_file))
                        print(f"  Image: {name} ({data.m_Width}x{data.m_Height})")
                        counts["images"] += 1
                except:
                    pass
            
            # Sprite
            elif obj_type == "Sprite":
                data = obj.read()
                name = data.m_Name
                
                # Skip small sprites
                try:
                    img = data.image
                    if img and img.width >= 64 and img.height >= 64:
                        output_file = output_dir / "sprites" / f"{name}.png"
                        img.save(str(output_file))
                        print(f"  Sprite: {name}")
                        counts["sprites"] += 1
                except:
                    pass
                    
        except Exception as e:
            continue
    
    # Clear memory
    del env
    
    return counts

def main():
    print("=" * 70)
    print("Kingdom Death Simulator - Core Asset Extraction")
    print("=" * 70)
    
    total = {"text": 0, "images": 0, "sprites": 0}
    
    # Core resources
    core_output = OUTPUT_PATH / "core"
    
    resources = KD_SIM_PATH / "0.1.250/Kingdom Death Simulator.app/Contents/Resources/Data/resources.assets"
    if resources.exists():
        counts = extract_assets(resources, core_output)
        for k, v in counts.items():
            total[k] += v
    
    # Shared assets
    shared = KD_SIM_PATH / "0.1.250/Kingdom Death Simulator.app/Contents/Resources/Data/sharedassets0.assets"
    if shared.exists():
        counts = extract_assets(shared, core_output)
        for k, v in counts.items():
            total[k] += v
    
    print("\n" + "=" * 70)
    print(f"Core extraction complete:")
    print(f"  Text: {total['text']}, Images: {total['images']}, Sprites: {total['sprites']}")
    print("=" * 70)

if __name__ == "__main__":
    main()

