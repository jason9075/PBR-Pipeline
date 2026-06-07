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
const channelRows  = document.querySelectorAll('.channel-row');
const isolateBtns  = document.querySelectorAll('.isolate-btn');
const statFpsEl    = document.getElementById('stat-fps');
const statDrawsEl  = document.getElementById('stat-draws');
const statTrisEl   = document.getElementById('stat-tris');
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
    albedo:    `${B}assets/brick/Bricks104_1K-PNG_Color.png`,
    normal:    `${B}assets/brick/Bricks104_1K-PNG_NormalGL.png`,
    roughness: `${B}assets/brick/Bricks104_1K-PNG_Roughness.png`,
    ao:        `${B}assets/brick/Bricks104_1K-PNG_AmbientOcclusion.png`,
    metalness: null,
  },
  metal: {
    albedo:    `${B}assets/metal/Metal055A_1K-PNG_Color.png`,
    normal:    `${B}assets/metal/Metal055A_1K-PNG_NormalGL.png`,
    roughness: `${B}assets/metal/Metal055A_1K-PNG_Roughness.png`,
    ao:        null,
    metalness: `${B}assets/metal/Metal055A_1K-PNG_Metalness.png`,
  },
  rock: {
    albedo:    `${B}assets/rock/Rock064_1K-PNG_Color.png`,
    normal:    `${B}assets/rock/Rock064_1K-PNG_NormalGL.png`,
    roughness: `${B}assets/rock/Rock064_1K-PNG_Roughness.png`,
    ao:        `${B}assets/rock/Rock064_1K-PNG_AmbientOcclusion.png`,
    metalness: null,
  },
};

const MAT_NAMES   = ['brick', 'metal', 'rock'];
const MAT_LABELS  = { brick: 'Brick Wall', metal: 'Metal Plate', rock: 'Rock Surface' };
const CHANNELS    = ['albedo', 'normal', 'roughness', 'metalness', 'ao'];

