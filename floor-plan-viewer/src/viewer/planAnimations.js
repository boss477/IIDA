import { gsap } from "gsap";
import { polygonBBox } from "../lib/geometry.js";

const NS = "http://www.w3.org/2000/svg";

export function animateRoomHighlight(svg, activeId, options) {
  const duration = options && options.duration != null ? options.duration : 0.22;
  svg.querySelectorAll("[data-room]").forEach(function (el) {
    const id = el.getAttribute("data-room");
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: id === activeId ? 1 : 0,
      duration: duration,
      ease: "power2.out",
      overwrite: true,
    });
  });
  svg.querySelectorAll("[data-room-fill]").forEach(function (el) {
    const id = el.getAttribute("data-room-fill");
    el.setAttribute("data-active", id === activeId ? "1" : "0");
  });
  svg.querySelectorAll(".plan-room-hover-top").forEach(function (el) {
    gsap.killTweensOf(el);
    el.remove();
  });
  svg.querySelectorAll(".plan-label").forEach(function (g) {
    const bg = g.querySelector(".plan-label-bg");
    if (bg) bg.setAttribute("opacity", "0.55");
  });
  if (!activeId) return;
  const fillEl = svg.querySelector('[data-room-fill="' + activeId + '"]');
  if (!fillEl) return;
  const pts = fillEl.getAttribute("points");
  const top = document.createElementNS(NS, "polygon");
  top.setAttribute("class", "plan-room-hover-top");
  top.setAttribute("points", pts);
  top.setAttribute("fill", "rgba(255, 210, 64, 0.58)");
  top.setAttribute("stroke", "none");
  top.setAttribute("pointer-events", "none");
  top.setAttribute("opacity", "0");
  svg.appendChild(top);
  gsap.to(top, { opacity: 1, duration: duration, ease: "power2.out", overwrite: true });
  const label = svg.querySelector('[data-room-label="' + activeId + '"] .plan-label-bg');
  if (label) label.setAttribute("opacity", "0.2");
}

export function animateFurnitureSelect(el) {
  if (!el) return;
  gsap.killTweensOf(el);
  const ring = el.querySelector(".furniture-select-ring");
  if (ring) {
    gsap.fromTo(
      ring,
      { opacity: 0.2 },
      { opacity: 1, duration: 0.18, ease: "power2.out", overwrite: true }
    );
  }
}

export function animateFurnitureDragStart(el) {
  if (!el) return;
  el.setAttribute("data-dragging", "1");
}

export function animateFurnitureDragEnd(el) {
  if (!el) return;
  el.removeAttribute("data-dragging");
  gsap.killTweensOf(el);
}

export function focusRoomCamera(options) {
  const room = options.room;
  if (!room || !room.polygon || room.polygon.length < 3) return null;

  const bbox = polygonBBox(room.polygon);
  const viewport = options.viewportEl;
  const planWrap = options.planWrapEl;
  const viewportWidth = viewport.clientWidth || 1;
  const viewportHeight = viewport.clientHeight || 1;
  const planWidth = planWrap.clientWidth || 1;
  const planHeight = planWrap.clientHeight || 1;
  const roomWidth = Math.max(1, (bbox.maxX - bbox.minX) * planWidth);
  const roomHeight = Math.max(1, (bbox.maxY - bbox.minY) * planHeight);
  const padding = options.padding == null ? 0.12 : options.padding;
  const targetScale = Math.min(
    6,
    Math.max(
      0.6,
      Math.min(
        viewportWidth / (roomWidth * (1 + padding * 2)),
        viewportHeight / (roomHeight * (1 + padding * 2))
      )
    )
  );
  const centerX = ((bbox.minX + bbox.maxX) / 2) * planWidth;
  const centerY = ((bbox.minY + bbox.maxY) / 2) * planHeight;
  const current = options.getTransform();
  const proxy = { s: current.s, tx: current.tx, ty: current.ty };
  const target = {
    s: targetScale,
    tx: viewportWidth / 2 - centerX * targetScale,
    ty: viewportHeight / 2 - centerY * targetScale,
  };

  gsap.killTweensOf(proxy);
  return gsap.to(proxy, {
    s: target.s,
    tx: target.tx,
    ty: target.ty,
    duration: 0.55,
    ease: "power3.out",
    overwrite: true,
    onUpdate: function () {
      options.setTransform(proxy);
    },
    onComplete: function () {
      options.setTransform(target);
    },
  });
}

export function killPlanTweens(targets) {
  gsap.killTweensOf(targets);
}
