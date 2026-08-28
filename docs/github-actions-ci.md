# GitHub Actions CI in this repository

This document explains `.github/workflows/ci.yml` for developers who can work in the codebase but may not already know GitHub Actions syntax.

## What the workflow is

A file under `.github/workflows/` describes automated work GitHub runs for repository events.

Our CI workflow answers one question:

> Does the repository still pass the frontend and backend checks we expect before code is merged?

It does not deploy the application and it does not use Docker.

## Key YAML concepts

### `on`

`on` defines which repository events start the workflow.

This repository runs CI for pull requests targeting `main` and for pushes to `main`. A pull request therefore receives automated validation before merge, and the merged result is validated again on the main branch.

### `permissions`

The workflow requests only `contents: read`.

That is enough for CI to check out and inspect repository code. Validation does not need permission to modify repository contents, issues, releases, or deployments.

### `concurrency`

Concurrency groups runs that represent the same branch/ref and cancels an older in-progress run when a newer commit supersedes it.

Why this matters: if three commits are pushed quickly to one PR, spending CI capacity finishing obsolete runs provides little value. The newest commit is the one we ultimately need to trust.

### `jobs`

A job is an independent group of steps executed on a GitHub-hosted runner.

This workflow has separate frontend and backend jobs because they have different runtimes and dependencies:

```text
Frontend -> Node.js / npm
Backend  -> Python / Django
```

They can run independently. A backend failure does not hide whether frontend validation also failed, and vice versa.

### `steps`

A job is executed step by step. If a required step fails, later normal steps in that job do not run.

### `uses`

`uses` runs a reusable GitHub Action maintained as a packaged action.

Examples in this repository include checking out source code and configuring Node/Python. We prefer established setup actions for those environment tasks instead of reimplementing them with shell commands.

### `run`

`run` executes normal shell commands in the runner.

Commands such as `npm run lint` or `python backend/manage.py check` are ordinary project commands; GitHub Actions is simply running them automatically.

## Frontend job

### Checkout

The runner starts without the repository working tree. Checkout places the commit being validated onto the runner.

### Node 22 setup

CI explicitly selects Node 22 so the runtime is reproducible instead of depending on whatever default happens to be installed on the runner image.

The npm cache is enabled to avoid downloading unchanged package data on every run. The lockfile remains the source of dependency versions.

### `npm ci`

`npm ci` is intended for clean automated environments.

Unlike a normal development `npm install`, it installs exactly from the existing lockfile and fails when `package.json` and the lockfile disagree. CI should test the dependency graph committed to the repository, not silently rewrite it.

### `npm run lint`

Checks lint rules and catches code-quality/static-analysis violations.

### `npm run typecheck`

Runs TypeScript checking independently from bundling. This catches incompatible props, wrong AG Grid API types, invalid contracts, and similar compile-time mistakes.

### `npm run test:run`

Runs the frontend automated test suite once in CI mode.

Tests cover shared grid mechanics and feature integration behavior. A test failure should be investigated as either a real regression or an intentionally changed contract whose test must be updated with a clear reason.

### `npm run build`

Performs the production frontend build. Passing lint/tests alone is not enough if the application cannot compile and bundle for production.

## Backend job

### Python 3.11 setup

CI selects the backend Python version and enables pip caching for downloaded dependencies.

### Install requirements

The job installs the backend dependency file into the clean runner.

### `python backend/manage.py check`

Django's system check catches configuration and model/application problems that can exist even when a focused unit test does not exercise them.

### `python backend/manage.py test apps.transactions`

Runs the Transactions backend tests, including query, editing, logical selection actions, eligibility enforcement, and selected export behavior.

## How to read a failure

Start with the failed job, then the first failed step inside it.

Examples:

```text
Frontend / typecheck failed
-> inspect TypeScript error and file/line

Frontend / tests failed
-> inspect first failing test and assertion

Frontend / build failed
-> inspect Vite/TypeScript/bundler error

Backend / Django check failed
-> inspect Django system-check output

Backend / tests failed
-> inspect first failing backend test/traceback
```

Do not fix CI by weakening or deleting a valid check just to make the badge green. Determine whether the implementation is wrong or whether an old test expectation no longer represents the intended contract.

## Example from this repository

The first CI run added to this repository exposed two stale frontend Discard expectations. Production code intentionally refreshed all editable columns plus the row action column after edit-context changes, while the old tests expected only the action column.

The correct fix was to update those tests to the intentional contract and document why the broader refresh is required. CI therefore gave us useful regression feedback immediately.

## What CI does not replace

CI does not replace manual AG Grid verification for lifecycle/UI behavior that depends on real scrolling, pagination, cache loading, browser interaction, visual conflict resolution, or teardown timing.

The repository therefore keeps both automated checks and manual test scenarios.

## When adding a new capability

Before considering a foundation feature done:

1. add/update focused automated tests where behavior is executable;
2. run through the relevant manual scenarios;
3. make sure CI validates the changed code path;
4. document behavior, ownership, native AG Grid usage, limitations, and future options.
