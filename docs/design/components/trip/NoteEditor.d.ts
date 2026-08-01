/** Free-text note attached to a place; commits on blur so a re-render never interrupts typing. */
export interface NoteEditorProps {
  id: string; placeName: string;
  defaultValue?: string; placeholder?: string;
  onCommit?: (text: string) => void;
  style?: React.CSSProperties;
}
export declare function NoteEditor(props: NoteEditorProps): JSX.Element;
