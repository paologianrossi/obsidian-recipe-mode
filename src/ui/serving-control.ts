/** A small −/+ stepper for target servings. */
export class ServingControl {
  private valueEl!: HTMLElement;

  constructor(
    parent: HTMLElement,
    private value: number,
    private onChange: (value: number) => void,
  ) {
    const root = parent.createDiv({ cls: "recipe-serving-control" });
    const minus = root.createEl("button", { text: "−", cls: "recipe-serving-btn", attr: { "aria-label": "Fewer servings" } });
    this.valueEl = root.createSpan({ cls: "recipe-serving-value" });
    const plus = root.createEl("button", { text: "+", cls: "recipe-serving-btn", attr: { "aria-label": "More servings" } });
    minus.addEventListener("click", () => this.step(-1));
    plus.addEventListener("click", () => this.step(1));
    this.render();
  }

  private step(direction: 1 | -1): void {
    // step by 1, but allow halves below 1 (0.5 servings is legitimate for scaling)
    const next = this.value + direction * (this.value <= 1 && direction === -1 ? 0.5 : this.value < 1 ? 0.5 : 1);
    if (next <= 0) return;
    this.value = next;
    this.render();
    this.onChange(this.value);
  }

  set(value: number): void {
    this.value = value;
    this.render();
  }

  private render(): void {
    this.valueEl.setText(String(this.value % 1 === 0 ? this.value : this.value.toFixed(1)));
  }
}
