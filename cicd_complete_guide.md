# The Complete CI/CD Guide
### Everything you need to know — from zero to understanding your pipeline

---

## Part 1: What Problem Does CI/CD Solve?

Imagine you're building an app with a team. You write code, your teammate writes code. At the end of the week, you both merge your code and... **it breaks**. The app crashes in production. Users complain. You spend hours debugging.

**This is the problem CI/CD was invented to solve.**

### Without CI/CD (the old way):
1. Developer writes code locally.
2. Tests it manually on their machine.
3. "It works on my machine!" → pushes to production.
4. Production breaks because their machine had different versions, configs, or they forgot to run the tests.
5. Everyone panics.

### With CI/CD:
1. Developer pushes code to GitHub.
2. **Automatically:** code is tested, linted, built, and packaged in a **clean, controlled environment**.
3. Only if everything passes → it gets deployed.
4. If anything fails → the developer is notified immediately, **before** it reaches users.

---

## Part 2: What CI and CD Actually Mean

These are two separate concepts that are almost always used together.

### CI — Continuous Integration
> "Continuously integrate code changes and verify they are correct."

Every time someone pushes code, you automatically:
- Run tests
- Check code style (lint)
- Check types (typecheck)
- Build the app

The word "continuous" means this happens on **every single push**, not once a week or before a big release. You catch problems within minutes, while the context is still fresh in your head.

### CD — Continuous Delivery / Continuous Deployment
> "Continuously deliver working code to an environment."

**Continuous Delivery:** The app is always in a state that *could* be deployed. You still press a button to deploy.  
**Continuous Deployment:** Deployment is fully automatic. If CI passes → it goes live. No human needed.

Your workflow does **Continuous Deployment** — if CI passes and you're on `main`, it automatically deploys to staging.

---

## Part 3: GitHub Actions — The Engine

GitHub Actions is the tool that runs your CI/CD pipeline. It is built directly into GitHub.

### The Mental Model
Think of GitHub Actions like a **robot employee** you hired. You write instructions for them in a `.yml` file. You tell them:
- *"Hey, whenever someone pushes to main, do the following..."*
- The robot wakes up, reads your instructions, and executes them step by step.

### Key Vocabulary

| Term | What it is | Real-world analogy |
|---|---|---|
| **Workflow** | The entire `.yml` file. A complete automated process. | A recipe book |
| **Job** | A group of steps that run on one machine. | One chef |
| **Step** | A single command or action inside a job. | One cooking instruction |
| **Runner** | The virtual machine that executes the job. | The kitchen |
| **Action** | A pre-built, reusable step from the marketplace (e.g., `actions/checkout`). | A pre-made spice mix |
| **Trigger** | The event that starts the workflow (`push`, `pull_request`). | The alarm that wakes the chef up |
| **Secret** | An encrypted variable stored in GitHub settings. | A locked safe with credentials |

### Where the files live
```
your-repo/
└── .github/
    └── workflows/
        └── ci.yml   ← GitHub reads this automatically
```
GitHub scans this directory. Any `.yml` file it finds there becomes a workflow. You can have multiple workflows (e.g., `ci.yml`, `release.yml`, `nightly.yml`).

---

## Part 4: What a "Runner" Actually Is

When your workflow triggers, GitHub spins up a **brand new, completely empty virtual machine** (a runner) in the cloud. This machine:

- Has **nothing** installed except basic OS tools.
- Gets your steps executed on it one by one.
- Is **thrown away** the moment the job finishes.

This is crucial to understand. **Every run starts from zero.** This is why:
1. You need `actions/checkout` — without it, there's no code on the machine.
2. You need to install Node.js — it's not pre-installed in the version you need.
3. You need to install pnpm — same reason.
4. Caching exists — because re-downloading 500 packages from scratch every time would be very slow.

### `ubuntu-latest` means:
GitHub picks the most recent stable Ubuntu LTS image. As of 2025, this is Ubuntu 22.04. It has `bash`, `git`, `docker`, `python`, `curl`, etc. pre-installed, but not your specific Node version or package manager.

---

## Part 5: Your Pipeline — The Full Flow

Here is exactly what happens when you run `git push origin main`:

