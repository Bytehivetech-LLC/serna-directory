import { requireUser, getProfile } from "@/lib/auth/guards";
import { PageContainer } from "@/components/layout/page-container";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Gate the whole dashboard. Every action re-checks too — a layout guard alone
  // is not sufficient.
  const user = await requireUser();
  const profile = await getProfile();
  const name =
    profile?.full_name ??
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null);

  return (
    <PageContainer className="py-8">
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <aside className="shrink-0 md:w-56">
          <DashboardSidebar avatarUrl={profile?.avatar_url ?? null} name={name} email={user.email ?? null} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageContainer>
  );
}
