"""Secure credential storage — encrypts at rest, never touches git."""

import json
import os
import shutil
import stat
import csv
from pathlib import Path
from cryptography.fernet import Fernet

from .config import CREDENTIALS_DIR, ENCRYPTION_KEY_FILE, SKYRCHITECT_HOME


def _ensure_dirs():
    for d in [SKYRCHITECT_HOME, CREDENTIALS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
        os.chmod(d, stat.S_IRWXU)  # 700


def _get_or_create_key() -> bytes:
    _ensure_dirs()
    if ENCRYPTION_KEY_FILE.exists():
        return ENCRYPTION_KEY_FILE.read_bytes()
    key = Fernet.generate_key()
    ENCRYPTION_KEY_FILE.write_bytes(key)
    os.chmod(ENCRYPTION_KEY_FILE, stat.S_IRUSR | stat.S_IWUSR)  # 600
    return key


def _fernet() -> Fernet:
    return Fernet(_get_or_create_key())


def store_credential(provider: str, credential_path: str) -> dict:
    """Store a credential file securely. Returns parsed credential info."""
    _ensure_dirs()
    src = Path(credential_path).expanduser().resolve()
    if not src.exists():
        raise FileNotFoundError(f"Credential file not found: {src}")

    raw = src.read_bytes()
    encrypted = _fernet().encrypt(raw)

    dest = CREDENTIALS_DIR / f"{provider}.enc"
    dest.write_bytes(encrypted)
    os.chmod(dest, stat.S_IRUSR | stat.S_IWUSR)  # 600

    return parse_credential(provider, raw.decode("utf-8"))


def load_credential(provider: str) -> str:
    """Load and decrypt a stored credential. Returns raw content."""
    path = CREDENTIALS_DIR / f"{provider}.enc"
    if not path.exists():
        raise FileNotFoundError(
            f"No stored credentials for {provider}. "
            "Run credential setup first."
        )
    return _fernet().decrypt(path.read_bytes()).decode("utf-8")


def credential_exists(provider: str) -> bool:
    return (CREDENTIALS_DIR / f"{provider}.enc").exists()


def parse_credential(provider: str, raw: str) -> dict:
    """Extract account info from raw credential content."""
    if provider == "gcp":
        data = json.loads(raw)
        return {
            "project_id": data.get("project_id", ""),
            "client_email": data.get("client_email", ""),
            "type": data.get("type", ""),
        }
    elif provider == "alicloud":
        data = _parse_alicloud_credential(raw)
        return {
            "access_key_id": data["access_key_id"],
            "region": data.get("region", "ap-southeast-1"),
        }
    elif provider == "aws":
        clean = raw.lstrip("\ufeff")
        if clean.strip().startswith("{"):
            data = json.loads(clean)
            return {
                "aws_access_key_id": data.get("aws_access_key_id", ""),
                "region": data.get("region", "us-east-1"),
            }
        lines = clean.strip().split("\n")
        if len(lines) >= 2:
            reader = csv.DictReader(lines)
            for row in reader:
                row_keys = {k.lstrip("\ufeff"): v for k, v in row.items()}
                if "Access key ID" in row_keys:
                    return {
                        "aws_access_key_id": row_keys.get("Access key ID", ""),
                        "region": "us-east-1",
                    }
                elif "User name" in row_keys:
                    return {
                        "console_user": row_keys.get("User name", ""),
                        "account_id": _extract_account_id(
                            row_keys.get("Console sign-in URL", "")
                        ),
                        "needs_access_keys": True,
                    }
        return {"raw_format": "unknown", "needs_access_keys": True}

    return {}


def get_alicloud_keys() -> tuple:
    """Get Alibaba Cloud RAM AccessKey id + secret from stored credentials.

    Accepts JSON or the two-column CSV downloaded from the Alibaba Cloud RAM
    console. The raw credential remains encrypted at rest either way.
    """
    data = _parse_alicloud_credential(load_credential("alicloud"))
    return data["access_key_id"], data["access_key_secret"]


def _parse_alicloud_credential(raw: str) -> dict:
    """Normalize Alibaba RAM AccessKeys from JSON or console-exported CSV."""
    clean = raw.lstrip("\ufeff").strip()
    if not clean:
        raise ValueError("Alibaba Cloud credential file is empty")

    if clean.startswith("{"):
        data = json.loads(clean)
        key_id = data.get("access_key_id") or data.get("AccessKeyId", "")
        secret = data.get("access_key_secret") or data.get("AccessKeySecret", "")
        region = data.get("region", "ap-southeast-1")
    else:
        row = next(csv.DictReader(clean.splitlines()), None) or {}
        normalized = {
            (key or "").lstrip("\ufeff").strip().lower().replace("_", " "): value.strip()
            for key, value in row.items()
            if key
        }
        key_id = normalized.get("accesskey id") or normalized.get("access key id", "")
        secret = normalized.get("accesskey secret") or normalized.get("access key secret", "")
        region = normalized.get("region", "ap-southeast-1")

    if not key_id or not secret:
        raise ValueError(
            "Could not extract Alibaba Cloud AccessKey. Upload the JSON template "
            "or the CSV downloaded from the RAM AccessKey page."
        )
    return {
        "access_key_id": key_id,
        "access_key_secret": secret,
        "region": region or "ap-southeast-1",
    }


def get_aws_keys() -> tuple:
    """Get AWS access key and secret from stored credentials."""
    raw = load_credential("aws").lstrip("\ufeff")
    if raw.strip().startswith("{"):
        data = json.loads(raw)
        return data["aws_access_key_id"], data["aws_secret_access_key"]

    lines = raw.strip().split("\n")
    if len(lines) >= 2:
        reader = csv.DictReader(lines)
        for row in reader:
            cleaned = {k.lstrip("\ufeff"): v for k, v in row.items()}
            key_id = cleaned.get("Access key ID", "")
            secret = cleaned.get("Secret access key", "")
            if key_id and secret:
                return key_id, secret

    raise ValueError("Could not extract AWS access keys from stored credentials")
    return {}


def _extract_account_id(url: str) -> str:
    """Pull AWS account ID from console sign-in URL."""
    for part in url.split("/"):
        if part.replace(".", "").isdigit() and len(part) >= 10:
            return part.split(".")[0]
    return ""


def write_gcp_credential_file(workspace: Path) -> Path:
    """Write decrypted GCP credential to a workspace temp file for terraform."""
    raw = load_credential("gcp")
    cred_path = workspace / ".gcp-credentials.json"
    cred_path.write_text(raw)
    os.chmod(cred_path, stat.S_IRUSR | stat.S_IWUSR)
    return cred_path


def write_aws_credential_file(workspace: Path) -> tuple:
    """Write AWS credentials for terraform. Returns (key_id, secret_key) or raises."""
    raw = load_credential("aws")
    data = json.loads(raw) if raw.strip().startswith("{") else None

    if data and "aws_access_key_id" in data:
        return data["aws_access_key_id"], data["aws_secret_access_key"]

    raise ValueError(
        "AWS credentials require Access Key ID and Secret Access Key. "
        "Console login credentials cannot be used for Terraform deployment. "
        "Please generate access keys from the AWS IAM console."
    )
