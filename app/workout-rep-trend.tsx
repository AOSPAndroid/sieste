import { ArrowDown, ArrowUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { numberLabel, paceLabel } from './activity-metrics';
import type { WorkoutBlockAnalysis } from './workout-block-analysis-data';
import type { WorkoutBlock } from './workout-blocks-data';
import { repFormTrend, type RepMetricTrend, type RepTrendMetric } from './workout-rep-trend-data';
import './workout-rep-trend.css';

type Props = {
  block: WorkoutBlock;
  analysis: WorkoutBlockAnalysis;
  family: string;
  scope?: { first: string; last: string };
};

const labels: Record<RepTrendMetric, string> = {
  pace: 'Pace',
  heartrate: 'Heart rate',
  cadence: 'Cadence',
  stepLength: 'Step length',
  groundContactTime: 'Ground contact',
  power: 'Power',
};

const directionIcons = { up: ArrowUp, down: ArrowDown, steady: Minus };

const metricOrder: Record<string, RepTrendMetric[]> = {
  running: ['cadence', 'stepLength', 'groundContactTime', 'pace', 'heartrate', 'power'],
  cycling: ['power', 'pace', 'cadence', 'heartrate'],
  swimming: ['pace', 'cadence', 'heartrate', 'power'],
};
const hillOrder: RepTrendMetric[] = ['stepLength', 'cadence', 'groundContactTime', 'pace', 'heartrate', 'power'];

const readValue = (key: RepTrendMetric, trend: RepMetricTrend, value: number) =>
  key === 'pace' && trend.unit !== 'km/h' ? paceLabel(value) : numberLabel(value, key === 'pace' || key === 'stepLength' ? 1 : 0);

function TrendItem({ metric, trend, compact = false }: { metric: RepTrendMetric; trend: RepMetricTrend; compact?: boolean }) {
  const steady = trend.direction === 'steady';
  const timePace = metric === 'pace' && trend.unit !== 'km/h';
  const Icon = directionIcons[trend.direction];
  const label = metric === 'pace' && trend.unit === 'km/h' ? 'Speed' : labels[metric];
  const unit = trend.unit === 'steps/min' ? 'spm' : trend.unit;
  const valueUnit = timePace ? unit.slice(1) : unit;
  const first = readValue(metric, trend, trend.first);
  const last = readValue(metric, trend, trend.last);
  const direction = timePace && !steady
    ? trend.direction === 'up' ? 'slower' : 'faster'
    : trend.direction;

  return (
    <div className="workout-rep-trend-item" data-compact={compact || undefined}>
      <dt>{label}</dt>
      <dd>
        <span className="workout-rep-trend-change" data-steady={steady || undefined}>
          <Icon size={13} aria-hidden="true" />
          {!steady && <span className="sr-only">{direction} </span>}
          {compact ? (
            <strong>{first} → {last} <small>{valueUnit}</small></strong>
          ) : steady ? <strong>Steady</strong> : (
            <strong>{numberLabel(Math.abs(trend.delta), 1)} <small>{unit}</small></strong>
          )}
          {timePace && !steady && <small aria-hidden="true">{direction}</small>}
        </span>
        {!compact && <span className="workout-rep-trend-values">{first} → {last}{steady && ` ${valueUnit}`}</span>}
      </dd>
    </div>
  );
}

export default function WorkoutRepTrend({ block, analysis, family, scope }: Props) {
  const { metrics, form } = repFormTrend(block, analysis, family);
  const order = family === 'running' && block.kind === 'uphill' ? hillOrder : metricOrder[family] ?? metricOrder.running;
  const ordered = order.flatMap(metric => {
    const trend = metrics[metric];
    return trend ? [{ metric, trend }] : [];
  });

  if (!ordered.length) return null;
  const pace = metrics.pace;
  const paceChanged = pace && pace.direction !== 'steady' && Math.abs(pace.delta) >= (pace.unit === 's/km' ? 2 : .5);
  const faster = paceChanged && (pace.unit === 'km/h' ? pace.direction === 'up' : pace.direction === 'down');
  const title = form === 'possible-fade' ? 'Possible form fade' : form === 'stable' ? 'Form measures steady'
    : paceChanged ? faster ? 'Faster finish' : 'Slower finish' : 'Early vs late';
  const HeadlineIcon = form === 'possible-fade' ? TrendingDown : form === 'stable' ? Minus
    : paceChanged ? faster ? TrendingUp : TrendingDown : null;
  const reps = analysis.comparison.repsPerSide;

  return (
    <section className="workout-rep-trend" data-form={form ?? undefined} aria-label={title}>
      <header>
        <h5>{HeadlineIcon && <HeadlineIcon size={14} aria-hidden="true" />}{title}</h5>
        <span>{scope ? scope.first + ' vs ' + scope.last : `First ${reps} vs last ${reps} ${reps === 1 ? 'rep' : 'reps'}`}</span>
      </header>
      <dl className="workout-rep-trend-main">
        {ordered.slice(0, 3).map(item => <TrendItem key={item.metric} {...item} />)}
      </dl>
      {ordered.length > 3 && (
        <dl className="workout-rep-trend-context">
          {ordered.slice(3).map(item => <TrendItem key={item.metric} {...item} compact />)}
        </dl>
      )}
    </section>
  );
}
