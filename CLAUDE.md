# Working in this repo

- **Ship live immediately.** The owner wants every finished build live ASAP: once `node tests/lane-runner.test.js` passes and the screenshots look right, commit, push, open a PR to `main`, and merge it straight away. GitHub Pages serves `main`. Don't wait for a separate go-ahead.
- On each ship, bump `BUILD` in `lane-runner/index.html` and the `?v=` on the landing-page link, so the glasses don't show a cached copy.
- Read `HANDOFF.md` first for the game's design, the glasses' constraints and the code map.
