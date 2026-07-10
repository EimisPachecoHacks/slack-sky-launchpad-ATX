"""
Integration tests with REAL Anthropic API calls
WARNING: These tests consume API credits!
"""

import pytest
import json
import base64
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from backend.api.main import app
from backend.config import settings


# Mark all tests in this file as integration tests
pytestmark = pytest.mark.integration


@pytest.fixture
def skip_if_no_api_key():
    """Skip tests if no valid API key is configured"""
    key = settings.LLM_API_KEY or settings.FIREWORKS_API_KEY
    if not key or key == "fw-test-key-12345":
        pytest.skip("Skipping: No valid Fireworks API key configured")


class TestRealArchitectureGeneration:
    """Test architecture generation with real API calls"""

    @pytest.mark.asyncio
    async def test_generate_simple_architecture(self, skip_if_no_api_key):
        """Test generating a simple web application architecture"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "title": "Simple Web App",
                "description": "A basic web application with user authentication",
                "provider": "aws",
                "optimization_goal": "balanced",
                "requirements": ["User authentication", "Database storage"],
                "budget": 200,
                "expected_users": 1000
            }

            print("\n🚀 Testing: Generate Simple Architecture")
            print(f"Request: {json.dumps(request_data, indent=2)}")

            response = await client.post("/api/architecture/generate", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")

            assert data["success"] is True
            assert "architecture" in data
            assert "reasoning" in data
            print("✅ PASSED: Simple architecture generation")

    @pytest.mark.asyncio
    async def test_generate_complex_architecture(self, skip_if_no_api_key):
        """Test generating a complex microservices architecture"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "title": "E-Commerce Microservices Platform",
                "description": "Scalable e-commerce platform with microservices architecture",
                "provider": "aws",
                "optimization_goal": "performance",
                "requirements": [
                    "High availability (99.99% uptime)",
                    "Auto-scaling",
                    "Multi-region deployment",
                    "Real-time analytics",
                    "Payment processing"
                ],
                "budget": 5000,
                "expected_users": 100000
            }

            print("\n🚀 Testing: Generate Complex Microservices Architecture")
            print(f"Request: {json.dumps(request_data, indent=2)}")

            response = await client.post("/api/architecture/generate", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Response Preview: {str(data)[:500]}...")

            assert data["success"] is True
            assert "architecture" in data
            print("✅ PASSED: Complex architecture generation")


class TestRealCodeGeneration:
    """Test code generation with real API calls"""

    @pytest.mark.asyncio
    async def test_generate_terraform_code(self, skip_if_no_api_key):
        """Test generating Terraform code"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "architecture": {
                    "name": "Simple VPC with EC2",
                    "components": [
                        {"name": "VPC", "description": "10.0.0.0/16 CIDR block"},
                        {"name": "Public Subnet", "description": "10.0.1.0/24"},
                        {"name": "EC2 Instance", "description": "t3.micro web server"}
                    ]
                },
                "code_type": "terraform",
                "provider": "aws"
            }

            print("\n🚀 Testing: Generate Terraform Code")
            print(f"Request: {json.dumps(request_data, indent=2)}")

            response = await client.post("/api/code/generate", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Generated Code (first 500 chars):\n{data['code'][:500]}...")

            assert data["success"] is True
            assert "code" in data
            assert len(data["code"]) > 100  # Should generate substantial code
            assert "terraform" in data["code"].lower() or "resource" in data["code"].lower()
            print("✅ PASSED: Terraform code generation")

    @pytest.mark.asyncio
    async def test_generate_cloudformation_code(self, skip_if_no_api_key):
        """Test generating CloudFormation code"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "architecture": {
                    "name": "Simple S3 Static Website",
                    "components": [
                        {"name": "S3 Bucket", "description": "Static website hosting"},
                        {"name": "CloudFront", "description": "CDN distribution"}
                    ]
                },
                "code_type": "cloudformation",
                "provider": "aws"
            }

            print("\n🚀 Testing: Generate CloudFormation Code")

            response = await client.post("/api/code/generate", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Generated Code (first 500 chars):\n{data['code'][:500]}...")

            assert data["success"] is True
            assert "code" in data
            print("✅ PASSED: CloudFormation code generation")


class TestRealOptimization:
    """Test architecture optimization with real API calls"""

    @pytest.mark.asyncio
    async def test_optimize_for_cost(self, skip_if_no_api_key):
        """Test optimizing architecture for cost reduction"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "provider": "aws",
                "current_cost": 1000.0,
                "optimization_goal": "cost",
                "components": [
                    {"name": "EC2 m5.2xlarge", "type": "compute", "cost": 400},
                    {"name": "RDS PostgreSQL db.m5.large", "type": "database", "cost": 300},
                    {"name": "S3 Standard", "type": "storage", "cost": 100},
                    {"name": "NAT Gateway", "type": "network", "cost": 200}
                ]
            }

            print("\n🚀 Testing: Optimize Architecture for Cost")
            print(f"Current Cost: ${request_data['current_cost']}")

            response = await client.post("/api/architecture/optimize", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Optimization Result:\n{data['result'][:500]}...")

            assert data["success"] is True
            assert "result" in data
            print("✅ PASSED: Cost optimization")

    @pytest.mark.asyncio
    async def test_optimize_for_performance(self, skip_if_no_api_key):
        """Test optimizing architecture for performance"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "provider": "aws",
                "current_cost": 500.0,
                "optimization_goal": "performance",
                "components": [
                    {"name": "EC2 t3.small", "type": "compute", "cost": 150},
                    {"name": "RDS PostgreSQL db.t3.small", "type": "database", "cost": 150},
                    {"name": "ElastiCache", "type": "cache", "cost": 200}
                ]
            }

            print("\n🚀 Testing: Optimize Architecture for Performance")

            response = await client.post("/api/architecture/optimize", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Optimization Result:\n{data['result'][:500]}...")

            assert data["success"] is True
            print("✅ PASSED: Performance optimization")


class TestRealValidation:
    """Test design validation with real API calls"""

    @pytest.mark.asyncio
    async def test_validate_architecture_design(self, skip_if_no_api_key):
        """Test validating an architecture design"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "provider": "aws",
                "nodes": [
                    {"id": "alb", "type": "load_balancer", "name": "Application Load Balancer"},
                    {"id": "ec2-1", "type": "compute", "name": "Web Server 1"},
                    {"id": "ec2-2", "type": "compute", "name": "Web Server 2"},
                    {"id": "rds", "type": "database", "name": "PostgreSQL Database"}
                ],
                "edges": [
                    {"from": "alb", "to": "ec2-1", "type": "http"},
                    {"from": "alb", "to": "ec2-2", "type": "http"},
                    {"from": "ec2-1", "to": "rds", "type": "connection"},
                    {"from": "ec2-2", "to": "rds", "type": "connection"}
                ],
                "requirements": "High availability, fault tolerance, and secure database access"
            }

            print("\n🚀 Testing: Validate Architecture Design")
            print(f"Nodes: {len(request_data['nodes'])}, Edges: {len(request_data['edges'])}")

            response = await client.post("/api/architecture/validate", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Validation Result:\n{data['result'][:500]}...")

            assert data["success"] is True
            print("✅ PASSED: Architecture validation")


class TestRealChat:
    """Test chat functionality with real API calls"""

    @pytest.mark.asyncio
    async def test_chat_general_question(self, skip_if_no_api_key):
        """Test chat with general cloud question"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "question": "What is the difference between AWS Lambda and EC2?",
                "context": None
            }

            print("\n🚀 Testing: Chat - General Question")
            print(f"Question: {request_data['question']}")

            response = await client.post("/api/chat", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Answer:\n{data['answer'][:500]}...")

            assert data["success"] is True
            assert "answer" in data
            assert len(data["answer"]) > 50  # Should give substantial answer
            print("✅ PASSED: General chat question")

    @pytest.mark.asyncio
    async def test_chat_with_context(self, skip_if_no_api_key):
        """Test chat with context about specific architecture"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            request_data = {
                "question": "How can I reduce costs for this setup?",
                "context": "I have 3 EC2 m5.2xlarge instances running 24/7, an RDS PostgreSQL db.m5.large, and a NAT Gateway. Current monthly cost is around $1000."
            }

            print("\n🚀 Testing: Chat - Question with Context")
            print(f"Question: {request_data['question']}")
            print(f"Context: {request_data['context']}")

            response = await client.post("/api/chat", json=request_data)

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Answer:\n{data['answer'][:500]}...")

            assert data["success"] is True
            print("✅ PASSED: Contextual chat question")


class TestRealCloudComparison:
    """Test cloud provider comparison with real API calls"""

    @pytest.mark.asyncio
    async def test_compare_compute_services(self, skip_if_no_api_key):
        """Test comparing compute services across providers"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            print("\n🚀 Testing: Compare Compute Services")

            response = await client.get("/api/cloud/compare/compute")

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Comparison Result:\n{data['result'][:500]}...")

            assert data["success"] is True
            print("✅ PASSED: Compute services comparison")

    @pytest.mark.asyncio
    async def test_compare_database_services(self, skip_if_no_api_key):
        """Test comparing database services across providers"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            print("\n🚀 Testing: Compare Database Services")

            response = await client.get("/api/cloud/compare/database")

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Comparison Result:\n{data['result'][:500]}...")

            assert data["success"] is True
            print("✅ PASSED: Database services comparison")


class TestRealHealthCheck:
    """Test health check endpoints"""

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test basic health check"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            print("\n🚀 Testing: Health Check")

            response = await client.get("/health")

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Health Status: {json.dumps(data, indent=2)}")

            assert data["status"] == "ok"
            print("✅ PASSED: Health check")

    @pytest.mark.asyncio
    async def test_root_health_check(self):
        """Test root endpoint health check"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            print("\n🚀 Testing: Root Health Check")

            response = await client.get("/")

            print(f"Status Code: {response.status_code}")
            assert response.status_code == 200

            data = response.json()
            print(f"Root Status: {json.dumps(data, indent=2)}")

            from backend.llm_client import _resolve

            assert data["status"] == "healthy"
            assert data["agent_ready"] is True
            assert data["llm_connected"] is True
            assert data["llm_provider"] == settings.LLM_PROVIDER
            assert data["model_id"] == _resolve("LLM_MODEL")
            print("✅ PASSED: Root health check")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short", "-m", "integration"])
