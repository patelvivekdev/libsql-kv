import { describe, it, expect } from 'vitest';
import { createKVStore, KVStore } from './index';

import fs from 'fs';
import path from 'path';

describe('KVStore', () => {
  let client: KVStore;

  beforeAll(async () => {
    const TEST_DB_PATH = path.join(__dirname, 'test.db');

    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    client = createKVStore({ url: `file:${TEST_DB_PATH}` });
  });

  afterAll(async () => {
    await client.close();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      expect(client.isInitialized()).toBe(false);
    });

    it('should throw error if already initialized', async () => {
      await client.initialize();
      await expect(client.initialize()).rejects.toThrow(
        'KV store already initialized',
      );
    });
  });

  describe('set', () => {
    it('should store a value successfully', async () => {
      await client.set('test-key', { foo: 'bar' });
      const value = await client.get('test-key');
      expect(value).toEqual({ foo: 'bar' });
    });

    it('should update existing value', async () => {
      await client.set('test-key', { foo: 'bar' });
      await client.set('test-key', { foo: 'baz' });
      const value = await client.get('test-key');
      expect(value).toEqual({ foo: 'baz' });
    });

    it('should handle TTL', async () => {
      await client.set('ttl-key', { foo: 'bar' }, 100); // 100ms TTL
      let value = await client.get('ttl-key');
      expect(value).toEqual({ foo: 'bar' });

      await new Promise((resolve) => setTimeout(resolve, 150));
      value = await client.get('ttl-key');
      expect(value).toBeNull();
    });

    it('should throw error for invalid TTL', async () => {
      await expect(client.set('test-key', { foo: 'bar' }, -1)).rejects.toThrow(
        'TTL must be a non-negative integer or null',
      );
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const value = await client.get('non-existent');
      expect(value).toBeNull();
    });

    it('should return cached value', async () => {
      await client.set('cache-key', { foo: 'bar' });
      await client.get('cache-key'); // Cache the value
      const value = await client.get('cache-key');
      expect(value).toEqual({ foo: 'bar' });
    });

    it('should handle different value types', async () => {
      const testCases = [
        { key: 'string', value: 'test' },
        { key: 'number', value: 123 },
        { key: 'boolean', value: true },
        { key: 'array', value: [1, 2, 3] },
        { key: 'object', value: { a: 1, b: 2 } },
        { key: 'null', value: null },
      ];

      for (const { key, value } of testCases) {
        await client.set(key, value);
        const retrieved = await client.get(key);
        expect(retrieved).toEqual(value);
      }
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await client.set('delete-key', { foo: 'bar' });
      await client.delete('delete-key');
      const value = await client.get('delete-key');
      expect(value).toBeNull();
    });

    it('should not throw when deleting non-existent key', async () => {
      await expect(client.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clearExpired', () => {
    it('should clear expired entries', async () => {
      await client.set('expire1', 'value1', 100);
      await client.set('expire2', 'value2', 100);
      await client.set('no-expire', 'value3');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleared = await client.clearExpired();
      expect(cleared).toBe(2);

      const value1 = await client.get('expire1');
      const value2 = await client.get('expire2');
      const value3 = await client.get('no-expire');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
      expect(value3).toBe('value3');
    });
  });
});
