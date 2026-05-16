/**
 * @param {HTMLElement} container
 * @param {object} handlers
 * @param {() => void} handlers.loadFixture
 * @param {() => void} [handlers.uploadSupabase]
 * @param {() => void} handlers.zoomIn
 * @param {() => void} handlers.zoomOut
 * @param {() => void} handlers.reset
 * @param {() => void} handlers.fullscreen
 * @param {() => void} [handlers.exportJson]
 * @param {() => void} [handlers.exportCorrectedJson]
 * @param {() => void} [handlers.analyzeLlm]
 * @param {() => void} [handlers.toggleGeometryOnly]
 * @param {() => void} [handlers.toggleVertexEdit]
 * @returns {{ fileInput: HTMLInputElement }}
 */
export function mountToolbar(container, handlers) {
  container.innerHTML = "";

  var lab = document.createElement("label");
  lab.className = "btn";
  lab.textContent = "Open image";
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.hidden = true;
  lab.appendChild(inp);
  container.appendChild(lab);

  function addButton(text, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", fn);
    container.appendChild(b);
  }

  addButton("Load sample JSON", handlers.loadFixture);
  if (handlers.uploadSupabase) {
    addButton("Upload plan (Supabase)", handlers.uploadSupabase);
  }
  addButton("+", handlers.zoomIn);
  addButton("−", handlers.zoomOut);
  addButton("Reset", handlers.reset);
  if (handlers.exportJson) {
    addButton("Export JSON", handlers.exportJson);
  }
  if (handlers.exportCorrectedJson) {
    addButton("Export corrected JSON", handlers.exportCorrectedJson);
  }
  if (handlers.analyzeLlm) {
    addButton("Analyze LLM", handlers.analyzeLlm);
  }
  if (handlers.toggleGeometryOnly) {
    addButton("Geometry only", handlers.toggleGeometryOnly);
  }
  if (handlers.toggleVertexEdit) {
    addButton("Edit vertices", handlers.toggleVertexEdit);
  }
  addButton("Fullscreen", handlers.fullscreen);

  return { fileInput: inp };
}
