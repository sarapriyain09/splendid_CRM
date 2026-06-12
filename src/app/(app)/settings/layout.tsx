import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isDemoMode } from '@/lib/app-mode';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (isDemoMode() || role !== 'admin') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}