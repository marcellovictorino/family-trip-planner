One-line: the two-row note field in the Saved tab, labelled with the place name.

```jsx
<NoteEditor id="note-tivoli" placeName="Tivoli Gardens" defaultValue="buy tickets Sunday night" onCommit={save} />
```

Commit on blur, never per keystroke. Every note lives in one place (Saved) so nothing is lost in a card the family forgot to expand.
