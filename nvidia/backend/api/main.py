"""FastAPI Backend for Skyrchitect AI Agent - Secured Version"""

import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Security, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import logging

# Load environment variables FIRST
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
# Add repo root so the shared `skydb` data layer is importable from the backend.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

# Import configuration (validates env vars at startup)
from backend.config import settings, validate_configuration

# Import models
from backend.models.schemas import (
    ArchitectureRequirement,
    ComponentOptimizationRequest,
    DiagramAnalysisRequest,
    ChatRequest,
    CodeGenerationRequest,
    ArchitectureRecommendation,
    OptimizationSuggestion,
    AgentResponse,
    HealthCheck
)

# Import agents
from backend.agents.architecture_agent import get_architecture_agent, ArchitectureAgent
from backend.agents.image_analysis_agent import get_image_analysis_agent

# Import utilities
from backend.utils.response_parser import (
    parse_architecture_response,
    transform_to_ui_format
)
from backend.utils.image_processor import ImageProcessor
from backend.utils.pdf_converter import PDFConverter
from backend.utils.s3_storage import get_s3_storage

# Import security middleware
from backend.middleware.auth import (
    verify_authentication,
    require_authentication,
    optional_authentication,
    AuthenticationError
)
from backend.middleware.rate_limit import (
    RateLimitMiddleware,
    rate_limiter,
    check_rate_limit
)
from backend.middleware.file_validation import (
    validate_upload_file,
    sanitize_filename,
    FileValidationError
)

# Import FastAPI dependencies
from fastapi import UploadFile, File

# GitLab integration (optional git host for MRs)
import re
from backend.gitlab_client import GitLabClient
from backend.skills_loader import get_skills_context, get_skills_summary


def _strip_markdown_fences(text: str) -> str:
    """Remove markdown fences and extract HCL code from model responses."""
    blocks = re.findall(r'```(?:hcl|terraform|tf)?\s*\n(.*?)```', text, re.DOTALL)
    if blocks:
        return "\n\n".join(blocks).strip()
    text = re.sub(r'^```[a-zA-Z]*\s*\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n```\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^```\s*$', '', text, flags=re.MULTILINE)
    return text.strip()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Validate configuration at startup
try:
    validate_configuration()
except Exception as e:
    logger.critical(f"Configuration validation failed: {e}")
    raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("🚀 Starting Sky Launchpad AI Backend...")

    try:
        # Initialize agent
        agent = get_architecture_agent()
        logger.info("✅ Architecture Agent initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize agent: {e}")
        logger.warning("   Agent will be initialized on first request")

    # GitLab integration (optional git host for MRs)
    gitlab_token = os.getenv("GITLAB_TOKEN", "")
    gitlab_project = os.getenv("GITLAB_PROJECT_PATH", "")
    if gitlab_token and gitlab_project:
        logger.info(f"🔗 GitLab: {gitlab_project}")
        skills = get_skills_summary()
        loaded = [s["name"] for s in skills if s["loaded"]]
        logger.info(f"📚 Skills loaded: {', '.join(loaded)}")
    else:
        logger.warning("⚠️  GitLab integration not configured (GITLAB_TOKEN / GITLAB_PROJECT_PATH)")

    yield

    # Shutdown
    logger.info("👋 Shutting down Skyrchitect AI Backend")


# Create FastAPI app
app = FastAPI(
    title="Sky Launchpad AI Backend - Secured",
    description="AI-powered cloud architecture design and optimization API using Qwen models on Qwen Cloud",
    version="1.0.0",
    lifespan=lifespan,
    # Disable docs in production
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# Configure CORS - Secure configuration
cors_origins = settings.get_cors_origins()
logger.info(f"🔒 CORS Origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # ✅ No wildcards - specific domains only
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # ✅ Specific methods
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Request-ID",
    ],  # ✅ Specific headers only
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset"
    ],
)

# Add rate limiting middleware (if enabled)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware, limiter=rate_limiter)
    logger.info(f"🔒 Rate Limiting: {settings.RATE_LIMIT_PER_MINUTE} req/min")

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    # Remove server header (if present)
    try:
        del response.headers["Server"]
    except KeyError:
        pass

    return response

# Global exception handlers
@app.exception_handler(AuthenticationError)
async def authentication_error_handler(request: Request, exc: AuthenticationError):
    """Handle authentication errors"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers or {}
    )

@app.exception_handler(FileValidationError)
async def file_validation_error_handler(request: Request, exc: FileValidationError):
    """Handle file validation errors"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


# ── Sky Launchpad: observability (Pydantic Logfire) ───────────────────────────
# Auto-instruments FastAPI + httpx so every request and every Qwen / embedding
# call is traced. Ships to the Logfire UI when LOGFIRE_TOKEN is set; otherwise
# instruments locally without erroring.
try:
    from backend.observability import configure_observability
    configure_observability(app)
except Exception as _obs_exc:  # never block startup on observability
    logger.warning(f"Observability not configured: {_obs_exc}")


# ── Sky Launchpad: self-improvement loop surface ──────────────────────────────
# Real-time text narration of the deploy / learn-on-failure loop over a WebSocket.
try:
    from backend.narration import router as live_router
    app.include_router(live_router)
    logger.info("📡 Narration router mounted at /api/live/*")
except Exception as _live_exc:  # never block startup on the optional narration layer
    logger.warning(f"Narration router not mounted: {_live_exc}")

# Autonomous UI self-test (Playwright-driven).
try:
    from backend.uitest.api import router as uitest_router
    app.include_router(uitest_router)
    logger.info("🧪 UI self-test router mounted at /api/uitest/*")
except Exception as _uitest_exc:
    logger.warning(f"UI self-test router not mounted: {_uitest_exc}")

# Deployed-apps dashboard (status, test coverage, error→solution).
try:
    from backend.apps_api import router as apps_router
    app.include_router(apps_router)
    logger.info("📦 Apps dashboard router mounted at /api/apps/*")
except Exception as _apps_exc:
    logger.warning(f"Apps dashboard router not mounted: {_apps_exc}")


