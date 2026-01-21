
// @ts-ignore
const ort = window.ort;

const COCO_LABELS = [
    'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
    'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
    'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
    'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
    'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
    'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
    'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
    'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
    'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
    'toothbrush'
];

export class YoloDetector {
    session: any = null;
    inputShape: [number, number, number, number] = [1, 3, 640, 640];

    constructor() { }

    async load(modelPath: string) {
        try {
            this.session = await ort.InferenceSession.create(modelPath, {
                executionProviders: ['wasm', 'webgl']
            });
            console.log("YOLO Model loaded:", modelPath);
            return true;
        } catch (e) {
            console.error("Failed to load YOLO model:", e);
            return false;
        }
    }

    async detect(imageSource: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, confidenceThreshold: number) {
        if (!this.session) return [];

        const tensor = await this.preprocess(imageSource);
        const feeds = { [this.session.inputNames[0]]: tensor };
        const results = await this.session.run(feeds);
        const output = results[this.session.outputNames[0]]; // Shape: [1, 84, 8400] usually

        const width = (imageSource as any).videoWidth || (imageSource as any).naturalWidth || imageSource.width;
        const height = (imageSource as any).videoHeight || (imageSource as any).naturalHeight || imageSource.height;

        return this.postprocess(output, confidenceThreshold, width, height);
    }

    async preprocess(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context not available");

        ctx.drawImage(source, 0, 0, 640, 640);
        const imageData = ctx.getImageData(0, 0, 640, 640);
        const { data } = imageData;

        const float32Data = new Float32Array(1 * 3 * 640 * 640);

        for (let i = 0; i < 640 * 640; i++) {
            const r = data[i * 4] / 255.0;
            const g = data[i * 4 + 1] / 255.0;
            const b = data[i * 4 + 2] / 255.0;

            float32Data[i] = r; // R
            float32Data[640 * 640 + i] = g; // G
            float32Data[2 * 640 * 640 + i] = b; // B
        }

        return new ort.Tensor('float32', float32Data, this.inputShape);
    }

    postprocess(output: any, threshold: number, imgW: number, imgH: number) {
        const data = output.data;
        const dims = output.dims; // [1, 84, 8400]
        const [batch, channels, anchors] = dims;

        // Transpose if necessary? YOLO v8 output is usually [1, 84, 8400] -> 4 boxes + 80 classes
        // data layout is sequential

        const boxes: any[] = [];

        // Stride is 8400 (anchors). Channels is 84 (4 coords + 80 classes)
        // Wait, normally memory is [batch, channel, anchor] -> flat array
        // So channel 0 is first 8400 floats?
        // Yes. 
        // row 0: cx values for all 8400 anchors
        // row 1: cy values ...
        // ...
        // row 4: class 0 scores ...

        for (let i = 0; i < anchors; i++) {
            // Find max class score
            let maxScore = 0;
            let maxClass = -1;

            for (let c = 0; c < 80; c++) {
                const score = data[(4 + c) * anchors + i];
                if (score > maxScore) {
                    maxScore = score;
                    maxClass = c;
                }
            }

            if (maxScore > threshold) {
                const cx = data[0 * anchors + i];
                const cy = data[1 * anchors + i];
                const w = data[2 * anchors + i];
                const h = data[3 * anchors + i];

                const x = (cx - w / 2) * (imgW / 640);
                const y = (cy - h / 2) * (imgH / 640);
                const width = w * (imgW / 640);
                const height = h * (imgH / 640);

                boxes.push({
                    bbox: [x, y, width, height],
                    class: COCO_LABELS[maxClass],
                    score: maxScore
                });
            }
        }

        return this.nms(boxes);
    }

    nms(boxes: any[], iouThreshold = 0.5) {
        if (boxes.length === 0) return [];

        boxes.sort((a, b) => b.score - a.score);

        const result = [];
        const active = new Array(boxes.length).fill(true);

        for (let i = 0; i < boxes.length; i++) {
            if (!active[i]) continue;
            result.push(boxes[i]);

            for (let j = i + 1; j < boxes.length; j++) {
                if (!active[j]) continue;

                const iou = this.computeIoU(boxes[i].bbox, boxes[j].bbox);
                if (iou > iouThreshold) {
                    active[j] = false;
                }
            }
        }
        return result;
    }

    computeIoU(box1: number[], box2: number[]) {
        const [x1, y1, w1, h1] = box1;
        const [x2, y2, w2, h2] = box2;

        const xi1 = Math.max(x1, x2);
        const yi1 = Math.max(y1, y2);
        const xi2 = Math.min(x1 + w1, x2 + w2);
        const yi2 = Math.min(y1 + h1, y2 + h2);

        const interW = Math.max(0, xi2 - xi1);
        const interH = Math.max(0, yi2 - yi1);

        const interArea = interW * interH;
        const box1Area = w1 * h1;
        const box2Area = w2 * h2;
        const unionArea = box1Area + box2Area - interArea;

        return interArea / unionArea;
    }
}
