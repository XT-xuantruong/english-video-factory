FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -e ".[vieneu]"

EXPOSE 8124
CMD ["python", "-m", "uvicorn", "tts_service.api:app", "--host", "0.0.0.0", "--port", "8124"]
