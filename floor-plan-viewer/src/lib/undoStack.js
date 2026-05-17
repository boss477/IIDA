/**
 * Simple undo stack for editor snapshots.
 * @param {number} [maxSize=50]
 */
export function createUndoStack(maxSize) {
  var limit = maxSize || 50;
  var stack = [];

  return {
    push: function (entry) {
      stack.push(entry);
      if (stack.length > limit) stack.shift();
    },
    canUndo: function () {
      return stack.length > 0;
    },
    pop: function () {
      return stack.pop();
    },
    clear: function () {
      stack.length = 0;
    },
    size: function () {
      return stack.length;
    },
  };
}
