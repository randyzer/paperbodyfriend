#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FAKE_BIN="$TMP_DIR/bin"
mkdir -p "$FAKE_BIN"

export TEST_TMP_DIR="$TMP_DIR"

cat <<'EOF' > "$FAKE_BIN/lsof"
#!/bin/bash
set -Eeuo pipefail

state_file="${TEST_TMP_DIR}/lsof-call-count"
call_count=0
if [[ -f "$state_file" ]]; then
  call_count="$(cat "$state_file")"
fi
call_count=$((call_count + 1))
printf '%s' "$call_count" > "$state_file"

if [[ "$*" == *"-iTCP:3000"* ]] && [[ "$call_count" -eq 1 ]]; then
  printf '43210\n'
fi
EOF

cat <<'EOF' > "$FAKE_BIN/kill"
#!/bin/bash
set -Eeuo pipefail

printf '%s' "$*" > "${TEST_TMP_DIR}/kill-args"
EOF

cat <<'EOF' > "$FAKE_BIN/pnpm"
#!/bin/bash
set -Eeuo pipefail

printf '%s' "${PORT:-}" > "${TEST_TMP_DIR}/pnpm-port"
printf '%s' "$*" > "${TEST_TMP_DIR}/pnpm-args"
EOF

cat <<'EOF' > "$FAKE_BIN/sleep"
#!/bin/bash
set -Eeuo pipefail
EOF

chmod +x "$FAKE_BIN/lsof" "$FAKE_BIN/kill" "$FAKE_BIN/pnpm" "$FAKE_BIN/sleep"

if ! output="$(
  PATH="$FAKE_BIN:/usr/bin:/bin" \
  WORKSPACE_PATH="$ROOT_DIR" \
  bash "$ROOT_DIR/scripts/dev.sh" 2>&1
)"; then
  printf 'scripts/dev.sh exited unexpectedly:\n%s\n' "$output"
  exit 1
fi

assert_contains() {
  local expected="$1"
  if [[ "$output" != *"$expected"* ]]; then
    printf 'Expected output to include: %s\n' "$expected"
    printf 'Actual output:\n%s\n' "$output"
    exit 1
  fi
}

assert_contains 'Clearing port 3000 before start.'
assert_contains 'Port 3000 in use by PIDs: 43210 (SIGKILL)'
assert_contains 'Port 3000 cleared.'
assert_contains 'Starting HTTP service on port 3000 for dev...'

if [[ ! -f "$TMP_DIR/kill-args" ]]; then
  printf 'Expected kill to be invoked for the existing listener.\n'
  exit 1
fi

if [[ "$(cat "$TMP_DIR/kill-args")" != '-9 43210' ]]; then
  printf 'Unexpected kill invocation: %s\n' "$(cat "$TMP_DIR/kill-args")"
  exit 1
fi

if [[ "$(cat "$TMP_DIR/pnpm-port")" != '3000' ]]; then
  printf 'Expected pnpm to inherit PORT=3000, got: %s\n' "$(cat "$TMP_DIR/pnpm-port")"
  exit 1
fi

if [[ "$(cat "$TMP_DIR/pnpm-args")" != 'tsx watch src/server.ts' ]]; then
  printf 'Unexpected pnpm invocation: %s\n' "$(cat "$TMP_DIR/pnpm-args")"
  exit 1
fi

printf 'scripts/dev.sh regression test passed.\n'
