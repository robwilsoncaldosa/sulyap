import type { HTMLAttributes } from "react";
export function Inline({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`inline ${className}`} {...props} />;
}
