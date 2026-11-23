# Haley Pannell — Paintings

Portfolio site for the painter Haley Pannell. It's a plain static site: one
HTML page, one stylesheet and a small script. There's no build step and
nothing to install.

Live preview: https://yodama.github.io/haleyarahart/

## The design

- **Warm paper, black ink, the paintings.** The first screen says who
  Haley is and shows all the work at once.
- **Blue painter's tape** is the one decoration. It's used on the painting
  labels, the taped-down close-up, and as a highlight when you hover a link.
- **One pen note** in the intro, for a bit of personality.
- Click a painting to see it full screen. Use the arrow keys or swipe to
  browse, and Esc to close.

Type: [Inter Tight](https://fonts.google.com/specimen/Inter+Tight),
[Fragment Mono](https://fonts.google.com/specimen/Fragment+Mono) and
[Nanum Pen Script](https://fonts.google.com/specimen/Nanum+Pen+Script),
via Google Fonts.

## Editing

Everything a visitor reads is in **`index.html`**.

| What | Where |
| --- | --- |
| Intro | the two lines of the `<h1>` and the pen note inside it |
| Painting titles and details | each `<li class="piece">` |
| About | the `.about__text` paragraphs |
| Email | the `.contact__email` link. **It's a placeholder (`hello@example.com`) — replace both copies on that line.** |
| Instagram | uncomment the line under the email |

### Add a painting

1. Put the photo in `assets/img/works/`. A straight-on, evenly lit photo
   about 2000px on the long side works best.
2. Copy one `<li class="piece">` block in `index.html`. Change both image
   paths (the link and the `<img>`), the `width` and `height` (the photo's
   size in pixels), the `alt` text, the title and the details.

All paintings hang at the same height and wrap onto new rows as needed.

### The close-up in About

It's a zoomed crop of the first photo. To show a different spot, change
`transform: scale(...)` (how far to zoom in) and `transform-origin` (where
to zoom) on `.snapshot__crop img` in `assets/css/style.css`.

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
assets/js/main.js     full-screen viewer (the site works without it)
assets/img/works/     the paintings
assets/img/og.jpg     preview image for links shared on social media
favicon.svg
```
