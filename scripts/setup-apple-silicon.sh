#!/bin/bash
# Setup script for Apple Silicon (M1/M2/M3) Macs
# Installs PyTorch with MPS support and DGL for Graph Neural Networks

set -e

echo "🍎 Setting up for Apple Silicon (M1/M2/M3)..."

# Check if we're on Apple Silicon
if [[ $(uname -m) != "arm64" ]]; then
    echo "❌ This script is for Apple Silicon Macs only"
    exit 1
fi

echo "✅ Apple Silicon detected"

# Navigate to API directory
cd "$(dirname "$0")/../apps/api"

# Create virtual environment if not exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

echo "📦 Upgrading pip..."
pip install --upgrade pip

echo "📦 Installing PyTorch for Apple Silicon (MPS backend)..."
pip install torch torchvision torchaudio

echo "📦 Installing PyTorch Geometric (Graph Neural Networks)..."
pip install torch-geometric

echo "📦 Installing graph libraries..."
pip install networkx scipy numpy pandas

echo "📦 Installing MLX (Apple's native ML framework - optional)..."
pip install mlx || echo "⚠️ MLX installation failed (optional)"

echo ""
echo "🔍 Checking installation..."
python3 << 'EOF'
import torch
import sys

print(f"Python: {sys.version}")
print(f"PyTorch: {torch.__version__}")
print(f"MPS available: {torch.backends.mps.is_available()}")
print(f"MPS built: {torch.backends.mps.is_built()}")

if torch.backends.mps.is_available():
    device = torch.device("mps")
    x = torch.ones(5, device=device)
    print(f"✅ MPS working! Tensor on MPS: {x}")
else:
    print("⚠️ MPS not available, using CPU")

try:
    import torch_geometric
    print(f"PyTorch Geometric: {torch_geometric.__version__}")
    print("✅ PyTorch Geometric installed successfully")
except ImportError as e:
    print(f"❌ PyTorch Geometric not installed: {e}")

try:
    import mlx.core as mx
    print(f"MLX installed, default device: {mx.default_device()}")
    print("✅ MLX working!")
except ImportError:
    print("⚠️ MLX not installed (optional)")
EOF

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To activate the environment:"
echo "  cd apps/api && source .venv/bin/activate"
echo ""
echo "To use GPU acceleration on Mac:"
echo "  device = torch.device('mps')"
echo "  tensor = tensor.to(device)"
