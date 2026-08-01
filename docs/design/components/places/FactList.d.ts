/** Two-column term/value grid for the hard facts inside a place card. */
export interface FactListProps {
  /** Pairs of [term, value], e.g. [["Metro", "Nørreport"]]. */
  items?: [string, React.ReactNode][];
  style?: React.CSSProperties;
}
export declare function FactList(props: FactListProps): JSX.Element;
