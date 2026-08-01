/** Modal day chooser opened by "+ Add to day" — the tap-to-assign replacement for drag-and-drop. */
export interface DayPickerProps {
  placeName: string;
  /** Trip dates, either ISO strings or { value, label } pairs. */
  dates?: (string | { value: string; label: string })[];
  onPick?: (date: string) => void;
  onCancel?: () => void;
  style?: React.CSSProperties;
}
export declare function DayPicker(props: DayPickerProps): JSX.Element;
