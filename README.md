# Haley Pannell — Paintings

Portfolio site for the painter Haley Pannell. It's a static site with no build
step and no dependencies: plain HTML, CSS and JavaScript, plus WebGL for the
light effects.

## The idea

The paintings are thick impasto, so the surface is part of the work and a flat
photo loses it. The site treats **light** as its one interaction:

- **Hero:** the name rises out of a continuous folded paint surface. The
  folds echo *Untitled I*, and the colors are sampled from the paintings.
  The scene sits mostly in shadow, and the cursor is a lamp raking across
  it. On touch screens the lamp drifts on its own and follows a tap.
- **Works:** each painting is relit live. A relief map is rebuilt from the
  photo, so the ridges catch light. At rest the photo stays true, and a few
  glints slide across it as you scroll past, like walking by a painting in a
  room. On hover the lamp is in your hand, with full raking light pooled
  around the cursor.
- **Viewer:** click a painting to open it full screen. You can rake light,
  zoom with the scroll wheel, a pinch or a double-click, and browse with the
  arrow keys or a swipe. Each painting has its own URL, such as
  `#view/untitled-ii`.
- **Palettes:** the color chips under each painting are measured from the
  photo when the page loads.

Every color in the design comes from the paintings themselves: the ink of
the deepest crevices, the pearl of the highlights, and the pigments in
between (see the variables at the top of `assets/css/style.css`).

## Editing

Everything a visitor reads is in **`index.html`**.

| What | Where |
| --- | --- |
| Name | `<title>`, the meta tags, `.nav__brand`, the two `.hero__word`s, the footer |
| Painting titles and details | each `<article class="work">` |
| Statement | the `.about__text` paragraphs |
| Email | the `.contact__email` link. **It's a placeholder (`hello@example.com`) — replace it.** Every "Inquire" button uses it. |
| Instagram and other links | uncomment the `<li>` in `.contact__links` |

### Add a painting

1. Put the photo in `assets/img/works/`. A straight-on, evenly lit photo works
   best, about 2000px on the long side. Higher resolution makes zoom more
   rewarding.
2. Copy one `<article class="work">` block in `index.html`. Change the `id`,
   the image `src`, its `width` and `height` (the photo's pixel size), the
   `alt` text, the title and the details.

Numbering, the palette, the light and the viewer are all generated
automatically. The first painting in the list also sets the colors of the
hero.

### The About close-up

`data-crop="left top width height"` on `.detail__frame` picks the region
shown, as fractions of the photo.

## Run it locally

The WebGL effects need the page to be served over HTTP. Opened straight from
the file system, it falls back to plain images.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish

Any static host works. For GitHub Pages: **Settings → Pages → Deploy from a
branch**, then pick the branch and `/ (root)`. The `.nojekyll` file is
already in place.

## Accessibility and fallbacks

- All content is real HTML, including the name, which stays in the page
  for search engines and screen readers.
- Without WebGL, the name is set in type and the paintings show as plain
  photos. Zoom and the viewer still work.
- `prefers-reduced-motion` turns off the entrance animations, the drifting
  lamp and the reveals.
- The viewer is a modal dialog with focus trapping. `Esc` closes it, `←` and
  `→` browse, `+`, `-` and `0` zoom, and `L` toggles the light.

## Files

```
index.html             content
assets/css/style.css   design (tokens, layout, responsive)
assets/js/gl.js        shared helpers (WebGL, color math)
assets/js/hero.js      the name in relief
assets/js/relief.js    raking-light renderer for the paintings
assets/js/palette.js   measures each painting's palette
assets/js/viewer.js    full-screen viewer
assets/js/main.js      wiring: works, light, navigation, reveals
assets/img/            paintings and social preview image
```

Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces) and
[DM Mono](https://fonts.google.com/specimen/DM+Mono), via Google Fonts.
