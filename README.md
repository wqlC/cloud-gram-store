# CloudGram Store

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-blue.svg)](https://core.telegram.org/bots/api)

<p align="center">
  <img src="https://raw.githubusercontent.com/cloudflare/cloudflare-brand-assets/master/logo/cloudflare-logo-white-blue-background.png" alt="Cloudflare Logo" width="300"/>
</p>

CloudGram Store 是一个基于 Cloudflare Workers 和 Telegram Bot API 的云文件管理系统，通过创新的方式将 Telegram 作为文件存储后端，实现了无需传统云存储服务的个人云盘解决方案。系统支持多用户登录、文件上传、下载、重命名、删除、目录管理等功能，适合个人和小型团队使用。

## ✨ 功能特性

- **用户认证**：基于 JWT 的安全认证系统
- **文件管理**：
  - 文件上传（支持拖拽上传和多文件选择）
  - 文件下载、预览
  - 文件重命名和删除
  - 大文件分片处理（突破 Telegram 单文件限制）
- **文件夹管理**：
  - 多级文件夹创建和导航
  - 面包屑路径导航
  - 文件夹重命名和删除
- **用户体验**：
  - 拖拽上传、进度反馈
  - 全局加载状态显示
  - 操作结果通知（成功/失败/详情）
  - 响应式美观 UI，适配移动设备
  - 键盘快捷键支持

## 🚀 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) (v16 或更高版本)
- [npm](https://www.npmjs.com/) 或 [yarn](https://yarnpkg.com/)
- [Cloudflare 账户](https://dash.cloudflare.com/sign-up)
- [Telegram Bot](https://core.telegram.org/bots#how-do-i-create-a-bot) 和一个用于存储文件的 Telegram 群组/频道

### 安装

1. **克隆仓库**

   ```sh
   git clone https://github.com/yourusername/cloud-gram-store.git
   cd cloud-gram-store
   ```

2. **安装依赖**

   ```sh
   npm install
   ```

3. **配置环境**

   复制示例配置文件并进行编辑：

   ```sh
   cp wrangler.jsonc.example wrangler.jsonc
   ```

   编辑 `wrangler.jsonc` 文件，填入以下信息：
   - Telegram Bot Token
   - Telegram Chat ID
   - 管理员用户名和密码
   - JWT 密钥

4. **初始化数据库**

   ```sh
   npx wrangler d1 create cloud-gram-store-db
   ```

   将生成的数据库 ID 添加到 `wrangler.jsonc` 文件中。

   ```sh
   npx wrangler d1 execute cloud-gram-store-db --file=schema.sql
   ```

### 本地开发

1. **启动开发服务器**

   ```sh
   npm run dev
   # 或
   npx wrangler dev
   ```

2. **访问前端**

   打开浏览器访问 http://localhost:8787

### 部署到 Cloudflare Workers

```sh
npm run deploy
# 或
npx wrangler deploy
```

## 📂 项目结构

```
├── public/           # 前端静态资源
│   ├── css/          # 样式文件
│   ├── js/           # JavaScript 文件
│   │   └── modules/  # JS 模块
│   └── index.html    # 主页面
├── src/              # 后端服务
│   ├── services/     # 核心服务
│   │   ├── auth.js   # 认证服务
│   │   ├── database.js # 数据库服务
│   │   ├── file.js   # 文件服务
│   │   └── telegram.js # Telegram 服务
│   ├── utils/        # 工具函数
│   │   ├── response.js # 响应处理
│   │   └── router.js # 路由处理
│   └── index.js      # 主入口
├── schema.sql        # 数据库结构
├── wrangler.jsonc    # Cloudflare 配置
└── package.json      # 项目依赖
```

## 💡 技术实现

### 核心技术栈

- **前端**：原生 JavaScript、HTML5、CSS3
- **后端**：Cloudflare Workers (JavaScript)
- **数据库**：Cloudflare D1 (SQLite)
- **存储**：Telegram Bot API
- **认证**：JWT (JSON Web Tokens)

### 创新点

- **Telegram 作为存储后端**：利用 Telegram 的无限存储空间，避免了对传统云存储的依赖
- **文件分片处理**：突破 Telegram 单文件大小限制，支持大文件上传和下载
- **边缘计算**：基于 Cloudflare Workers 的全球分布式部署，提供低延迟访问

## 👥 贡献

欢迎贡献代码、报告问题或提出改进建议！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 📜 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件

## 📞 联系方式

如需详细开发文档或遇到问题，请联系项目维护者或提交 Issue。

---

<p align="center">使用 ❤️ 和 ☕ 构建</p>
