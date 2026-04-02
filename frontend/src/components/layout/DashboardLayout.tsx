import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary relative">
      {/* Ambient gradient mesh */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 40% 30% at 20% 20%, rgba(0, 240, 255, 0.015), transparent),
            radial-gradient(ellipse 30% 40% at 80% 80%, rgba(0, 255, 136, 0.01), transparent),
            radial-gradient(ellipse 50% 20% at 50% 50%, rgba(0, 240, 255, 0.008), transparent)
          `,
          backgroundSize: '200% 200%',
          animation: 'meshDrift 20s ease-in-out infinite',
        }}
      />
      <div className="relative z-10 mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-6 space-y-4">
        {children}
      </div>
    </div>
  );
}
