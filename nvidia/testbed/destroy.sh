#!/bin/bash
# Tear the testbed down (stops all billing for it).
set -euo pipefail
cd "$(dirname "$0")"
REPO_ROOT="$(cd ../.. && pwd)"

eval "$(SKY_REPO_ROOT="$REPO_ROOT" "$REPO_ROOT/project/venv/bin/python" - <<'EOF'
import os, sys
sys.path.insert(0, os.environ["SKY_REPO_ROOT"])
from deployer.credential_manager import get_alicloud_keys
ak, sk = get_alicloud_keys()
print(f"export ALICLOUD_ACCESS_KEY='{ak}'")
print(f"export ALICLOUD_SECRET_KEY='{sk}'")
EOF
)"

cd infra
terraform destroy -auto-approve -input=false -no-color | tail -3
