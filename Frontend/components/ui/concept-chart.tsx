import { useId } from "react";

type ConceptChartProps = { bars?: boolean } & (
  | { decorative: true; label?: never }
  | { decorative?: false; label: string }
);

// Fixed unscaled geometry is illustration, never an analytics series. SVG stays LTR.
function ConceptChart({ bars = false, label, decorative = false }: ConceptChartProps) {
  const id = useId();
  const line = "M12 125 C44 126 38 82 70 92 S110 141 140 107 S170 45 202 67 S243 111 275 77 S314 32 348 53 S389 89 428 28";

  return (
    <svg
      viewBox={bars ? "0 0 300 125" : "0 0 440 175"}
      className="my-3 block h-auto w-full"
      fill="none"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-labelledby={decorative ? undefined : `${id}-title`}
      focusable="false"
      direction="ltr"
    >
      {!decorative && <title id={`${id}-title`}>{label}</title>}
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--brand-blue)" stopOpacity=".2" />
          <stop offset="1" stopColor="var(--brand-purple)" stopOpacity=".01" />
        </linearGradient>
        <linearGradient id={`${id}-line`}>
          <stop stopColor="var(--brand-blue)" />
          <stop offset="1" stopColor="var(--brand-purple)" />
        </linearGradient>
      </defs>
      {bars ? (
        <>
          <path d="M4 115H296M4 65H296M4 15H296" stroke="var(--brand-muted)" strokeOpacity=".12" strokeDasharray="3 5" />
          {[48, 80, 62, 99, 71, 91, 54, 82].map((height, index) => (
            <rect key={index} x={12 + index * 36} y={115 - height} width="21" height={height} rx="5"
              fill={index % 3 === 0 ? "var(--brand-purple)" : "var(--brand-blue)"}
              opacity={index % 2 === 0 ? ".8" : ".4"} />
          ))}
        </>
      ) : (
        <>
          <path d="M12 30H428M12 70H428M12 110H428M12 150H428" stroke="var(--brand-muted)" strokeOpacity=".14" strokeDasharray="3 6" />
          <path d={`${line} L428 160H12Z`} fill={`url(#${id}-area)`} />
          <path d="M12 145 C66 119 81 161 130 136 S210 100 250 126 S335 99 370 118 S410 117 428 96" stroke="var(--brand-lilac)" strokeWidth="2" strokeDasharray="5 6" />
          <path d={line} stroke={`url(#${id}-line)`} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="275" cy="77" r="7" fill="var(--background)" stroke="var(--brand-purple)" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

export { ConceptChart };