/* ─── App state ───────────────────────────────────────────────────────── */
const state = {
  selectedMat:     'brick',
  shaderMode:      'render',
  environment:     'studio',
  isolatedChannel: null,
  channels: {
    brick: { albedo:true, normal:true, roughness:true, metalness:false, ao:true },
    metal: { albedo:true, normal:true, roughness:true, metalness:true,  ao:false },
    rock:  { albedo:true, normal:true, roughness:true, metalness:false, ao:true },
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
  if (name === 'none') {
    scene.environment = null;
    scene.background  = new THREE.Color(0x2E3440);
    ambLight.intensity = 0.8;
  } else {
    const env = buildEnv(name);
    scene.environment = env;
    scene.background  = name === 'outdoor' ? env : new THREE.Color(0x3B4252);
    ambLight.intensity = 0.4;
  }
  MAT_NAMES.forEach(n => {
    materials[n].envMapIntensity =
      (name !== 'none' && state.shaderMode === 'render') ? 1.0 : 0;
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

  return mat;
}

// Albedo-only MeshStandardMaterial — shows form under direct light, no PBR effects
function buildSolidMat(matName) {
  const defs = TEX[matName];
  const ch   = state.channels[matName];
  const mat  = new THREE.MeshStandardMaterial({
    side: THREE.FrontSide,
    envMapIntensity: 0,
    roughness: 1.0,
    metalness: 0.0,
  });
  if (ch.albedo && defs.albedo) mat.map = getTex(defs.albedo, true);
  return mat;
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
const solidMats     = {};   // albedo-only diffuse (solid mode)

// Flat dark fill shown under wireframe lines — shared across all three meshes
const WIRE_FILL = new THREE.MeshBasicMaterial({ color: 0x2E3440, side: THREE.FrontSide });

// Shared black back-face cap — visible when a plane is rotated >90°
const BLACK_BACK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

const PLANE_W   = 2.0;
const PLANE_H   = 2.6;
const POSITIONS = [[-2.8, 0, 0], [0, 0, 0], [2.8, 0, 0]];
const ROTATIONS  = [0.22, 0, -0.22];

MAT_NAMES.forEach((name, i) => {
  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H);
  geo.setAttribute('uv2', geo.attributes.uv.clone());

  materials[name] = buildMat(name);
  solidMats[name] = buildSolidMat(name);
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

  const wfGeo = new THREE.WireframeGeometry(geo);
  const wfMat = new THREE.LineBasicMaterial({
    color: 0x88C0D0, transparent: true, opacity: 0.75,
    depthTest: false, depthWrite: false,
  });
  const wf = new THREE.LineSegments(wfGeo, wfMat);
  wf.renderOrder = 1;
  wf.position.copy(mesh.position);
  wf.rotation.copy(mesh.rotation);
  wf.visible = false;
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

/* ─── OrbitControls ───────────────────────────────────────────────────── */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance   = 2;
controls.maxDistance   = 20;
controls.target.set(0, 0, 0);

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

// Single source of truth: assign the correct material to a mesh given current state
function syncMeshMaterial(name) {
  // Isolation overrides everything on the selected mesh
  if (state.isolatedChannel !== null && name === state.selectedMat) return;
  if (state.shaderMode === 'wireframe') {
    meshes[name].material = WIRE_FILL;
  } else if (state.shaderMode === 'solid') {
    meshes[name].material = solidMats[name];
  } else {
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
  solidMats[matName]?.dispose();
  materials[matName] = buildMat(matName);
  solidMats[matName] = buildSolidMat(matName);
  materials[matName].envMapIntensity =
    (state.shaderMode === 'render' && state.environment !== 'none') ? 1.0 : 0;
  syncMeshMaterial(matName);
  setHighlight(state.selectedMat);
}

function applyShaderMode(mode) {
  MAT_NAMES.forEach(name => {
    wfMeshes[name].visible = mode === 'wireframe';
    materials[name].envMapIntensity =
      (mode === 'render' && state.environment !== 'none') ? 1.0 : 0;
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

// Light azimuth
azimuthEl.addEventListener('input', () => {
  const rad = (parseFloat(azimuthEl.value) * Math.PI) / 180;
  dirLight.position.x = Math.cos(rad) * 6;
  dirLight.position.z = Math.sin(rad) * 6;
});

// Light intensity
intensityEl.addEventListener('input', () => {
  dirLight.intensity = parseFloat(intensityEl.value);
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
<p>PBR uses the <strong>Cook-Torrance BRDF</strong> to model specular reflection plus a Lambertian diffuse term:</p>
<p>$$f_r = \\frac{c_{\\text{diff}}}{\\pi} + \\frac{D(\\mathbf{h})\\,G(\\mathbf{l},\\mathbf{v})\\,F(\\mathbf{v},\\mathbf{h})}{4\\,(\\mathbf{n}\\cdot\\mathbf{l})(\\mathbf{n}\\cdot\\mathbf{v})}$$</p>
<p>The <strong>GGX Normal Distribution Function</strong> controls specular highlight sharpness from roughness $\\alpha$:</p>
<p>$$D_{\\text{GGX}}(\\mathbf{h}) = \\frac{\\alpha^2}{\\pi\\bigl((\\mathbf{n}\\cdot\\mathbf{h})^2(\\alpha^2-1)+1\\bigr)^2}$$</p>
<p>The <strong>Smith Geometry Function</strong> models micro-surface self-shadowing:</p>
<p>$$G_{\\text{Smith}}(\\mathbf{l},\\mathbf{v}) = G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{l},\\,\\alpha)\\cdot G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{v},\\,\\alpha)$$</p>
<p>The <strong>Fresnel-Schlick</strong> approximation determines base reflectivity and grazing-angle response:</p>
<p>$$F_{\\text{Schlick}}(\\mathbf{v},\\mathbf{h}) = F_0 + (1-F_0)(1-\\mathbf{v}\\cdot\\mathbf{h})^5$$</p>
<p>Core GLSL implementation of the specular term:</p>
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
<p>PBR 使用 <strong>Cook-Torrance BRDF</strong> 來模擬鏡面反射，加上 Lambertian 漫反射項：</p>
<p>$$f_r = \\frac{c_{\\text{diff}}}{\\pi} + \\frac{D(\\mathbf{h})\\,G(\\mathbf{l},\\mathbf{v})\\,F(\\mathbf{v},\\mathbf{h})}{4\\,(\\mathbf{n}\\cdot\\mathbf{l})(\\mathbf{n}\\cdot\\mathbf{v})}$$</p>
<p><strong>GGX 法線分布函數</strong>根據粗糙度 $\\alpha$ 控制高光的集中程度：</p>
<p>$$D_{\\text{GGX}}(\\mathbf{h}) = \\frac{\\alpha^2}{\\pi\\bigl((\\mathbf{n}\\cdot\\mathbf{h})^2(\\alpha^2-1)+1\\bigr)^2}$$</p>
<p><strong>Smith 幾何函數</strong>模擬微表面的自遮蔽效應：</p>
<p>$$G_{\\text{Smith}}(\\mathbf{l},\\mathbf{v}) = G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{l},\\,\\alpha)\\cdot G_{\\text{sub}}(\\mathbf{n}\\cdot\\mathbf{v},\\,\\alpha)$$</p>
<p><strong>Fresnel-Schlick 近似</strong>計算基礎反射率及掠射角的亮度增強：</p>
<p>$$F_{\\text{Schlick}}(\\mathbf{v},\\mathbf{h}) = F_0 + (1-F_0)(1-\\mathbf{v}\\cdot\\mathbf{h})^5$$</p>
<p>鏡面項的核心 GLSL 實作：</p>
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
