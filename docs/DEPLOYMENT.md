# GMShop Edge deployment checklist

[简体中文](DEPLOYMENT.zh-CN.md) · English

GMShop Edge is a single-deployment, single-tenant digital-goods store. Deploy
one instance on Cloudflare Workers or as one Node/Nitro container. Public and
customer pages use the normal application layout; internal operations remain
under `/admin`.

## Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/GMWalletApp/gmshop-edge)

For a guided Workers Build, use `bun run build` as the build command and
`wrangler deploy` as the deploy command. In Workers CI, the build script creates
or reuses exact named D1, KV, R2, Commerce Queue, and dead-letter Queue
resources, applies migrations to `gmshop-edge`, and injects resolved D1/KV IDs
only into `dist/server/wrangler.json`. The portable `wrangler.jsonc` is never
rewritten.

For a CLI deployment:

```bash
bun install
bunx wrangler login
bun run deploy
```

The `predeploy` hook performs the same remote preparation. Ordinary
`bun run build` stays local and does not contact Cloudflare. After deployment,
open `/install`, confirm the detected Origin and Allowed Hosts, and create the
first root user.

Verify these exact resources and bindings:

- `gmshop-edge` D1 as `DB` and `gmshop-edge-cache` KV as `CACHE`.
- Private `gmshop-edge-files` R2 as `FILES`.
- `gmshop-edge-commerce` as `COMMERCE_QUEUE`, with
  `gmshop-edge-commerce-dlq` as its dead-letter Queue.
- One-minute Cron and, when selected, Cloudflare Send Email as `EMAIL`.

## Node and Docker

The public `ghcr.io/gmwalletapp/gmshop-edge` image supports `linux/amd64` and
`linux/arm64`. Use `latest` for stable releases, `alpha` for prerelease testing,
or a complete version such as `1.0.0` for reproducible deployment.

```yaml
services:
  gmshop-edge:
    image: ghcr.io/gmwalletapp/gmshop-edge:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      GMSHOP_DATA_DIR: /var/lib/gmshop
    volumes:
      - gmshop-data:/var/lib/gmshop

volumes:
  gmshop-data:
```

```bash
docker compose pull
docker compose up -d
curl --fail http://127.0.0.1:3000/healthz
```

The container runs as a non-root user. `GMSHOP_DATA_DIR` is the only public
Node environment variable: it contains `gmshop.sqlite`, private objects,
durable Queue state, and all runtime data. Preserve and back up the volume when
updating or recreating the container. Configure Origin, Allowed Hosts, email,
payments, suppliers, and automation credentials through `/install` or `/admin`,
not container variables.

To build from source, install Bun 1.3+ and Node.js 24, run
`bun run build:node`, then run the result with `bun run start:node`. Host
Node.js is not required for the published container. See
[Node data operations](NODE_DATA_OPERATIONS.md) for backup, restore, and
Workers-to-Node import.

## Production acceptance

- Complete `/install`, then verify sign-in, root protection, permission paths,
  password recovery, exact Host/Origin validation, and sensitive-export
  reauthentication.
- Test stock allocation, a private download, an automation method, a refund or
  cancellation, Queue retry/recovery, and an expired entitlement without
  exposing object keys or secrets.
- Configure a supported Node email provider or the Workers Email binding and
  send a real recovery email. Real provider smoke suites remain manual.
- Restart the selected runtime and confirm orders, entitlements, private
  objects, Queue work, and scheduled maintenance resume without duplication.
- Verify English and Simplified Chinese, both themes, mobile layout, keyboard
  navigation, focus restoration, and reduced motion.
- Run `bun run typecheck`, `bun run test`, `bun run check`, `bun run build`, and
  `bun run build:node` on the same final tree. Never commit real secrets.

## Releases

Semantic-release publishes `alpha` prereleases and stable `main` releases.
Prereleases receive the full version and moving `alpha` image tags; stable
releases receive full, major/minor, major, and `latest` tags. Native amd64 and
arm64 runners independently build and smoke-test the image before publishing a
multi-platform GHCR manifest with SBOM and provenance.
