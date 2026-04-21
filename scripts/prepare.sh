#!/bin/bash
set -Eeuo pipefail

WORKSPACE_PATH="${WORKSPACE_PATH:-$(pwd)}"

cd "${WORKSPACE_PATH}"

echo "Dependencies should be installed by the platform or by an explicit local install step."
