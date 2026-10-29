/* Biology Atlas — app logic.
   Items are defined in items.js; organelle geometry is generated per `kind` below.
   To add a brand-new organelle *look*, add a function to KINDS. */
(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('hpas.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hpas.' + k, JSON.stringify(v)); } catch (e) {} }
};
const CELLS = window.ITEMS;
CELLS.forEach(c => { c.category = c.category || 'Cell'; });
const HAS3D = !!window.THREE;
const T = window.THREE;

/* ------------------------------------------------------------- state */
const S = {
  cellId: store.get('cell', CELLS[0].id), sel: null, mode: 'section', focus: null,
  labels: true, autoRotate: store.get('autorotate', true), compareId: null,
  cat: null, favCells: store.get('favCells', []), favOrg: store.get('favOrg', {}), theme: store.get('theme', 'auto')
};
const cellById = id => CELLS.find(c => c.id === id) || CELLS[0];
const thumbs = {};           // cellId -> dataURL of 3D snapshot

/* ------------------------------------------------------------- helpers */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ======================================================================
   3D ENGINE
   ====================================================================== */
let renderer, scene, camera, clipPlane, root, current, shadowMesh;
const orbit = { az: .6, el: .5, dist: 6, target: HAS3D ? new T.Vector3() : null, g: null };

function superGeo(dims, p, noise, seed, seg) {
  seg = seg || 56;
  const g = new T.SphereGeometry(1, seg, Math.round(seg / 2)), pos = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const r = Math.pow(Math.pow(Math.abs(v.x), p) + Math.pow(Math.abs(v.y), p) + Math.pow(Math.abs(v.z), p), -1 / p);
    let k = r;
    if (noise) k *= 1 + noise * (Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3) + .6 * Math.sin(v.z * 3.7 + seed * .7));
    pos.setXYZ(i, v.x * k * dims[0], v.y * k * dims[1], v.z * k * dims[2]);
  }
  g.computeVertexNormals();
  return g;
}
function capsuleGeo(r, len, seg) {
  seg = seg || 8; const pts = [];
  for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + (Math.PI / 2) * i / seg; pts.push(new T.Vector2(Math.max(Math.cos(a) * r, 0.0001), Math.sin(a) * r - len / 2)); }
  for (let i = 0; i <= seg; i++) { const a = (Math.PI / 2) * i / seg; pts.push(new T.Vector2(Math.max(Math.cos(a) * r, 0.0001), Math.sin(a) * r + len / 2)); }
  return new T.LatheGeometry(pts, 16);
}
function tubeGeo(points, radius, segs, closed) {
  return new T.TubeGeometry(new T.CatmullRomCurve3(points, closed), segs || points.length * 4, radius, 8, !!closed);
}

/* sphere deformed by fn(unitDir) -> unit-space point, then scaled by dims; keeps the unit dirs for region lookups */
function radialGeo(seg, fn, dims) {
  const g = new T.SphereGeometry(1, seg, Math.round(seg / 2)), pos = g.attributes.position, v = new T.Vector3(), dirs = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize(); dirs[i * 3] = v.x; dirs[i * 3 + 1] = v.y; dirs[i * 3 + 2] = v.z;
    const q = fn(v.clone());
    pos.setXYZ(i, q.x * dims[0], q.y * dims[1], q.z * dims[2]);
  }
  g.userData.dirs = dirs; g.computeVertexNormals();
  return g;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* organ body shapes (body.shape). Upright frame: +y up, +z front (anterior), +x the organ's own left. */
const SHAPES = {
  heart: {
    geo(dims, b, seed, seg) {
      return radialGeo(seg, v => {
        const t = (v.y + 1) / 2, lat = .22 + .78 * Math.pow(t, .5);
        let x = v.x * lat, y = v.y, z = v.z * lat * (v.z < 0 ? .86 : 1);
        if (y > .55) y = .55 + (y - .55) * .55;                                   // flatter base where the vessels leave
        const groove = Math.exp(-Math.pow((v.x + .08 + .12 * v.y) / .09, 2)) * smooth(0, .4, v.z) * (1 - smooth(.3, .6, v.y));
        const atria = .07 * Math.exp(-(Math.pow(v.x + .55, 2) + Math.pow(v.y - .55, 2)) / .08) + .05 * Math.exp(-(Math.pow(v.x - .45, 2) + Math.pow(v.y - .5, 2) + Math.pow(v.z + .3, 2)) / .1);
        const k = (1 - .045 * groove + atria) * (1 + (b.noise || 0) * Math.sin(v.x * 4 + seed) * Math.sin(v.y * 3 + seed * 1.3));
        return new T.Vector3(x * k, y * k, z * k);
      }, dims);
    }
  },
  brain: {
    geo(dims, b, seed, seg) {
      return radialGeo(seg, v => {
        let x = v.x * (1 - .1 * Math.max(0, v.z)), y = v.y < 0 ? v.y * .74 : v.y, z = v.z;
        // temporal lobes hang lower at the sides; the frontal base is flatter
        y -= .16 * smooth(.45, .85, Math.abs(v.x)) * smooth(-.6, -.2, v.z) * (1 - smooth(.55, .9, v.z)) * smooth(.3, -.2, v.y);
        if (v.z > .4 && v.y < 0) y *= 1 - .25 * smooth(.4, .9, v.z);
        const fissure = Math.exp(-Math.pow(v.x / .055, 2)) * smooth(-.3, .15, v.y);
        const syl = Math.exp(-Math.pow((v.y - (.04 - .34 * v.z)) / .05, 2)) * smooth(.35, .6, Math.abs(v.x)) * smooth(-.45, -.1, v.z);
        const n = Math.sin(v.x * 7.5 + 2 * Math.sin(v.z * 5 + seed)) + Math.sin(v.y * 8 + 2 * Math.sin(v.x * 5.5)) + Math.sin(v.z * 8.5 + 2 * Math.sin(v.y * 6 + seed));
        const sulci = Math.exp(-Math.pow(n / .3, 2));
        const k = 1 - .2 * fissure - .08 * syl - .06 * sulci;
        return new T.Vector3(x * k, y * k, z * k);
      }, dims);
    },
    region(x, y, z) {
      if (Math.abs(x) > .3 && z > -.6 && y < .02 - .34 * z) return 'temporal';
      if (z < -.62 + .12 * y) return 'occipital';
      if (z > .12 - .22 * y) return 'frontal';
      return 'parietal';
    }
  }
};
function shellGeo(dims, b, seed, seg) {
  return b.shape && SHAPES[b.shape] ? SHAPES[b.shape].geo(dims, b, seed, b.seg || seg) : superGeo(dims, b.p, b.noise, seed, seg);
}
/* generic lump for organ structures: taper (narrower at -y) and ridges (folds around the x axis) */
function blobGeo(o) {
  return radialGeo(o.seg || 40, v => {
    const lat = o.taper ? 1 - o.taper * (1 - (v.y + 1) / 2) : 1;
    let k = 1;
    if (o.ridges) k *= 1 + .045 * Math.sin(Math.atan2(v.y, v.z) * o.ridges) - .12 * Math.exp(-Math.pow(v.x / .1, 2)) * smooth(0, .4, -v.z);
    if (o.noise) k *= 1 + o.noise * Math.sin(v.x * 5 + 1) * Math.sin(v.y * 4 + 2) * Math.sin(v.z * 3 + 3);
    return new T.Vector3(v.x * lat * k, v.y * k, v.z * lat * k);
  }, o.dims || [.3, .3, .3]);
}

// kinds drawn whole even in cross-section (not clipped); a part can override with `clip`
const EXTERNAL = new Set(['axon', 'myelin', 'dendrites', 'terminals', 'flagellum', 'pili', 'microvilli', 'junctions', 'plate', 'blob', 'tube', 'valve', 'node', 'stalk']);

