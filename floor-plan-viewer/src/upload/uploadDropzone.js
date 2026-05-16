/**
 * @param {HTMLInputElement} input
 * @param {HTMLImageElement} planImg
 * @param {() => void} onLoaded
 * @param {(file: File) => void} [onFileChosen] runs when a file is selected (before onLoaded)
 */
export function bindPlanFileInput(input, planImg, onLoaded, onFileChosen) {
  input.addEventListener("change", function () {
    var f = input.files && input.files[0];
    if (!f) return;
    if (onFileChosen) onFileChosen(f);
    planImg.src = URL.createObjectURL(f);
    planImg.onload = function () {
      onLoaded();
    };
  });
}
