import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../services/aiService';

describe('AIService Utilities', () => {
    it('should sanitize HTML tags to prevent XSS', () => {
        const malicious = '<script>alert("xss")</script>';
        const sanitized = sanitizeText(malicious);
        expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should preserve normal text', () => {
        const normal = 'Vehículo detectado en carril bus';
        const sanitized = sanitizeText(normal);
        expect(sanitized).toBe(normal);
    });

    it('should handle special characters', () => {
        const special = 'Texto con & y "comillas"';
        const sanitized = sanitizeText(special);
        expect(sanitized).toContain('&amp;');
        expect(sanitized).toContain('&quot;');
    });
});
