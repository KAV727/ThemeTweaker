FROM python:3.11-slim

WORKDIR /app
COPY server.py /app/server.py
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

EXPOSE 8000
CMD ["python", "/app/server.py", "--host", "0.0.0.0", "--port", "8000"]
