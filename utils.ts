export const lineIntersect = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
) => {
  const denom = (y4 - y3) * (x2 - x3) - (x4 - x3) * (y2 - y3);
  if (denom === 0) return null;
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) };
  }
  return null;
};

/**
 * Algoritmo Ray-Casting para determinar si un punto está dentro de un polígono.
 * Fundamental para el sistema de 'Box Junction' y zonas de detección 2D.
 */
export const isPointInPoly = (
  point: { x: number; y: number },
  points: { x: number; y: number }[]
) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x,
      yi = points[i].y;
    const xj = points[j].x,
      yj = points[j].y;
    const intersect =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes.
 * Shared utility to avoid duplication across tracking and detection systems.
 */
export const calculateIoU = (
  box1: { x: number; y: number; w: number; h: number },
  box2: { x: number; y: number; w: number; h: number }
): number => {
  const x1_min = box1.x;
  const y1_min = box1.y;
  const x1_max = box1.x + box1.w;
  const y1_max = box1.y + box1.h;

  const x2_min = box2.x;
  const y2_min = box2.y;
  const x2_max = box2.x + box2.w;
  const y2_max = box2.y + box2.h;

  const xi_min = Math.max(x1_min, x2_min);
  const yi_min = Math.max(y1_min, y2_min);
  const xi_max = Math.min(x1_max, x2_max);
  const yi_max = Math.min(y1_max, y2_max);

  const inter_width = Math.max(0, xi_max - xi_min);
  const inter_height = Math.max(0, yi_max - yi_min);
  const inter_area = inter_width * inter_height;

  const box1_area = box1.w * box1.h;
  const box2_area = box2.w * box2.h;
  const union_area = box1_area + box2_area - inter_area;

  return union_area > 0 ? inter_area / union_area : 0;
};
