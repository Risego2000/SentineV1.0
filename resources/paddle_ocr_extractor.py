#!/usr/bin/env python3
"""
Robust PaddleOCR extractor for Sentinel.
Accepts JSON via stdin:
  { "operation": "extract_plate", "images": ["<base64>", ...] }
  { "operation": "detect_region", "image": "<base64>" }
  { "operation": "extract_timestamp", "image": "<base64>" }
"""

import base64
import json
import re
import sys
from typing import Dict, List, Optional

import cv2
import numpy as np
from PIL import Image

try:
    from paddleocr import PaddleOCR
except Exception as exc:
    print(json.dumps({"error": f"PaddleOCR import failed: {exc}"}))
    sys.exit(1)


ocr = PaddleOCR(use_angle_cls=False, lang="en", show_log=False)


def decode_b64_to_bgr(image_b64: str) -> Optional[np.ndarray]:
    try:
        raw = base64.b64decode(image_b64)
        arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def normalize_plate(text: str) -> str:
    text = re.sub(r"[^A-Z0-9]", "", text.upper())
    if not text:
        return ""
    patterns = [
        r"(\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3})",
        r"(N\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3})",
        r"(H\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3})",
        r"(C\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3})",
        r"([BCDFGHJKLMNPRSTVWXYZ]{2}\d{4}[BCDFGHJKLMNPRSTVWXYZ]{2})",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1)
    return text if len(text) >= 6 else ""


def detect_and_crop_plate(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    roi = img[int(h * 0.45):, :]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    edges = cv2.Canny(gray, 40, 120)
    cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    best_score = 0.0
    for c in cnts:
        area = cv2.contourArea(c)
        if area < 400:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        ratio = bw / (bh + 1e-6)
        if 2.2 <= ratio <= 8.5:
            score = area * (1.0 if 3.0 <= ratio <= 6.5 else 0.7)
            if score > best_score:
                best_score = score
                m = int(max(2, bh * 0.2))
                x1, y1 = max(0, x - m), max(0, y - m)
                x2, y2 = min(w, x + bw + m), min(roi.shape[0], y + bh + m)
                best = roi[y1:y2, x1:x2]

    if best is not None and best.shape[0] > 20 and best.shape[1] > 60:
        return best
    return img[int(h * 0.55):int(h * 0.95), int(w * 0.08):int(w * 0.92)]


def enhance_for_ocr(img: np.ndarray, target_h: int = 600) -> np.ndarray:
    h, w = img.shape[:2]
    if h < target_h:
        scale = target_h / max(h, 1)
        img = cv2.resize(img, (int(w * scale), target_h), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.bilateralFilter(gray, 7, 60, 60)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.8)
    sharp = cv2.addWeighted(gray, 1.4, blur, -0.4, 0)
    return cv2.adaptiveThreshold(
        sharp, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )


def run_ocr_words(img: np.ndarray) -> List[Dict]:
    pil = Image.fromarray(img)
    result = ocr.ocr(pil, cls=False)
    words: List[Dict] = []
    for line in result or []:
        for item in line or []:
            if len(item) < 2:
                continue
            text_conf = item[1]
            if isinstance(text_conf, (list, tuple)) and len(text_conf) >= 2:
                text = str(text_conf[0])
                try:
                    conf = float(text_conf[1])
                except Exception:
                    conf = 0.0
            else:
                text = str(text_conf)
                conf = 0.0
            words.append({"text": text, "confidence": conf})
    return words


def extract_plate(images_b64: List[str]) -> Dict:
    votes: Dict[str, float] = {}
    candidates: Dict[str, float] = {}
    processed = 0
    for image_b64 in images_b64[:12]:
        img = decode_b64_to_bgr(image_b64)
        if img is None:
            continue
        processed += 1
        crop = detect_and_crop_plate(img)
        enhanced = enhance_for_ocr(crop)
        for w in run_ocr_words(enhanced):
            if w["confidence"] < 0.25:
                continue
            plate = normalize_plate(w["text"])
            if not plate:
                continue
            score = max(0.0, min(1.0, w["confidence"]))
            votes[plate] = votes.get(plate, 0.0) + score
            candidates[plate] = max(candidates.get(plate, 0.0), score)

    if not votes:
        return {"plate": "", "candidates": [], "confidence": 0.0, "method": "paddleocr"}

    best_plate = max(votes, key=votes.get)
    confidence = min(1.0, votes[best_plate] / max(processed, 1))
    sorted_candidates = sorted(candidates.items(), key=lambda x: x[1], reverse=True)[:8]
    return {
        "plate": best_plate,
        "candidates": [{"text": p, "confidence": c} for p, c in sorted_candidates],
        "confidence": confidence,
        "method": "paddleocr",
    }


def detect_region(image_b64: str) -> Optional[Dict]:
    img = decode_b64_to_bgr(image_b64)
    if img is None:
        return None
    h, w = img.shape[:2]
    crop = detect_and_crop_plate(img)
    ch, cw = crop.shape[:2]
    if ch < 5 or cw < 10:
        return None
    return {"x": 0.08, "y": 0.55, "width": 0.84, "height": 0.40, "confidence": 0.6}


def extract_timestamp(image_b64: str) -> Dict:
    img = decode_b64_to_bgr(image_b64)
    if img is None:
        return {"timestamp": "", "raw_text": "", "confidence": False}
    enhanced = enhance_for_ocr(img, target_h=420)
    words = run_ocr_words(enhanced)
    text = " ".join([w["text"] for w in words if w["confidence"] > 0.25])
    time_m = re.search(r"\b\d{1,2}:\d{2}:\d{2}\b", text)
    date_m = re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text)
    ts = " ".join([x for x in [date_m.group(0) if date_m else "", time_m.group(0) if time_m else ""] if x])
    return {"timestamp": ts, "raw_text": text, "confidence": bool(ts)}


def main() -> None:
    raw = sys.stdin.read().strip()
    if not raw:
        # Legacy mode for backwards compatibility
        mode = sys.argv[1] if len(sys.argv) > 1 else ""
        image = sys.argv[2] if len(sys.argv) > 2 else ""
        if mode == "extract-plate":
            print(json.dumps(extract_plate([image] if image else [])))
            return
        if mode == "detect-region":
            print(json.dumps(detect_region(image)))
            return
        print(json.dumps({"error": "Missing stdin payload"}))
        return

    req = json.loads(raw)
    op = req.get("operation", "")
    if op == "extract_plate":
        images = req.get("images") or []
        if isinstance(images, str):
            images = [images]
        print(json.dumps(extract_plate(images)))
    elif op == "detect_region":
        print(json.dumps(detect_region(req.get("image", ""))))
    elif op == "extract_timestamp":
        print(json.dumps(extract_timestamp(req.get("image", ""))))
    else:
        print(json.dumps({"error": f"Unknown operation: {op}"}))


if __name__ == "__main__":
    main()
