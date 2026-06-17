type IconProps = {
  size: number;
};

export function TenderTrackerIcon({ size }: IconProps) {
  const pad = size * 0.11;
  const cardX = pad * 1.15;
  const cardY = pad * 0.95;
  const cardW = size - cardX * 2;
  const cardH = size - cardY * 2;
  const ring = size * 0.07;
  const calTop = cardY + size * 0.13;
  const lineX = cardX + size * 0.11;
  const lineW = size * 0.36;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #f4f8f4 0%, #e7f0e8 100%)"
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x={pad * 0.45} y={pad * 0.45} width={size - pad * 0.9} height={size - pad * 0.9} rx={size * 0.2} fill="#103222" />
        <rect x={cardX} y={cardY} width={cardW} height={cardH} rx={size * 0.1} fill="#F8FAF8" />
        <rect x={cardX} y={cardY} width={cardW} height={size * 0.18} rx={size * 0.1} fill="#166534" />
        <rect x={cardX} y={cardY + size * 0.1} width={cardW} height={size * 0.08} fill="#166534" />
        <circle cx={cardX + size * 0.18} cy={cardY + size * 0.09} r={ring} fill="#F8FAF8" />
        <circle cx={cardX + size * 0.43} cy={cardY + size * 0.09} r={ring} fill="#F8FAF8" />
        <rect x={lineX} y={calTop} width={lineW} height={size * 0.045} rx={size * 0.022} fill="#CBD5E1" />
        <rect x={lineX} y={calTop + size * 0.09} width={lineW * 0.82} height={size * 0.045} rx={size * 0.022} fill="#CBD5E1" />
        <rect x={lineX} y={calTop + size * 0.18} width={lineW * 0.58} height={size * 0.045} rx={size * 0.022} fill="#CBD5E1" />
        <path
          d={`M ${cardX + size * 0.23} ${cardY + size * 0.66} L ${cardX + size * 0.34} ${cardY + size * 0.77} L ${cardX + size * 0.59} ${cardY + size * 0.5} L ${cardX + size * 0.72} ${cardY + size * 0.62}`}
          stroke="#D97706"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={cardX + size * 0.23} cy={cardY + size * 0.66} r={size * 0.04} fill="#DC2626" />
        <circle cx={cardX + size * 0.34} cy={cardY + size * 0.77} r={size * 0.04} fill="#D97706" />
        <circle cx={cardX + size * 0.59} cy={cardY + size * 0.5} r={size * 0.04} fill="#166534" />
        <circle cx={cardX + size * 0.72} cy={cardY + size * 0.62} r={size * 0.04} fill="#2563EB" />
      </svg>
    </div>
  );
}

