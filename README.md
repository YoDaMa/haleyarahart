# Haley Pannell — Paintings

Portfolio site for the painter Haley Pannell. It's a plain static site: one
HTML page, one stylesheet and a small script. There's no build step and
nothing to install.

Live preview: https://yodama.github.io/haleyarahart/

## The design

The page is laid out like a blueprint sheet: one cobalt field, white line
work, typed labels. The paintings are the only color on the page, and the
copy only labels things. It never describes the work.

- **Title block:** a dashed box at the top with the HP mark, the number of
  works, the visitor's local time, and the menu.
- **Label rows:** `LABEL - - - - LABEL - - - - LABEL` lines head each
  section. The date in the first row is the visitor's own date.
- **The name** is set to fill the width of the sheet exactly, at any screen
  size.
- **Works** hang at one shared height inside corner brackets, numbered
  FIG. 01, 02, 03. Click one to see it full screen. Use the arrow keys or
  swipe to browse, and Esc to close.
- **Detail A** is a close-up of one painting, with a small key showing
  where it comes from.

Type: [Inter Tight](https://fonts.google.com/specimen/Inter+Tight) for the
name and titles, and [Courier Prime](https://fonts.google.com/specimen/Courier+Prime)
for everything else, via Google Fonts.

## Editing

Everything a visitor reads is in **`index.html`**.

| What | Where |
| --- | --- |
| Painting titles and details | each `<li class="piece">` |
| Info text | `.info__text`, and the rows of the `.spec` table (add rows for location or Instagram; examples are in a comment) |
| Email | **It's a placeholder (`hello@example.com`).** Replace it in the Info table and in the Contact section, two copies on each line. |

Figure numbers, the "Fig. 01–03" range and the works count update
themselves.

### Add a painting

1. Put the photo in `assets/img/works/`. A straight-on, evenly lit photo
   about 2000px on the long side works best.
2. Copy one `<li class="piece">` block in `index.html`. Change both image
   paths (the link and the `<img>`), the `width` and `height` (the photo's
   size in pixels), the `alt` text, the title and the details.

### Detail A

It's a zoomed crop of the first photo. To show a different spot, change
`transform: scale(...)` and `transform-origin` on `.detail__crop img` in
`assets/css/style.css`, then move the small box on `.detail__key i` to
match. Its numbers are the share of the photo the crop covers.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish

GitHub Pages serves the `gh-pages` branch. To publish from your working
branch instead, go to **Settings → Pages**, pick that branch, and choose
`/ (root)`.

## Files

```
index.html            all the content
assets/css/style.css  the design
assets/js/main.js     live date and time, counts, full-screen viewer
assets/img/works/     the paintings
assets/img/grain.png  the faint print texture on the blue
assets/img/og.jpg     preview image for links shared on social media
favicon.svg
```
