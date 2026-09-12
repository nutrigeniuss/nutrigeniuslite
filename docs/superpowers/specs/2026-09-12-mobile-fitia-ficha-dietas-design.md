# Spec: Mobile Fitia UX — Ficha + Dietas (Lite Calc)

**Date:** 2026-09-12  
**Status:** Approved (user: “dale” → enfoque 2)  
**Scope:** Calculator ficha shell + diet editors (alimentos / intercambios). Not landing, admin, or MyFoods overhaul.

## Goal

Make Lite Calc feel like a **mobile-first nutrition calculator**: practical (fewer taps), dynamic (light motion), and polished (Fitia-like calm cards) — without a full product redesign.

## Non-goals

- Bottom-tab app shell rewrite
- New brand colors / purple themes
- Copying Fitia IP or screenshots
- Changing clinical calculation logic

## Design principles

1. **One job visible:** sticky chrome stays thin; content starts sooner.
2. **Thumb-first:** primary actions ≥44px; destructive actions always visible on touch.
3. **Card surfaces:** white cards on soft tinted canvas; soft shadow, large radius.
4. **Motion with purpose:** 150–250ms fades/slides on tab change, modal open, add-food feedback — not decoration spam.
5. **Reuse `ng-*` tokens:** extend, don’t invent a second design system.

## Screens

### A. Ficha shell (`CalculatorPage` + `ConsultDetail` + `FichaContextBar`)

- Keep sticky header + sticky module pills (already present); refine spacing and pill “selected” presence.
- Context bar: single calm card; edit CTA remains prominent.
- Content sections: consistent `ng-card` / `ng-inset` rhythm; slightly more vertical gap between blocks on mobile.

### B. Diet by foods (`DietCreator` + toolbar + meal tabs + ActiveMealCard + FAB)

- Toolbar: keep Volver / Resumen / Opciones; tighten visual hierarchy (title secondary on mobile).
- Meal chips: larger, selected state clearer (shadow + scale micro).
- Meal content: card with soft header strip; food rows easier to scan (name primary, kcal secondary).
- FAB: already shortened; add subtle press scale + safe-area (done partially).
- Food search modal: keep bottom-sheet on mobile; soften header gradient; list rows with clearer add affordance.

### C. Diet by exchanges (`ExchangeToolbar` + main panels)

- Align with foods editor: Opciones menu, min-h-11, shorter tab labels (partially done).
- Soften toolbar chrome to match foods editor (white / blur / border).
- Table/indication panels: wrap in calmer card shells on mobile where missing.

### D. Motion (shared)

- Prefer CSS transitions / Tailwind `transition` / existing animate utilities.
- Optional: short `animate-in` on food modal open (already used patterns elsewhere).
- Avoid layout thrash; no heavy framer-motion dependency unless already present.

## Success criteria

- On ~390px width: ficha module switch + diet add flow feel “app-like” (less clinical chrome).
- Primary actions remain reachable one-handed.
- No regression to autosave, print, or catalog/search data paths.
- Deployable as one focused commit after implementation.

## Out of scope this pass

- Bioquímica visual redesign (already opens calculator directly)
- Dietética R24h full card redesign (minor chip polish only if cheap)
- Desktop layout overhaul
