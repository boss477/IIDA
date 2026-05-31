/**
 * Bake hardcoded GLB models to small top-down PNG data URLs (cached, lazy).
 */
import * as THREE from "three";
import {
  preloadDefaultSofaGlb,
  createDefaultSofaInstance,
  DEFAULT_SOFA_GLB_URL,
} from "./plan3dGlb.js";

/** @type {Map<string, string>} */
var cache = new Map();
var preloadPromise = null;

function disposeObject3D(root) {
  root.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(function (m) {
        m.dispose();
      });
      else obj.material.dispose();
    }
  });
}

/**
 * @param {string} glbUrl
 * @param {number} wM
 * @param {number} dM
 * @param {number} hM
 * @param {number} [sizePx]
 */
export function bakeGlbTopDownDataUrl(glbUrl, wM, dM, hM, sizePx) {
  sizePx = sizePx || 256;
  var key = glbUrl + "|" + wM.toFixed(3) + "|" + dM.toFixed(3) + "|" + sizePx;
  if (cache.has(key)) return cache.get(key);

  return preloadDefaultSofaGlb(glbUrl).then(function () {
    if (cache.has(key)) return cache.get(key);
    var model = createDefaultSofaInstance(wM, dM, hM);
    if (!model) throw new Error("GLB template not loaded");

    var scene = new THREE.Scene();
    var hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.85);
    scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 8, 2);
    scene.add(dir);
    scene.add(model);

    var span = Math.max(wM, dM) * 1.2;
    var camera = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.05, 40);
    camera.position.set(0, 12, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    var renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(sizePx, sizePx);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);

    var url = renderer.domElement.toDataURL("image/png");
    renderer.dispose();
    disposeObject3D(model);
    cache.set(key, url);
    return url;
  });
}

/** Preload demo sofa bake at typical size. */
export function preloadGlbTopDownIcons() {
  if (preloadPromise) return preloadPromise;
  preloadPromise = bakeGlbTopDownDataUrl(DEFAULT_SOFA_GLB_URL, 2.2, 0.95, 0.85, 256);
  return preloadPromise;
}

/**
 * @param {number} wM
 * @param {number} dM
 * @returns {string|null}
 */
export function getCachedGlbTopDownUrl(wM, dM) {
  var key =
    DEFAULT_SOFA_GLB_URL + "|" + wM.toFixed(3) + "|" + dM.toFixed(3) + "|256";
  return cache.get(key) || null;
}

export { DEFAULT_SOFA_GLB_URL };
