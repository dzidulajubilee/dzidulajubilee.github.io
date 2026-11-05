# dzidulajubilee.github.io

Personal site of Dzidula Gati, systems and security engineer. Served by GitHub Pages at https://dzidulajubilee.github.io

Plain HTML, CSS and JavaScript, with a three.js scene in the hero. No build step, and no third-party requests (fonts are self-hosted).

```
index.html            the page
assets/styles.css     all styles (colour tokens at the top)
assets/scene.js       the 3D hero: example network designs (three.js)
assets/main.js        slideshows and the Heimdall alert feed (illustrative data)
assets/vendor/        three.js r170 and two addons, served locally (MIT, see vendor/LICENSE)
assets/fonts/         IBM Plex Sans and Mono, latin subset (SIL Open Font License)
assets/img/           screenshots
```

Preview locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Design pass guided by unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.
