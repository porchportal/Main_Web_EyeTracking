FROM python:3.9-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY auth_service/requirements.txt .

# Install PyTorch CPU version first to avoid hash verification issues
RUN pip install --no-cache-dir torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu

# Install remaining requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy the auth_service directory
COPY auth_service/ .

# Copy necessary files from backend root
COPY auth_service/db/ ./db/
COPY model_preference/ ./model_preference/
COPY Main_AI/ ./Main_AI/
COPY .env.backend ./.env.backend

# Set environment variable for port
ENV PORT=8108

# Run the auth service
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8108"]