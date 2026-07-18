"""Pydantic models for API requests/responses"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class CloudProvider(str, Enum):
    """Supported cloud providers"""
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"
    ALICLOUD = "alicloud"


class ResourceType(str, Enum):
    """Cloud resource types"""
    COMPUTE = "compute"
    STORAGE = "storage"
    DATABASE = "database"
    NETWORK = "network"
    SECURITY = "security"
    SERVERLESS = "serverless"
    ANALYTICS = "analytics"
    ML = "ml"
    CONTAINER = "container"


class OptimizationGoal(str, Enum):
    """Optimization preferences"""
    COST = "cost"
    PERFORMANCE = "performance"
    BALANCED = "balanced"


# Request Models

class ArchitectureRequirement(BaseModel):
    """User's architecture requirements"""
    title: str = Field(..., description="Project title")
    description: str = Field(..., description="Project description")
    requirements: List[str] = Field(default=[], description="List of requirements (optional)")
    provider: CloudProvider = Field(..., description="Preferred cloud provider")
    optimization_goal: OptimizationGoal = Field(
        default=OptimizationGoal.BALANCED,
        description="Optimization preference"
    )
    budget: Optional[float] = Field(None, description="Monthly budget in USD")
    expected_users: Optional[int] = Field(None, description="Expected number of users")


class ComponentOptimizationRequest(BaseModel):
    """Request to optimize existing components"""
    provider: CloudProvider
    components: List[Dict[str, Any]] = Field(..., description="Current components")
    current_cost: float = Field(..., description="Current monthly cost")
    optimization_goal: OptimizationGoal


class DiagramAnalysisRequest(BaseModel):
    """Request to analyze architecture diagram"""
    provider: CloudProvider
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    requirements: Optional[str] = None


class ChatRequest(BaseModel):
    """Request for chat/Q&A with AI agent"""
    question: str = Field(..., min_length=1, max_length=2000, description="User question")
    context: Optional[str] = Field(None, max_length=5000, description="Additional context")
    architecture_id: Optional[str] = Field(None, description="Related architecture ID")


class CodeGenerationRequest(BaseModel):
    """Request to generate infrastructure code"""
    architecture: Dict[str, Any] = Field(..., description="Architecture definition")
    code_type: str = Field(..., description="Code type: terraform or cloudformation")
    provider: CloudProvider = Field(..., description="Cloud provider")


# Response Models

class CloudService(BaseModel):
    """Cloud service recommendation"""
    id: str
    name: str
    description: str
    service_type: ResourceType
    provider: CloudProvider
    cost_estimate: float = Field(..., description="Estimated monthly cost in USD")
    icon: str
    specifications: Optional[Dict[str, Any]] = None
    alternatives: Optional[List['CloudService']] = None


class ConnectionRecommendation(BaseModel):
    """Recommended connection between services"""
    from_service: str
    to_service: str
    connection_type: str
    description: str
    cost_estimate: Optional[float] = None


class ArchitectureRecommendation(BaseModel):
    """Complete architecture recommendation from AI agent"""
    architecture_id: str
    title: str
    description: str
    provider: CloudProvider
    services: List[CloudService]
    connections: List[ConnectionRecommendation]
    total_cost_estimate: float
    reasoning: str = Field(..., description="AI's reasoning for this architecture")
    best_practices: List[str]
    security_considerations: List[str]
    scalability_notes: str


class OptimizationSuggestion(BaseModel):
    """Cost or performance optimization suggestion"""
    suggestion_id: str
    type: str = Field(..., description="Type: cost, performance, security, etc.")
    title: str
    description: str
    impact: Dict[str, Any] = Field(..., description="Expected impact (cost savings, performance gain)")
    implementation_steps: List[str]
    priority: str = Field(..., description="low, medium, high")
    original_service: Optional[str] = None
    alternative_service: Optional[CloudService] = None


class AgentResponse(BaseModel):
    """Generic AI agent response"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[str]] = None
    reasoning: Optional[str] = None


class HealthCheck(BaseModel):
    """API health check response"""
    status: str
    version: str
    agent_ready: bool
    llm_connected: bool
    llm_provider: str
    model_id: str


# Allow forward references
CloudService.model_rebuild()
