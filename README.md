# Retirement Calculator

A simple, free, private retirement planner where you build and compare
"what-if" scenarios — different Social Security claiming ages, lump-sum
deposits, changing monthly contributions, retirement dates — and your data
**saves automatically** so you can leave and come back anytime.

- **Free forever.** Plain HTML/JavaScript hosted on GitHub Pages. No server, no
  database, no accounts, nothing that expires or bills you.
- **Auto-save, auto-load.** There's no "Save" button. Every change is stored
  instantly in your browser (localStorage) and reloaded when you reopen the page.
- **Private.** Your numbers stay in your browser on your computer.
- **Backups.** Use **Download backup** to save a `.json` copy (great for moving
  to a new laptop), and **Restore backup** to load it back.

## Using it

1. **Settings tab** — enter you and your spouse's names and birthdates, your
   Social Security estimates at each claiming age (62/65/66/67/70), VA disability
   (tax-free), current savings, and assumptions (return, inflation, tax rate).
2. **Scenarios tab** — click **New scenario**. Set retirement age, each person's
   SS claiming age, monthly contribution, and retirement spending. Add as many
   as you like of:
   - **Lump sums** (e.g. "August 2026: +$50,000"; use a negative amount for a withdrawal)
   - **Contribution changes** (e.g. "Jan 2030: raise to $3,000/mo")
   - **Extra income** (e.g. business income, with start/end dates and taxable flag)
   Use **Duplicate** to quickly compare variations (e.g. claim SS at 62 vs 67).
3. **Dashboard tab** — check the scenarios you want to compare to see a
   side-by-side metrics table and a balance-over-time chart.

## Running it

- **Online (recommended):** open the GitHub Pages URL (see Deploy below) and
  bookmark it.
- **Locally:** download the repo and open `index.html` in your browser. (Charts
  load from a CDN, so an internet connection is needed for the chart.)

## Deploy to GitHub Pages (one-time, free)

1. Merge this branch into your default branch (`main`).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**.
4. Choose **Branch: `main`**, **Folder: `/ (root)`**, click **Save**.
5. Wait ~1 minute. Your site appears at:
   `https://scottkoons.github.io/retirement-calculator/`
6. Bookmark that URL.

## Project layout

| File | Purpose |
|------|---------|
| `index.html` | App shell + tab navigation |
| `css/styles.css` | Styling |
| `js/engine.js` | Projection math (pure, no DOM) |
| `js/storage.js` | Auto-save/load + backup/restore |
| `js/ui.js` | Renders the three tabs |
| `js/app.js` | Wiring: state, events, chart |
| `tests/engine.test.html` | Open in a browser to verify the math |

## Notes

This is a personal planning estimate, not financial or tax advice. Social
Security amounts are the values you enter (the app does not recompute SSA
reductions/credits). All projections use nominal dollars; amounts you enter in
today's dollars are inflated forward so they stay consistent with the return.
