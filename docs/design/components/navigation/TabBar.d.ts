/**
 * The four-tab top navigation: Explore · Itinerary · Saved · Trip.
 */
export interface TabBarProps {
  tabs?: (string | { value: string; label: string })[];
  active?: string;
  onSelect?: (value: string) => void;
  style?: React.CSSProperties;
}
export declare function TabBar(props: TabBarProps): JSX.Element;

/** Sticky header combining the trip title with the TabBar. */
export interface AppHeaderProps extends TabBarProps { title: React.ReactNode }
export declare function AppHeader(props: AppHeaderProps): JSX.Element;
