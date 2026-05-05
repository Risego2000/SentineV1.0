#!/usr/bin/env python3
"""
Download YOLO models required for Sentinel
Includes base detection and specialized license plate models
"""

import os
import sys
import urllib.request
from pathlib import Path

def download_model(url, filepath, description="Model"):
    """Download a model file"""
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)

    if filepath.exists():
        print(f"[OK] {description} already exists: {filepath}")
        return True

    try:
        print(f"[...] Downloading {description}...")
        print(f"      From: {url}")
        print(f"      To:   {filepath}")

        urllib.request.urlretrieve(url, str(filepath))
        print(f"[OK] Downloaded {description}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to download {description}: {e}")
        return False

def main():
    """Download all required YOLO models"""
    models = [
        {
            "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8s.pt",
            "filepath": "yolov8s.pt",
            "description": "YOLOv8 Small (22MB) - For better license plate detection"
        },
        {
            "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt",
            "filepath": "yolov8n.pt",
            "description": "YOLOv8 Nano (6.2MB) - Fast vehicle detection"
        },
    ]

    print("=" * 60)
    print("SENTINEL - YOLO Model Downloader")
    print("=" * 60)

    success_count = 0
    for model in models:
        if download_model(model["url"], model["filepath"], model["description"]):
            success_count += 1
        print()

    print("=" * 60)
    print(f"Downloaded {success_count}/{len(models)} models")
    print("=" * 60)

    if success_count == len(models):
        print("[OK] All models ready!")
        return 0
    else:
        print("[WARN] Some models failed to download. Installation may be incomplete.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
