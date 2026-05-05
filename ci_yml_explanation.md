# `ci.yml` — Line-by-Line Explanation

## Line 1 — Workflow Name
```yaml
name: CI
```
This is the display name of your workflow. It shows up in the **GitHub Actions tab** in your repository.

---

## Lines 3–6 — When to Run (Triggers)
```yaml
on:
  pull_request:
  push:
    branches: [main]
```
| Line | Meaning |
|---|---|
| `on:` | Defines what events trigger this workflow. |
| `pull_request:` | Run on **every Pull Request** — any branch, any target. No filters. |
| `push:` | Run when code is pushed... |
| `branches: [main]` | ...but **only** if the push is to the `main` branch. |

> [!NOTE]
> `pull_request` has no filters, meaning it triggers for PRs from **any branch** to **any branch**. This lets you catch bugs before merging.

---

## Line 8 — Jobs Block
```yaml
jobs:
```
Everything indented under `jobs:` is a **job**. Jobs run on separate virtual machines and can run in **parallel** (the default) or sequentially (using `needs:`).

---

## Lines 9–26 — Job 1: `quality`

```yaml
  quality:
```
The name/ID of this job. Used to reference it in `needs:`.

```yaml
    runs-on: ubuntu-latest
```
GitHub will spin up a fresh **Ubuntu Linux virtual machine** for this job. `ubuntu-latest` means the most recent stable Ubuntu runner image GitHub provides.

```yaml
    steps:
```
A list of sequential commands/actions to run **inside** that machine. Steps run one after another, top to bottom.

---

### Step 1 — Checkout the Code
```yaml
      - uses: actions/checkout@v4
```
- `uses:` means "run a pre-built Action from the GitHub Actions marketplace."
- `actions/checkout` downloads your **repository code** onto the runner machine. Without this, the machine would have no code to work with.
- `@v4` pins it to version 4 for stability.

---

### Step 2 — Install pnpm
```yaml
      - uses: pnpm/action-setup@v3
        with:
          version: 10
```
- Installs the `pnpm` package manager on the runner.
- `with:` passes configuration options to the action.
- `version: 10` installs **pnpm v10**, matching what your `package.json` specifies (`pnpm@10.33.2`).

> [!IMPORTANT]
> You MUST install pnpm before `actions/setup-node` so the caching step can find pnpm on the system.

---

### Step 3 — Set Up Node.js + Cache
```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
```
- `node-version: 20`: Installs **Node.js v20** on the runner.
- `cache: 'pnpm'`: **This is the speed upgrade.** It reads your `pnpm-lock.yaml`, generates a hash of it, and checks if GitHub has a cached copy of your `node_modules`. If the lockfile hasn't changed, it **restores the cache** instead of downloading everything from npm — saving minutes per run.

---

### Step 4 — Install Dependencies
```yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
```
- `name:` is just a label that shows up in the GitHub Actions UI.
- `run:` executes a shell command.
- `pnpm install --frozen-lockfile`: Installs all packages. `--frozen-lockfile` means "do NOT update `pnpm-lock.yaml`." If the lockfile would need to change, the step **fails** — which protects you from accidental dependency drift.

---

### Step 5 — Lint and Typecheck
```yaml
      - name: Lint and Typecheck
        run: |
          pnpm lint
          pnpm typecheck
```
- `|` is YAML's **block scalar** operator. It means "treat everything indented below me as a multi-line string."
- `pnpm lint`: Runs your ESLint configuration to catch code style errors.
- `pnpm typecheck`: Runs `tsc --noEmit` to verify TypeScript types without producing output files.
- If **either** command fails (exits with a non-zero code), the entire step fails.

---

## Lines 28–43 — Job 2: `test`

```yaml
  test:
    runs-on: ubuntu-latest
```
A **brand new, separate virtual machine** is created for this job. It runs **at the same time** as `quality` because there's no `needs:` dependency between them.

The steps are identical to `quality` except the last one:

