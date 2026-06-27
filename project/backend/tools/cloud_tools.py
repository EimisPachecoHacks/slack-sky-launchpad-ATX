"""Custom tools for Strands Agent - Cloud Architecture Functions"""

from strands import tool
from typing import Dict, List, Optional
import json


# AWS Service Database (simplified for demo)
AWS_SERVICES = {
    "compute": {
        "ec2": {"name": "EC2", "base_cost": 29.2, "description": "Virtual servers"},
        "lambda": {"name": "Lambda", "base_cost": 8.3, "description": "Serverless compute"},
        "ecs": {"name": "ECS", "base_cost": 45.0, "description": "Container orchestration"},
    },
    "storage": {
        "s3": {"name": "S3", "base_cost": 12.5, "description": "Object storage"},
        "ebs": {"name": "EBS", "base_cost": 20.0, "description": "Block storage"},
        "efs": {"name": "EFS", "base_cost": 35.0, "description": "File storage"},
    },
    "database": {
        "rds": {"name": "RDS", "base_cost": 45.8, "description": "Relational database"},
        "dynamodb": {"name": "DynamoDB", "base_cost": 25.0, "description": "NoSQL database"},
        "aurora": {"name": "Aurora", "base_cost": 55.0, "description": "High-performance RDS"},
    },
    "network": {
        "alb": {"name": "Application Load Balancer", "base_cost": 18.0, "description": "Load balancing"},
        "cloudfront": {"name": "CloudFront", "base_cost": 15.0, "description": "CDN"},
        "vpc": {"name": "VPC", "base_cost": 0.0, "description": "Virtual private cloud"},
    }
}


@tool
def get_aws_service_info(service_category: str, service_name: str) -> str:
    """
    Get detailed information about an AWS service.

    Args:
        service_category: Category like 'compute', 'storage', 'database', 'network'
        service_name: Service name like 'ec2', 's3', 'rds', 'lambda'

    Returns:
        JSON string with service information including cost and description
    """
    category = service_category.lower()
    service = service_name.lower()

    if category in AWS_SERVICES and service in AWS_SERVICES[category]:
        service_info = AWS_SERVICES[category][service]
        return json.dumps({
            "service": service_name,
            "category": category,
            "name": service_info["name"],
            "cost": service_info["base_cost"],
            "description": service_info["description"],
            "provider": "aws"
        })

    return json.dumps({"error": f"Service {service_name} not found in category {service_category}"})


@tool
def calculate_architecture_cost(services: str) -> str:
    """
    Calculate the total monthly cost for a list of AWS services.

    Args:
        services: JSON string of services array, e.g., '[{"category": "compute", "service": "ec2", "quantity": 2}]'

    Returns:
        JSON string with total cost and breakdown
    """
    try:
        services_list = json.loads(services)
        total_cost = 0
        breakdown = []

        for svc in services_list:
            category = svc.get("category", "").lower()
            service = svc.get("service", "").lower()
            quantity = svc.get("quantity", 1)

            if category in AWS_SERVICES and service in AWS_SERVICES[category]:
                base_cost = AWS_SERVICES[category][service]["base_cost"]
                item_cost = base_cost * quantity
                total_cost += item_cost

                breakdown.append({
                    "service": AWS_SERVICES[category][service]["name"],
                    "quantity": quantity,
                    "unit_cost": base_cost,
                    "total_cost": item_cost
                })

        return json.dumps({
            "total_monthly_cost": round(total_cost, 2),
            "breakdown": breakdown,
            "currency": "USD"
        })

    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
