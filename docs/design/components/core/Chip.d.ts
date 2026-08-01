import * as React from "react";

/** A single filter toggle in the Explore controls. Tapping an active chip clears it. */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected state — fills with the accent and sets aria-pressed. */
  pressed?: boolean;
  /** Dashed border, reserved for the "Clear N" reset chip. */
  dashed?: boolean;
  children?: React.ReactNode;
}
export declare function Chip(props: ChipProps): JSX.Element;

/** Wrapping flex row that lays out chips with the standard 0.4rem gap. */
export interface ChipRowProps { children?: React.ReactNode; style?: React.CSSProperties }
export declare function ChipRow(props: ChipRowProps): JSX.Element;
