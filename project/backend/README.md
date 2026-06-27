# Skyrchitect AI Backend

AI-powered cloud architecture design and optimization API using **AWS Bedrock** and **Strands Agents SDK**.

## Features

- 🤖 **AI Architecture Generation**: Auto-generate cloud architectures from requirements
- 💰 **Cost Optimization**: AI-powered cost optimization suggestions
- ✅ **Architecture Validation**: Best practices and security checks
- 🔄 **Multi-Cloud Support**: AWS, Azure, GCP comparisons
- 🛠️ **Custom Tools**: Specialized cloud architecture tools for the AI agent

## Technology Stack

- **FastAPI**: Modern async web framework
- **Strands Agents SDK**: AWS open-source AI agent framework
- **AWS Bedrock**: Claude 3.5/4 LLM hosting
- **Python 3.12+**: Backend language

## Quick Start

### 1. Install Dependencies

```bash
pip3 install -r requirements.txt
```

### 2. Configure Environment

Ensure your `.env` file has:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=us-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

### 3. Enable Bedrock Model Access

Go to AWS Console and enable Claude models:
https://us-west-2.console.aws.amazon.com/bedrock/home?region=us-west-2#/modelaccess

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
│   └── architecture_agent.py # Strands Agent wrapper
├── models/
│   └── schemas.py           # Pydantic models
├── tools/
│   └── cloud_tools.py       # Custom AI tools
├── requirements.txt
└── README.md
```

## AI Agent Architecture

The agent uses:
1. **Bedrock Model**: Claude 3.5 Sonnet via AWS Bedrock
2. **Custom Tools**: Cloud-specific functions the AI can call:
   - `get_aws_service_info`: Service details
   - `calculate_architecture_cost`: Cost calculations
   - `suggest_cost_optimization`: Optimization recommendations
   - `get_service_alternatives`: Multi-cloud alternatives
   - `validate_architecture`: Best practices validation

3. **System Prompt**: Specialized cloud architecture expertise

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
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `AWS_DEFAULT_REGION` | AWS region | us-west-2 |
| `BEDROCK_MODEL_ID` | Bedrock model ID | claude-3-5-sonnet |
| `PORT` | API port | 8000 |

## Troubleshooting

### "AccessDeniedException" from Bedrock
Enable model access in AWS Console (link above)

### Agent not initializing
Check AWS credentials and Bedrock access

### CORS errors
Update `allow_origins` in `main.py` for your frontend URL

## License

MIT - AWS AI Agent Global Hackathon 2025
