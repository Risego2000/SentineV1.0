#!/usr/bin/env python3
"""
PaddleOCR Service for License Plate and Timestamp Detection
- Procesa TODAS las imágenes en un único proceso (PaddleOCR se inicializa una sola vez)
- Detects license plates from detail frames (2688x1520)
- Extracts timestamp from OSD (top-left corner) from general frames (1920x1080)
"""

import sys
import json
import base64
import io
from paddleocr import PaddleOCR
from PIL import Image
import re

# Initialize PaddleOCR once (reuse across all images in this process)
# lang='en' is the best for alphanumeric license plates (letters + numbers)
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

def extract_license_plate(base64_image):
    """
    Extract license plate from base64 encoded image using PaddleOCR.
    Returns dict with plate, confidence, method, full_text.
    """
    try:
        image_data = base64.b64decode(base64_image)
        image = Image.open(io.BytesIO(image_data))

        result = ocr.ocr(image, cls=True)

        detected_text = []
        confidences = []

        if result:
            for line in result:
                if line:
                    for word_info in line:
                        if word_info and len(word_info) >= 2:
                            text = word_info[1][0] if isinstance(word_info[1], (list, tuple)) else word_info[1]
                            conf = word_info[1][1] if isinstance(word_info[1], (list, tuple)) else (word_info[2] if len(word_info) > 2 else 0)
                            detected_text.append(str(text))
                            confidences.append(float(conf))

        full_text = ''.join(detected_text)

        # Spanish plate patterns first: NNNN-LLL or LLLL-NNNN
        plate = None
        # Spanish format: 4 digits + 3 letters (e.g. 1234-BCD)
        spanish_match = re.search(r'\b(\d{4}[- ]?[A-Z]{3})\b', full_text.upper())
        if spanish_match:
            plate = spanish_match.group(1).replace(' ', '').replace('-', '')
        else:
            # Generic alphanumeric 3-8 chars
            generic_match = re.search(r'[A-Z0-9]{3,8}', full_text.upper())
            plate = generic_match.group(0) if generic_match else None

        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        return {
            'plate': plate or 'NO_PLATE',
            'confidence': round(avg_confidence, 3),
            'method': 'paddleocr',
            'full_text': full_text
        }

    except Exception as e:
        return {
            'plate': 'ERROR',
            'confidence': 0,
            'method': 'paddleocr',
            'error': str(e)
        }


def extract_license_plate_batch(base64_images):
    """
    Process multiple images in one call (PaddleOCR already initialized).
    Returns the result with highest confidence that found a real plate.
    """
    best = {'plate': 'NO_PLATE', 'confidence': 0, 'method': 'paddleocr', 'full_text': ''}

    for img in base64_images:
        if not img:
            continue
        result = extract_license_plate(img)
        plate = result.get('plate', 'NO_PLATE')
        conf = result.get('confidence', 0)

        # Keep best non-empty result
        if plate and plate not in ('NO_PLATE', 'ERROR') and conf > best['confidence']:
            best = result

    return best


def extract_timestamp(base64_image):
    """
    Extract timestamp from OSD (On-Screen Display) visible in video.
    Focuses on top-left corner where timestamp is typically displayed.
    """
    try:
        image_data = base64.b64decode(base64_image)
        image = Image.open(io.BytesIO(image_data))

        width, height = image.size

        # Crop top-left corner (OSD timestamp usually appears there)
        crop_box = (0, 0, int(width * 0.35), int(height * 0.12))
        cropped = image.crop(crop_box)

        result = ocr.ocr(cropped, cls=True)

        detected_text = []
        confidences = []

        if result:
            for line in result:
                if line:
                    for word_info in line:
                        if word_info and len(word_info) >= 2:
                            text = word_info[1][0] if isinstance(word_info[1], (list, tuple)) else word_info[1]
                            conf = word_info[1][1] if isinstance(word_info[1], (list, tuple)) else (word_info[2] if len(word_info) > 2 else 0)
                            detected_text.append(str(text))
                            confidences.append(float(conf))

        full_text = ' '.join(detected_text).strip()

        # Try multiple timestamp formats:
        # DD/MM/YYYY HH:MM:SS  |  DD-MM-YYYY HH:MM:SS  |  YYYY/MM/DD HH:MM:SS
        timestamp = None
        patterns = [
            r'(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})\s+(\d{1,2}:\d{2}:\d{2})',
            r'(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})\s+(\d{1,2}:\d{2}:\d{2})',
            r'(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2})\s+(\d{1,2}:\d{2}:\d{2})',
        ]
        for pattern in patterns:
            match = re.search(pattern, full_text)
            if match:
                date_part = match.group(1).replace('/', '-').replace('.', '-')
                time_part = match.group(2)
                timestamp = f"{date_part} {time_part}"
                break

        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        return {
            'timestamp': timestamp,
            'confidence': round(avg_confidence, 3),
            'method': 'paddleocr-osd',
            'full_text': full_text
        }

    except Exception as e:
        return {
            'timestamp': None,
            'confidence': 0,
            'method': 'paddleocr-osd',
            'error': str(e)
        }


def main():
    """Main entry point - reads JSON from stdin, processes all images in one call."""
    try:
        input_data = json.loads(sys.stdin.read())
        task = input_data.get('task', 'plate')  # 'plate' or 'timestamp'

        if task == 'timestamp':
            base64_image = input_data.get('image')
            if not base64_image:
                print(json.dumps({'error': 'No image provided for timestamp'}))
                sys.exit(1)
            result = extract_timestamp(base64_image)

        else:
            # Plate mode: accept single image OR array of images
            images = input_data.get('images')
            single = input_data.get('image')

            if images and isinstance(images, list) and len(images) > 0:
                # Batch mode: process all images, return best
                result = extract_license_plate_batch(images)
            elif single:
                result = extract_license_plate(single)
            else:
                print(json.dumps({'error': 'No image(s) provided'}))
                sys.exit(1)

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'method': 'paddleocr'
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
