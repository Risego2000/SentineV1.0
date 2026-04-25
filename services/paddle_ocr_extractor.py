#!/usr/bin/env python3
"""
PaddleOCR Extractor - License plate and timestamp extraction
Optimized for speed and accuracy with Spanish license plates
WITH IMAGE ENHANCEMENT (HR + preprocessing)
"""

import json
import sys
import base64
import io
import re
from datetime import datetime
import cv2
import numpy as np
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

def enhance_image_for_ocr(img, target_height=600):
    """
    Enhance image before OCR for maximum accuracy.
    Pipeline:
    1. Upsampling si necesario (HR)
    2. CLAHE contrast enhancement
    3. Bilateral denoising
    4. Sharpening
    5. Adaptive thresholding
    6. Morphological cleanup
    """
    try:
        original_height = img.shape[0]

        # 1. UPSAMPLING (Super-Resolution)
        if original_height < target_height:
            scale = target_height / original_height
            new_width = int(img.shape[1] * scale)
            img = cv2.resize(img, (new_width, target_height), interpolation=cv2.INTER_CUBIC)
            # Sharpening post-upsampling
            kernel = np.array([[-1,-1,-1],
                              [-1, 9,-1],
                              [-1,-1,-1]]) / 1.0
            img = cv2.filter2D(img, -1, kernel)

        # 2. Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

        # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # 4. BILATERAL DENOISING (preserves edges)
        denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)

        # 5. SHARPENING (Unsharp Mask)
        gaussian = cv2.GaussianBlur(denoised, (0, 0), 2.0)
        sharpened = cv2.addWeighted(denoised, 1.5, gaussian, -0.5, 0)

        # 6. MORPHOLOGICAL OPERATIONS
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        morph = cv2.morphologyEx(sharpened, cv2.MORPH_CLOSE, kernel, iterations=1)
        morph = cv2.morphologyEx(morph, cv2.MORPH_OPEN, kernel, iterations=1)

        # 7. ADAPTIVE THRESHOLD (binarization para OCR)
        binary = cv2.adaptiveThreshold(morph, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 11, 2)

        return binary
    except Exception as e:
        print(f"[OCR_ENHANCE] Enhancement failed: {str(e)}", file=sys.stderr)
        # Return original image if enhancement fails
        return gray if 'gray' in locals() else img

