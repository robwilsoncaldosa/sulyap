import type { HTMLAttributes } from "react";
export function Stack({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`stack ${className}`} {...props} />;
}
