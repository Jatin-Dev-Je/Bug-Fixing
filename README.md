# Task ROI Manager (Bug Fixes Challenge)

A responsive Task Management app for sales teams to track ROI. Built with React + TypeScript + Vite. No backend; data persists in LocalStorage. CSV import/export included.

## Features
- Add, edit, delete tasks (with view dialog)
- Undo delete via snackbar
- Search and filter by priority and status
- ROI calculation: Revenue ÷ Time Taken
- Sort by ROI desc, then Priority (High > Medium > Low), then Title asc (stable)
- Summary: Total Revenue, Efficiency, Average ROI, Performance Grade
- CSV import/export
- LocalStorage persistence

## Bug Fixes Implemented
1) Double Fetch on page load
   - Guarded data initialization with a ref in a mount-only effect to be StrictMode-safe (runs once in dev/prod).

2) Undo Snackbar state leak
   - Clears lastDeleted task and snackbar flag on close (auto or manual) to prevent phantom restores.

3) Unstable sorting (ROI ties)
   - Added deterministic tie-breaker by Title asc, then createdAt desc.

4) Double Dialog opening (bubbling)
   - Stopped event propagation on Edit/Delete buttons; row click opens only View dialog.

5) ROI validation/formatting issues
   - Safe ROI: if time ≤ 0 or invalid -> ROI = 0 and displayed as "—" in readouts. No NaN/Infinity.
   - Consistent formatting (2 decimals) and currency formatting with Intl.

## Tech/Code Quality
- TypeScript strict mode, type-only imports (verbatimModuleSyntax compliant)
- Pure functions for numeric logic (`src/utils/number.ts`)
- Domain types in `src/types.ts`
- Accessible modals and semantics; responsive layout
- ESLint configured; Vite build verified

## Run locally

```powershell
cd frontend
npm install
npm run dev
```

## Build

```powershell
npm run build
npm run preview
```

## Deploy

- Vercel/Netlify: deploy the `frontend` directory as a static site. The `dist` folder is produced by `npm run build`.

## Sorting Logic

1) ROI desc
2) Priority desc (High > Medium > Low)
3) Title asc (stable)
4) createdAt desc as a final tiebreaker

