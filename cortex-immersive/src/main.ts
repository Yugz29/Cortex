/**
 * Cortex Immersive — point d'entrée.
 *
 * - Desktop : prévisualisation OrbitControls (itération sans casque).
 * - Quest 3 : WebXR via ARButton (immersive-ar / mixed reality) si supporté,
 *   fallback VRButton (immersive-vr) sinon.
 * - Interaction : raycasting (souris ou contrôleurs XR), sélection d'un nœud,
 *   mise en évidence, panneau de métriques.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Scan, Edge } from '@cortex/types';
import { fetchGraph, buildGraphGroup, makeNodeLabelSprite, type GraphSceneResult } from './graphScene';
import { selectionNeighborhood } from './graphNeighborhood';
import { fileBasename } from './nodeLabels';
import { MetricsPanel } from './metricsPanel';
import {
  oneHandGrabTransform, twoHandGrabTransform,
  type Pose, type GroupTransform,
} from './graphManipulation';
import { panelPoseFor } from './panelPlacement';

const status = document.getElementById('status')!;

function setStatus(html: string | null): void {
  if (html === null) { status.classList.add('hidden'); return; }
  status.classList.remove('hidden');
  status.innerHTML = html;
}

// ── Renderer / scène / caméra ────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
// Aligné sur l'écran, borné à 2 pour la perf (Quest inclus)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Fond opaque en desktop/VR ; en AR le fond est rendu transparent au démarrage de session
const DESKTOP_BG = new THREE.Color(0x0d0d0f);
scene.background = DESKTOP_BG;

// Fog de profondeur : estompe progressivement le lointain (lisibilité du
// maillage + perception de profondeur en VR). Couleur = fond. Désactivé en AR
// (fond passthrough transparent, un fondu vers le sombre serait incohérent).
const FOG_DENSITY = 0.08;
const SCENE_FOG = new THREE.FogExp2(DESKTOP_BG.getHex(), FOG_DENSITY);
scene.fog = SCENE_FOG;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.02, 100);
camera.position.set(0, 1.6, 2.6);

// Rig lumineux doux, sans ombres portées : hémisphère (dégradé ambiant
// ciel/sol) + key light directionnelle + fill froid discret à l'opposé.
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x14141c, 0.85));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
keyLight.position.set(2.5, 4, 2.5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x8899bb, 0.35);
fillLight.position.set(-3, 1.5, -2.5);
scene.add(fillLight);

// Le graphe est placé à hauteur des yeux, légèrement devant l'origine XR,
// pour qu'on puisse marcher autour dans le Quest.
const GRAPH_CENTER = new THREE.Vector3(0, 1.4, -1.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(GRAPH_CENTER);
controls.enableDamping = true;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // LineMaterial calcule l'épaisseur en pixels à partir de cette résolution
  if (edgeLines) {
    edgeLines.all.material.resolution.set(window.innerWidth, window.innerHeight);
    edgeLines.focus.material.resolution.set(window.innerWidth, window.innerHeight);
  }
});

// ── Sélection / surbrillance ─────────────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const panel = new MetricsPanel();
scene.add(panel.mesh);

let nodeMeshes: THREE.Mesh[] = [];
let selected: THREE.Mesh | null = null;
let displayEdges: Edge[] = [];
let edgeLines: GraphSceneResult['edgeLines'] = null;

// ── Mise en évidence contextuelle du voisinage sélectionné ───────────────────
// Voisins directs + arêtes du nœud : apparence normale (arêtes accentuées via
// la surcouche focus, calque `all` entièrement masqué) ; nœuds non connectés
// atténués ; noms de fichiers affichés au-dessus du voisinage. Recalculé UNE
// fois à chaque sélection/désélection — rien par frame.

const DIM_NODE_OPACITY = 0.15;

// Sprites de noms de fichiers du voisinage courant (enfants du graphGroup :
// ils suivent le graphe pendant sa manipulation).
const labelSprites: THREE.Sprite[] = [];

function clearNodeLabels(): void {
  for (const s of labelSprites) {
    s.parent?.remove(s);
    const mat = s.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
  labelSprites.length = 0;
}

function applyNeighborhoodFocus(mesh: THREE.Mesh | null): void {
  clearNodeLabels();

  if (!mesh) {
    for (const m of nodeMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = false;
      mat.opacity = 1;
    }
    if (edgeLines) {
      edgeLines.all.visible = true;
      edgeLines.focus.visible = false;
    }
    return;
  }

  const selectedId = (mesh.userData['scan'] as Scan).filePath;
  const hood = selectionNeighborhood(displayEdges, selectedId);

  for (const m of nodeMeshes) {
    const mat  = m.material as THREE.MeshStandardMaterial;
    const scan = m.userData['scan'] as Scan;
    const kept = hood.nodes.has(scan.filePath);
    mat.transparent = !kept;
    mat.opacity = kept ? 1 : DIM_NODE_OPACITY;

    // Nom de fichier au-dessus du nœud sélectionné et de chaque voisin
    if (kept && graphGroup) {
      const label = makeNodeLabelSprite(fileBasename(scan.filePath));
      label.position.copy(m.position);
      label.position.y += (m.userData['baseRadius'] as number) * 1.5 + 0.06;
      graphGroup.add(label);
      labelSprites.push(label);
    }
  }

  if (edgeLines) {
    // Hors voisinage : les arêtes disparaissent entièrement (pas d'atténuation)
    edgeLines.all.visible = false;
    // Surcouche focus : sous-ensemble des buffers, 6 floats par arête
    const pos: number[] = [];
    const col: number[] = [];
    for (const i of hood.edges) {
      for (let k = 0; k < 6; k++) {
        pos.push(edgeLines.positions[6 * i + k]!);
        col.push(edgeLines.colors[6 * i + k]!);
      }
    }
    if (pos.length > 0) {
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos);
      geo.setColors(col);
      edgeLines.focus.geometry.dispose();
      edgeLines.focus.geometry = geo;
      edgeLines.focus.visible = true;
    } else {
      edgeLines.focus.visible = false;
    }
  }
}

function selectNode(mesh: THREE.Mesh | null): void {
  if (selected) {
    (selected.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    selected.scale.setScalar(selected.userData['baseRadius']);
  }
  selected = mesh;
  applyNeighborhoodFocus(mesh);
  if (!mesh) { panel.hide(); return; }

  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.emissive.copy(mat.color).multiplyScalar(0.55);
  mesh.scale.setScalar(mesh.userData['baseRadius'] * 1.45);

  const scan = mesh.userData['scan'] as Scan;
  panel.setScan(scan);
  // Pupitre : pose recalculée depuis la caméra à l'instant de la sélection —
  // sauf si le panneau est ancré (pin) : contenu rafraîchi, pose intacte.
  if (!panel.pinned) {
    // Un drag de panneau en cours devient caduc (le panneau vient d'être replacé).
    panelDrag = null;
    panel.placeAt(panelPoseFor(activeCameraPose()));
  }
}

/**
 * Cible du rayon courant, par plus proche intersection :
 * les éléments du panneau (barre de préhension, bouton d'ancrage) sont
 * prioritaires uniquement s'ils sont réellement devant le premier nœud
 * touché — pas de sélection accidentelle d'un nœud en les visant, ni
 * l'inverse. Barre et pin sont côte à côte, jamais superposés entre eux ;
 * un même rayon les départage aussi par distance.
 * (Le corps du panneau n'est pas une cible : comportement inchangé.)
 */
