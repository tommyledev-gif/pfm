"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

export function AppHeader() {
  const router = useRouter();
  const userEmail = useAuthStore((s) => s.userEmail);
  const clearUser = useAuthStore((s) => s.clear);

  async function handleLogout() {
    await axios.post("/api/auth/logout");
    clearUser();
    router.push(ROUTES.login);
    router.refresh();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href={ROUTES.app}>PFM</Link>
          <Link href={ROUTES.users} className="text-muted-foreground hover:text-foreground">
            Users
          </Link>
          <Link href={ROUTES.wallets} className="text-muted-foreground hover:text-foreground">
            Wallets
          </Link>
          <Link href={ROUTES.categories} className="text-muted-foreground hover:text-foreground">
            Categories
          </Link>
          <Link href={ROUTES.budgets} className="text-muted-foreground hover:text-foreground">
            Budgets
          </Link>
          <Link href={ROUTES.transactions} className="text-muted-foreground hover:text-foreground">
            Transactions
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {userEmail && <span>{userEmail}</span>}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
