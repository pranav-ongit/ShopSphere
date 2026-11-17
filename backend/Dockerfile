FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8000 HOST=0.0.0.0 PIP_DISABLE_PIP_VERSION_CHECK=1
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn
RUN python manage.py collectstatic --noinput || true
EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "config.wsgi:application"]
