"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * App-wide toast host. The directory is a single (light) theme, so we pin
 * "light" rather than pull in next-themes, and style toasts with brand tokens.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-card group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground",
          success: "group-[.toaster]:text-good",
          error: "group-[.toaster]:text-danger",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