@app.get("/api/skills/learned")
async def list_learned_skills_endpoint():
    """Return skills auto-authored by the self-improvement loop after past failures.

    Powers the small "learned skills" panel in the UI — the Continual Learning
    evidence that the system improves the more it is used.
    """
    import json
    from backend.skills_loader import load_learned_skills, _SKILLS_DIR

    index_path = _SKILLS_DIR / "learned" / "_index.json"
    entries: list = []
    if index_path.exists():
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                entries = list(data.values())
            elif isinstance(data, list):
                entries = data
        except (OSError, ValueError):
            entries = []
    if not entries:  # fall back to listing the SKILL.md folders directly
        entries = [
            {"slug": slug, "name": slug, "description": "", "hit_count": 0}
            for slug in load_learned_skills().keys()
        ]
    total_hits = sum(int(e.get("hit_count", 0) or 0) for e in entries)
    return {
        "count": len(entries),
        "total_retries_avoided": total_hits,
        "skills": entries,
    }


@app.get("/api/learning/summary")
async def learning_summary():
    """Learning-dashboard payload: KPIs, before/after, error→solution table, timeline.

    Powers the (secondary) learning panel on the deploy page — evidence that the
    self-improving loop gets better with use. Returns labeled sample data when no
    real deploys have run yet.
    """
    from backend.learning import build_summary
    return build_summary()


# Dependency to get agent
def get_agent() -> ArchitectureAgent:
    """Dependency to get architecture agent"""
    try:
        return get_architecture_agent()
    except Exception as e:
        logger.error(f"Failed to get agent: {e}")
        raise HTTPException(status_code=503, detail="AI Agent not available. Please check your LLM_PROVIDER configuration.")


# Health check endpoint
@app.get("/", response_model=HealthCheck)
async def root():
    """API root and health check"""
    from backend import llm_client

    try:
        agent = get_architecture_agent()
        agent_ready = True
        llm_connected = True
    except Exception:
        agent_ready = False
        llm_connected = False

    return HealthCheck(
        status="healthy" if agent_ready else "degraded",
        version="1.0.0",
        agent_ready=agent_ready,
        llm_connected=llm_connected,
        llm_provider=llm_client._provider(),
        model_id=llm_client._resolve("LLM_MODEL"),
    )


@app.get("/health")
async def health_check():
    """Simple health check"""
    return {"status": "ok", "service": "Skyrchitect AI Backend"}


# AI Agent Endpoints

@app.post(
    "/api/architecture/generate",
    response_model=AgentResponse,
    dependencies=[Depends(check_rate_limit)]
)
async def generate_architecture(
    req: ArchitectureRequirement,
    agent: ArchitectureAgent = Depends(get_agent),
    auth_context: dict = Security(optional_authentication)
):
    """
    Generate cloud architecture based on requirements using AI agent
    """
    try:
        logger.info(f"\n{'='*80}")
        logger.info(f"📝 ARCHITECTURE GENERATION REQUEST")
        logger.info(f"{'='*80}")
        logger.info(f"Title: {req.title}")
        logger.info(f"Provider: {req.provider.value}")
        logger.info(f"Optimization Goal: {req.optimization_goal.value}")

        # Format requirements for agent
        requirements_text = f"""
Title: {req.title}
Description: {req.description}
Cloud Provider: {req.provider.value}
Optimization Goal: {req.optimization_goal.value}
"""

        # Add requirements only if they exist and are not empty
        if req.requirements and len(req.requirements) > 0:
            requirements_text += f"""
Requirements:
{chr(10).join(f"- {r}" for r in req.requirements)}
"""

        if req.budget:
            requirements_text += f"\nBudget: ${req.budget}/month"

        if req.expected_users:
            requirements_text += f"\nExpected Users: {req.expected_users:,}"

        logger.info(f"\n📤 Sending to AI:\n{requirements_text}")

        # Get agent recommendation
        response = agent.generate_architecture(requirements_text)

        logger.info(f"\n📥 AI Response received (length: {len(str(response))} chars)")
        logger.info(f"📥 Response preview (first 500 chars):\n{str(response)[:500]}")
        logger.info(f"{'='*80}\n")

        # Parse hybrid response (JSON + markdown)
        architecture_json, markdown_reasoning = parse_architecture_response(str(response))

        if not architecture_json:
            resp_str = str(response)
            has_json_fence = "```json" in resp_str
            has_arch_key = '"architecture"' in resp_str
            logger.error("❌ JSON EXTRACTION FAILED from AI response")
            logger.error(f"   Response length: {len(resp_str)} chars")
            logger.error(f"   Contains ```json block: {has_json_fence}")
            logger.error(f"   Contains 'architecture' key: {has_arch_key}")
            logger.error(f"   First 200 chars: {resp_str[:200]}")
            logger.error(f"   Last 200 chars: {resp_str[-200:]}")

        if architecture_json:
            logger.info(f"📊 Parsed Architecture JSON:")
            logger.info(f"   - Services: {len(architecture_json.get('architecture', {}).get('services', []))}")
            logger.info(f"   - Connections: {len(architecture_json.get('architecture', {}).get('connections', []))}")
            logger.info(f"   - Total Cost: ${architecture_json.get('architecture', {}).get('total_cost', 0)}/mo")

            # Transform to UI format
            ui_architecture = transform_to_ui_format(architecture_json, req.provider.value)

            # =============================================================
            # AUTOPILOT STAGE 1: Requirements Analyzer
            # Creates a GitLab issue to track this architecture request
            # =============================================================
            logger.info(f"\n{'─'*60}")
            logger.info(f"🤖 AUTOPILOT STAGE 1: Requirements Analyzer")
            logger.info(f"{'─'*60}")
            logger.info(f"   Action: create_issue (GitLab API)")
            logger.info(f"   Project: {os.getenv('GITLAB_PROJECT_PATH', 'N/A')}")

            gitlab_issue_iid = None
            gitlab_issue_url = None
            try:
                gl = GitLabClient()
                if gl.token:
                    services = architecture_json.get('architecture', {}).get('services', [])
                    svc_list = "\n".join(f"- {s.get('name', '')}: {s.get('description', '')}" for s in services[:20])

                    logger.info(f"   INPUT → title: [Skyrchitect] {req.title}")
                    logger.info(f"   INPUT → provider: {req.provider.value.upper()}")
                    logger.info(f"   INPUT → services count: {len(services)}")
                    logger.info(f"   INPUT → optimization: {req.optimization_goal.value}")

                    issue_body = (
                        f"## Architecture: {req.title}\n\n"
                        f"**Provider:** {req.provider.value.upper()}\n"
                        f"**Optimization:** {req.optimization_goal.value}\n\n"
                        f"### Description\n{req.description}\n\n"
                        f"### Services\n{svc_list}\n\n"
                        "---\n"
                        "_Created by Sky Launchpad using Qwen Cloud; tracked in GitLab._"
                    )
                    issue_result = gl.create_issue(
                        title=f"[Skyrchitect] {req.title}",
                        description=issue_body,
                    )
                    gitlab_issue_iid = issue_result.get("iid")
                    gitlab_issue_url = issue_result.get("web_url")
                    if gitlab_issue_iid:
                        logger.info(f"   OUTPUT ← issue_iid: #{gitlab_issue_iid}")
                        logger.info(f"   OUTPUT ← issue_url: {gitlab_issue_url}")
                        logger.info(f"   ✅ Requirements Analyzer: issue created successfully")
                        ui_architecture["gitlab_issue_iid"] = gitlab_issue_iid
                        ui_architecture["gitlab_issue_url"] = gitlab_issue_url
                    else:
                        logger.warning(f"   ⚠️ Issue created but no IID returned: {issue_result}")
                else:
                    logger.warning(f"   ⚠️ GitLab token not configured — skipping issue creation")
            except Exception as gl_err:
                logger.warning(f"   ⚠️ Requirements Analyzer failed: {gl_err}")
            logger.info(f"{'─'*60}\n")

            return AgentResponse(
                success=True,
                message="Architecture generated successfully",
                data=ui_architecture,
                reasoning=markdown_reasoning
            )
        else:
            logger.error("❌ FALLBACK: Could not extract JSON from AI response — UI will fail")
            logger.error(f"   Raw response (first 500): {str(response)[:500]}")
            error_hint = ""
            resp_lower = str(response).lower()
            if "credit" in resp_lower or "403" in resp_lower:
                error_hint = " (Qwen Cloud quota or credentials may need attention)"
            elif len(str(response)) < 50:
                error_hint = " (response too short — AI may have returned an error)"
            raise HTTPException(
                status_code=502,
                detail=f"AI response did not contain valid architecture JSON{error_hint}. "
                       f"Response preview: {str(response)[:300]}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Architecture generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/architecture/optimize", response_model=AgentResponse)
