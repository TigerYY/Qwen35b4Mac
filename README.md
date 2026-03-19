# YYLLM

本地大模型与 Web 聊天终端项目集合。

## 子项目

### [qwen-local-web](./qwen-local-web/)

基于 **MLX** 的 Qwen 3.5 本地推理 + React 前端聊天界面，支持多模态（图片）、可选联网检索。

- 后端：Python `mlx-vlm`，OpenAI 兼容 API
- 前端：React + TypeScript + Vite，暗色极光风格 UI
- 详见 [qwen-local-web/README.md](./qwen-local-web/README.md)

---

## 快速开始

进入子项目目录并按该项目的 README 操作，例如：

```bash
cd qwen-local-web
./backend_setup.sh   # 首次需配置 Python 环境
./start_all.sh       # 启动后端 + 前端
```

停止服务：`./stop_all.sh`（在对应子项目目录下执行）。

---

## API 使用方式 (qwen-local-web)

本项目后端基于 `mlx-vlm` 提供了 **OpenAI 兼容** 的 HTTP 接口，可供第三方应用或脚本调用。

### 1. 接口信息

- **基础 URL**: `http://localhost:PORT/v1/chat/completions` (默认 `PORT` 从 8080 开始探测)
- **鉴权**: 暂不需要真实 Key，Header 中可传 `Authorization: Bearer sk-local-no-key`
- **模型名称**: 在请求 payload 中指定 `model: "Qwen3.5-35B-A3B-4bit"` (或任意字符串，本地服务目前会忽略具体的模型校验而使用加载好的模型)

### 2. 调用示例 (curl)

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-local-no-key" \
  -d '{
    "model": "qwen",
    "messages": [
      {"role": "system", "content": "你是一个有用的助手。"},
      {"role": "user", "content": "你好，请自我介绍。"}
    ],
    "temperature": 0.7,
    "stream": false
  }'
```

> [!NOTE]
> **关于端口**: 如果 8080 端口被占用，脚本会自动寻找 8081, 8082... 等可用端口。实际端口会写入到 `qwen-local-web/frontend/.env.backend_port` 文件中，你可以通过该文件查看当前运行的端口。

### 3. Ollama 用户 (另一种本地调用方案)

如果您本地运行了 **Ollama**，也可以直接将其接入。

- **Base URL**: `http://localhost:11434/v1`
- **API Key**: 填 `ollama` (或任意非空字符串)
- **模型名称**: 填入您通过 `ollama list` 查看的模型全名，例如 `qwen2.5:32b`

---
