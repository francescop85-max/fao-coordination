'use client';

import { useMemo, useState, useRef } from 'react';
import { WorkTask } from '../types';
import { STATUS_COLORS } from '../workplans/constants';
import {
  parseISO, format, eachDayOfInterval, differenceInDays,
  addDays, subDays, isToday, isWeekend, isSameMonth,
} from 'date-fns';

interface GanttChartProps {
  tasks: WorkTask[];
  onTaskClick?: (task: WorkTask) => void;
}

const DAY_W = 28;
const ROW_H = 36;
const LABEL_W = 220;
const HEADER_H = 44;
const MIN_BAR_W = DAY_W;

interface Tooltip {
  task: WorkTask;
  x: number;
  y: number;
}

export default function GanttChart({ tasks, onTaskClick }: GanttChartProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { days, rangeStart, svgWidth, svgHeight } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      const start = subDays(today, 7);
      const end = addDays(today, 30);
      const days = eachDayOfInterval({ start, end });
      return { days, rangeStart: start, svgWidth: LABEL_W + days.length * DAY_W, svgHeight: HEADER_H + ROW_H };
    }
    const starts = tasks.map(t => parseISO(t.startDate));
    const ends = tasks.map(t => parseISO(t.endDate));
    const minDate = starts.reduce((a, b) => a < b ? a : b);
    const maxDate = ends.reduce((a, b) => a > b ? a : b);
    const rangeStart = subDays(minDate, 3);
    const rangeEnd = addDays(maxDate, 3);
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    return {
      days,
      rangeStart,
      svgWidth: LABEL_W + days.length * DAY_W,
      svgHeight: HEADER_H + tasks.length * ROW_H,
    };
  }, [tasks]);

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  const getBarX = (dateStr: string) => {
    const d = parseISO(dateStr);
    const diff = differenceInDays(d, rangeStart);
    return LABEL_W + diff * DAY_W;
  };

  const getBarW = (startStr: string, endStr: string) => {
    const s = parseISO(startStr);
    const e = parseISO(endStr);
    const days = Math.max(1, differenceInDays(e, s));
    return Math.max(MIN_BAR_W, days * DAY_W);
  };

  const getRowY = (index: number) => HEADER_H + index * ROW_H;

  const todayX = useMemo(() => {
    const diff = differenceInDays(new Date(), rangeStart);
    return LABEL_W + diff * DAY_W;
  }, [rangeStart]);

  const handleBarMouseEnter = (e: React.MouseEvent, task: WorkTask) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ task, x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10 });
  };

  const handleBarMouseLeave = () => setTooltip(null);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No tasks to display. Add tasks to see the Gantt chart.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-x-auto border border-slate-200 rounded-lg bg-white">
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: 'block', minWidth: svgWidth }}
      >
        <defs>
          {tasks.map((task, i) => (
            <clipPath key={`clip-${task.id}`} id={`clip-${task.id}`}>
              <rect
                x={getBarX(task.startDate) + 4}
                y={getRowY(i) + 4}
                width={Math.max(0, getBarW(task.startDate, task.endDate) - 8)}
                height={ROW_H - 8}
              />
            </clipPath>
          ))}
          {/* label clip path */}
          <clipPath id="label-clip">
            <rect x={0} y={0} width={LABEL_W - 8} height={svgHeight} />
          </clipPath>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
          </marker>
          <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
          </marker>
        </defs>

        {/* Row backgrounds */}
        {tasks.map((_, i) => (
          <rect
            key={`row-${i}`}
            x={0}
            y={getRowY(i)}
            width={svgWidth}
            height={ROW_H}
            fill={i % 2 === 0 ? '#f8fafc' : '#ffffff'}
          />
        ))}

        {/* Weekend / today column tints */}
        {days.map((day, di) => {
          const x = LABEL_W + di * DAY_W;
          if (isWeekend(day)) {
            return <rect key={`wknd-${di}`} x={x} y={0} width={DAY_W} height={svgHeight} fill="#f1f5f9" opacity={0.6} />;
          }
          if (isToday(day)) {
            return <rect key={`today-col-${di}`} x={x} y={0} width={DAY_W} height={svgHeight} fill="#dbeafe" opacity={0.5} />;
          }
          return null;
        })}

        {/* Vertical grid lines */}
        {days.map((_, di) => {
          const x = LABEL_W + di * DAY_W;
          return <line key={`vl-${di}`} x1={x} y1={HEADER_H} x2={x} y2={svgHeight} stroke="#e2e8f0" strokeWidth={0.5} />;
        })}

        {/* Header background */}
        <rect x={0} y={0} width={svgWidth} height={HEADER_H} fill="#1e3a5f" />
        <rect x={0} y={0} width={LABEL_W} height={HEADER_H} fill="#003f7d" />

        {/* Month labels */}
        {days.map((day, di) => {
          if (di === 0 || !isSameMonth(day, days[di - 1])) {
            const x = LABEL_W + di * DAY_W;
            return (
              <text key={`month-${di}`} x={x + 4} y={14} fill="#93c5fd" fontSize={10} fontWeight="600">
                {format(day, 'MMM yyyy')}
              </text>
            );
          }
          return null;
        })}

        {/* Day number labels */}
        {days.map((day, di) => {
          const x = LABEL_W + di * DAY_W;
          const isWknd = isWeekend(day);
          return (
            <text
              key={`day-${di}`}
              x={x + DAY_W / 2}
              y={32}
              textAnchor="middle"
              fill={isToday(day) ? '#fbbf24' : isWknd ? '#64748b' : '#cbd5e1'}
              fontSize={9}
              fontWeight={isToday(day) ? '700' : '400'}
            >
              {format(day, 'd')}
            </text>
          );
        })}

        {/* Label column header */}
        <text x={8} y={28} fill="#93c5fd" fontSize={11} fontWeight="600">Task</text>

        {/* Task label column divider */}
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgHeight} stroke="#1e40af" strokeWidth={1} />

        {/* Dependency arrows */}
        {tasks.map((task) => {
          return task.dependencies.map(depId => {
            const depTask = taskById.get(depId);
            if (!depTask) return null;
            const srcIdx = tasks.indexOf(depTask);
            const tgtIdx = tasks.indexOf(task);
            if (srcIdx < 0 || tgtIdx < 0) return null;

            const srcX = getBarX(depTask.startDate) + getBarW(depTask.startDate, depTask.endDate);
            const srcY = getRowY(srcIdx) + ROW_H / 2;
            const tgtX = getBarX(task.startDate);
            const tgtY = getRowY(tgtIdx) + ROW_H / 2;
            const isBlocking = depTask.status !== 'completed' && parseISO(task.startDate) <= new Date();
            const color = isBlocking ? '#ef4444' : '#94a3b8';
            const markerId = isBlocking ? 'arrow-red' : 'arrow';
            const midX = (srcX + tgtX) / 2;

            return (
              <path
                key={`dep-${depId}-${task.id}`}
                d={`M${srcX},${srcY} L${midX},${srcY} L${midX},${tgtY} L${tgtX - 6},${tgtY}`}
                stroke={color}
                strokeWidth={1.5}
                fill="none"
                opacity={0.7}
                markerEnd={`url(#${markerId})`}
              />
            );
          });
        })}

        {/* Task bars */}
        {tasks.map((task, i) => {
          const x = getBarX(task.startDate);
          const y = getRowY(i);
          const w = getBarW(task.startDate, task.endDate);
          const barColor = STATUS_COLORS[task.status];
          const progressW = Math.max(0, (task.progress / 100) * w);

          return (
            <g
              key={`bar-${task.id}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onTaskClick?.(task)}
              onMouseEnter={e => handleBarMouseEnter(e, task)}
              onMouseLeave={handleBarMouseLeave}
            >
              {/* Bar background */}
              <rect x={x} y={y + 6} width={w} height={ROW_H - 12} rx={4} fill={barColor} opacity={0.85} />
              {/* Progress fill */}
              {task.progress > 0 && (
                <rect x={x} y={y + 6} width={progressW} height={ROW_H - 12} rx={4} fill="#ffffff" opacity={0.25} />
              )}
              {/* Task label inside bar */}
              <text
                x={x + 6}
                y={y + ROW_H / 2 + 4}
                fill="#ffffff"
                fontSize={10}
                fontWeight="500"
                clipPath={`url(#clip-${task.id})`}
              >
                {task.title}
              </text>
              {/* Hover overlay */}
              <rect x={x} y={y + 6} width={w} height={ROW_H - 12} rx={4} fill="transparent"
                className="hover:fill-black hover:opacity-10" />
            </g>
          );
        })}

        {/* Task row labels */}
        {tasks.map((task, i) => {
          const y = getRowY(i);
          return (
            <g key={`label-${task.id}`}>
              <text
                x={8}
                y={y + ROW_H / 2 + 4}
                fill="#1e293b"
                fontSize={11}
                clipPath="url(#label-clip)"
              >
                {task.title.length > 22 ? task.title.slice(0, 22) + '…' : task.title}
              </text>
            </g>
          );
        })}

        {/* Today vertical line */}
        {todayX >= LABEL_W && todayX <= svgWidth && (
          <line
            x1={todayX + DAY_W / 2}
            y1={HEADER_H}
            x2={todayX + DAY_W / 2}
            y2={svgHeight}
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 bg-white border border-slate-200 shadow-lg rounded-lg p-3 text-xs pointer-events-none w-56"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold text-slate-800 mb-1 leading-tight">{tooltip.task.title}</div>
          {tooltip.task.assignee && (
            <div className="text-slate-500 mb-1">Assignee: {tooltip.task.assignee}</div>
          )}
          <div className="text-slate-500">
            {format(parseISO(tooltip.task.startDate), 'dd MMM')} → {format(parseISO(tooltip.task.endDate), 'dd MMM yyyy')}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="px-1.5 py-0.5 rounded text-white text-xs capitalize"
              style={{ backgroundColor: STATUS_COLORS[tooltip.task.status] }}
            >
              {tooltip.task.status.replace('-', ' ')}
            </span>
            <span className="text-slate-500">{tooltip.task.progress}% done</span>
          </div>
          {tooltip.task.dependencies.length > 0 && (
            <div className="text-slate-400 mt-1">{tooltip.task.dependencies.length} dependenc{tooltip.task.dependencies.length > 1 ? 'ies' : 'y'}</div>
          )}
        </div>
      )}
    </div>
  );
}