function buildCell(cell) {
  const rng = mulberry32(cell.seed || 1), b = cell.body, dims = b.dims, p = b.p;
  const group = new T.Group();
  const mats = [];            // {m, op, role, part, clip}
  const parts = {};           // organelle id -> Group
  const sc = clamp(Math.min(...dims) / .85, .7, 1.15);
  let cyto = null;

  function mat(color, o) {
    o = o || {};
    const col = new T.Color(color), hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.18 + .06), clamp(hsl.l, .2, .72));
    const m = new T.MeshPhysicalMaterial({
      color: col, roughness: o.rough != null ? o.rough : .42, metalness: 0,
      clearcoat: o.clear != null ? o.clear : .55, clearcoatRoughness: .3, side: o.side || T.DoubleSide,
      transparent: (o.op || 1) < 1, opacity: o.op || 1
    });
    mats.push({ m, op: o.op || 1, role: o.role || 'org', part: o.part, clip: o.clip != null ? o.clip : !EXTERNAL.has(o.kind) });
    return m;
  }
  function sample(k) {
    for (let i = 0; i < 80; i++) {
      const x = rng() * 2 - 1, y = rng() * 2 - 1, z = rng() * 2 - 1;
      if (Math.pow(Math.abs(x), p) + Math.pow(Math.abs(y), p) + Math.pow(Math.abs(z), p) <= Math.pow(k, p)) return new T.Vector3(x * dims[0], y * dims[1], z * dims[2]);
    }
    return new T.Vector3();
  }
  function surface(d) {
    d = d.clone().normalize();
    const r = Math.pow(Math.pow(Math.abs(d.x), p) + Math.pow(Math.abs(d.y), p) + Math.pow(Math.abs(d.z), p), -1 / p);
    return new T.Vector3(d.x * r * dims[0], d.y * r * dims[1], d.z * r * dims[2]);
  }
  function normalAt(pt) {
    const g = new T.Vector3(Math.sign(pt.x) * Math.pow(Math.abs(pt.x / dims[0]), p - 1) / dims[0], Math.sign(pt.y) * Math.pow(Math.abs(pt.y / dims[1]), p - 1) / dims[1], Math.sign(pt.z) * Math.pow(Math.abs(pt.z / dims[2]), p - 1) / dims[2]);
    return g.normalize();
  }
  function placeAt(o, i) {
    if (Array.isArray(o.place) && i === 0) return new T.Vector3(o.place[0] * dims[0], o.place[1] * dims[1], o.place[2] * dims[2]);
    if (o.place === 'edge') { const d = new T.Vector3(rng() * 2 - 1, (rng() - .5) * .8, rng() * 2 - 1); return surface(d).multiplyScalar(.82); }
    return sample(.72);
  }
  const elongated = dims[0] > 2 * Math.min(dims[1], dims[2]);
  function orient(obj) {
    obj.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
    if (elongated) obj.rotation.set(0, rng() * .6, Math.PI / 2 + (rng() - .5) * .4);
  }

  /* --- organelle builders: (o, g) -> add meshes to group g --- */
  const KINDS = {
    nucleus(o, g) {
      const n = o.count || 1;
      for (let i = 0; i < n; i++) {
        const c = new T.Group(); c.position.copy(placeAt(o, i));
        const r = o.r || .5;
        c.add(new T.Mesh(superGeo([r, r * .92, r], 2, .06, i * 3 + 1, 36), mat(o.color, { part: o.id })));
        const pores = new T.InstancedMesh(new T.SphereGeometry(r * .06, 6, 5), mat('#4a2a8a', { part: o.id }), 36), M = new T.Matrix4();
        for (let k = 0; k < 36; k++) { const d = new T.Vector3(rng() - .5, rng() - .5, rng() - .5).normalize().multiplyScalar(r * .98); M.setPosition(d); pores.setMatrixAt(k, M); }
        c.add(pores);
        const nl = new T.Mesh(new T.SphereGeometry(r * .3, 16, 12), mat('#3d1f78', { part: o.id })); nl.position.set(r * .1, 0, 0); c.add(nl);
        g.add(c);
      }
    },
    nucleolus(o, g) {
      const m = new T.Mesh(new T.SphereGeometry(o.r || .14, 16, 12), mat(o.color, { part: o.id }));
      m.position.copy(placeAt(o, 0)).add(new T.Vector3(.08, 0, .05)); g.add(m);
    },
    mito(o, g) {
      for (let i = 0; i < (o.count || 4); i++) {
        const c = new T.Group(); c.position.copy(placeAt(o, i + 1)); orient(c); c.scale.setScalar(sc);
        c.add(new T.Mesh(capsuleGeo(.11, .3), mat(o.color, { part: o.id, op: .86 })));
        const inner = new T.Mesh(capsuleGeo(.07, .27), mat(new T.Color(o.color).offsetHSL(0, 0, .18), { part: o.id }));
        c.add(inner);
        for (let k = -1; k <= 1; k++) { const r = new T.Mesh(new T.CylinderGeometry(.095, .095, .02, 14), mat(new T.Color(o.color).offsetHSL(0, 0, -.12), { part: o.id })); r.position.y = k * .1; c.add(r); }
        g.add(c);
      }
    },
    chloroplast(o, g) {
      for (let i = 0; i < (o.count || 4); i++) {
        const c = new T.Group(); c.position.copy(sample(.8)); c.rotation.set(rng() * .8, rng() * 6.28, rng() * .8); c.scale.setScalar(sc);
        c.add(new T.Mesh(superGeo([.3, .11, .18], 2, 0, 0, 24), mat(o.color, { part: o.id, op: .9 })));
        for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) {
          const gr = new T.Mesh(new T.CylinderGeometry(.04, .04, .045, 10), mat('#2f6f1a', { part: o.id })); gr.position.set(-.14 + k * .14, (j - 1) * .03, (k % 2) * .05 - .02); c.add(gr);
        }
        g.add(c);
      }
    },
    golgi(o, g) {
      for (let n = 0; n < (o.count || 1); n++) {
        const c = new T.Group(); c.position.copy(placeAt(o, n)); c.rotation.set(rng() * .5, rng() * 6.28, rng() * .4); c.scale.setScalar(sc);
        for (let i = 0; i < 5; i++) {
          const s = new T.Mesh(superGeo([.42 - i * .035, .028, .26 - i * .02], 2, 0, 0, 24), mat(new T.Color(o.color).offsetHSL(0, 0, i * .02), { part: o.id }));
          s.position.y = (i - 2) * .075; s.rotation.z = (i - 2) * .05; c.add(s);
        }
        g.add(c);
      }
    },
    er(o, g) {
      for (let i = 0; i < (o.count || 3); i++) {
        const c = placeAt(o, i), dir = new T.Vector3(rng() - .5, (rng() - .5) * .3, rng() - .5).normalize(), up = new T.Vector3(0, 1, 0), side = dir.clone().cross(up).normalize();
        const ph = rng() * 6, len = elongated ? .5 : .3;
        for (let k = -1; k <= 1; k++) {
          const pts = [];
          for (let j = 0; j < 16; j++) pts.push(c.clone().add(dir.clone().multiplyScalar((j - 8) * len / 4)).add(up.clone().multiplyScalar(Math.sin(j * .8 + ph) * .1 + k * .07)).add(side.clone().multiplyScalar(Math.cos(j * .5 + ph) * .12)));
          g.add(new T.Mesh(tubeGeo(pts, .028 * sc, 48), mat(o.color, { part: o.id })));
          if (o.rough && k === 1) {
            const dots = new T.InstancedMesh(new T.SphereGeometry(.022, 6, 5), mat('#ffd36a', { part: o.id }), 18), M = new T.Matrix4();
            for (let j = 0; j < 18; j++) { M.setPosition(pts[Math.min(15, j)].clone().add(new T.Vector3((rng() - .5) * .04, .035, (rng() - .5) * .04))); dots.setMatrixAt(j, M); }
            g.add(dots);
          }
        }
      }
    },
    vacuole(o, g) {
      const d = o.dims || [.8, .5, .5], m = new T.Mesh(superGeo(d, 2, .05, 3, 40), mat(o.color, { part: o.id, op: .82, clear: 1 }));
      m.position.copy(placeAt(o, 0)); g.add(m);
    },
    dots(o, g) {
      const n = o.count || 20, r = o.r || .05, im = new T.InstancedMesh(new T.SphereGeometry(r, 10, 8), mat('#ffffff', { part: o.id }), n), M = new T.Matrix4(), col = new T.Color();
      for (let i = 0; i < n; i++) {
        M.makeScale(1 + rng() * .5, 1 + rng() * .5, 1 + rng() * .5); M.setPosition(sample(.88)); im.setMatrixAt(i, M);
        im.setColorAt(i, col.set(o.colors ? o.colors[Math.floor(rng() * o.colors.length)] : o.color).offsetHSL((rng() - .5) * .05, 0, (rng() - .5) * .1));
      }
      g.add(im);
    },
    microvilli(o, g) {
      const n = o.count || 60, cols = Math.ceil(Math.sqrt(n)), im = new T.InstancedMesh(capsuleGeo(.035, .42), mat(o.color, { part: o.id, kind: 'microvilli' }), cols * cols), M = new T.Matrix4(), Q = new T.Quaternion(), S3 = new T.Vector3(), P = new T.Vector3();
      let k = 0;
      for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) {
        const x = ((i + .5) / cols * 2 - 1) * dims[0] * .85, z = ((j + .5) / cols * 2 - 1) * dims[2] * .85, h = .7 + rng() * .7;
        P.set(x + (rng() - .5) * .04, dims[1] + .12 * h, z + (rng() - .5) * .04); S3.set(1, h, 1);
        Q.setFromEuler(new T.Euler((rng() - .5) * .12, 0, (rng() - .5) * .12)); M.compose(P, Q, S3); im.setMatrixAt(k++, M);
      }
      g.add(im);
    },
    junctions(o, g) {
      const m = mat(o.color, { part: o.id, kind: 'junctions' }), y = dims[1] * .8, w = dims[0] * 1.02, d = dims[2] * 1.02;
      [[0, y, d, w * 2, .07, .07], [0, y, -d, w * 2, .07, .07], [w, y, 0, .07, .07, d * 2], [-w, y, 0, .07, .07, d * 2]].forEach(a => {
        const mesh = new T.Mesh(new T.BoxGeometry(a[3], a[4], a[5]), m); mesh.position.set(a[0], a[1], a[2]); g.add(mesh);
      });
    },
    plate(o, g) {
      const m = new T.Mesh(new T.BoxGeometry(dims[0] * 2.6, .08, dims[2] * 2.6), mat(o.color, { part: o.id, kind: 'plate' }));
      m.position.y = -dims[1] - .06; g.add(m);
      const m2 = new T.Mesh(new T.BoxGeometry(dims[0] * 2.5, .05, dims[2] * 2.5), mat('#c79ad0', { part: o.id, kind: 'plate' })); m2.position.y = -dims[1] - .14; g.add(m2);
    },
    nucleoid(o, g) {
      for (let k = 0; k < 2; k++) {
        const pts = [], ph = k * 1.7;
        for (let j = 0; j < 60; j++) { const t = j / 60 * Math.PI * 6; pts.push(new T.Vector3(dims[0] * .5 * Math.sin(t * 1 + ph) * Math.cos(t * .37), dims[1] * .42 * Math.sin(t * 2.3 + ph), dims[2] * .42 * Math.cos(t * 1.7))); }
        g.add(new T.Mesh(tubeGeo(pts, .032, 260, true), mat(o.color, { part: o.id })));
      }
    },
    flagellum(o, g) {
      const pts = []; for (let j = 0; j < 26; j++) pts.push(new T.Vector3(dims[0] * .92 + j * .09, .22 * Math.sin(j * .55) * (1 + j * .04), .14 * Math.cos(j * .55)));
      g.add(new T.Mesh(tubeGeo(pts, .028, 120), mat(o.color, { part: o.id, kind: 'flagellum' })));
    },
    pili(o, g) {
      const n = o.count || 30, im = new T.InstancedMesh(new T.CylinderGeometry(.01, .01, .3, 5), mat(o.color, { part: o.id, kind: 'pili' }), n), M = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), one = new T.Vector3(1, 1, 1);
      for (let i = 0; i < n; i++) {
        const pt = surface(new T.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1)), nm = normalAt(pt);
        Q.setFromUnitVectors(Y, nm); M.compose(pt.clone().add(nm.clone().multiplyScalar(.14)), Q, one); im.setMatrixAt(i, M);
      }
      g.add(im);
    },
    myofibril(o, g) {
      const n = o.count || 12, rr = Math.min(dims[1], dims[2]) * .8, r = rr * .95 / Math.sqrt(n) * 1.1, L = dims[0] * 1.6;
      const stripe = new T.InstancedMesh(new T.CylinderGeometry(r * 1.05, r * 1.05, .035, 14), mat('#7a1f3a', { part: o.id }), n * 18), M = new T.Matrix4(), Q = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2)), one = new T.Vector3(1, 1, 1);
      let s = 0;
      for (let k = 0; k < n; k++) {
        const rad = rr * Math.sqrt((k + .5) / n), th = k * 2.39996, y = Math.cos(th) * rad, z = Math.sin(th) * rad;
        const cyl = new T.Mesh(new T.CylinderGeometry(r, r, L, 14), mat(new T.Color(o.color).offsetHSL(0, 0, (rng() - .5) * .08), { part: o.id }));
        cyl.rotation.z = Math.PI / 2; cyl.position.set(0, y, z); g.add(cyl);
        for (let j = 0; j < 18; j++) { M.compose(new T.Vector3(-L / 2 + (j + .5) * L / 18, y, z), Q, one); stripe.setMatrixAt(s++, M); }
      }
      g.add(stripe);
    },
    axon(o, g) {
      const x0 = dims[0] * .7, pts = []; for (let j = 0; j < 12; j++) pts.push(new T.Vector3(x0 + j * (o.len / 11), Math.sin(j * .6) * .04, 0));
      g.add(new T.Mesh(tubeGeo(pts, .055, 80), mat(o.color, { part: o.id, kind: 'axon' })));
    },
    myelin(o, g) {
      const n = o.count || 6, x0 = dims[0] * .7 + .45, span = 2.9 / n;
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(capsuleGeo(.13, span * .55, 8), mat(o.color, { part: o.id, kind: 'myelin', op: .95 })); m.rotation.z = Math.PI / 2; m.position.set(x0 + i * span + span * .45, 0, 0); g.add(m);
      }
    },
    dendrites(o, g) {
      const m = mat(o.color, { part: o.id, kind: 'dendrites' });
      function branch(o0, dir, len, rad, depth) {
        const mid = o0.clone().add(dir.clone().multiplyScalar(len * .5)).add(new T.Vector3(rng() - .5, rng() - .5, rng() - .5).multiplyScalar(len * .35));
        const end = o0.clone().add(dir.clone().multiplyScalar(len));
        g.add(new T.Mesh(tubeGeo([o0, mid, end], rad, 14), m));
        if (depth > 0) { const k = 2 + (rng() < .4 ? 1 : 0); for (let i = 0; i < k; i++) branch(end, dir.clone().add(new T.Vector3(rng() - .5, rng() - .5, rng() - .5).multiplyScalar(1.1)).normalize(), len * .68, rad * .68, depth - 1); }
      }
      for (let i = 0; i < (o.count || 5); i++) {
        const d = new T.Vector3(-.5 - rng(), (rng() - .5) * 2, (rng() - .5) * 2).normalize();
        branch(d.clone().multiplyScalar(dims[0] * .85), d, .6, .05, 3);
      }
    },
    terminals(o, g) {
      const m = mat(o.color, { part: o.id, kind: 'terminals' }), x = dims[0] * .7 + 3.4;
      for (let i = 0; i < (o.count || 5); i++) {
        const a = i / (o.count || 5) * Math.PI * 2, end = new T.Vector3(x + .55 + rng() * .25, Math.cos(a) * .38, Math.sin(a) * .38);
        g.add(new T.Mesh(tubeGeo([new T.Vector3(x, 0, 0), new T.Vector3(x + .3, Math.cos(a) * .15, Math.sin(a) * .15), end], .028, 14), m));
        const bulb = new T.Mesh(new T.SphereGeometry(.075, 12, 10), m); bulb.position.copy(end); g.add(bulb);
      }
    },
    /* --- organ kinds: positions are absolute (`at`), `mirror` repeats a part on the other side (x -> -x) --- */
    blob(o, g) {
      sides(o).forEach(s => {
        const m = new T.Mesh(blobGeo(o), pm(o, null, { op: o.op }));
        m.position.set(o.at[0] * s, o.at[1], o.at[2]); if (o.rot) m.rotation.set(o.rot[0], o.rot[1] * s, o.rot[2] * s); g.add(m);
      });
    },
    tube(o, g) {
      const m = pm(o);
      const one = (path, r, s) => {
        let pts = path.map(p => new T.Vector3(p[0] * s, p[1], p[2]));
        if (o.surface) pts = new T.CatmullRomCurve3(pts).getPoints(pts.length * 8).map(onShell);
        const t = new T.Mesh(tubeGeo(pts, r, pts.length * 6), m); if (o.flat) t.scale.x = o.flat; g.add(t);
        if (!o.open) [pts[0], pts[pts.length - 1]].forEach(p => { const c = new T.Mesh(new T.SphereGeometry(r, 12, 10), m); c.position.copy(p); if (o.flat) { c.position.x *= o.flat; c.scale.x = o.flat; } g.add(c); });
      };
      sides(o).forEach(s => { one(o.path, o.r || .1, s); (o.branches || []).forEach(br => one(br, (o.r || .1) * .62, s)); });
    },
    valve(o, g) {
      const r = o.r || .2, n = o.cusps || 3, c = new T.Group();
      const ring = new T.Mesh(new T.TorusGeometry(r, r * .13, 8, 32), pm(o)); ring.rotation.x = Math.PI / 2; c.add(ring);
      const leaf = pm(o, new T.Color(o.color).offsetHSL(0, 0, .1).getStyle());
      for (let i = 0; i < n; i++) {
        const cusp = new T.Mesh(new T.SphereGeometry(r * .96, 12, 6, i * 6.283 / n + .04, 6.283 / n - .08, Math.PI / 2, Math.PI / 2.1), leaf);
        cusp.scale.y = .55; c.add(cusp);
      }
      c.position.set(...o.at); if (o.rot) c.rotation.set(...o.rot); g.add(c);
    },
    node(o, g) {
      const core = new T.Mesh(new T.SphereGeometry(o.r || .06, 16, 12), pm(o)); core.position.set(...o.at); g.add(core);
      const halo = new T.Mesh(new T.SphereGeometry((o.r || .06) * 2, 16, 12), pm(o, null, { op: .3 })); halo.position.set(...o.at); g.add(halo);
    },
    stalk(o, g) {
      const prof = o.profile, L = o.len || 1, pts = prof.map((r, i) => new T.Vector2(Math.max(r, .0001), -L * i / (prof.length - 1)));
      const m = new T.Mesh(new T.LatheGeometry(new T.SplineCurve(pts).getPoints(prof.length * 6), 24), pm(o));
      m.position.set(...o.at); if (o.rot) m.rotation.set(...o.rot); g.add(m);
    },
    lobe(o, g) {
      // re-uses the body shell's vertices; keeps only the triangles whose direction falls in this region
      const src = shellMesh.geometry, d = src.userData.dirs, idx = src.index.array, keep = [], region = SHAPES[b.shape].region;
      for (let i = 0; i < idx.length; i += 3) {
        let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { const j = idx[i + k] * 3; x += d[j]; y += d[j + 1]; z += d[j + 2]; }
        if (region(x / 3, y / 3, z / 3) === o.region) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', src.attributes.position); geo.setAttribute('normal', src.attributes.normal); geo.setIndex(keep);
      const m = new T.Mesh(geo, pm(o, null, { role: 'shell', side: T.FrontSide, rough: .55 })); m.scale.setScalar(1.004); g.add(m);
    },
    body() { /* handled separately */ }
  };
  function pm(o, color, x) { return mat(color || o.color, Object.assign({ part: o.id, kind: o.kind, clip: o.clip }, x)); }
  function sides(o) { return o.mirror ? [1, -1] : [1]; }
  // projects a point onto the body surface along its direction from the centre (for vessels lying on an organ)
  const ray = new T.Raycaster();
  function onShell(p) {
    const dir = p.clone().normalize(); ray.set(dir.clone().multiplyScalar(8), dir.clone().negate());
    const h = ray.intersectObject(shellMesh, false)[0];
    return h ? h.point.add(h.face.normal.multiplyScalar(.035)) : p;
  }
  group.userData.kinds = KINDS;

  /* --- body shell(s) --- */
  const bodyDef = cell.organelles.find(o => o.kind === 'body') || { id: '__body', color: b.layers[0].color };
  const bodyGroup = new T.Group(); bodyGroup.userData.oid = bodyDef.id; parts[bodyDef.id] = bodyGroup;
  let shellMesh = null;
  b.layers.forEach((l, i) => {
    const m = mat(l.color, { op: l.opacity, role: 'shell', part: bodyDef.id, side: T.FrontSide, rough: .5 });
    const mesh = new T.Mesh(shellGeo([dims[0] * l.s, dims[1] * l.s, dims[2] * l.s], b, cell.seed, 72), m);
    if (l.opacity < 1) mesh.renderOrder = 2;
    bodyGroup.add(mesh); if (!i) shellMesh = mesh;
  });
  cyto = new T.Mesh(shellGeo(dims.map(d => d * .975), b, cell.seed, 56), mat(b.cyto, { role: 'cyto', side: T.BackSide, rough: .8, clear: 0, part: '__cyto' }));
  group.add(cyto); group.add(bodyGroup);

  /* --- organelles --- */
  const partOf = {};          // sub-part id -> parent part id (selecting the parent highlights its sub-parts)
  cell.organelles.forEach(o => {
    if (o.of) partOf[o.id] = o.of;
    if (o.kind === 'body') return;
    const g = new T.Group(); g.userData.oid = o.id; parts[o.id] = g;
    (KINDS[o.kind] || (() => {}))(o, g); group.add(g);
  });

  if (cell.tilt) { group.rotation.set(...cell.tilt); group.updateMatrixWorld(true); }
  const box = new T.Box3().setFromObject(bodyGroup), planeC = .12 * Math.max(...dims);
  return { group, mats, parts, partOf, cyto, cell, box, planeC, sc };
}

