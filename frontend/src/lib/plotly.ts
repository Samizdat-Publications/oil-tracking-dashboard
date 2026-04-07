import { useRef, useEffect, useCallback, memo, type CSSProperties } from 'react';
import React from 'react';

// Lazy-load Plotly — deferred until first chart mount (not module parse time)
let PlotlyLib: any = null;
let plotlyPromise: Promise<void> | null = null;

function ensurePlotly(): Promise<void> {
  if (PlotlyLib) return Promise.resolve();
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-dist-min').then((mod) => {
      PlotlyLib = mod.default || mod;
    });
  }
  return plotlyPromise;
}

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
    await ensurePlotly();
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
