Form primitives, all intentional additions — the Figma source defines no input components, only marketing surfaces. Styled to match the source's rounded, warm-neutral cards: `--radius-sm` corners, 1.5px `--color-border`, `--accent-purple` for checked/focus states.

```jsx
<Input label="E-mail" placeholder="nev@example.com" />
<Select label="Videó hossza" options={['1 perc', '3 perc', '5 perc']} />
<Checkbox label="Elfogadom a feltételeket" checked />
<Switch label="Értesítések" checked />
```

Includes Input, Textarea, Select, Checkbox, Radio, Switch. All use Plus Jakarta Sans body text and disabled = 0.5 opacity, consistent with the button component.
