import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Default mid-century sofa (Meshy export). Served from /public/models. */
export var DEFAULT_SOFA_GLB_URL =
  "/models/Meshy_AI_Teal_Mid_Century_Sofa_0528131508_texture.glb";

var sofaTemplate = null;
var sofaLoadPromise = null;

function enableShadows(root) {
  root.traverse(function (obj) {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

/**
 * Preload the default sofa GLB once.
 * @returns {Promise<THREE.Object3D>}
 */
export function preloadDefaultSofaGlb(url) {
  var src = url || DEFAULT_SOFA_GLB_URL;
  if (sofaTemplate) return Promise.resolve(sofaTemplate);
  if (sofaLoadPromise) return sofaLoadPromise;

  sofaLoadPromise = new Promise(function (resolve, reject) {
    var loader = new GLTFLoader();
    loader.load(
      src,
      function (gltf) {
        sofaTemplate = gltf.scene;
        enableShadows(sofaTemplate);
        resolve(sofaTemplate);
      },
      undefined,
      function (err) {
        sofaLoadPromise = null;
        reject(err);
      }
    );
  });
  return sofaLoadPromise;
}

export function isSofaTypeStr(typeStr) {
  var t = String(typeStr || "").toLowerCase();
  return (
    t.indexOf("sofa") >= 0 ||
    t.indexOf("lounge") >= 0 ||
    t.indexOf("sectional") >= 0 ||
    t.indexOf("apartment_living_sofa") >= 0
  );
}

/**
 * Clone the sofa GLB, scaled to w×d×h (metres) with base on y=0.
 * @param {number} wM
 * @param {number} dM
 * @param {number} hM
 * @returns {THREE.Object3D|null}
 */
export function createDefaultSofaInstance(wM, dM, hM) {
  if (!sofaTemplate) return null;
  var model = sofaTemplate.clone(true);
  enableShadows(model);

  var box = new THREE.Box3().setFromObject(model);
  var size = new THREE.Vector3();
  box.getSize(size);
  if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return model;

  var sx = wM / size.x;
  var sy = hM / size.y;
  var sz = dM / size.z;
  var scale = Math.min(sx, sy, sz);
  model.scale.setScalar(scale);

  box.setFromObject(model);
  var center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  return model;
}

export function disposeDefaultSofaGlb() {
  if (sofaTemplate) {
    sofaTemplate.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(function (m) {
          m.dispose();
        });
        else obj.material.dispose();
      }
    });
  }
  sofaTemplate = null;
  sofaLoadPromise = null;
}
