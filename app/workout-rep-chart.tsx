"use client";

import { useId, useMemo, useState } from 'react';
import { ArrowDown, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { durationLabel, numberLabel, repDistance } from './activity-metrics';
import { hillRepMetrics, type HillRepMetrics } from './workout-hill-rep-data';
import { isUphillRep, type WorkoutBlock, type WorkoutBlockRep } from './workout-blocks-data';
import { repChartData, type RepChartAnalysis, type RepChartSeries } from './workout-rep-chart-data';
import './workout-rep-chart.css';

type Props = {
  block: WorkoutBlock;
  analysis: RepChartAnalysis;
  family: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  aligned: boolean;
  onViewTimeline: () => void;
};

type Domain = [number, number];
const plotHeight = 112;
const repWidth = 32;
const mixedRepMinWidth = 20;
const noOverlay = 'none';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function tickStep(size: number) {
  if (!finite(size) || size <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(size));
  const fraction = size / magnitude;
  return (fraction <= 1.5 ? 1 : fraction <= 3 ? 2 : fraction <= 7 ? 5 : 10) * magnitude;
}

function baseDomain(series: RepChartSeries): Domain {
  const max = Math.max(0, ...series.values.filter(finite));
  const step = tickStep(max / 4);
  return [0, Math.max(step, Math.ceil(max / step) * step)];
}

function overlayDomain(series: RepChartSeries): Domain {
  const values = series.values.filter(finite);
  if (!values.length) return [0, 1];
  const samples = series.includeZero ? [...values, 0] : values;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const pad = Math.max((max - min) * .1, Math.abs(max) * .02, series.includeZero ? 2 : .15);
  const step = tickStep((max - min + 2 * pad) / 4);
  const low = Math.floor((min - pad) / step) * step;
  const high = Math.ceil((max + pad) / step) * step;
  return [!series.includeZero && min >= 0 ? Math.max(0, low) : low, high];
}

function position(value: number, [low, high]: Domain) {
  return Math.max(0, Math.min(1, (value - low) / (high - low)));
}

function overlayPath(values: RepChartSeries['values'], domain: Domain) {
  return values.map((value, index) => {
    if (!finite(value)) return '';
    const command = finite(values[index - 1]) ? 'L' : 'M';
    return `${command}${(index + .5) * repWidth},${(1 - position(value, domain)) * plotHeight}`;
  }).join(' ');
}

function axisLabel(series: RepChartSeries, value: number) {
  const format = series.axisFormat ?? ((value: number) => Math.round(value).toLocaleString('en-GB'));
  return `${series.includeZero && value > 0 ? '+' : ''}${format(value).replace('-', '−')}`;
}

function reading(series: RepChartSeries, index: number, rep: WorkoutBlockRep) {
  const value = series.values[index];
  const unit = series.readoutUnit ?? series.unit;
  const estimated = finite(value) && (series.key === 'netGrade'
    ? rep.ascentSource === 'estimated' || rep.descentSource === 'estimated'
    : series.key === 'ascent' || series.key === 'climbRate' ? rep.ascentSource === 'estimated' : series.estimated);
  return {
    label: series.key === 'speed' && unit.startsWith('/') ? 'Pace' : series.label,
    value: finite(value) ? series.format(value) : null,
    unit,
    estimated,
  };
}

type ScaleProps = { series: RepChartSeries; domain: Domain; kind: 'bars' | 'line' };

function ChartKey({ series, domain, kind }: ScaleProps) {
  return (
    <div className="workout-rep-chart-key" data-kind={kind}>
      <i aria-hidden="true" />
      <span>{series.label} <small>{series.unit}{series.estimated && ' · est.'}</small></span>
      <span className="sr-only">({kind}, scale {axisLabel(series, domain[0])} to {axisLabel(series, domain[1])})</span>
    </div>
  );
}

function ChartAxis({ series, domain, kind }: ScaleProps) {
  const [low, high] = domain;
  const middle = series.includeZero ? 0 : (low + high) / 2;
  const placement = position(middle, domain);
  const ticks = [
    ...(placement > .15 ? [low] : []),
    middle,
    ...(placement < .85 ? [high] : []),
  ];

  return (
    <div className="workout-rep-chart-axis" data-kind={kind} aria-hidden="true">
      {ticks.map(value => (
        <span className="workout-rep-chart-tick" key={value} data-zero={series.includeZero && value === 0 || undefined}
          style={{ bottom: `${position(value, domain) * 100}%` }}>
          {axisLabel(series, value)}
        </span>
      ))}
    </div>
  );
}

function HillMechanics({ hill, overlay }: { hill: HillRepMetrics; overlay?: string }) {
  const readings = [
    { key: 'stepLength', label: 'Step length', value: hill.stepLength, unit: 'cm' },
    { key: 'cadence', label: 'Cadence', value: hill.cadence, unit: 'spm' },
    { key: 'groundContactTime', label: 'Ground contact', value: hill.groundContactTime, unit: 'ms' },
  ].filter(item => item.key !== overlay && (item.value !== null || item.key === 'stepLength'));
  return readings.length ? (
    <dl className="workout-rep-hill-mechanics" aria-label="Hill rep mechanics" aria-live="polite">
      {readings.map(item => (
        <div key={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.value === null ? <span aria-label="Unavailable">—</span> : <>{numberLabel(item.value)} <small>{item.unit}</small></>}</dd>
        </div>
      ))}
    </dl>
  ) : null;
}

export default function WorkoutRepChart({ block, analysis, family, selectedIndex, onSelect, aligned, onViewTimeline }: Props) {
  const headingId = useId();
  const pickerId = `${headingId}-overlay`;
  const [choice, setChoice] = useState<string | null>(null);
  const { base, overlays } = useMemo(() => repChartData(block, analysis, family), [block, analysis, family]);
  const hillOverlay = block.kind === 'uphill' && family === 'running' ? overlays.find(series => series.key === 'stepLength') : undefined;
  const suggested = hillOverlay ?? (block.format !== 'mixed' ? overlays.find(series => series.key === 'beatsPerKm') : undefined)
    ?? overlays.find(series => series.key === 'heartrate')
    ?? overlays[0];
  const overlay = choice === noOverlay ? null : overlays.find(series => series.key === choice) ?? suggested ?? null;
  const baseScale = baseDomain(base);
  const lineScale = overlay ? overlayDomain(overlay) : null;
  const selectedPosition = analysis.reps.findIndex(rep => rep.index === selectedIndex);
  const selected = analysis.reps[selectedPosition];
  const hill = selected && family === 'running' ? hillRepMetrics(selected) : null;
  const selectedReadings = selected ? [base, overlay].flatMap(series => series ? [reading(series, selectedPosition, selected)] : []) : [];
  const showDuration = selected && base.key !== 'duration' && overlay?.key !== 'duration';
  const showClimb = selected && family !== 'swimming' && isUphillRep(selected) && base.key !== 'ascent' && overlay?.key !== 'ascent';
  const gain = hill?.gain ?? selected?.ascent;
  const distance = selected && (hill || block.format === 'mixed') && selected.distance !== null && selected.distance > 0
    ? repDistance(selected.distance, family) : null;
  const width = analysis.reps.length * repWidth;
  const minWidth = block.format === 'mixed' ? analysis.reps.length * mixedRepMinWidth : width;

  if (!analysis.reps.length) return null;
  return (
    <section className="workout-rep-chart" aria-labelledby={headingId}>
      <header className="workout-rep-chart-header">
        <h5 id={headingId}>Rep chart</h5>
        {overlays.length > 0 && (
          <div className="workout-rep-chart-controls">
            <label htmlFor={pickerId}>Overlay</label>
            <NativeSelect className="workout-rep-chart-picker" size="sm" id={pickerId} aria-label="Rep chart overlay"
              value={overlay?.key ?? noOverlay} onChange={event => setChoice(event.target.value)}>
              <NativeSelectOption value={noOverlay}>None</NativeSelectOption>
              {overlays.map(series => <NativeSelectOption key={series.key} value={series.key}>{series.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        )}
      </header>
      <div className="workout-rep-chart-keys">
        <ChartKey series={base} domain={baseScale} kind="bars" />
        {overlay && lineScale && <ChartKey series={overlay} domain={lineScale} kind="line" />}
      </div>
      <div className="workout-rep-chart-grid" data-overlay-available={overlays.length > 0 || undefined}>
        <ChartAxis series={base} domain={baseScale} kind="bars" />
        <div className="workout-rep-chart-scroll">
          <div className="workout-rep-chart-plot" style={{ minWidth }}>
            <ol aria-label="Reps in workout order">
              {analysis.reps.map((rep, index) => {
                const active = rep.index === selectedIndex;
                const barValue = base.values[index];
                const lineValue = overlay?.values[index];
                const readings = [base, overlay].flatMap(series => series ? [reading(series, index, rep)] : []);
                const uphill = family !== 'swimming' && isUphillRep(rep);
                const label = [`Rep ${index + 1}${uphill ? ', uphill' : ''}`, ...readings.map(item => {
                  const exact = item.value === null ? 'unavailable' : [item.value, item.unit].filter(Boolean).join(' ');
                  return `${item.label} ${exact}${item.estimated ? ', estimated' : ''}`;
                })].join(', ');
                return (
                  <li key={rep.index}>
                    <button type="button" className="workout-rep-chart-rep" data-selected={active || undefined}
                      aria-pressed={active} aria-label={label} onClick={() => onSelect(active ? null : rep.index)}>
                      <span className="workout-rep-chart-slot" aria-hidden="true">
                        {finite(barValue) && <i className="workout-rep-chart-bar" style={{ height: `${position(barValue, baseScale) * 100}%` }} />}
                        {finite(lineValue) && lineScale && <i className="workout-rep-chart-dot" style={{ bottom: `${position(lineValue, lineScale) * 100}%` }} />}
                      </span>
                      <span className="workout-rep-chart-ordinal" aria-hidden="true">
                        {uphill && <Mountain size={11} />}{index + 1}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {overlay && lineScale && (
              <svg className="workout-rep-chart-line" viewBox={`0 0 ${width} ${plotHeight}`} preserveAspectRatio="none" aria-hidden="true">
                {overlay.includeZero && <line className="workout-rep-chart-zero" x1="0" x2={width}
                  y1={(1 - position(0, lineScale)) * plotHeight} y2={(1 - position(0, lineScale)) * plotHeight}
                  vectorEffect="non-scaling-stroke" />}
                <path d={overlayPath(overlay.values, lineScale)} vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        </div>
        {overlay && lineScale && <ChartAxis series={overlay} domain={lineScale} kind="line" />}
      </div>
      <div className="workout-rep-chart-footer">
        <div className="workout-rep-chart-readout" aria-live="polite">
          {selected ? (
            <>
              <div className="workout-rep-chart-readout-heading">
                <strong>Rep {selectedPosition + 1}</strong>
                {distance && <span>{distance}</span>}
                {showDuration && <span>{durationLabel(selected.duration)} work</span>}
                {showClimb && gain != null && <span>{selected.ascentSource === 'estimated' ? '~' : '+'}{Math.round(gain)} m climbing</span>}
                {hill?.grade != null && overlay?.key !== 'netGrade' && <span>{hill.estimated ? '~' : ''}{numberLabel(hill.grade)}% net grade</span>}
                {hill?.climbRate != null && overlay?.key !== 'climbRate' && <span>{hill.gainEstimated ? '~' : ''}{numberLabel(hill.climbRate, 0)} m/min climb</span>}
              </div>
              <dl>
                {selectedReadings.map((item, index) => (
                  <div key={item.label} data-kind={index === 0 ? 'bars' : 'line'}>
                    <dt>{item.label}</dt>
                    <dd>{item.value ?? <span aria-label="Unavailable">—</span>}
                      {item.value !== null && (item.unit || item.estimated) && <small>{item.unit}{item.estimated && ' est.'}</small>}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : <span>Tap a rep to see its values.</span>}
        </div>
        {selected && aligned && (
          <Button type="button" variant="outline" size="sm" className="workout-rep-chart-timeline" onClick={onViewTimeline}>
            <ArrowDown data-icon="inline-start" aria-hidden="true" /> Timeline
          </Button>
        )}
      </div>
      {hill && <HillMechanics hill={hill} overlay={overlay?.key} />}
      {(overlay?.key === 'oxygenPerRep' || overlay?.key === 'oxygenPerKm') && (
        <p className="workout-rep-chart-method">Estimated from heart rate and VO₂max. Reps under 3 minutes are left blank.</p>
      )}
    </section>
  );
}
