#!/usr/bin/env python3
"""
PaddleOCR License Plate Extractor
Extracts license plates from base64-encoded images using PaddleOCR
"""

import sys
import json
import base64
import os
from io import BytesIO
from PIL import Image
import re

try:
    from paddleocr import PaddleOCR
except ImportError:
    print(json.dumps({"error": "PaddleOCR not installed"}), file=sys.stderr)
    sys.exit(1)


def normalize_plate(text):
    """Normalize and validate license plate text"""
    compact = text.upper().replace(' ', '').replace('-', '').replace('_', '').replace('.', '')
    compact = re.sub(r'[^A-Z0-9]', '', compact)

    # Spanish plate format: 4 digits + 3 letters
    spain_matches = re.findall(r'\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}', compact)
    if spain_matches:
        return spain_matches[0]

    # Generic format: 6-8 alphanumeric characters
    generic_matches = re.findall(r'[A-Z0-9]{6,8}', compact)
    if generic_matches:
        return generic_matches[0]

    return ''


def extract_plate_from_image(ocr, base64_image):
    """Extract license plate from single base64 image"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_image:
            base64_image = base64_image.split(',')[1]

        # Decode base64 to image
        image_data = base64.b64decode(base64_image)
        image = Image.open(BytesIO(image_data))

        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Run OCR
        result = ocr.ocr(image, cls=True)

        # Extract text from results
        plate_candidates = []
        if result and result[0]:
            for line in result[0]:
                text = line[1][0] if line[1] else ""
                confidence = float(line[1][1]) if len(line[1]) > 1 else 0.0

                normalized = normalize_plate(text)
                if normalized:
                    plate_candidates.append({
                        'text': normalized,
                        'confidence': confidence
                    })

        return plate_candidates
    except Exception as e:
        print(f"Error processing image: {str(e)}", file=sys.stderr)
        return []


def extract_timestamp_from_osd(ocr, base64_image):
    """Extract timestamp from OSD (On-Screen Display) text"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_image:
            base64_image = base64_image.split(',')[1]

        # Decode base64 to image
        image_data = base64.b64decode(base64_image)
        image = Image.open(BytesIO(image_data))

        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Run OCR
        result = ocr.ocr(image, cls=True)

        # Extract all text
        full_text = ""
        if result and result[0]:
            for line in result[0]:
                text = line[1][0] if line[1] else ""
                full_text += text + " "

        full_text = full_text.strip()

        # Look for timestamp patterns
        time_pattern = r'\d{1,2}:\d{2}:\d{2}'
        date_pattern = r'\d{1,4}[-/]\d{1,2}[-/]\d{1,4}'

        time_match = re.search(time_pattern, full_text)
        date_match = re.search(date_pattern, full_text)

        timestamp = None
        if time_match and date_match:
            timestamp = f"{date_match.group()} {time_match.group()}"
        elif time_match:
            timestamp = time_match.group()
        elif date_match:
            timestamp = date_match.group()

        return {
            'timestamp': timestamp,
            'osdText': full_text,
            'confidence': 0.7 if full_text else 0
        }
    except Exception as e:
        print(f"Error extracting timestamp: {str(e)}", file=sys.stderr)
        return {
            'timestamp': None,
            'osdText': None,
            'confidence': 0
        }


def main():
    """Main entry point"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        request = json.loads(input_data)

        # Initialize PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang='es')

        # Determine operation type
        operation = request.get('operation', 'extract_plate')

        if operation == 'extract_plate':
            images = request.get('images', [])
            if not images:
                print(json.dumps({
                    'plate': 'NO_IMAGES',
                    'candidates': [],
                    'confidence': 0
                }))
                return

            all_candidates = []
            for idx, image in enumerate(images):
                if not image:
                    continue

                candidates = extract_plate_from_image(ocr, image)
                all_candidates.extend(candidates)

            # Find best result
            if all_candidates:
                best = max(all_candidates, key=lambda x: x['confidence'])
                candidates_text = [c['text'] for c in all_candidates]
                print(json.dumps({
                    'plate': best['text'],
                    'candidates': list(set(candidates_text)),
                    'confidence': best['confidence']
                }))
            else:
                print(json.dumps({
                    'plate': 'NO_PLATE',
                    'candidates': [],
                    'confidence': 0
                }))

        elif operation == 'extract_timestamp':
            image = request.get('image')
            if not image:
                print(json.dumps({
                    'timestamp': None,
                    'osdText': None,
                    'confidence': 0
                }))
                return

            result = extract_timestamp_from_osd(ocr, image)
            print(json.dumps(result))

        else:
            print(json.dumps({
                'error': f'Unknown operation: {operation}'
            }), file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
