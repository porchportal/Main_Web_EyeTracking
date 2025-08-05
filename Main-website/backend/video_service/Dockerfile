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

# Install system dependencies for OpenCV, PyTorch, and other requirements
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
    # Additional libraries for PyTorch image processing
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libgtk-3-dev \
    libatlas-base-dev \
    gfortran \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY video_service/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the video_service directory
COPY video_service/ .

# Copy necessary files from backend root
COPY auth_service/db/ ./db/
COPY model_preference/ ./model_preference/
COPY Main_AI/ ./Main_AI/
COPY .env.backend ./.env.backend

# Create uploads directory
RUN mkdir -p uploads

# Set environment variable for port
ENV PORT=8011

# Expose the port the app runs on
EXPOSE 8011

# Run the video service
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8011", "--reload"]