import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";

export default function DashboardPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href={ROUTES.users}>
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Invite new users and manage existing accounts.</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}
