FROM continuumio/miniconda3:latest

WORKDIR /app

# Install system dependencies and clean up in the same layer
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && conda create -n eyetracking python=3.9 -y \
    && conda clean -afy

# Make RUN commands use the new environment
SHELL ["conda", "run", "-n", "eyetracking", "/bin/bash", "-c"]

# Copy only requirements first
COPY requirements.txt .

# Install Python dependencies and clean up in the same layer
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf ~/.cache/pip/*

# Copy the rest of the application
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose the port the app runs on
EXPOSE 8000

# Activate conda environment and run the application
CMD ["conda", "run", "-n", "eyetracking", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]