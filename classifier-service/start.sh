#!/bin/bash
# 启动 Python 分类服务

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "[INFO] 创建 Python 虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

# 安装依赖
echo "[INFO] 安装 Python 依赖..."
pip install -r requirements.txt -q

# 检查模型文件
if [ ! -f "svm_model.pkl" ]; then
    echo ""
    echo "⚠️  警告: 未找到训练好的模型文件"
    echo "   将使用规则匹配作为备用方案"
    echo "   如需使用 ML 模型，请:"
    echo "   1. 将 output_label_0.csv 和 output_label_1.csv 复制到此目录"
    echo "   2. 运行: python train.py"
    echo ""
fi

echo "[INFO] 启动分类服务 (端口 5001)..."
python app.py
