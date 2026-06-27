"""Simplified tests for AI agents"""

import pytest
from unittest.mock import Mock, patch
import json


class TestArchitectureAgentBasics:
    """Basic tests for ArchitectureAgent"""

    @pytest.fixture
    def architecture_agent(self):
        """Create ArchitectureAgent instance for testing"""
        from backend.agents.architecture_agent import ArchitectureAgent
        with patch("anthropic.Anthropic"):
            agent = ArchitectureAgent(
                model="claude-opus-4-6",
                api_key="test-key"
            )
            return agent

    def test_agent_initialization(self, architecture_agent):
        """Test agent initializes correctly"""
        assert architecture_agent.model == "claude-opus-4-6"
        assert architecture_agent.api_key == "test-key"

    def test_generate_architecture(self, architecture_agent):
        """Test architecture generation"""
        architecture_agent._call_claude = Mock(return_value="Architecture design response")

        result = architecture_agent.generate_architecture("Build a web app")

        assert isinstance(result, str)
        architecture_agent._call_claude.assert_called_once()

    def test_optimize_architecture(self, architecture_agent):
        """Test architecture optimization"""
        architecture_agent._call_claude = Mock(return_value="Optimization suggestions")

        result = architecture_agent.optimize_architecture(
            "Current architecture with EC2",
            "cost"
        )

        assert isinstance(result, str)
        architecture_agent._call_claude.assert_called_once()

    def test_validate_design(self, architecture_agent):
        """Test design validation"""
        architecture_agent._call_claude = Mock(return_value="Validation results")

        result = architecture_agent.validate_design("Architecture with load balancer and EC2")

        assert isinstance(result, str)
        architecture_agent._call_claude.assert_called_once()

    def test_compare_providers(self, architecture_agent):
        """Test provider comparison"""
        architecture_agent._call_claude = Mock(return_value="Provider comparison")

        result = architecture_agent.compare_providers("compute")

        assert isinstance(result, str)
        architecture_agent._call_claude.assert_called_once()


class TestImageAnalysisAgentBasics:
    """Basic tests for ImageAnalysisAgent"""

    @pytest.fixture
    def image_agent(self):
        """Create ImageAnalysisAgent instance for testing"""
        from backend.agents.image_analysis_agent import ImageAnalysisAgent
        with patch("anthropic.Anthropic"):
            agent = ImageAnalysisAgent(
                model="claude-opus-4-6",
                api_key="test-key"
            )
            return agent

    def test_image_agent_initialization(self, image_agent):
        """Test image agent initializes correctly"""
        assert image_agent.model == "claude-opus-4-6"
        assert image_agent.api_key == "test-key"

    def test_analyze_architecture_diagram(self, image_agent):
        """Test diagram analysis"""
        analysis_data = {
            "provider": "aws",
            "detected_components": [],
            "complexity": "medium",
            "estimated_monthly_cost": 150.0
        }

        mock_response = Mock()
        mock_response.content = [Mock(text=json.dumps(analysis_data))]
        image_agent.client.messages.create = Mock(return_value=mock_response)

        result = image_agent.analyze_architecture_diagram("base64image", "png")

        assert result["provider"] == "aws"
        assert "detected_components" in result
        assert "estimated_monthly_cost" in result
