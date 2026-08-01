/** A single facility glyph (baby space, pram, shelter, gluten-free, booking) with its accessible label. */
export interface FacilityIconProps {
  facility: "baby" | "stroller" | "indoor" | "mixed" | "glutenFree" | "booking" | "kidsMenu" | "highChair";
  style?: React.CSSProperties;
}
export declare function FacilityIcon(props: FacilityIconProps): JSX.Element | null;

/** Row of facility glyphs shown in a card summary. */
export interface FacilityRowProps { facilities?: FacilityIconProps["facility"][]; style?: React.CSSProperties }
export declare function FacilityRow(props: FacilityRowProps): JSX.Element;
