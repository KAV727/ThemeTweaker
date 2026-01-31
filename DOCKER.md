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
