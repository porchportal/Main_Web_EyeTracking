FROM python:3.9-slim
WORKDIR /app

# Copy requirements and install dependencies
COPY auth_service/requirements.txt .
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