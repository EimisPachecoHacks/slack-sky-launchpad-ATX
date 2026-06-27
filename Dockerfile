FROM node:18-alpine AS frontend-build
WORKDIR /build
COPY project/package*.json ./
RUN npm ci
COPY project/ .
ENV VITE_API_URL=https://skyrchitect-81189935460.us-central1.run.app
RUN npm run build

FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx curl unzip libmagic1 && \
    rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://releases.hashicorp.com/terraform/1.7.5/terraform_1.7.5_linux_amd64.zip -o /tmp/tf.zip && \
    unzip /tmp/tf.zip -d /usr/local/bin && rm /tmp/tf.zip && terraform version
WORKDIR /app
COPY project/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt gunicorn requests cryptography boto3
COPY project/backend/ ./backend/
COPY deployer/ ./deployer/
COPY AGENTS.md ./AGENTS.md
COPY .gitlab/ ./.gitlab/
COPY skills/ ./skills/
COPY flows/ ./flows/
COPY --from=frontend-build /build/dist /var/www/html
COPY cloudrun-nginx.conf /etc/nginx/sites-available/default
COPY cloudrun-start.sh /app/start.sh
RUN chmod +x /app/start.sh
EXPOSE 8080
CMD ["/app/start.sh"]
