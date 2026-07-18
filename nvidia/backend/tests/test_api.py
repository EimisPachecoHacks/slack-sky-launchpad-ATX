"""Tests for API endpoints"""

import pytest
from unittest.mock import patch, Mock
from fastapi import status


class TestHealthEndpoints:
    """Test health check endpoints"""

    def test_root_health_check_healthy(self, client):
        """Test root endpoint returns healthy status"""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert data["version"] == "1.0.0"

    def test_health_endpoint(self, client):
        """Test /health endpoint"""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "Skyrchitect AI Backend"


@pytest.mark.usefixtures("disable_auth")
class TestArchitectureGeneration:
    """Test architecture generation endpoint"""

    def test_generate_architecture_success(
        self, client, sample_architecture_request, mock_architecture_response
    ):
        """Test successful architecture generation"""
        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = mock_architecture_response

            response = client.post("/api/architecture/generate", json=sample_architecture_request)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True
            assert "data" in data
            assert "reasoning" in data

    def test_generate_architecture_accepts_alibaba_cloud(
        self, client, sample_architecture_request, mock_architecture_response
    ):
        """Alibaba Cloud is a first-class provider in the request schema."""
        sample_architecture_request["provider"] = "alicloud"
        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = mock_architecture_response

            response = client.post("/api/architecture/generate", json=sample_architecture_request)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["success"] is True

    def test_generate_architecture_invalid_provider(self, client):
        """Test architecture generation with invalid provider"""
        request_data = {
            "title": "Test",
            "description": "Test",
            "provider": "invalid_provider",  # Invalid
            "optimization_goal": "balanced"
        }
        response = client.post("/api/architecture/generate", json=request_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_generate_architecture_missing_fields(self, client):
        """Test architecture generation with missing required fields"""
        request_data = {
            "title": "Test"
            # Missing description, provider, etc.
        }
        response = client.post("/api/architecture/generate", json=request_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_generate_architecture_agent_error(self, client, sample_architecture_request):
        """Test architecture generation when agent fails"""
        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.side_effect = Exception("API Error")

            response = client.post("/api/architecture/generate", json=sample_architecture_request)
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


@pytest.mark.usefixtures("disable_auth")
class TestCodeGeneration:
    """Test infrastructure code generation endpoint"""

    def test_generate_terraform_code(self, client, sample_code_generation_request, mock_code_response):
        """Test Terraform code generation"""
        with patch("backend.llm_client.chat", return_value=mock_code_response):
            response = client.post("/api/code/generate", json=sample_code_generation_request)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True
            assert "terraform" in data["data"]["code"].lower()

    def test_generate_cloudformation_code(self, client, mock_code_response):
        """Test CloudFormation code generation"""
        request_data = {
            "architecture": {
                "name": "Test",
                "components": [{"name": "VPC", "description": "Test VPC"}]
            },
            "code_type": "cloudformation",
            "provider": "aws"
        }

        with patch("backend.llm_client.chat", return_value="AWSTemplateFormatVersion: '2010-09-09'"):
            response = client.post("/api/code/generate", json=request_data)
            assert response.status_code == status.HTTP_200_OK

    def test_generate_code_error(self, client, sample_code_generation_request):
        """Test code generation when the Qwen backend fails"""
        with patch("backend.llm_client.chat", side_effect=Exception("Qwen error")):
            response = client.post("/api/code/generate", json=sample_code_generation_request)
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


@pytest.mark.usefixtures("disable_auth")
class TestArchitectureOperations:
    """Test architecture optimization and validation endpoints"""

    def test_optimize_architecture(self, client):
        """Test architecture optimization"""
        request_data = {
            "provider": "aws",
            "current_cost": 500.0,
            "optimization_goal": "cost",
            "components": [
                {"name": "EC2", "type": "compute"},
                {"name": "RDS", "type": "database"},
                {"name": "S3", "type": "storage"}
            ]
        }

        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = "Optimization recommendations"

            response = client.post("/api/architecture/optimize", json=request_data)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True

    def test_validate_architecture(self, client):
        """Test architecture validation"""
        request_data = {
            "provider": "aws",
            "nodes": [
                {"id": "ec2", "type": "compute"},
                {"id": "rds", "type": "database"}
            ],
            "edges": [
                {"from": "ec2", "to": "rds", "type": "connection"}
            ],
            "requirements": "High availability"
        }

        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = "Validation results"

            response = client.post("/api/architecture/validate", json=request_data)
            assert response.status_code == status.HTTP_200_OK

    def test_compare_cloud_services(self, client):
        """Test cloud service comparison"""
        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = "Service comparison"

            response = client.get("/api/cloud/compare/ec2")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True


@pytest.mark.usefixtures("disable_auth")
class TestChatEndpoint:
    """Test chat endpoint"""

    def test_chat_with_agent(self, client):
        """Test chat endpoint"""
        request_data = {
            "question": "What is a VPC?",
            "context": None
        }

        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = "A VPC is a Virtual Private Cloud..."

            response = client.post("/api/chat", json=request_data)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True
            assert "answer" in data["data"]

    def test_chat_with_context(self, client):
        """Test chat with architecture context"""
        request_data = {
            "question": "How can I optimize this?",
            "context": "I have an EC2 instance and RDS database"
        }

        with patch("backend.agents.architecture_agent.ArchitectureAgent._call_duo") as mock_call:
            mock_call.return_value = "You can optimize by..."

            response = client.post("/api/chat", json=request_data)
            assert response.status_code == status.HTTP_200_OK


@pytest.mark.usefixtures("disable_auth")
class TestImageAnalysis:
    """Test image analysis endpoint"""

    def test_analyze_image_success(self, client, sample_image_file, mock_image_analysis_response):
        """Test successful image analysis"""
        with patch("backend.agents.image_analysis_agent.ImageAnalysisAgent.analyze_architecture_diagram") as mock_analyze:
            mock_analyze.return_value = mock_image_analysis_response

            files = {"file": ("test.png", sample_image_file, "image/png")}
            response = client.post("/api/architecture/analyze-image", files=files)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["success"] is True
            assert "architecture" in data["data"]

    def test_analyze_image_invalid_file_type(self, client):
        """Test image analysis with invalid file type"""
        import io

        fake_file = io.BytesIO(b"not an image")
        files = {"file": ("test.txt", fake_file, "text/plain")}

        response = client.post("/api/architecture/analyze-image", files=files)
        # Should fail validation
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]

    def test_analyze_image_too_large(self, client):
        """Test image analysis with file too large"""
        import io

        # Create a file larger than 10MB (simulated)
        large_file = io.BytesIO(b"x" * (11 * 1024 * 1024))
        files = {"file": ("large.png", large_file, "image/png")}

        response = client.post("/api/architecture/analyze-image", files=files)
        # Should fail size validation
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE]


