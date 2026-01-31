# Theme Color Tweaker - Docker

## Build
```
docker build -t theme-color-tweaker .
```

## Run (mount a theme.json)
```
docker run --rm -p 8000:8000   -v "/home/atlas/.config/DankMaterialShell/themes/KAV THEME/theme.json:/theme.json"   theme-color-tweaker   --path /theme.json
```

Then open: http://localhost:8000

## Notes
- The app writes backups next to the mounted file in the container path.
- You can point to any theme.json by changing the -v mount and --path.