type RayTarget =
  | { kind: 'handle' }
  | { kind: 'pin' }
  | { kind: 'node'; mesh: THREE.Mesh }
  | { kind: 'none' };

function targetFromRaycaster(): RayTarget {
  const nodeHit  = raycaster.intersectObjects(nodeMeshes, false)[0];
  const panelHit = panel.mesh.visible
    ? raycaster.intersectObjects([panel.handle, panel.pinButton], false)[0]   // trié par distance
    : undefined;
  if (panelHit && (!nodeHit || panelHit.distance <= nodeHit.distance)) {
    return panelHit.object === panel.pinButton ? { kind: 'pin' } : { kind: 'handle' };
  }
  return nodeHit ? { kind: 'node', mesh: nodeHit.object as THREE.Mesh } : { kind: 'none' };
}

function pickFromRaycaster(): void {
  const target = targetFromRaycaster();
  if (target.kind === 'handle') return;               // la barre n'est pas une cible de sélection
  if (target.kind === 'pin')    { panel.togglePin(); return; }
  selectNode(target.kind === 'node' ? target.mesh : null);
}

// ── Drag du panneau par sa barre de préhension ───────────────────────────────
// Même principe que le grab une-main du graphe : oneHandGrabTransform est
// réutilisée telle quelle (échelle 1), l'offset panneau↔contrôleur est capturé
// au selectstart sur la barre puis réappliqué à chaque frame.

