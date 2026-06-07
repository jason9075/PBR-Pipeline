import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';
import './style.css';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-glsl.js';
import 'prism-themes/themes/prism-nord.css';

/* ─── DOM refs ────────────────────────────────────────────────────────── */
const canvas       = document.getElementById('canvas');
const viewportEl   = document.getElementById('viewport');
const modeBtns     = document.querySelectorAll('.mode-btn');
const envBtns      = document.querySelectorAll('.env-btn');
const matItems     = document.querySelectorAll('.mat-item');
const azimuthEl    = document.getElementById('azimuth');
const intensityEl  = document.getElementById('intensity');
const intensityVal = document.getElementById('intensity-val');
const dispScaleEl  = document.getElementById('disp-scale');
const dispScaleVal = document.getElementById('disp-scale-val');
const channelRows  = document.querySelectorAll('.channel-row');
const isolateBtns  = document.querySelectorAll('.isolate-btn');
const statFpsEl    = document.getElementById('stat-fps');
const statDrawsEl  = document.getElementById('stat-draws');
const statTrisEl   = document.getElementById('stat-tris');
const focusSelect  = document.getElementById('focus-select');
const openMathBtn  = document.getElementById('open-math');
const closeMathBtn = document.getElementById('close-math');
const langToggle   = document.getElementById('language-toggle');
const mathModal    = document.getElementById('math-modal');
const mathContent  = document.getElementById('math-content');

/* ─── Texture path registry ───────────────────────────────────────────── */
// import.meta.env.BASE_URL = '/' in dev, '/PBR-Pipeline/' on GitHub Pages
const B = import.meta.env.BASE_URL;
const TEX = {
  brick: {
    albedo:       `${B}assets/brick/Bricks104_1K-PNG_Color.png`,
    normal:       `${B}assets/brick/Bricks104_1K-PNG_NormalGL.png`,
    roughness:    `${B}assets/brick/Bricks104_1K-PNG_Roughness.png`,
    ao:           `${B}assets/brick/Bricks104_1K-PNG_AmbientOcclusion.png`,
    metalness:    null,
    displacement: `${B}assets/brick/Bricks104_1K-PNG_Displacement.png`,
  },
  metal: {
    albedo:       `${B}assets/metal/Metal055A_1K-PNG_Color.png`,
    normal:       `${B}assets/metal/Metal055A_1K-PNG_NormalGL.png`,
    roughness:    `${B}assets/metal/Metal055A_1K-PNG_Roughness.png`,
    ao:           null,
    metalness:    `${B}assets/metal/Metal055A_1K-PNG_Metalness.png`,
    displacement: `${B}assets/metal/Metal055A_1K-PNG_Displacement.png`,
  },
  rock: {
    albedo:       `${B}assets/rock/Rock064_1K-PNG_Color.png`,
    normal:       `${B}assets/rock/Rock064_1K-PNG_NormalGL.png`,
    roughness:    `${B}assets/rock/Rock064_1K-PNG_Roughness.png`,
    ao:           `${B}assets/rock/Rock064_1K-PNG_AmbientOcclusion.png`,
    metalness:    null,
    displacement: `${B}assets/rock/Rock064_1K-PNG_Displacement.png`,
  },
  rusty_metal: {
    albedo:       `${B}assets/rusty_metal/Metal055C_1K-PNG_Color.png`,
    normal:       `${B}assets/rusty_metal/Metal055C_1K-PNG_NormalGL.png`,
    roughness:    `${B}assets/rusty_metal/Metal055C_1K-PNG_Roughness.png`,
    ao:           null,
    metalness:    `${B}assets/rusty_metal/Metal055C_1K-PNG_Metalness.png`,
    displacement: `${B}assets/rusty_metal/Metal055C_1K-PNG_Displacement.png`,
  },
};

const MAT_NAMES = ['brick', 'metal', 'rock', 'rusty_metal'];

