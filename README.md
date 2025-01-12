# libsql-kv

A flexible key-value store built on top of libSQL, providing an easy way to store, retrieve, and manage data with optional TTL (time-to-live) support.

## Installation

```bash
npm install libsql-kv
```

## Basic Usage

```typescript
import { createKVStore } from 'libsql-kv';

async function example() {
  const store = createKVStore({
    url: 'file:./path/to/kv-store.db',
    // ...other config like authToken or debug
  });

  // Initialize the KV store
  await store.initialize();

  // Set a value with optional TTL (in ms)
  await store.set('myKey', { foo: 'bar' }, 60000);

  // Get the value
  const data = await store.get('myKey');
  console.log(data); // { foo: 'bar' }

  // Delete the value
  await store.delete('myKey');

  // Close the client connection
  await store.close();
}

example();
```

## Environment Variables

- `LIBSQL_URL` (e.g., `libsql://your-database.turso.io` or `file:./kv-store.db`)
- `LIBSQL_AUTH_TOKEN` (optional; required for remote databases)

The library uses these variables if no configuration is provided. Defaults to `file:./kv-store.db`.

## Advanced Configuration

You can pass additional configuration properties when creating the KV store:

```typescript
const store = createKVStore({
  url: 'libsql://your-database.turso.io',
  authToken: 'my-secret-token',
  debug: true,
});
```

## API

### `initialize()`

Creates the underlying table if it doesn’t exist. Must be called before using any other methods.

### `set(key, value, ttl?)`

Stores a value with an optional time-to-live in milliseconds. Overwrites existing data under the same key.

### `get(key)`

Retrieves the stored value. Automatically deletes and returns null if TTL has expired.

### `delete(key)`

Removes a specific key-value entry from the store.

### `clearExpired()`

Removes all entries whose TTL has expired. Returns the number of entries removed.

### `close()`

Gracefully closes the underlying client/connection to libSQL.

### `isInitialized()`

Checks if the KV store has already been initialized.
