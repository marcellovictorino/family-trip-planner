/** A single counted fact on the Trip tab (visited, favourites, planned stops, notes). */
export interface StatProps { value: React.ReactNode; label: string; style?: React.CSSProperties }
export declare function Stat(props: StatProps): JSX.Element;

/** Two-column grid holding the trip stats. */
export interface StatGridProps { children?: React.ReactNode; style?: React.CSSProperties }
export declare function StatGrid(props: StatGridProps): JSX.Element;
