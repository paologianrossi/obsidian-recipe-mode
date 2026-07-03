import { describe, expect, it } from "vitest";
// `obsidian` resolves to tests/obsidian-stub.ts via the vitest alias.
import { EditorState } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { buildChips, buildInline } from "../src/ui/live-preview";
import { DEFAULT_SETTINGS } from "../src/settings";
import type RecipeModePlugin from "../src/main";

const plugin = { settings: { ...DEFAULT_SETTINGS } } as unknown as RecipeModePlugin;

const DEMO = `---
tags:
  - recipe
servings: 4
prep_time: 20m
cook_time: 45m
rating: 4
---
# Pasta al forno (demo)

## Ingredienti

### Per la pasta
- 400 g pasta
- 1,5 l passata di pomodoro
- 2 cucchiai di olio d'oliva
- sale q.b.

## Preparazione
1. Preriscaldare il forno a 200 °C.
`;

function classify(set: DecorationSet) {
  const out = { lines: 0, marks: 0, widgets: 0, widgetTexts: [] as string[] };
  const iter = set.iter();
  while (iter.value) {
    const spec = (iter.value as unknown as { spec: Record<string, unknown> }).spec;
    if (spec["widget"]) {
      out.widgets++;
      const w = spec["widget"] as { text?: string };
      if (typeof w.text === "string") out.widgetTexts.push(w.text);
    } else if (iter.from === iter.to) {
      out.lines++; // line decorations are points
    } else {
      out.marks++; // marks span text
    }
    iter.next();
  }
  return out;
}

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc });
}

describe("buildInline (live preview decorations)", () => {
  it("produces quantity marks and conversion widgets for the demo note", () => {
    const result = classify(buildInline(stateOf(DEMO), plugin));
    // 3 quantified ingredient lines → 3 marks
    expect(result.marks).toBe(3);
    // 400 g → oz, 1,5 l → quarts; "2 cucchiai" is neutral → no conversion
    expect(result.widgets).toBe(2);
    expect(result.widgetTexts.join(" | ")).toMatch(/oz/);
    // line decorations for every line in both sections
    expect(result.lines).toBeGreaterThan(5);
  });

  it("cursor on a line suppresses its conversion widget but keeps the mark", () => {
    const pos = DEMO.indexOf("400 g");
    const state = EditorState.create({ doc: DEMO, selection: { anchor: pos } });
    const result = classify(buildInline(state, plugin));
    expect(result.marks).toBe(3);
    expect(result.widgets).toBe(1); // the 1,5 l one survives
  });

  it("still annotates metric quantities when the unit-system setting is metric", () => {
    // Regression: with target=metric and an all-metric recipe there was
    // nothing to convert, so no ghosts appeared at all.
    const metricPlugin = {
      settings: { ...DEFAULT_SETTINGS, unitSystem: "metric" },
    } as unknown as RecipeModePlugin;
    const result = classify(buildInline(stateOf(DEMO), metricPlugin));
    expect(result.widgets).toBe(2);
    expect(result.widgetTexts.join(" | ")).toMatch(/oz/); // complementary system
  });

  it("decorates untagged notes too (no gating by default)", () => {
    const untagged = DEMO.replace(/tags:\n  - recipe\n/, "");
    const result = classify(buildInline(stateOf(untagged), plugin));
    expect(result.marks).toBe(3);
  });

  it("returns nothing for notes without recipe sections", () => {
    const result = classify(buildInline(stateOf("# Note\n\n- 400 g something\n"), plugin));
    expect(result.marks + result.widgets + result.lines).toBe(0);
  });
});

describe("buildChips", () => {
  it("creates one block widget under the H1", () => {
    const result = classify(buildChips(stateOf(DEMO), plugin));
    expect(result.widgets).toBe(1);
  });

  it("no chips without meta frontmatter", () => {
    const result = classify(buildChips(stateOf("# Title\n\n## Ingredients\n- 1 egg\n"), plugin));
    expect(result.widgets).toBe(0);
  });
});
