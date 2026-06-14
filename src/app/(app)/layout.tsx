import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Sidebar from "@/components/Sidebar";
import AiAssistantPopup from "@/components/AiAssistantPopup";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 min-w-0 bg-white text-slate-900">
        {children}
      </main>
      <AiAssistantPopup />
    </div>
  );
}
