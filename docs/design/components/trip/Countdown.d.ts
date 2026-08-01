/**
 * The trip countdown card: big number before the trip, a glyph during and after it.
 */
export interface CountdownProps {
  /** "12" before the trip, "🎉" during, "🏠" after. */
  headline: React.ReactNode;
  /** e.g. "days to Copenhagen". */
  caption: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Countdown(props: CountdownProps): JSX.Element;
