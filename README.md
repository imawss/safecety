# Safecety

**Blur faces in photos before sharing — entirely in your browser.**

Safecety is a privacy tool built for teams who regularly share event photos containing people who haven't consented to being published. Upload a photo, let the AI detect and blur every face automatically, then tap any face to reveal it if it belongs to someone you want to keep visible.

---

## Features

- **Automatic face detection** — SSD MobileNet model detects faces at multiple scales, angles, and distances
- **One-tap reveal** — tap a blurred face to unblur it; tap again to re-blur
- **Manual draw tool** — drag a rectangle over any area the AI missed to add a custom blur zone
- **100% client-side** — your photos never leave your device; no server, no uploads, no accounts
- **Works on mobile** — touch-optimized with a dedicated Draw button for adding manual blur zones on phone
- **Progress indicator** — staged progress bar while the AI processes your photo
- **Clean export** — saved photo contains only the blurs, no UI overlays

---

## How to Use

1. Open `index.html` in any modern browser
2. Drop or tap to upload a photo
3. Wait for face detection to finish — all faces are blurred automatically
4. **Tap** a blurred face to reveal it
5. **Draw button** (mobile) or **drag** (desktop) to manually blur areas the AI missed
6. Hit **Save Photo** to download the final image

---

## Stack

| | |
|---|---|
| Face detection | [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) — SSD MobileNet v1 |
| Rendering | HTML5 Canvas API |
| Interaction | Pointer Events API (unified mouse + touch) |
| Dependencies | Zero runtime dependencies beyond face-api.js |

No build step. No framework. Open `index.html` and it works.

---

## Privacy

All processing happens locally in the browser using the Web ML model loaded from a CDN. Photos are never transmitted anywhere. The face detection model runs entirely on-device via JavaScript.

---

## Browser Support

Chrome · Firefox · Safari · Edge — any browser released after 2020.

---

## Development Notes

The canvas rendering pipeline — including the pixelation blur effect, Pointer Events interaction layer, hit detection scaling, and draw mode — was implemented with the help of [Claude Code](https://claude.ai/code).
