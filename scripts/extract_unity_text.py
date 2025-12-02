#!/usr/bin/env python3
"""
Extract text assets from Kingdom Death Simulator Unity bundles.
Uses UnityPy to properly parse Unity asset format.
"""

import UnityPy
import os
import json
from pathlib import Path

# Paths
KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"
OUTPUT_PATH = Path("/Users/krisciu/workspace/kdm-lore/docs/lore/sources/rulebooks/extracted")

def extract_text_assets(bundle_path, output_dir):
    """Extract text assets from a Unity bundle."""
    print(f"\nProcessing: {bundle_path.name}")
    
    try:
        env = UnityPy.load(str(bundle_path))
    except Exception as e:
        print(f"  Error loading bundle: {e}")
        return []
    
    extracted = []
    
    for obj in env.objects:
        try:
            # Get object type
            obj_type = obj.type.name
            
            # Extract TextAsset objects (plain text data)
            if obj_type == "TextAsset":
                data = obj.read()
                name = data.m_Name
                text = data.m_Script
                
                if isinstance(text, bytes):
                    text = text.decode('utf-8', errors='ignore')
                
                # Skip empty or very short text
                if len(text) > 50:
                    output_file = output_dir / f"{name}.txt"
                    output_file.write_text(text)
                    extracted.append(name)
                    print(f"  Extracted TextAsset: {name} ({len(text)} chars)")
            
            # Extract MonoBehaviour objects (game data/scripts)
            elif obj_type == "MonoBehaviour":
                data = obj.read()
                if hasattr(data, 'm_Name') and data.m_Name:
                    name = data.m_Name
                    
                    # Try to get readable data
                    try:
                        tree = obj.read_typetree()
                        if tree:
                            output_file = output_dir / f"mono_{name}.json"
                            output_file.write_text(json.dumps(tree, indent=2, default=str))
                            extracted.append(f"mono_{name}")
                            print(f"  Extracted MonoBehaviour: {name}")
                    except:
                        pass
            
            # Extract Sprite names and associated data
            elif obj_type == "Sprite":
                data = obj.read()
                name = data.m_Name
                if "rulebook" in name.lower() or "rule" in name.lower():
                    print(f"  Found Sprite: {name}")
                    extracted.append(f"sprite_{name}")
                    
        except Exception as e:
            continue
    
    return extracted

def main():
    # Create output directory
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("Kingdom Death Simulator - Unity Asset Extraction")
    print("=" * 60)
    
    all_extracted = []
    
    # Main game resources
    main_resources = KD_SIM_PATH / "0.1.250/Kingdom Death Simulator.app/Contents/Resources/Data/resources.assets"
    if main_resources.exists():
        core_output = OUTPUT_PATH / "core"
        core_output.mkdir(exist_ok=True)
        extracted = extract_text_assets(main_resources, core_output)
        all_extracted.extend(extracted)
    
    # DLC bundles
    dlc_path = KD_SIM_PATH / "DLC"
    if dlc_path.exists():
        for dlc_dir in dlc_path.iterdir():
            if dlc_dir.is_dir():
                bundles_dir = dlc_dir / "Bundles"
                if bundles_dir.exists():
                    dlc_output = OUTPUT_PATH / dlc_dir.name
                    dlc_output.mkdir(exist_ok=True)
                    
                    for bundle in bundles_dir.glob("*.bundle"):
                        extracted = extract_text_assets(bundle, dlc_output)
                        all_extracted.extend(extracted)
    
    print("\n" + "=" * 60)
    print(f"Total assets extracted: {len(all_extracted)}")
    print(f"Output directory: {OUTPUT_PATH}")
    print("=" * 60)

if __name__ == "__main__":
    main()