@pytest.mark.usefixtures("disable_auth")
class TestDeployment:
    """Test deployment endpoint"""

    def test_deploy_requires_explicit_confirmation(self, client):
        """Terraform must not run until the user acknowledges the cost warning."""
        response = client.post(
            "/api/deploy",
            json={
                "architecture": {"name": "Test App", "provider": "aws", "components": []},
                "config": {"provider": "aws", "region": "us-east-1"},
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "explicitly confirmed" in response.json()["detail"]

    def test_deploy_requires_stored_credentials(self, client):
        """A real deployment must not start without stored cloud credentials."""
        request_data = {
            "confirm_deploy": True,
            "architecture": {
                "name": "Test App",
                "provider": "aws",
                "components": []
            },
            "config": {
                "provider": "aws",
                "region": "us-east-1",
                "stack_name": "test-stack"
            }
        }

        response = client.post("/api/deploy", json=request_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "No AWS credentials stored" in response.json()["detail"]

    def test_alibaba_deploy_requires_stored_credentials(self, client):
        """Alibaba deploys must stop before Terraform can contact the account."""
        response = client.post(
            "/api/deploy",
            json={
                "confirm_deploy": True,
                "architecture": {"name": "Minimal Alibaba Test", "provider": "alicloud", "components": []},
                "config": {"provider": "alicloud", "region": "ap-southeast-1"},
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "No ALICLOUD credentials stored" in response.json()["detail"]


@pytest.mark.usefixtures("disable_auth")
class TestCredentialUpload:
    """Credential uploads must use the deployer's configured private storage."""

    def test_upload_alibaba_credentials(self, client):
        from deployer.config import CREDENTIALS_DIR
        from deployer.credential_manager import credential_exists

        response = client.post(
            "/api/credentials/upload?provider=alicloud",
            files={
                "file": (
                    "alicloud.json",
                    b'{"access_key_id":"test-key","access_key_secret":"test-secret","region":"ap-southeast-1"}',
                    "application/json",
                )
            },
        )

        try:
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["success"] is True
            assert credential_exists("alicloud")
        finally:
            (CREDENTIALS_DIR / "alicloud.enc").unlink(missing_ok=True)

    def test_upload_alibaba_console_csv(self, client):
        from deployer.config import CREDENTIALS_DIR
        from deployer.credential_manager import get_alicloud_keys

        response = client.post(
            "/api/credentials/upload?provider=alicloud",
            files={
                "file": (
                    "AccessKey-test.csv",
                    b"AccessKey ID,AccessKey Secret\nLTAI-test-id,test-secret\n",
                    "text/csv",
                )
            },
        )

        try:
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["success"] is True
            assert response.json()["info"]["access_key_id"] == "LTAI-test-id"
            assert get_alicloud_keys() == ("LTAI-test-id", "test-secret")
        finally:
            (CREDENTIALS_DIR / "alicloud.enc").unlink(missing_ok=True)
