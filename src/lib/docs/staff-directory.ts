import 'server-only';
import { prisma } from '@/lib/prisma';
import type { StaffDirectory, StaffIdentity } from './database';

const select = { id: true, name: true, email: true, isActive: true,
  staffRole: { select: { name: true, permissions: true, screens: true } },
} as const;
function identity(user: { id: string; name: string; email: string; isActive: boolean;
  staffRole: { name: string; permissions: string[]; screens: string[] } | null;
}): StaffIdentity {
  return { id: user.id, name: user.name, email: user.email,
    active: user.isActive && !!user.staffRole, role: user.staffRole?.name ?? '',
    permissions: user.staffRole?.permissions ?? [], screens: user.staffRole?.screens ?? [],
  };
}
// No persisted permission copy or cross-request cache: revocation remains live.
// Passwords and parent/swimmer records never enter the Docs database.
export const staffDirectory: StaffDirectory = {
  async find(id) { const user = await prisma.user.findUnique({ where: { id }, select }); return user ? identity(user) : null; },
  async list() { return (await prisma.user.findMany({ select, orderBy: { name: 'asc' } })).map(identity); },
};
