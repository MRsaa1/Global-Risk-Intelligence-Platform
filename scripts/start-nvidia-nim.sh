#!/bin/bash
# Start NVIDIA NIM containers for Earth-2 models
# Requires: Docker with NVIDIA runtime, GPU with CUDA support

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting NVIDIA NIM for Earth-2...${NC}"

# Load environment
if [ -f .env.nvidia ]; then
    export $(cat .env.nvidia | grep -v '^#' | xargs)
fi

# Check NGC API Key
if [ -z "$NGC_API_KEY" ]; then
    echo -e "${RED}Error: NGC_API_KEY not set${NC}"
    echo "Set it in .env.nvidia or export NGC_API_KEY=your_key"
    exit 1
fi

# Login to NGC container registry
echo -e "${YELLOW}Logging into NGC container registry...${NC}"
echo $NGC_API_KEY | docker login nvcr.io --username '$oauthtoken' --password-stdin

# Check GPU
echo -e "${YELLOW}Checking GPU availability...${NC}"
if ! nvidia-smi &> /dev/null; then
    echo -e "${RED}Error: NVIDIA GPU not found${NC}"
    echo "Make sure NVIDIA drivers and nvidia-docker are installed"
    exit 1
fi

nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

# Pull images (first time only)
echo -e "${YELLOW}Pulling NIM images (this may take a while)...${NC}"
docker pull nvcr.io/nim/nvidia/fourcastnet:latest || true
docker pull nvcr.io/nim/nvidia/corrdiff:latest || true

# Start containers
echo -e "${YELLOW}Starting NIM containers...${NC}"
docker compose -f docker-compose.nvidia.yml up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check health
echo -e "${YELLOW}Checking service health...${NC}"

# FourCastNet
if curl -s http://localhost:8001/v1/health/ready | grep -q "ready"; then
    echo -e "${GREEN}✓ FourCastNet NIM is ready on port 8001${NC}"
else
    echo -e "${RED}✗ FourCastNet NIM not ready yet${NC}"
fi

# CorrDiff
if curl -s http://localhost:8000/v1/health/ready | grep -q "ready"; then
    echo -e "${GREEN}✓ CorrDiff NIM is ready on port 8000${NC}"
else
    echo -e "${RED}✗ CorrDiff NIM not ready yet${NC}"
fi

echo ""
echo -e "${GREEN}NVIDIA NIM services started!${NC}"
echo ""
echo "Endpoints:"
echo "  FourCastNet: http://localhost:8001"
echo "  CorrDiff:    http://localhost:8000"
echo ""
echo "To stop: docker compose -f docker-compose.nvidia.yml down"