/* ─── App state ───────────────────────────────────────────────────────── */
const state = {
  selectedMat:     'brick',
  shaderMode:      'render',
  dispScale:       0.08,
  environment:     'studio',
  isolatedChannel: null,
  channels: {
    brick:       { albedo:true, normal:true, roughness:true, metalness:false, ao:true,  displacement:true },
    metal:       { albedo:true, normal:true, roughness:true, metalness:true,  ao:false, displacement:true },
    rock:        { albedo:true, normal:true, roughness:true, metalness:false, ao:true,  displacement:true },
    rusty_metal: { albedo:true, normal:true, roughness:true, metalness:true,  ao:false, displacement:true },
  },
};

/* ─── Three.js core ───────────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled  = true;
renderer.shadowMap.type     = THREE.PCFSoftShadowMap;

const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x2E3440);

const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
camera.position.set(0, 0, 9);

/* ─── Environment maps ────────────────────────────────────────────────── */
const pmrem  = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envCache = {};

function buildEnv(name) {
  if (envCache[name]) return envCache[name];
  if (name === 'studio') {
    const room = new RoomEnvironment(renderer);
    envCache.studio = pmrem.fromScene(room).texture;
    room.dispose();
  } else if (name === 'outdoor') {
    const sz = 512;
    const cv = document.createElement('canvas');
    cv.width = sz * 2; cv.height = sz;
    const cx = cv.getContext('2d');
    const sky = cx.createLinearGradient(0, 0, 0, sz * 0.55);
    sky.addColorStop(0, '#0c2244');
    sky.addColorStop(1, '#5ba3d9');
    cx.fillStyle = sky; cx.fillRect(0, 0, sz * 2, sz * 0.55);
    cx.fillStyle = '#4e5d38'; cx.fillRect(0, sz * 0.55, sz * 2, sz * 0.45);
    const tx = new THREE.CanvasTexture(cv);
    tx.mapping = THREE.EquirectangularReflectionMapping;
    envCache.outdoor = pmrem.fromEquirectangular(tx).texture;
    tx.dispose();
  }
  return envCache[name] || null;
}

function applyEnv(name) {
  const env = buildEnv(name);
  scene.environment = env;
  scene.background  = name === 'outdoor' ? env : new THREE.Color(0x3B4252);
  ambLight.intensity = 0.4;
  MAT_NAMES.forEach(n => {
    materials[n].envMapIntensity = state.shaderMode !== 'wireframe' ? 1.0 : 0;
  });
}

/* ─── Texture loader ──────────────────────────────────────────────────── */
const texLoader = new THREE.TextureLoader();
const texCache  = {};

function getTex(path, sRGB = false) {
  if (!path) return null;
  if (texCache[path]) return texCache[path];
  const t = texLoader.load(path, undefined, undefined, () => {
    console.warn('[pbr] texture failed:', path);
  });
  t.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache[path] = t;
  return t;
}

/* ─── Material builder ────────────────────────────────────────────────── */
function buildMat(matName) {
  const defs = TEX[matName];
  const ch   = state.channels[matName];
  const mat  = new THREE.MeshStandardMaterial({ side: THREE.FrontSide, envMapIntensity: 1.0 });

  if (ch.albedo && defs.albedo) {
    mat.map = getTex(defs.albedo, true);
  } else {
    mat.color = new THREE.Color(0xffffff);
  }

  if (ch.normal && defs.normal) {
    mat.normalMap   = getTex(defs.normal);
    mat.normalScale = new THREE.Vector2(1, 1);
  }

  mat.roughness = ch.roughness && defs.roughness
    ? (mat.roughnessMap = getTex(defs.roughness), 1.0)
    : 0.5;

  if (ch.metalness && defs.metalness) {
    mat.metalnessMap = getTex(defs.metalness);
    mat.metalness    = 1.0;
  } else {
    mat.metalness = matName === 'metal' ? 0.85 : 0.0;
  }

  if (ch.ao && defs.ao) {
    mat.aoMap          = getTex(defs.ao);
    mat.aoMapIntensity = 1.0;
  }

  if (ch.displacement && defs.displacement) {
    mat.displacementMap   = getTex(defs.displacement);
    mat.displacementScale = state.dispScale;
  } else {
    mat.displacementScale = 0;
  }

  return mat;
}

