"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteUserMutation } from "@/features/users/api/use-invite-user-mutation";
import type { UserRole } from "@/lib/constants";

const DEFAULT_ROLE: UserRole = "member";

export function InviteUserDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(DEFAULT_ROLE);

  const { mutate: inviteUser, isPending, error, isSuccess, reset } = useInviteUserMutation();

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) {
      setEmail("");
      setRole(DEFAULT_ROLE);
      reset();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    inviteUser({ email, role });
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
          <DialogDescription>
            An activation email with a sign-up link is sent to this address via SMTP.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message="Could not send the invite. Check the email and try again." />}
        {isSuccess && (
          <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
            Invite sent — activation email dispatched to {email}.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending invite..." : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
