// Recharts accepts CSS variables in SVG attributes, so charts follow the active theme.
export const color = (token) => `rgb(var(--${token}))`;

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: color('faint'), fontSize: 11 },
};

export const gridProps = {
  vertical: false,
  stroke: color('line'),
};
