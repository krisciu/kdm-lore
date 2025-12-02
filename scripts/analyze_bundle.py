#!/usr/bin/env python3
"""Analyze what's in a Unity bundle."""

import UnityPy
import sys
from pathlib import Path
from collections import Counter

KD_SIM_PATH = Path.home() / ".local/share/Launcher Of Death/KingdomDeathSimulator"

def analyze(bundle_path):
    print(f"\nAnalyzing: {bundle_path.name}")
    print(f"Size: {bundle_path.stat().st_size / 1024 / 1024:.1f} MB")
    
    env = UnityPy.load(str(bundle_path))
    
    types = Counter()
    textures = []
    text_assets = []
    sprites = []
    
    for obj in env.objects:
        types[obj.type.name] += 1
        
        if obj.type.name == "Texture2D":
            try:
                data = obj.read()
                textures.append((data.m_Name, data.m_Width, data.m_Height))
            except:
                pass
        
        elif obj.type.name == "TextAsset":
            try:
                data = obj.read()
                text_assets.append((data.m_Name, len(data.m_Script) if data.m_Script else 0))
            except:
                pass
        
        elif obj.type.name == "Sprite":
            try:
                data = obj.read()
                sprites.append(data.m_Name)
            except:
                pass
    
    print("\nObject Types:")
    for t, c in types.most_common(20):
        print(f"  {t}: {c}")
    
    if textures:
        print(f"\nTextures ({len(textures)} total, showing largest):")
        for name, w, h in sorted(textures, key=lambda x: x[1]*x[2], reverse=True)[:20]:
            print(f"  {name}: {w}x{h}")
    
    if text_assets:
        print(f"\nText Assets ({len(text_assets)} total, showing largest):")
        for name, size in sorted(text_assets, key=lambda x: x[1], reverse=True)[:20]:
            print(f"  {name}: {size} bytes")
    
    if sprites:
        print(f"\nSprites ({len(sprites)} total, first 20):")
        for name in sprites[:20]:
            print(f"  {name}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "resources"
    
    if target == "resources":
        path = KD_SIM_PATH / "0.1.250/Kingdom Death Simulator.app/Contents/Resources/Data/resources.assets"
    else:
        # Find matching bundle
        for dlc in (KD_SIM_PATH / "DLC").iterdir():
            if target in dlc.name:
                for b in (dlc / "Bundles").glob("*_assets_*.bundle"):
                    path = b
                    break
    
    if path.exists():
        analyze(path)

