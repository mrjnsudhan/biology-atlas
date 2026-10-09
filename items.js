/* =====================================================================
   ITEM DATA  —  add a new biological item by appending one object to ITEMS.
   No other code needs to change.

   category: 'Cell' | 'Tissue' | 'Organ' | 'System' … (any label; a tab appears automatically)
   body:   { dims:[x,y,z], p:superellipse power (2 = ellipsoid, 8 = boxy),
             noise:0..0.2 wobble, layers:[{s,color,opacity}], cyto:'#hex' }
   organelles: each has a `kind` (see KINDS in app.js), colour, count, place
           place: 'rand' | [x,y,z] normalised -1..1 inside the body
   micro:  pattern for the three generated microscope images
   where:  emoji + caption for the "Where it occurs" card
   ===================================================================== */
window.ITEMS = [
  {
    id: 'plant', name: 'Plant Cell', type: 'Eukaryotic Cell', accent: '#5c8a3c', seed: 11,
    body: { dims: [2.3, 0.85, 1.75], p: 7, noise: 0.02,
      layers: [{ s: 1, color: '#7fae3b', opacity: 1, name: 'Cell wall' }], cyto: '#2fb5a8' },
    cam: { dist: 6.2, az: 0.65, el: 0.62 },
    organelles: [
      { id: 'nucleus', name: 'Nucleus', tag: 'The control center', kind: 'nucleus', color: '#7b4fc9', r: 0.52, place: [0.5, 0.15, -0.35],
        size: '5 – 10 µm in diameter', location: 'Usually central', lm: 'Yes' },
      { id: 'nucleolus', name: 'Nucleolus', tag: 'Ribosome factory', kind: 'nucleolus', color: '#5a2fa0', r: 0.14, place: [0.5, 0.15, -0.35],
        size: '1 – 3 µm', location: 'Inside the nucleus', lm: 'Yes, with stain' },
      { id: 'vacuole', name: 'Central Vacuole', tag: 'Storage & turgor pressure', kind: 'vacuole', color: '#5fa8e6', dims: [0.95, 0.5, 0.55], place: [-0.3, 0.1, 0.05],
        size: 'Up to 90% of cell volume', location: 'Central', lm: 'Yes' },
      { id: 'chloroplast', name: 'Chloroplast', tag: 'Photosynthesis powerhouse', kind: 'chloroplast', color: '#4f9a2a', count: 6,
        size: '4 – 6 µm long', location: 'Along the cell edge', lm: 'Yes' },
      { id: 'mitochondria', name: 'Mitochondria', tag: 'Energy converters', kind: 'mito', color: '#d9803a', count: 6,
        size: '0.5 – 3 µm', location: 'Throughout the cytoplasm', lm: 'Barely' },
      { id: 'golgi', name: 'Golgi Apparatus', tag: 'Packaging & shipping', kind: 'golgi', color: '#e0903e', count: 1, place: [0.1, -0.2, 0.55],
        size: '1 – 3 µm stacks', location: 'Near the nucleus', lm: 'With stain' },
      { id: 'er', name: 'Rough ER', tag: 'Protein assembly line', kind: 'er', color: '#d9654e', count: 3, rough: true, place: [0.3, 0.0, 0.1],
        size: 'Network of flattened sacs', location: 'Around the nucleus', lm: 'No (EM only)' },
      { id: 'ribosomes', name: 'Ribosomes', tag: 'Protein builders', kind: 'dots', color: '#d1478f', count: 40, r: 0.035,
        size: '~ 25 nm', location: 'Free & on rough ER', lm: 'No (EM only)' },
      { id: 'wall', name: 'Cell Wall', tag: 'Rigid cellulose armour', kind: 'body',
        size: '0.1 – 10 µm thick', location: 'Outermost layer', lm: 'Yes' }
    ],
    notes: 'The nucleus is surrounded by a double membrane called the nuclear envelope, which contains pores that regulate the movement of molecules in and out.',
    fact: 'The nucleus was one of the first cell structures discovered!',
    micro: { pattern: 'honeycomb', light: '#9bd05a', stain: '#c06fd0' },
    where: { emoji: '🌳', label: 'Leaves, stems & roots' }
  },
  {
    id: 'wbc', name: 'White Blood Cell', type: 'Immune Cell', accent: '#7a55b8', seed: 23,
    body: { dims: [1.35, 1.25, 1.1], p: 2, noise: 0.07,
      layers: [{ s: 1, color: '#e4d4ff', opacity: 1, name: 'Membrane' }], cyto: '#b58cf0' },
    cam: { dist: 5.2, az: 0.6, el: 0.4 },
    organelles: [
      { id: 'nucleus', name: 'Lobed Nucleus', tag: 'Multi-lobed control center', kind: 'nucleus', color: '#7a3fc4', r: 0.42, count: 2, place: 'rand',
        size: '8 – 12 µm total', location: 'Central, segmented', lm: 'Yes, with stain' },
      { id: 'lysosome', name: 'Lysosome', tag: 'The cellular cleanup crew', kind: 'dots', color: '#e08a4a', count: 14, r: 0.07,
        size: '0.1 – 1.2 µm', location: 'Throughout cytoplasm', lm: 'With stain' },
      { id: 'granules', name: 'Granules', tag: 'Enzyme & signal stores', kind: 'dots', color: '#5b7fe0', count: 22, r: 0.05,
        size: '0.2 – 0.5 µm', location: 'Throughout cytoplasm', lm: 'Yes, with stain' },
      { id: 'mito', name: 'Mitochondria', tag: 'Energy converters', kind: 'mito', color: '#d8504a', count: 5,
        size: '0.5 – 1 µm', location: 'Throughout cytoplasm', lm: 'Barely' },
      { id: 'membrane', name: 'Plasma Membrane', tag: 'Flexible, ruffled boundary', kind: 'body',
        size: '~ 7 nm thick', location: 'Outer boundary', lm: 'Edge only' }
    ],
    notes: 'White blood cells are immune cells that can identify threats, move toward infection sites, and help coordinate defense responses.',
    fact: 'Some white blood cells can change shape to squeeze between blood vessel walls and reach infected tissue!',
    micro: { pattern: 'blobs', light: '#e6b8e0', stain: '#9a52c4' },
    where: { emoji: '🫀', label: 'Blood, lymph & tissues' }
  },
  {
    id: 'neuron', name: 'Neuron', type: 'Nerve Cell', accent: '#6b63c9', seed: 5,
    body: { dims: [0.6, 0.6, 0.6], p: 2, noise: 0.08,
      layers: [{ s: 1, color: '#7a6bff', opacity: 1, name: 'Soma' }], cyto: '#e06bd8' },
    cam: { dist: 8.5, az: 0.3, el: 0.35, target: [1.4, 0, 0] },
    organelles: [
      { id: 'axon', name: 'Axon', tag: 'The signal highway', kind: 'axon', color: '#7fa0e8', len: 3.4,
        size: '1 µm to over 1 metre', location: 'Extends from the soma', lm: 'Yes, with stain' },
      { id: 'myelin', name: 'Myelin Sheath', tag: 'Insulation for speed', kind: 'myelin', color: '#b9d2f0', count: 7,
        size: '0.2 – 2 µm thick', location: 'Wraps the axon', lm: 'Yes, with stain' },
      { id: 'dendrites', name: 'Dendrites', tag: 'Signal receivers', kind: 'dendrites', color: '#8f6fd8', count: 6,
        size: 'Up to 1 mm long', location: 'Branching from the soma', lm: 'Yes, with stain' },
      { id: 'terminals', name: 'Axon Terminals', tag: 'Where signals are passed on', kind: 'terminals', color: '#c75fb0', count: 6,
        size: '1 – 5 µm bulbs', location: 'End of the axon', lm: 'With stain' },
      { id: 'nucleus', name: 'Nucleus', tag: 'The control center', kind: 'nucleus', color: '#a23fd0', r: 0.3, place: [0, 0, 0],
        size: '~ 10 µm', location: 'Centre of the soma', lm: 'Yes' },
      { id: 'soma', name: 'Soma', tag: 'The cell body', kind: 'body',
        size: '4 – 100 µm', location: 'Central body', lm: 'Yes' }
    ],
    notes: 'Some axons in the human body — like those running from spine to toe — are over a metre long, making neurons among the longest cells in nature.',
    fact: 'A nerve impulse can travel at over 100 metres per second!',
    micro: { pattern: 'branches', light: '#a58be0', stain: '#d86fc0' },
    where: { emoji: '🧠', label: 'Brain, spinal cord & nerves' }
  },
  {
    id: 'epithelial', name: 'Epithelial Cell', type: 'Human Tissue Cell', accent: '#c4527a', seed: 31,
    body: { dims: [1.2, 1.3, 1.2], p: 5, noise: 0.015,
      layers: [{ s: 1, color: '#ff7fb0', opacity: 1, name: 'Membrane' }], cyto: '#e0509a' },
    cam: { dist: 6.4, az: 0.7, el: 0.45 },
    organelles: [
      { id: 'microvilli', name: 'Microvilli', tag: 'The absorptive brush border', kind: 'microvilli', color: '#e7799f', count: 70,
        size: '0.1 µm wide, 1 µm long', location: 'Apical surface', lm: 'As a brush border' },
      { id: 'nucleus', name: 'Nucleus', tag: 'The control center', kind: 'nucleus', color: '#7a3fc4', r: 0.45, place: [0.1, -0.1, 0],
        size: '5 – 10 µm', location: 'Basal half of the cell', lm: 'Yes' },
      { id: 'mito', name: 'Mitochondria', tag: 'Energy converters', kind: 'mito', color: '#d8504a', count: 8,
        size: '0.5 – 1 µm', location: 'Near the apical surface', lm: 'Barely' },
      { id: 'er', name: 'Rough ER', tag: 'Protein assembly line', kind: 'er', color: '#d84a4a', count: 3, rough: true, place: [-0.35, -0.2, 0.2],
        size: 'Network of flattened sacs', location: 'Around the nucleus', lm: 'No (EM only)' },
      { id: 'junctions', name: 'Tight Junctions', tag: 'Seals between neighbours', kind: 'junctions', color: '#6aa0d8',
        size: '~ 10 nm gap closed', location: 'Between neighbouring cells', lm: 'No (EM only)' },
      { id: 'basement', name: 'Basement Membrane', tag: 'Anchor to the tissue below', kind: 'plate', color: '#9b6aa8',
        size: '50 – 100 nm', location: 'Base of the cell', lm: 'With stain' },
      { id: 'membrane', name: 'Plasma Membrane', tag: 'Selective boundary', kind: 'body',
        size: '~ 7 nm thick', location: 'Outer boundary', lm: 'Edge only' }
    ],
    notes: 'In the small intestine, epithelial cells carpet themselves with microvilli, dramatically increasing their absorptive surface area.',
    fact: 'Your gut lining is replaced every 3–5 days!',
    micro: { pattern: 'honeycomb', light: '#e6a0c0', stain: '#d05a9a' },
    where: { emoji: '🫁', label: 'Skin, gut & airways' }
  },
  {
    id: 'bacteria', name: 'Bacteria Cell', type: 'Prokaryotic Cell', accent: '#3e9a7a', seed: 41,
    body: { dims: [2.5, 0.8, 0.8], p: 4, noise: 0,
      layers: [{ s: 1.08, color: '#7ec4c0', opacity: 0.5, name: 'Capsule' }, { s: 1, color: '#2fc9b8', opacity: 1, name: 'Cell wall' }], cyto: '#3a55e0' },
    cam: { dist: 7, az: 0.5, el: 0.45 },
    organelles: [
      { id: 'nucleoid', name: 'Nucleoid (DNA)', tag: 'The circular chromosome', kind: 'nucleoid', color: '#b24fd0',
        size: '~ 1 µm region', location: 'Centre of the cytoplasm', lm: 'No, EM only' },
      { id: 'ribosomes', name: 'Ribosomes', tag: 'Protein builders', kind: 'dots', color: '#e8903a', count: 70, r: 0.04,
        size: '~ 20 nm', location: 'Free in the cytoplasm', lm: 'No, EM only' },
      { id: 'flagellum', name: 'Flagellum', tag: 'A rotary motor for swimming', kind: 'flagellum', color: '#e08a3a',
        size: '5 – 20 µm long', location: 'Tail end', lm: 'With special stain' },
      { id: 'pili', name: 'Pili', tag: 'Hair-like attachments', kind: 'pili', color: '#e87aa8', count: 36,
        size: '2 – 8 nm wide', location: 'Cell surface', lm: 'No, EM only' },
      { id: 'wall', name: 'Cell Wall', tag: 'Peptidoglycan armour', kind: 'body',
        size: '10 – 80 nm', location: 'Outside the membrane', lm: 'With stain' }
    ],
    notes: 'Unlike eukaryotic cells, bacteria have no nuclear envelope — their DNA floats freely in a region of the cytoplasm called the nucleoid.',
    fact: 'There are more bacterial cells in your body than human cells!',
    micro: { pattern: 'rods', light: '#b9a4e0', stain: '#d05a9a' },
    where: { emoji: '🌱', label: 'Soil, water & your gut' }
  },
  {
    id: 'animal', name: 'Animal Cell', type: 'Eukaryotic Cell', accent: '#7d6ad0', seed: 53,
    body: { dims: [2.1, 0.95, 1.7], p: 2.6, noise: 0.05,
      layers: [{ s: 1, color: '#7a7dff', opacity: 1, name: 'Membrane' }], cyto: '#4a6bff' },
    cam: { dist: 6.2, az: 0.6, el: 0.6 },
    organelles: [
      { id: 'nucleus', name: 'Nucleus', tag: 'The control center', kind: 'nucleus', color: '#8a3fd0', r: 0.55, place: [0.45, 0.2, -0.4],
        size: '5 – 10 µm', location: 'Usually central', lm: 'Yes' },
      { id: 'nucleolus', name: 'Nucleolus', tag: 'Ribosome factory', kind: 'nucleolus', color: '#5a2fa0', r: 0.15, place: [0.45, 0.2, -0.4],
        size: '1 – 3 µm', location: 'Inside the nucleus', lm: 'Yes, with stain' },
      { id: 'mitochondria', name: 'Mitochondrion', tag: 'The powerhouse', kind: 'mito', color: '#d8504a', count: 6,
        size: '0.5 – 10 µm in length', location: 'Distributed in cytoplasm', lm: 'Barely' },
      { id: 'golgi', name: 'Golgi Apparatus', tag: 'Packaging & shipping', kind: 'golgi', color: '#e0a23e', count: 1, place: [-0.4, -0.1, 0.4],
        size: '1 – 3 µm stacks', location: 'Near the nucleus', lm: 'With stain' },
      { id: 'er', name: 'Rough ER', tag: 'Protein assembly line', kind: 'er', color: '#e0604e', count: 3, rough: true, place: [0.2, -0.1, 0.1],
        size: 'Network of flattened sacs', location: 'Around the nucleus', lm: 'No (EM only)' },
      { id: 'vesicles', name: 'Vesicles', tag: 'Cargo carriers', kind: 'dots', color: '#e9c13c', count: 24, r: 0.06,
        size: '50 – 100 nm', location: 'Throughout cytoplasm', lm: 'No' },
      { id: 'membrane', name: 'Plasma Membrane', tag: 'Selective boundary', kind: 'body',
        size: '~ 7 nm thick', location: 'Outer boundary', lm: 'Edge only' }
    ],
    notes: 'Mitochondria have their own DNA, inherited maternally, and are thought to have evolved from ancient bacteria absorbed by early eukaryotic cells.',
    fact: 'Mitochondria are the only organelles outside the nucleus that have their own DNA!',
    micro: { pattern: 'honeycomb', light: '#e6a0d8', stain: '#c04fb0' },
    where: { emoji: '🐕', label: 'Every animal tissue' }
  },
  {
    id: 'muscle', name: 'Muscle Cell', type: 'Muscle Fiber', accent: '#b8404a', seed: 67,
    body: { dims: [2.6, 0.85, 0.85], p: 3, noise: 0.01,
      layers: [{ s: 1, color: '#ff7f95', opacity: 1, name: 'Sarcolemma' }], cyto: '#e0426a' },
    cam: { dist: 7, az: 0.55, el: 0.4 },
    organelles: [
      { id: 'myofibril', name: 'Myofibril', tag: 'Contractile protein bundles', kind: 'myofibril', color: '#c43a5a', count: 14,
        size: '~ 1 µm', location: 'Fill the fibre lengthwise', lm: 'Yes, banded' },
      { id: 'mito', name: 'Mitochondria', tag: 'Energy converters', kind: 'mito', color: '#e8903a', count: 12,
        size: '1 – 3 µm', location: 'Between myofibrils', lm: 'Barely' },
      { id: 'nucleus', name: 'Nuclei (multiple)', tag: 'Many control centers', kind: 'nucleus', color: '#7a3fc4', r: 0.17, count: 4, place: 'edge',
        size: '~ 10 µm', location: 'Pushed to the periphery', lm: 'Yes' },
      { id: 'sr', name: 'Sarcoplasmic Reticulum', tag: 'Calcium store', kind: 'er', color: '#8aa0e0', count: 4, place: [0, 0, 0],
        size: 'Tubular network', location: 'Wraps each myofibril', lm: 'No (EM only)' },
      { id: 'sarcolemma', name: 'Sarcolemma', tag: 'The muscle cell membrane', kind: 'body',
        size: '~ 7 nm thick', location: 'Outer boundary', lm: 'Edge only' }
    ],
    notes: 'Each muscle fibre contains hundreds to thousands of myofibrils running its full length, packed tightly together.',
    fact: 'A single muscle fibre can be up to 30 cm long!',
    micro: { pattern: 'stripes', light: '#e87aa8', stain: '#c0407a' },
    where: { emoji: '🏃', label: 'Skeletal muscles' }
  }
];
