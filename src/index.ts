import { type Client, createClient, LibsqlError } from '@libsql/client';

export interface KVStoreOptions {
  url?: string;
  authToken?: string;
  tableName?: string;
  debug?: boolean;
  allowStale?: boolean;
}

export class KVStore {
  private client: Client;
  private tableName: string;
  private initialized: boolean = false;
  private debug: boolean;
  private allowStale?: boolean;

  constructor(client: Client, options: KVStoreOptions = {}) {
    this.client = client;
    this.tableName = options.tableName || 'kv_store';
    this.debug = options.debug || false;
    this.allowStale = options.allowStale || false;
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log(...args);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('KV store already initialized');
    }
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          key TEXT PRIMARY KEY,
          value TEXT,
          expires_at INTEGER
        )
      `;
      this.log('Initialize SQL:', sql);
      await this.client.execute(sql);
      this.initialized = true;
    } catch (error: any) {
      throw new Error(`Failed to initialize KV store: ${error.message}`);
    }
  }

  async set(key: string, value: any, ttl?: number | null): Promise<void> {
    if (
      ttl !== undefined &&
      ttl !== null &&
      (!Number.isInteger(ttl) || ttl < 0)
    ) {
      throw new Error('TTL must be a non-negative integer or null');
    }

    const expiresAt = ttl ? Date.now() + ttl : null;
    const transaction = await this.client.transaction('write');

    try {
      const sql = `
        INSERT INTO ${this.tableName} (key, value, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
      `;
      const args = [key, JSON.stringify(value), expiresAt];

      this.log('Set SQL:', sql);
      this.log('Set args:', args);

      await transaction.execute({ sql, args });
      await transaction.commit();
    } catch (error: any) {
      await transaction.rollback();
      throw new Error(`Failed to set value: ${error.message}`);
    } finally {
      transaction.close();
    }
  }

  async get<T = any>(key: string, allowStale?: boolean): Promise<T | null> {
    try {
      const sql = `SELECT value, expires_at FROM ${this.tableName} WHERE key = ?`;
      const args = [key];

      this.log('Get SQL:', sql);
      this.log('Get args:', args);

      const result = await this.client.execute({ sql, args });
      const row = result.rows[0] as
        | { value: string; expires_at: number | null }
        | undefined;

      if (!row) return null;

      const isStale = row.expires_at && row.expires_at <= Date.now();
      const shouldAllowStale = allowStale ?? this.allowStale ?? false;

      if (isStale && !shouldAllowStale) {
        return null;
      }

      return JSON.parse(row.value) as T;
    } catch (error: any) {
      throw new Error(`Failed to get value: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const transaction = await this.client.transaction('write');
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE key = ?`;
      const args = [key];

      this.log('Delete SQL:', sql);
      this.log('Delete args:', args);

      await transaction.execute({ sql, args });
      await transaction.commit();
    } catch (error: any) {
      await transaction.rollback();
      throw new Error(`Failed to delete value: ${error.message}`);
    } finally {
      transaction.close();
    }
  }

  async clearExpired(): Promise<number> {
    const transaction = await this.client.transaction('write');
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE expires_at IS NOT NULL AND expires_at <= ?`;
      const args = [Date.now()];

      this.log('Clear expired SQL:', sql);
      this.log('Clear expired args:', args);

      const result = await transaction.execute({ sql, args });
      await transaction.commit();
      return Number(result.rowsAffected);
    } catch (error: any) {
      await transaction.rollback();
      throw new Error(`Failed to clear expired entries: ${error.message}`);
    } finally {
      transaction.close();
    }
  }

  async close(): Promise<void> {
    this.client.close();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export function createKVStore(options: KVStoreOptions = {}): KVStore {
  const url = options.url || process.env.LIBSQL_URL || 'file:./kv-store.db';
  const authToken = options.authToken || process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  return new KVStore(client, options);
}

export { LibsqlError };
