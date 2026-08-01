export type AuthCardProps = {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** The centred auth card used by login/register/forgot/reset. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-border bg-card p-7 shadow-card sm:p-8">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? (
        <div className="mt-5 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
