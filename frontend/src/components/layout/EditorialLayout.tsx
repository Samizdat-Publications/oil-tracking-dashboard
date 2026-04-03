import { useState, useEffect, type ReactNode } from 'react';

interface EditorialLayoutProps {
  children: ReactNode;
}

export function EditorialLayout({ children }: EditorialLayoutProps) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? scrollTop / docHeight : 0);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary relative">
      {/* Scroll progress bar */}
      <div
        className="scroll-progress"
        style={{ width: `${scrollProgress * 100}%` }}
      />

      {/* Ambient gradient mesh */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 40% 30% at 20% 20%, rgba(0, 240, 255, 0.015), transparent),
            radial-gradient(ellipse 30% 40% at 80% 80%, rgba(0, 255, 136, 0.01), transparent)
          `,
          backgroundSize: '200% 200%',
          animation: 'meshDrift 20s ease-in-out infinite',
        }}
      />

      {/* Page content — NO fixed max-width here, sections control their own widths */}
      <div className="relative z-10 flex flex-col gap-16">
        {children}
      </div>
    </div>
  );
}
