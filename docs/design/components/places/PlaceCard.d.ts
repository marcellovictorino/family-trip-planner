import * as React from "react";

export interface Place {
  id: string; name: string;
  kind: "attraction" | "playground" | "restaurant";
  category?: string; neighbourhood?: string;
  description?: string; duration_minutes?: number;
  price_band?: "free" | "€" | "€€" | "€€€";
  booking?: "none" | "recommended" | "required";
  booking_url?: string | null; website?: string | null; maps_url?: string | null;
  setting?: "indoor" | "outdoor" | "mixed";
  baby_friendly?: boolean; stroller?: boolean; baby_notes?: string;
  gluten_free?: "none" | "limited" | "good";
  nearest_metro?: string; tips?: string; best_time?: string;
}

/**
 * The one card the whole product is built on — collapsed summary, expands in place.
 */
export interface PlaceCardProps {
  place: Place;
  /** Expanded state. */
  open?: boolean;
  /** Struck-through name when the family has already been. */
  visited?: boolean;
  onToggle?: React.ReactEventHandler<HTMLElement>;
  /** Buttons rendered at the bottom of the expanded detail. */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function PlaceCard(props: PlaceCardProps): JSX.Element;
/** "45 min" · "2h" · "4h30" from minutes. */
export declare function durationLabel(minutes: number): string;
