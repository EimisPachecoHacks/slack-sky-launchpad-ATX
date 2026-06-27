#!/usr/bin/env bash
set -euo pipefail

# Validate all Terraform examples for syntax correctness.
# Requires: terraform CLI installed (>= 1.5.0)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLES_DIR="$(dirname "$SCRIPT_DIR")/examples/terraform"

PASS=0
FAIL=0
ERRORS=()

echo "Validating Terraform examples..."
echo "================================"

for dir in "$EXAMPLES_DIR"/*/; do
  name=$(basename "$dir")
  echo ""
  echo "--- $name ---"

  # Check formatting
  if terraform -chdir="$dir" fmt -check -recursive > /dev/null 2>&1; then
    echo "  fmt:      PASS"
  else
    echo "  fmt:      FAIL (run: terraform fmt -recursive)"
    ERRORS+=("$name: formatting")
    FAIL=$((FAIL + 1))
    continue
  fi

  # Initialize without backend
  if terraform -chdir="$dir" init -backend=false -input=false > /dev/null 2>&1; then
    echo "  init:     PASS"
  else
    echo "  init:     FAIL"
    ERRORS+=("$name: init")
    FAIL=$((FAIL + 1))
    continue
  fi

  # Validate syntax
  if terraform -chdir="$dir" validate > /dev/null 2>&1; then
    echo "  validate: PASS"
    PASS=$((PASS + 1))
  else
    echo "  validate: FAIL"
    ERRORS+=("$name: validate")
    FAIL=$((FAIL + 1))
  fi

  # Clean up
  rm -rf "$dir/.terraform" "$dir/.terraform.lock.hcl"
done

echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "Failures:"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  exit 1
fi

echo "All examples valid."
