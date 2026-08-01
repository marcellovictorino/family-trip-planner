/** Day / section heading with an optional muted meta line ("3 stops · 4h30"). */
export interface SectionHeadingProps {
  children?: React.ReactNode;
  /** Muted secondary text set on the same baseline. */
  meta?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  style?: React.CSSProperties;
}
export declare function SectionHeading(props: SectionHeadingProps): JSX.Element;