/* applies mode / focus / selection to a built cell */
function applyState(C, mode, focus, sel, plane) {
  const hit = id => !!sel && (id === sel || C.partOf[id] === sel);
  C.mats.forEach(e => {
    let op = e.op;
    if (e.role === 'shell' && mode === 'xray') op = Math.min(op, .2);
    const dim = focus === 'isolate' && sel && !hit(e.part) && e.role !== 'cyto';
    if (dim) op *= .12;
    const m = e.m;
    m.opacity = op; m.transparent = op < .999; m.depthWrite = op > .55;
    const clip = mode === 'section' && e.clip;
    const want = clip ? [plane] : null;
    if ((m.clippingPlanes ? 1 : 0) !== (want ? 1 : 0)) m.needsUpdate = true;
    m.clippingPlanes = want;
    m.emissive.copy(m.color); m.emissiveIntensity = hit(e.part) ? .45 : (e.role === 'cyto' ? .22 : .1);
  });
  Object.keys(C.parts).forEach(id => { C.parts[id].visible = !(focus === 'hide' && sel && !hit(id)); });
  C.cyto.visible = mode !== 'xray' && !focus;
}

function addLights(sc) {
  sc.add(new T.HemisphereLight(0xfff2ff, 0x9fd0ff, .9));
  const key = new T.DirectionalLight(0xfff0d8, .9); key.position.set(3, 6, 4); sc.add(key);
  const mag = new T.DirectionalLight(0xff7ad9, .55); mag.position.set(-5, 1, -2); sc.add(mag);
  const cy = new T.DirectionalLight(0x6fe0ff, .5); cy.position.set(2, 3, -5); sc.add(cy);
}
function initGL() {
  const canvas = $('#gl');
  renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.localClippingEnabled = true;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(35, 1, .1, 100);
  addLights(scene);
  clipPlane = new T.Plane(new T.Vector3(-1, -.15, -.7).normalize(), 0);
  root = new T.Group(); scene.add(root);
  // soft contact shadow
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(60,40,20,.28)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  shadowMesh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadowMesh.rotation.x = -Math.PI / 2; scene.add(shadowMesh);
  resize();
  new ResizeObserver(resize).observe($('#viewer'));
  bindOrbit(canvas);
  requestAnimationFrame(loop);
}
function resize() {
  if (!renderer) return;
  const v = $('#viewer'), w = v.clientWidth, h = v.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

function loadCell(cell) {
  if (!HAS3D) return;
  if (current) { root.remove(current.group); }
  current = buildCell(cell); root.add(current.group);
  const d = current.box, ext = Math.max(d.max.x - d.min.x, d.max.y - d.min.y, d.max.z - d.min.z);
  clipPlane.constant = current.planeC;
  const cam = cell.cam || {};
  orbit.g = { az: cam.az != null ? cam.az : .6, el: cam.el != null ? cam.el : .5, dist: cam.dist || 6, target: new T.Vector3(...(cam.target || [0, 0, 0])) };
  orbit.home = JSON.parse(JSON.stringify({ az: orbit.g.az, el: orbit.g.el, dist: orbit.g.dist, t: orbit.g.target.toArray() }));
  if (!orbit.cur) orbit.cur = { az: orbit.g.az, el: orbit.g.el, dist: orbit.g.dist, target: orbit.g.target.clone() };
  shadowMesh.visible = cell.id !== 'neuron';
  const low = cell.category === 'Cell' ? d.min.y : new T.Box3().setFromObject(current.group).min.y;   // organs have parts below the body
  shadowMesh.scale.set(ext * 1.5, ext * 1.5, 1); shadowMesh.position.y = low - (cell.id === 'epithelial' ? .3 : .06);
  refreshState();
}
function refreshState() { if (current) applyState(current, S.mode, S.focus, S.sel, clipPlane); }

function bindOrbit(el) {
  let down = null, moved = 0;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); down = { x: e.clientX, y: e.clientY, pan: e.ctrlKey || e.shiftKey || e.button === 2 }; moved = 0; orbit.hold = true; });
  el.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down.x = e.clientX; down.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (down.pan) {
      const k = orbit.g.dist * .0016, right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0), up = new T.Vector3().setFromMatrixColumn(camera.matrix, 1);
      orbit.g.target.add(right.multiplyScalar(-dx * k)).add(up.multiplyScalar(dy * k));
    } else { orbit.g.az -= dx * .008; orbit.g.el = clamp(orbit.g.el + dy * .008, -1.4, 1.4); }
  });
  const up = e => { if (!down) return; down = null; orbit.hold = false; if (moved < 5) pick(e); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', () => { down = null; orbit.hold = false; });
  el.addEventListener('wheel', e => { e.preventDefault(); orbit.g.dist = clamp(orbit.g.dist * Math.exp(e.deltaY * .0012), 2, 20); }, { passive: false });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function pick(e) {
  if (!current) return;
  const r = $('#gl').getBoundingClientRect(), ndc = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
  const ray = new T.Raycaster(); ray.setFromCamera(ndc, camera);
  const objs = []; current.group.traverse(o => { if ((o.isMesh) && o.visible && isVis(o)) objs.push(o); });
  const hits = ray.intersectObjects(objs, false);
  for (const h of hits) {
    if (h.object === current.cyto) continue;
    // respect the clipping plane
    if (S.mode === 'section' && h.object.material.clippingPlanes && clipPlane.distanceToPoint(h.point) < 0) continue;
    let o = h.object; while (o && !(o.userData && o.userData.oid)) o = o.parent;
    if (o) { selectOrg(o.userData.oid); return; }
  }
}
function partBounds(part) {
  if (part.userData.bb) return part.userData.bb;
  const b = new T.Box3(), tmp = new T.Box3(), M = new T.Matrix4(), IM = new T.Matrix4();
  part.updateWorldMatrix(true, true);
  part.traverse(o => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, IM); M.multiplyMatrices(o.matrixWorld, IM); tmp.copy(o.geometry.boundingBox).applyMatrix4(M); b.union(tmp); } }
    else { tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); b.union(tmp); }
  });
  part.userData.bb = b; return b;
}
function isVis(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

function loop(t) {
  requestAnimationFrame(loop);
  if (!current) return;
  const c = orbit.cur, g = orbit.g;
  if (S.autoRotate && !orbit.hold && !S.focus) g.az += .0016;
  c.az += (g.az - c.az) * .12; c.el += (g.el - c.el) * .12; c.dist += (g.dist - c.dist) * .12; c.target.lerp(g.target, .12);
  camera.position.set(c.target.x + c.dist * Math.sin(c.az) * Math.cos(c.el), c.target.y + c.dist * Math.sin(c.el), c.target.z + c.dist * Math.cos(c.az) * Math.cos(c.el));
  camera.lookAt(c.target);
  renderer.render(scene, camera);
  updateLabel();
}
function updateLabel() {
  const el = $('#org-label');
  const part = S.sel && current && current.parts[S.sel];
  if (!S.labels || !part || !isVis(part) || S.sel === '__body') { el.hidden = true; return; }
  const ctr = partBounds(part).getCenter(new T.Vector3()).project(camera), v = $('#viewer');
  if (ctr.z > 1) { el.hidden = true; return; }
  el.hidden = false; el.style.left = ((ctr.x + 1) / 2 * v.clientWidth) + 'px'; el.style.top = ((1 - ctr.y) / 2 * v.clientHeight) + 'px';
}

/* snapshots for list thumbnails / compare / "where it occurs" */
function makeThumbs() {
  if (!HAS3D) return;
  try {
    const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); r.setSize(150, 150); r.setPixelRatio(1); r.localClippingEnabled = true; r.outputEncoding = T.sRGBEncoding;
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, .1, 100), pl = new T.Plane(new T.Vector3(-1, -.15, -.7).normalize(), 0);
    addLights(sc);
    CELLS.forEach(cell => {
      const C = buildCell(cell); pl.constant = C.planeC; applyState(C, 'section', null, null, pl); sc.add(C.group);
      const sph = C.box.getBoundingSphere(new T.Sphere()), cm = cell.cam || {};
      if (cell.id === 'neuron') { const bb = new T.Box3().setFromObject(C.group).getBoundingSphere(new T.Sphere()); sph.copy(bb); }
      const az = cm.az != null ? cm.az : .6, el = cm.el != null ? cm.el : .5, d = sph.radius * 2.7;
      cam.position.set(sph.center.x + d * Math.sin(az) * Math.cos(el), sph.center.y + d * Math.sin(el), sph.center.z + d * Math.cos(az) * Math.cos(el)); cam.lookAt(sph.center);
      r.render(sc, cam); thumbs[cell.id] = r.domElement.toDataURL('image/png'); sc.remove(C.group);
    });
    r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
  } catch (e) { console.warn('thumbs failed', e); }
  renderCellList(); renderCompare(); renderWhere();
}

