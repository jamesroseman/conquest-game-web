import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-ocean-deep hover:bg-amber-400 focus:ring-amber-300 disabled:bg-amber-700 disabled:text-amber-300",
  secondary:
    "bg-slate-700 text-parchment hover:bg-slate-600 focus:ring-slate-400 disabled:bg-slate-800 disabled:text-slate-500",
  ghost:
    "bg-transparent text-parchment border border-parchment/30 hover:bg-parchment/10 focus:ring-parchment/40",
  danger:
    "bg-red-600 text-white hover:bg-red-500 focus:ring-red-300 disabled:bg-red-900 disabled:text-red-300",
};

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}
