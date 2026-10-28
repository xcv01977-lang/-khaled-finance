"use client";

import AuthGate from "./AuthGate";
import Home from "./Home";
import { FinanceProvider } from "@/hooks/useFinance";

export default function AppRoot() {
  return (
    <AuthGate>
      <FinanceProvider>
        <Home />
      </FinanceProvider>
    </AuthGate>
  );
}
