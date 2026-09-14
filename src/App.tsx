import { AdminPanel } from "@/components/AdminPanel";
import { Portfolio } from "@/components/Portfolio";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/admin" ? <AdminPanel /> : <Portfolio />;
}
