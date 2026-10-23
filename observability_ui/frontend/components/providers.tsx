"use client";

import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 15000 }}>
        {children}
      </SWRConfig>
    </ThemeProvider>
  );
}
