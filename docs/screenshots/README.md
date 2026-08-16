# Screenshots

Regenerate all of these with:

```bash
node scripts/screenshots.mjs                    # against the live site
node scripts/screenshots.mjs http://localhost:5173
```

The script drives the installed Edge through playwright-core, loads the demo
litter first, and captures at 2× with reduced motion, so the shots are
reproducible rather than hand-taken.

| File | What it shows |
| --- | --- |
| `alert.png` | Litter home with the critical alert firing — README hero |
| `matrix.png` | Desktop litter matrix, cells tinted by daily gain |
| `weigh.png` | Phone weigh flow: collar header, day target, keypad, hold-to-talk |
| `verify.png` | The standalone passport verification page |
