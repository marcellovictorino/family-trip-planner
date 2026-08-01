import * as React from "react";

/**
 * Tap-target button used for every card action, dialog choice and backup control.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. `quiet` is the default card action. */
  variant?: "quiet" | "primary" | "filled" | "ghost";
  /** Toggle state; renders the filled accent treatment and sets aria-pressed. */
  pressed?: boolean;
  /** Leading glyph (emoji or unicode mark). */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
