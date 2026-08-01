import * as React from "react";

/** The single Explore search box — matches name, tags, description, category, neighbourhood and metro. */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  placeholder?: string;
}
export declare function SearchField(props: SearchFieldProps): JSX.Element;
