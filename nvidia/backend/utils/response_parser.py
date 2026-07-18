"""
Response Parser for Qwen architecture JSON responses
Extracts JSON structure and markdown reasoning from hybrid responses
"""

import json
import re
from typing import Dict, Any, Optional, Tuple


def extract_json_from_response(response: str) -> Optional[Dict[str, Any]]:
    """
    Extract JSON block from the model's response

    Args:
        response: Raw model response containing JSON and markdown

    Returns:
        Parsed JSON dict or None if not found
    """
    # Try to find JSON block in markdown code fence
    json_pattern = r'```json\s*(\{.*?\})\s*```'
    match = re.search(json_pattern, response, re.DOTALL)

    if match:
        try:
            json_str = match.group(1)
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return None

    # Try to find raw JSON object
    json_pattern_raw = r'\{[\s\S]*"architecture"[\s\S]*\}'
    match = re.search(json_pattern_raw, response)

    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def extract_markdown_reasoning(response: str) -> str:
    """
    Extract markdown reasoning from response (everything after JSON block)

    Args:
        response: Raw model response

    Returns:
        Markdown reasoning text
    """
    # Remove JSON block
    json_pattern = r'```json\s*\{.*?\}\s*```'
    reasoning = re.sub(json_pattern, '', response, flags=re.DOTALL)

    return reasoning.strip()


def parse_architecture_response(response: str) -> Tuple[Optional[Dict], str]:
    """
    Parse the model's hybrid response into JSON structure and markdown reasoning

    Args:
        response: Raw model response

    Returns:
        Tuple of (architecture_json, markdown_reasoning)
    """
    architecture_json = extract_json_from_response(response)
    markdown_reasoning = extract_markdown_reasoning(response)

    return architecture_json, markdown_reasoning


def transform_to_ui_format(architecture_json: Dict[str, Any], provider: str) -> Dict[str, Any]:
    """
    Transform the architecture JSON to Sky Launchpad UI format

    Args:
        architecture_json: Parsed architecture JSON
        provider: Cloud provider (aws, azure, gcp)

    Returns:
        Architecture dict in UI format
    """
    arch = architecture_json.get('architecture', {})
    services = arch.get('services', [])
    connections = arch.get('connections', [])
    alternatives = arch.get('alternatives', [])

    # Transform services to components
    components = []
    for idx, service in enumerate(services):
        components.append({
            'id': service.get('id', f'comp-{idx+1}'),
            'name': service.get('name', 'Unknown Service'),
            'description': service.get('description', ''),
            'cost': service.get('cost', 0),
            'icon': get_service_icon(service.get('type', 'service')),
            'provider': provider
        })

    # Transform services to diagram nodes
    nodes = []
    for idx, service in enumerate(services):
        position = service.get('position', {})
        x = position.get('x', 300 + (idx % 2) * 300)
        y = position.get('y', 200 + (idx // 2) * 200)

        nodes.append({
            'id': service.get('id', f'node-{idx+1}'),
            'label': service.get('name', 'Unknown Service'),
            'subLabel': service.get('type', 'service').capitalize(),
            'icon': service.get('icon', 'server'),
            'cost': service.get('cost', 0),
            'description': service.get('description', ''),
            'x': x,
            'y': y,
            'width': 200,
            'height': 100,
            'isDragging': False,
            'type': service.get('type', 'service'),
            'provider': provider
        })

    # Transform connections to edges
    edges = []
    for idx, conn in enumerate(connections):
        edges.append({
            'id': f'edge-{idx+1}',
            'from': conn.get('from', ''),
            'to': conn.get('to', ''),
            'type': conn.get('type', 'Connection')
        })

    # Transform alternatives
    alt_components = []
    for idx, alt in enumerate(alternatives):
        alt_components.append({
            'id': f'alt-{idx+1}',
            'name': alt.get('alternative_name', 'Alternative'),
            'description': alt.get('description', ''),
            'cost': alt.get('cost', 0),
            'icon': 'server',
            'performance': alt.get('performance', 80),
            'originalComponentId': alt.get('service_id', '')
        })

    return {
        'id': f'arch-{hash(arch.get("title", "architecture")) % 10000}',
        'name': arch.get('title', 'Cloud Architecture'),
        'description': arch.get('description', ''),
        'provider': provider,
        'optimizationPreference': 'balanced',
        'components': components,
        'alternatives': alt_components,
        'diagram': {
            'nodes': nodes,
            'edges': edges,
            'viewport': {
                'zoom': 1,
                'pan': {'x': 0, 'y': 0},
                'bounds': {'x': 0, 'y': 0, 'width': 1200, 'height': 800}
            },
            'grid': {
                'size': 20,
                'enabled': True,
                'snapEnabled': False
            }
        }
    }


def get_service_icon(service_type: str) -> str:
    """
    Get emoji icon for service type

    Args:
        service_type: Type of service (compute, storage, database, etc.)

    Returns:
        Emoji icon
    """
    icons = {
        'compute': '💻',
        'storage': '💾',
        'database': '🗄️',
        'serverless': 'λ',
        'network': '🌐',
        'security': '🔒',
        'analytics': '📊',
        'ml': '🤖',
        'monitoring': '📈',
        'cdn': '🚀'
    }

    return icons.get(service_type.lower(), '⚙️')
