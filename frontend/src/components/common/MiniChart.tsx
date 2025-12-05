type MiniChartProps = {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
};

export const MiniChart = ({
  // Grafico de lineas minimalista para indicadores rapidos
  data,
  color = '#0077cc',
  height = 48,
  className,
}: MiniChartProps) => {
  if (!data.length) {
    return <div className={className}>-</div>;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * 100;
      const y = max === min ? 50 : ((max - value) / (max - min)) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
      height={height}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
