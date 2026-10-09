# Biology Atlas

An interactive, colourful 3D explorer for biology — cells, tissues, organs and more. Pick an item, rotate it, cut it open,
inspect its parts, view microscope images and compare it with another item.

Static site, no build step. Open `index.html` in a browser (needs internet for three.js and fonts from CDNs).

## Files
| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `style.css` | Theme (light/dark, per-item colour accent) |
| `items.js` | **All biological items** — edit this to add more |
| `app.js` | 3D engine, organelle/part builders, UI |

## Adding a new item
Append an object to `window.ITEMS` in `items.js`:

```js
{
  id: 'red-blood-cell', name: 'Red Blood Cell', type: 'Blood Cell',
  category: 'Cell',            // any label; 'Tissue', 'Organ', 'System'… get their own tab automatically
  accent: '#d4343c', seed: 80,
  body:  { dims: [1.4, .5, 1.4], p: 3, noise: .02,
           layers: [{ s: 1, color: '#e0383f', opacity: 1 }], cyto: '#a01c28' },
  cam:   { dist: 5, az: .6, el: .5 },
  organelles: [
    { id: 'hb', name: 'Haemoglobin', tag: 'Oxygen carrier', kind: 'dots', color: '#ff5a5a', count: 60, r: .04,
      size: '~ 270 million per cell', location: 'Cytoplasm', lm: 'No' },
    { id: 'membrane', name: 'Plasma Membrane', kind: 'body', size: '~7 nm', location: 'Outer boundary', lm: 'Edge only' }
  ],
  notes: '…', fact: '…',
  micro: { pattern: 'blobs', light: '#f0a0a0', stain: '#d04060' },
  where: { emoji: '🩸', label: 'Blood' }
}
```

Part `kind`s available: `nucleus, nucleolus, mito, chloroplast, golgi, er, vacuole, dots, microvilli,
junctions, plate, nucleoid, flagellum, pili, myofibril, axon, myelin, dendrites, terminals, body`.
New geometry types are added as functions in the `KINDS` table inside `buildCell()` in `app.js`.
Multi-coloured "beads" are added to every item automatically (set `noDecor: true` to opt out).

Body shape: `dims` are half-extents, `p` is the superellipse power (2 = ellipsoid, 8 = box-like).

## Notes
Models are procedurally generated, not scanned. Notes, favourites and uploaded microscope images are stored in the browser (`localStorage`).
