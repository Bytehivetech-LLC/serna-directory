import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.1em] text-violet">
        404
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold text-ink sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Back to the directory</Link>
      </Button>
    </div>
  );
}
