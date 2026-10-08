# OctoBot still frames

`generate-octobot-stills.py` writes the still frame (first frame, palette PNG) of every OctoBot
animation next to its WebP in `projects/meshmakers/shared-ui/assets/octobot/{sm,md,lg}/`.
`mm-octobot` shows these stills under `prefers-reduced-motion: reduce` (AB#3444).

```bash
# from src/frontend-libraries; needs Pillow (pip install pillow)
python3 scripts/octobot/generate-octobot-stills.py
```

The generated PNGs are committed. Re-run the script only when the WebPs are replaced (source:
Marketing › Logo Animations › transparent › sm/md/lg; WebP only, no GIFs, no xl). See
`projects/meshmakers/shared-ui/docs/octobot.md`.
