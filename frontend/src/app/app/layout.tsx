import { AppHeader } from "@/features/auth/components/app-header";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
