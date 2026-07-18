export type LineChartDatum = {
  date: string;
  pageviews: number;
  sessions: number;
};

export type LineChartPoint = {
  x: number;
  y: number;
};

export const LINE_CHART_DIMENSIONS = {
  width: 800,
  height: 260,
  padding: { top: 20, right: 20, bottom: 40, left: 52 },
} as const;

function pointX(index: number, count: number, left: number, plotWidth: number): number {
  if (count <= 1) return left + plotWidth / 2;
  return left + (index / (count - 1)) * plotWidth;
}

function pointsFor(
  values: number[],
  maxValue: number,
  left: number,
  top: number,
  plotWidth: number,
  plotHeight: number
): LineChartPoint[] {
  return values.map((value, index) => ({
    x: pointX(index, values.length, left, plotWidth),
    y: top + plotHeight - (value / maxValue) * plotHeight,
  }));
}

function buildLabelIndices(length: number, maxLabels = 6): number[] {
  if (length <= 0) return [];
  const count = Math.min(length, maxLabels);
  if (count === 1) return [0];
  return Array.from(
    new Set(
      Array.from({ length: count }, (_, index) =>
        Math.round((index / (count - 1)) * (length - 1))
      )
    )
  );
}

export function buildLineChartModel(data: LineChartDatum[]) {
  const { width, height, padding } = LINE_CHART_DIMENSIONS;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const pageviews = data.map((item) => item.pageviews);
  const sessions = data.map((item) => item.sessions);
  const observedMax = data.length > 0 ? Math.max(...pageviews, ...sessions) : 0;
  const maxValue = Math.max(1, observedMax * 1.15);

  return {
    maxValue,
    labelIndices: buildLabelIndices(data.length),
    pageviewPoints: pointsFor(
      pageviews,
      maxValue,
      padding.left,
      padding.top,
      plotWidth,
      plotHeight
    ),
    sessionPoints: pointsFor(
      sessions,
      maxValue,
      padding.left,
      padding.top,
      plotWidth,
      plotHeight
    ),
  };
}

export function serializeLineChartPoints(points: LineChartPoint[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}