// Build a wireframe BufferGeometry that preserves UV from the source geometry.
// WireframeGeometry strips UVs, so we reconstruct edges manually to keep them.
function buildWireframeWithUV(srcGeo) {
  const pos   = srcGeo.attributes.position;
  const uv    = srcGeo.attributes.uv;
  const nrm   = srcGeo.attributes.normal;
  const index = srcGeo.index;

  const outPos = [], outUV = [], outNrm = [];

  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      outPos.push(pos.getX(a), pos.getY(a), pos.getZ(a));
      outUV.push(  uv.getX(a),  uv.getY(a));
      outNrm.push(nrm.getX(a), nrm.getY(a), nrm.getZ(a));
      outPos.push(pos.getX(b), pos.getY(b), pos.getZ(b));
      outUV.push(  uv.getX(b),  uv.getY(b));
      outNrm.push(nrm.getX(b), nrm.getY(b), nrm.getZ(b));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(outUV,  2));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(outNrm, 3));
  return geo;
}

// ShaderMaterial that applies the same displacement as MeshStandardMaterial,
// so the wireframe accurately traces the deformed surface.
function buildWireframeMat() {
  return new THREE.ShaderMaterial({
    uniforms: {
      dispMap:   { value: null },
      dispScale: { value: 0.0 },
      color:     { value: new THREE.Color(0x88C0D0) },
      opacity:   { value: 0.08 },
    },
    vertexShader: /* glsl */`
      uniform sampler2D dispMap;
      uniform float     dispScale;
      void main() {
        vec3 p = position;
        if (dispScale > 0.0) {
          p += normal * texture2D(dispMap, uv).r * dispScale;
        }
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  color;
      uniform float opacity;
      void main() { gl_FragColor = vec4(color, opacity); }
    `,
    transparent: true,
    depthTest:   false,
    depthWrite:  false,
  });
}

function isolateMat(matName, channel) {
  const path = TEX[matName][channel];
  if (!path) return new THREE.MeshBasicMaterial({ color: 0x333344 });
  const t = getTex(path, channel === 'albedo');
  return new THREE.MeshBasicMaterial({ map: t });
}

/* ─── Scene meshes ────────────────────────────────────────────────────── */
const meshes        = {};
const wfMeshes      = {};
const materials     = {};   // full PBR (render mode)

// Flat dark fill shown under wireframe lines — shared across all three meshes
const WIRE_FILL = new THREE.MeshBasicMaterial({ color: 0x2E3440, side: THREE.FrontSide });

// Shared black back-face cap — visible when a plane is rotated >90°
const BLACK_BACK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

const PLANE_W   = 2.0;
const PLANE_H   = 2.6;
const POSITIONS = [[-4.2, 0, 0], [-1.4, 0, 0], [1.4, 0, 0], [4.2, 0, 0]];
const ROTATIONS  = [0.3, 0.1, -0.1, -0.3];

MAT_NAMES.forEach((name, i) => {
  // 128×128 segments needed for displacementMap to look smooth
  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 128, 128);
  geo.setAttribute('uv2', geo.attributes.uv.clone());

  materials[name] = buildMat(name);
  const mesh = new THREE.Mesh(geo, materials[name]);
  mesh.position.set(...POSITIONS[i]);
  mesh.rotation.y    = ROTATIONS[i];
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  mesh.userData.matName = name;
  scene.add(mesh);
  meshes[name] = mesh;

  const back = new THREE.Mesh(geo, BLACK_BACK);
  back.position.copy(mesh.position);
  back.rotation.copy(mesh.rotation);
  scene.add(back);

  // Two wireframe LODs:
  //   geoLo + LineBasicMaterial : 1×1 quad, displacement OFF, clean outline
  //   geoHi + ShaderMaterial    : 128×128 with UV, samples dispMap in vertex shader
  const wfGeoLo = new THREE.WireframeGeometry(new THREE.PlaneGeometry(PLANE_W, PLANE_H));
  const wfGeoHi = buildWireframeWithUV(geo);
  const wfMatLo = new THREE.LineBasicMaterial({
    color: 0x88C0D0, transparent: true, opacity: 0.75,
    depthTest: false, depthWrite: false,
  });
  const wfMatHi = buildWireframeMat();
  const wf = new THREE.LineSegments(wfGeoLo, wfMatLo);
  wf.renderOrder = 1;
  wf.position.copy(mesh.position);
  wf.rotation.copy(mesh.rotation);
  wf.visible = false;
  wf.userData = { geoLo: wfGeoLo, geoHi: wfGeoHi, matLo: wfMatLo, matHi: wfMatHi };
  scene.add(wf);
  wfMeshes[name] = wf;
});

