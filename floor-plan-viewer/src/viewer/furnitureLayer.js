const NS = "http://www.w3.org/2000/svg";
import { appendVectorFurniture } from "./furnitureShapes.js";

function catalogById(catalog, id) {
  if (!catalog || !id) return null;
  for (var i = 0; i < catalog.length; i++) {
    if (String(catalog[i].id) === String(id)) return catalog[i];
  }
  return null;
}

function resolveImageUrl(f, catalog) {
  if (f.imageUrl) return f.imageUrl;
  var row = catalogById(catalog, f.catalogId);
  return row && row.image_2d_url;
}

function ensureOverlayDefs(svg) {
  if (svg.querySelector("defs[data-furniture-defs]")) return;
  var defs = document.createElementNS(NS, "defs");
  defs.setAttribute("data-furniture-defs", "1");
  var f = document.createElementNS(NS, "filter");
  f.setAttribute("id", "furniture-floor-shadow");
  f.setAttribute("x", "-40%");
  f.setAttribute("y", "-40%");
  f.setAttribute("width", "180%");
  f.setAttribute("height", "180%");
  var blur = document.createElementNS(NS, "feDropShadow");
  blur.setAttribute("dx", "0");
  blur.setAttribute("dy", "6");
  blur.setAttribute("stdDeviation", "3");
  blur.setAttribute("flood-opacity", "0.22");
  f.appendChild(blur);
  defs.appendChild(f);
  svg.insertBefore(defs, svg.firstChild);
}

/**
 * @param {SVGSVGElement} svg
 * @param {Array} furniture
 * @param {Array} [furnitureCatalog]
 * @param {string|null} [selectedId]
 * @param {{ width:number, height:number }} imageSize
 */
export function renderFurniture(svg, furniture, furnitureCatalog, selectedId, imageSize) {
  ensureOverlayDefs(svg);
  var w = imageSize && imageSize.width ? imageSize.width : 1;
  var h = imageSize && imageSize.height ? imageSize.height : 1;
  svg.querySelectorAll("[data-furniture-id]").forEach(function (n) {
    n.remove();
  });
  (furniture || [])
    .slice()
    .sort(function (a, b) {
      return (a.zIndex || 0) - (b.zIndex || 0);
    })
    .forEach(function (f) {
      var row = catalogById(furnitureCatalog || [], f.catalogId);
      var shapeKey = row && row.shape;
      var href = !shapeKey ? resolveImageUrl(f, furnitureCatalog || []) : null;

      var g = document.createElementNS(NS, "g");
      g.setAttribute("data-furniture-id", f.id || "");
      g.setAttribute("class", "furniture-g" + (selectedId && f.id === selectedId ? " furniture-g--selected" : ""));

      var sc = (f.scale != null ? f.scale : 0.08) * w;
      var rot = f.rotationDeg || 0;
      var transform =
        "translate(" + f.x * w + " " + f.y * h + ") rotate(" + rot + ") scale(" + sc + ")";
      g.setAttribute("transform", transform);
      g.setAttribute("filter", "url(#furniture-floor-shadow)");

      if (selectedId && f.id === selectedId) {
        var ring = document.createElementNS(NS, "circle");
        ring.setAttribute("r", "0.55");
        ring.setAttribute("fill", "rgba(37,99,235,0.08)");
        ring.setAttribute("stroke", "#2563eb");
        ring.setAttribute("stroke-width", "0.014");
        ring.setAttribute("class", "furniture-select-ring");
        g.appendChild(ring);
      }

      if (shapeKey) {
        appendVectorFurniture(g, shapeKey);
      } else if (href) {
        var im = document.createElementNS(NS, "image");
        im.setAttribute("href", href);
        im.setAttribute("x", "-0.5");
        im.setAttribute("y", "-0.35");
        im.setAttribute("width", "1");
        im.setAttribute("height", "0.7");
        im.setAttribute("class", "furniture-img");
        g.appendChild(im);
      } else {
        appendVectorFurniture(g, "chair");
      }

      svg.appendChild(g);
    });
}