```
git push origin main
        │
        ▼
GitHub receives the push
        │
        ▼
GitHub reads .github/workflows/ci.yml
        │
        ├─── Trigger matches? "push to main" ✓
        │
        ▼
GitHub spins up virtual machines:

  ┌──────────────────┐    ┌──────────────────┐
  │   Job: quality   │    │    Job: test      │
  │  (Ubuntu VM #1)  │    │  (Ubuntu VM #2)   │
  │                  │    │                   │
  │ 1. Get code      │    │ 1. Get code       │
  │ 2. Install pnpm  │    │ 2. Install pnpm   │
  │ 3. Setup Node+   │    │ 3. Setup Node+    │
  │    cache         │    │    cache          │
  │ 4. pnpm install  │    │ 4. pnpm install   │
  │ 5. pnpm lint     │    │ 5. pnpm test      │
  │ 6. pnpm typecheck│    │                   │
  └──────────────────┘    └──────────────────┘
          │                        │
          └──────────┬─────────────┘
                     │ Both passed ✓
                     ▼
          ┌──────────────────────┐
          │  Job: build-and-push  │
          │    (Ubuntu VM #3)     │
          │                       │
          │ 1. Get code           │
          │ 2. Set up Buildx      │
          │ 3. Login to DockerHub │
          │ 4. Build Docker image │
          │    (with layer cache) │
          │ 5. Push to Docker Hub │
          └──────────────────────┘
                     │
                     │ Passed ✓ AND on main branch?
                     ▼
          ┌──────────────────────┐
          │   Job: deploy-staging │
          │    (Ubuntu VM #4)     │
          │                       │
          │ 1. docker pull image  │
          │ 2. docker run image   │
          └──────────────────────┘
```

---

## Part 6: Docker — Why It's Here and What It Does

### The Problem Docker Solves
"It works on my machine" — the classic problem. Your machine has Node 20, the server has Node 18. Your machine has pnpm 10, the server has npm. Things break.

### What Docker Does
Docker **packages your entire application** — the code, Node version, pnpm, all dependencies, everything — into a single file called an **image**. This image runs identically on:
- Your laptop
- The GitHub Actions runner
- A cloud server in Tokyo
- A friend's Windows PC

### Key Docker Terms

| Term | What it is | Analogy |
|---|---|---|
| **Dockerfile** | A recipe for building your image. | Blueprint for a house |
| **Image** | A packaged, frozen snapshot of your app + environment. | A built house (blueprint executed) |
| **Container** | A running instance of an image. | A family living in the house |
| **Docker Hub** | A public/private registry to store and share images. | GitHub, but for Docker images |
| **Tag** | A label on an image (e.g., `:latest`, `:abc1234`). | A version number |

### In Your Workflow:
1. `docker/build-push-action` reads your `dockerfile` and builds an image.
2. Tags it with the commit SHA: `youruser/turbo-ci:abc1234def5678`
3. Pushes that image to Docker Hub.
4. The deploy job pulls that same image and runs it.

**Why tag with `${{ github.sha }}`?**  
Every Git commit has a unique 40-character hash (SHA). Tagging Docker images with it means:
- You can trace exactly which code is running.
- You can roll back to any previous commit's image instantly.
- No accidental overwriting of `:latest`.

---

## Part 7: Caching — Why It Matters and How It Works

Without caching, every single workflow run would:
1. Download Node.js from the internet (~70 MB).
2. Download all your npm packages from scratch (~200-500 MB).
3. Re-build every Docker layer from scratch.

This would make every run take 5-10 minutes. With caching:

### pnpm Cache (`cache: 'pnpm'` in `actions/setup-node`)
1. GitHub hashes the contents of your `pnpm-lock.yaml`.
2. It checks if there's a cached `node_modules` with that hash.
3. **Cache hit:** Restores in ~10 seconds. `pnpm install` still runs but skips downloading.
4. **Cache miss:** Downloads everything normally, then saves to cache for next time.

**When does the cache invalidate (become stale)?**  
Only when `pnpm-lock.yaml` changes, i.e., when you add/remove/update a package. For normal code changes, the cache is always hit.

