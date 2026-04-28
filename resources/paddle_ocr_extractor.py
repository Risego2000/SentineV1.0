#!/usr/bin/env python3
"""
PaddleOCR License Plate Extractor
Extracts license plates from base64-encoded images using PaddleOCR
"""

import json
import sys
import base64
import io
from pathlib import Path

try:
    from PIL import Image
    from paddleocr import PaddleOCR
except ImportError as e:
    print(json.dumps({
        "error": f"Missing dependency: {e}",
        "plate": None,
        "candidates": [],
        "confidence": 0
    }))
    sys.exit(1)

def extract_plate(image_base64: str):
    """
    Extract license plate from base64-encoded image
    Returns JSON with plate text and confidence
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))

        # Initialize PaddleOCR (downloads models on first run)
        ocr = PaddleOCR(use_angle_cls=True, lang='en')

        # Perform OCR
        result = ocr.ocr(image, cls=True)

        # Process results - PaddleOCR returns list of list of (text, confidence) tuples
        candidates = []
        if result and result[0]:
            for line in result[0]:
                text = line[0]
                confidence = line[1]

                # Filter for likely plate candidates (numbers and letters)
                if text and len(text) >= 4:
                    candidates.append({
                        "text": text.upper().strip(),
                        "confidence": float(confidence)
                    })

        # Sort by confidence and return top candidates
        candidates.sort(key=lambda x: x["confidence"], reverse=True)

        # Get best candidate
        best_plate = None
        best_confidence = 0
        if candidates:
            best_plate = candidates[0]["text"]
            best_confidence = candidates[0]["confidence"]

        return {
            "plate": best_plate,
            "candidates": candidates[:5],  # Top 5 candidates
            "confidence": best_confidence,
            "method": "paddleocr"
        }

    except Exception as e:
        return {
            "error": str(e),
            "plate": None,
            "candidates": [],
            "confidence": 0,
            "method": "paddleocr"
        }

def detect_plate_region(image_base64: str):
    """
    Detect license plate region in image (bounding box)
    Returns x, y, width, height coordinates
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))
        image_width, image_height = image.size

        # Initialize PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang='en')

        # Perform OCR with bounding boxes
        result = ocr.ocr(image, cls=True)

        if not result or not result[0]:
            return None

        # Find bounding box for first text line
        first_line = result[0][0]
        bbox = first_line[0]  # List of [x, y] coordinates

        # Convert polygon to bounding box (x, y, width, height)
        xs = [point[0] for point in bbox]
        ys = [point[1] for point in bbox]

        x = min(xs)
        y = min(ys)
        width = max(xs) - x
        height = max(ys) - y

        # Normalize to 0-1 range
        return {
            "x": x / image_width,
            "y": y / image_height,
            "width": width / image_width,
            "height": height / image_height,
            "confidence": float(first_line[1])
        }

    except Exception as e:
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing image argument"}))
        sys.exit(1)

    mode = sys.argv[1]
    image_base64 = sys.argv[2] if len(sys.argv) > 2 else ""

    try:
        if mode == "extract-plate":
            result = extract_plate(image_base64)
        elif mode == "detect-region":
            result = detect_plate_region(image_base64)
        else:
            result = {"error": f"Unknown mode: {mode}"}

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
