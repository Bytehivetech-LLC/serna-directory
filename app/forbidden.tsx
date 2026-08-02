import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Rendered by forbidden() — a 403 for signed-in users who lack access. */
export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.1em] text-violet">
        403
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
        You don&apos;t have access
      </h1>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        Your account isn&apos;t permitted to view this page. If you think this is
        a mistake, contact an administrator.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Back to the directory</Link>
      </Button>
    </div>
  );
}