```yaml
      - name: Run Tests
        run: pnpm test
```
Runs your test suite (e.g., Vitest, Jest). This is isolated from `quality` — if your tests take 3 minutes, they run during the same 3 minutes that linting is also happening.

---

## Lines 45–68 — Job 3: `build-and-push`

```yaml
  build-and-push:
    needs: [quality, test]
```
- `needs:` creates a **dependency**. This job will **not start** until both `quality` AND `test` have finished successfully.
- If either fails, this job is **skipped entirely** — no wasted Docker build time on broken code.

```yaml
    runs-on: ubuntu-latest
```
Another fresh Ubuntu machine.

---

### Step 1 — Checkout Code
```yaml
      - uses: actions/checkout@v4
```
Same as before — the code must be present to build the Docker image.

---

### Step 2 — Set Up Docker Buildx
```yaml
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
```
- The default `docker build` command is limited and doesn't support layer caching. **Buildx** is the modern, extended Docker build engine.
- This action installs and configures Buildx on the runner, enabling the `type=gha` cache below.

---

### Step 3 — Log In to Docker Hub
```yaml
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USER }}
          password: ${{ secrets.DOCKER_PASS }}
```
- `${{ secrets.DOCKER_USER }}`: GitHub **Secrets** are encrypted variables stored in your repo settings. They are never printed in logs. You set them under `Settings → Secrets and variables → Actions`.
- This step authenticates with Docker Hub so the next step can push images.

---

### Step 4 — Build and Push Docker Image
```yaml
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ secrets.DOCKER_USER }}/turbo-ci:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```
| Key | Meaning |
|---|---|
| `context: .` | Build the Dockerfile from the **root** of the repository. |
| `push: true` | After building, automatically push the image to Docker Hub. |
| `tags: .../turbo-ci:${{ github.sha }}` | Tag the image with the **unique Git commit SHA** (e.g., `abc1234`). Every commit produces a uniquely tagged image — no overwriting. |
| `cache-from: type=gha` | Before building, look in **GitHub's cache** for previously built Docker layers. |
| `cache-to: type=gha,mode=max` | After building, save **all layers** (including intermediate ones) to GitHub's cache. `mode=max` saves more layers, meaning more cache hits next time. |

> [!TIP]
> The result of this caching: if you change only one TypeScript file, Docker reuses all the layers before it (OS setup, `pnpm install` inside Docker, etc.) and only re-runs the final `COPY` layer. A build that took 3 minutes can drop to **under 10 seconds**.

---

## Lines 70–80 — Job 4: `deploy-staging`

```yaml
  deploy-staging:
    runs-on: ubuntu-latest
    needs: build-and-push
```
Waits for `build-and-push` to finish. Only then does it pull and run the image.

```yaml
    if: github.ref == 'refs/heads/main'
```
**A conditional check.** `github.ref` is the branch/tag that triggered the workflow.
- `refs/heads/main` = the `main` branch.
- This line means: **only deploy if we're on `main`**. Pull requests will skip this job entirely.

```yaml
    steps:
      - name: Pull image
        run: docker pull ${{ secrets.DOCKER_USER }}/turbo-ci:${{ github.sha }}
```
Downloads the exact image that was built and pushed in the previous job. Because the tag is `${{ github.sha }}`, it pulls **the image for this specific commit**, not "latest."

```yaml
      - name: Run container
        run: |
          docker run -d \
            -p 4000:3001 \
            -e PORT=3001 \
            ${{ secrets.DOCKER_USER }}/turbo-ci:${{ github.sha }}
```
| Option | Meaning |
|---|---|
| `docker run` | Start a new container from the image. |
| `-d` | Run in **detached** mode (background). The command returns immediately. |
| `-p 4000:3001` | Map **port 4000** on the host machine to **port 3001** inside the container. |
| `-e PORT=3001` | Set an **environment variable** inside the container so your app knows which port to listen on. |
| The image tag at the end | Specifies which image to run. |
