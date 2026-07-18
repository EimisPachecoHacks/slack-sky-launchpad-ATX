#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl docker.io tar
systemctl enable --now docker
install -d -m 700 /opt/sky-launchpad
install -d -m 700 /var/lib/sky-launchpad
printf 'cloud-init-ready\n' >/var/lib/sky-launchpad/provisioning-status
