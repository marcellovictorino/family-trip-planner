/** Compact row in the Saved tab: name, neighbourhood, and the two state toggles. */
export interface SavedItemProps {
  name: string; meta?: React.ReactNode;
  favourite?: boolean; visited?: boolean;
  onFavourite?: () => void; onVisited?: () => void;
  style?: React.CSSProperties;
}
export declare function SavedItem(props: SavedItemProps): JSX.Element;