def suggest_cost_optimization(current_service: str, category: str, usage_pattern: str) -> str:
    """
    Suggest cost-optimized alternatives for a service based on usage patterns.

    Args:
        current_service: Current AWS service name
        category: Service category
        usage_pattern: Usage pattern like 'low', 'medium', 'high', 'variable'

    Returns:
        JSON string with optimization suggestions
    """
    optimizations = {
        "compute": {
            "ec2": {
                "low": {"alternative": "lambda", "savings": "60%", "reason": "Serverless for low usage"},
                "variable": {"alternative": "spot_instances", "savings": "70%", "reason": "Use spot instances for variable workloads"},
            },
            "lambda": {
                "high": {"alternative": "ec2", "savings": "40%", "reason": "EC2 more cost-effective for constant high usage"},
            }
        },
        "database": {
            "rds": {
                "low": {"alternative": "aurora_serverless", "savings": "50%", "reason": "Aurora Serverless scales to zero"},
                "variable": {"alternative": "aurora_serverless", "savings": "45%", "reason": "Auto-scaling for variable loads"},
            }
        },
        "storage": {
            "s3": {
                "low": {"alternative": "s3_glacier", "savings": "80%", "reason": "Use Glacier for infrequent access"},
            }
        }
    }

    service = current_service.lower()
    cat = category.lower()
    pattern = usage_pattern.lower()

    if cat in optimizations and service in optimizations[cat]:
        if pattern in optimizations[cat][service]:
            opt = optimizations[cat][service][pattern]
            return json.dumps({
                "current_service": current_service,
                "suggested_alternative": opt["alternative"],
                "estimated_savings": opt["savings"],
                "reason": opt["reason"],
                "usage_pattern": usage_pattern
            })

    return json.dumps({
        "message": "No specific optimization found for this combination",
        "general_tip": "Consider reserved instances for predictable workloads"
    })


@tool
def get_service_alternatives(service_name: str, provider: str) -> str:
    """
    Get alternative services from different cloud providers.

    Args:
        service_name: Service name (e.g., 'EC2', 'S3', 'RDS')
        provider: Target provider ('aws', 'azure', 'gcp')

    Returns:
        JSON string with equivalent services across providers
    """
    service_mappings = {
        "ec2": {
            "aws": "EC2",
            "azure": "Virtual Machines",
            "gcp": "Compute Engine"
        },
        "s3": {
            "aws": "S3",
            "azure": "Blob Storage",
            "gcp": "Cloud Storage"
        },
        "rds": {
            "aws": "RDS",
            "azure": "Azure SQL Database",
            "gcp": "Cloud SQL"
        },
        "lambda": {
            "aws": "Lambda",
            "azure": "Azure Functions",
            "gcp": "Cloud Functions"
        }
    }

    service = service_name.lower().replace(" ", "")
    prov = provider.lower()

    # Try to find the service
    for key, mappings in service_mappings.items():
        if key in service or service in mappings.values():
            return json.dumps({
                "service_category": key,
                "alternatives": {
                    "aws": mappings.get("aws"),
                    "azure": mappings.get("azure"),
                    "gcp": mappings.get("gcp")
                },
                "requested_provider": provider
            })

    return json.dumps({"error": f"Service {service_name} not found in mappings"})


@tool
def validate_architecture(architecture_description: str) -> str:
    """
    Validate an architecture design for common issues and best practices.

    Args:
        architecture_description: Description of the architecture with services and connections

    Returns:
        JSON string with validation results and recommendations
    """
    issues = []
    recommendations = []

    arch_lower = architecture_description.lower()

    # Check for common issues
    if "database" in arch_lower and "backup" not in arch_lower:
        issues.append("No backup strategy mentioned for database")
        recommendations.append("Implement automated backups with point-in-time recovery")

    if ("ec2" in arch_lower or "vm" in arch_lower) and "autoscaling" not in arch_lower:
        issues.append("No auto-scaling configuration mentioned")
        recommendations.append("Configure auto-scaling groups for better availability")

    if "load balancer" not in arch_lower and "alb" not in arch_lower and ("web" in arch_lower or "api" in arch_lower):
        issues.append("No load balancer detected for web/API services")
        recommendations.append("Add a load balancer for high availability")

    if "cdn" not in arch_lower and "cloudfront" not in arch_lower and ("static" in arch_lower or "web" in arch_lower):
        recommendations.append("Consider adding CDN for better performance")

    if "monitoring" not in arch_lower:
        recommendations.append("Add monitoring solution (CloudWatch, Datadog, etc.)")

    return json.dumps({
        "validation_passed": len(issues) == 0,
        "issues": issues,
        "recommendations": recommendations,
        "best_practices_score": max(0, 100 - (len(issues) * 15) - (len(recommendations) * 5))
    })