let panelDrag: { controller: THREE.Object3D; startController: Pose; startPanel: GroupTransform } | null = null;

function updatePanelDrag(): void {
  if (!panelDrag) return;
  applyTransform(panel.mesh, oneHandGrabTransform(
    panelDrag.startController, panelDrag.startPanel, poseOf(panelDrag.controller),
  ));
}

// Souris (préviz desktop) — clic = sélection
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  // Ignorer les drags d'orbite
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  pickFromRaycaster();
});

// Contrôleurs XR — rayon visible + sélection au trigger (select),
// manipulation du graphe au grip (squeeze) : jamais en conflit.
const controllerRayGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5),
]);
const tempMatrix = new THREE.Matrix4();

for (const i of [0, 1]) {
  const controller = renderer.xr.getController(i);
  const ray = new THREE.Line(controllerRayGeo, new THREE.LineBasicMaterial({ color: 0x8e8e93, transparent: true, opacity: 0.6 }));
  ray.name = 'ray';
  controller.add(ray);
  controller.addEventListener('selectstart', () => {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    const target = targetFromRaycaster();
    if (target.kind === 'handle') {
      // Gâchette tenue sur la barre → le panneau suit rigidement le contrôleur
      panelDrag = { controller, startController: poseOf(controller), startPanel: transformOf(panel.mesh) };
    } else if (target.kind === 'pin') {
      panel.togglePin();                              // simple toggle, pas de drag
    } else {
      selectNode(target.kind === 'node' ? target.mesh : null);
    }
  });
  controller.addEventListener('selectend', () => {
    if (panelDrag?.controller === controller) panelDrag = null;   // le panneau reste où il est lâché
  });
  controller.addEventListener('squeezestart', () => { grabbing.add(controller); captureGrabBaseline(); });
  controller.addEventListener('squeezeend',   () => { grabbing.delete(controller); captureGrabBaseline(); });
  scene.add(controller);
}

// ── Manipulation spatiale du graphe (squeeze une main / deux mains) ──────────
// Les events et l'application au Group sont ici ; tout le calcul est dans
// graphManipulation.ts (fonctions pures, testées unitairement).

let graphGroup: THREE.Group | null = null;

type GrabState =
  | { mode: 'none' }
  | { mode: 'one'; controller: THREE.Object3D; startPose: Pose; startGroup: GroupTransform }
  | { mode: 'two'; a: THREE.Object3D; b: THREE.Object3D; startA: Pose['position']; startB: Pose['position']; startGroup: GroupTransform };

const grabbing = new Set<THREE.Object3D>();
let grab: GrabState = { mode: 'none' };

const _wp = new THREE.Vector3();
const _wq = new THREE.Quaternion();

function poseOf(c: THREE.Object3D): Pose {
  c.getWorldPosition(_wp);
  c.getWorldQuaternion(_wq);
  return {
    position:    { x: _wp.x, y: _wp.y, z: _wp.z },
    orientation: { x: _wq.x, y: _wq.y, z: _wq.z, w: _wq.w },
  };
}

/** Pose monde de la caméra active (casque en session XR, caméra desktop sinon). */
function activeCameraPose(): Pose {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  return poseOf(cam);
}

function transformOf(g: THREE.Object3D): GroupTransform {
  return {
    position:   { x: g.position.x, y: g.position.y, z: g.position.z },
    quaternion: { x: g.quaternion.x, y: g.quaternion.y, z: g.quaternion.z, w: g.quaternion.w },
    scale:      g.scale.x,
  };
}

function applyTransform(g: THREE.Object3D, t: GroupTransform): void {
  g.position.set(t.position.x, t.position.y, t.position.z);
  g.quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
  g.scale.setScalar(t.scale);
}

/**
 * (Re)capture la baseline du geste à chaque changement du nombre de mains
 * tenues — la transformation courante devient le point de départ, donc les
 * bascules une main ↔ deux mains se font sans saut visuel.
 */
