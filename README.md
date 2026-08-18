# REDLINE QR Game

REDLINE is a free, mobile-first reflex game designed to open directly from a QR code. A player controls a glowing energy core, holds anywhere to rush faster, and drags left or right through continuously positioned gates. There are no lanes or fixed columns. There is also no login, app installation, advertising network, analytics service, or paid backend.

The driving-lesson promotion stays out of gameplay. It appears only:

- at the bottom of the result screen;
- as a small footer on a score image a player chooses to share; and
- as a small footer on the optional poster template.

## What is included

- Responsive Canvas gameplay for phones, tablets, and desktops
- Touch, mouse, and keyboard controls
- Increasing speed, multiplier, reachable continuous gates, and precision bonuses
- Synthesized energy/crash sounds with no audio downloads
- Screen shake, particles, vibration, and reduced-motion support
- Personal best stored only on the player's device
- Native mobile score sharing with a generated PNG score card
- Click-to-call driving lesson card for `01577602941`
- Offline replay after the first successful visit
- Installable PWA metadata
- A4 SVG poster template for the final QR code
- No runtime dependencies and no build step

## Project structure

```text
.
├── index.html                  Game screen and result promotion
├── styles.css                 Responsive interface styles
├── manifest.webmanifest       PWA information
├── sw.js                      Offline cache
├── src/
│   ├── app.js                 Screens, result data, and score sharing
│   ├── audio.js               Generated energy hum and effect sounds
│   ├── core.js                Tested utility and gate-fairness functions
│   └── game.js                Gameplay, drawing, input, and collision
├── assets/
│   ├── icon.svg               Editable source icon
│   ├── icon-192.png           PWA icon
│   ├── icon-512.png           PWA icon
│   ├── share-card.png         Link preview image
│   ├── share-card.svg         Editable link preview source
│   └── poster-template.svg    Printable A4 poster source
└── tests/
    ├── core.test.js           Automated core tests
    └── visual.html            Minimal gameplay-only visual test page
```

## Run it locally

Nothing needs to be installed from npm. You only need Python 3 or Node.js.

From this project directory, run:

```bash
npm run dev
```

This command uses Python's built-in server. Open:

```text
http://localhost:4173
```

Do not open `index.html` directly as a `file://` URL. Browser modules, offline caching, and some sharing behavior require a web server.

To run the automated checks:

```bash
npm test
npm run check
```

## Deploy for free with GitHub Pages

This is the easiest option if the project will be stored on GitHub. A public repository can use GitHub Pages on GitHub Free. No custom domain is required.

### 1. Create the repository

Create a new **public** repository on GitHub, for example `redline-game`. Do not add a generated README or `.gitignore` because this folder already contains the project files.

If this folder is not already a Git repository, run:

```bash
git init
git add .
git commit -m "Build REDLINE QR game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/redline-game.git
git push -u origin main
```

Replace `YOUR_USERNAME` with the GitHub username. If Git asks for identity details, set them with the commands Git displays and repeat the commit.

### 2. Enable Pages

In the GitHub repository:

1. Open **Settings**.
2. Select **Pages** under “Code and automation.”
3. Under “Build and deployment,” select **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
5. Select **Save**.

GitHub will display a public address similar to:

```text
https://YOUR_USERNAME.github.io/redline-game/
```

Open that exact address on a phone and complete several runs before printing the QR code.

### Publish later changes

```bash
git add .
git commit -m "Improve REDLINE"
git push
```

If players still see an older cached version, change `CACHE_NAME` near the top of `sw.js`, for example from `redline-v2.0.1` to `redline-v2.0.2`, and deploy again.

## Alternative free deployment: Cloudflare Pages

The project is already prebuilt, so it can use dashboard Direct Upload:

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Select **Create application**, then **Get started**.
3. Choose **Drag and drop your files**.
4. Enter a project name such as `redline-naria`.
5. Drag this entire project folder into the upload area and deploy it.

The result will have an address similar to:

```text
https://redline-naria.pages.dev/
```

Cloudflare Direct Upload projects cannot later be converted into Git-integrated projects; create a separate Pages project if automatic Git deployments are wanted later.

## Turn the deployed URL into a QR poster

Only generate the final QR after the public URL is working.

### Generate the QR image

An easy no-cost method in desktop Chrome is:

1. Open the deployed game URL.
2. Use the address-bar share button or right-click the page.
3. Select **Create QR code for this page**.
4. Download the QR as a PNG.

Other browsers may expose the same action from their Share menu. A QR generator can also be used, but make sure it encodes the full `https://.../` address exactly.

### Finish the included poster

1. Open `assets/poster-template.svg` in the free Inkscape application, Canva, Figma, or another SVG editor.
2. Place the downloaded QR image over the large dashed “PLACE YOUR QR CODE” square.
3. Keep the QR square white and do not crop the blank margin around the code.
4. Export as a high-quality PNG or PDF for printing.
5. Scan the exported or printed poster with at least one Android phone and one iPhone before distributing it.

For a physical banner, make the QR much larger than it looks necessary. For an image people will forward through Messenger, WhatsApp, or Facebook, export at high resolution because those services compress images. Include the short game URL beneath the QR as a fallback.

## Controls

On a phone:

- Tap **Enter redline**.
- Press and hold anywhere on the screen to rush and build the score multiplier.
- Drag the held finger left or right to guide the core through each opening.
- Release to reduce speed and regain control.

On a computer, use the left/right arrow keys and hold Space to rush.

## Change the lesson details

The current public details are:

```text
Want to learn to drive?
Naria, Shariatpur
01577602941
```

They appear in three source files. Find every occurrence with:

```bash
rg "01577602941|Naria, Shariatpur"
```

Update:

- `index.html` for the post-run contact card and phone link;
- `src/app.js` for the shared score-image footer; and
- `assets/poster-template.svg` for the printable poster.

For the clickable phone link, Bangladesh's `+880` form removes the leading zero: `tel:+8801577602941`. The text visible to players can remain `01577602941`.

## Tune the game

The main values are in `src/game.js`:

- `cruiseSpeed` and `rushSpeed` control the speed curve.
- `this.elapsed / 55` controls how quickly maximum difficulty arrives.
- `this.spawnTimer` controls gate spacing.
- `createGatePattern` in `src/core.js` controls opening width and reachable movement.
- The score multiplier rises from `×1.0` to `×4.0` while rushing.

Change one variable at a time and test it on a real phone. The goal is for a first-time player to survive roughly 15–30 seconds and immediately understand why they crashed.

## Mobile release checklist

Before publishing the QR widely:

- Test current Chrome on Android and Safari on iPhone.
- Test a smaller/older phone, not only a flagship phone.
- Verify that the core follows a finger smoothly across the full play area.
- Confirm every gate opening can appear between fixed columns, not only at preset positions.
- Confirm sound starts only after tapping **Enter redline**.
- Rotate the device during a run and confirm play remains usable.
- Lock the phone or switch apps during a run, then return.
- Complete a run with sound muted.
- Use **Share score** in WhatsApp/Messenger or the phone's share sheet.
- Tap the lesson phone number and verify the dialer shows `01577602941`.
- Load once, enable airplane mode, reopen the page, and confirm it still starts.
- Scan the final printed QR from the distance at which the banner will be viewed.

## Privacy and current limitations

The game sends no score, name, contact detail, or analytics event anywhere. The best score and sound setting use local browser storage. As a result, every phone has its own personal best and there is no global leaderboard. That is intentional for this zero-cost first release and keeps the scan-to-play experience extremely fast.