### Docker Layer Cache (`cache-from/cache-to: type=gha`)
Docker images are made of **layers**. Each line in your Dockerfile creates a layer:
```dockerfile
FROM node:20              ← Layer 1 (OS + Node)
COPY package.json .       ← Layer 2 (package file)
RUN pnpm install          ← Layer 3 (dependencies)
COPY . .                  ← Layer 4 (your source code)
RUN pnpm build            ← Layer 5 (compiled output)
```

Docker caches each layer separately. If layer 4 changes (you edited a `.ts` file), Docker reuses layers 1, 2, and 3 from cache and only re-runs layers 4 and 5. A 3-minute build becomes a 15-second build.

`type=gha` stores these layer caches in GitHub's own cache storage (up to 10 GB free).

---

## Part 8: Secrets — How Credentials Work Safely

You should **never** put passwords or tokens directly in your YAML file. If you did:
```yaml
# ❌ NEVER DO THIS
password: mySecretPassword123
```
Anyone who can see your repository can see your password. Even in a private repo, it's bad practice.

### How GitHub Secrets Work
1. Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name it `DOCKER_PASS`, paste your password.
3. GitHub **encrypts** it and stores it. Even you cannot read it back.
4. In the workflow, reference it as `${{ secrets.DOCKER_PASS }}`.
5. GitHub decrypts it only at runtime and **masks it from all logs** — if it accidentally gets printed, it shows as `***`.

---

## Part 9: Parallel vs Sequential Jobs

### Sequential (the old way)
```
lint → typecheck → test → build → push → deploy
[--5min--][--2min--][--3min--][--4min--][--1min--][--1min--]
Total: ~16 minutes
```

### Parallel (your way)
```
┌─ quality (lint + typecheck) ─ 5min ─┐
│                                      ├─ build-and-push (4min) → deploy (1min)
└─ test ─────────────── 3min ─────────┘
Total: ~10 minutes (limited by the slowest parallel job)
```

The `needs:` keyword is what creates the dependency graph. Jobs without `needs:` run immediately and in parallel. Jobs with `needs:` wait.

---

## Part 10: The `if:` Condition and Branch Protection

```yaml
if: github.ref == 'refs/heads/main'
```

`github.ref` is a **context variable** — GitHub provides dozens of these automatically. They give you information about the current run:

| Variable | Value | When |
|---|---|---|
| `github.ref` | `refs/heads/main` | Push to main branch |
| `github.ref` | `refs/heads/feature/login` | Push to feature branch |
| `github.ref` | `refs/pull/42/merge` | Pull Request #42 |
| `github.sha` | `abc1234...` | The current commit hash |
| `github.actor` | `your-username` | Who triggered the workflow |
| `github.event_name` | `push` or `pull_request` | What triggered it |

**Why restrict deploy to `main`?**
- Pull requests trigger the workflow too. You want to run CI on PRs (catch bugs), but you don't want to deploy half-finished PR code to staging.
- The `if:` condition is evaluated **after** the job would start. If it's false, the job is **skipped** (shown in grey in the UI, not failed in red).

---

## Part 11: Pull Requests vs Pushes — Different Behaviors

Here's the complete behavior matrix for your workflow:

| Event | `quality` | `test` | `build-and-push` | `deploy-staging` |
|---|---|---|---|---|
| PR opened/updated (any branch) | ✅ Runs | ✅ Runs | ✅ Runs (if CI passes) | ⏭️ Skipped (`if:` is false) |
| Push to `main` | ✅ Runs | ✅ Runs | ✅ Runs (if CI passes) | ✅ Runs |
| Push to `feature/x` | ⏭️ Not triggered | ⏭️ Not triggered | ⏭️ Not triggered | ⏭️ Not triggered |

> [!NOTE]
> Push to `feature/x` doesn't trigger anything because the `push` trigger has `branches: [main]`. Only a PR or a direct push to main would trigger it.

---

## Part 12: What Happens When Something Fails

When a step fails (exits with a non-zero code), GitHub Actions:
1. **Stops** all remaining steps in that job immediately.
2. **Marks** the job as failed (red ❌).
3. **Cancels** any jobs that `need:` the failed job.
4. **Sends you an email** notification (configurable).
5. **Blocks the PR** from merging (if branch protection rules are set up).

