import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivateForm } from "@/features/auth/components/activate-form";

export default function ActivatePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Activate your account</CardTitle>
          <CardDescription>Set a password to finish setting up your PFM account.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams (invite token) requires a Suspense boundary for static export */}
          <Suspense fallback={null}>
            <ActivateForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
