"""Configuration constants for the deployer module."""

import os
from pathlib import Path

SKYRCHITECT_HOME = Path.home() / ".skyrchitect"
CREDENTIALS_DIR = SKYRCHITECT_HOME / "credentials"
WORKDIR = SKYRCHITECT_HOME / "workspaces"
ENCRYPTION_KEY_FILE = SKYRCHITECT_HOME / ".key"

SUPPORTED_PROVIDERS = {
    "gcp": {
        "name": "Google Cloud Platform",
        "credential_type": "Service Account JSON",
        "credential_ext": ".json",
        "env_var": "GOOGLE_APPLICATION_CREDENTIALS",
    },
    "aws": {
        "name": "Amazon Web Services",
        "credential_type": "Access Key CSV or configured AWS CLI",
        "credential_ext": ".csv",
        "env_var": "AWS_SHARED_CREDENTIALS_FILE",
    },
}

MAX_DEPLOY_RETRIES = 3
TERRAFORM_MIN_VERSION = "1.5.0"

GITLAB_API_BASE = "https://gitlab.com/api/v4"