/* ─── Lighting ────────────────────────────────────────────────────────── */
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(3, 4, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
scene.add(dirLight);

const ambLight = new THREE.AmbientLight(0x8896a8, 0.4);
scene.add(ambLight);

/* ─── Light indicator ─────────────────────────────────────────────────── */
const lightBulb = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xFFEE88 }),
);
scene.add(lightBulb);

const lightLineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(), dirLight.position.clone(),
]);
const lightLine = new THREE.Line(
  lightLineGeo,
  new THREE.LineBasicMaterial({ color: 0xFFEE88, transparent: true, opacity: 0.25 }),
);
scene.add(lightLine);

function syncLightIndicator() {
  lightBulb.position.copy(dirLight.position);
  const pos = lightLineGeo.attributes.position;
  pos.setXYZ(1, dirLight.position.x, dirLight.position.y, dirLight.position.z);
  pos.needsUpdate = true;
}

/* ─── OrbitControls ───────────────────────────────────────────────────── */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance   = 2;
controls.maxDistance   = 20;
controls.target.set(0, 0, 0);

/* ─── Camera focus animation ──────────────────────────────────────────── */
const FOCUS_OVERVIEW = { pos: new THREE.Vector3(0, 0, 9), target: new THREE.Vector3(0, 0, 0) };

const camAnim = { active: false, t: 0,
  from: { pos: new THREE.Vector3(), target: new THREE.Vector3() },
  to:   { pos: new THREE.Vector3(), target: new THREE.Vector3() },
};

function focusCamera(toPos, toTarget) {
  camAnim.from.pos.copy(camera.position);
  camAnim.from.target.copy(controls.target);
  camAnim.to.pos.copy(toPos);
  camAnim.to.target.copy(toTarget);
  camAnim.t      = 0;
  camAnim.active = true;
}

/* ─── Raycaster ───────────────────────────────────────────────────────── */
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();
let   isDragging = false;
let   pointerDownPos = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', e => {
  isDragging = false;
  pointerDownPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', e => {
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;
});
canvas.addEventListener('pointerup', e => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x  =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  pointer.y  = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(Object.values(meshes));
  if (hits.length) selectMaterial(hits[0].object.userData.matName);
});

/* ─── Core update helpers ─────────────────────────────────────────────── */

// Switch wireframe LOD and material based on displacement state
function syncWireframeGeo(name) {
  const wf   = wfMeshes[name];
  const disp = state.channels[name].displacement && TEX[name].displacement;
  if (disp) {
    wf.geometry = wf.userData.geoHi;
    wf.material = wf.userData.matHi;
    // Bind current displacement texture and scale to the wireframe shader
    wf.userData.matHi.uniforms.dispMap.value   = getTex(TEX[name].displacement);
    wf.userData.matHi.uniforms.dispScale.value = state.dispScale;
  } else {
    wf.geometry = wf.userData.geoLo;
    wf.material = wf.userData.matLo;
  }
}

// Single source of truth: assign the correct material to a mesh given current state
function syncMeshMaterial(name) {
  // Isolation overrides everything on the selected mesh
  if (state.isolatedChannel !== null && name === state.selectedMat) return;
  if (state.shaderMode === 'wireframe') {
    meshes[name].material = WIRE_FILL;
  } else {
    // render + mix both use the full PBR material
    meshes[name].material = materials[name];
  }
}

