// Hero scene: four example network designs as physical objects, with live traffic.
// Designs are generic reference layouts, not any real site.
import * as THREE from "three";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { CSS2DRenderer, CSS2DObject } from "./vendor/CSS2DRenderer.js";

const hero = document.querySelector(".hero");
const mount = document.getElementById("scene");
const hud = document.querySelector(".hud");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { return false; }
}

if (hero && mount && hud && webglOK()) init();

function init() {
  hero.classList.add("has-3d"); // make the mount visible before measuring it
  // ---------- Designs, drawn on a 480 x 340 plan (same as the SVG fallback) ----------
  const DESIGNS = [
    {
      name: "Segmented office",
      caption: "Staff, servers and visitors only reach each other through firewall rules",
      nodes: [
        { x: 180, y: 16, w: 120, h: 44, t: "Internet", k: "edge" },
        { x: 180, y: 100, w: 120, h: 44, t: "Firewall", k: "key" },
        { x: 180, y: 184, w: 120, h: 44, t: "Switch" },
        { x: 24, y: 272, w: 128, h: 44, t: "Staff", k: "zone" },
        { x: 176, y: 272, w: 128, h: 44, t: "Servers", k: "zone" },
        { x: 328, y: 272, w: 128, h: 44, t: "Visitors", k: "zone" },
      ],
      links: [
        [[240, 60], [240, 100]], [[240, 144], [240, 184]], [[240, 228], [240, 248]],
        [[88, 248], [392, 248]], [[88, 248], [88, 272]], [[240, 248], [240, 272]], [[392, 248], [392, 272]],
      ],
      flows: [
        { p: [[240, 38], [240, 248], [88, 248], [88, 294]] },
        { p: [[240, 38], [240, 294]] },
        { p: [[392, 294], [392, 248], [240, 248], [240, 38]] },
      ],
    },
    {
      name: "Redundant edge",
      caption: "Two internet links and a standby firewall, so one failure is not an outage",
      nodes: [
        { x: 40, y: 16, w: 120, h: 44, t: "ISP A", k: "edge" },
        { x: 320, y: 16, w: 120, h: 44, t: "ISP B", k: "edge" },
        { x: 40, y: 128, w: 140, h: 52, t: "Firewall", s: "active", k: "ok" },
        { x: 300, y: 128, w: 140, h: 52, t: "Firewall", s: "standby", k: "standby" },
        { x: 170, y: 256, w: 140, h: 44, t: "Core switch" },
      ],
      links: [
        [[100, 60], [100, 96]], [[380, 60], [380, 96]], [[100, 96], [380, 96]], [[110, 96], [110, 128]],
        [[110, 180], [110, 220], [220, 220], [220, 256]],
        { p: [[370, 96], [370, 128]], dash: true },
        { p: [[370, 180], [370, 220], [260, 220], [260, 256]], dash: true },
      ],
      flows: [
        { p: [[100, 38], [100, 96], [110, 96], [110, 220], [220, 220], [220, 278]] },
        { p: [[380, 38], [380, 96], [110, 96], [110, 220], [220, 220], [220, 278]] },
      ],
    },
    {
      name: "Multi-site VPN",
      caption: "Branches and remote staff joined to head office over encrypted tunnels",
      nodes: [
        { x: 160, y: 40, w: 160, h: 52, t: "Head office", s: "VPN hub", k: "key" },
        { x: 24, y: 248, w: 128, h: 44, t: "Branch A", k: "zone" },
        { x: 176, y: 248, w: 128, h: 44, t: "Branch B", k: "zone" },
        { x: 328, y: 248, w: 128, h: 44, t: "Remote staff", k: "zone" },
      ],
      links: [
        { p: [[240, 92], [88, 248]], dash: true },
        { p: [[240, 92], [240, 248]], dash: true },
        { p: [[240, 92], [392, 248]], dash: true },
      ],
      flows: [
        { p: [[88, 270], [240, 66]], amber: true },
        { p: [[240, 66], [240, 270]], amber: true },
        { p: [[392, 270], [240, 66]], amber: true },
      ],
    },
    {
      name: "Industrial layers",
      caption: "Plant equipment kept apart from the business network, with a buffer zone between",
      stack: true,
      layers: ["Business network", "DMZ", "Control systems", "Field devices"],
      gates: [0, 1], // firewalls between layers 0-1 and 1-2
    },
  ];

  // ---------- Renderer ----------
  const BG = new THREE.Color("#0b0d14");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(BG);
  mount.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = "scene-labels";
  mount.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 52, 120);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);

  // ---------- Light: a quiet room with one pool of light that follows the design ----------
  scene.add(new THREE.HemisphereLight("#a9b4d0", "#07080d", 1.1));
  const key = new THREE.SpotLight("#f4f1ea", 4.2, 0, 0.5, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight("#8b9bc4", 1.1);
  scene.add(rim, rim.target);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 300),
    new THREE.MeshStandardMaterial({ color: "#151925", roughness: 0.9, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- Materials ----------
  const M = {
    body: new THREE.MeshStandardMaterial({ color: "#363d52", roughness: 0.55, metalness: 0.35 }),
    zone: new THREE.MeshStandardMaterial({ color: "#272d3d", roughness: 0.7, metalness: 0.2 }),
    edge: new THREE.MeshStandardMaterial({ color: "#3d4559", roughness: 0.5, metalness: 0.3 }),
    wire: new THREE.MeshStandardMaterial({ color: "#6d7690", roughness: 0.6, metalness: 0.1 }),
    dash: new THREE.MeshBasicMaterial({ color: "#e8a33d", transparent: true, opacity: 0.85 }),
    ledOk: new THREE.MeshBasicMaterial({ color: "#4cc38a" }),
    ledAmber: new THREE.MeshBasicMaterial({ color: "#e8a33d" }),
    ledDim: new THREE.MeshBasicMaterial({ color: "#7a8296" }),
    pktWhite: new THREE.MeshBasicMaterial({ color: "#eef0f5" }),
    pktAmber: new THREE.MeshBasicMaterial({ color: "#f0b45a" }),
    port: new THREE.MeshStandardMaterial({ color: "#0b0d14", roughness: 0.4, metalness: 0.6 }),
  };

  const S = 20;           // plan pixels per world unit
  const SPACING = 64;     // distance between designs along x
  const toWorld = (d, [px, py], y = 0) => new THREE.Vector3(d * SPACING + (px - 240) / S, y, (py - 170) / S);

  const groups = [];
  const flows = [];
  const pktGeo = new THREE.SphereGeometry(0.11, 16, 12);
  const portGeo = new THREE.BoxGeometry(0.13, 0.1, 0.02);

  DESIGNS.forEach((design, d) => {
    const g = new THREE.Group();
    const labelEls = [];

    if (design.stack) {
      buildStack(design, d, g, labelEls);
      scene.add(g);
      groups.push({ g, labelEls, center: new THREE.Vector3(d * SPACING - 1.5, 3.6, 0), pitch: 0.3 });
      return;
    }

    // Devices
    for (const n of design.nodes) {
      const w = n.w / S, depth = n.h / S;
      const h = n.k === "zone" ? 0.42 : n.k === "fw" ? 0.5 : 0.78;
      const mat = n.k === "zone" ? M.zone : n.k === "edge" ? M.edge : M.body;
      const box = new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 3, Math.min(0.12, depth / 4)), mat);
      const c = toWorld(d, [n.x + n.w / 2, n.y + n.h / 2], h / 2);
      box.position.copy(c);
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);

      // Status light on the front face
      const ledMat = n.k === "ok" ? M.ledOk
        : (n.k === "key" || n.k === "standby" || n.k === "fw") ? M.ledAmber
        : M.ledDim;
      const led = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.5, w * 0.25), 0.06, 0.02), ledMat);
      led.position.set(c.x - w / 2 + Math.min(0.5, w * 0.25) / 2 + 0.22, c.y + h * 0.12, c.z + depth / 2 + 0.005);
      g.add(led);

      // A row of ports on the right of the front face, so devices read as network gear
      if (n.k !== "zone" && n.k !== "fw") {
        for (let q = 0; q < 6; q++) {
          const port = new THREE.Mesh(portGeo, M.port);
          port.position.set(c.x + w / 2 - 0.36 - q * 0.2, c.y + h * 0.05, c.z + depth / 2 + 0.006);
          g.add(port);
        }
      }

      // Standby unit gets a dashed amber outline on the floor
      if (n.k === "standby") dashedRect(g, d, n);

      // Label printed on the top face
      const el = document.createElement("div");
      el.className = "l3" + (n.k === "fw" ? " l3-fw" : "") + (n.left ? " l3-left" : "");
      el.innerHTML = "<b></b>" + (n.s ? "<span></span>" : "");
      el.querySelector("b").textContent = n.t;
      if (n.s) el.querySelector("span").textContent = n.s;
      const obj = new CSS2DObject(el);
      const lx = n.left ? n.x + 24 : n.x + n.w / 2;
      obj.position.copy(toWorld(d, [lx, n.y + n.h / 2], h + 0.02));
      if (n.left) obj.center.set(0, 0.5);
      g.add(obj);
      labelEls.push(el);
    }

    // Links on the floor
    for (const l of design.links) {
      const pts = Array.isArray(l) ? l : l.p;
      const dash = !Array.isArray(l) && l.dash;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = toWorld(d, pts[i], 0.03), b = toWorld(d, pts[i + 1], 0.03);
        dash ? dashedSegment(g, a, b) : solidSegment(g, a, b);
      }
    }

    // Traffic
    for (const f of design.flows) {
      const pts = f.p.map((p) => toWorld(d, p, 0.16));
      const lens = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) { const L = pts[i].distanceTo(pts[i + 1]); lens.push(L); total += L; }
      const count = Math.max(2, Math.round(total / 4));
      const meshes = [];
      for (let k = 0; k < count; k++) {
        const m = new THREE.Mesh(pktGeo, f.amber ? M.pktAmber : M.pktWhite);
        g.add(m);
        meshes.push(m);
      }
      flows.push({ d, pts, lens, total, meshes, speed: f.amber ? 2.6 : 3.4, offset: Math.random() * total });
    }

    scene.add(g);
    groups.push({ g, labelEls, center: toWorld(d, [240, 168], 0), pitch: 0.56 });
  });

  // Layers as floating plates, top to bottom, with firewall gates between them
  function buildStack(design, d, g, labelEls) {
    const X = d * SPACING, W = 20, D = 7, T = 0.3, GAP = 2.4;
    const n = design.layers.length;
    const yOf = (i) => 0.15 + (n - 1 - i) * GAP; // layer 0 is the top
    const fx = X + 5.5, fz = D / 2 - 1.1;         // where links and gates run
    design.layers.forEach((name, i) => {
      const plate = new THREE.Mesh(new RoundedBoxGeometry(W, T, D, 3, 0.1), i === n - 1 ? M.zone : M.body);
      plate.position.set(X, yOf(i), 0);
      plate.castShadow = true; plate.receiveShadow = true;
      g.add(plate);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.02), M.ledDim);
      led.position.set(X - W / 2 + 0.6, yOf(i), D / 2 + 0.005);
      g.add(led);
      const el = document.createElement("div");
      el.className = "l3 l3-left";
      el.innerHTML = "<b></b>";
      el.querySelector("b").textContent = name;
      const obj = new CSS2DObject(el);
      obj.center.set(0, 0.5);
      obj.position.set(X - W / 2 + 0.8, yOf(i) + T / 2 + 0.02, D / 2 - 1.1);
      g.add(obj);
      labelEls.push(el);
      // vertical link to the layer below
      if (i < n - 1) {
        const top = yOf(i) - T / 2, bottom = yOf(i + 1) + T / 2;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, top - bottom, 0.07), M.wire);
        post.position.set(fx, (top + bottom) / 2, fz);
        g.add(post);
        if (design.gates.includes(i)) {
          const gate = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.5, 0.8, 2, 0.08), M.body);
          gate.position.set(fx, (top + bottom) / 2, fz);
          gate.castShadow = true;
          g.add(gate);
          const gl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.02), M.ledAmber);
          gl.position.set(fx - 0.4, (top + bottom) / 2 + 0.06, fz + 0.405);
          g.add(gl);
          const ge = document.createElement("div");
          ge.className = "l3 l3-fw l3-left";
          ge.innerHTML = "<b>firewall</b>";
          const go2 = new CSS2DObject(ge);
          go2.center.set(0, 0.5);
          go2.position.set(fx + 1.1, (top + bottom) / 2, fz + 0.4);
          g.add(go2);
          labelEls.push(ge);
        }
      }
    });
    // Traffic: business to DMZ, field to control. Nothing crosses the whole stack
    const path = (from, to) => [new THREE.Vector3(fx, yOf(from), fz), new THREE.Vector3(fx, yOf(to), fz)];
    for (const [a, b] of [[0, 1], [3, 2]]) {
      const pts = path(a, b);
      const total = pts[0].distanceTo(pts[1]);
      const meshes = [0, 1].map(() => { const m = new THREE.Mesh(pktGeo, M.pktWhite); g.add(m); return m; });
      flows.push({ d, pts, lens: [total], total, meshes, speed: 1.6, offset: Math.random() * total });
    }
  }

  function solidSegment(g, a, b) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, len), M.wire);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b.x, m.position.y, b.z);
    m.receiveShadow = true;
    g.add(m);
  }
  function dashedSegment(g, a, b) {
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const DASH = 0.32, GAP = 0.22;
    for (let s = 0; s < len; s += DASH + GAP) {
      const l = Math.min(DASH, len - s);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, l), M.dash);
      m.position.copy(a).addScaledVector(dir, s + l / 2);
      m.lookAt(m.position.clone().add(dir));
      g.add(m);
    }
  }
  function dashedRect(g, d, n) {
    const pad = 6;
    const c = [[n.x - pad, n.y - pad], [n.x + n.w + pad, n.y - pad], [n.x + n.w + pad, n.y + n.h + pad], [n.x - pad, n.y + n.h + pad]];
    for (let i = 0; i < 4; i++) dashedSegment(g, toWorld(d, c[i], 0.02), toWorld(d, c[(i + 1) % 4], 0.02));
  }

  function pointAt(f, dist) {
    let t = ((dist % f.total) + f.total) % f.total;
    for (let i = 0; i < f.lens.length; i++) {
      if (t <= f.lens[i]) return f.pts[i].clone().lerp(f.pts[i + 1], t / f.lens[i]);
      t -= f.lens[i];
    }
    return f.pts[f.pts.length - 1].clone();
  }

  // ---------- Camera framing ----------
  const view = { yaw: -0.42, pitch: 0.56, dist: 46 };
  let W = 1, H = 1, desktop = true;

  function resize() {
    W = mount.clientWidth; H = mount.clientHeight;
    desktop = window.innerWidth > 1040;
    renderer.setSize(W, H, false);
    labels.setSize(W, H);
    camera.aspect = W / H;
    // Fit about 27 units of plan into the visible part of the frame
    const portion = desktop ? 0.54 : 1.06;
    const need = 27 / portion;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.dist = Math.max(need / (2 * tanHalf * camera.aspect), 22 / (2 * tanHalf)) * 1.05;
    // On desktop push the design into the right half, leaving calm space for the headline
    if (desktop) camera.setViewOffset(W, H, -W * 0.17, H * 0.07, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const target = new THREE.Vector3();
  function placeCamera(t, time, lift = 0) {
    const yaw = view.yaw + (reduceMotion ? 0 : Math.sin(time * 0.12) * 0.07);
    const pitch = view.pitch + (reduceMotion ? 0 : Math.sin(time * 0.09) * 0.02);
    const d = view.dist + lift;
    camera.position.set(
      t.x + Math.sin(yaw) * Math.cos(pitch) * d,
      t.y + Math.sin(pitch) * d,
      t.z + Math.cos(yaw) * Math.cos(pitch) * d
    );
    camera.lookAt(t);
    key.position.set(t.x - 8, 34, t.z + 12);
    key.target.position.copy(t);
    rim.position.set(t.x + 20, 14, t.z - 24);
    rim.target.position.copy(t);
  }

  // ---------- Story: fly between designs ----------
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let index = 0;
  let fly = null; // { from, to, start, dur, lift }
  const nameEl = hud.querySelector("[data-name]");
  const capEl = hud.querySelector("[data-cap]");
  const countEl = hud.querySelector("[data-count]");

  function showLabels(i) {
    groups.forEach((gr, k) => gr.labelEls.forEach((el) => el.classList.toggle("on", k === i)));
  }
  function setText(i) {
    hud.classList.add("swap");
    setTimeout(() => {
      nameEl.textContent = DESIGNS[i].name;
      capEl.textContent = DESIGNS[i].caption;
      countEl.textContent = String(i + 1).padStart(2, "0");
      hud.classList.remove("swap");
    }, reduceMotion ? 0 : 220);
  }

  function go(n, now) {
    const next = (n + DESIGNS.length) % DESIGNS.length;
    if (next === index && fly === null) return;
    const from = fly ? target.clone() : groups[index].center.clone();
    index = next;
    showLabels(-1);
    setText(index);
    if (reduceMotion) {
      target.copy(groups[index].center);
      view.pitch = groups[index].pitch;
      showLabels(index);
      fly = null;
      return;
    }
    const jump = from.distanceTo(groups[index].center);
    fly = { from, p0: view.pitch, p1: groups[index].pitch, to: groups[index].center.clone(), start: now, dur: 1.6 + Math.min(1.4, jump / 90), lift: Math.min(18, jump / 8) };
  }

  // Opening shot: settle onto the first design from high and wide
  target.copy(groups[0].center);
  if (!reduceMotion) fly = { from: groups[0].center.clone().add(new THREE.Vector3(-26, 0, -8)), to: groups[0].center.clone(), start: 0, dur: 3.2, lift: 30 };
  else showLabels(0);

  // Controls and autoplay
  let stopped = reduceMotion, paused = false, visible = true, lastSwitch = 0, clockNow = 0;
  const DWELL = 6.5;
  hud.querySelector("[data-prev]").addEventListener("click", () => { stopped = true; go(index - 1, clockNow); });
  hud.querySelector("[data-next]").addEventListener("click", () => { stopped = true; go(index + 1, clockNow); });
  hud.addEventListener("mouseenter", () => (paused = true));
  hud.addEventListener("mouseleave", () => (paused = false));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.1 }).observe(hero);

  showLabels(reduceMotion ? 0 : -1);

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    clockNow += dt;
    const now = clockNow;

    let lift = 0;
    if (fly) {
      const t = Math.min(1, (now - fly.start) / fly.dur);
      const e = ease(t);
      target.copy(fly.from).lerp(fly.to, e);
      lift = Math.sin(Math.PI * e) * fly.lift;
      if (fly.p1 !== undefined) view.pitch = fly.p0 + (fly.p1 - fly.p0) * e;
      if (t >= 1) { fly = null; lastSwitch = now; showLabels(index); }
    } else if (!stopped && !paused && now - lastSwitch > DWELL) {
      go(index + 1, now);
    }
    placeCamera(target, now, lift);

    if (!reduceMotion) {
      for (const f of flows) {
        if (Math.abs(f.d - index) > 1 && !fly) continue;
        f.offset += f.speed * dt;
        const gap = f.total / f.meshes.length;
        f.meshes.forEach((m, k) => m.position.copy(pointAt(f, f.offset + k * gap)));
      }
    } else if (!frame.placed) {
      for (const f of flows) {
        const gap = f.total / f.meshes.length;
        f.meshes.forEach((m, k) => m.position.copy(pointAt(f, f.offset + k * gap)));
      }
      frame.placed = true;
    }

    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  frame();
}
