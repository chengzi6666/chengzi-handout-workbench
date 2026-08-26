# 橙子讲义工坊

面向教研老师的主讲 PDF → 可审核、可编辑 Word 讲义生成系统。

## 已确定的产品规则

- 工号＋姓名登录，所有用户权限相同。
- 左侧项目栏支持项目搜索、置顶、重命名与历史任务。
- 支持 OpenAI、OpenAI 兼容接口和公司内部模型接口。
- 公司内部接口可标记图片理解、联网检索和结构化JSON能力，Key以AES-GCM加密保存。
- 可选择生成每讲学生版、五讲合订学生版、合订版答案、家长手册和独立答案。
- 【阅读文段】不得压缩或改写，只允许人工确认后的纠错。
- 只有2年级【阅读文段】添加拼音；拼音必须人工审核后写入 Word 原生注音结构。
- 每个交流话题必须在学生讲义中直接附参考答案。
- Word 默认微软雅黑，采用稳定文档为主、局部浮动的混合排版。
- 主讲卡通图片使用“浮于文字上方”，支持拖动、缩放和更换。
- 合订版每讲之间插入真正的 Word 分页符。
- 每讲默认5页，内容溢出时增加第6页，禁止删减阅读文段。
- 合订版包含封面和家长手册，家长手册也可单独生成。
- 先审核文字，再审核美化版页面，最后生成 DOCX。
- 可发布带 Open Graph 分享信息的网页版翻页书；在微信内分享时显示标题卡片。接入微信小程序时可复用同一公开书籍页和数据接口。

## 本地启动

Windows 本机已安装依赖时，可一键启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

浏览器访问 `http://localhost:3100/`。停止网页和后台任务：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1
```

也可以手动启动：

```bash
pnpm install
pnpm db:generate
pnpm dev
```

另开一个终端启动后台PDF解析任务：

```bash
pnpm worker
```

复制 `.env.example` 为 `.env`，按需配置数据库、对象存储和模型接口。

## Railway

仓库包含 `Dockerfile` 和 `railway.toml`。Railway 需要从同一仓库创建两个服务：

- Web 服务：使用默认 Docker 启动命令。
- Worker 服务：覆盖启动命令为 `pnpm db:migrate && pnpm worker`，无需公网域名。

两项服务共享 PostgreSQL、S3兼容对象存储及密钥环境变量。另设置 `PUBLIC_APP_URL` 为 Web 公网域名，并在系统“模型设置”中至少启用一个支持 JSON 的大语言模型；需要自动查找最新教材对标时，应选公司内部支持联网检索的模型。

## 安全

真实 PDF、教师素材、生成文档、数据库密码与模型 Key 不进入公开 Git 仓库。
