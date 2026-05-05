#!/usr/bin/env python3
"""
Image Enhancement Service - High Resolution + OCR Optimization
Mejora automática de imágenes para máxima calidad en OCR
"""

import json
import sys
import base64
import io
import cv2
import numpy as np
from PIL import Image
import warnings

warnings.filterwarnings('ignore')

def enhance_for_ocr(image_b64, target_height=1200, profile="forensic_safe"):
    """
    Pipeline completo de mejora de imagen para OCR de alta precisión.

    Proceso:
    1. Decoding + validación
    2. Upsampling a HR (si necesario)
    3. Contrast enhancement (CLAHE)
    4. Denoising bilateral
    5. Sharpening
    6. Binarización adaptativa (opcional)
    7. Morphological cleanup
    8. Encoding

    Args:
        image_b64: base64 encoded JPEG
        target_height: altura destino para upsampling (default 600px)

    Returns:
        {
            "enhanced": base64 enhanced image (JPEG),
            "metadata": {
                "original_size": [W, H],
                "enhanced_size": [W, H],
                "upsampling_factor": float,
                "contrast_improvement": float (0-100%),
                "blur_score": float (0-1, lower=sharper),
                "quality_metrics": {...}
            },
            "error": null or error message
        }
    """
    try:
        # 1. DECODE
        try:
            img_data = base64.b64decode(image_b64)
            img = cv2.imdecode(np.frombuffer(img_data, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Invalid image data")
        except Exception as e:
            return {
                "enhanced": None,
                "error": f"Decode error: {str(e)}"
            }

        original_shape = img.shape
        original_height = original_shape[0]
        original_width = original_shape[1]

        # 2. UPSAMPLING (Super Resolution si imagen pequeña)
        upsampling_factor = 1.0
        if original_height < target_height:
            scale = target_height / original_height
            new_width = int(original_width * scale)
            # LANCZOS4 conserva mejor detalle fino (bordes de caracteres) en upscaling.
            img = cv2.resize(img, (new_width, target_height), interpolation=cv2.INTER_LANCZOS4)
            upsampling_factor = scale

            # Super-resolution sharpening post-upsampling
            kernel = np.array([[-1,-1,-1],
                              [-1, 9,-1],
                              [-1,-1,-1]]) / 1.0
            img = cv2.filter2D(img, -1, kernel)

        # 3. CONVERT TO HSV + PROCESS CHANNELS
        # Mejorar canales de color individualmente
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)

        # 3.1 CONTRAST ENHANCEMENT - profile-aware
        if profile == "visual_aggressive":
            clahe = cv2.createCLAHE(clipLimit=4.2, tileGridSize=(8, 8))
        else:
            clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))
        v_enhanced = clahe.apply(v)

        # 3.2 Saturación
        sat_boost = 1.16 if profile == "visual_aggressive" else 1.05
        s = cv2.multiply(s, sat_boost)
        s = np.clip(s, 0, 255).astype(np.uint8)

        # Recombinar HSV
        hsv_enhanced = cv2.merge([h, s, v_enhanced])
        img = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)

        # 4. CONVERT TO GRAYSCALE para procesamiento posterior
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 5. DENOISING (Bilateral Filter - preserva bordes)
        if profile == "visual_aggressive":
            denoised = cv2.bilateralFilter(gray, 7, 60, 60)
        else:
            denoised = cv2.bilateralFilter(gray, 9, 85, 85)

        # 6. SHARPENING (Unsharp Mask)
        if profile == "visual_aggressive":
            gaussian = cv2.GaussianBlur(denoised, (0, 0), 1.6)
            sharpened = cv2.addWeighted(denoised, 1.7, gaussian, -0.7, 0)
        else:
            gaussian = cv2.GaussianBlur(denoised, (0, 0), 1.2)
            sharpened = cv2.addWeighted(denoised, 1.35, gaussian, -0.35, 0)

        # 7. MORPHOLOGICAL OPERATIONS (limpieza)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        morph = cv2.morphologyEx(sharpened, cv2.MORPH_CLOSE, kernel, iterations=1)
        morph = cv2.morphologyEx(morph, cv2.MORPH_OPEN, kernel, iterations=1)

        # 8. ADAPTIVE THRESHOLD (para OCR - opcional)
        # Convertir a binary adaptativa para mejor OCR (PaddleOCR puede procesar bien)
        if profile == "visual_aggressive":
            binary = cv2.adaptiveThreshold(
                morph, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 1
            )
        else:
            binary = cv2.adaptiveThreshold(
                morph, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 13, 3
            )

        # 9. ENCODE resultado mejorado como JPEG
        success, enhanced_b64 = cv2.imencode('.jpg', binary, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not success:
            return {
                "enhanced": None,
                "error": "Encode failed"
            }

        enhanced_b64_str = base64.b64encode(enhanced_b64.tobytes()).decode('utf-8')

        # 10. CALCULAR MÉTRICAS DE CALIDAD
        blur_score = calculate_blur_score(binary)
        contrast_improvement = calculate_contrast_improvement(gray, binary)
        enhanced_shape = binary.shape

        metadata = {
            "profile": profile,
            "original_size": [original_width, original_height],
            "enhanced_size": [enhanced_shape[1], enhanced_shape[0]],
            "upsampling_factor": round(upsampling_factor, 2),
            "contrast_improvement_percent": round(contrast_improvement, 1),
            "blur_score": round(blur_score, 3),  # 0-1, lower = sharper
            "quality_metrics": {
                "sharpness": "high" if blur_score < 0.3 else "medium" if blur_score < 0.5 else "low",
                "contrast": "optimal" if 100 < contrast_improvement < 150 else "suboptimal",
                "noise_reduction": "applied",
                "color_enhancement": "applied"
            }
        }

        return {
            "enhanced": enhanced_b64_str,
            "metadata": metadata,
            "error": None
        }

    except Exception as e:
        import traceback
        return {
            "enhanced": None,
            "metadata": None,
            "error": f"Enhancement error: {str(e)} | {traceback.format_exc()}"
        }


def calculate_blur_score(image):
    """
    Calcula score de blur usando Laplacian variance.

    Returns: float 0-1
        0 = muy nítido
        1 = muy borroso
    """
    try:
        laplacian_var = cv2.Laplacian(image, cv2.CV_64F).var()
        # Normalizar: típicamente 0-1000, mapear a 0-1
        blur_score = min(1.0, max(0.0, 1.0 - (laplacian_var / 1000)))
        return blur_score
    except:
        return 0.5


def calculate_contrast_improvement(original, enhanced):
    """
    Calcula mejora de contraste en %.

    Returns: float (0-200%)
        100% = sin cambio
        <100% = contraste reducido
        >100% = contraste mejorado
    """
    try:
        orig_std = cv2.calcHist([original], [0], None, [256], [0, 256]).std()
        enh_std = cv2.calcHist([enhanced], [0], None, [256], [0, 256]).std()

        if orig_std == 0:
            return 100.0

        improvement = (enh_std / orig_std) * 100
        return improvement
    except:
        return 100.0


def process_batch(images_b64, target_height=1200):
    """
    Procesa batch de imágenes.

    Args:
        images_b64: list de base64 strings
        target_height: altura target para upsampling

    Returns:
        {
            "enhanced_images": [base64, ...],
            "metadata": [{...}, ...],
            "success_count": int,
            "failure_count": int
        }
    """
    enhanced_images = []
    metadata_list = []
    success_count = 0
    failure_count = 0

    for img_b64 in images_b64:
        result = enhance_for_ocr(img_b64, target_height, "forensic_safe")
        if result.get("enhanced"):
            enhanced_images.append(result["enhanced"])
            metadata_list.append(result.get("metadata"))
            success_count += 1
        else:
            failure_count += 1
            metadata_list.append({"error": result.get("error")})

    return {
        "enhanced_images": enhanced_images,
        "metadata": metadata_list,
        "success_count": success_count,
        "failure_count": failure_count,
        "total": len(images_b64)
    }


def main():
    """CLI interface"""
    try:
        request_json = sys.stdin.read()
        request = json.loads(request_json)
        operation = request.get("operation")

        if operation == "enhance_single":
            result = enhance_for_ocr(
                request.get("image", ""),
                request.get("target_height", 1200),
                request.get("profile", "forensic_safe")
            )
            print(json.dumps(result))

        elif operation == "enhance_batch":
            result = process_batch(
                request.get("images", []),
                request.get("target_height", 1200)
            )
            print(json.dumps(result))

        else:
            print(json.dumps({"error": f"Unknown operation: {operation}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": f"Error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
