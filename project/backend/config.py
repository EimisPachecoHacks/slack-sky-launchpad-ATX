"""Application configuration and environment validation"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings with validation"""

    # ---------------------------------------------------------------------
    # Inference — every backend speaks the OpenAI wire format (see llm_client.py)
    # ---------------------------------------------------------------------
    # LLM_PROVIDER picks the defaults: "amd" (Gemma 4 on a ROCm MI300X, served by
    # Ollama or vLLM) or "fireworks" (managed, also AMD-hosted, needs a paid key).
    # Any explicit LLM_* below wins.
    LLM_PROVIDER: str = Field(default="amd", description="Inference backend: amd | fireworks")
    LLM_BASE_URL: str = Field(default="", description="OpenAI-compatible base URL (blank = provider default)")
    LLM_API_KEY: str = Field(default="", description="Bearer token; falls back to FIREWORKS_API_KEY")
    LLM_MODEL: str = Field(default="", description="Text-generation model id (blank = provider default)")
    LLM_VISION_MODEL: str = Field(default="", description="VLM for diagram analysis (blank = provider default)")

    FIREWORKS_API_KEY: str = Field(default="", description="Fireworks AI API key (only for LLM_PROVIDER=fireworks)")

    # Speech-to-text runs on our own GPU shim (services/whisper_server.py), which
    # lives on a different port than the LLM — hence a separate base URL.
    LLM_AUDIO_BASE_URL: str = Field(
        default="http://localhost:8100/v1",
        description="OpenAI-compatible audio base URL (Whisper)",
    )
    LLM_TRANSCRIBE_MODEL: str = Field(default="openai/whisper-large-v3", description="Speech-to-text model id")

    # Embeddings are NOT provider-switchable: vectors from different models are
    # not comparable, so one model owns the Atlas index. Served on the AMD GPU.
    EMBED_BASE_URL: str = Field(default="http://localhost:11434/v1", description="OpenAI-compatible embeddings URL")
    EMBED_API_KEY: str = Field(default="", description="Embeddings bearer token; falls back to LLM_API_KEY")
    EMBED_MODEL: str = Field(default="mxbai-embed-large", description="Canonical skill-retrieval embedder (1024-d)")
    EMBED_DIMENSIONS: int = Field(default=1024, description="Must match the Atlas index numDimensions")
    # `dimensions` is only honoured by Matryoshka models behind a serving layer that
    # forwards it. bge-large rejects it; Ollama ignores it. Off by default: our models
    # emit their native 1024-d width, which is what the Atlas index expects.
    EMBED_SEND_DIMENSIONS: bool = Field(default=False, description="Send `dimensions` in embedding requests")

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
        allowed = ("amd", "fireworks")
        if v.strip().lower() not in allowed:
            raise ValueError(f"Invalid LLM_PROVIDER: {v}. Allowed: {', '.join(allowed)}")
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
    print("\nKey environment variables:")
    print("  - LLM_PROVIDER        (amd | fireworks)")
    print("  - FIREWORKS_API_KEY   (or LLM_API_KEY) — required when LLM_PROVIDER=fireworks")
    print("\nOptional environment variables:")
    print("  - LLM_MODEL, LLM_VISION_MODEL, LLM_BASE_URL (blank = provider default)")
    print("  - EMBED_BASE_URL (default: http://vllm-embed:8001/v1)")
    print("  - EMBED_MODEL (default: BAAI/bge-large-en-v1.5), EMBED_DIMENSIONS (default: 1024)")
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

    # Fireworks is a hosted API and cannot work without a key; AMD/vLLM needs none.
    if settings.LLM_PROVIDER == "fireworks" and not (settings.LLM_API_KEY or settings.FIREWORKS_API_KEY):
        issues.append("⚠️  LLM_PROVIDER=fireworks but neither FIREWORKS_API_KEY nor LLM_API_KEY is set")

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
    print(f"   Text Model: {_resolve('LLM_MODEL')}")
    print(f"   Vision Model: {_resolve('LLM_VISION_MODEL')}")
    print(f"   Embeddings: {settings.EMBED_MODEL} ({settings.EMBED_DIMENSIONS}-d) @ {settings.EMBED_BASE_URL}")
    print(f"   CORS Origins: {len(settings.get_cors_origins())} origin(s)")
    print(f"   Rate Limiting: {'Enabled' if settings.RATE_LIMIT_ENABLED else 'Disabled'}")
    if settings.RATE_LIMIT_ENABLED:
        print(f"   Rate Limit: {settings.RATE_LIMIT_PER_MINUTE} req/min")
