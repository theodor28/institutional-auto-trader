FROM python:3.12-slim
WORKDIR /app
COPY steiner_link.py cloud_master.py steiner_calls.py steiner_web.py ./
ENV PYTHONDONTWRITEBYTECODE=1
EXPOSE 10000
CMD ["python", "cloud_master.py"]