async def optimize_architecture(
    req: ComponentOptimizationRequest,
    agent: ArchitectureAgent = Depends(get_agent)
):
    """
    Optimize existing architecture for cost or performance
    """
    try:
        logger.info(f"Optimizing architecture (goal: {req.optimization_goal.value})")

        # Format current architecture
        arch_description = f"""
Provider: {req.provider.value}
Current Monthly Cost: ${req.current_cost}
Optimization Goal: {req.optimization_goal.value}

Current Components:
{chr(10).join(f"- {c}" for c in req.components)}
"""

        # Get optimization recommendations
        response = agent.optimize_architecture(
            arch_description,
            req.optimization_goal.value
        )

        logger.info("✅ Optimization completed")

        return AgentResponse(
            success=True,
            message="Optimization recommendations generated",
            data={
                "optimizations": str(response),
                "current_cost": req.current_cost,
                "goal": req.optimization_goal.value
            },
            reasoning=str(response)
        )

    except Exception as e:
        logger.error(f"Error optimizing architecture: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/architecture/validate", response_model=AgentResponse)
async def validate_architecture(
    req: DiagramAnalysisRequest,
    agent: ArchitectureAgent = Depends(get_agent)
):
    """
    Validate architecture design and provide best practice recommendations
    """
    try:
        logger.info("Validating architecture design")

        # Format architecture for validation
        arch_description = f"""
Provider: {req.provider.value}

Services:
{chr(10).join(f"- {node}" for node in req.nodes)}

Connections:
{chr(10).join(f"- {edge}" for edge in req.edges)}
"""

        if req.requirements:
            arch_description += f"\nRequirements: {req.requirements}"

        # Validate with agent
        response = agent.validate_design(arch_description)

        logger.info("✅ Validation completed")

        return AgentResponse(
            success=True,
            message="Architecture validated",
            data={"validation": str(response)},
            reasoning=str(response)
        )

    except Exception as e:
        logger.error(f"Error validating architecture: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cloud/compare/{service_name}", response_model=AgentResponse)
async def compare_cloud_services(
    service_name: str,
    agent: ArchitectureAgent = Depends(get_agent)
):
    """
    Compare a service across AWS, Azure, and GCP
    """
    try:
        logger.info(f"Comparing service: {service_name}")

        response = agent.compare_providers(service_name)

        return AgentResponse(
            success=True,
            message=f"Comparison for {service_name}",
            data={"comparison": str(response)},
            reasoning=str(response)
        )

    except Exception as e:
        logger.error(f"Error comparing services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/chat",
    response_model=AgentResponse,
    dependencies=[Depends(check_rate_limit)]
)
async def chat_with_agent(
    request: ChatRequest,  # ✅ Now using Pydantic validation
    agent: ArchitectureAgent = Depends(get_agent),
    auth_context: dict = Security(optional_authentication)
):
    """
    Ask the AI agent a question about cloud architecture

    **Authentication**: Optional (works with or without auth)
    **Rate Limit**: Yes
    """
    try:
        logger.info(f"Chat question from {auth_context.get('mode', 'anonymous')}: {request.question[:50]}...")

        response = agent.answer_question(request.question, request.context)

        return AgentResponse(
            success=True,
            message="Response from AI agent",
            data={"answer": str(response)},
            reasoning=str(response)
        )

    except Exception as e:
        logger.error(f"Error in chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to process question. Please try again."
        )


