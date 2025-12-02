#!/usr/bin/env python3
"""
Extract rulebook images from Kingdom Death Simulator.
Specifically targets kd-rulebook-* textures.
"""

import UnityPy
import os
from pathlib import Path
import gc

KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted/images/rulebook-pages")

def extract_rulebook_images():
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    
    # Core expansion has the rulebook
    bundle_path = KD_SIM_PATH / "DLC/core-expansion-mac_0.1.247/Bundles/core-expansion_assets_all_5386a04b12a3d0c7c8a478a6f17446a7.bundle"
    
    print(f"Loading bundle: {bundle_path.name}")
    print("This may take a moment...")
    
    env = UnityPy.load(str(bundle_path))
    
    extracted = 0
    
    for obj in env.objects:
        if obj.type.name == "Texture2D":
            try:
                data = obj.read()
                name = data.m_Name
                
                # Extract rulebook pages
                if "rulebook" in name.lower() or "RuleBook" in name:
                    img = data.image
                    if img:
                        output_file = OUTPUT_PATH / f"{name}.png"
                        img.save(str(output_file))
                        print(f"  Extracted: {name} ({data.m_Width}x{data.m_Height})")
                        extracted += 1
                
                # Also extract other interesting images
                elif any(x in name.lower() for x in ['card', 'monster', 'survivor', 'gear', 'event', 'hunt', 'settlement', 'showdown', 'board']):
                    if data.m_Width >= 512 and data.m_Height >= 512:
                        img = data.image
                        if img:
                            # Put in separate folder
                            other_dir = OUTPUT_PATH.parent / "game-assets"
                            other_dir.mkdir(exist_ok=True)
                            output_file = other_dir / f"{name}.png"
                            img.save(str(output_file))
                            print(f"  Extracted: {name} ({data.m_Width}x{data.m_Height})")
                            extracted += 1
                            
            except Exception as e:
                continue
    
    del env
    gc.collect()
    
    print(f"\nTotal extracted: {extracted} images")
    print(f"Output: {OUTPUT_PATH}")

if __name__ == "__main__":
    extract_rulebook_images()

