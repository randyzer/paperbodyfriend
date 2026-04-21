#!/bin/bash
set -Eeuo pipefail

WORKSPACE_PATH="${WORKSPACE_PATH:-$(pwd)}"

cd "${WORKSPACE_PATH}"

echo "Building the Next.js project..."
NODE_ENV=production pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