// Always set emissive on the PBR material so highlight persists across mode switches
function setHighlight(activeName) {
  MAT_NAMES.forEach(n => {
    const m = materials[n];
    if (m?.isMeshStandardMaterial) m.emissive.setHex(n === activeName ? 0x0d1520 : 0x000000);
  });
}

function rebuildMaterial(matName) {
  materials[matName]?.dispose();
  materials[matName] = buildMat(matName);
  materials[matName].envMapIntensity =
    state.shaderMode !== 'wireframe' ? 1.0 : 0;
  syncMeshMaterial(matName);
  syncWireframeGeo(matName);
  setHighlight(state.selectedMat);
}

function applyShaderMode(mode) {
  MAT_NAMES.forEach(name => {
    // wireframe lines visible in both wireframe-only and mix modes
    wfMeshes[name].visible = mode === 'wireframe' || mode === 'mix';
    materials[name].envMapIntensity =
      mode !== 'wireframe' ? 1.0 : 0;
    syncMeshMaterial(name);
  });
}

function selectMaterial(name) {
  state.selectedMat    = name;
  state.isolatedChannel = null;

  matItems.forEach(el => {
    const active = el.dataset.mat === name;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
  });

  channelRows.forEach(row => {
    const ch        = row.dataset.channel;
    const available = TEX[name][ch] !== null;
    const checked   = state.channels[name][ch];
    const cb        = row.querySelector('input[type=checkbox]');
    cb.checked  = checked;
    cb.disabled = !available;
    row.classList.toggle('unavailable', !available);
  });

  isolateBtns.forEach(b => b.classList.remove('active'));
  rebuildMaterial(name);
  updatePreviewStrip(name);
  setHighlight(name);
}

function updatePreviewStrip(matName) {
  document.querySelectorAll('.tex-thumb').forEach(thumb => {
    const ch   = thumb.dataset.channel;
    const path = TEX[matName][ch];
    const img  = thumb.querySelector('img');
    if (path) {
      img.src = path;
      thumb.classList.remove('na');
    } else {
      img.removeAttribute('src');
      thumb.classList.add('na');
    }
    thumb.classList.remove('active');
  });
}

/* ─── Event listeners ─────────────────────────────────────────────────── */

// Shader modes
modeBtns.forEach(btn => btn.addEventListener('click', () => {
  modeBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.shaderMode = btn.dataset.mode;
  applyShaderMode(state.shaderMode);
}));

// Environment
envBtns.forEach(btn => btn.addEventListener('click', () => {
  envBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.environment = btn.dataset.env;
  applyEnv(state.environment);
}));

// Material selection
matItems.forEach(item => {
  item.addEventListener('click', () => selectMaterial(item.dataset.mat));
  item.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') selectMaterial(item.dataset.mat);
  });
});

// Channel toggles
channelRows.forEach(row => {
  const ch = row.dataset.channel;
  const cb = row.querySelector('input[type=checkbox]');
  cb.addEventListener('change', () => {
    state.channels[state.selectedMat][ch] = cb.checked;
    state.isolatedChannel = null;
    isolateBtns.forEach(b => b.classList.remove('active'));
    rebuildMaterial(state.selectedMat);
  });
});

// Isolate buttons
isolateBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const ch = btn.dataset.channel;
    if (!TEX[state.selectedMat][ch]) return;
    if (state.isolatedChannel === ch) {
      state.isolatedChannel = null;
      isolateBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tex-thumb').forEach(t => t.classList.remove('active'));
      syncMeshMaterial(state.selectedMat);
    } else {
      state.isolatedChannel = ch;
      isolateBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tex-thumb').forEach(t =>
        t.classList.toggle('active', t.dataset.channel === ch));
      meshes[state.selectedMat].material = isolateMat(state.selectedMat, ch);
    }
  });
});

