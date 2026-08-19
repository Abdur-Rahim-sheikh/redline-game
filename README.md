# KAK URAAN QR Game

KAK URAAN is a free, mobile-first tap-to-fly game designed to open directly from a QR code. The player taps anywhere to flap a crow through openings formed by Bangladeshi koroi-tree branches.

The camera and countryside background remain stable. Only the crow, branches, and a few small feather effects move, which avoids the continuous full-screen motion used by the previous prototype.

There is no login, app installation, advertising network, analytics service, paid backend, or runtime library.

The driving-lesson promotion stays outside gameplay. It appears only:

- at the bottom of the result screen;
- as a small footer on a score image the player chooses to share; and
- as a small footer on the optional poster template.

## What is included

- One-tap crow physics: tap, click, Space, or Arrow Up
- Three-frame animated crow artwork
- Hand-painted koroi branches with compound leaves and hanging seed pods
- Continuously positioned, reachable openings
- Gradually increasing obstacle speed and decreasing opening size
- Stable Bangladesh-inspired sky and field background
- Generated flap, point, and collision sounds with no audio downloads
- Personal best stored only on the player's device
- Native mobile score sharing with a generated PNG card
- Click-to-call lesson card for `01577602941`
- Offline replay after the first successful visit
- PWA metadata and a printable A4 poster template

## Important files

```text
.
├── index.html                       Screens and lesson card
├── styles.css                      Mobile interface styles
├── manifest.webmanifest            PWA information
├── sw.js                           Offline cache
├── src/
│   ├── app.js                      Screens and score sharing
│   ├── audio.js                    Generated game sounds
│   ├── core.js                     Tested gap/collision functions
│   └── game.js                     Physics, obstacles, drawing, input
├── assets/
│   ├── crow-sprites-v3.webp        Optimized three-frame crow
│   ├── koroi-top-game.webp         Optimized upper branch
│   ├── koroi-bottom-game.webp      Optimized lower branch
│   ├── bd-driving-car.webp         Optimized learner-car cutout
│   ├── icon.svg                    Editable app icon source
│   ├── share-card.svg              Editable link preview source
│   └── poster-template.svg         Printable A4 poster source
└── tests/
    ├── core.test.js                Automated tests
    └── visual.html                 Gameplay-only browser view
```

The larger `*-source*.png` files are editable generated-art sources. The browser loads only the small WebP versions.

## Run locally

Nothing needs to be installed from npm. From this directory, run:

```bash
npm run dev
```

Open:

```text
http://localhost:4173
```

Do not open `index.html` directly as a `file://` URL. Browser modules, offline caching, and sharing behavior require a web server.

Run the checks with:

```bash
npm test
npm run check
```

## Controls

On a phone:

- Tap **Start flying**.
- Tap anywhere to flap upward once.
- Stop tapping to fall.
- Pass between the upper and lower koroi branches.

On a computer, click the game or press Space/Arrow Up.

## Free GitHub Pages deployment

Create a public GitHub repository, for example `kak-uraan`. If this directory is not already a Git repository:

```bash
git init
git add .
git commit -m "Build KAK URAAN QR game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kak-uraan.git
git push -u origin main
```

Then, in the GitHub repository:

1. Open **Settings**.
2. Select **Pages** under “Code and automation.”
3. Under “Build and deployment,” select **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
5. Select **Save**.

The public address will look like:

```text
https://YOUR_USERNAME.github.io/kak-uraan/
```

Publish later changes with:

```bash
git add .
git commit -m "Improve KAK URAAN"
git push
```

If an old version remains cached, change `CACHE_NAME` near the top of `sw.js`, for example from `kak-uraan-v1.1.0` to `kak-uraan-v1.1.1`, and deploy again.

## Alternative: free Cloudflare Pages upload

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Select **Create application**, then **Get started**.
3. Choose **Drag and drop your files**.
4. Enter a project name such as `kak-uraan`.
5. Upload this project folder and deploy it.

The resulting address will look like:

```text
https://kak-uraan.pages.dev/
```

## Make the QR poster

Generate the final QR only after the deployed URL works on a phone.

An easy no-cost method in desktop Chrome is:

1. Open the deployed game URL.
2. Use the address-bar share button or right-click the page.
3. Select **Create QR code for this page**.
4. Download the QR PNG.

Then:

1. Open `assets/poster-template.svg` in Inkscape, Canva, Figma, or another SVG editor.
2. Place the QR over the dashed “PLACE YOUR QR CODE” square.
3. Preserve the white space surrounding the QR.
4. Export a high-resolution PNG or PDF.
5. Scan the export or print with Android and iPhone before distributing it.

## Change lesson details

The public details currently are:

```text
Ready to learn to drive?
Naria, Shariatpur
01577602941
```

Find every occurrence with:

```bash
rg "01577602941|Naria, Shariatpur"
```

Update:

- `index.html` for the result card;
- `src/app.js` for shared score images; and
- `assets/poster-template.svg` for the poster.

The clickable Bangladesh number uses `tel:+8801577602941`, while visible text remains `01577602941`.

## Tune difficulty

The main values are in `src/game.js` and `src/core.js`:

- `gravity` controls falling speed.
- The value set in `#flap()` controls flap strength.
- `this.speed` controls horizontal branch movement.
- `this.spawnTimer` controls branch spacing.
- `createBranchGap()` controls opening size and reachable vertical shifts.
- `#crowHitbox()` controls collision forgiveness.

Change one value at a time and test on a real phone. A first-time player should have time to understand the first opening before the difficulty rises.

## Mobile release checklist

- Test current Chrome on Android and Safari on iPhone.
- Test a smaller/older phone, not only a flagship.
- Confirm every screen tap produces exactly one flap.
- Confirm horizontal finger position never affects the crow.
- Check that the background remains stable and comfortable.
- Verify leaves extending outside the central trunk collision area are forgiving.
- Rotate the device during play and return from another app.
- Test with sound muted.
- Share a score through WhatsApp/Messenger.
- Tap the lesson phone number and verify the dialer.
- Load once, enable airplane mode, reopen, and confirm it still starts.
- Scan the final printed QR from its expected viewing distance.

## Privacy and limitations

The game sends no score, name, contact information, or analytics event anywhere. Best score and sound settings use local browser storage, so each phone has its own personal best and there is no global leaderboard.
