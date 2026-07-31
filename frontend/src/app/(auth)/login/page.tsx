import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>PFM</CardTitle>
          <CardDescription>Sign in to Personal Finance Management</CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams (redirect target) requires a Suspense boundary for static export */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
