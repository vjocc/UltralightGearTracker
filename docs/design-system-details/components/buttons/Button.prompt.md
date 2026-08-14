Pill-shaped call-to-action button, the only button shape in the MemoFox brand — always fully rounded (100px), never square-cornered.

```jsx
<Button variant="primary" size="lg">Töltsd fel a videóid!</Button>
<Button variant="outline" size="md">Ismerd meg!</Button>
```

Variants: `primary` (solid purple, source) and `outline` (2px ink border, transparent, source — used for nav/secondary actions). `secondary` (orange fill) and `ghost` (no border) are intentional additions for cases the source didn't cover. Sizes `sm`/`md`/`lg` map to the 40/48/56px heights seen across the nav, card and hero CTAs.
