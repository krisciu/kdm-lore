#!/usr/bin/env python3
"""
Extract ALL assets from Kingdom Death Simulator Unity bundles.
Includes: Text, Images, Textures, Sprites, Audio references, and more.
"""

import UnityPy
import os
import json
from pathlib import Path
from PIL import Image
import io

# Paths
KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted")

def extract_assets(bundle_path, output_dir):
    """Extract all assets from a Unity bundle."""
    print(f"\nProcessing: {bundle_path.name}")
    
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  Error loading bundle: {e}")
        return {"text": 0, "images": 0, "sprites": 0, "other": 0}
    
    counts = {"text": 0, "images": 0, "sprites": 0, "audio": 0, "other": 0}
    
    # Create subdirectories
    (output_dir / "text").mkdir(exist_ok=True)
    (output_dir / "images").mkdir(exist_ok=True)
    (output_dir / "sprites").mkdir(exist_ok=True)
    (output_dir / "data").mkdir(exist_ok=True)
    
    for obj in env.objects:
        try:
            obj_type = obj.type.name
            
            # TextAsset - plain text data
            if obj_type == "TextAsset":
                data = obj.read()
                name = data.m_Name
                text = data.m_Script
                
                if isinstance(text, bytes):
                    # Check if it's binary data (like PDF)
                    if text[:4] == b'%PDF':
                        output_file = output_dir / "text" / f"{name}.pdf"
                        output_file.write_bytes(text)
                        print(f"  Extracted PDF: {name}")
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
            
            # Texture2D - images
            elif obj_type == "Texture2D":
                data = obj.read()
                name = data.m_Name
                
                # Skip tiny textures (likely UI elements)
                if data.m_Width < 32 or data.m_Height < 32:
                    continue
                
                try:
                    img = data.image
                    if img:
                        # Determine format based on content
                        if data.m_Width > 512 or data.m_Height > 512:
                            output_file = output_dir / "images" / f"{name}.png"
                        else:
                            output_file = output_dir / "images" / f"{name}.png"
                        
                        img.save(str(output_file))
                        print(f"  Extracted Texture: {name} ({data.m_Width}x{data.m_Height})")
                        counts["images"] += 1
                except Exception as e:
                    pass
            
            # Sprite - game sprites
            elif obj_type == "Sprite":
                data = obj.read()
                name = data.m_Name
                
                try:
                    img = data.image
                    if img and img.width >= 32 and img.height >= 32:
                        output_file = output_dir / "sprites" / f"{name}.png"
                        img.save(str(output_file))
                        print(f"  Extracted Sprite: {name}")
                        counts["sprites"] += 1
                except:
                    pass
            
            # MonoBehaviour - game data
            elif obj_type == "MonoBehaviour":
                data = obj.read()
                if hasattr(data, 'm_Name') and data.m_Name:
                    name = data.m_Name
                    try:
                        tree = obj.read_typetree()
                        if tree:
                            # Filter for interesting data
                            tree_str = json.dumps(tree, default=str)
                            if len(tree_str) > 100:
                                output_file = output_dir / "data" / f"{name}.json"
                                output_file.write_text(json.dumps(tree, indent=2, default=str))
                                counts["other"] += 1
                    except:
                        pass
            
            # AudioClip - audio references
            elif obj_type == "AudioClip":
                data = obj.read()
                name = data.m_Name
                # Just log audio files found (extraction is complex)
                print(f"  Found AudioClip: {name}")
                counts["audio"] += 1
                
        except Exception as e:
            continue
    
    return counts

def main():
    print("=" * 70)
    print("Kingdom Death Simulator - Full Asset Extraction")
    print("=" * 70)
    
    total_counts = {"text": 0, "images": 0, "sprites": 0, "audio": 0, "other": 0}
    
    # Main game resources
    main_resources = KD_SIM_PATH / "0.1.250/Kingdom Death Simulator.app/Contents/Resources/Data/resources.assets"
    if main_resources.exists():
        core_output = OUTPUT_PATH / "core"
        core_output.mkdir(parents=True, exist_ok=True)
        counts = extract_assets(main_resources, core_output)
        for k, v in counts.items():
            total_counts[k] += v
    
    # Shared assets
    shared_assets = KD_SIM_PATH / "0.1.250/Kingdom Death Simulator.app/Contents/Resources/Data/sharedassets0.assets"
    if shared_assets.exists():
        shared_output = OUTPUT_PATH / "shared"
        shared_output.mkdir(parents=True, exist_ok=True)
        counts = extract_assets(shared_assets, shared_output)
        for k, v in counts.items():
            total_counts[k] += v
    
    # DLC bundles
    dlc_path = KD_SIM_PATH / "DLC"
    if dlc_path.exists():
        for dlc_dir in sorted(dlc_path.iterdir()):
            if dlc_dir.is_dir():
                bundles_dir = dlc_dir / "Bundles"
                if bundles_dir.exists():
                    dlc_output = OUTPUT_PATH / dlc_dir.name
                    dlc_output.mkdir(parents=True, exist_ok=True)
                    
                    for bundle in bundles_dir.glob("*.bundle"):
                        counts = extract_assets(bundle, dlc_output)
                        for k, v in counts.items():
                            total_counts[k] += v
    
    print("\n" + "=" * 70)
    print("EXTRACTION COMPLETE")
    print("=" * 70)
    print(f"  Text assets:   {total_counts['text']}")
    print(f"  Images:        {total_counts['images']}")
    print(f"  Sprites:       {total_counts['sprites']}")
    print(f"  Audio refs:    {total_counts['audio']}")
    print(f"  Data files:    {total_counts['other']}")
    print(f"\nOutput: {OUTPUT_PATH}")
    print("=" * 70)

if __name__ == "__main__":
    main()

