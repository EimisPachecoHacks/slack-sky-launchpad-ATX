"""Application configuration and environment validation"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings with validation"""

    # ---------------------------------------------------------------------
    # Inference — Qwen models on Qwen Cloud (Alibaba Cloud Model Studio), via the
    # OpenAI-compatible endpoint. Blank fields take llm_client's Qwen defaults
    # (qwen3.7-max / qwen3.7-plus). See backend/llm_client.py.
    # ---------------------------------------------------------------------
    LLM_PROVIDER: str = Field(default="qwen", description="Inference backend (qwen)")
    DASHSCOPE_API_KEY: str = Field(default="", description="Qwen Cloud / DashScope API key")
    LLM_BASE_URL: str = Field(default="", description="OpenAI-compatible base URL (blank = Qwen Cloud default)")
    LLM_API_KEY: str = Field(default="", description="Bearer token; falls back to DASHSCOPE_API_KEY")
    LLM_MODEL: str = Field(default="", description="Text-generation model id (blank = qwen3.7-max)")
    LLM_VISION_MODEL: str = Field(default="", description="VLM for diagram analysis (blank = qwen3.7-plus)")

    # Speech-to-text (Qwen-ASR) runs on the same Qwen Cloud endpoint; blank base
    # URL falls back to LLM_BASE_URL in llm_client.
    LLM_AUDIO_BASE_URL: str = Field(default="", description="Audio base URL (blank = LLM base URL)")
    LLM_TRANSCRIBE_MODEL: str = Field(default="qwen3-asr-flash", description="Speech-to-text model id")

    # Embeddings are NOT provider-switchable: vectors from different models are
    # not comparable, so one model owns the Atlas index. Blank base URL falls
    # back to LLM_BASE_URL (same Qwen Cloud endpoint).
    EMBED_BASE_URL: str = Field(default="", description="Embeddings base URL (blank = LLM base URL)")
    EMBED_API_KEY: str = Field(default="", description="Embeddings bearer token; falls back to DASHSCOPE_API_KEY")
    EMBED_MODEL: str = Field(default="text-embedding-v4", description="Canonical skill-retrieval embedder (1024-d)")
    EMBED_DIMENSIONS: int = Field(default=1024, description="Must match the Atlas index numDimensions")
    # text-embedding-v4 (Qwen3-Embedding, Matryoshka) honours a `dimensions`
    # request, so we pin it to the Atlas index width (1024).
    EMBED_SEND_DIMENSIONS: bool = Field(default=True, description="Send `dimensions` in embedding requests")

    # API Configuration
    API_ENVIRONMENT: str = Field(default="development", description="Environment (development/production)")
    API_HOST: str = Field(default="0.0.0.0", description="API host")
    API_PORT: int = Field(default=8000, description="API port")

    # CORS Configuration
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="Comma-separated list of allowed CORS origins"
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="Allow credentials in CORS")

    # Security Configuration
    API_KEY_HEADER: str = Field(default="X-API-Key", description="API key header name")
    API_KEYS: str = Field(default="", description="Comma-separated list of valid API keys (optional)")
    JWT_SECRET_KEY: str = Field(default="", description="JWT secret key for authentication (optional)")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT algorithm")

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = Field(default=True, description="Enable rate limiting")
    RATE_LIMIT_PER_MINUTE: int = Field(default=10, description="Requests per minute per IP")

    # File Upload Configuration
    MAX_UPLOAD_SIZE_MB: int = Field(default=10, description="Maximum file upload size in MB")
    ALLOWED_UPLOAD_EXTENSIONS: str = Field(
        default=".png,.jpg,.jpeg,.pdf",
        description="Comma-separated list of allowed file extensions"
    )

    # Storage Configuration (optional)
    STORAGE_BACKEND: str = Field(default="local", description="Storage backend (local/s3)")
    STORAGE_PATH: str = Field(default="./uploads", description="Local storage path")

    # GitLab Duo Agent Platform
    GITLAB_TOKEN: str = Field(default="", description="GitLab PAT with api scope")
    GITLAB_PROJECT_PATH: str = Field(default="", description="GitLab project path (namespace/project)")
    GITLAB_URL: str = Field(default="https://gitlab.com", description="GitLab instance URL")

    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    class Config:
        # Look for .env in project root (parent directory of backend/)
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        env_file_encoding = 'utf-8'
        case_sensitive = True
        extra = "ignore"  # tolerate extra .env keys (e.g. deployer/CLI-only vars)

    @validator("CORS_ORIGINS")
    def validate_cors_origins(cls, v: str) -> str:
        """Validate CORS origins don't contain wildcards in production"""
        if "*" in v and os.getenv("API_ENVIRONMENT") == "production":
            raise ValueError(
                "Wildcard CORS origins are not allowed in production. "
                "Please specify exact domains."
            )
        return v

    @validator("LLM_PROVIDER")
    def validate_llm_provider(cls, v: str) -> str:
        if v.strip().lower() != "qwen":
            raise ValueError(f"Invalid LLM_PROVIDER: {v}. Only 'qwen' is supported.")
        return v.strip().lower()

    @validator("RATE_LIMIT_PER_MINUTE")
    def validate_rate_limit(cls, v: int) -> int:
        """Validate rate limit is reasonable"""
        if v < 1 or v > 1000:
            raise ValueError("Rate limit must be between 1 and 1000 requests per minute")
        return v

    @validator("MAX_UPLOAD_SIZE_MB")
    def validate_upload_size(cls, v: int) -> int:
        """Validate upload size is reasonable"""
        if v < 1 or v > 100:
            raise ValueError("Max upload size must be between 1 and 100 MB")
        return v

    def get_cors_origins(self) -> List[str]:
        """Get list of CORS origins"""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    def get_api_keys(self) -> List[str]:
        """Get list of valid API keys"""
        if not self.API_KEYS:
            return []
        return [key.strip() for key in self.API_KEYS.split(",")]

    def get_allowed_extensions(self) -> List[str]:
        """Get list of allowed file extensions"""
        if not self.ALLOWED_UPLOAD_EXTENSIONS:
            return []
        return [ext.strip().lower() for ext in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")]

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.API_ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.API_ENVIRONMENT.lower() == "development"


# Global settings instance
try:
    settings = Settings()
except Exception as e:
    print(f"❌ Configuration Error: {e}")
    print("\n🔧 Please check your .env file and ensure all required variables are set.")
    print("\nKey environment variables (Qwen Cloud / Alibaba Model Studio):")
    print("  - DASHSCOPE_API_KEY  (required — your Qwen Cloud API key)")
    print("  - LLM_BASE_URL   (blank = https://dashscope-intl.aliyuncs.com/compatible-mode/v1)")
    print("  - LLM_MODEL / LLM_VISION_MODEL (blank = qwen3.7-max / qwen3.7-plus)")
    print("  - EMBED_MODEL (default: text-embedding-v4), EMBED_DIMENSIONS (default: 1024)")
    print("  - API_ENVIRONMENT (default: development)")
    print("  - CORS_ORIGINS (default: http://localhost:5173,http://localhost:3000)")
    print("  - RATE_LIMIT_PER_MINUTE (default: 10)")
    print("  - See backend/config.py for all options")
    raise


def validate_configuration():
    """Validate configuration at startup"""
    issues = []

    # Check for production with wildcard CORS
    if settings.is_production and "*" in settings.CORS_ORIGINS:
        issues.append("❌ Wildcard CORS is not allowed in production")

    # Check for missing JWT secret in production
    if settings.is_production and not settings.JWT_SECRET_KEY:
        issues.append("⚠️  JWT_SECRET_KEY should be set in production for authentication")

    # Check for API keys in production
    if settings.is_production and not settings.API_KEYS and not settings.JWT_SECRET_KEY:
        issues.append("⚠️  No authentication configured (API_KEYS or JWT_SECRET_KEY)")

    if issues:
        print("\n🔍 Configuration Issues Found:")
        for issue in issues:
            print(f"  {issue}")

        if any("❌" in issue for issue in issues):
            raise ValueError("Critical configuration issues found. Please fix before starting.")

    # Print configuration summary
    from backend.llm_client import _resolve  # provider defaults applied

    print("\n✅ Configuration validated successfully")
    print(f"   Environment: {settings.API_ENVIRONMENT}")
    print(f"   Inference Provider: {settings.LLM_PROVIDER}")
    print(f"   Endpoint: {_resolve('LLM_BASE_URL')}")
    print(f"   API key set: {'yes' if (settings.DASHSCOPE_API_KEY or settings.LLM_API_KEY) else 'NO — set DASHSCOPE_API_KEY'}")
    print(f"   Text Model: {_resolve('LLM_MODEL')}")
    print(f"   Vision Model: {_resolve('LLM_VISION_MODEL')}")
    print(f"   Embeddings: {settings.EMBED_MODEL} ({settings.EMBED_DIMENSIONS}-d)")
    print(f"   CORS Origins: {len(settings.get_cors_origins())} origin(s)")
    print(f"   Rate Limiting: {'Enabled' if settings.RATE_LIMIT_ENABLED else 'Disabled'}")
    if settings.RATE_LIMIT_ENABLED:
        print(f"   Rate Limit: {settings.RATE_LIMIT_PER_MINUTE} req/min")