@app.post(
    "/api/code/generate",
    response_model=AgentResponse,
    dependencies=[Depends(check_rate_limit)]
)
async def generate_infrastructure_code(
    request: CodeGenerationRequest,  # ✅ Now using Pydantic validation
    auth_context: dict = Security(optional_authentication)
):
    """
    Generate Infrastructure as Code (Terraform or CloudFormation) based on architecture

    **Authentication**: Optional
    **Rate Limit**: Yes
    """
    try:
        from backend import llm_client

        architecture = request.architecture
        code_type = request.code_type
        provider = request.provider.value

        logger.info(f"\n{'='*80}")
        logger.info(f"💻 CODE GENERATION REQUEST — via Qwen (IaC Generator)")
        logger.info(f"{'='*80}")
        logger.info(f"Code Type: {code_type.upper()}")
        logger.info(f"Provider: {provider}")

        components = architecture.get('components', [])
        num_components = len(components)
        logger.info(f"Components: {num_components}")

        # =============================================================
        # IaC Generator — Qwen (qwen3.7-max) writes the Terraform.
        # Learned skills from past deploy failures are injected as context so
        # code generation benefits from the self-improving memory loop.
        # =============================================================
        logger.info(f"\n{'─'*60}")
        logger.info(f"🤖 IaC Generator (Qwen)")
        logger.info(f"{'─'*60}")

        skills_summary = get_skills_summary()
        for skill in skills_summary:
            status = "✅ AVAILABLE" if skill["loaded"] else "❌ MISSING"
            logger.info(f"   SKILL: {skill['name']} → {status}")

        learned_context = ""
        try:
            from deployer.skill_library import get_learned_skills_context
            learned_context = get_learned_skills_context(query=f"{provider} {code_type}") or ""
        except Exception as exc:  # skills are best-effort context, never fatal
            logger.info(f"   (learned-skills context unavailable: {exc})")
        logger.info(f"{'─'*60}")

        code_system = (
            "You are an expert infrastructure engineer. You output ONLY valid, "
            "syntactically complete Terraform/IaC code — no prose, no markdown "
            "fences, no explanations. Every block closes all its braces.\n\n"
            + (f"Learned skills from past deployment failures (apply them to avoid "
               f"repeating mistakes):\n{learned_context}\n\n" if learned_context else "")
        )
        provider_override = (
            f"The user selected {provider.upper()} as their cloud provider for this architecture. "
            f"Generate {provider.upper()} Terraform resources (provider: {provider}). "
            f"Output the complete Terraform code as TEXT only.\n\n"
        )

        def generate_via_qwen(prompt: str, label: str) -> str:
            """Generate IaC via Qwen (qwen3.7-max)."""
            full = provider_override + prompt
            logger.info(f"   📡 Sending to Qwen: {label} ({len(full)} chars)")
            response = llm_client.chat(full, system=code_system, kind="code", max_tokens=8000)
            code = _strip_markdown_fences(response)
            logger.info(f"   ✅ {label}: received {len(code)} chars from Qwen")
            return code

        if num_components > 6:
            chunk_size = 4
            groups = [components[i:i+chunk_size] for i in range(0, num_components, chunk_size)]
            num_parts = len(groups) + 1
            logger.info(f"🔄 Using {num_parts}-part Qwen generation for {num_components} components")

            all_parts = []

            for idx, group in enumerate(groups):
                part_num = idx + 1
                group_desc = "\n".join([f"- {c.get('name', 'Unknown')}: {c.get('description', '')}" for c in group])

                if idx == 0:
                    prompt = f"""Generate PART {part_num} of production-ready {code_type.upper()} code for {provider.upper()}.

IMPORTANT: The target provider is {provider.upper()}, NOT GCP. Generate {provider.upper()} resources.

Architecture: {architecture.get('name', 'Cloud Architecture')}

This part covers CORE INFRASTRUCTURE + these {len(group)} services:
{group_desc}

Generate:
- terraform/provider configuration block with required_providers for {provider}
- All input variables (region, project_name, environment, etc.)
- VPC, subnets, security groups, IAM roles
- Complete resource definitions for the {len(group)} services above

CRITICAL RULES:
- Output ONLY valid {code_type} code — no markdown fences, no explanations
- Every resource block must be syntactically complete (all braces closed)
- This is part {part_num} of {num_parts} — more resources follow in later parts"""
                else:
                    prompt = f"""Generate PART {part_num} of production-ready {code_type.upper()} code for {provider.upper()}.

Architecture: {architecture.get('name', 'Cloud Architecture')}

This part covers these {len(group)} services:
{group_desc}

Generate ONLY the resource definitions for the services listed above.
Reference resources from earlier parts (e.g. vpc_id, subnet ids, IAM roles).

CRITICAL RULES:
- Output ONLY valid {code_type} resource blocks — no markdown fences, no explanations
- Do NOT repeat provider, variable, or VPC blocks (already generated)
- Every resource block must be syntactically complete (all braces closed)
- This is part {part_num} of {num_parts}"""

                logger.info(f"📝 Generating Part {part_num}/{num_parts}: {len(group)} services via Qwen...")
                part_code = generate_via_qwen(prompt, f"Part {part_num}/{num_parts}")
                all_parts.append(part_code)

            logger.info(f"📝 Generating Part {num_parts}/{num_parts}: Outputs via Qwen...")
            outputs_prompt = f"""Generate the OUTPUTS section of {code_type.upper()} code for {provider.upper()}.

Architecture: {architecture.get('name', 'Cloud Architecture')} with {num_components} services.
All resource blocks have been defined in previous parts.

Generate ONLY terraform output blocks for key values (endpoints, ARNs, IPs, URLs, IDs).

CRITICAL RULES:
- Output ONLY valid {code_type} output blocks — no markdown fences, no explanations
- Every output block must be syntactically complete
- Reference resources that would exist from the services: {', '.join(c.get('name','') for c in components)}"""

            outputs_code = generate_via_qwen(outputs_prompt, f"Part {num_parts}/{num_parts} (outputs)")
            all_parts.append(outputs_code)

            code_response = "\n\n".join(all_parts)
            part_sizes = " | ".join([f"Part {i+1}: {len(p)} chars" for i, p in enumerate(all_parts)])
            logger.info(f"✅ Multi-part Qwen generation complete ({len(code_response)} chars total)")
            logger.info(f"   {part_sizes}")

        else:
            logger.info(f"📝 Using single-part Qwen generation for {num_components} components")
            components_desc = "\n".join([
                f"- {comp.get('name', 'Unknown')}: {comp.get('description', '')}"
                for comp in components
            ])

            prompt = f"""Generate complete production-ready {code_type.upper()} code for this cloud architecture.

IMPORTANT: The target provider is {provider.upper()}, NOT GCP. Generate {provider.upper()} resources.

Provider: {provider}
Architecture: {architecture.get('name', 'Cloud Architecture')}

Components:
{components_desc}

Generate COMPLETE, working code with:
- Provider configuration and variables for {provider.upper()}
- VPC, networking, security groups
- All service resources
- Output variables for important endpoints

CRITICAL: Output ONLY valid {code_type} code. No markdown fences, no explanations.
Every block must be syntactically complete with all braces closed."""

            code_response = generate_via_qwen(prompt, "Single-part")

        logger.info(f"{'='*80}\n")

        skills_used = [s["name"] for s in get_skills_summary() if s["loaded"]]

        return AgentResponse(
            success=True,
            message=f"{code_type.capitalize()} code generated successfully via Qwen",
            data={
                "code": str(code_response),
                "code_type": code_type,
                "provider": architecture.get('provider', 'aws'),
                "skills_used": skills_used,
                "generator": "iac_generator",
                "model": "qwen3.7-max",
            },
            reasoning=str(code_response)
        )

    except Exception as e:
        logger.error(f"❌ Error generating code via Qwen: {e}")
        # Code generation runs on Qwen (qwen3.7-max). When it can't be reached —
        # missing/invalid DASHSCOPE_API_KEY or a transport error — surface a
        # clear message; the full error stays in the logs above.
        raw = str(e)
        low = raw.lower()
        if any(k in low for k in ("dashscope", "api key", "apikey", "401", "unauthorized")):
            detail = (
                "Code generation is unavailable: Qwen Cloud could not be reached. "
                "Check DASHSCOPE_API_KEY (and that its prefix matches the base URL). "
                "Architecture design uses the same key."
            )
        else:
            detail = f"Code generation failed: {raw}"
        raise HTTPException(status_code=500, detail=detail)


