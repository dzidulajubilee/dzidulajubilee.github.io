// Hero scene: four example network architectures as physical objects with live traffic.
// All designs are generic reference architectures, not any real site.
import * as THREE from "three";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { CSS2DRenderer, CSS2DObject } from "./vendor/CSS2DRenderer.js";

const hero = document.querySelector(".hero");
const mount = document.getElementById("scene");
const hud = document.querySelector(".hud");
const params = new URLSearchParams(location.search);
const CAPTURE = params.has("capture"); // deterministic frames for the GitHub banner
const reduceMotion = !CAPTURE && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { return false; }
}

if (hero && mount && hud && webglOK()) init();

function init() {
  hero.classList.add("has-3d"); // make the mount visible before measuring it

  // ---------- Renderer ----------
  const BG = new THREE.Color("#0b0d14");
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: CAPTURE });
  const small = window.innerWidth <= 1040;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
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
  scene.fog = new THREE.Fog(BG, 70, 170);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 500);

  scene.add(new THREE.HemisphereLight("#a9b4d0", "#07080d", 1.1));
  const key = new THREE.SpotLight("#f4f1ea", 4.4, 0, 0.62, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 140;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight("#8b9bc4", 1.1);
  scene.add(rim, rim.target);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 400),
    new THREE.MeshStandardMaterial({ color: "#151925", roughness: 0.9, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- Materials and shared geometry ----------
  const std = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
  const M = {
    body: std("#363d52", 0.55, 0.35),
    edge: std("#3d4559", 0.5, 0.3),
    zone: std("#272d3d", 0.7, 0.2),
    rack: std("#1c2130", 0.45, 0.5),
    port: std("#0b0d14", 0.4, 0.6),
    wire: std("#6d7690", 0.6, 0.1),
    wireA: std("#6d7690", 0.6, 0.1), // links through the active firewall (dim when it fails)
    dash: basic("#e8a33d", { transparent: true, opacity: 0.85 }),
    ledOk: basic("#4cc38a"), ledAmber: basic("#e8a33d"), ledDim: basic("#7a8296"), ledRed: basic("#e5484d"),
    unitDim: basic("#2c3344"), unitOn: basic("#8fa0c8"),
    pktWhite: basic("#eef0f5"), pktAmber: basic("#f0b45a"),
  };
  const geoCache = new Map();
  const rbox = (w, h, d, r = 0.08) => {
    const k = [w, h, d, r].join();
    if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, h / 2.2, d / 2.2)));
    return geoCache.get(k);
  };
  const box = (w, h, d) => {
    const k = "b" + [w, h, d].join();
    if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(k);
  };
  const pktGeo = new THREE.SphereGeometry(0.12, 14, 10);
  const apGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.14, 28);

  const KINDS = {
    router: { w: 2.4, h: 0.5, d: 1.3, mat: "edge", ports: 6 },
    fw: { w: 2.6, h: 0.6, d: 1.4, mat: "body", ports: 6 },
    switch: { w: 2.6, h: 0.42, d: 1.2, mat: "body", ports: 8 },
    core: { w: 3.2, h: 0.8, d: 1.6, mat: "body", ports: 10 },
    server: { w: 1.2, h: 0.34, d: 1.3, mat: "body", ports: 2 },
    rack: { w: 1.2, h: 2.6, d: 1.4, mat: "rack" },
    pc: { w: 0.8, h: 0.42, d: 0.55, mat: "edge" },
    plc: { w: 0.6, h: 0.55, d: 0.45, mat: "edge" },
    ap: { w: 0.9, h: 0.14, d: 0.9 },
    cloud: { w: 8, h: 0.34, d: 2.6, mat: "zone" },
  };

  const SPACING = 110;
  const designs = [];
  const flows = [];
  const failover = { fwA: null, fwB: null, labelA: null, labelB: null, state: "ok" };

  // ---------- Builder API for one design ----------
  function makeDesign(d, meta) {
    const g = new THREE.Group();
    const X = d * SPACING;
    const dev = {};
    const labelEls = [];

    function label(text, pos, { sub, kind, left } = {}) {
      const el = document.createElement("div");
      el.className = "l3" + (kind ? " l3-" + kind : "") + (left ? " l3-left" : "");
      el.innerHTML = "<b></b>" + (sub ? "<span></span>" : "");
      el.querySelector("b").textContent = text;
      if (sub) el.querySelector("span").textContent = sub;
      const obj = new CSS2DObject(el);
      if (left) obj.center.set(0, 0.5);
      obj.position.copy(pos);
      g.add(obj);
      labelEls.push(el);
      return el;
    }

    function add(id, kind, x, z, opt = {}) {
      const K = KINDS[kind];
      const base = opt.y || 0;
      const p = new THREE.Vector3(X + x, base, z);
      const top = base + K.h;
      if (kind === "ap") {
        const m = new THREE.Mesh(apGeo, M.edge);
        m.position.set(p.x, base + K.h / 2, z);
        m.castShadow = true; g.add(m);
        const dot = new THREE.Mesh(box(0.16, 0.02, 0.16), M.ledOk);
        dot.position.set(p.x, base + K.h + 0.01, z); g.add(dot);
      } else {
        const m = new THREE.Mesh(rbox(K.w, K.h, K.d, kind === "rack" ? 0.06 : 0.1), M[K.mat]);
        m.position.set(p.x, base + K.h / 2, z);
        m.castShadow = true; m.receiveShadow = true; g.add(m);
        const front = z + K.d / 2 + 0.006;
        if (kind === "rack") {
          for (let u = 0; u < 8; u++) {
            const lit = (u * 7 + Math.round(x * 3) + d) % 3 === 0;
            const unit = new THREE.Mesh(box(K.w * 0.78, 0.05, 0.02), lit ? M.unitOn : M.unitDim);
            unit.position.set(p.x, base + 0.35 + u * 0.28, front);
            g.add(unit);
          }
        } else if (kind !== "cloud") {
          const ledMat = opt.led === "ok" ? M.ledOk : opt.led === "amber" ? M.ledAmber : M.ledDim;
          const lw = Math.min(0.45, K.w * 0.28);
          const led = new THREE.Mesh(box(lw, 0.06, 0.02), ledMat);
          led.position.set(p.x - K.w / 2 + lw / 2 + 0.18, base + K.h * 0.62, front);
          g.add(led);
          dev[id + ":led"] = led;
          for (let q = 0; q < (K.ports || 0); q++) {
            const port = new THREE.Mesh(box(0.13, 0.1, 0.02), M.port);
            port.position.set(p.x + K.w / 2 - 0.3 - q * 0.19, base + K.h * 0.38, front);
            g.add(port);
          }
        }
      }
      dev[id] = { p, top, kind };
      if (opt.label) dev[id + ":label"] = label(opt.label, new THREE.Vector3(p.x, top + 0.02, z), { sub: opt.sub });
      return dev[id];
    }

    // A device id, or [x, z, y] in this design's local coordinates
    const at = (ref, y = 0.03) => {
      if (Array.isArray(ref)) return new THREE.Vector3(X + ref[0], ref[2] !== undefined ? ref[2] : y, ref[1]);
      const D = dev[ref];
      return new THREE.Vector3(D.p.x, D.p.y + y, D.p.z);
    };

    function segment(a, b, dash, mat) {
      const len = a.distanceTo(b);
      if (len < 0.01) return;
      const dir = b.clone().sub(a).normalize();
      if (!dash) {
        const m = new THREE.Mesh(box(0.07, 0.05, 1), mat || M.wire);
        m.scale.z = len;
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.lookAt(m.position.clone().add(dir));
        g.add(m);
        return;
      }
      const DASH = 0.34, GAP = 0.24;
      for (let s = 0; s < len; s += DASH + GAP) {
        const l = Math.min(DASH, len - s);
        const m = new THREE.Mesh(box(0.07, 0.045, 1), mat || M.dash);
        m.scale.z = l;
        m.position.copy(a).addScaledVector(dir, s + l / 2);
        m.lookAt(m.position.clone().add(dir));
        g.add(m);
      }
    }
    function link(a, b, { dash = false, mat = null, via = [] } = {}) {
      const pts = [at(a), ...via.map((v) => at(v)), at(b)];
      for (let i = 0; i < pts.length - 1; i++) segment(pts[i], pts[i + 1], dash, mat);
    }
    function post(a, b) {
      const m = new THREE.Mesh(box(0.07, a.distanceTo(b), 0.07), M.wire);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      g.add(m);
    }

    function flow(route, { amber = false, tag = null, speed } = {}) {
      const pts = route.map((r) => (r instanceof THREE.Vector3 ? r : at(r, 0.2)));
      const lens = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) { const L = pts[i].distanceTo(pts[i + 1]); lens.push(L); total += L; }
      const count = Math.max(2, Math.round(total / 3.2));
      const meshes = [];
      for (let k = 0; k < count; k++) { const m = new THREE.Mesh(pktGeo, amber ? M.pktAmber : M.pktWhite); g.add(m); meshes.push(m); }
      flows.push({ d, pts, lens, total, meshes, tag, speed: speed || (amber ? 3.2 : 4.2), offset: (d * 7.3 + flows.length * 2.9) % total });
    }

    const tag = (text, x, z, y = 0.02) => label(text, new THREE.Vector3(X + x, y, z), { kind: "floor" });

    return { g, X, dev, add, link, post, flow, tag, label, at, labelEls, meta };
  }

  // ---------- 1. Enterprise campus, with a live firewall failover ----------
  {
    const D = makeDesign(0, {
      name: "Enterprise campus",
      caption: "Redundant at every layer. Watch the active firewall fail and the standby take over",
      pitch: 0.66, size: 40, center: [0.5, -1.5],
    });
    const { add, link, flow, tag } = D;
    add("ispA", "router", -5, -12.5, { label: "ISP A" });
    add("ispB", "router", 5, -12.5, { label: "ISP B" });
    add("fwA", "fw", -4, -8, { label: "Firewall", sub: "active", led: "ok" });
    add("fwB", "fw", 4, -8, { label: "Firewall", sub: "standby", led: "amber" });
    add("dmz", "switch", -12.5, -8, { label: "DMZ" });
    add("dmz0", "server", -13.6, -5); add("dmz1", "server", -11.4, -5);
    add("c1", "core", -3.6, -3, { label: "Core" });
    add("c2", "core", 3.6, -3, { label: "Core" });
    const ax = [-11.5, -3.8, 3.8, 11.5];
    ax.forEach((x, i) => add("a" + i, "switch", x, 2));
    for (const [ai, x0] of [[0, ax[0]], [1, ax[1]]]) {
      let n = 0;
      for (const dz of [5.4, 6.9]) for (const dx of [-1.3, 0, 1.3]) { add(`pc${ai}_${n}`, "pc", x0 + dx, dz); link("a" + ai, `pc${ai}_${n}`); n++; }
    }
    [-1.4, 0, 1.4].forEach((dx, k) => { add("ap" + k, "ap", ax[2] + dx, 5.8); link("a2", "ap" + k); });
    [-1.4, 0, 1.4].forEach((dx, k) => { add("r" + k, "rack", ax[3] + dx, 5.8); link("a3", "r" + k); });
    tag("Floor 1", ax[0], 8.9); tag("Floor 2", ax[1], 8.9); tag("Wi-Fi", ax[2], 8.9); tag("Server room", ax[3], 8.9);
    link("ispA", "fwA", { mat: M.wireA }); link("ispB", "fwA", { mat: M.wireA });
    link("ispA", "fwB", { dash: true }); link("ispB", "fwB", { dash: true });
    link("fwA", "c1", { mat: M.wireA }); link("fwA", "c2", { mat: M.wireA });
    link("fwB", "c1", { dash: true }); link("fwB", "c2", { dash: true });
    link("fwA", "dmz", { mat: M.wireA }); link("dmz", "dmz0"); link("dmz", "dmz1");
    link("c1", "c2");
    ax.forEach((x, i) => { link("c1", "a" + i); link("c2", "a" + i); });
    flow(["ispA", "fwA", "c1", "a0", "pc0_1"], { tag: "A" });
    flow(["ispB", "fwA", "c2", "a3", "r1"], { tag: "A" });
    flow(["ispA", "fwA", "dmz", "dmz0"], { tag: "A" });
    flow(["ispA", "fwB", "c1", "a0", "pc0_1"], { tag: "B", amber: true });
    flow(["ispB", "fwB", "c2", "a3", "r1"], { tag: "B", amber: true });
    flow(["pc1_4", "a1", "c1", "a3", "r0"]);
    flow(["ap1", "a2", "c2", "a3", "r2"]);
    failover.fwA = D.dev["fwA:led"]; failover.fwB = D.dev["fwB:led"];
    failover.labelA = D.dev["fwA:label"]; failover.labelB = D.dev["fwB:label"];
    designs.push(D);
  }

  // ---------- 2. Data centre spine and leaf ----------
  {
    const D = makeDesign(1, {
      name: "Data centre fabric",
      caption: "Spine and leaf: every leaf connects to every spine, so any rack is two hops from any other",
      pitch: 0.58, size: 38, center: [2, -5],
    });
    const { add, link, flow } = D;
    add("s1", "core", -5, -9, { label: "Spine" });
    add("s2", "core", 5, -9, { label: "Spine" });
    const lx = [-12, -4, 4, 12];
    lx.forEach((x, i) => {
      add("l" + i, "switch", x, -2, { label: "Leaf" });
      add(`r${i}a`, "rack", x - 0.8, 2); add(`r${i}b`, "rack", x + 0.8, 2);
      link("l" + i, `r${i}a`); link("l" + i, `r${i}b`);
      link("s1", "l" + i); link("s2", "l" + i);
    });
    add("border", "switch", 16, -9, { label: "Border leaf" });
    add("fw", "fw", 16, -13, { label: "Firewall", led: "ok" });
    add("inet", "router", 16, -17, { label: "Internet" });
    link("s1", "border"); link("s2", "border"); link("border", "fw"); link("fw", "inet");
    flow(["r0a", "l0", "s1", "l2", "r2b"]);
    flow(["r3a", "l3", "s2", "l1", "r1a"]);
    flow(["r1b", "l1", "s1", "l0", "r0b"]);
    flow(["inet", "fw", "border", "s2", "l3", "r3b"]);
    flow(["r2a", "l2", "s2", "l3", "r3a"]);
    designs.push(D);
  }

  // ---------- 3. Multi-site WAN ----------
  {
    const D = makeDesign(2, {
      name: "Multi-site WAN",
      caption: "Five branches with encrypted tunnels to both head office and the DR site, plus a link to the cloud",
      pitch: 0.64, size: 40, center: [0, -0.5],
    });
    const { add, link, flow, tag } = D;
    add("cloud", "cloud", 0, -12, { label: "Cloud" });
    add("hq", "fw", -9, -5, { label: "Head office", led: "ok" });
    add("hqsw", "switch", -9, -2); add("hqr0", "rack", -10.4, 1); add("hqr1", "rack", -7.6, 1);
    add("dr", "fw", 9, -5, { label: "DR site", led: "amber" });
    add("drsw", "switch", 9, -2); add("drr0", "rack", 9, 1);
    link("hq", "hqsw"); link("hqsw", "hqr0"); link("hqsw", "hqr1");
    link("dr", "drsw"); link("drsw", "drr0");
    link("hq", "dr");
    link("hq", "cloud", { dash: true }); link("dr", "cloud", { dash: true });
    const bx = [-14, -7, 0, 7, 14];
    bx.forEach((x, i) => {
      add("b" + i, "router", x, 8);
      add(`b${i}p0`, "pc", x - 0.7, 10.6); add(`b${i}p1`, "pc", x + 0.7, 10.6);
      link("b" + i, `b${i}p0`); link("b" + i, `b${i}p1`);
      link("b" + i, "hq", { dash: true }); link("b" + i, "dr", { dash: true });
    });
    tag("Branches", 0, 12.8);
    flow(["b0p0", "b0", "hq", "hqsw", "hqr0"], { amber: true });
    flow(["b1", "hq"], { amber: true });
    flow(["b2p1", "b2", "hq", "hqsw", "hqr1"], { amber: true });
    flow(["b3", "dr"], { amber: true });
    flow(["b4p0", "b4", "hq"], { amber: true });
    flow(["hqr1", "hqsw", "hq", "dr", "drsw", "drr0"]);
    flow(["hq", "cloud"], { amber: true });
    designs.push(D);
  }

  // ---------- 4. Industrial defence in depth: layers stacked as floating plates ----------
  {
    const D = makeDesign(3, {
      name: "Industrial defence in depth",
      caption: "Each layer of the plant sits behind its own firewall, and nothing crosses the whole stack",
      pitch: 0.5, size: 38, center: [0, 0.5], y: 3.6,
    });
    const { g, X, add, link, post, flow, label } = D;
    const names = ["Business network", "DMZ", "Control systems", "Field devices"];
    const W = 24, DP = 8.5, T = 0.3, GAP = 2.9, STEP = 2.8;
    const yOf = (i) => 0.15 + (3 - i) * GAP;
    const top = (i) => yOf(i) + T / 2;
    const zOf = (i) => (i - 1.5) * STEP;          // each lower layer steps toward the viewer
    const front = (i) => zOf(i) + DP / 2 - 1.3;    // the strip left uncovered by the layer above
    const fx = 9;
    names.forEach((name, i) => {
      const plate = new THREE.Mesh(rbox(W, T, DP, 0.1), i === 3 ? M.zone : M.body);
      plate.position.set(X, yOf(i), zOf(i));
      plate.castShadow = true; plate.receiveShadow = true;
      g.add(plate);
      label(name, new THREE.Vector3(X - W / 2 + 0.8, top(i) + 0.02, zOf(i) + DP / 2 - 0.5), { left: true });
      add("sw" + i, "switch", fx - 3.6, front(i), { y: top(i) });
    });
    [-6.5, -5.1, -3.7, -2.3].forEach((x, k) => { add("pc" + k, "pc", x, front(0), { y: top(0) }); link("sw0", "pc" + k); });
    [0.2, 1.8].forEach((x, k) => { add("bs" + k, "server", x, front(0), { y: top(0) }); link("sw0", "bs" + k); });
    [-3.4, -1.8, -0.2].forEach((x, k) => { add("dz" + k, "server", x, front(1), { y: top(1) }); link("sw1", "dz" + k); });
    [-6.2, -4.8].forEach((x, k) => { add("hmi" + k, "pc", x, front(2), { y: top(2) }); link("sw2", "hmi" + k); });
    [-2.2, -0.6].forEach((x, k) => { add("sc" + k, "server", x, front(2), { y: top(2) }); link("sw2", "sc" + k); });
    [-6.6, -5.4, -4.2, -3, -1.8, -0.6].forEach((x, k) => { add("plc" + k, "plc", x, front(3), { y: top(3) }); link("sw3", "plc" + k); });
    // Each switch drops to the layer below through a post, with a firewall on the upper two
    for (let i = 0; i < 3; i++) {
      const z = front(i);
      const a = new THREE.Vector3(X + fx, yOf(i) - T / 2, z), b = new THREE.Vector3(X + fx, top(i + 1), z);
      link("sw" + i, [fx, z, top(i) + 0.03]);
      link("sw" + (i + 1), [fx, z, top(i + 1) + 0.03], { via: [[fx, front(i + 1), top(i + 1) + 0.03]] });
      post(a, b);
      if (i < 2) {
        const mid = (a.y + b.y) / 2;
        const gate = new THREE.Mesh(rbox(1.8, 0.55, 0.9, 0.08), M.body);
        gate.position.set(X + fx, mid, z); gate.castShadow = true; g.add(gate);
        const gl = new THREE.Mesh(box(0.4, 0.06, 0.02), M.ledAmber);
        gl.position.set(X + fx - 0.5, mid + 0.08, z + 0.456); g.add(gl);
        label("firewall", new THREE.Vector3(X + fx + 1.2, mid, z + 0.45), { kind: "fw", left: true });
      }
    }
    const V = (x, y, z) => new THREE.Vector3(X + x, y, z);
    flow([D.at("pc1", 0.2), D.at("sw0", 0.2), V(fx, top(0) + 0.2, front(0)), V(fx, top(1) + 0.2, front(0)), V(fx, top(1) + 0.2, front(1)), D.at("sw1", 0.2), D.at("dz1", 0.2)], { speed: 2.6 });
    flow([D.at("plc2", 0.2), D.at("sw3", 0.2), V(fx, top(3) + 0.2, front(3)), V(fx, top(3) + 0.2, front(2)), V(fx, top(2) + 0.2, front(2)), D.at("sw2", 0.2), D.at("hmi0", 0.2)], { speed: 2.6 });
    flow([D.at("sc0", 0.2), D.at("sw2", 0.2), D.at("hmi1", 0.2)], { speed: 2.2 });
    designs.push(D);
  }

  designs.forEach((D, k) => {
    const m = D.meta;
    D.center = new THREE.Vector3(k * SPACING + m.center[0], m.y || 0, m.center[1]);
    scene.add(D.g);
  });

  // ---------- Camera ----------
  const view = { yaw: -0.42, pitch: designs[0].meta.pitch, size: designs[0].meta.size };
  let W = 1, H = 1, desktop = true;
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function distFor(size) {
    const portion = CAPTURE ? 0.58 : desktop ? 0.6 : 1.04;
    return Math.max((size / portion) / (2 * tanHalf() * camera.aspect), (size * 0.62) / (2 * tanHalf()));
  }
  function resize() {
    W = mount.clientWidth; H = mount.clientHeight;
    desktop = window.innerWidth > 1040;
    renderer.setSize(W, H, false);
    labels.setSize(W, H);
    camera.aspect = W / H;
    if (CAPTURE) camera.setViewOffset(W, H, -W * 0.2, H * 0.02, W, H);
    else if (desktop) camera.setViewOffset(W, H, -W * 0.17, H * 0.06, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const target = new THREE.Vector3();
  function placeCamera(t, time, lift) {
    const sway = !reduceMotion && !CAPTURE;
    const yaw = view.yaw + (sway ? Math.sin(time * 0.12) * 0.07 : 0);
    const pitch = view.pitch + (sway ? Math.sin(time * 0.09) * 0.02 : 0);
    const d = distFor(view.size) + lift;
    camera.position.set(t.x + Math.sin(yaw) * Math.cos(pitch) * d, t.y + Math.sin(pitch) * d, t.z + Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(t);
    key.position.set(t.x - 10, 52, t.z + 16);
    key.target.position.copy(t);
    rim.position.set(t.x + 24, 18, t.z - 30);
    rim.target.position.copy(t);
  }

  // ---------- Story ----------
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const nameEl = hud.querySelector("[data-name]");
  const capEl = hud.querySelector("[data-cap]");
  const countEl = hud.querySelector("[data-count]");
  let index = 0, fly = null, arrivedAt = 0;

  const showOnly = (...ks) => designs.forEach((D, k) => (D.g.visible = ks.includes(k)));
  const showLabels = (i) => designs.forEach((D, k) => D.labelEls.forEach((el) => el.classList.toggle("on", k === i)));
  function setText(i) {
    hud.classList.add("swap");
    setTimeout(() => {
      if (nameEl) nameEl.textContent = designs[i].meta.name;
      if (capEl) capEl.textContent = designs[i].meta.caption;
      if (countEl) countEl.textContent = String(i + 1).padStart(2, "0");
      hud.classList.remove("swap");
    }, reduceMotion ? 0 : 220);
  }
  function setFailover(state) {
    if (failover.state === state) return;
    failover.state = state;
    const failed = state === "failed";
    failover.fwA.material = failed ? M.ledRed : M.ledOk;
    failover.fwB.material = failed ? M.ledOk : M.ledAmber;
    M.wireA.color.set(failed ? "#2a2f3d" : "#6d7690");
    M.dash.opacity = failed ? 1 : 0.85;
    failover.labelA.querySelector("span").textContent = failed ? "failed" : "active";
    failover.labelB.querySelector("span").textContent = failed ? "active" : "standby";
    failover.labelA.classList.toggle("l3-bad", failed);
  }

  function go(n, at) {
    const next = (n + designs.length) % designs.length;
    if (next === index && !fly) return;
    const from = target.clone();
    const prev = index;
    index = next;
    showLabels(-1);
    setText(index);
    setFailover("ok");
    const m = designs[index].meta;
    if (reduceMotion || CAPTURE) {
      target.copy(designs[index].center);
      view.pitch = m.pitch; view.size = m.size;
      showOnly(index); showLabels(index); arrivedAt = at; fly = null;
      return;
    }
    showOnly(prev, index);
    const jump = from.distanceTo(designs[index].center);
    fly = { from, to: designs[index].center.clone(), start: at, dur: 2 + Math.min(1.4, jump / 120), lift: Math.min(26, jump / 6),
      p0: view.pitch, p1: m.pitch, s0: view.size, s1: m.size };
  }

  target.copy(designs[0].center);
  showOnly(0);
  if (!reduceMotion && !CAPTURE) {
    fly = { from: designs[0].center.clone().add(new THREE.Vector3(-34, 0, -12)), to: designs[0].center.clone(), start: 0, dur: 3.4, lift: 40,
      p0: 0.66, p1: 0.66, s0: 40, s1: 40 };
  } else showLabels(0);

  let stopped = reduceMotion || CAPTURE, paused = false, visible = true, now = 0;
  const DWELL = [15, 8, 8, 8];
  hud.querySelector("[data-prev]")?.addEventListener("click", () => { stopped = true; go(index - 1, now); });
  hud.querySelector("[data-next]")?.addEventListener("click", () => { stopped = true; go(index + 1, now); });
  hud.addEventListener("mouseenter", () => (paused = true));
  hud.addEventListener("mouseleave", () => (paused = false));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.1 }).observe(hero);

  let placedStill = false;
  function step(dt) {
    now += dt;
    let lift = 0;
    if (fly) {
      const t = Math.min(1, (now - fly.start) / fly.dur);
      const e = ease(t);
      target.copy(fly.from).lerp(fly.to, e);
      lift = Math.sin(Math.PI * e) * fly.lift;
      view.pitch = fly.p0 + (fly.p1 - fly.p0) * e;
      view.size = fly.s0 + (fly.s1 - fly.s0) * e;
      if (t >= 1) { fly = null; arrivedAt = now; showOnly(index); showLabels(index); }
    } else if (!stopped && !paused && now - arrivedAt > DWELL[index]) {
      go(index + 1, now);
    }

    // Campus: the active firewall fails a few seconds after arrival, then recovers
    if (index === 0 && !fly && !reduceMotion && !CAPTURE) {
      const t = (now - arrivedAt) % 15;
      setFailover(t > 4.5 && t < 11 ? "failed" : "ok");
    }

    placeCamera(target, now, lift);

    if (!reduceMotion || !placedStill) {
      for (const f of flows) {
        if (f.d !== index && !fly) continue;
        const live = !f.tag || (f.tag === "A") === (failover.state === "ok");
        if (!reduceMotion) f.offset += f.speed * dt;
        const gap = f.total / f.meshes.length;
        f.meshes.forEach((m, k) => {
          m.visible = live;
          if (live) m.position.copy(pointAt(f, f.offset + k * gap));
        });
      }
      placedStill = true;
    }
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  function pointAt(f, dist) {
    let t = ((dist % f.total) + f.total) % f.total;
    for (let i = 0; i < f.lens.length; i++) {
      if (t <= f.lens[i]) return f.pts[i].clone().lerp(f.pts[i + 1], t / f.lens[i]);
      t -= f.lens[i];
    }
    return f.pts[f.pts.length - 1].clone();
  }

  if (CAPTURE) {
    // Used only to record the GitHub profile banner: time is driven by hand
    // setLoop(seconds) retimes every flow so packets return to their start after exactly that long
    const setLoop = (T) => flows.forEach((f) => {
      const gap = f.total / f.meshes.length;
      f.speed = Math.max(1, Math.round((f.speed * T) / gap)) * gap / T;
    });
    window.__scene = { step, setLoop, go: (n) => go(n, now), fail: (b) => setFailover(b ? "failed" : "ok") };
    step(0);
    return;
  }

  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    step(Math.min(clock.getDelta(), 0.05));
  })();
}
