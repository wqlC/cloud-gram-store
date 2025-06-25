# CloudGram Store

CloudGram Store 是一个基于 Cloudflare D1 的云文件管理系统，支持多用户登录、文件上传、下载、重命名、删除、目录管理等功能，适合个人和团队云盘场景。

## 功能特性
- 用户注册与登录
- 文件夹多级管理与导航（面包屑路径）
- 文件上传、下载、重命名、删除
- 文件夹重命名、删除（操作集中在“更多”菜单）
- 拖拽上传、进度反馈、全局 Loading
- 操作结果通知（成功/失败/详情）
- 响应式美观 UI

## 本地开发
1. **安装依赖**
   ```sh
   npm install
   ```
2. **初始化数据库**
   - 确认 `schema.sql` 已存在。
   - 启动本地 D1 数据库（Cloudflare D1 或 SQLite）。
   - 若找不到数据库文件，尝试在前端新建文件夹或上传文件，促使后端写入。
   - 数据库文件通常在 `.d1/`、`.wrangler/`、`data/` 等目录下。

3. **启动开发服务器**
   ```sh
   npm run dev
   # 或
   npx wrangler dev
   ```

4. **访问前端**
   打开浏览器访问 http://localhost:8787

## 目录结构
```
public/           # 前端静态资源
  index.html
  js/
  css/
src/              # 后端服务与工具
  services/
  utils/
schema.sql        # 数据库结构
wrangler.jsonc    # Cloudflare Wrangler 配置
```

## 常见问题
- **路径导航只显示根目录？**
  - 检查数据库 folders 表 parent_id 字段是否正确，确保有多级目录。
  - 检查 loadDirectory、getFolderPath 的参数传递。
- **本地找不到数据库文件？**
  - 查看 .d1/、.wrangler/、data/ 等目录，或尝试写入操作后再查找。

## 贡献
欢迎 issue、PR 和建议！

---

如需详细开发文档或遇到问题，请联系项目维护者。
