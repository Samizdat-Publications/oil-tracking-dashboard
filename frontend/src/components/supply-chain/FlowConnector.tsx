export function FlowConnector() {
  return (
    <div className="relative h-[60px] flex items-center justify-center">
      {/* Vertical trunk */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-[2px]"
        style={{ background: 'linear-gradient(to bottom, rgba(0,240,255,0.4), rgba(0,240,255,0.1))' }}
      />

      {/* Animated particles */}
      <div className="absolute top-0 left-1/2 w-[2px] h-full overflow-hidden">
        {[0, 0.6, 1.2].map((delay) => (
          <div
            key={delay}
            className="absolute w-1 h-1 -left-[1px] rounded-full bg-accent animate-flow-down"
            style={{
              boxShadow: '0 0 8px #00F0FF',
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span className="relative z-[2] bg-background px-3 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase text-text-secondary">
        price pressure flows downstream
      </span>
    </div>
  );
}
