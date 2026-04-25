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
    """
    Normalize OCR text to Spanish license plate format.

    Tipos de matrículas españolas soportadas:
    1. ESTÁNDAR (2000-2025): 4 dígitos + 3 letras (1234ABC, 5678XYZ)
    2. NUEVA SERIE (2025+): N + 4 dígitos + 3 letras (N1234ABC)
    3. HISTÓRICAS (H-plates): H + 4 dígitos + 3 letras (H1234ABC)
    4. CICLOMOTORES: C + 4 dígitos + 3 letras (C1234ABC)
    5. DIPLOMÁTICAS: CD (Cuerpo Diplomático), CC (Cuerpo Consular)
    6. FORMATO ANTIGUO (1971-2000): 2 letras + 4 dígitos + 2 letras (MA0000BA)

    Caracteres válidos: 0-9 y letras excepto A, E, I, O, U, Ñ, Q
    Letras válidas: B, C, D, F, G, H, J, K, L, M, N, P, R, S, T, V, W, X, Y, Z
    """
    import re

    text = text.upper().replace(' ', '').replace('-', '')
    text = ''.join(c for c in text if c.isalnum())

    if not text:
        return ''

    # Pattern 1: ESTÁNDAR ACTUAL - 4 dígitos + 3 letras (1234ABC)
    match = re.search(r'(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{3})', text)
    if match:
        return f"{match.group(1)}{match.group(2)}"

    # Pattern 2: NUEVA SERIE - N + 4 dígitos + 3 letras (N1234ABC)
    match = re.search(r'(N)(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{3})', text)
    if match:
        return f"{match.group(1)}{match.group(2)}{match.group(3)}"

    # Pattern 3: HISTÓRICAS - H + 4 dígitos + 3 letras (H1234ABC)
    match = re.search(r'(H)(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{3})', text)
    if match:
        return f"{match.group(1)}{match.group(2)}{match.group(3)}"

    # Pattern 4: CICLOMOTORES - C + 4 dígitos + 3 letras (C1234ABC)
    match = re.search(r'(C)(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{3})', text)
    if match:
        return f"{match.group(1)}{match.group(2)}{match.group(3)}"

    # Pattern 5: DIPLOMÁTICAS - CD o CC
    match = re.search(r'(CD|CC)', text)
    if match:
        return match.group(1)

    # Pattern 6: FORMATO ANTIGUO PROVINCIAL (1971-2000) - 2 letras + 4 dígitos + 2 letras (MA0000BA)
    match = re.search(r'([BCDFGHJKLMNPRSTVWXYZ]{2})(\d{4})([BCDFGHJKLMNPRSTVWXYZ]{2})', text)
    if match:
        return f"{match.group(1)}{match.group(2)}{match.group(3)}"

    # Fallback: cualquier combinación válida de 6+ caracteres
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
