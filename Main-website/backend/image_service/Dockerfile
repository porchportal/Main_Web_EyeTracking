FROM python:3.9-slim
WORKDIR /app

# Set environment variables to fix multiprocessing issues in Docker
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV VECLIB_MAXIMUM_THREADS=1
# Suppress PyTorch image extension warning
ENV TORCHVISION_IMAGE_BACKEND=torch

# Install system dependencies for OpenCV and OpenGL
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1-mesa-dev \
    libglu1-mesa-dev \
    freeglut3-dev \
    mesa-common-dev \
    libglib2.0-0 \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libatlas-base-dev \
    gfortran \
    gcc \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY image_service/requirements.txt .

# Install PyTorch with CPU support for local development (use CUDA for production)
RUN pip install --no-cache-dir torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cpu

# Install remaining requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy the image_service directory
COPY image_service/ .

# Copy necessary files from backend root
COPY auth_service/db/ ./db/
COPY model_preference/ ./model_preference/
COPY Main_AI/ ./Main_AI/
COPY .env.backend ./.env.backend

# Set environment variable for port
ENV PORT=8010

# Run the image service (single worker to avoid multiprocessing issues)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]