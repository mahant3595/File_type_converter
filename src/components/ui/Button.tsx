import * as React from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Violet fill with near-black label (≈4.7:1 contrast on #8b5cf6)
  primary:
    "bg-accent text-background hover:bg-accent-hover border border-transparent font-semibold",
  secondary:
    "bg-elevated text-foreground border border-border hover:border-border-strong hover:bg-accent/10",
  ghost: "bg-transparent text-muted border border-transparent hover:text-foreground hover:bg-elevated",
  danger: "bg-transparent text-error border border-error/40 hover:bg-error/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-control gap-1.5",
  md: "h-11 px-5 text-sm rounded-control gap-2",
  lg: "h-12 px-6 text-base rounded-[14px] gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = ""): string {
  return `inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />
  );
});

/** Link styled as a button (navigation actions). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
