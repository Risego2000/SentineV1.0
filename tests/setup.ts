import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock indexedDB for Node.js environment
const mockIndexedDB = {
  open: vi.fn((dbName: string, version: number) => {
    return {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      readyState: 'done',
      result: {
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            add: vi.fn(() => ({ onsuccess: null, onerror: null })),
            put: vi.fn(() => ({ onsuccess: null, onerror: null })),
            get: vi.fn(() => ({ onsuccess: null, onerror: null, result: null })),
            getAll: vi.fn(() => ({ onsuccess: null, onerror: null, result: [] })),
            delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
            clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
          })),
        })),
      },
    };
  }),
  databases: vi.fn(() => Promise.resolve([])),
  deleteDatabase: vi.fn(() => ({ onsuccess: null, onerror: null })),
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
  configurable: true,
});
