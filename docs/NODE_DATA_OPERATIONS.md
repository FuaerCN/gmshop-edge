# Node data operations

[简体中文](NODE_DATA_OPERATIONS.zh-CN.md) · English

The Node runtime keeps its authoritative SQLite database at
`$GMSHOP_DATA_DIR/gmshop.sqlite` and private objects under the same data
directory. The maintained CLI is `bun run data -- …`.

## Backup and restore

Stop the GMShop Edge container before backup or restore so SQLite, private
objects, and durable Queue state remain at one logical point in time.

```bash
GMSHOP_DATA_DIR=/srv/gmshop bun run data -- backup \
  --output /srv/backups/gmshop-2026-08-21
GMSHOP_DATA_DIR=/srv/gmshop-restored bun run data -- restore \
  --input /srv/backups/gmshop-2026-08-21
```

The output/input path is explicit. Backup output must be outside the data
directory. Restore accepts only a new or empty target and never overwrites an
existing instance. The manifest verifies every file; restore also checks
SQLite integrity, foreign keys, and immutable migration checksums.

Backups contain credentials, customer records, orders, preset stock, private
downloads, and automation artifacts. Encrypt them at rest, restrict access,
keep them outside the application volume, and regularly test restoration.

The CLI uses `$GMSHOP_DATA_DIR/.maintenance.lock` to prevent the server and a
data operation from opening the same data concurrently. If a host crash leaves
the lock behind, first verify that no GMShop Edge server or data command is
running against that directory, then remove only that lock file and retry.

The published image contains the same CLI. For example:

```bash
docker compose stop gmshop-edge
docker compose run --rm --no-deps \
  --volume "$PWD/backups:/backups" \
  gmshop-edge bun run data -- backup --output /backups/gmshop-2026-08-21
```

## Import a Cloudflare export

Export D1 as SQL and, when used, R2 objects into a local directory whose
relative paths are their original keys. Import only into a new or empty Node
data directory:

```bash
wrangler d1 export DB --remote --output ./d1-export.sql
GMSHOP_DATA_DIR=/srv/gmshop bun run data -- import-cloudflare \
  --d1-sql ./d1-export.sql \
  --r2-dir ./r2-export \
  --r2-manifest ./r2-metadata.json
```

`--r2-dir` is optional for an instance without objects. `--r2-manifest` is also
optional but requires `--r2-dir`; it retains R2 HTTP and custom metadata. It is
a JSON object keyed by the original R2 object key:

```json
{
  "downloads/manual.pdf": {
    "httpMetadata": { "contentType": "application/pdf" },
    "customMetadata": { "productId": "product-123" }
  }
}
```

The import validates repository migrations, SQLite integrity and foreign keys,
then converts R2 keys into the private hashed-object layout. Unknown metadata,
metadata without an object, unsafe paths, and a non-empty target are rejected.
There is no bidirectional synchronization or overwrite mode.
