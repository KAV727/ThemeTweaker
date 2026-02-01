FROM python:3.11-slim

WORKDIR /app
COPY server.py /app/server.py
COPY index.html /app/index.html
COPY style.css /app/style.css
COPY app.js /app/app.js

ENV THEME_ROOT=/data     UPLOAD_DIR=/data/uploads

VOLUME ["/data"]

EXPOSE 8000
ENTRYPOINT ["python", "/app/server.py"]
CMD ["--host", "0.0.0.0", "--port", "8000"]
