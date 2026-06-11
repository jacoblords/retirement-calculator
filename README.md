# Retirement Pathfinder

Client-side retirement calculator that models savings growth, inflation, taxes on withdrawals, and pre/post-retirement returns. It provides a year-by-year breakdown plus animated charts that update as you change inputs.

## Features
- Timeline + life expectancy planning inputs
- Separate pre- and post-retirement returns
- Inflation-adjusted retirement spending
- Taxes applied to withdrawals
- Year-by-year table and animated charts

## Run locally
Open `index.html` in your browser. No build step required.

## Run tests
```
node --test
```
Requires Node 18+. Tests cover the projection math in `projection.js`.

## Project structure
- `index.html` — layout and UI
- `styles.css` — styling and theme
- `app.js` — input handling, table, and chart rendering
- `projection.js` — pure projection logic (shared with tests)
- `projection.test.js` — unit tests for the projection

## Notes
- Contributions are added at the end of each year, so they don't earn growth in the year they're made.
- Taxes apply only to withdrawals; withdrawals are grossed up so spending is met after tax.
- Social Security is modeled only during retirement. A start age earlier than the retirement age begins paying at retirement instead.
- The first year is prorated based on the current date.
