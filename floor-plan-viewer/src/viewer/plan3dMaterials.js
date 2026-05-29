import * as THREE from "three";

var _disposables = [];

/** @param {THREE.Texture} tex */
function track(tex) {
  _disposables.push(tex);
  return tex;
}

export function disposeMaterials() {
  _disposables.forEach(function (t) {
    t.dispose();
  });
  _disposables.length = 0;
  clearWallMaterialCache();
  _fabricRough = null;
  _woodGrain = null;
}

/**
 * @param {number} sz
 * @param {(ctx: CanvasRenderingContext2D, sz: number) => void} drawFn
 * @param {number} [repeatX]
 * @param {number} [repeatY]
 */
export function mkTex(sz, drawFn, repeatX, repeatY) {
  var cv = document.createElement("canvas");
  cv.width = cv.height = sz;
  drawFn(cv.getContext("2d"), sz);
  var t = track(new THREE.CanvasTexture(cv));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX || 1, repeatY || 1);
  t.anisotropy = 8;
  return t;
}

function fabricRoughnessTex() {
  return mkTex(
    256,
    function (ctx, sz) {
      ctx.fillStyle = "#b4b4b4";
      ctx.fillRect(0, 0, sz, sz);
      for (var i = 0; i < 8000; i++) {
        var a = Math.random() * 0.25;
        ctx.fillStyle = "rgba(0,0,0," + a + ")";
        ctx.fillRect(Math.random() * sz, Math.random() * sz, 1 + Math.random(), 1);
      }
    },
    2,
    2
  );
}

function woodGrainTex() {
  return mkTex(
    256,
    function (ctx, sz) {
      ctx.fillStyle = "#909090";
      ctx.fillRect(0, 0, sz, sz);
      for (var i = 0; i < sz; i += 2) {
        var v = 80 + Math.sin(i * 0.4) * 25 + Math.random() * 15;
        ctx.strokeStyle = "rgb(" + v + "," + v + "," + v + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(sz, i + Math.random() * 4 - 2);
        ctx.stroke();
      }
    },
    1,
    4
  );
}

var _fabricRough = null;
var _woodGrain = null;

export function getFabricRoughnessMap() {
  if (!_fabricRough) _fabricRough = fabricRoughnessTex();
  return _fabricRough;
}

export function getWoodGrainMap() {
  if (!_woodGrain) _woodGrain = woodGrainTex();
  return _woodGrain;
}

/**
 * @param {string} [flooring]
 * @param {{ x: number, y: number }} repeat
 */