def detect_and_crop_license_plate(img):
    """
    Detect license plate region and return cropped image.
    Strategies:
    1. Find white/yellow rectangular region in lower half (Spanish plates have white/yellow backgrounds)
    2. Use Canny edge detection to find strong edges (plate borders)
    3. Crop region to maximize plate visibility

    Returns: cropped_image or original_image if detection fails
    """
    try:
        h, w = img.shape[:2]

        # Focus on lower 40% of image where license plates typically are
        roi_start = int(h * 0.5)
        roi = img[roi_start:, :]
        roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi

        # Edge detection - look for sharp boundaries (plate edges)
        edges = cv2.Canny(roi_gray, 30, 100)

        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Look for rectangular contours (license plates are rectangular)
        best_crop = None
        best_score = 0

        for contour in contours:
            area = cv2.contourArea(contour)

            # License plates have specific size ranges
            # Typical plate: 520×110mm, ratio ~4.7:1
            if area < 500:  # Too small
                continue

            x, y, bw, bh = cv2.boundingRect(contour)
            ratio = bw / (bh + 0.1)  # Aspect ratio

            # Spanish plates are wider than tall (roughly 4-6:1)
            if 2.5 < ratio < 7.5:
                # Score based on how much it looks like a plate
                score = area * (1 if 3 < ratio < 6 else 0.5)

                if score > best_score:
                    best_score = score
                    # Crop with margin
                    margin = int(bh * 0.2)
                    x1 = max(0, x - margin)
                    y1 = max(0, y - margin + roi_start)
                    x2 = min(w, x + bw + margin)
                    y2 = min(h, y + bh + margin + roi_start)
                    best_crop = img[y1:y2, x1:x2]

        if best_crop is not None and best_crop.shape[0] > 20 and best_crop.shape[1] > 50:
            return best_crop
        else:
            # Fallback: crop bottom 25% where plates are typically located
            fallback_crop = img[int(h * 0.6):int(h * 0.95), int(w * 0.1):int(w * 0.9)]
            if fallback_crop.shape[0] > 10 and fallback_crop.shape[1] > 30:
                return fallback_crop

        return img  # Return full image if cropping fails

    except Exception as e:
        print(f"[PLATE_CROP] Detection failed: {str(e)}", file=sys.stderr)
        return img  # Return original image on error

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
    """
    Extract license plate from multiple images with enhancement.

    Process:
    1. Decode base64 → OpenCV image
    2. Enhance image (HR upsampling + preprocessing)
    3. PaddleOCR extraction
    4. Normalize to Spanish plate format
    5. Voting mechanism (pick most common)
    """
    candidates = {}
    enhancement_metrics = []

    for idx, img_b64 in enumerate(images_b64[:10]):  # Max 10 images
        try:
            # 1. DECODE
            img_data = base64.b64decode(img_b64)
            img = cv2.imdecode(np.frombuffer(img_data, np.uint8), cv2.IMREAD_COLOR)

            if img is None:
                print(f"[OCR] Image {idx}: decode failed", file=sys.stderr)
                continue

            # 1.5. CROP LICENSE PLATE REGION (NEW - incremental improvement)
            cropped_img = detect_and_crop_license_plate(img)

            # 2. ENHANCE
            enhanced_img = enhance_image_for_ocr(cropped_img, target_height=600)
            enhancement_metrics.append({
                "image_idx": idx,
                "enhancement_applied": True,
                "original_shape": img.shape,
                "enhanced_shape": enhanced_img.shape
            })

            # 3. OCR ON ENHANCED IMAGE
            # Convert back to PIL for PaddleOCR
            enhanced_pil = Image.fromarray(enhanced_img)
            result = ocr.ocr(enhanced_pil, cls=False)

            # 4. EXTRACT & NORMALIZE
            # PaddleOCR format per word: [bbox_points, (text, confidence)]
            # bbox_points = [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            # word_info[1] = ('recognized_text', confidence_float) — NOT just the text!
            for line in result:
                if not line:
                    continue
                for word_info in line:
                    if len(word_info) < 2:
                        continue
                    text_conf = word_info[1]  # This is (text, confidence) tuple
                    # Safely unpack the (text, confidence) tuple
                    if isinstance(text_conf, (list, tuple)) and len(text_conf) >= 2:
                        text = str(text_conf[0])
                        try:
                            confidence = float(text_conf[1]) if text_conf[1] is not None else 0.5
                        except (TypeError, ValueError):
                            confidence = 0.5
                    else:
                        # Fallback: treat as raw text with default confidence
                        text = str(text_conf)
                        confidence = 0.5

                    # Only consider high-confidence detections
                    if confidence < 0.3:
                        continue

                    normalized = normalize_plate(text)
                    if normalized:
                        # Weight by confidence for voting
                        candidates[normalized] = candidates.get(normalized, 0) + confidence

        except Exception as e:
            print(f"[OCR_ERROR] Image {idx}: {str(e)}", file=sys.stderr)
            enhancement_metrics.append({
                "image_idx": idx,
                "enhancement_applied": False,
                "error": str(e)
            })
            continue

    # 5. VOTING MECHANISM
    if candidates:
        # Pick plate with highest total confidence
        best_plate = max(candidates, key=candidates.get)
        total_confidence = candidates[best_plate]
        num_images = len([m for m in enhancement_metrics if m.get("enhancement_applied")])

        return {
            "plate": best_plate,
            "candidates": sorted(candidates.keys(), key=lambda x: candidates[x], reverse=True),
            "confidence": min(1.0, total_confidence / max(1, num_images)),
            "metrics": {
                "images_processed": len(enhancement_metrics),
                "plates_detected": len(candidates),
                "enhancement_applied_count": sum(1 for m in enhancement_metrics if m.get("enhancement_applied")),
                "enhancement_metrics": enhancement_metrics
            }
        }

    return {
        "plate": "",
        "candidates": [],
        "confidence": 0,
        "metrics": {
            "images_processed": len(enhancement_metrics),
            "enhancement_applied_count": sum(1 for m in enhancement_metrics if m.get("enhancement_applied")),
            "enhancement_metrics": enhancement_metrics
        }
    }

