#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/alibaba/backend"
DEPLOY_DIR="${TF_DIR}/.deploy"
SSH_KEY="${DEPLOY_DIR}/id_ed25519"
RUNTIME_ENV="${DEPLOY_DIR}/runtime.env"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${REPO_ROOT}/project/.env}"

# The deployer stores the RAM AccessKey encrypted outside the repository. Load
# it only when the caller has not supplied explicit environment variables, and
# keep the values in-process: they are never echoed or copied to the instance.
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
: "${CONFIRM_ALIBABA_DEPLOY:?Set CONFIRM_ALIBABA_DEPLOY=yes after reviewing the Terraform plan}"

if [[ "${CONFIRM_ALIBABA_DEPLOY}" != "yes" ]]; then
  echo "Deployment cancelled: CONFIRM_ALIBABA_DEPLOY must equal yes." >&2
  exit 2
fi
if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "Missing runtime environment file: ${DEPLOY_ENV_FILE}" >&2
  exit 2
fi

mkdir -p "${DEPLOY_DIR}"
chmod 700 "${DEPLOY_DIR}"
if [[ ! -f "${SSH_KEY}" ]]; then
  ssh-keygen -q -t ed25519 -N "" -f "${SSH_KEY}"
fi

ADMIN_IP="${ADMIN_IP:-$(curl -fsS https://api.ipify.org)}"
export TF_VAR_admin_cidr="${ADMIN_IP}/32"
export TF_VAR_ssh_public_key="$(tr -d '\n' < "${SSH_KEY}.pub")"

terraform -chdir="${TF_DIR}" init -input=false
terraform -chdir="${TF_DIR}" validate
terraform -chdir="${TF_DIR}" plan -input=false -out="${DEPLOY_DIR}/backend.tfplan"
terraform -chdir="${TF_DIR}" apply -input=false -auto-approve "${DEPLOY_DIR}/backend.tfplan"

PUBLIC_IP="$(terraform -chdir="${TF_DIR}" output -raw public_ip)"
SSH_ARGS=(-i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

echo "Waiting for ECS cloud-init and SSH at ${PUBLIC_IP}..."
for _attempt in $(seq 1 60); do
  if ssh "${SSH_ARGS[@]}" "root@${PUBLIC_IP}" 'test -f /var/lib/sky-launchpad/provisioning-status' 2>/dev/null; then
    break
  fi
  sleep 5
done
ssh "${SSH_ARGS[@]}" "root@${PUBLIC_IP}" 'test -f /var/lib/sky-launchpad/provisioning-status'

# Transfer source without Git metadata, local dependencies, Terraform state, or
# raw credentials. Runtime secrets are uploaded separately with mode 600.
# Transfer excludes are a SECURITY control, not just a size optimisation: this
# host is internet-facing, so no secret may ever land on it. The runtime .env is
# the single exception and is uploaded separately below with mode 600.
# Patterns are matched by basename too (--exclude matches any path component),
# so a new secret file in any directory is caught by the wildcard rules.
tar -C "${REPO_ROOT}" \
  --exclude='./.git' \
  --exclude='./project/node_modules' \
  --exclude='./node_modules' \
  --exclude='./project/venv' \
  --exclude='./.venv' \
  --exclude='./infra/alibaba/backend/.terraform' \
  --exclude='./infra/alibaba/backend/.deploy' \
  --exclude='./*.tfstate*' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  --exclude='./project/.env' \
  --exclude='./project/.env.local' \
  --exclude='./slack/.env' \
  --exclude='./AccessKey-*.csv' \
  --exclude='*accessKeys*.csv' \
  --exclude='*credentials*.csv' \
  --exclude='*bot*.json' \
  --exclude='*-service-account.json' \
  --exclude='*.pem' \
  --exclude='*.p12' \
  --exclude='.slack-profile' \
  --exclude='./tester/runs' \
  --exclude='__pycache__' \
  -czf - . | ssh "${SSH_ARGS[@]}" "root@${PUBLIC_IP}" 'tar -xzf - -C /opt/sky-launchpad'

# Fail closed: if a secret ever reaches the public host, stop before starting it.
if ssh "${SSH_ARGS[@]}" "root@${PUBLIC_IP}" \
     'ls /opt/sky-launchpad/*.csv /opt/sky-launchpad/*bot*.json /opt/sky-launchpad/**/.slack-profile' \
     >/dev/null 2>&1; then
  echo "ABORT: secret material found on the public host after transfer." >&2
  exit 3
fi

awk '!/^(API_ENVIRONMENT|API_KEYS|CORS_ORIGINS|SKYRCHITECT_HOME)=/' "${DEPLOY_ENV_FILE}" > "${RUNTIME_ENV}"
printf '\nAPI_ENVIRONMENT=production\nCORS_ORIGINS=http://%s:8080\nSKYRCHITECT_HOME=/var/lib/sky-launchpad\n' "${PUBLIC_IP}" >> "${RUNTIME_ENV}"
chmod 600 "${RUNTIME_ENV}"
scp "${SSH_ARGS[@]}" "${RUNTIME_ENV}" "root@${PUBLIC_IP}:/opt/sky-launchpad/project/.env"

# The RAM AccessKey is used only from the trusted operator machine to provision
# this instance. It is intentionally not copied onto the public proof server.

ssh "${SSH_ARGS[@]}" "root@${PUBLIC_IP}" '
  set -euo pipefail
  cd /opt/sky-launchpad
  docker build -f Dockerfile -t sky-launchpad:latest .
  docker rm -f sky-launchpad >/dev/null 2>&1 || true
  docker run -d --name sky-launchpad --restart unless-stopped \
    -p 8080:8080 \
    --env-file /opt/sky-launchpad/project/.env \
    -v /var/lib/sky-launchpad:/var/lib/sky-launchpad \
    sky-launchpad:latest
'

HEALTH_URL="http://${PUBLIC_IP}:8080/health"
for _attempt in $(seq 1 60); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    echo "Alibaba Cloud deployment is healthy: ${HEALTH_URL}"
    echo "Application: http://${PUBLIC_IP}:8080"
    exit 0
  fi
  sleep 5
done

echo "Container started but health verification timed out: ${HEALTH_URL}" >&2
exit 1
