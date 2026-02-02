#!/usr/bin/env bash
# Download an IFC sample and convert to XKT for xeokit (BIM XKT tab).
# Run from repo root: ./scripts/convert-ifc-to-xkt.sh [project-id]
# Example: ./scripts/convert-ifc-to-xkt.sh MyBuilding

set -e
PROJECT_ID="${1:-MyBuilding}"
DATA_DIR="apps/web/public/xeokit-data/projects"
IFC_URL="https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/BasicHouse/IFC/BasicHouse.ifc"
IFC_FILE="${DATA_DIR}/_temp.ifc"
OUT_DIR="${DATA_DIR}/${PROJECT_ID}/models/design"
OUT_XKT="${OUT_DIR}/geometry.xkt"

echo "Project ID: ${PROJECT_ID}"
echo "Output: ${OUT_XKT}"

mkdir -p "${OUT_DIR}"

if [ ! -f "${IFC_FILE}" ]; then
  echo "Downloading IFC sample..."
  curl -L -o "${IFC_FILE}" "${IFC_URL}"
fi

echo "Converting IFC → XKT..."
npx @xeokit/xeokit-convert -s "$(pwd)/${IFC_FILE}" -o "$(pwd)/${OUT_XKT}"

# Create project index.json if missing
INDEX_JSON="${DATA_DIR}/${PROJECT_ID}/index.json"
if [ ! -f "${INDEX_JSON}" ]; then
  echo "Creating ${INDEX_JSON}"
  cat > "${INDEX_JSON}" << EOF
{
  "id": "${PROJECT_ID}",
  "name": "${PROJECT_ID}",
  "models": [{ "id": "design", "name": "Design" }],
  "viewerContent": { "modelsLoaded": ["design"] }
}
EOF
fi

# Add to projects index if not present
PROJECTS_INDEX="${DATA_DIR}/index.json"
if [ -f "${PROJECTS_INDEX}" ]; then
  if ! grep -q "\"id\": \"${PROJECT_ID}\"" "${PROJECTS_INDEX}" 2>/dev/null; then
    echo "Add \"${PROJECT_ID}\" to ${PROJECTS_INDEX} manually if needed (see Duplex entry)."
  fi
fi

echo "Done. XKT: ${OUT_XKT}"
echo "In the app: set asset xkt_project_id to \"${PROJECT_ID}\" and open BIM (XKT) tab."
