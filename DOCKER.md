# Theme Color Tweaker - Docker

## Build
```
docker build -t theme-color-tweaker .
```

## Run (mount a theme.json)
```
docker run --rm -P   -v "/path/to/your/theme.json:/theme.json"   theme-color-tweaker   --path /theme.json
```

Then open: http://localhost:<random_port>

## Find the random port
```
docker ps
```
Look under **PORTS** (e.g. `0.0.0.0:49154->8000/tcp`).

## Notes
- The app writes backups next to the mounted file in the container path.
- You can point to any theme.json by changing the -v mount and --path.

## Optional: set THEME_PATH env var
```
docker run --rm -P \
  -e THEME_PATH=/theme.json \
  -v "/path/to/your/theme.json:/theme.json" \
  theme-color-tweaker
```

## Docker Compose (fixed path)
```
docker compose up -d --build
```

This uses the host path:
`/home/atlas/.config/DankMaterialShell/themes/NEW KAV THEME/theme.json`

Change that path in `docker-compose.yml` if your theme file is elsewhere.

## Upload & Scan (inside container)
By default the app scans `THEME_ROOT` (default `/data`) for `theme.json` files, and uploads are saved under `/data/uploads`.

To persist uploads, mount a host folder to `/data`:
```
docker run --rm -P \
  -v "/path/to/themes:/data" \
  theme-color-tweaker
```

Optional env vars:
- `THEME_ROOT` (default `/data`): where to scan for themes
- `UPLOAD_DIR` (default `/data/uploads`): where uploaded themes are stored
