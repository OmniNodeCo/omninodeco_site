# OmniNodeCo — Website

A complete static marketing site for **OmniNodeCo**, a (fictional) global edge
infrastructure company — with a **projects page**, and a **GitHub Actions
workflow that publishes the site over FTP using encrypted GitHub secrets**.

No build step, no framework, no dependencies: plain HTML, CSS and a small
amount of vanilla JS. That keeps the deploy dead-simple and FTP-friendly.

## Pages

| Page           | Route           | Highlights                                                        |
| -------------- | --------------- | ----------------------------------------------------------------- |
| Home           | `index.html`    | Hero, stats, platform features, featured projects, how-it-works   |
| Projects       | `projects.html` | 8 project cards, category filtering (JS), featured EdgeMesh banner |
| About          | `about.html`    | Mission, company timeline, values, team                           |
| Contact        | `contact.html`  | Form (Formspree-ready), contact cards, FAQ                        |
| 404            | `404.html`      | Friendly lost-in-the-mesh page                                    |

## Project structure

```
.
├── index.html            # Home
├── projects.html         # Projects page
├── about.html            # About page
├── contact.html          # Contact page
├── 404.html
├── css/style.css         # Design system (dark theme, responsive)
├── js/main.js            # Nav, filters, reveal animations, contact form
├── img/                  # Hero & about artwork
├── favicon.svg
├── robots.txt
├── sitemap.xml
└── .github/workflows/
    └── deploy.yml        # GitHub Actions → FTP publish
```

## Running locally

Any static file server works:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

## Deploying: GitHub Actions → FTP

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
runs on every push to `main` (and manually via **Actions → Run workflow**).
It checks out the repo and syncs it to your web host over FTP using the
[`SamKirkland/FTP-Deploy-Action`](https://github.com/SamKirkland/FTP-Deploy-Action).

### 1. Add the secrets

Go to **repo → Settings → Secrets and variables → Actions → New repository secret**
and add:

| Secret              | Example                       | Notes                                            |
| ------------------- | ----------------------------- | ------------------------------------------------ |
| `FTP_SERVER`        | `ftp.example.com`             | Host only — no `ftp://`, no path                 |
| `FTP_USERNAME`      | `deploy@example.com`          | Your FTP login                                   |
| `FTP_PASSWORD`      | `hunter2`                     | Stored encrypted; never in the repo              |
| `FTP_PORT`          | `21`                          | 21 plain FTP · 990 FTPS · 22 SFTP                |
| `FTP_SERVER_DIR`    | `/public_html`                | Remote folder to publish into (use `/` for root) |
| `WEBSITE_URL` *(optional)* | `https://www.example.com` | Enables the post-deploy smoke test          |

The workflow's `environment: production` means you can also scope these
secrets to the **production environment** instead of the whole repo
(Settings → Environments → production) — useful if you add preview
environments later.

### 2. What happens on push

```
push to main ──▶ checkout ──▶ FTP sync (uses secrets) ──▶ smoke test (optional)
```

- `dangerous-clean-slow: true` mirrors the repo — files on the server that no
  longer exist locally are deleted. Set it to `false` in `deploy.yml` if your
  `FTP_SERVER_DIR` shares the folder with other content you want to keep.
- `.git`, `.github`, `README.md` and other dev files are excluded from the upload.
- `concurrency` cancels in-flight deploys if you push again, so the server never
  gets two uploaders racing.

### 3. Switching protocols

Plain FTP is the default. To use **FTPS** (explicit), **FTPS** (implicit) or
**SFTP**, change the `protocol:` input in `deploy.yml`:

```yaml
protocol: ftps      # explicit FTPS (AUTH TLS) — most common secure option
protocol: ftps-legacy  # implicit FTPS (port 990)
protocol: sftp      # SFTP over SSH (then FTP_PORT should be 22)
```

> 💡 Many hosts now disable plain FTP. If the deploy fails with a TLS or
> "connection closed" error, switch to `ftps` (and make sure your host
> supports it) or use SFTP.

## Contact form

The form on `contact.html` is configured in `js/main.js`:

```js
CONFIG = {
  FORM_ENDPOINT: "",  // paste a Formspree endpoint to receive submissions
  CONTACT_EMAIL: "hello@omninodeco.com",
}
```

- **With an endpoint** (e.g. [Formspree](https://formspree.io)): submissions
  POST there and you get them in your inbox.
- **Without one**: it opens the visitor's mail client with a pre-filled email.

## Contributing / notes

- Site content is fictional placeholder copy — swap in real product info.
- `sitemap.xml`, `robots.txt` and the Open Graph tags point at
  `https://omninodeco.liveblog365.com/` (the production URL).
- Prefer no external dependencies: if you add a build step, insert it between
  the checkout and FTP steps in `deploy.yml`.

## Going live (checklist)

1. Push `.github/workflows/deploy.yml` (currently kept local until the GitHub
   connection has the `workflows` permission): `git add -f .github/workflows/deploy.yml && git commit && git push`.
2. Make sure the workflow's trigger branch matches your default branch — it
   currently fires on `main`, so push (or merge) the site to `main`.
3. Add the secrets (Settings → Secrets and variables → Actions):
   `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_PORT`, `FTP_SERVER_DIR`,
   and optionally `WEBSITE_URL=https://omninodeco.liveblog365.com/` to enable
   the post-deploy smoke test.
4. Trigger a deploy (push to main or Actions → Run workflow) — then
   https://omninodeco.liveblog365.com/ serves the site instead of the host's
   default placeholder page.
