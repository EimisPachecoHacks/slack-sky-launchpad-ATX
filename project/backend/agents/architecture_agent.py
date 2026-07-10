"""
AI Agent for Cloud Architecture Recommendations

Routes all text-based AI requests (architecture JSON + markdown) through Gemma 3
(see backend/llm_client.py), served either by vLLM on an AMD ROCm GPU or by the
Fireworks AI managed API.

Image/vision analysis lives in image_analysis_agent.py (Gemma 3 as a VLM).
"""

import logging
from typing import Optional

from backend import llm_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """I need your help as a DevSecOps assistant to design a cloud infrastructure architecture.

Please analyze the requirements below and return your recommendation as a JSON code block followed by a markdown explanation.

CRITICAL: Your response MUST start with a ```json code block containing this EXACT structure:

```json
{
  "architecture": {
    "title": "Project Title",
    "description": "Brief project description",
    "provider": "aws|azure|gcp",
    "total_cost": 229.00,
    "services": [
      {
        "id": "service-1",
        "name": "Cloud SQL",
        "type": "database",
        "cost": 29.20,
        "description": "Primary relational database",
        "icon": "server",
        "position": {"x": 300, "y": 200}
      }
    ],
    "connections": [
      {"from": "service-1", "to": "service-2", "type": "HTTP/HTTPS"}
    ],
    "alternatives": [
      {
        "service_id": "service-1",
        "alternative_name": "Cloud SQL db-f1-micro",
        "cost": 14.60,
        "savings": 14.60,
        "performance": 70,
        "description": "Smaller instance size"
      }
    ]
  }
}
```

NODE POSITIONING: Space nodes 400px apart horizontally and 300px vertically. Arrange in logical layers (frontend top, backend middle, data bottom). Example for 5 nodes:
  * {"x": 100, "y": 100}, {"x": 100, "y": 500}, {"x": 100, "y": 900}, {"x": 600, "y": 500}, {"x": 600, "y": 900}

After the JSON block, provide markdown with:
- Architecture overview
- Security best practices
- Cost breakdown
- Optimization recommendations"""


class ArchitectureAgent:
    """AI Agent for cloud architecture design, powered by Gemma 3."""

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        self.model = model or llm_client._resolve("LLM_MODEL")
        self.api_key = api_key or ""
        logger.info(f"ArchitectureAgent initialized ({llm_client._provider()} backend, {self.model})")

    def _call_duo(self, prompt: str) -> str:
        """Generate an architecture response (name kept for call-site stability)."""
        logger.info(f"[ArchitectureAgent] Sending {len(prompt)} chars to {self.model}")
        response = llm_client.chat(prompt, system=_SYSTEM_PROMPT, kind="architecture")
        logger.info(f"[ArchitectureAgent] Received {len(response)} chars")
        return response

    def generate_architecture(self, requirements: str) -> str:
        prompt = f"""Design a cloud architecture based on these requirements:

{requirements}

Please:
1. Recommend specific cloud services with estimated costs
2. Calculate the total monthly cost
3. Suggest how services should connect
4. Validate the architecture for best practices
5. Provide security recommendations
6. Suggest cost optimizations if possible

Be specific and provide a complete, production-ready architecture."""

        return self._call_duo(prompt)

    def optimize_architecture(self, current_architecture: str, optimization_goal: str) -> str:
        prompt = f"""Analyze and optimize this architecture with goal: {optimization_goal}

Current Architecture:
{current_architecture}

Please:
1. Identify optimization opportunities
2. Calculate potential savings
3. Suggest alternative services where beneficial
4. Maintain or improve performance
5. Ensure security is not compromised
6. Provide implementation steps

Focus on practical, high-impact optimizations."""

        return self._call_duo(prompt)

    def validate_design(self, architecture_description: str) -> str:
        prompt = f"""Validate this cloud architecture design:

{architecture_description}

Provide:
1. Validation results
2. Security concerns
3. Scalability issues
4. Best practice violations
5. Recommended improvements
6. Priority of each issue"""

        return self._call_duo(prompt)

    def compare_providers(self, service_name: str) -> str:
        prompt = f"""Compare the service "{service_name}" across AWS, Azure, and Google Cloud.

Provide:
1. Equivalent services in each cloud
2. Key feature differences
3. Cost comparison
4. When to choose each provider
5. Migration considerations"""

        return self._call_duo(prompt)

    def answer_question(self, question: str, context: Optional[str] = None) -> str:
        if context:
            prompt = f"""Context: {context}

Question: {question}

Provide a clear, practical answer."""
        else:
            prompt = question

        return self._call_duo(prompt)


_agent_instance: Optional[ArchitectureAgent] = None


def get_architecture_agent() -> ArchitectureAgent:
    """Get or create the architecture agent singleton"""
    global _agent_instance

    if _agent_instance is None:
        _agent_instance = ArchitectureAgent()

    return _agent_instance
