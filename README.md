# Haley Pannell — Paintings

Portfolio site for the painter Haley Pannell. It's a plain static site: one
HTML page, one stylesheet and a small script. There's no build step, and
nothing to install to run it.

Live preview: https://yodama.github.io/haleyarahart/

## The design

The page is laid out like a blueprint sheet: one cobalt field, white line
work, typed labels. The paintings are the only color on the page, and the
copy only labels things. It never describes the work.

- **Title block:** a dashed box at the top with the HP mark, a small
  moonphase dial, the visitor's local time, and the menu. The dial works
  like a watch's: a starry disc with two moons turns half a revolution each
  lunar month, and it turns to today's phase when the page loads. Hover it
  to see the phase name.
- **Label rows:** `LABEL - - - - LABEL - - - - LABEL` lines head each
  section. The date in the first row is the visitor's own date.
- **The name** fills the width of the sheet exactly, edge to edge of the
  letters, at any screen size.
- **Works** sit in a grid of equal 4:5 plates: three across on a laptop,
  two on a tablet, one on a phone. Each painting is drawn as large as it
  fits in its plate at its true proportions, standing on a shared line
  above its label, and numbered FIG. 01, 02, 03 and on.
- **The viewer:** click a painting to see it full screen. It opens straight
  away on the grid image and swaps in the full-resolution photo when it has
  loaded. Click the painting (or press Z) to look closer at the paint
  surface: the enlarged photo follows the mouse, and on a phone you drag
  it. Arrow keys or a swipe browse, and Esc steps out of the zoom, then
  closes. The Back button closes the viewer too.
- **A link to each painting:** while a painting is open, the address bar
  shows its own link, for example `…/haleyarahart/#untitled-iv`. Sending
  that link opens the site on that painting.
- **Motion, kept small:** the dashed leader lines creep along a pixel at a
  time, a painting's FIG line runs while you hover it, and the clock's
  colon blinks. Every so often a line-drawn satellite drifts across behind
  the content, leaving a fading dashed trail, and now and then a shooting
  star streaks past. All of it switches off when a visitor has reduced
  motion turned on.
- **Detail A** is a close-up of one painting at the photo's full
  resolution, with a small key showing where it comes from.
- **Printing** the page (or saving it as a PDF) gives a plain catalog on
  white.

Type: [Inter Tight](https://fonts.google.com/specimen/Inter+Tight) for the
name and titles, and [Courier Prime](https://fonts.google.com/specimen/Courier+Prime)
for everything else. Both are served from this site (`assets/fonts`, SIL
Open Font License), so the page doesn't depend on Google.

## Editing

Everything a visitor reads is in **`index.html`**.

| What | Where |
| --- | --- |
| Painting titles and details | each `<li class="piece">`. **The titles (Untitled I–IX) and "Oil on canvas" are placeholders**: add the real title, medium, size and year, e.g. `Oil on canvas, 24 × 30 in, 2025`. |
| Info text | `.info__text`, and the rows of the `.spec` table. Examples for location, Instagram and a CV are in a comment. |
| Email | **It's a placeholder (`hello@example.com`).** Replace it in the Info table and in the Contact section, two copies on each line. |

Figure numbers, the "Fig. 01–09" range and the works count update
themselves.

### Add a painting

1. Crop the photo to just the painting (no wall, frame or easel). A
   straight-on, evenly lit photo about 2000px on the long side works best.
2. Run the helper. It needs Python and Pillow (`pip install pillow`):

   ```bash
   python3 tools/prepare-painting.py ~/Desktop/new-painting.jpg 10 --title "Untitled X"
   ```

   It writes `10.jpg` (full size, for the viewer), `10-1000.jpg` and
   `10-640.jpg` (for the grid) into `assets/img/works/`, keeping the
   photo's color profile and dropping camera data such as location.
3. Paste the `<li>` it prints into the list of works in `index.html`, and
   fill in the description, title and details. The `id` becomes the
   painting's link (`#untitled-x`), so keep it unique.

Works 04–09 were cropped from phone photos and straightened for
perspective. Their colors are as photographed, and they keep the phones'
Display P3 color profile, so the paint shows its full color on screens
that support it.

### Detail A

It's `assets/img/detail-a.jpg`, an 800px square cut from a full-size photo
(and `detail-a-480.jpg`, the same crop for ordinary screens). To show a
different spot, replace both files with a new crop, and move the small box
on `.detail__key i` in `assets/css/style.css` to match. Its numbers are
the crop's position and size as a share of the painting.

### The preview picture for shared links

`assets/img/og.jpg` is what appears when the site's link is shared in a
message or on social media. It's made from `tools/templates/og.html`. To
remake it after changing the works, start the local server (below) and
run:

```bash
node tools/render-og.js http://localhost:8000
```

This needs [Playwright](https://playwright.dev) (`npm install playwright`).
It also remakes the app icons.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish

GitHub Pages serves the `gh-pages` branch. To publish from your working
branch instead, go to **Settings → Pages**, pick that branch, and choose
`/ (root)`.

**Moving to your own domain** (e.g. haleypannell.com): update the site's
address in the `<head>` of `index.html` (the `canonical` link, `og:url`,
`og:image` and the `url` and `image` lines in the structured data), and
change `<base href="/haleyarahart/">` in `404.html` to `<base href="/">`.

## Files

```
index.html                 all the content
404.html                   the page shown for a missing address
assets/css/style.css       the design
assets/js/main.js          live date and time, moon, counts, sky sprites, viewer
assets/fonts/              Inter Tight and Courier Prime, with their licenses
assets/img/works/          the paintings: NN.jpg full size, NN-1000.jpg and NN-640.jpg for the grid
assets/img/detail-a*.jpg   the close-up in Info
assets/img/og.jpg          preview picture for shared links
assets/img/grain.png       the faint print texture on the blue
favicon.svg, assets/img/favicon-32.png, assets/img/apple-touch-icon.png
tools/prepare-painting.py  makes the image files for a new painting
tools/render-og.js         remakes og.jpg and the icons
```