Example: If `pnpm lint` fails in the `quality` job:
- `pnpm typecheck` is **skipped** (same job, next step).
- `build-and-push` is **cancelled** (needs `quality`).
- `deploy-staging` is **cancelled** (needs `build-and-push`).
- `test` **continues** (it has no `needs:`, so it's unaffected).

---

## Part 13: The Full Mental Model — "The Pipeline"

Think of your CI/CD pipeline like an assembly line in a factory:

```
Code push
    │
    ▼
┌───────────────────────────────────────────────────────┐
│                    QUALITY GATES                       │
│                                                        │
│  ┌──────────────┐    ┌──────────────┐                 │
│  │ Code Quality │    │ Tests Pass   │  ← Both must    │
│  │ (lint+types) │    │              │    pass to      │
│  └──────────────┘    └──────────────┘    continue     │
└───────────────────────────────────────────────────────┘
    │
    ▼ (only if all gates pass)
┌───────────────────────────────────────────────────────┐
│                     PACKAGING                          │
│                                                        │
│  Build Docker image → Tag with commit → Push to Hub   │
│  (cached for speed)                                    │
└───────────────────────────────────────────────────────┘
    │
    ▼ (only if on main branch)
┌───────────────────────────────────────────────────────┐
│                    DEPLOYMENT                          │
│                                                        │
│  Pull image from Hub → Run container on server         │
└───────────────────────────────────────────────────────┘
```

Every stage is a **gate**. Fail a gate → nothing beyond it runs. This is the safety guarantee of CI/CD.

---

## Part 14: Common Questions Answered

**Q: If I push to a feature branch, does CI run?**  
No. Your `push` trigger is `branches: [main]` only. CI only runs on PRs or pushes to main. If you want CI on all branches, remove the `branches:` filter from `push:`.

**Q: Does the Docker image get pushed on pull requests?**  
Yes, currently. This can be changed by adding `if: github.event_name != 'pull_request'` to the `build-and-push` job. Some teams prefer this; others prefer to test the full pipeline on PRs too.

**Q: The runner machine is deleted after the job. So where does the deployed container run?**  
This is the big gap in your current workflow! `docker run` runs the container on the **GitHub Actions runner** — which is deleted after the job. In a real production setup, you'd deploy to a persistent server (your own VPS, AWS EC2, etc.) using SSH or a cloud-specific action. The current setup is fine for learning.

**Q: What is `--frozen-lockfile`?**  
It tells pnpm: "Install exactly what's in `pnpm-lock.yaml`. Do not update it. If there's a mismatch, fail." This is important in CI because you want reproducible builds. You don't want CI to silently update a dependency and break something.

**Q: Can I run the pipeline manually?**  
Yes! Add `workflow_dispatch:` to your `on:` block. This adds a "Run workflow" button in the GitHub Actions UI.
```yaml
on:
  workflow_dispatch:  # Adds manual trigger button
  pull_request:
  push:
    branches: [main]
```

**Q: How much does this cost?**  
GitHub Actions is **free** for public repositories. For private repositories, you get 2,000 free minutes/month on the Free plan. Each job minute counts separately. Running 4 jobs in parallel that each take 3 minutes = 12 minutes of usage, not 3.

**Q: What's the difference between `uses:` and `run:`?**  
- `run:` executes a **shell command** directly (bash by default).
- `uses:` runs a **pre-built Action** from the GitHub marketplace (or your repo). Actions are reusable bundles of steps written by others (or you).

---

## Part 15: Improving This Further (Next Steps)

When you're ready, here are the natural next improvements:

1. **Real deployment target:** SSH into a VPS to actually deploy persistently.
2. **Environment secrets:** Separate `staging` vs `production` secrets.
3. **Turbo remote caching:** Turbo can cache its own task outputs in the cloud (Vercel Remote Cache), skipping builds for code that hasn't changed in a monorepo.
4. **Branch protection rules:** Require CI to pass before a PR can be merged into main.
5. **Slack/Discord notifications:** Alert your team when deploys succeed or fail.
6. **Matrix builds:** Test against multiple Node versions simultaneously.
