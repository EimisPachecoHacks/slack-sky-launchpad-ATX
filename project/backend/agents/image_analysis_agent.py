"""
Image Analysis Agent for Sky Launchpad — Google Gemini (multimodal)

A single Gemini call (default gemini-3.1-pro-preview) looks at the uploaded
cloud-architecture diagram and returns the full structured analysis as JSON:
detected components, categories, cost estimates, connections, and
recommendations.

This replaces the previous hybrid Anthropic Claude Vision + GitLab Duo flow —
Gemini is natively multimodal, so vision extraction and architectural analysis
happen in one step.
"""

import os
import json
from typing import Dict, Optional
import logging

from backend.gemini_client import vision

logger = logging.getLogger(__name__)

_IMAGE_ANALYSIS_PROMPT = """You are an expert cloud architecture analyst. Look at this cloud architecture diagram image, identify every cloud service/component and the connections between them, then produce a complete architectural analysis as a JSON object with this EXACT structure:

```json
{
  "provider": "aws" | "azure" | "gcp",
  "detected_components": [
    {
      "type": "component_type",
      "service_name": "Specific Service Name",
      "confidence": 95,
      "category": "network" | "compute" | "database" | "storage" | "cache" | "cdn" | "security" | "serverless" | "analytics" | "ml" | "monitoring",
      "description": "Brief description of what this component does in the architecture",
      "estimated_monthly_cost": 45.50
    }
  ],
  "complexity": "low" | "medium" | "high",
  "estimated_monthly_cost": 245.50,
  "connections": [
    { "from": 0, "to": 1, "type": "http" | "tcp" | "data_flow" | "api_call" }
  ],
  "architecture_pattern": "Brief description of the overall architecture pattern",
  "recommendations": [ "Recommendations for improvement" ]
}
```

IMPORTANT:
- Identify the cloud provider (AWS, Azure, or GCP) from icons and labels.
- Output ONLY the JSON object inside a ```json code block.
- Use realistic monthly cost estimates in USD.
- The "from"/"to" in connections are zero-based indices into the detected_components array.
- Set complexity based on component count: low (1-3), medium (4-8), high (9+).
"""


class ImageAnalysisAgent:
    """Multimodal agent: Gemini analyzes a diagram image and returns structured JSON."""

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        self.model = model or os.getenv("GEMINI_VISION_MODEL", "gemini-3.1-pro-preview")
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required for image analysis")

    def analyze_architecture_diagram(
        self,
        image_base64: str,
        image_format: str = 'png'
    ) -> Dict:
        try:
            logger.info("🖼️  Analyzing diagram via Gemini (image → structured JSON)...")
            response_text = vision(
                image_base64=image_base64,
                image_format=image_format,
                prompt=_IMAGE_ANALYSIS_PROMPT,
                model=self.model,
            )
            logger.info(f"✅ Gemini analysis complete: {len(response_text)} chars")
            return self._parse_analysis_response(response_text)

        except Exception as e:
            logger.error(f"❌ Error analyzing diagram: {e}")
            raise

    def _parse_analysis_response(self, response_text: str) -> Dict:
        """Parse the Gemini analysis JSON response."""
        try:
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                json_str = response_text[start:end].strip()
            elif "```" in response_text:
                start = response_text.find("```") + 3
                end = response_text.find("```", start)
                json_str = response_text[start:end].strip()
            else:
                json_str = response_text.strip()

            data = json.loads(json_str)

            required_fields = ['provider', 'detected_components', 'complexity', 'estimated_monthly_cost']
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")

            logger.info(
                f"✓ Parsed: {data['provider'].upper()}, "
                f"{len(data['detected_components'])} components, "
                f"${data['estimated_monthly_cost']}/mo"
            )
            return data

        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse JSON: {e}")
            logger.debug(f"Response: {response_text[:500]}")
            return {
                "provider": "aws",
                "detected_components": [],
                "complexity": "medium",
                "estimated_monthly_cost": 0,
                "connections": [],
                "error": "Failed to parse AI response",
                "raw_response": response_text[:500],
            }


_image_analysis_agent = None


def get_image_analysis_agent() -> ImageAnalysisAgent:
    """Get or create ImageAnalysisAgent singleton"""
    global _image_analysis_agent
    if _image_analysis_agent is None:
        _image_analysis_agent = ImageAnalysisAgent()
    return _image_analysis_agent
