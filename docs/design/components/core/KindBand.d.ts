/** Category pill at the top of a place card — the colour band that replaces photography. */
export interface KindBandProps {
  kind?: "attraction" | "playground" | "restaurant";
  /** Category text, e.g. "theme-park". Defaults to the kind. */
  label?: string;
  style?: React.CSSProperties;
}
export declare function KindBand(props: KindBandProps): JSX.Element;
