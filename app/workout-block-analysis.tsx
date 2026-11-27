"use client";

import { useId, type ComponentProps } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { finite, numberLabel, paceLabel, repDistance } from './activity-metrics';
import { cadenceUnit } from './sports';
import type { WorkoutBlock } from './workout-blocks-data';
import { combineWorkoutBlockAnalyses, type WorkoutBlockAnalysis as BlockAnalysis } from './workout-block-analysis-data';
import type { ThresholdBlockEconomy } from './workout-block-economy';
import WorkoutRepChart from './workout-rep-chart';
import type { RepChartAnalysis } from './workout-rep-chart-data';
import WorkoutRepCompare from './workout-rep-compare';
import WorkoutRepPhases from './workout-rep-phases';
import WorkoutRepTraces from './workout-rep-traces';
import WorkoutSameHill from './workout-same-hill';
import WorkoutRepTrend from './workout-rep-trend';
import './workout-block-analysis.css';

export type WorkoutBlockFamily = 'running' | 'cycling' | 'swimming';

type Props = {
  blocks: WorkoutBlock[];
  analysis: (BlockAnalysis & { threshold?: ThresholdBlockEconomy | null })[];
  oxygen?: RepChartAnalysis['oxygen'];
  series: ComponentProps<typeof WorkoutRepPhases>['series'];
  alignedLaps: ComponentProps<typeof WorkoutSameHill>['alignedLaps'];
  workout: ComponentProps<typeof WorkoutSameHill>['workout'];
  history: ComponentProps<typeof WorkoutSameHill>['history'];
  token: string;
  family: WorkoutBlockFamily;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  aligned: boolean;
  onViewTimeline: () => void;
};

const metrics = [
  { key: 'heartrate', label: 'Heart rate', unit: 'bpm' },
  { key: 'cadence', label: 'Cadence' },
  { key: 'power', label: 'Power', unit: 'W' },
  { key: 'stepLength', label: 'Step length', unit: 'cm' },
  { key: 'groundContactTime', label: 'Ground contact', unit: 'ms' },
] as const;

export function repRate(pace: number | null, family: WorkoutBlockFamily) {
  if (!finite(pace) || pace <= 0) return null;
  if (family === 'cycling') {
    const amount = Math.round(36000 / pace) / 10;
    return { title: 'Speed', amount, value: numberLabel(amount), unit: 'km/h' };
  }
  const amount = Math.round(family === 'swimming' ? pace / 10 : pace);
  const unit = family === 'swimming' ? '/100m' : '/km';
  return { title: 'Pace', amount, value: paceLabel(amount), unit };
}

function deltaLabel(delta: number) {
  if (!delta) return '0';
  return `${delta < 0 ? '−' : '+'}${Math.abs(delta)}`;
}

function hrDeltaLabel(drop: number) {
  if (!drop) return '0';
  return `${drop > 0 ? '↓' : '↑'}${Math.abs(drop)}`;
}

