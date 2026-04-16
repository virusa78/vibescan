import { ReactNode } from "react";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="from-card/90 to-card/70 border-border/70 rounded-2xl border bg-gradient-to-b px-5 py-8 shadow-2xl shadow-black/20 backdrop-blur-sm sm:px-10">
          <div className="-mt-8 text-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
