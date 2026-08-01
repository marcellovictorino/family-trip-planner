/** One planned stop inside a day, with up/down reorder controls and a remove button. */
export interface DayItemProps {
  name: string;
  /** Muted secondary line, e.g. "Indre By · 4h". */
  meta?: React.ReactNode;
  /** Disables the up control. */
  first?: boolean;
  /** Disables the down control. */
  last?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  style?: React.CSSProperties;
}
export declare function DayItem(props: DayItemProps): JSX.Element;
