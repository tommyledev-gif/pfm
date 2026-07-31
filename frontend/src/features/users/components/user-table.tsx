import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { User } from "@/features/users/types";

interface UserTableProps {
  users: User[];
}

export function UserTable({ users }: UserTableProps) {
  if (users.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No users yet — invite one to get started.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invited</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.email}</TableCell>
            <TableCell className="capitalize">{user.role}</TableCell>
            <TableCell>
              <StatusBadge status={user.status} />
            </TableCell>
            <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatusBadge({ status }: { status: User["status"] }) {
  const variant = status === "active" ? "default" : status === "disabled" ? "destructive" : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}
