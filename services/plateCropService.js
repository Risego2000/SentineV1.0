/**
 * Intelligent License Plate Region Extraction
 * Uses COCO-SSD vehicle detection to intelligently crop plate regions
 */

/**
 * Extract license plate region from a frame using vehicle bounding box
 * @param {string} frameBase64 - Full frame as base64
 * @param {object} vehicleDetection - COCO detection: {x, y, width, height, class}
 * @returns {string} Cropped frame focusing on plate area (base64)
 */
export function extractPlateRegion(frameBase64, vehicleDetection) {
  if (!frameBase64 || !vehicleDetection) {
    return frameBase64; // Return original if no detection
  }

  try {
    // Parse base64 to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Extract vehicle region
        const vehicleX = vehicleDetection.x || 0;
        const vehicleY = vehicleDetection.y || 0;
        const vehicleW = vehicleDetection.width || img.width;
        const vehicleH = vehicleDetection.height || img.height;

        // License plate is typically in lower 20-30% of vehicle height
        // For cars: bottom portion
        // For trucks: front bumper area
        const plateStartY = vehicleY + vehicleH * 0.65; // Start at 65% down
        const plateEndY = vehicleY + vehicleH * 0.98; // End at 98% down
        const plateHeight = plateEndY - plateStartY;

        if (plateHeight < 20) {
          resolve(frameBase64); // Too small, return original
          return;
        }

        // Add horizontal margin
        const marginX = vehicleW * 0.05;
        const plateX = Math.max(0, vehicleX - marginX);
        const plateW = Math.min(img.width - plateX, vehicleW + marginX * 2);

        // Create cropped canvas for plate region
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        cropCanvas.width = plateW;
        cropCanvas.height = plateHeight;

        // Draw cropped region
        cropCtx.drawImage(
          canvas,
          plateX,
          plateStartY,
          plateW,
          plateHeight,
          0,
          0,
          plateW,
          plateHeight
        );

        // Apply light contrast enhancement for OCR
        applyAdaptiveContrast(cropCtx, plateW, plateHeight);

        // Convert back to base64
        const croppedBase64 = cropCanvas.toDataURL('image/jpeg', 0.95).split(',')[1];
        resolve(croppedBase64);
      };
      img.src = frameBase64;
    });
  } catch (error) {
    console.warn('[PLATE_CROP] Error extracting plate region:', error);
    return frameBase64; // Return original on error
  }
}

/**
 * Apply adaptive contrast enhancement for OCR
 * Lightweight preprocessing that doesn't require Python
 */
function applyAdaptiveContrast(ctx, width, height) {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Simple histogram equalization for contrast
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      hist[gray]++;
    }

    // Compute cumulative histogram
    const cdf = new Array(256);
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + hist[i];
    }

    // Normalize
    const pixels = data.length / 4;
    for (let i = 0; i < 256; i++) {
      cdf[i] = Math.round((cdf[i] / pixels) * 255);
    }

    // Apply equalization
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const newGray = cdf[gray];
      data[i] = newGray;
      data[i + 1] = newGray;
      data[i + 2] = newGray;
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    // Silently fail - it's just enhancement
    console.debug('[PLATE_CROP] Contrast enhancement skipped:', error.message);
  }
}

/**
 * Node.js version: Extract plate region from image buffer using detection box
 */
export function extractPlateRegionNode(imageBuffer, vehicleDetection, imageWidth, imageHeight) {
  if (!imageBuffer || !vehicleDetection) {
    return imageBuffer;
  }

  try {
    const vehicleX = vehicleDetection.x || 0;
    const vehicleY = vehicleDetection.y || 0;
    const vehicleW = vehicleDetection.width || imageWidth;
    const vehicleH = vehicleDetection.height || imageHeight;

    // Plate region: lower portion of vehicle
    const plateStartY = Math.floor(vehicleY + vehicleH * 0.65);
    const plateEndY = Math.floor(vehicleY + vehicleH * 0.98);
    const plateHeight = plateEndY - plateStartY;

    if (plateHeight < 20) {
      return imageBuffer;
    }

    const marginX = vehicleW * 0.05;
    const plateX = Math.max(0, vehicleX - marginX);
    const plateW = Math.min(imageWidth - plateX, vehicleW + marginX * 2);

    return {
      x: plateX,
      y: plateStartY,
      width: plateW,
      height: plateHeight,
    };
  } catch (error) {
    console.warn('[PLATE_CROP_NODE] Error:', error);
    return null;
  }
}
