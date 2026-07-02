# Recipe Mode

Recipes in [Obsidian](https://obsidian.md): a kitchen-friendly cooking view, ingredient scaling, web import, shopping lists and meal plans. English and Italian units are understood ("2 cups flour" and "2 cucchiai di olio" both work).

Recipes are **plain markdown notes with frontmatter** — no lock-in, and they play nicely with Dataview and the Properties UI.

## Recipe note format

```markdown
---
tags: [recipe]
servings: 4
prep_time: 20m
cook_time: 45m
course: main        # optional
cuisine: italian    # optional
source: https://…   # optional
rating: 4           # optional
---

# Pasta al forno

## Ingredienti
- 400 g pasta
- 2 cucchiai di olio d'oliva
- 1,5 l passata di pomodoro
- sale q.b.

## Preparazione
1. Preriscaldare il forno a 200 °C.
2. …
```

- A note is a recipe when it carries the `recipe` tag (configurable).
- Section headings are recognized in English and Italian (`Ingredients`/`Ingredienti`, `Steps`/`Directions`/`Preparazione`/`Procedimento`, …) and are configurable.
- Ingredient lines are parsed leniently — quantities, fractions (`1 1/2`, `1½`), decimal commas (`1,5`), ranges (`2-3`), `q.b.` / "to taste". Lines that don't parse still render verbatim; nothing is ever lost.
- Ingredient groups: use `### Per la salsa` sub-headings inside the ingredients section.

## Commands

| Command | What it does |
| --- | --- |
| **Open recipe in cooking mode** | Kitchen view: big type, checkable ingredients & steps, serving stepper with live scaling, metric ⇄ imperial toggle, screen wake-lock. |
| **New recipe** | Creates a templated recipe note in your recipe folder. |
| **Format selection as ingredients** | Normalizes pasted text into ingredient bullets. |
| **Import recipe from URL** | Reads schema.org metadata (JSON-LD or microdata) from a recipe page and creates a note. Optionally downloads the photo. |
| **Create shopping list from recipes** | Pick recipes, get one deduplicated checklist (400 g + 0,3 kg pasta → 0,7 kg pasta). |
| **New meal plan** | Weekly table to fill with `[[recipe]]` links. |
| **Generate shopping list from meal plan** | Aggregates every recipe linked in the active note. |

## Settings

Recipe tag · ingredient/step heading names · display language (English/Italiano) · unit system (as written / metric / imperial) · screen wake-lock · new-recipe folder · image download on import.

## Development

```bash
npm install
npm run dev     # esbuild watch → main.js
npm test        # vitest (parsers, units, scaling, schema.org, aggregation)
npm run build   # type-check + production bundle
```

To try it in a vault: copy (or symlink) `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/recipe-mode/`, then enable "Recipe Mode" in Community plugins.