function restTime(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function RepRateComparison({ comparison, family, scope }: {
  comparison: BlockAnalysis['comparison'];
  family: WorkoutBlockFamily;
  scope?: { first: string; last: string };
}) {
  if (!comparison.pace) return null;
  const first = repRate(comparison.pace.first, family);
  const last = repRate(comparison.pace.last, family);
  if (!first || !last) return null;
  const delta = last.amount - first.amount;
  const cycling = family === 'cycling';
  const quicker = cycling ? delta > 0 : delta < 0;
  const change = cycling ? `${numberLabel(Math.abs(delta))} km/h` : `${Math.abs(delta)}s${first.unit}`;

  return (
    <div className="workout-analysis-pace">
      <div className="workout-analysis-pace-heading">
        <h5>{first.title} <small>{first.unit}</small></h5>
        <strong>{delta ? `${change} ${quicker ? 'faster' : 'slower'}` : `Same ${first.title.toLowerCase()}`}</strong>
      </div>
      <div className="workout-analysis-pace-readings">
        <dl><dt>{scope?.first ?? `First ${comparison.repsPerSide}`}</dt><dd>{first.value}</dd></dl>
        <ArrowRight size={16} aria-hidden="true" />
        <dl><dt>{scope?.last ?? `Last ${comparison.repsPerSide}`}</dt><dd>{last.value}</dd></dl>
      </div>
    </div>
  );
}

function ThresholdEconomyDetails({ economy, reps }: { economy: ThresholdBlockEconomy; reps: BlockAnalysis['reps'] }) {
  const byIndex = new Map(economy.reps.map(rep => [rep.index, rep]));
  const rows = reps.flatMap((rep, index) => {
    const reading = byIndex.get(rep.index);
    return reading ? [{ ...reading, ordinal: index + 1 }] : [];
  });
  const hasCost = rows.some(row => row.beatsPerKm !== null);
  const hasGradePace = rows.some(row => row.gradeAdjustedPace !== null);
  const hasLateHeartRate = rows.some(row => row.lateHeartRate !== null);
  const hasEnergy = rows.some(row => row.energyPerKm !== null);
  const target = economy.targetPace !== null
    ? `${paceLabel(economy.targetPace)} /km`
    : economy.targetHeartRate !== undefined ? `${Math.round(economy.targetHeartRate)} bpm` : null;
  if (!hasCost && !hasGradePace && !hasLateHeartRate && !hasEnergy) return null;

  return (
    <section className="workout-analysis-economy" aria-label="Running economy for threshold reps">
      <header>
        <h5>Running economy</h5>
        {target && <small>Threshold {target}</small>}
      </header>
      <table className="workout-analysis-table workout-analysis-economy-table" aria-label="Threshold economy by rep">
        <thead>
          <tr>
            <th scope="col">Rep</th>
            {hasCost && <th scope="col">Beats/km</th>}
            {hasGradePace && <th scope="col">Grade-adj. pace <small>/km</small></th>}
            {hasLateHeartRate && <th scope="col">Late HR <small>bpm</small></th>}
            {hasEnergy && <th scope="col">Energy <small>kJ/km</small></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.index}>
              <th scope="row">{row.ordinal}</th>
              {hasCost && <td>{numberLabel(row.beatsPerKm, 0)}</td>}
              {hasGradePace && <td>{paceLabel(row.gradeAdjustedPace)}</td>}
              {hasLateHeartRate && <td>{numberLabel(row.lateHeartRate, 0)}</td>}
              {hasEnergy && <td>{numberLabel(row.energyPerKm, 1)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {(hasCost || hasEnergy) && <p className="workout-analysis-note">
        {hasCost && 'Heartbeats per km is estimated from pace and heart rate.'}
        {hasEnergy && <>{hasCost && ' '}Energy is estimated from watch running power.</>}
      </p>}
    </section>
  );
}

function RecoveryAverages({ recovery }: { recovery: BlockAnalysis['recovery'] }) {
  if (recovery.averageDuration === null && recovery.averageHrDrop === null) return null;
  return (
    <dl className="workout-analysis-recovery-averages">
      {recovery.averageDuration !== null && (
        <div><dt>Avg rest</dt><dd>{restTime(recovery.averageDuration)}</dd></div>
      )}
      {recovery.averageHrDrop !== null && (
        <div><dt>Avg HR change <small>(est.)</small></dt><dd>{hrDeltaLabel(Math.round(recovery.averageHrDrop))} <small>bpm</small></dd></div>
      )}
    </dl>
  );
}

export default function WorkoutBlockAnalysis({ blocks, analysis, oxygen, family, series, alignedLaps, workout, history, token, selectedIndex, onSelect, aligned, onViewTimeline }: Props) {
  const panelId = useId();
  if (!analysis.length) return null;
  const unified = analysis.length > 1;
  const { reps, recovery } = combineWorkoutBlockAnalyses(analysis);
  const thresholdSets = analysis.flatMap(result => result.threshold ? [result.threshold] : []);
  const anchor = thresholdSets[0];
  const threshold = anchor ? {
    targetPace: thresholdSets.every(set => set.targetPace === anchor.targetPace) ? anchor.targetPace : null,
    targetHeartRate: thresholdSets.every(set => set.targetHeartRate === anchor.targetHeartRate) ? anchor.targetHeartRate : undefined,
    reps: thresholdSets.flatMap(set => set.reps),
  } : null;
  const block: WorkoutBlock = unified ? { kind: 'repeats', format: 'mixed', reps } : blocks[0];
  const mixed = block.format === 'mixed';
  const selectedSet = analysis.findIndex(set => set.reps.some(rep => rep.index === selectedIndex));
  const trendIndex = selectedSet >= 0 ? selectedSet : analysis.findIndex(set => set.comparison.repsPerSide > 0);
  const trendAnalysis = analysis[trendIndex];
  const comparison = trendAnalysis?.comparison;
  const ordinals = new Map(reps.map((rep, index) => [rep.index, index + 1]));
  const repLabels = (group: BlockAnalysis['reps']) => 'Rep' + (group.length === 1 ? ' ' : 's ') +
    group.map(rep => ordinals.get(rep.index)).join(', ');
  const scope = unified && trendAnalysis && comparison?.repsPerSide ? {
    first: repLabels(trendAnalysis.reps.slice(0, comparison.repsPerSide)),
    last: repLabels(trendAnalysis.reps.slice(-comparison.repsPerSide)),
  } : undefined;
  const running = family === 'running';
  const hasFormSignals = comparison?.cadence || comparison?.stepLength || comparison?.groundContactTime;
  const comparisonMetrics = metrics.flatMap(metric => {
    if (family !== 'cycling' && metric.key === 'power') return [];
    if (!running && (metric.key === 'stepLength' || metric.key === 'groundContactTime')) return [];
    const pair = comparison?.[metric.key];
    const unit = metric.key === 'cadence' ? (running ? 'spm' : cadenceUnit(family)) : metric.unit;
    return pair ? [{ ...metric, unit, pair }] : [];
  });
  const compare = comparison?.repsPerSide && (comparison.pace || comparisonMetrics.length > 0);
  const trend = trendAnalysis && <WorkoutRepTrend block={blocks[trendIndex]} analysis={trendAnalysis} family={family} scope={scope} />;

  return (
    <div className="workout-analysis">
      <section className="workout-analysis-block" aria-labelledby={panelId}>
        <h4 className="sr-only" id={panelId}>Rep analysis</h4>
        <WorkoutRepTraces reps={reps} series={series} alignedLaps={alignedLaps} family={family} selectedIndex={selectedIndex} onSelect={onSelect} />
        {!unified && trend}
        <WorkoutRepChart block={block} analysis={{ reps, threshold, oxygen }} family={family} selectedIndex={selectedIndex}
          onSelect={onSelect} aligned={aligned} onViewTimeline={onViewTimeline} />
        {unified && trend}
        {running && <WorkoutSameHill workout={workout} reps={reps} history={history} selectedIndex={selectedIndex} series={series} alignedLaps={alignedLaps} token={token} />}
        <WorkoutRepCompare reps={reps} family={family} selectedIndex={selectedIndex} />
        {running && <WorkoutRepPhases reps={reps} series={series} alignedLaps={alignedLaps} selectedIndex={selectedIndex} />}
        <details className="workout-analysis-details">
          <summary>Rep details <ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="workout-analysis-details-body">
            {threshold && <ThresholdEconomyDetails economy={threshold} reps={reps} />}
            <div className="workout-analysis-columns">
              {compare && comparison && (
                <div>
                    <RepRateComparison comparison={comparison} family={family} scope={scope} />
                    {comparisonMetrics.length > 0 && (
                      <table className="workout-analysis-table workout-analysis-comparison" aria-label="Early versus late reps">
                        <thead>
                          <tr>
                            <th scope="col">Metric</th>
                            <th scope="col">{scope?.first ?? `First ${comparison.repsPerSide}`}</th>
                            <th scope="col">{scope?.last ?? `Last ${comparison.repsPerSide}`}</th>
                            <th scope="col">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonMetrics.map(({ key, label, unit, pair }) => {
                            const first = Math.round(pair.first);
                            const last = Math.round(pair.last);
                            return (
                              <tr key={key}>
                                <th scope="row">{label} <small>{unit}</small></th>
                                <td>{first}</td>
                                <td>{last}</td>
                                <td>{deltaLabel(last - first)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {running&&<p className="workout-analysis-note">
                      {hasFormSignals
                        ? 'Pace and terrain can affect these form measures.'
                        : 'Running-form measures are unavailable for this comparison.'}
                    </p>}
                </div>
              )}
              <div>
                <h5>Heart rate &amp; recovery</h5>
                <RecoveryAverages recovery={recovery} />
                <table className="workout-analysis-table workout-analysis-recovery" aria-label="Heart rate and recovery by rep">
                  <thead>
                    <tr>
                      <th scope="col">Rep</th>
                      <th scope="col">Avg HR <small>bpm</small></th>
                      <th scope="col">Rest after</th>
                      <th scope="col">HR change <small>bpm</small></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((rep, index) => {
                      const rest = rep.recovery;
                      const selected = selectedIndex === rep.index;
                      const duration = restTime(rep.duration);
                      const distance = mixed && rep.distance !== null && rep.distance > 0 ? repDistance(rep.distance, family) : null;
                      const power = family === 'cycling' && rep.power !== null ? `${Math.round(rep.power)} W` : null;
                      const estimated = rep.ascentSource === 'estimated';
                      const ascent = family !== 'swimming' && rep.ascent !== null && rep.ascent > 0 ? Math.round(rep.ascent) : null;
                      const climbing = ascent !== null ? `${ascent} metres climbing${estimated ? ', estimated' : ''}` : null;
                      const label = [`Select rep ${index + 1}`, duration, distance, power, climbing].filter(Boolean).join(', ');
                      return (
                        <tr key={rep.index} data-selected={selected || undefined}>
                          <th scope="row">
                            <Button
                              type="button"
                              size="sm"
                              variant={selected ? 'secondary' : 'ghost'}
                              className="workout-analysis-rep-link"
                              aria-pressed={selected}
                              aria-label={label}
                              onClick={() => onSelect(selected ? null : rep.index)}
                            >
                              <span className="workout-analysis-rep-id">
                                <strong>{index + 1}</strong>
                                <small>{duration}</small>
                              </span>
                              {distance && <small>{distance}</small>}
                              {power && <small>{power}</small>}
                              {ascent !== null && <small>{estimated ? '~' : '+'}{ascent} m climb</small>}
                            </Button>
                          </th>
                          <td>{rep.heartrate === null ? '—' : Math.round(rep.heartrate)}</td>
                          <td>{rest ? restTime(rest.duration) : '—'}</td>
                          <td>
                            {rest && rest.hrDrop !== null && rest.startHr !== null && rest.endHr !== null ? (
                              <>
                                {hrDeltaLabel(Math.round(rest.hrDrop))}
                                <small className="workout-analysis-hr-readings">
                                  {Math.round(rest.startHr)} → {Math.round(rest.endHr)}
                                </small>
                              </>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="workout-analysis-note">
                  {recovery.count === 0
                    ? 'Recovery timing unavailable.'
                    : `HR change uses samples near the end of each rep and its rest. Estimates available for ${recovery.measuredCount} of ${recovery.count}.`}
                </p>
              </div>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