/* ======================================================================
   MICROSCOPE IMAGES (procedural)
   ====================================================================== */
function microImage(cell, kind) {
  const W = 320, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = mulberry32((cell.seed || 1) * 7 + (kind === 'light' ? 1 : 2));
  const m = cell.micro, base = kind === 'light' ? m.light : m.stain;
  x.fillStyle = kind === 'light' ? '#eef5de' : '#f6e4f2'; x.fillRect(0, 0, W, H);
  const dark = base, pale = kind === 'light' ? '#d8eba8' : '#f2c8e4';
  function disc(px, py, rad, fill, stroke) { x.beginPath(); x.arc(px, py, rad, 0, 6.283); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); } }
  switch (m.pattern) {
    case 'honeycomb': { const s = 44; for (let j = -1; j < H / (s * .87) + 1; j++) for (let i = -1; i < W / s + 1; i++) { const px = i * s + (j % 2) * s / 2 + (r() - .5) * 6, py = j * s * .87 + (r() - .5) * 6; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + .52; x.lineTo(px + Math.cos(a) * s * .55, py + Math.sin(a) * s * .55); } x.closePath(); x.fillStyle = pale; x.fill(); x.strokeStyle = dark; x.lineWidth = 3; x.stroke(); disc(px, py, 5 + r() * 3, dark); } break; }
    case 'blobs': for (let i = 0; i < 38; i++) { const px = r() * W, py = r() * H, rad = 12 + r() * 14; disc(px, py, rad, pale, dark); disc(px + 2, py, rad * .55, dark); } break;
    case 'rods': for (let i = 0; i < 90; i++) { const px = r() * W, py = r() * H, a = r() * 3.14; x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = r() < .5 ? dark : pale; x.strokeStyle = dark; x.lineWidth = 1.5; x.beginPath(); x.roundRect ? x.roundRect(-13, -4, 26, 8, 4) : x.rect(-13, -4, 26, 8); x.fill(); x.stroke(); x.restore(); } break;
    case 'branches': { x.strokeStyle = dark; x.lineCap = 'round'; for (let n = 0; n < 7; n++) { const cx = r() * W, cy = r() * H; disc(cx, cy, 8, dark); (function br(px, py, a, l, w, d) { if (d < 0) return; const nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); br(nx, ny, a + .5 + r() * .4, l * .72, w * .7, d - 1); br(nx, ny, a - .5 - r() * .4, l * .72, w * .7, d - 1); })(cx, cy, r() * 6.28, 34, 3, 3); } break; }
    case 'stripes': { for (let j = 0; j < 9; j++) { const y0 = j * H / 9; x.fillStyle = j % 2 ? pale : dark; x.globalAlpha = .75; x.fillRect(0, y0, W, H / 9 - 2); x.globalAlpha = 1; } x.strokeStyle = dark; x.lineWidth = 1.5; for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo(i * 8 + r() * 3, 0); x.lineTo(i * 8 + r() * 3, H); x.stroke(); } break; }
  }
  if (kind === 'em') {
    const id = x.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) { let g = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11); g = clamp((g - 110) * 1.3 + 100 + (r() - .5) * 60, 10, 235); d[i] = d[i + 1] = d[i + 2] = g; }
    x.putImageData(id, 0, 0);
  }
  return c.toDataURL('image/jpeg', .85);
}
const microCache = {};
function microFor(cell, kind) { const k = cell.id + kind; return microCache[k] || (microCache[k] = microImage(cell, kind === 'em' ? 'em' : kind)); }

