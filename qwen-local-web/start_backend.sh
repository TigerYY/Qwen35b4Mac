#!/bin/bash
set -e

# 设置工作目录为脚本所在目录
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
  echo "=> 错误: 找不到虚拟环境 venv 目录，请先运行 ./backend_setup.sh !"
  exit 1
fi

echo "=> 激活虚拟环境..."
source venv/bin/activate

# 暴露给局域网
HOST="0.0.0.0"
START_PORT=8080
MAX_PORT=8099
PORT=$START_PORT

# 动态探测可用端口，防止开发者环境下的冲突 (Errno 48)
echo "=> 正在探寻空闲端口 (从 $START_PORT 开始)..."
while lsof -i:$PORT -t >/dev/null 2>&1 || nc -z localhost $PORT >/dev/null 2>&1; do
  echo "   - 端口 $PORT 被占用，尝试下一个..."
  PORT=$((PORT+1))
  if [ $PORT -gt $MAX_PORT ]; then
    echo "=> 错误: 无法在 $START_PORT 到 $MAX_PORT 之间找到可用的空闲端口！"
    exit 1
  fi
done

echo "=> 找到可用端口: $PORT"

# 将选定端口写入配置，供前端应用（Vite/React）动态读取
echo "$PORT" > frontend/.env.backend_port

# 指向您给定的本地模型绝对路径 (HuggingFace cache snapshot format)
MODEL="/Users/yangyang/Documents/YYLLM/qwen-local-web/models--mlx-community--Qwen3.5-35B-A3B-4bit/snapshots/1e20fd8d42056f870933bf98ca6211024744f7ec"

echo "=> 正在启动 MLX-VLM 推理服务..."
echo "=> 模型: $MODEL"
echo "=> 监听: http://$HOST:$PORT"
echo "=> 注意: 首次运行将自动从 HuggingFace 镜像下载约 18GB 的模型权重，请勿中断进程。"

# 启动 mlx_vlm 内置的基于 FastAPI/Uvicorn 的服务端点
python3 -m mlx_vlm.server \
    --host "$HOST" \
    --port "$PORT"
