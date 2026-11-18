# கோலம் · Kolam

A personal one-page generator for traditional Tamil sikku / pulli kolam — rice-flour loop patterns drawn around a grid of dots. Every day gets a new, unique design. Open it, watch it draw, practice it, save a PNG, or print it in black on white.

Live: [https://macshivadi.github.io/kolam/](https://macshivadi.github.io/kolam/)

## Use it

- **Kolam of the Day** is the same for everyone on a given local calendar day. It changes at midnight. Browse earlier days with ← / → (not the future).
- **Generate** makes a random valid kolam. Pick a square grid (5×5, 7×7, 9×9, 11×11) or a diamond (1-3-5-3-1, 1-3-5-7-5-3-1, 1-3-5-7-9-7-5-3-1).
- **Themes:** Classic (white rice flour on a dark floor), Pongal · Sankranti, Diwali, and Christmas. On festival days the daily kolam and its dated page start in a matching theme; you can still switch by hand.
- **Save PNG** and **Print** are available on every pattern. Share invites a friend to practice the same design (WhatsApp, Facebook, X, or copy the link).

Nothing is stored on a server. There is no account and no tracking.

## Festival days

Verified civil dates for India, 2025–2030, are hardcoded (no lunar guessing). Sources: [timeanddate.com](https://www.timeanddate.com/) (India) and [Drik Panchang](https://www.drikpanchang.com/) / [Panjangam](https://www.panjangam.com/).

Pongal and Makara Sankranti are treated as **one harvest festival** with regional names (Tamil Nadu: Pongal / kolam; Andhra Pradesh and Telangana: Sankranti / muggulu or rangoli). Those days share the Pongal · Sankranti theme and inclusive titles. Christmas stays its own theme.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run dev
npm run build   # Vite + prerender of dated pages
```

Patterns are genuine sikku/pulli kolam, built with the Gift Gerdes / Lusona mirror-curve method, preferring a single closed loop and 4-fold (or 2-fold) symmetry.

Daily designs are unique under the dihedral group D4 (rotations and reflections). The first 3,650 days from the launch date of 17 November 2026 are checked in the test suite.

## Dated pages and SEO

Each day is prerendered at `/YYYY/MM/DD/` with its own title, description, canonical URL, Open Graph image, inline SVG, and JSON-LD. `sitemap.xml` and `robots.txt` are generated at build time. A `?date=YYYY-MM-DD` link redirects to the path.

GitHub Actions deploys on every push to `main`, and also on a daily cron (`15 6 * * *`, about midnight America/Chicago in winter) so tomorrow’s page exists when the day arrives.

### Switching the site URL later

The workflow sets `SITE_URL` and `VITE_SITE_URL` to `https://macshivadi.github.io/kolam`. When the custom domain is attached, change both to `https://kolam.com` (no trailing slash), then rebuild. Vite’s `base` is already `'./'`, so asset paths work both at `/kolam/` and at the apex domain. Do not add a `CNAME` file until the DNS is ready.

## License

Personal project. Kolam patterns themselves are traditional. The generator source in this repository is available for personal use.