// Texture preview click — also isolates the channel
document.querySelectorAll('.tex-thumb').forEach(thumb => {
  thumb.addEventListener('click', () => {
    const ch  = thumb.dataset.channel;
    const btn = document.querySelector(`.isolate-btn[data-channel="${ch}"]`);
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
});

// Focus
focusSelect.addEventListener('change', () => {
  const val = focusSelect.value;
  if (val === 'overview') {
    focusCamera(FOCUS_OVERVIEW.pos, FOCUS_OVERVIEW.target);
  } else {
    const idx = MAT_NAMES.indexOf(val);
    if (idx === -1) return;
    const x = POSITIONS[idx][0];
    focusCamera(
      new THREE.Vector3(x, 0, 5),
      new THREE.Vector3(x, 0, 0),
    );
  }
});

function updateLightPosition() {
  const rad = (parseFloat(azimuthEl.value) * Math.PI) / 180;
  dirLight.position.x = Math.cos(rad) * 6;
  dirLight.position.z = Math.sin(rad) * 6;
  syncLightIndicator();
}

// Light azimuth
azimuthEl.addEventListener('input', updateLightPosition);

// Light intensity
intensityEl.addEventListener('input', () => {
  dirLight.intensity = parseFloat(intensityEl.value);
  intensityVal.textContent = parseFloat(intensityEl.value).toFixed(1);
});

// Displacement scale — update all materials and wireframe shaders live
dispScaleEl.addEventListener('input', () => {
  state.dispScale = parseFloat(dispScaleEl.value);
  dispScaleVal.textContent = state.dispScale.toFixed(2);
  MAT_NAMES.forEach(name => {
    const m = materials[name];
    if (m.displacementMap) m.displacementScale = state.dispScale;
    const hi = wfMeshes[name].userData.matHi;
    if (hi) hi.uniforms.dispScale.value = state.dispScale;
  });
});

/* ─── Resize ──────────────────────────────────────────────────────────── */
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(viewportEl);

/* ─── Animation loop ──────────────────────────────────────────────────── */
let frameCount = 0;
let lastSecond = performance.now();

function animate() {
  requestAnimationFrame(animate);

  if (camAnim.active) {
    camAnim.t = Math.min(1, camAnim.t + 0.04);
    const ease = 1 - Math.pow(1 - camAnim.t, 3); // cubic ease-out
    camera.position.lerpVectors(camAnim.from.pos,    camAnim.to.pos,    ease);
    controls.target.lerpVectors(camAnim.from.target, camAnim.to.target, ease);
    if (camAnim.t >= 1) camAnim.active = false;
  }

  controls.update();
  renderer.render(scene, camera);

  frameCount++;
  const now = performance.now();
  if (now - lastSecond >= 1000) {
    statFpsEl.textContent   = `FPS: ${frameCount}`;
    statDrawsEl.textContent = `Draw calls: ${renderer.info.render.calls}`;
    statTrisEl.textContent  = `Triangles: ${renderer.info.render.triangles.toLocaleString()}`;
    frameCount = 0;
    lastSecond = now;
    renderer.info.reset();
  }
}
animate();

/* ─── Math modal ──────────────────────────────────────────────────────── */
const MODAL_COPY = {
  en: `
<h3>Texture Pipeline</h3>

<p><strong>Albedo</strong> stores the base diffuse colour $c_{\\text{diff}}$ of the surface, free of any lighting or shadow bake. For dielectrics it also seeds the specular base reflectance $F_0 \\approx 0.04$; for metals $F_0 = c_{\\text{diff}}$.</p>

<p><strong>Normal Map</strong> encodes a per-texel tangent-space normal as an RGB triplet — $(0.5, 0.5, 1.0)$ means "flat". At shading time the stored vector replaces the interpolated geometry normal $\\mathbf{n}$, adding surface detail without extra polygons.</p>

<p><strong>Roughness</strong> controls micro-surface irregularity. It maps to the GGX width parameter via $\\alpha = roughness^2$. A value of 0 gives mirror-sharp reflections; 1 gives fully diffuse scattering.</p>

<p><strong>Metalness</strong> is a binary-like mask (0 = dielectric, 1 = conductor). It blends $F_0$ between the dielectric default $(0.04)$ and the albedo colour, and suppresses the diffuse term for metals:</p>
<p>$$F_0 = \\text{mix}(0.04,\\; c_{\\text{diff}},\\; metalness)$$</p>

<p><strong>Ambient Occlusion</strong> is a pre-baked grey-scale map approximating how much ambient indirect light reaches each texel. It multiplies the indirect lighting contribution — 0 = fully occluded, 1 = fully exposed.</p>

<p><strong>Displacement</strong> offsets each vertex along its surface normal by the stored height value $h \\in [0,1]$, scaled by a user-controlled factor $s$:</p>
<p>$$\\mathbf{p}' = \\mathbf{p} + \\mathbf{n} \\cdot h \\cdot s$$</p>
<p>This produces real geometric relief visible in silhouettes and self-shadowing, but requires a highly-tessellated mesh (here 128 × 128 segments).</p>

<h3>Cook-Torrance BRDF</h3>

<p>The full reflectance equation combines a Lambertian diffuse term with the specular microfacet model:</p>
<p>$$f_r = \\frac{c_{\\text{diff}}}{\\pi} + \\frac{D(\\mathbf{h})\\,G(\\mathbf{l},\\mathbf{v})\\,F(\\mathbf{v},\\mathbf{h})}{4\\,(\\mathbf{n}\\cdot\\mathbf{l})(\\mathbf{n}\\cdot\\mathbf{v})}$$</p>
<p>The <strong>GGX Normal Distribution Function</strong> $D$ describes the statistical orientation of micro-facets for roughness $\\alpha$:</p>
<p>$$D_{\\text{GGX}}(\\mathbf{h}) = \\frac{\\alpha^2}{\\pi\\bigl((\\mathbf{n}\\cdot\\mathbf{h})^2(\\alpha^2-1)+1\\bigr)^2}$$</p>
<p>The <strong>Smith Geometry Function</strong> $G$ accounts for micro-surface self-shadowing and masking:</p>
<p>$$G_{\\text{Smith}}(\\mathbf{l},\\mathbf{v}) = G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{l},\\,\\alpha)\\cdot G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{v},\\,\\alpha)$$</p>
<p>The <strong>Fresnel-Schlick</strong> term $F$ determines how reflective the surface is, peaking at grazing angles:</p>
<p>$$F_{\\text{Schlick}}(\\mathbf{v},\\mathbf{h}) = F_0 + (1-F_0)(1-\\mathbf{v}\\cdot\\mathbf{h})^5$$</p>
<p>Core GLSL implementation:</p>
<pre><code class="language-glsl">float D_GGX(float NdotH, float alpha2) {
    float denom = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
    return alpha2 / (PI * denom * denom);
}
float G_Smith(float NdotV, float NdotL, float roughness) {
    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    float gv = NdotV / (NdotV * (1.0 - k) + k);
    float gl = NdotL / (NdotL * (1.0 - k) + k);
    return gv * gl;
}
vec3 F_Schlick(float HdotV, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - HdotV, 5.0);
}
vec3 specular = (D * G * F) / max(4.0 * NdotL * NdotV, 0.001);</code></pre>
`,
  zhTW: `
<h3>貼圖 Pipeline</h3>

<p><strong>Albedo（反照率）</strong>儲存表面的基礎漫反射顏色 $c_{\\text{diff}}$，不含任何光照或陰影烘焙。對非導體而言，它同時決定鏡面基礎反射率 $F_0 \\approx 0.04$；對金屬而言 $F_0 = c_{\\text{diff}}$。</p>

<p><strong>Normal Map（法線貼圖）</strong>以 RGB 三通道編碼切線空間法線，$(0.5, 0.5, 1.0)$ 代表平坦表面。渲染時用貼圖法線取代插值幾何法線 $\\mathbf{n}$，在不增加多邊形的情況下模擬表面細節。</p>

<p><strong>Roughness（粗糙度）</strong>控制微表面的不規則程度，透過 $\\alpha = roughness^2$ 映射到 GGX 寬度參數。值為 0 時反射如鏡；值為 1 時完全漫反射。</p>

<p><strong>Metalness（金屬度）</strong>近似二元遮罩（0 = 非導體，1 = 導體），用來混合 $F_0$ 值並壓制金屬的漫反射項：</p>
<p>$$F_0 = \\text{mix}(0.04,\\; c_{\\text{diff}},\\; metalness)$$</p>

<p><strong>Ambient Occlusion（環境遮蔽）</strong>是預先烘焙的灰階貼圖，近似各點能接收到多少間接環境光。它乘以間接光照貢獻——0 表示完全遮蔽，1 表示完全暴露。</p>

<p><strong>Displacement（位移）</strong>將每個頂點沿法線方向偏移，偏移量由高度值 $h \\in [0,1]$ 乘以使用者控制的縮放係數 $s$ 決定：</p>
<p>$$\\mathbf{p}' = \\mathbf{p} + \\mathbf{n} \\cdot h \\cdot s$$</p>
<p>此效果產生真實的幾何凹凸，可見於輪廓與自陰影，但需要高密度網格（本場景使用 128 × 128 個細分段）。</p>

<h3>Cook-Torrance BRDF</h3>

<p>完整反射率方程結合 Lambertian 漫反射項與鏡面微表面模型：</p>
<p>$$f_r = \\frac{c_{\\text{diff}}}{\\pi} + \\frac{D(\\mathbf{h})\\,G(\\mathbf{l},\\mathbf{v})\\,F(\\mathbf{v},\\mathbf{h})}{4\\,(\\mathbf{n}\\cdot\\mathbf{l})(\\mathbf{n}\\cdot\\mathbf{v})}$$</p>
<p><strong>GGX 法線分布函數</strong> $D$ 描述粗糙度 $\\alpha$ 下微表面朝向的統計分布：</p>
<p>$$D_{\\text{GGX}}(\\mathbf{h}) = \\frac{\\alpha^2}{\\pi\\bigl((\\mathbf{n}\\cdot\\mathbf{h})^2(\\alpha^2-1)+1\\bigr)^2}$$</p>
<p><strong>Smith 幾何函數</strong> $G$ 處理微表面的自遮蔽與遮掩效應：</p>
<p>$$G_{\\text{Smith}}(\\mathbf{l},\\mathbf{v}) = G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{l},\\,\\alpha)\\cdot G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{v},\\,\\alpha)$$</p>
<p><strong>Fresnel-Schlick 近似</strong> $F$ 決定反射率，在掠射角時達到峰值：</p>
<p>$$F_{\\text{Schlick}}(\\mathbf{v},\\mathbf{h}) = F_0 + (1-F_0)(1-\\mathbf{v}\\cdot\\mathbf{h})^5$$</p>
<p>核心 GLSL 實作：</p>
<pre><code class="language-glsl">float D_GGX(float NdotH, float alpha2) {
    float denom = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
    return alpha2 / (PI * denom * denom);
}
float G_Smith(float NdotV, float NdotL, float roughness) {
    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    float gv = NdotV / (NdotV * (1.0 - k) + k);
    float gl = NdotL / (NdotL * (1.0 - k) + k);
    return gv * gl;
}
vec3 F_Schlick(float HdotV, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - HdotV, 5.0);
}
vec3 specular = (D * G * F) / max(4.0 * NdotL * NdotV, 0.001);</code></pre>
`,
};

let modalLang = 'en';

function renderModal() {
  mathContent.innerHTML = MODAL_COPY[modalLang];
  renderMathInElement(mathContent, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$',  right: '$',  display: false },
    ],
    throwOnError: false,
  });
  Prism.highlightAllUnder(mathContent);
}

openMathBtn.addEventListener('click',  () => { renderModal(); mathModal.hidden = false; });
closeMathBtn.addEventListener('click', () => { mathModal.hidden = true; });
langToggle.addEventListener('click',   () => { modalLang = modalLang === 'en' ? 'zhTW' : 'en'; renderModal(); });
mathModal.addEventListener('click',    e  => { if (e.target === mathModal) mathModal.hidden = true; });

/* ─── Init ────────────────────────────────────────────────────────────── */
applyEnv('studio');
selectMaterial('brick');
applyShaderMode('render');
MAT_NAMES.forEach(syncWireframeGeo);
updateLightPosition();
