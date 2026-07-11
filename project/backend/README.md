# Sky Launchpad AI Backend

AI-powered cloud architecture design, repair, and deployment API — powered by
**Qwen (qwen3.7-max)** on an **Qwen Cloud**.

## Features

- 🤖 **AI Architecture Generation**: Qwen (qwen3.7-max) turns requirements into cloud architectures
- 🖼️ **Diagram Vision**: Qwen (qwen3.7-max) reads uploaded architecture images (natively multimodal)
- ♻️ **Self-Improving Loop**: on a failed deploy, Qwen (qwen3.7-max) repairs the HCL and authors a reusable skill
- 💰 **Cost Optimization** & **Validation**: best-practice and cost checks
- 🔄 **Multi-Cloud**: AWS / GCP Terraform

## Technology Stack

- **FastAPI**: async web framework
- **Qwen (qwen3.7-max)** (`qwen3.7-max`) via **Qwen Cloud** on **Qwen Cloud / Qwen Cloud**: all inference
- **text-embedding-v4**: skill-retrieval embeddings (on the GPU)
- **Python 3.12+**

## Quick Start

### 1. Install Dependencies

```bash
pip3 install -r requirements.txt
```

### 2. Configure Environment

Copy `../.env.example` to `../.env`. The defaults point at Qwen Cloud
(model `qwen3.7-max`) and need `DASHSCOPE_API_KEY`.
See [`backend/config.py`](config.py) for all options.

### 3. Bring up the GPU stack

`bash ../../scripts/pod_up.sh` (hackathon pod) or
`docker build -f Dockerfile.backend` then run on Alibaba Cloud.

### 4. Run the Server

```bash
# Development mode
cd backend
python3 -m uvicorn api.main:app --reload --port 8000

# Or directly
python3 api/main.py
```

### 5. Test the API

Visit: http://localhost:8000

API docs: http://localhost:8000/docs

## API Endpoints

### Health Check
```
GET /
GET /health
```

### Architecture Generation
```
POST /api/architecture/generate
Body: {
  "title": "Web Application",
  "description": "E-commerce platform",
  "requirements": ["user auth", "file storage", "database"],
  "provider": "aws",
  "optimization_goal": "balanced"
}
```

### Cost Optimization
```
POST /api/architecture/optimize
Body: {
  "provider": "aws",
  "components": [...],
  "current_cost": 500.0,
  "optimization_goal": "cost"
}
```

### Architecture Validation
```
POST /api/architecture/validate
Body: {
  "provider": "aws",
  "nodes": [...],
  "edges": [...]
}
```

### Cloud Service Comparison
```
GET /api/cloud/compare/{service_name}
```

### Chat with AI Agent
```
POST /api/chat
Body: {
  "question": "What AWS services for ML workloads?",
  "context": "optional context"
}
```

## Project Structure

```
backend/
├── api/
│   └── main.py              # FastAPI application
├── agents/
│   └── architecture_agent.py # Qwen (qwen3.7-max) architecture agent
├── models/
│   └── schemas.py           # Pydantic models
├── requirements.txt
└── README.md
```

## AI Agent Architecture

The agent uses:
1. **Model**: Qwen (qwen3.7-max) (`qwen3.7-max`) on Qwen Cloud (see `backend/llm_client.py`)
2. **Skills context**: curated GCP skills + auto-authored learned skills injected into the prompt
3. **System Prompt**: specialized cloud-architecture expertise

## Deployment

### AWS Lambda (Serverless)
```bash
# Install deployment dependency
pip install mangum

# Use Mangum adapter in main.py
# Deploy with AWS SAM or Serverless Framework
```

### AWS EC2 / ECS
```bash
# Use gunicorn for production
gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.api.main:app
```

### Docker
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_BASE_URL` | OpenAI-compatible inference URL | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (Qwen Cloud) |
| `LLM_MODEL` | Text/vision model | `qwen3.7-max` |
| `EMBED_MODEL` | Skill-retrieval embedder | `text-embedding-v4` |
| `MONGODB_URI` | Atlas connection (blank = local JSON) | — |
| `PORT` | API port | 8080 |

## Troubleshooting

### Generation returns empty / errors
Confirm your key works: `curl -H "Authorization: Bearer $DASHSCOPE_API_KEY" dashscope-intl.aliyuncs.com/compatible-mode/v1/models`. Qwen needs a
real token budget (the app sends a large one) — tiny requests can return empty.

### Agent not initializing
Check that `LLM_BASE_URL` points at a reachable Qwen Cloud endpoint.

### CORS errors
Update `CORS_ORIGINS` in `.env` (or `config.py`) for your frontend URL.

## License

MIT - AWS AI Agent Global Hackathon 2025
