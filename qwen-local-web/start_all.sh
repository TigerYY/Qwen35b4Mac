#!/bin/bash
set -e

cd "$(dirname "$0")"

# 当按下 Ctrl+C 退出时，干净地杀掉所有后台子进程（前端和后端）
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "================================================="
echo "       🚀 启动 Qwen AI Terminal 全栈服务         "
echo "================================================="

echo "=> [步骤 1/2]: 正在后台启动 MLX 大模型后端服务..."
# 后台启动后端
./start_backend.sh &

# 等待几秒钟让后端分配好端口并写入 .env.backend_port
sleep 3

echo "=> [步骤 2/2]: 正在启动前端 React UI 服务..."
cd frontend
# 启动 Vite 前端
npm run dev
