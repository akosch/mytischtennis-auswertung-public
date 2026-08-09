export function setupSingleSelect({ select, details, summary, options }) {
  const sync = () => {
    const selected = [...select.options].find((option) => option.value === select.value);
    summary.textContent = selected?.textContent ?? "";
    options.replaceChildren();
    for (const option of select.options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "multi-select-option single-select-option";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.value === select.value));
      button.disabled = option.disabled;
      button.textContent = option.textContent;
      button.addEventListener("click", () => {
        select.value = option.value;
        details.open = false;
        sync();
        select.dispatchEvent(new Event("input", { bubbles: true }));
      });
      options.append(button);
    }
  };
  select.addEventListener("change", sync);
  sync();
  return sync;
}