/* ======================================================================
   UI RENDERING
   ====================================================================== */
const cur = () => cellById(S.cellId);
const tintOf = c => c.accent + '22';

const categories = () => [...new Set(CELLS.map(c => c.category))];
function renderCellList() {
  const cats = categories(), ac = cur().category; S.cat = S.cat && cats.includes(S.cat) ? S.cat : ac;
  $('#list-title').textContent = '🌿 ' + S.cat.toUpperCase() + ' TYPES';
  $('#cats').innerHTML = cats.length > 1 ? cats.map(k => `<button data-cat="${k}" class="${k === S.cat ? 'on' : ''}">${k}s</button>`).join('') : '';
  $('#cell-list').innerHTML = CELLS.filter(c => c.category === S.cat).map(c => {
    const t = thumbs[c.id], fav = S.favCells.includes(c.id);
    return `<li class="cell-item ${c.id === S.cellId ? 'active' : ''}" data-id="${c.id}" style="--accent:${c.accent};--tint:${tintOf(c)}">
      ${t ? `<img src="${t}" alt="">` : '<div class="ph"></div>'}
      <div><b>${c.name}</b><small>${c.type}</small></div>
      <button class="star ${fav ? 'on' : ''}" data-star="${c.id}" title="Favourite">${fav ? '★' : '☆'}</button></li>`;
  }).join('');
}
function renderOrganelleList() {
  const c = cur();
  $('#organelle-list').innerHTML = shown(c).map(o => `<li data-oid="${o.id}" class="${o.id === S.sel ? 'active' : ''}"><span class="dot" style="background:${o.color || c.body.layers[0].color}"></span>${o.name}</li>`).join('');
}
const partWord = c => c.category === 'Cell' ? 'Organelle' : 'Part';
function orgColor(o) { return o.color || cur().body.layers[0].color; }
function renderDetail() {
  const c = cur(), o = shown(c).find(x => x.id === S.sel) || shown(c)[0], fav = !!S.favOrg[c.id + ':' + o.id], col = orgColor(o);
  $('#detail-panel').innerHTML = `<h2 class="sec">${partWord(c).toUpperCase()} DETAILS <button class="heart ${fav ? 'on' : ''}" id="heart" title="Save">${fav ? '♥' : '♡'}</button></h2>
    <div class="org-head"><div class="org-ico" style="background:radial-gradient(circle at 35% 30%,#fff9,${col} 55%,${col})"></div><div><b>${o.name}</b><small>${o.tag || ''}</small></div></div>
    <dl class="kv"><dt>Size</dt><dd>${o.size || '—'}</dd><dt>Location</dt><dd>${o.location || '—'}</dd>${o.fn ? `<dt>Function</dt><dd>${o.fn}</dd>` : `<dt>Visible in LM</dt><dd>${o.lm || '—'}</dd>`}
    <dt>Label</dt><dd class="sw"><input type="checkbox" class="switch" id="sw-label" ${S.labels ? 'checked' : ''}><span class="dot" style="background:${col}"></span></dd></dl>`;
  $('#org-label').textContent = o.name; $('#org-label').style.setProperty('--lc', col);
}
function renderNotes() {
  const c = cur();
  $('#notes-panel').innerHTML = `<h2 class="sec">BIOLOGICAL NOTES</h2><p class="notes-text">${c.notes}</p><p class="fun"><span>Fun fact: ${c.fact}</span><span>✦</span></p>`;
}
function renderWhere() {
  const c = cur(), t = thumbs[c.id];
  $('#where-panel').innerHTML = `<h2 class="sec">WHERE IT OCCURS</h2><div class="where"><span class="emo">${c.where.emoji}</span>
    <svg viewBox="0 0 200 96" preserveAspectRatio="none"><path d="M60 80 L120 22"/><path d="M60 80 L128 66"/></svg>
    <div class="zoom">${t ? `<img src="${t}" alt="">` : ''}</div><small>${c.where.label}</small></div>`;
}
function renderMicro() {
  const c = cur(), user = store.get('img.' + c.id, []);
  const base = [['light', 'Light Microscope'], ['stain', 'Stained Selection'], ['em', 'Electron Microscope']];
  $('#micro-row').innerHTML = base.map(([k, n]) => `<figure data-src="${microFor(c, k)}" data-cap="${n}"><img src="${microFor(c, k)}" alt="${n}"><figcaption>${n}</figcaption></figure>`).join('')
    + user.map((u, i) => `<figure data-src="${u}" data-cap="Your image"><img src="${u}" alt=""><figcaption>Your image</figcaption><span class="del" data-del="${i}">×</span></figure>`).join('')
    + `<button class="add-tile" id="add-img"><b>+</b>Add Image</button>`;
}
function renderCompare() {
  const a = cur(); if (!S.compareId || S.compareId === a.id) S.compareId = (CELLS.find(c => c.id !== a.id) || a).id;
  const b = cellById(S.compareId);
  const set = (p, c, you) => { const im = $(`#cmp-${p}-img`); if (thumbs[c.id]) im.src = thumbs[c.id]; im.style.visibility = thumbs[c.id] ? 'visible' : 'hidden'; $(`#cmp-${p}-name`).textContent = c.name.length > 14 ? c.name.replace(' Cell', '') : c.name; $(`#cmp-${p}-sub`).textContent = you ? '(You are here)' : c.type; };
  set('a', a, true); set('b', b, false);
}
function applyAccent() { document.documentElement.style.setProperty('--accent', cur().accent); }

