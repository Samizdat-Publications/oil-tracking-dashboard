import { useRef, useEffect, useCallback, memo, type CSSProperties } from 'react';
import React from 'react';

// Lazy-load Plotly to avoid SSR/import issues
let PlotlyLib: any = null;
const plotlyReady = import('plotly.js-dist-min').then((mod) => {
  PlotlyLib = mod.default || mod;
});

interface PlotProps {
  data: any[];
  layout?: any;
  config?: any;
  style?: CSSProperties;
  useResizeHandler?: boolean;
}

function PlotComponent({ data, layout, config, style, useResizeHandler }: PlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotted = useRef(false);

  const doPlot = useCallback(async () => {
    if (!containerRef.current) return;
    await plotlyReady;
    if (!PlotlyLib || !containerRef.current) return;

    if (plotted.current) {
      PlotlyLib.react(containerRef.current, data, layout || {}, config || {});
    } else {
      PlotlyLib.newPlot(containerRef.current, data, layout || {}, config || {});
      plotted.current = true;
    }
  }, [data, layout, config]);

  useEffect(() => {
    doPlot();
  }, [doPlot]);

  useEffect(() => {
    if (!useResizeHandler) return;
    const obs = new ResizeObserver(() => {
      if (containerRef.current && PlotlyLib) {
        PlotlyLib.Plots.resize(containerRef.current);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [useResizeHandler]);

  useEffect(() => {
    return () => {
      if (containerRef.current && PlotlyLib) {
        PlotlyLib.purge(containerRef.current);
      }
    };
  }, []);

  return React.createElement('div', { ref: containerRef, style: style || {} });
}

const Plot = memo(PlotComponent);
export default Plot;
