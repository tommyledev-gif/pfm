"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActivateMutation } from "@/features/auth/api/use-activate";
import { MIN_PASSWORD_LENGTH, ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

export function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const setUserEmail = useAuthStore((s) => s.setUserEmail);

  const token = searchParams.get("token") ?? "";

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const { mutate: activate, isPending, error } = useActivateMutation();

  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    activate(
      { token, full_name: fullName || undefined, password, password_confirm: passwordConfirm },
      {
        onSuccess: (result) => {
          if (!result.success) return;
          // Same cross-account cache leak as login-form.tsx — activation
          // logs the user straight into a session too.
          queryClient.clear();
          if (result.email) setUserEmail(result.email);
          router.push(ROUTES.app);
          router.refresh();
        },
      },
    );
  }

  if (!token) {
    return <ErrorBanner message="This activation link is missing its token. Use the link from your invite email." />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message="Could not activate this account. The link may have expired." />}

      <div className="space-y-2">
        <Label htmlFor="full-name">Full name</Label>
        <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {passwordTooShort && (
          <p className="text-xs text-destructive">Password must be at least {MIN_PASSWORD_LENGTH} characters.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password-confirm">Confirm password</Label>
        <Input
          id="password-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
        {passwordsMismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || passwordsMismatch || passwordTooShort || password.length === 0}
      >
        {isPending ? "Activating..." : "Activate account"}
      </Button>
    </form>
  );
}