@app.post(
    "/api/architecture/analyze-image",
    response_model=AgentResponse,
    dependencies=[Depends(check_rate_limit)]
)
async def analyze_architecture_image(
    file: UploadFile = File(...),
    auth_context: dict = Security(optional_authentication)
):
    """
    Analyze uploaded architecture diagram image/PDF using AI vision

    **Authentication**: Optional
    **Rate Limit**: Yes
    **File Size Limit**: 10MB
    **Allowed Types**: PNG, JPG, JPEG, PDF
    """
    try:
        logger.info(f"📤 Received file upload from {auth_context.get('mode', 'anonymous')}: {file.filename}")

        # ✅ Validate file (extension, size, MIME type, polyglot detection)
        extension, mime_type, file_content = await validate_upload_file(file)

        # Sanitize filename
        safe_filename = sanitize_filename(file.filename)
        logger.info(f"✅ File validated: {safe_filename} ({mime_type})")

        # Determine file type and process
        is_pdf = extension == '.pdf'

        if is_pdf:
            # Validate and convert PDF
            is_valid, error_msg = PDFConverter.validate_pdf(file_content, file.filename)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)

            # Convert PDF to image
            image_bytes, pdf_error = PDFConverter.pdf_to_image(file_content)
            if pdf_error:
                raise HTTPException(status_code=400, detail=f"PDF conversion failed: {pdf_error}")

            content_type = 'image/png'
            processed_content = image_bytes

        else:
            # Validate image
            is_valid, error_msg = ImageProcessor.validate_image(file_content, file.filename)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)

            # Process image
            processed_bytes, img_error = ImageProcessor.process_image(file_content)
            if img_error:
                raise HTTPException(status_code=400, detail=f"Image processing failed: {img_error}")

            content_type = 'image/png'
            processed_content = processed_bytes

        # S3 is opt-in. The default local-storage configuration must not make
        # network calls or discover ambient AWS credentials during analysis.
        s3_url = None
        if settings.STORAGE_BACKEND.lower() == "s3":
            s3_storage = get_s3_storage()
            s3_url = s3_storage.upload_diagram(
                processed_content,
                file.filename,
                content_type=content_type,
                metadata={
                    'original_type': file.content_type,
                    'is_pdf': str(is_pdf)
                }
            )
            logger.info(f"✅ File backed up to S3: {s3_url}")
        else:
            logger.info("S3 backup skipped (STORAGE_BACKEND is not s3)")

        # Encode image for AI analysis
        image_base64 = ImageProcessor.encode_image_base64(processed_content)

        # Analyze with AI
        analysis_agent = get_image_analysis_agent()
        analysis_result = analysis_agent.analyze_architecture_diagram(
            image_base64,
            image_format='png'
        )

        # Add S3 backup URL to response
        analysis_result['s3_backup_url'] = s3_url
        analysis_result['original_filename'] = file.filename

        # Transform detected components to UI format
        RESOURCE_TYPE_MAP = {
            'streaming_ingestion': 'serverless', 'streaming': 'serverless',
            'etl': 'serverless', 'data_catalog': 'database',
            'object_storage': 'storage', 'file_transfer': 'network',
            'transfer': 'network', 'function': 'serverless',
            'workflow': 'serverless', 'analytics': 'analytics',
            'visualization': 'analytics', 'machine_learning': 'ml',
            'security': 'security', 'monitoring': 'security',
            'compute': 'compute', 'serverless': 'serverless',
            'database': 'database', 'storage': 'storage',
            'network': 'network', 'ml': 'ml', 'container': 'container',
        }
        ICON_MAP = {
            'streaming_ingestion': 'zap', 'streaming': 'zap', 'etl': 'settings',
            'data_catalog': 'book-open', 'object_storage': 'hard-drive',
            'file_transfer': 'upload', 'transfer': 'upload',
            'function': 'git-branch', 'workflow': 'git-branch',
            'analytics': 'bar-chart-2', 'visualization': 'pie-chart',
            'machine_learning': 'cpu', 'security': 'shield',
            'monitoring': 'activity', 'compute': 'server',
            'serverless': 'cloud', 'database': 'database',
            'storage': 'hard-drive', 'network': 'globe', 'ml': 'cpu',
        }

        components = []
        for idx, comp in enumerate(analysis_result.get('detected_components', [])):
            raw_type = comp.get('type', comp.get('category', 'serverless'))
            components.append({
                'id': f"{raw_type}-{idx+1}",
                'name': comp['service_name'],
                'category': comp.get('category', 'compute'),
                'type': RESOURCE_TYPE_MAP.get(raw_type, 'serverless'),
                'icon': ICON_MAP.get(raw_type, 'cloud'),
                'cost': comp.get('estimated_monthly_cost', 0),
                'description': f"{comp.get('description', '')} (Confidence: {comp['confidence']}%)",
                'confidence': comp['confidence'],
                'provider': analysis_result.get('provider', 'aws'),
            })

        # Generate diagram nodes with grid layout
        cols = 4
        gap_x, gap_y = 300, 220
        start_x, start_y = 100, 100
        diagram_nodes = []
        for idx, comp in enumerate(components):
            diagram_nodes.append({
                'id': comp['id'],
                'x': start_x + (idx % cols) * gap_x,
                'y': start_y + (idx // cols) * gap_y,
                'width': 240, 'height': 100,
                'label': comp['name'],
                'subLabel': f"${comp['cost']}/mo",
                'icon': comp.get('icon', 'cloud'),
                'cost': comp['cost'],
                'description': comp['description'],
                'isDragging': False,
                'type': comp['type'],
                'provider': comp.get('provider', 'aws'),
                'metadata': {'confidence': comp.get('confidence', 0)},
            })

        # Generate edges from analysis connections
        diagram_edges = []
        for eidx, conn in enumerate(analysis_result.get('connections', [])):
            from_idx = int(conn.get('from', 0))
            to_idx = int(conn.get('to', 0))
            if from_idx < len(components) and to_idx < len(components):
                diagram_edges.append({
                    'id': f"edge-{eidx}",
                    'from': components[from_idx]['id'],
                    'to': components[to_idx]['id'],
                    'type': 'API',
                    'label': conn.get('type', ''),
                })

        provider = analysis_result.get('provider', 'aws')
        now_str = datetime.now().isoformat() if 'datetime' in dir() else ''
        try:
            from datetime import datetime as _dt
            now_str = _dt.now().isoformat()
        except Exception:
            now_str = ''

        # Create UI-compatible architecture
        ui_architecture = {
            'id': f"analyzed-{file.filename.split('.')[0]}",
            'name': f"Analyzed: {file.filename}",
            'description': analysis_result.get('architecture_pattern', 'AI-analyzed from uploaded diagram'),
            'provider': provider,
            'components': components,
            'alternatives': [],
            'optimizationPreference': 'balanced',
            'estimated_cost': analysis_result.get('estimated_monthly_cost', 0),
            'complexity': analysis_result.get('complexity', 'medium'),
            's3_backup_url': s3_url,
            'metadata': {
                'totalCost': analysis_result.get('estimated_monthly_cost', 0),
                'estimatedPerformance': 85,
                'complexity': analysis_result.get('complexity', 'medium'),
                'tags': ['ai-analyzed', 'image-upload', provider],
                'lastModified': now_str,
                'version': '1.0',
            },
            'createdAt': now_str,
            'updatedAt': now_str,
            'diagram': {
                'nodes': diagram_nodes,
                'edges': diagram_edges,
                'viewport': {'zoom': 0.8, 'pan': {'x': 0, 'y': 0}},
                'grid': {'size': 20, 'enabled': True, 'snapEnabled': False},
            }
        }

        logger.info(f"✅ Image analysis completed: {analysis_result.get('provider', 'unknown').upper()}, {len(components)} components")

        return AgentResponse(
            success=True,
            message="Architecture diagram analyzed successfully",
            data={
                'architecture': ui_architecture,
                'analysis_result': analysis_result,
                'detected_components': analysis_result.get('detected_components', [])
            },
            reasoning=analysis_result.get('architecture_pattern', 'Architecture analyzed from uploaded diagram')
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error analyzing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/credentials/upload")
async def upload_credentials(
    file: UploadFile = File(...),
    provider: str = "aws",
    project_id: str = "",
    auth_context: dict = Security(verify_authentication),
):
    """
    Upload cloud provider credential files securely.
    Files are stored encrypted in the deployer's configured credentials directory.
    """
    try:
        import uuid

        logger.info(f"📤 Credential upload: provider={provider}, file={file.filename}")

        content = await file.read()
        raw_text = content.decode("utf-8", errors="replace")

        # Store using the deployer's credential_manager
        deployer_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
        sys.path.insert(0, deployer_root)

        from deployer.config import CREDENTIALS_DIR
        from deployer.credential_manager import store_credential

        CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = CREDENTIALS_DIR / f"_tmp_{provider}_{uuid.uuid4().hex}"
        try:
            tmp_path.write_text(raw_text, encoding="utf-8")
            info = store_credential(provider, str(tmp_path))
        finally:
            tmp_path.unlink(missing_ok=True)

        logger.info(f"✅ Credentials stored securely for {provider}: {info}")

        return {"success": True, "info": info, "message": f"{provider.upper()} credentials stored securely"}

    except Exception as e:
        logger.error(f"❌ Credential upload failed: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/credentials/check/{provider}")
async def check_credentials(
    provider: str,
    auth_context: dict = Security(verify_authentication),
):
    """Check if credentials exist server-side for a given provider."""
    try:
        deployer_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
        sys.path.insert(0, deployer_root)
        from deployer.credential_manager import credential_exists
        exists = credential_exists(provider)
        return {"exists": exists, "provider": provider}
    except Exception as e:
        logger.warning(f"Credential check failed for {provider}: {e}")
        return {"exists": False, "provider": provider}


@app.get("/api/credentials/list")
async def list_credentials(
    auth_context: dict = Security(verify_authentication),
):
    """List all stored credentials with metadata (no secrets)."""
    try:
        deployer_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
        sys.path.insert(0, deployer_root)
        from deployer.credential_manager import credential_exists, load_credential, parse_credential

        accounts = []
        for provider in ["alicloud", "aws", "gcp", "azure"]:
            if credential_exists(provider):
                try:
                    raw = load_credential(provider)
                    info = parse_credential(provider, raw)
                    account_id = info.get("aws_access_key_id", info.get("project_id", info.get("account_id", "server-stored")))
                    account_name = info.get("client_email", info.get("console_user", f"{provider.upper()} Account"))
                    accounts.append({
                        "id": f"server-{provider}",
                        "provider": provider,
                        "accountId": account_id,
                        "accountName": account_name,
                        "isDefault": True,
                        "source": "server",
                    })
                except Exception as e:
                    logger.warning(f"Could not parse {provider} credentials: {e}")
        return {"accounts": accounts}
    except Exception as e:
        logger.warning(f"Credential list failed: {e}")
        return {"accounts": []}


@app.post("/api/deploy", response_model=AgentResponse)
async def deploy_architecture(
    request: dict,
    agent: ArchitectureAgent = Depends(get_agent),
    auth_context: dict = Security(verify_authentication),
):
    """
    Deploy architecture to cloud provider using real Terraform via the deployer module.
    Falls back to simulation if deployer is not available.
    """
    try:
        import subprocess
        import json
        import json as json_module
        from pathlib import Path
        from datetime import datetime

        architecture = request.get("architecture")
        config = request.get("config", {})

        provider = config.get("provider", architecture.get("provider", "aws"))
        region = config.get("region", "us-west-2")
        environment = config.get("environment", "dev")

        logger.info(f"🚀 Deploying to {provider} in {region} (env: {environment})...")

        deployer_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
        sys.path.insert(0, deployer_root)

        logs = []
        outputs = {}
        endpoint = ""

        try:
            if request.get("confirm_deploy") is not True:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Deployment must be explicitly confirmed before Terraform can "
                        "create cloud resources."
                    ),
                )

            from deployer.credential_manager import credential_exists, load_credential, write_gcp_credential_file, get_aws_keys, get_alicloud_keys
            from deployer.iac_generator import generate_gcp_terraform, generate_aws_terraform, generate_alicloud_terraform
            from deployer.deployment_engine import (
                prepare_workspace, write_terraform_files,
                terraform_init, terraform_plan, terraform_apply,
                terraform_output, terraform_destroy,
            )
            from deployer.deployment_validator import DeploymentResult, analyze_and_fix
            from deployer.config import MAX_DEPLOY_RETRIES

            if not credential_exists(provider):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"No {provider.upper()} credentials stored. "
                        "Upload credentials in Settings before deploying."
                    ),
                )

            logs.append(f"[INFO] Credentials verified for {provider.upper()}")

            # Generate Terraform
            if provider == "gcp":
                project_id = config.get("project_id", "")
                if not project_id:
                    raw = load_credential("gcp") if credential_exists("gcp") else ""
                    if raw:
                        import json as _json
                        project_id = _json.loads(raw).get("project_id", "")
                        logger.info(f"   Auto-detected GCP project_id from credentials: {project_id}")
                files = generate_gcp_terraform(project_id=project_id, region=region, environment=environment)
            elif provider == "alicloud":
                files = generate_alicloud_terraform(region=region, environment=environment)
            else:
                files = generate_aws_terraform(account_id=config.get("accountId", ""), region=region, environment=environment)

            logs.append(f"[INFO] Generated {len(files)} Terraform files")

            # Prepare workspace and deploy
            run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
            workspace = prepare_workspace(provider, run_id)
            final_files = files

            for attempt in range(1, MAX_DEPLOY_RETRIES + 1):
                write_terraform_files(workspace, final_files)

                # Build var args
                var_args = []
                if provider == "gcp":
                    cred_path = write_gcp_credential_file(workspace)
                    var_args = [
                        f"-var=project_id={project_id}",
                        f"-var=region={region}",
                        f"-var=environment={environment}",
                        f"-var=credentials_file={cred_path}",
                    ]
                elif provider == "alicloud":
                    key_id, secret = get_alicloud_keys()
                    var_args = [
                        f"-var=region={region}",
                        f"-var=environment={environment}",
                        f"-var=access_key={key_id}",
                        f"-var=secret_key={secret}",
                    ]
                elif provider == "aws":
                    key_id, secret = get_aws_keys()
                    var_args = [
                        f"-var=region={region}",
                        f"-var=environment={environment}",
                        f"-var=aws_access_key_id={key_id}",
                        f"-var=aws_secret_access_key={secret}",
                    ]

                logs.append(f"[INFO] Attempt {attempt}/{MAX_DEPLOY_RETRIES}: terraform init...")
                ok, output = terraform_init(workspace)
                if not ok:
                    logs.append(f"[WARN] Init failed, auto-fixing...")
                    result = DeploymentResult(False, output)
                    final_files, changes = analyze_and_fix(final_files, result.errors)
                    if changes and attempt < MAX_DEPLOY_RETRIES:
                        continue
                    raise ValueError(f"terraform init failed: {output[:300]}")

                logs.append(f"[INFO] terraform plan...")
                ok, output = terraform_plan(workspace, var_args)
                if not ok:
                    logs.append(f"[WARN] Plan failed, auto-fixing...")
                    result = DeploymentResult(False, output)
                    final_files, changes = analyze_and_fix(final_files, result.errors)
                    if changes and attempt < MAX_DEPLOY_RETRIES:
                        continue
                    raise ValueError(f"terraform plan failed: {output[:300]}")

                logs.append(f"[INFO] terraform apply...")
                ok, output = terraform_apply(workspace, var_args)
                if not ok:
                    logger.error(f"[Deploy] terraform apply FAILED:\n{output}")
                    logs.append(f"[WARN] Apply failed: {output[-300:]}")
                    result = DeploymentResult(False, output)
                    final_files, changes = analyze_and_fix(final_files, result.errors)
                    if changes and attempt < MAX_DEPLOY_RETRIES:
                        logs.append(f"[INFO] Auto-fix applied, retrying...")
                        continue
                    raise ValueError(f"terraform apply failed: {output[-800:]}")

                logs.append(f"[SUCCESS] Infrastructure deployed on attempt {attempt}!")

                # Get outputs
                _, tf_outputs = terraform_output(workspace)
                outputs = {k: v.get("value", v) if isinstance(v, dict) else v for k, v in tf_outputs.items()}

                for k, v in outputs.items():
                    logs.append(f"[OUTPUT] {k} = {v}")

                break

            logs.append("[SUCCESS] Deployment completed successfully!")
            endpoint = outputs.get("endpoint", outputs.get("bucket_name", f"https://{provider}-deployed.cloud"))

            # =============================================================
            # AUTOPILOT STAGE 3: Code Committer
            # Saves deployment-validated IaC to GitLab via branch + commit + MR
            # =============================================================
            gitlab_token = os.getenv("GITLAB_TOKEN", "")
            gitlab_project = os.getenv("GITLAB_PROJECT_PATH", "")
            gitlab_mr_url = ""

            logger.info(f"\n{'─'*60}")
            logger.info(f"🤖 AUTOPILOT STAGE 3: Code Committer")
            logger.info(f"{'─'*60}")

            if gitlab_token and gitlab_project:
                try:
                    gl = GitLabClient(token=gitlab_token, project_path=gitlab_project)
                    arch_name = architecture.get("name", "Cloud Architecture")

                    terraform_code = "\n\n".join(
                        f"# {fn}\n{content}" for fn, content in final_files.items()
                    )
                    if not terraform_code:
                        terraform_code = "# Generated by Skyrchitect\n"

                    issue_iid = request.get("gitlab_issue_iid")

                    logger.info(f"   Action: create_commit + create_merge_request (GitLab API)")
                    logger.info(f"   INPUT → project: {gitlab_project}")
                    logger.info(f"   INPUT → provider: {provider.upper()}")
                    logger.info(f"   INPUT → environment: {environment}")
                    logger.info(f"   INPUT → architecture: {arch_name}")
                    logger.info(f"   INPUT → terraform_code_length: {len(terraform_code)} chars")
                    logger.info(f"   INPUT → deployment_outputs: {json.dumps(outputs)[:200]}")
                    logger.info(f"   INPUT → linked_issue: #{issue_iid or 'none'}")

                    logs.append("[INFO] [AUTOPILOT STAGE 3: Code Committer] Saving validated Terraform to GitLab...")
                    save_result = gl.save_validated_deployment(
                        terraform_code=terraform_code,
                        provider=provider,
                        environment=environment,
                        architecture_name=arch_name,
                        deployment_outputs=outputs,
                        issue_iid=issue_iid,
                    )

                    gitlab_mr_url = save_result.get("mr_url", "")
                    branch_name = save_result.get("branch", "")
                    commit_id = save_result.get("commit", {}).get("short_id", "unknown")

                    logger.info(f"   OUTPUT ← branch: {branch_name}")
                    logger.info(f"   OUTPUT ← commit: {commit_id}")
                    logger.info(f"   OUTPUT ← mr_url: {gitlab_mr_url}")

                    if gitlab_mr_url:
                        logger.info(f"   ✅ Code Committer: MR created successfully")
                        logs.append(f"[SUCCESS] [AUTOPILOT STAGE 3] Code saved to GitLab: {gitlab_mr_url}")
                        logs.append(f"[SUCCESS] [AUTOPILOT STAGE 3] Branch: {branch_name}")
                        logs.append(f"[SUCCESS] [AUTOPILOT STAGE 3] Commit: {commit_id}")
                    else:
                        logger.warning(f"   ⚠️ Code Committer: no MR URL returned")
                        logs.append(f"[WARN] GitLab save completed but no MR URL: {json.dumps(save_result)[:200]}")
                except Exception as gl_err:
                    logger.error(f"   ❌ Code Committer failed: {gl_err}")
                    logs.append(f"[WARN] [AUTOPILOT STAGE 3] GitLab save failed: {gl_err}")
            else:
                logger.warning(f"   ⚠️ GitLab not configured — Code Committer skipped")
                logs.append("[INFO] GitLab integration not configured, skipping code commit")

            logger.info(f"{'─'*60}\n")

            # Cleanup (destroy test infra)
            logs.append("[INFO] Cleaning up test infrastructure...")
            terraform_destroy(workspace, var_args)
            logs.append("[SUCCESS] Test resources destroyed")

        except ImportError as ie:
            logger.warning(f"Deployer module not available ({ie}), falling back to simulation")
            logs = [
                f"[INFO] Initializing deployment to {provider}...",
                f"[INFO] Region: {region}",
                "[INFO] Validating architecture configuration...",
                "[SUCCESS] Configuration validated",
                "[INFO] Creating resources...",
                "[SUCCESS] Deployment completed (simulated)!",
            ]
            endpoint = f"https://{provider}-app.example.com"

        final_mr_url = locals().get("gitlab_mr_url", "")
        logger.info(f"\n{'='*60}")
        logger.info(f"🏁 DEPLOYMENT PIPELINE COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"   Provider: {provider.upper()}")
        logger.info(f"   Region: {region}")
        logger.info(f"   Status: SUCCESS")
        logger.info(f"   GitLab MR: {final_mr_url or 'N/A'}")
        logger.info(f"   Autopilot Stages: Requirements Analyzer → Qwen IaC Generator → GitLab Code Committer")
        logger.info(f"{'='*60}\n")

        return AgentResponse(
            success=True,
            message="Deployment completed successfully",
            data={
                "status": "success",
                "deployment_logs": logs,
                "outputs": outputs,
                "endpoint": endpoint,
                "provider": provider,
                "region": region,
                "gitlab_mr_url": final_mr_url,
            },
            reasoning=f"Deployed {len(architecture.get('components', []))} components to {provider.upper()} in {region}"
        )

    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        logger.error(f"❌ Error deploying architecture: {err_str[:1000]}")
        raise HTTPException(status_code=500, detail=err_str[:2000])


# ======================================================================
# GitLab Integration Endpoints
# ======================================================================

@app.post("/api/gitlab/issue")
async def create_gitlab_issue(request: dict):
    """
    Requirements Analyzer step: create a GitLab issue for the architecture request.

    The Requirements Analyzer records structured infrastructure requirements in
    GitLab so the deployment has a durable, reviewable audit trail.
    """
    try:
        gl = GitLabClient()
        if not gl.token:
            raise HTTPException(status_code=500, detail="GitLab integration not configured")

        title = request.get("title", "Infrastructure Request")
        provider = request.get("provider", "aws")
        description_text = request.get("description", "")
        components = request.get("components", [])

        components_md = "\n".join(f"- {c.get('name', 'Unknown')}: {c.get('description', '')}" for c in components)

        issue_description = f"""\
## Infrastructure Request

**Provider:** {provider.upper()}
**Architecture:** {title}

### Description
{description_text}

### Components
{components_md}

---
_Created by Sky Launchpad using Qwen Cloud; tracked in GitLab._

/label ~infrastructure ~skyrchitect
"""
        result = gl.create_issue(
            title=f"[Skyrchitect] {title}",
            description=issue_description,
        )

        issue_iid = result.get("iid")
        issue_url = result.get("web_url", "")

        logger.info(f"📋 Created GitLab issue #{issue_iid}: {issue_url}")

        return {
            "success": True,
            "issue_iid": issue_iid,
            "issue_url": issue_url,
            "message": f"GitLab issue #{issue_iid} created",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GitLab issue creation failed: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/gitlab/status")
async def gitlab_status():
    """
    Check GitLab integration status (the optional git host for MRs).
    Returns connection info and the loaded skills used by generation.
    """
    gitlab_token = os.getenv("GITLAB_TOKEN", "")
    gitlab_project = os.getenv("GITLAB_PROJECT_PATH", "")

    skills = get_skills_summary()

    connected = False
    project_info = {}
    if gitlab_token and gitlab_project:
        try:
            gl = GitLabClient()
            resp = gl._get("")
            if "id" in resp:
                connected = True
                project_info = {
                    "id": resp.get("id"),
                    "name": resp.get("name"),
                    "web_url": resp.get("web_url"),
                }
        except Exception:
            pass

    return {
        "gitlab_configured": bool(gitlab_token and gitlab_project),
        "gitlab_connected": connected,
        "project": project_info,
        "skills": skills,
    }


@app.post(
    "/api/voice/transcribe",
    dependencies=[Depends(check_rate_limit)]
)
async def transcribe_voice(
    file: UploadFile = File(...),
    auth_context: dict = Security(optional_authentication)
):
    """
    Transcribe uploaded audio to text using Qwen-ASR on Qwen Cloud.

    **Authentication**: Optional
    **Rate Limit**: Yes
    """
    try:
        from backend.llm_client import transcribe

        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio upload")

        logger.info(f"🎙️  Transcribing {len(audio_bytes)} bytes via Qwen-ASR...")
        text = transcribe(audio_bytes, file.content_type or "audio/webm")
        logger.info("✅ Transcription complete")

        return {"success": True, "text": text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transcribing voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Run with: uvicorn backend.api.main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
