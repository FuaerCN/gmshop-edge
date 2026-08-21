# Node 数据运维

简体中文 · [English](NODE_DATA_OPERATIONS.md)

Node 运行时将权威 SQLite 数据库保存在 `$GMSHOP_DATA_DIR/gmshop.sqlite`，私有对象
与其他运行状态也位于同一个数据目录。仓库维护的 CLI 为 `bun run data -- …`。

## 备份与恢复

备份或恢复前停止 GMShop Edge 容器，确保 SQLite、私有对象与可靠 Queue 状态处于同一
逻辑时间点。

```bash
GMSHOP_DATA_DIR=/srv/gmshop bun run data -- backup \
  --output /srv/backups/gmshop-2026-08-21
GMSHOP_DATA_DIR=/srv/gmshop-restored bun run data -- restore \
  --input /srv/backups/gmshop-2026-08-21
```

输入和输出路径必须显式提供，备份输出必须位于数据目录外。恢复只接受全新或空目标，永远
不会覆盖已有实例。manifest 会校验每个文件；恢复还会检查 SQLite 完整性、外键与不可变
migration checksum。

备份包含凭据、客户记录、订单、预置库存、私有下载和自动化产物。必须加密保存、限制访问、
放在应用 volume 外，并定期实际测试恢复。

CLI 使用 `$GMSHOP_DATA_DIR/.maintenance.lock` 防止服务进程与数据操作同时打开同一份
数据。若主机异常退出遗留该锁，必须先确认没有 GMShop Edge 服务或数据命令仍在使用这个
目录，然后只删除该锁文件并重试。

发布镜像包含同一个 CLI，例如：

```bash
docker compose stop gmshop-edge
docker compose run --rm --no-deps \
  --volume "$PWD/backups:/backups" \
  gmshop-edge bun run data -- backup --output /backups/gmshop-2026-08-21
```

## 导入 Cloudflare 导出

将 D1 导出为 SQL；使用 R2 时，将对象导出到以原 object key 为相对路径的本地目录。
只能导入全新或空 Node 数据目录：

```bash
wrangler d1 export DB --remote --output ./d1-export.sql
GMSHOP_DATA_DIR=/srv/gmshop bun run data -- import-cloudflare \
  --d1-sql ./d1-export.sql \
  --r2-dir ./r2-export \
  --r2-manifest ./r2-metadata.json
```

无对象时可以省略 `--r2-dir`。`--r2-manifest` 也可省略，但使用它时必须同时提供
`--r2-dir`；该 sidecar 用于保留 R2 HTTP 与自定义 metadata，以原 R2 object key 为
JSON key：

```json
{
  "downloads/manual.pdf": {
    "httpMetadata": { "contentType": "application/pdf" },
    "customMetadata": { "productId": "product-123" }
  }
}
```

导入会验证仓库 migration、SQLite 完整性和外键，再将 R2 key 转换为私有哈希对象布局。
未知 metadata、没有对应对象的 metadata、不安全路径及非空目标都会被拒绝。本工具不提供
双向同步或覆盖模式。
