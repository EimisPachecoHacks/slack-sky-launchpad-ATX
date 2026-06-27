"""
Image Analysis Agent for Skyrchitect AI — Hybrid Vision + Duo approach

Step 1 (Anthropic Claude Vision — minimal, unavoidable):
    Send image to Claude Vision and ask it ONLY to describe what cloud
    services/components it sees. This is purely image-to-text extraction;
    the Duo CLI cannot handle images, so this is the one place we must
    call Anthropic directly.

Step 2 (GitLab Duo Agent Platform — all the intelligence):
    Send the text description from Step 1 to `glab duo cli run --goal`
    which performs the actual architectural analysis: cost estimation,
    complexity assessment, connection mapping, and structured JSON output.
    Skills and AGENTS.md are automatically loaded by the Duo CLI.
"""

import os
import json
import anthropic
from typing import Dict, Optional
import logging

from backend.duo_client import get_duo_client

logger = logging.getLogger(__name__)

_VISION_PROMPT = """Look at this cloud architecture diagram image and list every cloud service or component you can see.

For each component, state:
- The service name (e.g., "Amazon S3", "AWS Lambda", "Cloud SQL")
- Its category (compute, storage, database, network, serverless, security, analytics, ml, monitoring)
- A one-line description of its role in the diagram
- Any visible connections/arrows between components

Also identify the cloud provider (AWS, Azure, or GCP) based on icons and labels.

Be thorough — list every service visible in the diagram. Output as plain text, not JSON."""

_DUO_ANALYSIS_PROMPT = """You are an expert cloud architecture analyst. A user uploaded a cloud architecture diagram image. The image was scanned and the following components were identified:

--- IMAGE SCAN RESULTS ---
{vision_text}
--- END SCAN ---

Based on these scan results, produce a complete architectural analysis as a JSON object with this EXACT structure:

```json
{{
  "provider": "aws" | "azure" | "gcp",
  "detected_components": [
    {{
      "type": "component_type",
      "service_name": "Specific Service Name",
      "confidence": 95,
      "category": "network" | "compute" | "database" | "storage" | "cache" | "cdn" | "security" | "serverless" | "analytics" | "ml" | "monitoring",
      "description": "Brief description of what this component does in the architecture",
      "estimated_monthly_cost": 45.50
    }}
  ],
  "complexity": "low" | "medium" | "high",
  "estimated_monthly_cost": 245.50,
  "connections": [
    {{
      "from": 0,
      "to": 1,
      "type": "http" | "tcp" | "data_flow" | "api_call"
    }}
  ],
  "architecture_pattern": "Brief description of the overall architecture pattern",
  "recommendations": [
    "Recommendations for improvement"
  ]
}}
```

IMPORTANT:
- Output ONLY the JSON object inside a ```json code block
- Use realistic monthly cost estimates in USD
- The "from"/"to" in connections are zero-based indices into the detected_components array
- Set complexity based on component count: low (1-3), medium (4-8), high (9+)
"""


class ImageAnalysisAgent:
    """Hybrid agent: Claude Vision (image-to-text) + GitLab Duo (analysis)."""

    def __init__(self, model: Optional[str] = None, api_key: Optional[str] = None):
        self.model = model or os.getenv('ANTHROPIC_MODEL', 'claude-opus-4-6')
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for image vision")
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.duo = get_duo_client()

    def analyze_architecture_diagram(
        self,
        image_base64: str,
        image_format: str = 'png'
    ) -> Dict:
        try:
            # ─── Step 1: Vision extraction (Anthropic — image-to-text only) ───
            logger.info("🔍 Step 1/2: Extracting components via Claude Vision (image → text)...")
            vision_text = self._extract_components_from_image(image_base64, image_format)
            logger.info(f"✅ Vision extraction complete: {len(vision_text)} chars")
            logger.info(f"   Vision output preview: {vision_text[:200]}...")

            # ─── Step 2: Analysis via GitLab Duo Agent Platform ───
            logger.info("🤖 Step 2/2: Analyzing architecture via GitLab Duo Agent Platform...")
            analysis_prompt = _DUO_ANALYSIS_PROMPT.format(vision_text=vision_text)
            duo_response = self.duo.ask(analysis_prompt)
            logger.info(f"✅ Duo analysis complete: {len(duo_response)} chars")

            analysis_data = self._parse_analysis_response(duo_response)
            return analysis_data

        except Exception as e:
            logger.error(f"❌ Error analyzing diagram: {e}")
            raise

    def _extract_components_from_image(self, image_base64: str, image_format: str) -> str:
        """Step 1: Minimal Claude Vision call — only extracts text description."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            temperature=0.2,
            timeout=60.0,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": f"image/{image_format}",
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": _VISION_PROMPT},
                ],
            }],
        )
        return message.content[0].text if message.content else ""

    def _parse_analysis_response(self, response_text: str) -> Dict:
        """Parse the Duo analysis JSON response."""
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
