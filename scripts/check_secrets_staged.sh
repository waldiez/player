#!/usr/bin/env bash
set -euo pipefail

# Blocks commits that introduce likely secrets in staged changes.
# Scans added lines only and ignores safe examples/templates.

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

DIFF="$(git diff --cached --unified=0 --no-color || true)"
if [[ -z "${DIFF}" ]]; then
  exit 0
fi

FILTERED="$(printf "%s\n" "${DIFF}" | awk '
  BEGIN { file="" }
  /^diff --git / { file="" }
  /^\+\+\+ b\// {
    file=$0
    sub(/^\+\+\+ b\//, "", file)
  }
  /^\+/ {
    if ($0 ~ /^\+\+\+/) next
    if (file == ".env.example") next
    if (file ~ /^docs\//) next
    print file "\t" $0
  }
')"

if [[ -z "${FILTERED}" ]]; then
  exit 0
fi

# Heuristics for common credential leaks.
PATTERN='(OPENAI_API_KEY=|ANTHROPIC_API_KEY=|YOUTUBE_API_KEY=|TAVILY_API_KEY=|APPLE_PASSWORD=|APPLE_CERTIFICATE=|APPLE_MAS_CERTIFICATE=|-----BEGIN (RSA |EC |)PRIVATE KEY-----|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_\-]{16,}|AKIA[0-9A-Z]{16})'

MATCHES="$(printf "%s\n" "${FILTERED}" | grep -E "${PATTERN}" || true)"

if [[ -n "${MATCHES}" ]]; then
  echo "[secret-check] blocked: possible secret(s) found in staged changes."
  echo
  printf "%s\n" "${MATCHES}" | sed 's/^/  /'
  echo
  echo "If this is intentional test data, move it to .env.example or docs with redacted placeholders."
  exit 1
fi

exit 0
