# GMShop Edge 部署检查清单

简体中文 · [English](DEPLOYMENT.md)

GMShop Edge 是单部署、单租户的数字商品商城。每个实例只能选择一个 Cloudflare Workers
部署或一个 Node/Nitro 容器部署。公开页与客户页使用常规应用布局，内部运营统一位于
`/admin`。

## Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/GMWalletApp/gmshop-edge)

使用 Workers Builds 引导部署时，将构建命令设为 `bun run build`，部署命令设为
`wrangler deploy`。Workers CI 中的构建脚本会按精确名称创建或复用 D1、KV、R2、
Commerce Queue 与死信 Queue，对 `gmshop-edge` 应用 migration，并且只向
`dist/server/wrangler.json` 注入解析出的 D1/KV ID；可移植的 `wrangler.jsonc`
永远不会被改写。

CLI 部署命令：

```bash
bun install
bunx wrangler login
bun run deploy
```

`predeploy` Hook 执行相同的远程准备。普通 `bun run build` 仅在本地构建，绝不访问
Cloudflare。部署后访问 `/install`，确认自动识别的 Origin 和 Allowed Hosts，再创建
首位 root 用户。

核对以下精确资源和 binding：

- `gmshop-edge` D1 对应 `DB`，`gmshop-edge-cache` KV 对应 `CACHE`。
- 私有 `gmshop-edge-files` R2 对应 `FILES`。
- `gmshop-edge-commerce` 对应 `COMMERCE_QUEUE`，死信队列为
  `gmshop-edge-commerce-dlq`。
- 一分钟 Cron；选择 Cloudflare Send Email 时还需 `EMAIL` binding。

## Node 与 Docker

公开镜像 `ghcr.io/gmwalletapp/gmshop-edge` 支持 `linux/amd64` 和
`linux/arm64`。稳定部署使用 `latest`，预发布测试使用 `alpha`，可复现部署使用
`1.0.0` 这类完整版本。

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

容器使用非 root 用户运行。`GMSHOP_DATA_DIR` 是唯一公开的 Node 环境变量，其中保存
`gmshop.sqlite`、私有对象、可靠 Queue 状态和全部运行数据。更新或重建容器时必须保留
并备份 volume。Origin、Allowed Hosts、邮件、支付、供应商和自动化凭据只能通过
`/install` 或 `/admin` 配置，不能放入容器环境变量。

从源码构建需要 Bun 1.3+ 与 Node.js 24：使用 `bun run build:node` 构建，使用
`bun run start:node` 运行产物；运行已发布容器不要求宿主机安装 Node.js。备份、恢复及
Workers 到 Node 的迁入参阅 [Node 数据运维](NODE_DATA_OPERATIONS.zh-CN.md)。

## 生产验收

- 完成 `/install`，验证登录、root 保护、权限路径、密码找回、精确 Host/Origin 校验及
  敏感导出再认证。
- 测试库存原子分配、私有下载、自动化方法、退款或取消、Queue 重试/恢复及过期权益，
  不得暴露对象 key 或秘密。
- 配置 Node 支持的邮件 Provider 或 Workers Email binding，并发送真实找回邮件；真实
  Provider smoke 套件继续保持手动。
- 重启所选运行时，确认订单、权益、私有对象、Queue 工作和定时维护恢复且不重复执行。
- 验证英文与简体中文、两种主题、移动端、键盘操作、焦点恢复与减少动态效果。
- 在同一最终工作区运行 `bun run typecheck`、`bun run test`、`bun run check`、
  `bun run build` 和 `bun run build:node`。禁止提交真实秘密。

## 发布

Semantic-release 从 `alpha` 发布预发行版本，从 `main` 发布稳定版本。预发行镜像写入
完整版本与滚动 `alpha` 标签；稳定镜像写入完整版本、major/minor、major 和 `latest`
标签。原生 amd64 与 arm64 runner 会分别构建并 smoke test，最后发布带 SBOM 和
provenance 的多架构 GHCR manifest。
