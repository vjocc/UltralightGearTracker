Content-display primitives — all intentional additions (the source has no cards/badges beyond the marketing sections it already composes by hand).

```jsx
<Card tone="dark" shadow="md" radius="xl"><Badge tone="purple">Új</Badge></Card>
<Avatar initials="KB" />
<Progress value={68} label="Feltöltés" />
<Stepper steps={['Rendeld meg','Töltsd fel','Ünnepelj']} current={1} />
```

`Card` tones mirror the three real card fills seen on the homepage: `light` (peach, content sections), `white`, and `dark` (brand-900, the step cards). `Stepper` reuses the CircleWavyCheck-style checkmark for completed steps.
