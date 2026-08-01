"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function SubmitButton({
  children,
  pending,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(className)}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Please wait…
        </>
      ) : (
        children
      )}
    </Button>
  );
}
