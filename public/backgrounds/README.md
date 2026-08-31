# Background plates

The app ships with a hand-authored CSS atmosphere (see `.bg-atmosphere` in
`src/app/globals.css`) and needs no image files at all. Dropping artwork in
here replaces it, per screen.

## Slots

| Slot            | Used by      |
| --------------- | ------------ |
| `library-hall`  | `/quests`, `/map` |
| `grand-atrium`  | `/skills`    |
| `rotunda`       | `/abilities` |
| `archive-room`  | `/inventory` |
| `observatory`   | `/character` |

## Installing artwork

1. Copy the image into this folder, e.g. `library-hall.jpg`.
2. Add it to `manifest.json`:

```json
{
  "plates": {
    "library-hall": "library-hall.jpg",
    "grand-atrium": "grand-atrium.jpg",
    "rotunda": "rotunda.jpg",
    "archive-room": "archive-room.jpg",
    "observatory": "observatory.jpg"
  }
}
```

3. Reload. No rebuild is needed.

Any slot left out of the manifest falls back to the CSS atmosphere, so a
partial set is fine.

## Why a manifest rather than a naming convention

If the app simply guessed at `/backgrounds/<slot>.jpg`, a default install
would request a file that is not there, and every missing image logs a console
error. The manifest means a default install makes no image request at all.

## Notes

- Plates render behind a dark overlay and a vignette, so mid-dark artwork
  works best; the overlay is what keeps panel text legible.
- Landscape 16:9 at roughly 1920x1080 is the target. Images are drawn with
  `background-size: cover`, so other ratios crop rather than distort.
- These are decorative only: the layer is `aria-hidden` and carries no
  information.
