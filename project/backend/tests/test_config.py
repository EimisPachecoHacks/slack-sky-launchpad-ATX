"""Tests for configuration module"""

import pytest
import os
from unittest.mock import patch
from pydantic import ValidationError


class TestConfigSettings:
    """Test configuration settings and validation"""

    def test_config_loads_from_environment(self):
        """Test that config loads from environment variables"""
        from backend.config import settings

        # Settings should be loaded from .env file
        assert settings.LLM_PROVIDER in ("amd", "fireworks")
        assert settings.API_ENVIRONMENT == "development"

    def test_config_defaults(self):
        """Test configuration default values"""
        from backend.config import settings

        # Default values that should exist
        assert settings.API_ENVIRONMENT in ["development", "staging", "production"]
        assert isinstance(settings.CORS_ORIGINS, str)
        assert isinstance(settings.JWT_SECRET_KEY, str)
        assert settings.API_HOST == "0.0.0.0"
        assert settings.API_PORT == 8000

    def test_config_validates_llm_provider(self):
        """Test that LLM_PROVIDER validation works"""
        from backend.config import Settings

        # Valid provider should work, and be normalized to lowercase
        with patch.dict("os.environ", {"LLM_PROVIDER": "AMD"}, clear=False):
            settings = Settings()
            assert settings.LLM_PROVIDER == "amd"

        # Unknown provider is rejected
        with patch.dict("os.environ", {"LLM_PROVIDER": "openai"}, clear=False):
            with pytest.raises(ValidationError):
                Settings()

    def test_config_cors_origins(self):
        """Test CORS origins configuration"""
        from backend.config import settings

        # Should be a string that can be split into list
        assert isinstance(settings.CORS_ORIGINS, str)
        origins = settings.get_cors_origins()
        assert isinstance(origins, list)
        assert len(origins) > 0

    def test_config_jwt_settings(self):
        """Test JWT configuration"""
        from backend.config import settings

        assert isinstance(settings.JWT_SECRET_KEY, str)
        assert settings.JWT_ALGORITHM == "HS256"

    def test_config_rate_limit_settings(self):
        """Test rate limiting configuration"""
        from backend.config import settings

        # Rate limiting configuration
        assert isinstance(settings.RATE_LIMIT_ENABLED, bool)
        assert isinstance(settings.RATE_LIMIT_PER_MINUTE, int)
        assert settings.RATE_LIMIT_PER_MINUTE > 0

    def test_config_file_upload_settings(self):
        """Test file upload configuration"""
        from backend.config import settings

        assert settings.MAX_UPLOAD_SIZE_MB > 0
        assert isinstance(settings.ALLOWED_UPLOAD_EXTENSIONS, str)

        exts = settings.get_allowed_extensions()
        assert isinstance(exts, list)
        assert len(exts) > 0

    def test_config_model_defaults_resolve(self):
        """Blank LLM_MODEL falls back to the provider's default — a Gemma 3 id either way"""
        from backend.llm_client import _resolve, _PROVIDER_DEFAULTS

        for provider in _PROVIDER_DEFAULTS:
            with patch.dict("os.environ", {"LLM_PROVIDER": provider}, clear=False):
                model = _resolve("LLM_MODEL")
                assert "gemma" in model.lower(), f"{provider} default is not a Gemma model: {model}"
                assert any(char.isdigit() for char in model)

    def test_embed_dimensions_match_index(self):
        """EMBED_DIMENSIONS must match the Atlas index numDimensions"""
        from backend.config import settings

        assert settings.EMBED_DIMENSIONS == 1024
        assert settings.EMBED_MODEL == "mxbai-embed-large"

    def test_dimensions_not_sent_by_default(self):
        """`dimensions` is unhonoured by Ollama and rejected by bge-large: never send it by default"""
        from backend.config import settings

        assert settings.EMBED_SEND_DIMENSIONS is False

    def test_config_values_are_correct_types(self):
        """Test that config values are properly typed"""
        from backend.config import settings

        assert isinstance(settings.LLM_PROVIDER, str)
        assert isinstance(settings.EMBED_DIMENSIONS, int)
        assert isinstance(settings.API_ENVIRONMENT, str)
        assert isinstance(settings.CORS_ORIGINS, str)
        assert isinstance(settings.JWT_SECRET_KEY, str)
        assert isinstance(settings.RATE_LIMIT_ENABLED, bool)
        assert isinstance(settings.RATE_LIMIT_PER_MINUTE, int)


class TestConfigMethods:
    """Test configuration helper methods"""

    def test_get_cors_origins(self):
        """Test CORS origins parsing"""
        from backend.config import settings

        origins = settings.get_cors_origins()
        assert isinstance(origins, list)
        assert all(isinstance(origin, str) for origin in origins)

    def test_get_api_keys(self):
        """Test API keys parsing"""
        from backend.config import settings

        api_keys = settings.get_api_keys()
        assert isinstance(api_keys, list)

    def test_get_allowed_extensions(self):
        """Test allowed extensions parsing"""
        from backend.config import settings

        extensions = settings.get_allowed_extensions()
        assert isinstance(extensions, list)
        assert all(ext.startswith(".") for ext in extensions)

    def test_is_production_property(self):
        """Test is_production property"""
        from backend.config import settings

        # Current environment is development
        assert settings.is_production == (settings.API_ENVIRONMENT == "production")

    def test_is_development_property(self):
        """Test is_development property"""
        from backend.config import settings

        # Current environment is development
        assert settings.is_development == (settings.API_ENVIRONMENT == "development")


class TestConfigValidation:
    """Test configuration validation"""

    def test_config_with_minimal_required(self):
        """Test config with only required fields"""
        from backend.config import Settings

        with patch.dict("os.environ", {
            "FIREWORKS_API_KEY": "fw-test-key-minimal"
        }, clear=True):
            settings = Settings()
            assert settings.FIREWORKS_API_KEY == "fw-test-key-minimal"
            # Defaults to the AMD GPU, and leaves the model to the provider default
            assert settings.LLM_PROVIDER == "amd"
            assert settings.LLM_MODEL == ""


class TestConfigEnvironments:
    """Test environment-specific configuration"""

    def test_development_environment_properties(self):
        """Test development environment settings"""
        from backend.config import settings

        if settings.API_ENVIRONMENT == "development":
            assert settings.is_development is True
            assert settings.is_production is False

    def test_environment_validation(self):
        """Test environment validation"""
        from backend.config import Settings

        # Valid environments
        for env in ["development", "staging", "production"]:
            with patch.dict("os.environ", {
                "FIREWORKS_API_KEY": "fw-test",
                "API_ENVIRONMENT": env
            }, clear=True):
                s = Settings()
                assert s.API_ENVIRONMENT == env


class TestConfigFunctions:
    """Test configuration utility functions"""

    def test_validate_configuration_exists(self):
        """Test that validate_configuration function exists"""
        from backend.config import validate_configuration

        # Function should exist and be callable
        assert callable(validate_configuration)

    def test_settings_instance_exists(self):
        """Test that settings instance is created"""
        from backend.config import settings

        # Settings should be instance of Settings
        from backend.config import Settings
        assert isinstance(settings, Settings)
