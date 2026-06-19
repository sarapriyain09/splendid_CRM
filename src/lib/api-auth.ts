import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export type SessionUser = {
  id?: number | string;
  email?: string | null;
  role?: string;
};

export async function getSessionUser(): Promise<SessionUser | undefined> {
  const session = await getServerSession(authOptions);
  return session?.user as SessionUser | undefined;
}

export async function isAdminUser(): Promise<boolean> {
  const user = await getSessionUser();
  return Boolean(user?.email) && user?.role === 'admin';
}
