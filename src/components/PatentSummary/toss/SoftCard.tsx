
export function SoftCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bp-panel p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