function captureGrabBaseline(): void {
  if (!graphGroup) { grab = { mode: 'none' }; return; }
  const held = [...grabbing];
  if (held.length === 0) {
    grab = { mode: 'none' };
  } else if (held.length === 1) {
    grab = { mode: 'one', controller: held[0]!, startPose: poseOf(held[0]!), startGroup: transformOf(graphGroup) };
  } else {
    grab = {
      mode: 'two', a: held[0]!, b: held[1]!,
      startA: poseOf(held[0]!).position, startB: poseOf(held[1]!).position,
      startGroup: transformOf(graphGroup),
    };
  }
}

function updateGrab(): void {
  if (!graphGroup) return;
  if (grab.mode === 'one') {
    applyTransform(graphGroup, oneHandGrabTransform(grab.startPose, grab.startGroup, poseOf(grab.controller)));
  } else if (grab.mode === 'two') {
    applyTransform(graphGroup, twoHandGrabTransform(
      grab.startA, grab.startB, grab.startGroup,
      poseOf(grab.a).position, poseOf(grab.b).position,
    ));
  }
}

// Recentrage : bouton A/X (index 4 du gamepad des Touch controllers) —
// replace le graphe à sa position/orientation/échelle par défaut.
let recenterPressed = false;

function resetGraphTransform(): void {
  if (!graphGroup) return;
  grabbing.clear();
  grab = { mode: 'none' };
  graphGroup.position.copy(GRAPH_CENTER);
  graphGroup.quaternion.identity();
  graphGroup.scale.setScalar(1);
}

function pollRecenterButton(): void {
  const session = renderer.xr.getSession();
  if (!session) { recenterPressed = false; return; }
  let pressed = false;
  for (const src of session.inputSources) {
    if (src.gamepad?.buttons[4]?.pressed) { pressed = true; break; }
  }
  if (pressed && !recenterPressed) resetGraphTransform();
  recenterPressed = pressed;
}

// ── Bouton XR : AR (mixed reality) si supporté, sinon VR ─────────────────────

async function setupXRButton(): Promise<void> {
  if (!('xr' in navigator)) {
    setStatus('WebXR unavailable in this browser — desktop preview only (drag to orbit, click a node).');
    setTimeout(() => setStatus(null), 6000);
    return;
  }
  const xr = navigator.xr!;
  const arSupported = await xr.isSessionSupported('immersive-ar').catch(() => false);
  const vrSupported = await xr.isSessionSupported('immersive-vr').catch(() => false);

  let button: HTMLElement;
  if (arSupported) {
    button = ARButton.createButton(renderer, { optionalFeatures: ['local-floor'] });
  } else if (vrSupported) {
    button = VRButton.createButton(renderer);
  } else {
    setStatus('No immersive session supported here — desktop preview only.<br>On Quest: use <code>adb reverse tcp:4517 tcp:4517</code> then open <code>http://localhost:4517</code>.');
    setTimeout(() => setStatus(null), 8000);
    return;
  }
  document.body.appendChild(button);

  // En AR (passthrough), le fond doit être transparent ; on le restaure en sortie.
  renderer.xr.addEventListener('sessionstart', () => {
    const session = renderer.xr.getSession();
    const isAR = session?.environmentBlendMode !== 'opaque';
    scene.background = isAR ? null : DESKTOP_BG;
    scene.fog        = isAR ? null : SCENE_FOG;
  });
  renderer.xr.addEventListener('sessionend', () => {
    scene.background = DESKTOP_BG;
    scene.fog        = SCENE_FOG;
  });
}

// ── Chargement du graphe réel ────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    const data = await fetchGraph();
    if (data.scans.length === 0) {
      setStatus('Connected, but no scan data. Run a scan in Cortex Desktop first.');
      return;
    }
    const built = buildGraphGroup(data);
    built.group.position.copy(GRAPH_CENTER);
    scene.add(built.group);
    graphGroup   = built.group;
    nodeMeshes   = built.nodeMeshes;
    displayEdges = built.displayEdges;
    edgeLines    = built.edgeLines;
    setStatus(`${data.scans.length} files · ${data.edges.length} edges — click/trigger a node for metrics.`);
    setTimeout(() => setStatus(null), 6000);
  } catch (err) {
    setStatus(`Could not load the Cortex graph: <b>${(err as Error).message}</b><br>` +
              'Make sure Cortex Desktop is running (it serves <code>/api/graph</code> on port 4517).');
  }
  await setupXRButton();
}

renderer.setAnimationLoop(() => {
  controls.update();
  updateGrab();
  updatePanelDrag();
  pollRecenterButton();
  renderer.render(scene, camera);
});

init();
