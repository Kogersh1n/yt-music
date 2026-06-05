FROM python:3.12-slim

# Set environment variables to optimize Python execution and set the PYTHONPATH
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/app

# Set the working directory
WORKDIR /app

# Install basic system tools (curl can be used for container healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies first to leverage Docker cache layers
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app directory (containing the src/ package) into /app/app
COPY app/ /app/app/

# Expose the API port
EXPOSE 8000

# Set the final working directory to /app/app so uvicorn runs in the correct context
WORKDIR /app/app

# Start the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