export function createFloorMaterial(flooring, repeat) {
  var rx = repeat && repeat.x > 0 ? repeat.x : 4;
  var ry = repeat && repeat.y > 0 ? repeat.y : 4;
  var kind = String(flooring || "").toLowerCase();

  if (kind === "wood") {
    var woodColor = mkTex(
      512,
      function (ctx, sz) {
        ctx.fillStyle = "#c09a72";
        ctx.fillRect(0, 0, sz, sz);
        for (var i = 0; i < 6000; i++) {
          var a = Math.random() * 0.06;
          ctx.fillStyle = "rgba(0,0,0," + a + ")";
          ctx.fillRect(Math.random() * sz, Math.random() * sz, 1, 1);
        }
      },
      rx,
      ry
    );
    var woodRough = mkTex(
      256,
      function (ctx, sz) {
        ctx.fillStyle = "#b0b0b0";
        ctx.fillRect(0, 0, sz, sz);
        for (var ti = 0; ti < 4; ti++) {
          for (var tj = 0; tj < 4; tj++) {
            ctx.fillStyle = "#d8d8d8";
            ctx.fillRect(ti * 64 + 2, tj * 64 + 2, 60, 60);
          }
        }
      },
      rx,
      ry
    );
    return new THREE.MeshStandardMaterial({
      map: woodColor,
      roughnessMap: woodRough,
      roughness: 0.45,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
  }

  if (kind === "tile") {
    var tileColor = mkTex(
      512,
      function (ctx, sz) {
        ctx.fillStyle = "#d1e8e2";
        ctx.fillRect(0, 0, sz, sz);
        ctx.strokeStyle = "#a8cfc8";
        ctx.lineWidth = 2;
        for (var i = 0; i <= 4; i++) {
          var t2 = (sz * i) / 4;
          ctx.beginPath();
          ctx.moveTo(t2, 0);
          ctx.lineTo(t2, sz);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, t2);
          ctx.lineTo(sz, t2);
          ctx.stroke();
        }
      },
      rx,
      ry
    );
    return new THREE.MeshStandardMaterial({
      map: tileColor,
      roughness: 0.25,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
  }

  if (kind === "kitchen" || kind === "stone") {
    var stoneColor = kind === "kitchen" ? "#475569" : "#94a3b8";
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(stoneColor),
      roughness: kind === "kitchen" ? 0.55 : 0.88,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
  }

  var floorTex = mkTex(
    512,
    function (ctx, sz) {
      ctx.fillStyle = "#edeae4";
      ctx.fillRect(0, 0, sz, sz);
      for (var ti = 0; ti < 4; ti++) {
        for (var tj = 0; tj < 4; tj++) {
          var v = Math.random() * 0.04 - 0.02;
          var c = Math.round(237 + v * 255);
          ctx.fillStyle = "rgb(" + c + "," + (c - 2) + "," + (c - 5) + ")";
          ctx.fillRect(ti * 128 + 1, tj * 128 + 1, 126, 126);
        }
      }
      ctx.strokeStyle = "#c8c4bc";
      ctx.lineWidth = 2;
      for (var j = 0; j <= 4; j++) {
        var t3 = (sz * j) / 4;
        ctx.beginPath();
        ctx.moveTo(t3, 0);
        ctx.lineTo(t3, sz);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, t3);
        ctx.lineTo(sz, t3);
        ctx.stroke();
      }
    },
    rx,
    ry
  );
  var floorRough = mkTex(
    256,
    function (ctx, sz) {
      ctx.fillStyle = "#b0b0b0";
      ctx.fillRect(0, 0, sz, sz);
      for (var ti = 0; ti < 4; ti++) {
        for (var tj = 0; tj < 4; tj++) {
          ctx.fillStyle = "#d8d8d8";
          ctx.fillRect(ti * 64 + 2, tj * 64 + 2, 60, 60);
        }
      }
    },
    rx,
    ry
  );
  return new THREE.MeshStandardMaterial({
    map: floorTex,
    roughnessMap: floorRough,
    roughness: 0.8,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}

/** Premium interior paint presets (base hex + finish). */
export var WALL_COLOR_PRESETS = {
  "warm-white": { color: "#f5f2ec", roughness: 0.88 },
  "soft-sage": { color: "#c8d5c4", roughness: 0.86 },
  "desert-sand": { color: "#e2d5c3", roughness: 0.9 },
  "champagne": { color: "#f0e6d8", roughness: 0.87 },
  "blush-rose": { color: "#e8d4d0", roughness: 0.88 },
  "warm-greige": { color: "#d9d2c8", roughness: 0.89 },
  "terracotta": { color: "#c4a088", roughness: 0.84 },
  "eucalyptus": { color: "#a8b8a8", roughness: 0.85 },
  "sea-mist": { color: "#d4e4e8", roughness: 0.86 },
  "deep-navy": { color: "#3d4f5f", roughness: 0.82 },
  "midnight-teal": { color: "#2c4a52", roughness: 0.8 },
  "charcoal-stone": { color: "#6b6560", roughness: 0.83 },
};

var _wallMatCache = {};

export function getWallMaterial(presetId) {
  var id = presetId && WALL_COLOR_PRESETS[presetId] ? presetId : "warm-white";
  if (!_wallMatCache[id]) _wallMatCache[id] = createWallMaterial(id);
  return _wallMatCache[id];
}

/** Independent material instance per wall segment (avoids shared emissive/color). */
export function cloneWallMaterial(presetId) {
  return getWallMaterial(presetId).clone();
}

/** @param {string} [presetId] */
export function getWallPresetHex(presetId) {
  var id = presetId && WALL_COLOR_PRESETS[presetId] ? presetId : "warm-white";
  return WALL_COLOR_PRESETS[id].color;
}

function clearWallMaterialCache() {
  Object.keys(_wallMatCache).forEach(function (key) {
    if (_wallMatCache[key]) _wallMatCache[key].dispose();
  });
  _wallMatCache = {};
}

export function createWallMaterial(presetId) {
  var id = presetId && WALL_COLOR_PRESETS[presetId] ? presetId : "warm-white";
  var preset = WALL_COLOR_PRESETS[id];
  var base = preset.color;

  var wcTex = mkTex(
    512,
    function (ctx, sz) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, sz, sz);
      for (var i = 0; i < 4000; i++) {
        var a = Math.random() * 0.045;
        ctx.fillStyle = "rgba(0,0,0," + a + ")";
        ctx.fillRect(Math.random() * sz, Math.random() * sz, 1, 1);
      }
      for (var j = 0; j < 1200; j++) {
        var b = Math.random() * 0.03;
        ctx.fillStyle = "rgba(255,255,255," + b + ")";
        ctx.fillRect(Math.random() * sz, Math.random() * sz, 1, 1);
      }
    },
    3,
    3
  );
  var wrTex = mkTex(
    256,
    function (ctx, sz) {
      ctx.fillStyle = "#c8c8c8";
      ctx.fillRect(0, 0, sz, sz);
      for (var i = 0; i < 3000; i++) {
        var a = Math.random() * 0.3;
        ctx.fillStyle =
          Math.random() > 0.5 ? "rgba(255,255,255," + a + ")" : "rgba(0,0,0," + a + ")";
        ctx.fillRect(Math.random() * sz, Math.random() * sz, 2, 2);
      }
    },
    3,
    3
  );
  return new THREE.MeshStandardMaterial({
    map: wcTex,
    roughnessMap: wrTex,
    roughness: preset.roughness,
    metalness: 0,
  });
}

/** @param {{ x: number, y: number }} repeat */
export function createCeilingMaterial(repeat) {
  var rx = repeat && repeat.x > 0 ? repeat.x : 4;
  var ry = repeat && repeat.y > 0 ? repeat.y : 4;
  return new THREE.MeshStandardMaterial({
    color: 0xf5f2ec,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

/**
 * @param {number} colorHex
 * @param {number} [roughness]
 */
export function createFabricMaterial(colorHex, roughness) {
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    roughnessMap: getFabricRoughnessMap(),
    roughness: roughness != null ? roughness : 0.88,
    metalness: 0,
  });
}

export function createWoodLegMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x7a4f2c,
    roughnessMap: getWoodGrainMap(),
    roughness: 0.45,
    metalness: 0.08,
  });
}

export function createTableTopMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc8ad88,
    roughnessMap: getWoodGrainMap(),
    roughness: 0.45,
    metalness: 0.05,
  });
}

export function createGlassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc0d8ee,
    transparent: true,
    opacity: 0.32,
    roughness: 0.03,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
}

export function createWindowFrameMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.04,
  });
}
