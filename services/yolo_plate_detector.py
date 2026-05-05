#!/usr/bin/env python3
"""
YOLO-based License Plate Detection
Detects license plate bounding boxes in vehicle frames
"""

import json
import sys
import base64
import io
import os
import warnings

warnings.filterwarnings('ignore')

def detect_plate_yolo(image_b64):
    """
    Detect license plate location using YOLO

    Returns:
        {
            "plate_box": {"x": int, "y": int, "width": int, "height": int},
            "confidence": float (0-1),
            "detections": [list of all detections]
        }
    """
    try:
        # Try to import ultralytics YOLO
        try:
            from ultralytics import YOLO
            import cv2
            import numpy as np
        except ImportError:
            return {
                "plate_box": None,
                "confidence": 0,
                "detections": [],
                "error": "YOLO not installed. Install with: pip install ultralytics"
            }

        # Decode image
        try:
            img_data = base64.b64decode(image_b64)
            img_array = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                return {
                    "plate_box": None,
                    "confidence": 0,
                    "detections": [],
                    "error": "Invalid image data"
                }
        except Exception as e:
            return {
                "plate_box": None,
                "confidence": 0,
                "detections": [],
                "error": f"Decode error: {str(e)}"
            }

        # Load YOLO model
        # Priority: specialized plate detection > general YOLO
        try:
            # Try to load custom plate model if exists
            model_path = 'models/best_plate.pt'
            if os.path.exists(model_path):
                model = YOLO(model_path)
                print(f'[YOLO] Loaded custom plate model from {model_path}', file=sys.stderr)
            else:
                # Use general YOLO nano (fast, good for plates)
                # Will detect objects, then filter for plate-like detections
                model = YOLO('yolov8n.pt')  # Nano model (fast, 6.2MB)
        except Exception as e:
            return {
                "plate_box": None,
                "confidence": 0,
                "detections": [],
                "error": f"Model load error: {str(e)}"
            }

        # Run inference
        try:
            results = model(img, conf=0.3, verbose=False)

            if not results or len(results) == 0:
                return {
                    "plate_box": None,
                    "confidence": 0,
                    "detections": []
                }

            result = results[0]
            detections = []
            plate_candidates = []
            best_box = None
            best_conf = 0

            # Image dimensions for filtering
            img_h, img_w = img.shape[:2]

            # Process detections
            if hasattr(result, 'boxes') and result.boxes is not None:
                boxes = result.boxes

                for i, box in enumerate(boxes):
                    # Get bounding box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    class_id = int(box.cls[0]) if hasattr(box, 'cls') else -1

                    # Convert to x, y, width, height format
                    x = int(x1)
                    y = int(y1)
                    w = int(x2 - x1)
                    h = int(y2 - y1)

                    # Filter for plate-like detections
                    # License plates are typically:
                    # - Rectangular (aspect ratio 3:1 to 5:1)
                    # - Medium size (100-600 pixels wide, 20-100 pixels tall)
                    # - Located in lower portion of image

                    aspect_ratio = w / max(h, 1)
                    is_plate_like = (
                        100 <= w <= 600 and  # Width in typical plate range
                        20 <= h <= 100 and   # Height in typical plate range
                        2.5 <= aspect_ratio <= 6.0 and  # Aspect ratio (wider than tall)
                        y > img_h * 0.3  # Located in lower portion
                    )

                    detection = {
                        "x": x,
                        "y": y,
                        "width": w,
                        "height": h,
                        "confidence": round(conf, 3),
                        "aspect_ratio": round(aspect_ratio, 2),
                        "class": "license_plate",
                        "is_plate_like": is_plate_like
                    }
                    detections.append(detection)

                    # Track plate-like detections
                    if is_plate_like:
                        plate_candidates.append({
                            "x": x,
                            "y": y,
                            "width": w,
                            "height": h,
                            "confidence": conf,
                            "class": "license_plate"
                        })

                    # Track overall best detection
                    if is_plate_like and conf > best_conf:
                        best_conf = conf
                        best_box = detection

            # If no plate-like geometry found, use highest confidence detection
            if not best_box and detections:
                best = max(detections, key=lambda d: d['confidence'])
                if best['confidence'] > 0.5:  # Require minimum confidence
                    best_box = {
                        "x": best['x'],
                        "y": best['y'],
                        "width": best['width'],
                        "height": best['height'],
                        "confidence": best['confidence'],
                        "class": "license_plate"
                    }
                    best_conf = best['confidence']

            return {
                "plate_box": best_box,
                "confidence": round(best_conf, 3),
                "detections": plate_candidates[:3],  # Return top 3 plate candidates
                "all_detections": len(detections),
                "plate_candidates": len(plate_candidates)
            }

        except Exception as e:
            import traceback
            return {
                "plate_box": None,
                "confidence": 0,
                "detections": [],
                "error": f"Inference error: {str(e)}"
            }

    except Exception as e:
        import traceback
        return {
            "plate_box": None,
            "confidence": 0,
            "detections": [],
            "error": f"Unexpected error: {str(e)}"
        }


def main():
    """CLI interface"""
    try:
        request_json = sys.stdin.read()
        request = json.loads(request_json)
        operation = request.get("operation")

        if operation == "detect_plate":
            result = detect_plate_yolo(request.get("image", ""))
            print(json.dumps(result))
        else:
            print(json.dumps({"error": f"Unknown operation: {operation}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({
            "plate_box": None,
            "confidence": 0,
            "detections": [],
            "error": f"Error: {str(e)}"
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
