FROM python:3.12-slim

# Настройки для оптимизации работы Python в контейнере
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/app

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Устанавливаем системные утилиты (ffmpeg, quickjs для yt-dlp и curl для хелсчеков)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    quickjs \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем зависимости (используем кэш докера, если реквайрментс не менялся)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем ВСЕ файлы из корня репозитория (включая папку src/) прямо в /app
# Это решает проблему ошибки "failed to calculate checksum ... /app: not found"
COPY . .

WORKDIR /app/app

# Открываем порт для FastAPI
EXPOSE 8000

# Рекомендуемый безопасный формат для запуска миграций и сервера через shell-вызов внутри JSON
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]