#!/usr/bin/env python3
"""
PaddleOCR Extractor - License plate and timestamp extraction
Optimized for speed and accuracy with Spanish license plates
"""

import json
import sys
import base64
import io
from PIL import Image

try:
    from paddleocr import PaddleOCR
except ImportError:
    print(json.dumps({
        "error": "PaddleOCR not installed. Run: pip install paddleocr paddlepaddle"
    }))
    sys.exit(1)

# Initialize PaddleOCR once (expensive operation)
ocr = PaddleOCR(
    use_angle_cls=False,  # Disable angle classification (faster)
    lang=['en', 'es'],    # English + Spanish
    show_log=False,       # Reduce logging
)

def normalize_plate(text):
    """Normalize OCR text to Spanish license plate format (4 digits + 3 letters)"""
    import re
    text = text.upper().replace(' ', '').replace('-', '')
    text = ''.join(c for c in text if c.isalnum())
    
    # Look for pattern: 4 digits + 3 letters
    matches = re.findall(r'\d{4}[A-Z]{3}', text)
    if matches:
        return matches[0]
    
    matches = re.findall(r'[A-Z0-9]{6,8}', text)
    if matches:
        return matches[0]
    
    return text if len(text) >= 6 else ''

def normalize_timestamp(text):
    """Extract timestamp from OSD text"""
    import re
    text = text.strip()
    
    time_match = re.search(r'(\d{1,2}):(\d{2}):(\d{2})', text)
    date_match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', text)
    
    result = []
    if date_match:
        result.append(f"{date_match.group(1)}/{date_match.group(2)}/{date_match.group(3)}")
    if time_match:
        result.append(f"{time_match.group(1)}:{time_match.group(2)}:{time_match.group(3)}")
    
    return ' '.join(result) if result else text

def extract_plate(images_b64):
    """Extract license plate from multiple images"""
    candidates = {}
    
    for img_b64 in images_b64[:10]:
        try:
            img_data = base64.b64decode(img_b64)
            img = Image.open(io.BytesIO(img_data))
            result = ocr.ocr(img, cls=False)
            
            for line in result:
                for word_info in line:
                    text = word_info[1]
                    normalized = normalize_plate(text)
                    if normalized:
                        candidates[normalized] = candidates.get(normalized, 0) + 1
        except Exception as e:
            print(f"[OCR_ERROR] {str(e)}", file=sys.stderr)
            continue
    
    if candidates:
        best_plate = max(candidates, key=candidates.get)
        return {
            "plate": best_plate,
            "candidates": list(candidates.keys()),
            "confidence": candidates[best_plate] / max(1, len(images_b64))
        }
    
    return {"plate": "", "candidates": [], "confidence": 0}

def extract_timestamp(image_b64):
    """Extract timestamp from OSD region"""
    try:
        img_data = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_data))
        result = ocr.ocr(img, cls=False)
        
        texts = []
        for line in result:
            for word_info in line:
                texts.append(word_info[1])
        
        combined_text = ' '.join(texts)
        normalized = normalize_timestamp(combined_text)
        
        return {
            "timestamp": normalized,
            "raw_text": combined_text,
            "confidence": len(texts) > 0
        }
    except Exception as e:
        print(f"[OCR_ERROR] {str(e)}", file=sys.stderr)
        return {"timestamp": "", "raw_text": "", "confidence": False}

def main():
    try:
        request_json = sys.stdin.read()
        request = json.loads(request_json)
        operation = request.get("operation")
        
        if operation == "extract_plate":
            result = extract_plate(request.get("images", []))
            print(json.dumps(result))
        elif operation == "extract_timestamp":
            result = extract_timestamp(request.get("image", ""))
            print(json.dumps(result))
        else:
            print(json.dumps({"error": f"Unknown operation: {operation}"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Error: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
