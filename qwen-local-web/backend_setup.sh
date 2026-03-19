#!/bin/bash
set -e

echo "=> 初始化后端 Python 虚拟环境..."
python3 -m venv venv

echo "=> 激活虚拟环境并安装依赖..."
source venv/bin/activate

# 升级 pip
python3 -m pip install --upgrade pip

# 安装核心依赖包 mlx-vlm
echo "=> 安装 mlx-vlm及多模态API后端相关依赖..."
python3 -m pip install -U mlx-vlm

echo "=> 环境准备完毕！"
echo "您可以通过 ./start_backend.sh 启动模型服务。"
