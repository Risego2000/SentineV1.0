import { ByteTracker } from './ByteTracker';

const ctx: Worker = self as any;
let tracker: ByteTracker | null = null;

ctx.onmessage = (e) => {
    const { type, data } = e.data;

    if (type === 'INIT') {
        tracker = new ByteTracker();
        ctx.postMessage({ type: 'INIT_COMPLETE' });
    } else if (type === 'UPDATE') {
        if (!tracker) return;
        const tracks = tracker.update(data.detections);
        ctx.postMessage({ type: 'UPDATE_COMPLETE', tracks });
    }
};
