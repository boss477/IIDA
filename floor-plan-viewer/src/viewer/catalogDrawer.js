function uniqStrings(arr) {
  var seen = {};
  var out = [];
  (arr || []).forEach(function (v) {
    var s = String(v || "").trim();
    if (!s) return;
    if (seen[s]) return;
    seen[s] = 1;
    out.push(s);
  });
  return out;
}

function normStr(s) {
  return String(s || "").toLowerCase().trim();
}

function favoritesKey() {
  return "fpv:favorites:v1";
}

function loadFavorites() {
  try {
    var raw = localStorage.getItem(favoritesKey());
    if (!raw) return {};
    var obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveFavorites(favs) {
  try {
    localStorage.setItem(favoritesKey(), JSON.stringify(favs || {}));
  } catch (e) {
    // ignore
  }
}

function catalogImageUrl(row) {
  if (!row) return "";
  var url = row.image_url || row.image_2d_url || row.plan2d_photo_url;
  return url ? String(url).trim() : "";
}

function formatDims(row) {
  if (!row) return "";
  var w = row.width_mm != null ? Math.round(row.width_mm) : null;
  var d = row.depth_mm != null ? Math.round(row.depth_mm) : null;
  var h = row.height_mm != null ? Math.round(row.height_mm) : null;
  var parts = [];
  if (w != null && d != null) parts.push(w + "×" + d + " mm");
  if (h != null) parts.push("H " + h + " mm");
  return parts.join(" · ");
}

function inferRoomFromCategory(category) {
  var c = normStr(category);
  if (!c) return "";
  if (c.indexOf("sofa") >= 0 || c.indexOf("lounge") >= 0 || c.indexOf("tv") >= 0) return "living";
  if (c.indexOf("bed") >= 0 || c.indexOf("mattress") >= 0) return "bedroom";
  if (c.indexOf("dining") >= 0 || c.indexOf("table") >= 0) return "dining";
  if (c.indexOf("desk") >= 0 || c.indexOf("office") >= 0) return "office";
  return "";
}

export function createCatalogDrawer(opts) {
  var root = opts.root;
  var onAdd = opts.onAdd;
  var getPlacedItems = opts.getPlacedItems;

  var els = {
    close: root.querySelector("#catalog-close"),
    tabBtns: Array.prototype.slice.call(root.querySelectorAll(".catalog-tab")),
    search: root.querySelector("#catalog-search"),
    room: root.querySelector("#catalog-room"),
    category: root.querySelector("#catalog-category"),
    chips: root.querySelector("#catalog-chips"),
    grid: root.querySelector("#catalog-grid"),
    list: root.querySelector("#catalog-list"),
  };

  var state = {
    open: false,
    tab: "add",
    q: "",
    room: "",
    category: "",
    chipCategory: "",
    catalog: [],
    favorites: loadFavorites(),
  };

  function setOpen(open) {
    state.open = !!open;
    root.hidden = !state.open;
    if (state.open) render();
  }

  function setTab(tab) {
    state.tab = tab;
    els.tabBtns.forEach(function (b) {
      var t = b.getAttribute("data-tab");
      var active = t === tab;
      if (active) b.classList.add("catalog-tab--active");
      else b.classList.remove("catalog-tab--active");
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    render();
  }

  function setCatalogRows(rows) {
    state.catalog = rows || [];
    buildCategoryOptions();
    buildChips();
    render();
  }

  function buildCategoryOptions() {
    var cats = uniqStrings(
      (state.catalog || []).map(function (r) {
        return r && r.category ? r.category : "";
      })
    ).sort();
    els.category.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "All categories";
    els.category.appendChild(empty);
    cats.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      els.category.appendChild(o);
    });
  }

  function buildChips() {
    var top = uniqStrings(
      (state.catalog || [])
        .map(function (r) {
          return r && r.category ? r.category : "";
        })
        .filter(Boolean)
    );
    // Simple heuristic: prioritize common categories
    var counts = {};
    top.forEach(function (c) {
      counts[c] = 0;
    });
    (state.catalog || []).forEach(function (r) {
      var c = r && r.category ? r.category : "";
      if (!c) return;
      counts[c] = (counts[c] || 0) + 1;
    });
    top.sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0);
    });
    top = top.slice(0, 8);

    els.chips.innerHTML = "";
    top.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catalog-chip";
      btn.textContent = c;
      btn.addEventListener("click", function () {
        state.chipCategory = state.chipCategory === c ? "" : c;
        if (state.chipCategory) {
          state.category = "";
          els.category.value = "";
        }
        render();
      });
      els.chips.appendChild(btn);
    });
  }

  function toggleFavorite(productCode) {
    if (!productCode) return;
    if (state.favorites[productCode]) delete state.favorites[productCode];
    else state.favorites[productCode] = 1;
    saveFavorites(state.favorites);
    render();
  }

  function matchesRoom(row) {
    if (!state.room) return true;
    var inferred = inferRoomFromCategory(row.category);
    if (!inferred) return false;
    return inferred === state.room;
  }

  function matchesQuery(row) {
    if (!state.q) return true;
    var q = normStr(state.q);
    var hay =
      normStr(row.product_code) +
      " " +
      normStr(row.product_name) +
      " " +
      normStr(row.category) +
      " " +
      normStr(row.keywords);
    return hay.indexOf(q) >= 0;
  }

  function matchesCategory(row) {
    var cat = state.chipCategory || state.category;
    if (!cat) return true;
    return String(row.category || "") === cat;
  }

  function filteredCatalog() {
    var rows = state.catalog || [];
    if (state.tab === "favorites") {
      rows = rows.filter(function (r) {
        return r && r.product_code && state.favorites[r.product_code];
      });
    }
    return rows.filter(function (r) {
      if (!r) return false;
      if (!matchesRoom(r)) return false;
      if (!matchesCategory(r)) return false;
      if (!matchesQuery(r)) return false;
      return true;
    });
  }

  function renderGrid() {
    els.grid.hidden = state.tab === "list";
    els.list.hidden = state.tab !== "list";
    if (state.tab === "list") return;

    var rows = filteredCatalog();
    els.grid.innerHTML = "";
    rows.forEach(function (r) {
      var card = document.createElement("div");
      card.className = "catalog-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Add " + (r.product_name || r.product_code || "item"));

      var imgWrap = document.createElement("div");
      imgWrap.className = "catalog-card__media";

      var imgUrl = catalogImageUrl(r);
      if (imgUrl) {
        var img = document.createElement("img");
        img.className = "catalog-card__img";
        img.alt = r.product_name || r.product_code || "Product";
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = imgUrl;
        img.addEventListener("error", function () {
          img.remove();
          var ph = document.createElement("div");
          ph.className = "catalog-card__placeholder";
          ph.textContent = "No photo";
          imgWrap.appendChild(ph);
        });
        imgWrap.appendChild(img);
      } else {
        var placeholder = document.createElement("div");
        placeholder.className = "catalog-card__placeholder";
        placeholder.textContent = "No photo";
        imgWrap.appendChild(placeholder);
      }

      var body = document.createElement("div");
      body.className = "catalog-card__body";

      var name = document.createElement("div");
      name.className = "catalog-card__name";
      name.textContent = r.product_code || r.product_name || "Item";

      var desc = document.createElement("div");
      desc.className = "catalog-card__desc";
      desc.textContent = r.product_name || "";

      var meta = document.createElement("div");
      meta.className = "catalog-card__meta";

      var dims = document.createElement("div");
      dims.className = "catalog-card__dims";
      dims.textContent = formatDims(r);

      var fav = document.createElement("button");
      fav.type = "button";
      fav.className = "catalog-card__fav";
      fav.textContent = state.favorites[r.product_code] ? "♥" : "♡";
      fav.setAttribute("data-on", state.favorites[r.product_code] ? "1" : "0");
      fav.title = state.favorites[r.product_code] ? "Remove from favorites" : "Add to favorites";
      fav.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(r.product_code);
      });

      meta.appendChild(dims);
      meta.appendChild(fav);

      body.appendChild(name);
      body.appendChild(desc);
      body.appendChild(meta);

      card.appendChild(imgWrap);
      card.appendChild(body);

      function addThis() {
        if (typeof onAdd === "function") onAdd(r);
      }
      card.addEventListener("click", addThis);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") addThis();
      });

      els.grid.appendChild(card);
    });
  }

  function renderList() {
    if (state.tab !== "list") return;
    var items = typeof getPlacedItems === "function" ? getPlacedItems() : [];
    els.list.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("div");
      empty.style.color = "#64748b";
      empty.textContent = "No placed items yet. Use Add tab to place furniture.";
      els.list.appendChild(empty);
      return;
    }
    items.forEach(function (it) {
      var row = document.createElement("div");
      row.className = "catalog-list-item";
      var left = document.createElement("div");
      var title = document.createElement("div");
      title.className = "catalog-list-item__title";
      title.textContent = it.label || it.id || "Item";
      var sub = document.createElement("div");
      sub.className = "catalog-list-item__sub";
      sub.textContent = it.sub || "";
      left.appendChild(title);
      left.appendChild(sub);

      var btns = document.createElement("div");
      btns.className = "catalog-list-item__btns";
      var sel = document.createElement("button");
      sel.type = "button";
      sel.textContent = "Select";
      sel.addEventListener("click", function () {
        if (typeof it.onSelect === "function") it.onSelect();
      });
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "Remove";
      del.addEventListener("click", function () {
        if (typeof it.onRemove === "function") it.onRemove();
      });
      btns.appendChild(sel);
      btns.appendChild(del);

      row.appendChild(left);
      row.appendChild(btns);
      els.list.appendChild(row);
    });
  }

  function syncChipActive() {
    var kids = Array.prototype.slice.call(els.chips.children || []);
    kids.forEach(function (el) {
      var txt = el.textContent || "";
      var active = state.chipCategory && txt === state.chipCategory;
      if (active) el.classList.add("catalog-chip--active");
      else el.classList.remove("catalog-chip--active");
    });
  }

  function render() {
    if (!state.open) return;
    syncChipActive();
    renderGrid();
    renderList();
  }

  els.close.addEventListener("click", function () {
    setOpen(false);
  });
  els.tabBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      setTab(b.getAttribute("data-tab"));
    });
  });
  els.search.addEventListener("input", function () {
    state.q = els.search.value || "";
    render();
  });
  els.room.addEventListener("change", function () {
    state.room = els.room.value || "";
    render();
  });
  els.category.addEventListener("change", function () {
    state.category = els.category.value || "";
    if (state.category) state.chipCategory = "";
    render();
  });

  return {
    setOpen: setOpen,
    isOpen: function () {
      return !!state.open;
    },
    setTab: setTab,
    setCatalogRows: setCatalogRows,
    render: render,
  };
}

