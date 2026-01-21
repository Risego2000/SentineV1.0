export class CacheService {
    private static storage = new Map<string, { data: any; expiry: number }>();
    private static readonly DEFAULT_TTL = 1000 * 60 * 60; // 1 hora

    public static set(key: string, data: any, ttl = this.DEFAULT_TTL) {
        this.storage.set(key, {
            data,
            expiry: Date.now() + ttl,
        });
    }

    public static get<T>(key: string): T | null {
        const item = this.storage.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.storage.delete(key);
            return null;
        }

        return item.data as T;
    }

    public static generateKey(...parts: any[]): string {
        return parts.map((p) => JSON.stringify(p)).join('|');
    }

    public static clear() {
        this.storage.clear();
    }
}
