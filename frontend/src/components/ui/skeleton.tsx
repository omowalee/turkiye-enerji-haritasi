import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[#151F32] border border-[#1E293B]/60",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
