# benchwren.com

The Benchwren home page, served by GitHub Pages from `main` at `https://benchwren.com` (see `CNAME`). Plain HTML, CSS and JavaScript with no build step and no third-party requests.

- `index.html`: the page. Apps are listed by platform; add a new app under its platform heading and link to its docs.
- `styles.css`: colour tokens (light and dark), type and layout.
- `tree.js`: the hero, a component tree in 3D on a canvas. Drag to turn it; pick a branch to update the `componentBranch` query. Honours reduced motion (no growth, no auto-turn) and pauses when off screen.
- `tilt.js`: the product card leans towards the pointer (mouse and pen only, not with reduced motion).
- `fonts/`: self-hosted Bricolage Grotesque, Instrument Sans and JetBrains Mono (SIL Open Font License), so visitors make no requests to Google.

Product docs live in the separate `benchwren/docs` repo at `https://docs.benchwren.com`.

Preview locally with `python3 -m http.server 8765 --directory benchwren-home` from the workspace root.
