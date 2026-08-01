# GMShop Edge

**在边缘网络交付数字商品。**

简体中文 · [English](README.md)

[![许可证：GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-3DA639.svg?style=flat-square)](LICENSE)
[![运行时：Cloudflare Workers](https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020.svg?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Bun](https://img.shields.io/badge/toolchain-Bun-000000.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154.svg?style=flat-square&logo=reactquery&logoColor=white)](https://tanstack.com/start)
[![Cloudflare D1](https://img.shields.io/badge/data-Cloudflare%20D1-F38020.svg?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Better Auth](https://img.shields.io/badge/auth-Better%20Auth-000000.svg?style=flat-square)](https://www.better-auth.com/)
[![@visulima/email](https://img.shields.io/badge/email-%40visulima%2Femail-2563EB.svg?style=flat-square)](https://visulima.com/packages/email)
[![界面语言：2](https://img.shields.io/badge/locales-2-7C3AED.svg?style=flat-square)](project.inlang/settings.json)

GMShop Edge 是面向 Cloudflare Workers 的自托管、单部署、单租户数字商品商城。一个部署
即可提供响应式公开商城、客户中心、结算与交付，以及基于权限的管理后台。

> [!IMPORTANT]
> GMShop Edge 仍在持续开发。内置适配器表示相应接入路径已经实现；生产使用仍需要部署者
> 自己的服务商凭证、备份、监控和真实服务商验收测试。

## 核心能力

- 销售预置库存商品，原子分配加密保存的卡密、账号、激活码或凭证。
- 从异次元发卡 `3.5.5` V4 Open API 或独角数卡 Next `v1.3.1`
  自动同步上游商品，并通过同一 API 来源下的多账号池完成供应商履约。
- 授予对 R2 私有下载文件的鉴权、有界访问。
- 调度部署、脚本、资源开通或构建类自动化商品，并支持
  `none | optional | required` 产出策略。
- 组合永久、固定期限、限次、不限次、免费、一次购买和客户主动续购等权益策略，
  金额计算全程不使用浮点数。
- 支持游客和注册客户结算、私有订单查询、优惠券、退款、售后和运营保留。
- 统一商业身份模型：注册购买直接关联 Better Auth 用户，游客订单使用已校验的结算邮箱，
  待同邮箱账户完成验证后自动认领；系统不会创建影子账户，也不保留独立客户表。
- 事务邮件通过 `@visulima/email` 提供 SMTP、Resend、Postmark、SendGrid、Mailgun
  五种 Provider，并另接 Cloudflare 原生 Send Email binding；邮件模板负责内容，
  邮件记录保存投递状态，Queue/Cron 执行有界重试。
- 由商城在 D1 维护法币汇率，将同一份不可变报价交给 Stripe、GMpay、EPay 或其他
  类型化适配器。
- 通过 Better Auth 在运行时配置邮箱密码、社交、OIDC 和 Telegram 认证 Provider，
  无需重新构建 Worker。Telegram Mini App 使用验签后的 `initData` 自动注册或登录，
  通过 `@tma.js/sdk` 请求全屏并补齐缺失头像；Telegram 用户可独立绑定已验证邮箱，
  是否设置密码由用户另行决定。
- 同步由 grammY 驱动的 Webhook Bot，提供本地化商城指令和固定 Mini App 按钮；可选
  客服功能为每位 Telegram 用户映射一个 Forum Topic，双向转发消息但不保存内容，
  只信任当前群管理员，并自动关闭长时间无活动的会话。
- 使用动态多角色 RBAC、不可移除的 root 约束、服务端权限校验、再认证和审计保护
  `/admin`。
- 提供响应式深浅主题、键盘访问，以及英文（`en-US`）和简体中文（`zh-CN`）两种
  界面语言。
- 持久化用户偏好语言，用于账户和交易邮件；游客订单以结算语言快照作为通知回退。

GMShop Edge 全部功能均开源，不设置闭源 Pro 或 Enterprise 功能层。

## 系统架构

```mermaid
flowchart LR
    Customer["客户"]
    Operator["运营人员"]

    subgraph Worker["单个 GMShop Edge Worker"]
        direction LR
        Storefront["公开商城 · 客户中心"]
        Admin["权限驱动的管理后台"]
        Commerce["商品 · 订单 · 权益"]
        Suppliers["供应商<br/>目录同步 · 账号池 · 采购订单"]
        Delivery["库存 · 下载 · 自动化"]

        Storefront --> Commerce
        Admin --> Commerce
        Admin --> Suppliers
        Commerce --> Delivery
        Commerce --> Suppliers
        Suppliers --> Delivery
    end

    Cloudflare["Cloudflare 服务<br/>D1 · KV · R2 · Queues · Cron"]
    Providers["业务服务商<br/>收银台 · 邮件 · 自动化"]
    Upstreams["上游供货平台<br/>异次元发卡 · 独角数卡 Next"]

    Customer --> Storefront
    Operator --> Admin
    Commerce <--> Cloudflare
    Suppliers <--> Cloudflare
    Delivery <--> Cloudflare
    Delivery --> Providers
    Suppliers <--> Upstreams
```

一个 Worker 承载公开、客户与管理入口。D1 是身份、RBAC、商品、金额、订单、库存、权益、
供应商账号、商品绑定、采购订单、任务、重放保护、限流、outbox 和审计的权威数据源；
KV 只保存经过校验、带版本且有界的上游目录快照与读取缓存；R2 保存私有媒体、下载文件、
自动化制品和导出；Queues 与 Cron 将目录同步、供应商采购与核验、交付、重试、保留清理
和密钥轮换移出同步请求。供应商模块按“平台 + API 来源”同步一次目录，并在同一来源的
可用账号池中自动选择采购账号；上游返回的内容仍通过统一交付记录发放。

路由保持薄层；领域页面、schema、Server Function 和行为位于 `src/features`，跨领域运行时
编排位于 `src/server`，全新安装的 Drizzle 唯一基线为
`drizzle/0000_gmshop.sql`。

## 部署到 Cloudflare Workers

GMShop Edge 以单个 Worker 部署，并使用 D1、KV、私有 R2、一个 commerce Queue 及其
死信 Queue、可选的 Cloudflare Send Email binding 和 Cron Triggers。

### 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/GMWalletApp/gmshop-edge)

引导流程会基于本仓库创建 Worker 项目。完成后请访问 `/install`，核对自动创建的资源
binding，并在接收订单前完成生产检查清单。

### 使用 Wrangler 部署

登录 Wrangler、安装依赖并部署：

```bash
bun install
bunx wrangler login
bun run deploy
```

`predeploy` Hook 会创建或复用具名 D1、R2 和 Queue 资源，通过 `DB` 应用 D1 基线并构建
Worker；构建脚本不会将账号专属 ID 写入 `wrangler.jsonc`。请在 Cloudflare 部署环境中
配置 `CACHE` KV namespace，以及启用邮件发送时需要的 `EMAIL` binding。

部署完成后访问 Worker 地址的 `/install` 初始化实例。服务商秘密均从管理后台录入，禁止
提交到仓库。

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) 1.3 或更高版本
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 支持的本地运行环境

安装依赖并启动本地开发服务器：

```bash
bun install
bun run dev
```

`bun run dev` 会将待执行 migration 应用到本地 `gmshop-edge` D1 数据库，并在
<http://localhost:3000> 启动应用；它不会迁移远程数据库。

首次运行访问 <http://localhost:3000/install>。安装会创建首位 root 管理员、受保护的
内置角色、运行时秘密和必需设置，不会创建虚假商品、库存、服务商凭证或支付配置。

安装完成后：

1. 确认自动识别的应用地址，并配置精确 Allowed Hosts。
2. 在 `/admin` 配置公开品牌、注册、认证、邮件、交易、交付、保留和服务商设置。
3. 创建商品草稿、售卖项及库存、文件或自动化配置，检查发布条件后再公开。
4. 配置支付适配器，并在正式开店前完成一笔真实服务商验收订单。
5. 备份 D1、私有 R2 数据和运行时配置。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 运行时 | Cloudflare Workers |
| 应用 | React 19、TanStack Start/Router/Query/Table/Form |
| UI | Tailwind CSS 4、shadcn/Radix |
| 认证 | Better Auth |
| 授权 | 项目自有的动态 RBAC 与权限位掩码 |
| 数据 | Cloudflare D1、Drizzle ORM |
| 边缘服务 | KV、R2、Queues、Cron Triggers、Send Email |
| 国际化 | ParaglideJS |
| 工具链 | Bun、严格 TypeScript、Zod、Vitest、Biome、Wrangler |

## 开发与质量

常用开发命令：

```bash
bun run dev
bun run db:migrate:local
bun run generate-routes
bun run typecheck
bun run test
bun run check
bun run build
```

本地实例完成安装后，可写入幂等的验收数据：

```bash
bun run seed:local
```

验收数据包含商品、库存、支付渠道、客户订单和权益，以及两个支持平台的 3 个供应商账号、
3 个绑定、3 种供应订单状态和带有未导入 SKU 的本地目录快照，可直接验证“所有来源”
列表与批量选择导入；订单与权益归属于安装时创建的
`root@example.com`，并将其本地测试密码重置为 `root@example.com`。
该指令也会写入商品媒体、下载文件、自动化制品，并通过 Telegram Mini App 自动登录
流程创建本地 Telegram 测试用户。
供应商账号均为禁用状态，API 地址使用
`.example.invalid`，自动同步也保持关闭，因此不会请求真实上游；如需联调，请在后台换成
自己的凭据并显式启用。此脚本仅接受 `--local`，不会清空已有数据，也不能写入远程 D1。

只有在有意修改 Drizzle Schema 时才使用 `bun run db:generate`，并检查生成的 migration。
日常开发只应用 migration，不重新生成全新安装基线。

提交完整改动前，应在同一最终工作区运行质量门：

```bash
bun run typecheck
bun run test
bun run check
bun run build
```

确定性自动化测试用于证明应用行为。真实支付、邮件、Telegram 和自动化 Provider smoke
套件保持手动且无条件跳过；生产验收必须使用部署者自己的基础设施。

## API 合约

应用的机器可读 HTTP 合约见 [OpenAPI YAML](public/openapi.yaml)。

## 安全

- 禁止提交 `.dev.vars`、服务商凭证、运行时秘密、私钥或 Cloudflare 凭证。
- 生产前配置精确 Allowed Hosts、HTTPS、Origin/CSRF 校验、限流、Queue/DLQ 监控、
  管理员恢复和备份。
- 私有 R2 对象必须通过 D1 权限记录解析，客户端不能选择 object key。
- 金额以最小货币单位的十进制整数字符串保存，计算不使用浮点数。
- schema 或保留策略变更前备份 D1/R2，并实际测试恢复，不能把未经恢复验证的备份视为完成。

## 许可证

GMShop Edge 使用 [GPL-3.0-or-later](LICENSE) 许可证。
