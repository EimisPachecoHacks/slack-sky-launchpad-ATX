"""Pytest fixtures and configuration for backend tests"""

import os
import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Set test environment variables BEFORE importing the app
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test-key-12345"
os.environ["ANTHROPIC_MODEL"] = "claude-opus-4-6"
os.environ["API_ENVIRONMENT"] = "development"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["RATE_LIMIT_ENABLED"] = "false"  # Disable rate limiting in tests
os.environ["JWT_SECRET_KEY"] = ""  # No JWT auth in tests - allows unauthenticated access in dev mode
os.environ["API_KEYS"] = ""  # No API key auth in tests

from backend.api.main import app


@pytest.fixture
def client():
    """Synchronous test client"""
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Asynchronous test client"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_anthropic_response():
    """Mock Anthropic API response"""
    mock_response = Mock()
    mock_response.content = [Mock(text="Mock AI response")]
    return mock_response


@pytest.fixture
def mock_architecture_response():
    """Mock architecture generation response"""
    return """```json
{
  "architecture": {
    "title": "Test Architecture",
    "description": "Test cloud architecture",
    "provider": "aws",
    "total_cost": 100.00,
    "services": [
      {
        "id": "service-1",
        "name": "EC2 Instance",
        "type": "compute",
        "cost": 50.00,
        "description": "Test instance",
        "icon": "server",
        "position": {"x": 100, "y": 100}
      }
    ],
    "connections": [
      {"from": "service-1", "to": "service-2", "type": "HTTP"}
    ],
    "alternatives": []
  }
}
```

## Architecture Overview
This is a test architecture."""


@pytest.fixture
def mock_code_response():
    """Mock infrastructure code generation response"""
    return """# Terraform Configuration
terraform {
  required_version = ">= 1.0"
}

resource "aws_instance" "example" {
  ami           = "ami-12345"
  instance_type = "t3.micro"
}"""


@pytest.fixture
def mock_image_analysis_response():
    """Mock image analysis response"""
    return {
        "provider": "aws",
        "detected_components": [
            {
                "type": "load_balancer",
                "service_name": "Application Load Balancer",
                "confidence": 95,
                "category": "network",
                "description": "Load balancer for distributing traffic"
            }
        ],
        "complexity": "medium",
        "estimated_monthly_cost": 150.00,
        "connections": [],
        "architecture_pattern": "Standard web application with load balancing"
    }


@pytest.fixture
def sample_architecture_request():
    """Sample architecture generation request"""
    return {
        "title": "Test App",
        "description": "Test application",
        "provider": "aws",
        "optimization_goal": "balanced",
        "requirements": ["High availability", "Scalable"],
        "budget": 500,
        "expected_users": 10000
    }


@pytest.fixture
def sample_code_generation_request():
    """Sample code generation request"""
    return {
        "architecture": {
            "name": "Test Architecture",
            "provider": "aws",
            "components": [
                {"name": "VPC", "description": "10.0.0.0/16"},
                {"name": "EC2", "description": "t3.micro instance"}
            ]
        },
        "code_type": "terraform",
        "provider": "aws"
    }


@pytest.fixture
def mock_anthropic_client(mock_anthropic_response):
    """Mock Anthropic client"""
    with patch("anthropic.Anthropic") as mock_client:
        mock_instance = Mock()
        mock_instance.messages.create = Mock(return_value=mock_anthropic_response)
        mock_client.return_value = mock_instance
        yield mock_client


@pytest.fixture
def mock_anthropic_client_async():
    """Mock Anthropic async client"""
    mock_response = AsyncMock()
    mock_response.content = [Mock(text="Mock async response")]

    with patch("anthropic.AsyncAnthropic") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.messages.create = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance
        yield mock_client


@pytest.fixture
def disable_auth():
    """Disable authentication for testing"""
    with patch("backend.middleware.auth.verify_authentication", return_value={"authenticated": True, "mode": "test"}):
        yield


@pytest.fixture
def sample_image_file():
    """Sample image file for upload testing"""
    import io
    from PIL import Image

    # Create a simple test image
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)

    return img_bytes
