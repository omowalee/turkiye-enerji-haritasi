import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[#1E293B] bg-[#151F32] text-[#F8FAFC]",
        live:
          "border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]",
        playback:
          "border-[#38BDF8]/40 bg-[#38BDF8]/12 text-[#38BDF8]",
        warning:
          "border-[#F59E0B]/50 bg-[#451A03]/80 text-[#F59E0B]",
        error:
          "border-[#F87171]/50 bg-[#450A0A]/80 text-[#F87171]",
        outline:
          "border-[#334155] bg-transparent text-[#94A3B8]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
