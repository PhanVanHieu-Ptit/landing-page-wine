# Nocturne — Vesper design recreation

Responsive HTML/CSS/JavaScript reconstruction of the public Scrolltide Vesper preview.

## Run

```sh
npm run dev
```

Open http://localhost:3000. Requires Python 3; no package installation needed.

## Build

```sh
npm run build
```

Requires Node.js. Deploy `dist/` to a static host.

## Implemented

- Three full-screen scroll-driven chapters: hand-harvesting Pinot Noir, crafting wine in the oak cellar, and enjoying it over a restaurant dinner.
- Pinned cinematic stage: photographs dissolve into one another with a rack-focus pull, chapter navigation and reading progress.
- Camera behaves like a lens: scroll progress is eased so the shot trails the scroll with inertia, plus a slow dolly push, subtle handheld sway and pointer parallax.
- Per-scene atmosphere layered on each photograph: drifting valley mist and pollen, cellar light shafts and dust, flickering candle light and bokeh in the restaurant, then film grain and vignette beneath the copy.
- Scroll-spun bottle, after the Vesper preview: one fixed bottle, centred and always on screen from the hero to the allocation row, with the page scrolling past it (in front of the headlines, as in the preview). It leans 19° in the hero, stands upright and turns on its own axis: the label wraps round the glass and the back label (with barcode) comes into view, drawn on a canvas from separate glass, label and reflection layers (`assets/pinot-bottle-*.svg`). Over the restaurant it steps left to stand where the table's own bottle is, then sits between the copy and the figures beside the specification, turns again through the tasting notes, and finally straightens, shrinks and settles into the 750ml allocation slot. Scroll speed sways it, and it drifts gently with the pointer and when idle. On phones and tablets it stands small at the edge, then ghosts behind the copy. If the canvas art cannot load, the flat illustration stands in. Under `prefers-reduced-motion` the floating bottle is off and the slot simply shows its bottle.
- Opening shot fades up and pulls into focus; copy settles in layer by layer. All motion is switched off under `prefers-reduced-motion`.
- Custom AI-generated editorial scene assets; exact prompts and saved paths are in `assets/JOURNEY-IMAGES.md`.
- Local typographic brand mark, responsive mobile composition and reduced-motion support.
- Wine specifications, drifting illustrated tasting notes and five allocation formats.
- Detail dialogs, demo reservation and demo newsletter validation.

## Source and limitations

Reference: https://www.scrolltide.co/templates/vesper

Product, winemaker, pairing, seal and tasting-note images are cropped from the public 1280×754 preview video. Vineyard imagery is also reconstructed from its preview. These are preview-resolution assets, not the original high-resolution source files. Fonts are bundled locally.

The Pinot Noir Reserve 2021 bottle and tasting-note illustrations are local SVG assets. The main bottle is a 2D illustration whose label is wrapped round a cylinder on a canvas to fake the turn. It is not the original WebGL model. Winemaker opens a still-image detail dialog rather than playing an unavailable original video. Reservation, newsletter and trade interactions are demonstrations and do not send data or process payment.

Build, JavaScript syntax, local links and asset existence were checked. The cinematic journey was also verified in headless Chromium at 1440×900 and 390×844, including chapter navigation, reservation opening/closing and reduced-motion styling. The new journey intentionally replaces the reference hero and section order.