def validate_timestamp(timestamp_str):
    """
    Validate timestamp extracted from OSD.

    Formats supported:
    - DD/MM/YYYY HH:MM:SS
    - YYYY-MM-DD HH:MM:SS
    - DD-MM-YYYY HH:MM:SS

    Returns: validated timestamp or None
    """
    import re
    from datetime import datetime

    if not timestamp_str or not isinstance(timestamp_str, str):
        return None

    # Pattern 1: DD/MM/YYYY HH:MM:SS or YYYY/MM/DD HH:MM:SS
    pattern1 = r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})'
    match = re.search(pattern1, timestamp_str)

    if match:
        try:
            groups = match.groups()
            first, second, year, hour, minute, second_val = map(int, groups)

            # Determine format (DD/MM vs MM/DD)
            # If first > 12, it's definitely DD
            if first > 12:
                day, month = first, second
            # If second > 12, it's DD/MM
            elif second > 12:
                day, month = first, second
            # If both ≤ 12, assume DD/MM (Spanish format)
            else:
                day, month = first, second

            # Validate ranges
            assert 1 <= month <= 12, f"Invalid month: {month}"
            assert 1 <= day <= 31, f"Invalid day: {day}"
            assert 1000 <= year <= 2100, f"Invalid year: {year}"
            assert 0 <= hour <= 23, f"Invalid hour: {hour}"
            assert 0 <= minute <= 59, f"Invalid minute: {minute}"
            assert 0 <= second_val <= 59, f"Invalid second: {second_val}"

            # Create datetime to validate date exists
            dt = datetime(year, month, day, hour, minute, second_val)

            # Return normalized format
            return f"{day:02d}/{month:02d}/{year} {hour:02d}:{minute:02d}:{second_val:02d}"

        except (ValueError, AssertionError) as e:
            print(f"[OCR_TIMESTAMP] Validation failed: {str(e)}", file=sys.stderr)
            return None

    return None


def extract_timestamp(image_b64):
    """
    Extract timestamp from OSD region with validation.

    Process:
    1. Decode image
    2. Enhance (HR + preprocessing)
    3. OCR text extraction
    4. Parse and validate timestamp format
    """
    try:
        # 1. DECODE
        img_data = base64.b64decode(image_b64)
        img = cv2.imdecode(np.frombuffer(img_data, np.uint8), cv2.IMREAD_COLOR)

        if img is None:
            return {
                "timestamp": "",
                "raw_text": "",
                "confidence": False,
                "error": "Image decode failed"
            }

        # 2. ENHANCE
        enhanced_img = enhance_image_for_ocr(img, target_height=400)

        # 3. OCR
        enhanced_pil = Image.fromarray(enhanced_img)
        result = ocr.ocr(enhanced_pil, cls=False)

        texts = []
        for line in result:
            if not line:
                continue
            for word_info in line:
                if len(word_info) < 2:
                    continue
                # PaddleOCR format: [bbox, (text, confidence)]
                text_conf = word_info[1]  # (text, confidence) tuple
                if isinstance(text_conf, (list, tuple)) and len(text_conf) >= 2:
                    text = str(text_conf[0])
                    try:
                        confidence = float(text_conf[1]) if text_conf[1] is not None else 0.5
                    except (TypeError, ValueError):
                        confidence = 0.5
                else:
                    text = str(text_conf)
                    confidence = 0.5
                # Only include high-confidence text for timestamp extraction
                if confidence > 0.3:
                    texts.append(text)

        if not texts:
            return {
                "timestamp": "",
                "raw_text": "",
                "confidence": False,
                "error": "No text detected in OSD region"
            }

        combined_text = ' '.join(texts)

        # 4. VALIDATE TIMESTAMP
        validated_timestamp = validate_timestamp(combined_text)

        if validated_timestamp:
            return {
                "timestamp": validated_timestamp,
                "raw_text": combined_text,
                "confidence": True,
                "validation_status": "valid"
            }
        else:
            # Try fallback: simple regex parse
            import re
            time_match = re.search(r'(\d{1,2}):(\d{2}):(\d{2})', combined_text)
            date_match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', combined_text)

            fallback = []
            if date_match:
                fallback.append(f"{date_match.group(1)}/{date_match.group(2)}/{date_match.group(3)}")
            if time_match:
                fallback.append(f"{time_match.group(1)}:{time_match.group(2)}:{time_match.group(3)}")

            fallback_timestamp = ' '.join(fallback) if fallback else ""

            return {
                "timestamp": fallback_timestamp,
                "raw_text": combined_text,
                "confidence": bool(fallback_timestamp),
                "validation_status": "unvalidated"
            }

    except Exception as e:
        print(f"[OCR_ERROR] Timestamp extraction: {str(e)}", file=sys.stderr)
        return {
            "timestamp": "",
            "raw_text": "",
            "confidence": False,
            "error": str(e)
        }

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
