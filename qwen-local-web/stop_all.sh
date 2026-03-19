#!/bin/bash

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "================================================="
echo "       🛑 停止 Qwen AI Terminal 全栈服务         "
echo "================================================="

# 标志位，记录是否清理了任何进程
KILLED_ANY=false

# 1. 查找并停止 mlx_vlm.server 后端进程
echo "=> [1/2] 正在检索后端模型进程 (mlx_vlm)..."
# 使用 pgrep 配合完整命令行参数精确打击，防止误杀其他 Python 进程
BACKEND_PIDS=$(pgrep -f "python3 -m mlx_vlm.server")

if [ -n "$BACKEND_PIDS" ]; then
    echo "=> 发现后端进程 PID: $BACKEND_PIDS"
    echo "=> 正在发送终止信号 (SIGTERM)..."
    kill -15 $BACKEND_PIDS
    KILLED_ANY=true
    
    # 等待几秒，如果还不死就强制杀掉 (SIGKILL)
    sleep 2
    STUBBORN_PIDS=$(pgrep -f "python3 -m mlx_vlm.server" || true)
    if [ -n "$STUBBORN_PIDS" ]; then
        echo "=> 进程未响应，正在强制清理 (SIGKILL): $STUBBORN_PIDS"
        kill -9 $STUBBORN_PIDS
    fi
    echo "=> ✅ 后端进程已清理完毕"
else
    echo "=> ⚪ 未发现运行中的后端进程"
fi


# 2. 查找并停止 Vite 前端进程
echo "-------------------------------------------------"
echo "=> [2/2] 正在检索前端 React 进程 (vite)..."
# 精确匹配在当前项目 frontend 目录下运行的 vite 进程
FRONTEND_PIDS=$(pgrep -f "vite")

if [ -n "$FRONTEND_PIDS" ]; then
    echo "=> 发现前端进程 PID: $FRONTEND_PIDS"
    echo "=> 正在终止前端服务..."
    kill -15 $FRONTEND_PIDS
    KILLED_ANY=true
    
    sleep 1
    STUBBORN_PIDS=$(pgrep -f "vite" || true)
    if [ -n "$STUBBORN_PIDS" ]; then
        kill -9 $STUBBORN_PIDS
    fi
    echo "=> ✅ 前端进程已清理完毕"
else
    echo "=> ⚪ 未发现运行中的 Vite 前端进程"
fi

echo "================================================="
if [ "$KILLED_ANY" = true ]; then
    echo "🎉 所有相关服务及其占用资源均已被彻底释放！"
else
    echo "✨ 当前系统非常干净，没有发现残留的 Qwen 服务进程。"
fi
