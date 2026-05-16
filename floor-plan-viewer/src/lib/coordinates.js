/**
 * Letterbox-aware mapping for <img> with object-fit: contain (default for replaced elements).
 * Formula: (mouseClient - contentOrigin) / renderedContentSize  => normalized [0,1].
 * Used with ray-casting in geometry.js: map pointer to normalized bitmap coords before pointInPolygon.
 */

/**
 * @param {HTMLImageElement} img
 * @returns {{ offsetX: number, offsetY: number, width: number, height: number, containerWidth: number, containerHeight: number }}
 */
export function getRenderedContentRect(img) {
  var cw = img.clientWidth;
  var ch = img.clientHeight;
  var nw = img.naturalWidth || cw;
  var nh = img.naturalHeight || ch;
  if (!nw || !nh) {
    return { offsetX: 0, offsetY: 0, width: cw, height: ch, containerWidth: cw, containerHeight: ch };
  }
  var ir = nw / nh;
  var cr = cw / ch;
  var rw;
  var rh;
  if (cr > ir) {
    rh = ch;
    rw = ir * rh;
  } else {
    rw = cw;
    rh = rw / ir;
  }
  var ox = (cw - rw) / 2;
  var oy = (ch - rh) / 2;
  return {
    offsetX: ox,
    offsetY: oy,
    width: rw,
    height: rh,
    containerWidth: cw,
    containerHeight: ch,
  };
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {HTMLImageElement} img
 * @returns {{ x: number, y: number }}
 */
export function clientToNormalized(clientX, clientY, img) {
  var box = img.getBoundingClientRect();
  var r = getRenderedContentRect(img);
  var left = box.left + r.offsetX;
  var top = box.top + r.offsetY;
  return {
    x: (clientX - left) / r.width,
    y: (clientY - top) / r.height,
  };
}

/**
 * Match SVG overlay to the visible bitmap inside a letterboxed <img>.
 * @param {HTMLImageElement} img
 * @param {SVGSVGElement} svg
 */
export function syncOverlayToImage(img, svg) {
  var r = getRenderedContentRect(img);
  svg.style.position = "absolute";
  svg.style.left = r.offsetX + "px";
  svg.style.top = r.offsetY + "px";
  svg.style.width = r.width + "px";
  svg.style.height = r.height + "px";
  svg.style.right = "auto";
  svg.style.bottom = "auto";
}
