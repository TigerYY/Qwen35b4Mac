# Qwen AI Terminal

为 **Qwen 3.5 (35B-A3B-4bit)** 打造的本地 Web 聊天终端。基于 MLX 在本地运行模型，搭配高颜值暗色极光风格前端，支持多模态（图片上传）、可选联网检索、多话题会话与会话级记忆。

## 功能特性

- **本地推理**：使用 `mlx-vlm` 在 Apple Silicon 上运行 Qwen 3.5 4bit 量化模型
- **多模态**：支持文字 + 图片输入（上传、拖拽、粘贴）
- **联网模式**：可选开启智能检索（意图判断 + 多搜索源），支持**自动 / 海外优先 / 国内优先**策略；检索结果先经本地模型整理为「检索摘要」再生成回答，来源可追溯
- **多话题会话**：历史按「话题」归类，左侧话题栏支持新建、切换、重命名、删除；旧版单会话数据会自动迁移为「历史对话」
- **会话记忆**：每个话题维护摘要，长对话时自动使用「此前对话摘要 + 最近若干条消息」压缩上下文，避免超长历史
- **流式输出**：实时打字机效果，支持中途中止生成
- **对话持久化**：话题与消息保存在浏览器 LocalStorage，刷新不丢失
- **端口自适应**：后端在 8080–8099 间自动寻找空闲端口，前端自动对接

## 环境要求

- **系统**：macOS（推荐 Apple Silicon）
- **Python**：3.x，用于后端 `mlx-vlm`
- **Node.js**：用于前端构建与开发（需 `npm`）
- **模型**：Qwen 3.5 35B-A3B-4bit（MLX 格式），约 18GB，首次运行会自动从 HuggingFace 拉取

## 项目结构

```
qwen-local-web/
├── start_backend.sh    # 启动 MLX 推理服务（自动选端口）
├── start_all.sh       # 一键启动后端 + 前端
├── stop_all.sh        # 停止后端与前端进程
├── backend_setup.sh   # 创建 venv 并安装 mlx-vlm
├── venv/              # Python 虚拟环境（运行 backend_setup.sh 后生成）
├── docs/
│   └── TESTING.md     # 按功能点的自测清单
├── frontend/          # React + Vite 前端
│   ├── src/
│   │   ├── App.tsx              # 主应用、会话状态、联网与记忆逻辑
│   │   ├── components/          # ChatLayout（含话题栏）、ChatMessage
│   │   ├── utils/
│   │   │   ├── search.ts        # 多搜索源、路由、检索摘要与来源格式化
│   │   │   ├── conversationStorage.ts  # 话题列表与迁移
│   │   │   └── userMemoryStorage.ts    # 全局用户记忆读写与注入
│   │   └── types.ts             # Message、Conversation、UserMemory 等
│   ├── .env.backend_port        # 由 start_backend.sh 写入，供 Vite 读取
│   └── README.md
└── models--mlx-community--Qwen3.5-35B-A3B-4bit/   # 模型缓存（按需下载）
```

## 安装与运行

### 1. 首次配置后端

在项目根目录执行：

```bash
cd /path/to/qwen-local-web
./backend_setup.sh
```

会创建 `venv` 并安装 `mlx-vlm`。首次启动模型服务时会下载约 18GB 模型权重，请保持网络畅通。

### 2. 启动服务

**方式一：前后端一起启动（推荐）**

```bash
./start_all.sh
```

会先后台启动 MLX 服务，再启动前端。终端中会打印前端访问地址（如 `http://localhost:5175`），用浏览器打开即可。

**方式二：分开启动**

- 终端 1：`./start_backend.sh`（保持运行）
- 终端 2：`cd frontend && npm run dev`，再访问终端里给出的地址

### 3. 停止服务

在项目根目录执行：

```bash
./stop_all.sh
```

会结束 `mlx_vlm.server` 与 Vite 进程。

## 前端单独开发

若只改前端、后端已在别处运行：

```bash
cd frontend
npm install
npm run dev
```

确保 `frontend/.env.backend_port` 中的端口与后端实际监听端口一致（由 `start_backend.sh` 自动写入）。更多说明见 [frontend/README.md](frontend/README.md)。

## 配置说明

- **模型路径**：在 `start_backend.sh` 与 `frontend/src/App.tsx` 中写死为当前 HuggingFace 缓存 snapshot 路径；若你自行下载或移动模型，需同步修改这两处。
- **API 地址**：前端会根据当前访问的 `hostname` 与 `.env.backend_port` 拼出 `http://<hostname>:<port>/v1/chat/completions`，便于同一局域网内其他设备访问。
- **联网检索**：前端通过 Vite 代理支持多搜索源：
  - `/api/search/sogou` → 搜狗（国内）
  - `/api/search/duckduckgo` → DuckDuckGo HTML（海外）
  开启「联网模式」后可选择「搜索：自动 / 海外优先 / 国内优先」；会先做意图判断，需要实时信息时检索 → 本地模型整理为检索摘要 → 再基于摘要与来源生成回答。
- **话题与记忆**：话题列表与每条话题的消息、摘要保存在 LocalStorage（`chat_conversations`）；会话摘要用于长对话时的上下文压缩；全局用户记忆（`chat_user_memory`）可在启用时注入系统提示词，当前暂无设置 UI，可按类型自行扩展。

## 技术栈摘要

| 部分     | 技术 |
|----------|------|
| 后端推理 | Python `mlx-vlm`，FastAPI/Uvicorn，OpenAI 兼容 `/v1/chat/completions` |
| 前端     | React 19、TypeScript、Vite 7、react-markdown、react-syntax-highlighter |
| 联网     | 多搜索源（Sogou / DuckDuckGo，Vite proxy）+ 路由策略（auto / 海外优先 / 国内优先）+ 检索摘要（本地模型整理）后作答 |
| 会话     | 话题列表（Conversation）+ LocalStorage 持久化 + 会话摘要压缩长上下文 |

## 自测清单

按功能点的自测步骤见 [docs/TESTING.md](docs/TESTING.md)，涵盖：话题管理、联网与搜索源、检索理解与回答、会话记忆、基础聊天与多模态、存储与边界情况等。

## 常见问题

- **无法连接本地服务**：确认先执行 `./start_backend.sh` 或 `./start_all.sh`，并查看终端是否有端口占用或模型加载错误。
- **端口被占用**：后端会在 8080–8099 间自动换端口，并写入 `frontend/.env.backend_port`；若改了后端端口，需重启前端或重新运行 `start_backend.sh` 以更新该文件。
- **LocalStorage 超限**：应用会按话题持久化；若总容量超限，会尝试保留最近若干话题，详见 `conversationStorage` 中的清理逻辑。
- **联网检索无结果**：检查网络与 Vite 代理；海外源（DuckDuckGo）若被墙可切「国内优先」或依赖自动回退到搜狗。

---

如有问题或改进想法，可在项目内提 Issue 或直接修改代码后提交。
