"use client";

import type { HTMLAttributes } from "react";
import type { ResizableHandleProps } from "./useResizable";

export interface ResizeHandleProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  handleProps: ResizableHandleProps;
  /** Accessible name for the separator, e.g. "Resize left navigation". */
  label: string;
}

// Generic WAI-ARIA "window splitter" handle. Renders no domain content —
// wire it to useResizable's handleProps and style it at the call site.
export function ResizeHandle({ handleProps, label, ...rest }: ResizeHandleProps) {
  return <div aria-label={label} {...handleProps} {...rest} />;
}
