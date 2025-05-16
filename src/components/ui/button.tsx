import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Add global CSS to force buttons to be opaque
if (typeof document !== 'undefined') {
  const styleId = 'force-button-opacity-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      button[data-slot="button"],
      a[data-slot="button"] {
        opacity: 1 !important;
        filter: none !important;
      }
      .my-forced-opaque-button {
        opacity: 1 !important;
        background-color: var(--primary) !important; /* Use primary color for CTA */
        color: var(--primary-foreground) !important; /* Text color for primary CTA */
        padding: 0.75rem 1.5rem !important; /* Larger padding */
        border-radius: 0.5rem !important; /* More rounded corners */
        box-shadow: 0 2px 8px 0 rgba(0, 118, 255, 0.30) !important; /* Standard pop-out shadow */
        font-weight: 600 !important; /* Bolder text */
        z-index: 1 !important; /* Very low to sit beneath banners/overlays */
        transition: transform 0.2s ease-out, box-shadow 0.2s ease-out !important;
      }
      .my-forced-opaque-button.super-cta-button {
        box-shadow: 0 6px 20px 0 rgba(0, 118, 255, 0.45) !important; /* More pronounced shadow */
      }
      .my-forced-opaque-button.super-cta-button:hover {
        transform: scale(1.03) !important;
        box-shadow: 0 8px 25px 0 rgba(0, 118, 255, 0.5) !important; /* Even stronger shadow on hover */
      }
      /* Dull CTA version - for "Create Form First" */
      .my-forced-opaque-button.dull-cta-button {
        background-color: transparent !important; /* Almost invisible background */
        color: var(--muted-foreground) !important; /* Very muted text */
        box-shadow: none !important; /* No shadow */
        border: 1px dashed var(--muted) !important; /* Subtle dashed border */
        opacity: 0.7 !important; /* Further reduce visibility */
        font-weight: normal !important; /* Remove bold text */
        padding: 0.5rem 1rem !important; /* Smaller padding */
      }
      .my-forced-opaque-button.dull-cta-button:hover {
        background-color: var(--muted) !important; /* Just barely visible on hover */
        color: var(--foreground) !important; /* Only slightly more contrast on hover */
        opacity: 0.9 !important; /* Slightly more visible on hover */
        border-style: solid !important; /* More solid on hover */
      }
      /* Ensure children of the button are also fully opaque if they inherit opacity */
      .my-forced-opaque-button > * {
        opacity: 1 !important;
        filter: none !important; /* Also try to reset filter if it causes transparency */
        color: inherit !important; /* Inherit color from parent button */
      }
    `;
    document.head.appendChild(style);
  }
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
