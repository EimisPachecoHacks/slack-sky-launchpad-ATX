# Sky Launchpad AI Backend

AI-powered cloud architecture design, repair, and deployment API — powered by
**Gemma 4** on an **AMD Instinct MI300X**.

## Features

- 🤖 **AI Architecture Generation**: Gemma 4 turns requirements into cloud architectures
- 🖼️ **Diagram Vision**: Gemma 4 reads uploaded architecture images (natively multimodal)
- ♻️ **Self-Improving Loop**: on a failed deploy, Gemma 4 repairs the HCL and authors a reusable skill
- 💰 **Cost Optimization** & **Validation**: best-practice and cost checks
- 🔄 **Multi-Cloud**: AWS / GCP Terraform

## Technology Stack

- **FastAPI**: async web framework
- **Gemma 4** (`gemma4:31b`) via **Ollama** on **ROCm / AMD MI300X**: all inference
- **mxbai-embed-large**: skill-retrieval embeddings (on the GPU)
- **Python 3.12+**

## Quick Start

### 1. Install Dependencies

```bash
pip3 install -r requirements.txt
```

### 2. Configure Environment

Copy `../.env.example` to `../.env`. The defaults point at the local AMD GPU
(Ollama at `http://localhost:11434/v1`, model `gemma4:31b`) and need no API key.
See [`backend/config.py`](config.py) for all options.

### 3. Bring up the GPU stack

`bash ../../scripts/pod_up.sh` (hackathon pod) or
`docker compose -f ../../docker/docker-compose.amd.yml up` (droplet).

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
│   └── architecture_agent.py # Gemma 4 architecture agent
├── models/
│   └── schemas.py           # Pydantic models
├── requirements.txt
└── README.md
```

## AI Agent Architecture

The agent uses:
1. **Model**: Gemma 4 (`gemma4:31b`) via Ollama on the AMD MI300X (see `backend/llm_client.py`)
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
| `LLM_BASE_URL` | OpenAI-compatible inference URL | `http://localhost:11434/v1` (Ollama) |
| `LLM_MODEL` | Text/vision model | `gemma4:31b` |
| `EMBED_MODEL` | Skill-retrieval embedder | `mxbai-embed-large` |
| `MONGODB_URI` | Atlas connection (blank = local JSON) | — |
| `PORT` | API port | 8080 |

## Troubleshooting

### Generation returns empty / errors
Confirm the GPU endpoint is up: `curl localhost:11434/v1/models`. Gemma 4 needs a
real token budget (the app sends a large one) — tiny requests can return empty.

### Agent not initializing
Check that `LLM_BASE_URL` points at a reachable Ollama/vLLM endpoint.

### CORS errors
Update `CORS_ORIGINS` in `.env` (or `config.py`) for your frontend URL.

## License

MIT - AWS AI Agent Global Hackathon 2025
