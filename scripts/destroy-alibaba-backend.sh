#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/alibaba/backend"
SSH_KEY="${TF_DIR}/.deploy/id_ed25519"

# Reuse the locally encrypted RAM AccessKey when the caller has not supplied
# explicit credentials. Values remain in-process and are never printed.
if [[ -z "${ALICLOUD_ACCESS_KEY:-}" || -z "${ALICLOUD_SECRET_KEY:-}" ]]; then
  IFS= read -r -d '' ALICLOUD_CREDENTIALS < <(
    PYTHONPATH="${REPO_ROOT}" python3 -c \
      'from deployer.credential_manager import get_alicloud_keys; print(*get_alicloud_keys(), sep="\n")'
    printf '\0'
  )
  ALICLOUD_ACCESS_KEY="${ALICLOUD_CREDENTIALS%%$'\n'*}"
  ALICLOUD_SECRET_KEY="${ALICLOUD_CREDENTIALS#*$'\n'}"
  ALICLOUD_SECRET_KEY="${ALICLOUD_SECRET_KEY%$'\n'}"
  unset ALICLOUD_CREDENTIALS
  export ALICLOUD_ACCESS_KEY ALICLOUD_SECRET_KEY
fi

: "${ALICLOUD_ACCESS_KEY:?Set ALICLOUD_ACCESS_KEY}"
: "${ALICLOUD_SECRET_KEY:?Set ALICLOUD_SECRET_KEY}"
: "${CONFIRM_ALIBABA_DESTROY:?Set CONFIRM_ALIBABA_DESTROY=yes to release the proof resources}"

if [[ "${CONFIRM_ALIBABA_DESTROY}" != "yes" ]]; then
  echo "Destroy cancelled: CONFIRM_ALIBABA_DESTROY must equal yes." >&2
  exit 2
fi
if [[ ! -f "${SSH_KEY}.pub" ]]; then
  echo "Missing deployment key metadata at ${SSH_KEY}.pub" >&2
  exit 2
fi

ADMIN_IP="${ADMIN_IP:-$(curl -fsS https://api.ipify.org)}"
export TF_VAR_admin_cidr="${ADMIN_IP}/32"
export TF_VAR_ssh_public_key="$(tr -d '\n' < "${SSH_KEY}.pub")"
terraform -chdir="${TF_DIR}" destroy -input=false -auto-approve
