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
        assert settings.ANTHROPIC_API_KEY.startswith("sk-ant")
        assert settings.ANTHROPIC_MODEL == "claude-opus-4-6"
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

    def test_config_validates_anthropic_model(self):
        """Test that Anthropic model validation works"""
        from backend.config import Settings

        # Valid model should work
        with patch.dict("os.environ", {
            "ANTHROPIC_API_KEY": "sk-ant-test-key",
            "ANTHROPIC_MODEL": "claude-opus-4-6"
        }, clear=False):
            settings = Settings()
            assert settings.ANTHROPIC_MODEL == "claude-opus-4-6"

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

    def test_config_model_name_validation(self):
        """Test model name follows expected pattern"""
        from backend.config import settings

        # Model should start with claude
        assert settings.ANTHROPIC_MODEL.startswith("claude")

        # Should contain version info
        assert any(char.isdigit() for char in settings.ANTHROPIC_MODEL)

    def test_config_api_key_format(self):
        """Test API key has expected format"""
        from backend.config import settings

        # Should start with sk-ant
        assert settings.ANTHROPIC_API_KEY.startswith("sk-ant")

    def test_config_values_are_correct_types(self):
        """Test that config values are properly typed"""
        from backend.config import settings

        assert isinstance(settings.ANTHROPIC_API_KEY, str)
        assert isinstance(settings.ANTHROPIC_MODEL, str)
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
            "ANTHROPIC_API_KEY": "sk-ant-test-key-minimal"
        }, clear=True):
            settings = Settings()
            assert settings.ANTHROPIC_API_KEY == "sk-ant-test-key-minimal"
            # Should use default model
            assert settings.ANTHROPIC_MODEL == "claude-opus-4-6"


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
                "ANTHROPIC_API_KEY": "sk-ant-test",
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
