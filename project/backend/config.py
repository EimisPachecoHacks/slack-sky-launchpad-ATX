"""Application configuration and environment validation"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings with validation"""

    # Anthropic API Configuration (legacy/optional — replaced by MiniMax + Gemini)
    ANTHROPIC_API_KEY: str = Field(default="", description="Anthropic API key (legacy/optional)")
    ANTHROPIC_MODEL: str = Field(
        default="claude-opus-4-6",
        description="Anthropic model ID (legacy)"
    )

    # MiniMax API Configuration — powers cloud-architecture JSON generation (replaces Anthropic)
    MINIMAX_API_KEY: str = Field(default="", description="MiniMax API key")
    MINIMAX_MODEL: str = Field(default="MiniMax-M2", description="MiniMax model id (best general model)")
    MINIMAX_BASE_URL: str = Field(
        default="https://api.minimax.io/v1",
        description="MiniMax OpenAI-compatible base URL",
    )

    # Google Gemini API Configuration — image analysis + real-time voice (replaces Claude Vision + ElevenLabs)
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key")
    GEMINI_VISION_MODEL: str = Field(
        default="gemini-3.1-pro-preview", description="Gemini model for image analysis"
    )
    GEMINI_LIVE_MODEL: str = Field(
        default="gemini-3.1-flash-live-preview",
        description="Gemini Live model for real-time streaming narration (WebSocket bidi)",
    )
    GEMINI_TRANSCRIBE_MODEL: str = Field(
        default="gemini-3.1-flash-lite",
        description="Gemini model for record-then-POST voice transcription (generateContent + audio)",
    )
    ANTIGRAVITY_MODEL: str = Field(
        default="antigravity-preview-05-2026",
        description="Gemini Interactions API managed-agent model (self-improvement loop)",
    )

    # ElevenLabs API Configuration (deprecated — voice now powered by Gemini Live)
    ELEVENLABS_API_KEY: str = Field(default="", description="Deprecated; voice uses Gemini Live")

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

    @validator("ANTHROPIC_MODEL")
    def validate_model_id(cls, v: str) -> str:
        """Validate Anthropic model ID"""
        allowed_models = [
            "claude-opus-4-6",  # Claude Opus 4.6 (Feb 2026) — default frontier model
            "claude-opus-4-1-20250805",    # Claude Opus 4.1 (Aug 2025)
            "claude-sonnet-4-6",  # Claude Sonnet 4.6 (Feb 2026)
            "claude-sonnet-4-5-20250929",  # Claude Sonnet 4.5
            "claude-3-7-sonnet-20250219",  # Claude 3.7 Sonnet (Feb 2025)
            "claude-haiku-4-5-20251001",   # Claude Haiku 4.5 (Oct 2025)
            "claude-3-5-sonnet-20241022",  # Legacy
        ]
        if v not in allowed_models:
            raise ValueError(
                f"Invalid Anthropic model ID: {v}. "
                f"Allowed models: {', '.join(allowed_models)}"
            )
        return v

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
    print("\nKey environment variables (set the providers you use):")
    print("  - MINIMAX_API_KEY     (cloud architecture JSON generation)")
    print("  - GEMINI_API_KEY      (image analysis + real-time voice)")
    print("\nOptional environment variables:")
    print("  - MINIMAX_MODEL (default: MiniMax-M2)")
    print("  - GEMINI_VISION_MODEL (default: gemini-3.1-pro-preview)")
    print("  - GEMINI_LIVE_MODEL (default: gemini-3.1-flash-live-preview)")
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

    # Check for Anthropic API key format (basic check)
    if settings.ANTHROPIC_API_KEY and not settings.ANTHROPIC_API_KEY.startswith("sk-ant-"):
        issues.append(
            "⚠️  ANTHROPIC_API_KEY should start with 'sk-ant-'. Please verify your API key."
        )

    if issues:
        print("\n🔍 Configuration Issues Found:")
        for issue in issues:
            print(f"  {issue}")

        if any("❌" in issue for issue in issues):
            raise ValueError("Critical configuration issues found. Please fix before starting.")

    # Print configuration summary
    print("\n✅ Configuration validated successfully")
    print(f"   Environment: {settings.API_ENVIRONMENT}")
    print(f"   MiniMax Model: {settings.MINIMAX_MODEL}")
    print(f"   Gemini Vision Model: {settings.GEMINI_VISION_MODEL}")
    print(f"   Gemini Live Model: {settings.GEMINI_LIVE_MODEL}")
    print(f"   CORS Origins: {len(settings.get_cors_origins())} origin(s)")
    # Warn if no provider keys are configured (servers still start; calls fail until set)
    if not settings.MINIMAX_API_KEY:
        print("   ⚠️  MINIMAX_API_KEY not set — architecture generation will fail until configured")
    if not settings.GEMINI_API_KEY:
        print("   ⚠️  GEMINI_API_KEY not set — image analysis & voice will fail until configured")
    print(f"   Rate Limiting: {'Enabled' if settings.RATE_LIMIT_ENABLED else 'Disabled'}")
    if settings.RATE_LIMIT_ENABLED:
        print(f"   Rate Limit: {settings.RATE_LIMIT_PER_MINUTE} req/min")
