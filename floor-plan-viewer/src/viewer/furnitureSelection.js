/** Multi-select state and "Goes with" group helpers for plan furniture. */

export function createFurnitureSelection() {
  var ids = new Set();
  var primaryId = null;

  return {
    clear: function () {
      ids.clear();
      primaryId = null;
    },
    has: function (id) {
      return ids.has(id);
    },
    getIds: function () {
      return Array.from(ids);
    },
    size: function () {
      return ids.size;
    },
    getPrimary: function () {
      if (primaryId && ids.has(primaryId)) return primaryId;
      var arr = Array.from(ids);
      return arr.length ? arr[0] : null;
    },
    setPrimary: function (id) {
      if (id && ids.has(id)) primaryId = id;
    },
    setSingle: function (id) {
      ids.clear();
      primaryId = id || null;
      if (id) ids.add(id);
    },
    toggle: function (id) {
      if (ids.has(id)) {
        ids.delete(id);
        if (primaryId === id) primaryId = ids.size ? Array.from(ids)[0] : null;
      } else {
        ids.add(id);
        primaryId = id;
      }
    },
    add: function (id) {
      ids.add(id);
      primaryId = id;
    },
    remove: function (id) {
      ids.delete(id);
      if (primaryId === id) primaryId = ids.size ? Array.from(ids)[0] : null;
    },
  };
}

export function newGroupId() {
  return "gw_" + Math.random().toString(36).slice(2, 10);
}

/** Assign a shared groupId to all listed items (2+ required). */
export function linkItemsAsGroup(furniture, itemIds) {
  if (!itemIds || itemIds.length < 2) return null;
  var groupId = newGroupId();
  var idSet = {};
  itemIds.forEach(function (id) {
    idSet[id] = true;
  });
  (furniture || []).forEach(function (item) {
    if (idSet[item.id]) item.groupId = groupId;
  });
  return groupId;
}

/** Merge selected items into an existing group if any already belong to one. */
export function goesWithGroup(furniture, itemIds) {
  if (!itemIds || itemIds.length < 2) return null;
  var existing = null;
  (furniture || []).forEach(function (item) {
    if (itemIds.indexOf(item.id) >= 0 && item.groupId) existing = item.groupId;
  });
  var groupId = existing || newGroupId();
  var idSet = {};
  itemIds.forEach(function (id) {
    idSet[id] = true;
  });
  (furniture || []).forEach(function (item) {
    if (idSet[item.id]) item.groupId = groupId;
  });
  return groupId;
}

export function unlinkItemFromGroup(item) {
  if (item) delete item.groupId;
}

export function getGroupMembers(furniture, groupId) {
  if (!groupId) return [];
  return (furniture || []).filter(function (f) {
    return f.groupId === groupId;
  });
}

export function selectionHasGroup(furniture, itemIds) {
  if (!itemIds || !itemIds.length) return false;
  var idSet = {};
  itemIds.forEach(function (id) {
    idSet[id] = true;
  });
  return (furniture || []).some(function (f) {
    return idSet[f.id] && f.groupId;
  });
}

export function isItemSelected(selectedIds, itemId) {
  if (!selectedIds || !itemId) return false;
  if (selectedIds instanceof Set) return selectedIds.has(itemId);
  if (Array.isArray(selectedIds)) return selectedIds.indexOf(itemId) >= 0;
  return selectedIds === itemId;
}

export function hasFurnitureSelection(selectedIds) {
  if (!selectedIds) return false;
  if (selectedIds instanceof Set) return selectedIds.size > 0;
  if (Array.isArray(selectedIds)) return selectedIds.length > 0;
  return !!selectedIds;
}

export function duplicateFurnitureItems(furniture, itemIds, offsetNorm) {
  var dx = offsetNorm && offsetNorm.x != null ? offsetNorm.x : 0.02;
  var dy = offsetNorm && offsetNorm.y != null ? offsetNorm.y : 0.02;
  var idSet = {};
  itemIds.forEach(function (id) {
    idSet[id] = true;
  });
  var copies = [];
  (furniture || []).forEach(function (item) {
    if (!idSet[item.id]) return;
    var copy = JSON.parse(JSON.stringify(item));
    copy.id = "f_" + Math.random().toString(36).slice(2, 10);
    copy.x = (item.x || 0) + dx;
    copy.y = (item.y || 0) + dy;
    copies.push(copy);
  });
  return copies;
}