/* modal */
function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
const kindLabel = { nucleus: 'Nucleus', nucleolus: 'Nucleolus', mito: 'Mitochondria', chloroplast: 'Chloroplasts', golgi: 'Golgi apparatus', er: 'Endoplasmic reticulum', vacuole: 'Large vacuole', dots: 'Ribosomes / vesicles', microvilli: 'Microvilli', junctions: 'Cell junctions', plate: 'Basement membrane', nucleoid: 'Nucleoid (free DNA)', flagellum: 'Flagellum', pili: 'Pili', myofibril: 'Myofibrils', axon: 'Axon', myelin: 'Myelin', dendrites: 'Dendrites', terminals: 'Axon terminals', body: 'Outer wall / membrane',
  blob: 'Organ structures', tube: 'Vessels & tracts', valve: 'Heart valves', node: 'Pacemaker nodes', stalk: 'Brainstem', lobe: 'Cerebral lobes' };
const kindInfo = { nucleus: 'Holds the genome and directs cell activity.', mito: 'Makes ATP — the cell’s energy currency.', chloroplast: 'Converts light into chemical energy.', golgi: 'Modifies, sorts and ships proteins.', er: 'Folds proteins (rough) or makes lipids (smooth).', vacuole: 'Stores water and nutrients; keeps the cell firm.', dots: 'Small structures that build or carry cargo.', microvilli: 'Finger-like folds that increase absorptive surface.', nucleoid: 'Region where a prokaryote’s DNA is held.', flagellum: 'Whip-like motor for swimming.', pili: 'Hair-like surface fibres for attachment.', myofibril: 'Contractile bundles that shorten to produce force.', axon: 'Carries electrical signals away from the cell body.', dendrites: 'Branches that receive incoming signals.',
  valve: 'One-way flaps that keep blood flowing forward.', node: 'Clusters of cells that set and relay the heartbeat.', lobe: 'Regions of the cerebral cortex with different jobs.' };

function openGallery() {
  openModal(`<h3>Gallery</h3><div class="grid-cards">${CELLS.map(c => `<div class="gcard" data-pick="${c.id}">${thumbs[c.id] ? `<img src="${thumbs[c.id]}" alt="">` : '<div class="ph"></div>'}<b>${c.name}</b><small>${c.type}</small></div>`).join('')}</div>`);
}
function openLibrary() {
  const seen = {}; CELLS.forEach(c => shown(c).forEach(o => { (seen[o.kind] = seen[o.kind] || new Set()).add(c.name); }));
  openModal(`<h3>Library</h3>${Object.keys(seen).filter(k => k !== 'body').map(k => `<div class="lib-group"><h4>${kindLabel[k] || k}</h4><p>${kindInfo[k] || ''} <i>Found in: ${[...seen[k]].join(', ')}</i></p></div>`).join('')}`);
}
function openNotebook() {
  const c = cur(); openModal(`<h3>Notebook — ${c.name}</h3><textarea id="nb" placeholder="Your observations, questions, study notes…">${store.get('nb.' + c.id, '')}</textarea><p style="color:var(--muted)">Saved automatically in this browser.</p>`);
  $('#nb').addEventListener('input', e => store.set('nb.' + c.id, e.target.value));
}
function openSettings() {
  openModal(`<h3>Settings</h3>
  <div class="field"><span>Auto-rotate the model</span><input type="checkbox" class="switch" id="set-rot" ${S.autoRotate ? 'checked' : ''}></div>
  <div class="field"><span>Show organelle labels</span><input type="checkbox" class="switch" id="set-lab" ${S.labels ? 'checked' : ''}></div>
  <div class="field"><span>Theme</span><select id="set-theme"><option value="auto">Match system</option><option value="light">Light</option><option value="dark">Dark</option></select></div>`);
  $('#set-theme').value = S.theme;
  $('#set-rot').onchange = e => { S.autoRotate = e.target.checked; store.set('autorotate', S.autoRotate); syncToolbar(); };
  $('#set-lab').onchange = e => { S.labels = e.target.checked; renderDetail(); };
  $('#set-theme').onchange = e => { S.theme = e.target.value; store.set('theme', S.theme); applyTheme(); };
}
function applyTheme() { if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', S.theme); }
function openCompare() {
  const a = cur(), b = cellById(S.compareId), kinds = [...new Set([...shown(a), ...shown(b)].map(o => o.kind))];
  const has = (c, k) => c.organelles.some(o => o.kind === k);
  const head = c => `<div class="cmp-head">${thumbs[c.id] ? `<img src="${thumbs[c.id]}" alt="">` : ''}<b>${c.name}</b><small>${c.type}</small></div>`;
  openModal(`<h3>Compare cells</h3><table class="cmp-table"><tr><th></th><th>${head(a)}</th><th>${head(b)}</th></tr>
    <tr><td>Parts listed</td><td>${shown(a).length - 1}</td><td>${shown(b).length - 1}</td></tr>
    ${kinds.map(k => `<tr><td>${kindLabel[k] || k}</td><td class="${has(a, k) ? 'yes' : 'no'}">${has(a, k) ? '✓' : '—'}</td><td class="${has(b, k) ? 'yes' : 'no'}">${has(b, k) ? '✓' : '—'}</td></tr>`).join('')}
    <tr><td>Notes</td><td>${a.notes}</td><td>${b.notes}</td></tr></table>`);
}
function openComparePicker() {
  openModal(`<h3>Compare ${cur().name} with…</h3><div class="grid-cards">${CELLS.filter(c => c.id !== S.cellId).map(c => `<div class="gcard" data-cmp="${c.id}">${thumbs[c.id] ? `<img src="${thumbs[c.id]}" alt="">` : '<div class="ph"></div>'}<b>${c.name}</b><small>${c.type}</small></div>`).join('')}</div>`);
}

/* ---------------------------------------------------------- actions */
function selectCell(id) {
  S.cellId = id; store.set('cell', id); S.sel = null; S.focus = null; S.cat = cellById(id).category;
  const c = cur(); S.sel = c.organelles[0].id;
  $('#parts-title').textContent = '✦ ' + partWord(c).toUpperCase() + 'S';
  $('#cell-title').textContent = c.name; $('#cell-sub').textContent = c.type;
  applyAccent(); renderCellList(); renderOrganelleList(); renderDetail(); renderNotes(); renderWhere(); renderMicro(); S.compareId = null; renderCompare();
  syncToolbar(); loadCell(c); refreshState();
}
function selectOrg(id) {
  S.sel = id; renderOrganelleList(); renderDetail(); refreshState();
  if (S.focus === 'isolate' && current && current.parts[id]) focusOn(id);
}
function focusOn(id) {
  const part = current.parts[id]; if (!part) return;
  const sp = partBounds(part).getBoundingSphere(new T.Sphere());
  orbit.g.target.copy(sp.center); orbit.g.dist = clamp(sp.radius * 4.2, 2, 14);
}
function resetView() {
  S.focus = null; const h = orbit.home; if (h) { orbit.g.az = h.az; orbit.g.el = h.el; orbit.g.dist = h.dist; orbit.g.target.fromArray(h.t); }
  refreshState(); syncToolbar();
}
function syncToolbar() {
  $$('#vm-btns button').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
  $('#sw-section').checked = S.mode === 'section';
  $('#b-rotate').classList.toggle('on', S.autoRotate); $('#b-isolate').classList.toggle('on', S.focus === 'isolate'); $('#b-hide').classList.toggle('on', S.focus === 'hide');
}
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function screenshot() {
  if (!renderer) return; renderer.render(scene, camera);
  $('#gl').toBlob(b => { if (b) { const u = URL.createObjectURL(b); download(u, cur().id + '.png'); setTimeout(() => URL.revokeObjectURL(u), 2000); } });
}
function exportOBJ() {
  if (!current) return; let out = '# Biology Atlas — ' + cur().name + '\n', vOff = 1, n = 0;
  const v = new T.Vector3(), M = new T.Matrix4(), IM = new T.Matrix4();
  current.group.updateMatrixWorld(true);
  current.group.traverse(o => {
    if (!o.isMesh || !isVis(o) || o === current.cyto) return; n++;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, cnt = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < cnt; k++) {
      M.copy(o.matrixWorld); if (o.isInstancedMesh) { o.getMatrixAt(k, IM); M.multiply(IM); }
      out += `o part_${n}_${k}\n`;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); out += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`; }
      const tri = idx ? idx.count / 3 : pos.count / 3;
      for (let i = 0; i < tri; i++) { const a = idx ? idx.getX(i * 3) : i * 3, b = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, c = idx ? idx.getX(i * 3 + 2) : i * 3 + 2; out += `f ${a + vOff} ${b + vOff} ${c + vOff}\n`; }
      vOff += pos.count;
    }
  });
  const u = URL.createObjectURL(new Blob([out], { type: 'text/plain' })); download(u, cur().id + '.obj'); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function addImage(file) {
  if (!file) return; const rd = new FileReader();
  rd.onload = () => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'), k = Math.min(1, 480 / im.width); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const id = 'img.' + cur().id, list = store.get(id, []); list.push(c.toDataURL('image/jpeg', .8)); store.set(id, list); renderMicro();
  }; im.src = rd.result; }; rd.readAsDataURL(file);
}

/* ---------------------------------------------------------- events */
function bind() {
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { S.cat = b.dataset.cat; renderCellList(); const f = CELLS.find(c => c.category === S.cat); if (f) selectCell(f.id); } });
  $('#cell-list').addEventListener('click', e => {
    const st = e.target.closest('[data-star]');
    if (st) { const id = st.dataset.star, i = S.favCells.indexOf(id); i < 0 ? S.favCells.push(id) : S.favCells.splice(i, 1); store.set('favCells', S.favCells); renderCellList(); return; }
    const li = e.target.closest('[data-id]'); if (li && li.dataset.id !== S.cellId) selectCell(li.dataset.id);
  });
  $('#organelle-list').addEventListener('click', e => { const li = e.target.closest('[data-oid]'); if (li) selectOrg(li.dataset.oid); });
  $('#detail-panel').addEventListener('click', e => { if (e.target.id === 'heart') { const k = S.cellId + ':' + S.sel; S.favOrg[k] = !S.favOrg[k]; store.set('favOrg', S.favOrg); renderDetail(); } });
  $('#detail-panel').addEventListener('change', e => { if (e.target.id === 'sw-label') { S.labels = e.target.checked; } });
  $('#vm-btns').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { S.mode = b.dataset.mode; syncToolbar(); refreshState(); } });
  $('#sw-section').addEventListener('change', e => { S.mode = e.target.checked ? 'section' : 'solid'; syncToolbar(); refreshState(); });
  $('#b-rotate').onclick = () => { S.autoRotate = !S.autoRotate; store.set('autorotate', S.autoRotate); syncToolbar(); };
  $('#b-isolate').onclick = () => { S.focus = S.focus === 'isolate' ? null : 'isolate'; if (S.focus && S.sel) focusOn(S.sel); syncToolbar(); refreshState(); };
  $('#b-hide').onclick = () => { S.focus = S.focus === 'hide' ? null : 'hide'; if (S.focus && S.sel) focusOn(S.sel); syncToolbar(); refreshState(); };
  $('#b-reset').onclick = resetView; $('#b-shot').onclick = screenshot; $('#b-export').onclick = exportOBJ;
  $('#micro-row').addEventListener('click', e => {
    if (e.target.closest('#add-img')) { $('#img-input').click(); return; }
    const del = e.target.closest('[data-del]');
    if (del) { const id = 'img.' + cur().id, l = store.get(id, []); l.splice(+del.dataset.del, 1); store.set(id, l); renderMicro(); return; }
    const f = e.target.closest('figure'); if (f) openModal(`<h3>${f.dataset.cap} — ${cur().name}</h3><div class="lightbox"><img src="${f.dataset.src}" alt=""></div>`);
  });
  $('#img-input').onchange = e => { addImage(e.target.files[0]); e.target.value = ''; };
  $('#open-compare').onclick = openCompare; $('#cmp-b-btn').onclick = openComparePicker;
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal' || e.target.id === 'modal-x') return closeModal();
    const p = e.target.closest('[data-pick]'); if (p) { closeModal(); selectCell(p.dataset.pick); return; }
    const c = e.target.closest('[data-cmp]'); if (c) { S.compareId = c.dataset.cmp; renderCompare(); openCompare(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  $$('[data-nav]').forEach(b => b.addEventListener('click', () => ({ gallery: openGallery, library: openLibrary, notebooks: openNotebook, settings: openSettings })[b.dataset.nav]()));
}

/* ---------------------------------------------------------- boot */
const BEADS = ['#ff5fa2', '#4fc3ff', '#ffb23e', '#9b6bff', '#3ddc97', '#ff7a59'];
CELLS.forEach(c => { if (c.noDecor || c.organelles.some(o => o.decor)) return;
  const v = Math.min(...c.body.dims); c.organelles.push({ id: '_beads', decor: true, kind: 'dots', colors: BEADS, count: Math.round(clamp(v * 55, 14, 60)), r: .04 }); });
const shown = c => c.organelles.filter(o => !o.decor);
applyTheme(); bind();
if (HAS3D) { try { initGL(); } catch (e) { console.error(e); $('#viewer-msg').hidden = false; $('#viewer-msg').textContent = '3D view is unavailable in this browser (WebGL could not start).'; } }
else { $('#viewer-msg').hidden = false; $('#viewer-msg').textContent = 'The 3D engine could not be loaded — check your connection and reload.'; }
selectCell(cellById(S.cellId).id);
setTimeout(makeThumbs, 60);
window.__studio = { S, CELLS };   // handy for debugging / adding cells from the console
})();
