import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { api, type BoardPayload, type Card, type CardDependency, type Column } from '../../api'
import { CollapseColumnIcon, DependencyConnectorIcon, DoneIcon, ExpandColumnIcon, EyeIcon, EyeLowVisionIcon } from '../../shared/icons'
import { KanbanMiniCard } from './KanbanMiniCard'
import { Avatar } from '../../shared/ui'
import styles from './GanttView.module.css'

const DAY_MS = 86_400_000
const TASK_WIDTH = 200
const FF_FINISH_MARKER_OFFSET_PX = 5
const DEFAULT_COLUMNS = { start: true, end: true, progress: true }
const ZOOMS = ['day', 'week', 'month', 'quarter'] as const
type Zoom = (typeof ZOOMS)[number]
type Visibility = typeof DEFAULT_COLUMNS
type Day = { key: string; date: Date }
type GanttCard = { card: Card; column: Column }
type CategoryGroup = { id: string; name: string; cards: GanttCard[] }
type TimelineEntry = { group: CategoryGroup; row: number; collapsed: boolean }
type CategoryStats = { start: string | null; end: string | null; progress: number | null }
type CardBarStyle = CSSProperties & {
  '--card-color': string
  '--card-progress': string
}
type DragMode = 'move' | 'resize-start' | 'resize-end'
type DragState = {
  card: Card
  mode: DragMode
  pointerStartX: number
  dayWidth: number
}
type DragPreview = { cardId: number; start: string; due: string }
type GanttDependency = CardDependency & { predecessorId: number; successorId: number }
type ExternalGanttDependency = CardDependency & { localCardId: number; direction: 'incoming' | 'outgoing' }
type DependencyPopover = { dependency: GanttDependency; x: number; y: number }
type DependencyCreation = { cardId: number; endpoint: 'start' | 'finish'; cursorX: number; cursorY: number; targetId: number | null; targetEndpoint: 'start' | 'finish' | null }
type HoveredCard = { card: Card | NonNullable<CardDependency['preview']>; left: number; top: number }
type Point = { x: number; y: number }
type Rect = { left: number; right: number; top: number; bottom: number }
type BarObstacle = Rect & { cardId?: number }
type ConnectorObstacle = Rect & { cardId: number; endpoint: 'start' | 'finish' }
type DependencySegment = { start: Point; end: Point; sourceKey: string; dependencyId: number }
type DependencyGeometry = {
  width: number
  height: number
  dayWidth: number
  anchors: Record<string, Point>
  obstacles: BarObstacle[]
  connectors: ConnectorObstacle[]
  externalRefs: Record<number, Rect>
}

type GanttGridStyle = CSSProperties & {
  '--left-columns': string
  '--left-width': string
}

function cardVisualProgress(item: GanttCard) {
  const checklistPercent = Math.min(100, Math.max(0, item.card.progress?.percent ?? 0))

  if (item.column.workflow_state === 'in_progress') {
    return Math.max(10, checklistPercent)
  }

  if (item.column.workflow_state === 'review' || item.column.workflow_state === 'done') {
    return 100
  }

  return 0
}

function parseDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function shift(value: string, amount: number) {
  const date = parseDay(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return dateKey(date)
}

function daysBetween(start: string, end: string) {
  return Math.round((parseDay(end).getTime() - parseDay(start).getTime()) / DAY_MS)
}

function planned(card: Card) {
  return Boolean(card.start_date && card.due_date)
}

function hasTemporalPlanning(item: GanttCard) {
  return item.column.workflow_state !== 'backlog' && planned(item.card)
}

function segmentIntersectsRect(start: Point, end: Point, rect: Rect, padding = 8) {
  const left = rect.left - padding
  const right = rect.right + padding
  const top = rect.top - padding
  const bottom = rect.bottom + padding

  if (start.y === end.y) {
    return start.y > top && start.y < bottom && Math.max(start.x, end.x) > left && Math.min(start.x, end.x) < right
  }

  return start.x > left && start.x < right && Math.max(start.y, end.y) > top && Math.min(start.y, end.y) < bottom
}

function verticalSegmentsOverlap(first: Point, second: Point, third: Point, fourth: Point) {
  // Horizontal overlaps and perpendicular crossings are intentionally allowed.
  // Only positive-length overlap of collinear vertical segments is prohibited
  // when the dependencies have different source connectors.
  if (first.x !== second.x || third.x !== fourth.x || first.x !== third.x) return false
  return Math.max(Math.min(first.y, second.y), Math.min(third.y, fourth.y))
    < Math.min(Math.max(first.y, second.y), Math.max(third.y, fourth.y))
}

function pathToSvg(points: Point[], cornerRadius = 4) {
  const cleanPoints = points.filter((point, index) => {
    const previous = points[index - 1]
    return !previous || point.x !== previous.x || point.y !== previous.y
  })

  if (cleanPoints.length < 2) {
    return ''
  }

  let path = `M ${cleanPoints[0].x} ${cleanPoints[0].y}`

  cleanPoints.slice(1, -1).forEach((point, index) => {
    const previous = cleanPoints[index]
    const next = cleanPoints[index + 2]
    const previousLength = Math.hypot(point.x - previous.x, point.y - previous.y)
    const nextLength = Math.hypot(next.x - point.x, next.y - point.y)
    const radius = Math.min(cornerRadius, previousLength / 2, nextLength / 2)

    if (radius <= 0) {
      path += ` L ${point.x} ${point.y}`
      return
    }

    const before = {
      x: point.x + (previous.x - point.x) * radius / previousLength,
      y: point.y + (previous.y - point.y) * radius / previousLength,
    }
    const after = {
      x: point.x + (next.x - point.x) * radius / nextLength,
      y: point.y + (next.y - point.y) * radius / nextLength,
    }

    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`
  })

  const last = cleanPoints.at(-1)!
  path += ` L ${last.x} ${last.y}`

  return path
}

function dependencySegments(route: Point[], dependencyId: number, sourceKey: string) {
  return route.slice(0, -1).map((start, index) => ({
    start,
    end: route[index + 1],
    sourceKey,
    dependencyId,
  }))
}

function dependencyArrowPosition(points: Point[]) {
  const cleanPoints = points.filter((point, index) => {
    const previous = points[index - 1]
    return !previous || point.x !== previous.x || point.y !== previous.y
  })
  const end = cleanPoints.at(-1)
  const previous = cleanPoints.at(-2)

  if (!end || !previous) {
    return null
  }

  return {
    point: end,
    angle: Math.atan2(end.y - previous.y, end.x - previous.x) * 180 / Math.PI,
  }
}

function routeDependency(
  source: Point,
  target: Point,
  obstacles: BarObstacle[],
  sourceEndpoint: 'start' | 'finish',
  targetEndpoint: 'start' | 'finish',
  bounds: { width: number; height: number; dayWidth?: number },
  connectorObstacles: ConnectorObstacle[] = [],
  reservedSegments: DependencySegment[] = [],
  sourceKey = '',
  sourceCardId?: number,
  targetCardId?: number,
  targetBar?: BarObstacle,
  sourceBar?: BarObstacle,
) {
  // Try a small, ordered set of complete orthogonal routes. The previous
  // Cartesian graph expanded every candidate day against every obstacle row,
  // causing quadratic neighbor searches and long main-thread freezes.
  if (bounds.width <= 0 || bounds.height <= 0) return []
  const day = Math.max(1, bounds.dayWidth ?? 20)
  const row = 30
  const finishBelowBar = targetEndpoint === 'finish' && targetBar !== undefined
  const ffOrigin = finishBelowBar && sourceEndpoint === 'finish' && sourceBar !== undefined

  // Finish arrivals (FF and SF) use the ACTUAL gap between measured bars, not a fixed +6px
  // offset which can overlap the next row (especially at compact page zoom).
  const gapBelow = (bar: BarObstacle) => {
    const nextTop = obstacles.reduce((nearest, candidate) =>
      candidate.top >= bar.bottom - 0.01 && candidate.top < nearest
        ? candidate.top
        : nearest, Infinity)
    return Number.isFinite(nextTop) ? Math.max(0, nextTop - bar.bottom) : 10
  }
  const ffGap = finishBelowBar && targetBar
    ? ffOrigin && sourceBar ? Math.min(gapBelow(sourceBar), gapBelow(targetBar)) : gapBelow(targetBar)
    : 10
  const padding = finishBelowBar ? Math.min(4, Math.max(0.5, ffGap / 2 - 0.5)) : 4
  // Keep the FF track immediately below each bar (roughly the row divider).
  // Empty rows must not push the arrival halfway toward the next visible bar.
  const ffLane = (bar: BarObstacle) =>
    bar.bottom + Math.min(5, gapBelow(bar) / 2)

  const sourceExit = sourceEndpoint === 'start'
    ? source
    : { x: source.x + 16, y: source.y }
  const sourceSeparator = ffOrigin && sourceBar
    ? ffLane(sourceBar)
    : source.y + row / 2

  // FF and SF terminate below the successor bar; the vertical tick remains at the
  // successor's real right edge.
  const targetArrow: Point = finishBelowBar && targetBar
    ? { x: targetBar.right, y: ffLane(targetBar) }
    : {
      x: target.x + (targetEndpoint === 'start' ? -day : 15),
      y: target.y,
    }
  const approachFromLeft = targetEndpoint === 'start' || finishBelowBar
  const firstTurn = targetArrow.x + (approachFromLeft ? -day : day)
  const turnDirection = approachFromLeft ? -1 : 1

  function isFree(start: Point, end: Point) {
    if (start.x !== end.x && start.y !== end.y) return false
    const horizontal = start.y === end.y
    if (obstacles.some((obstacle) =>
      segmentIntersectsRect(start, end, obstacle, padding)
      && (horizontal || obstacle.cardId === sourceCardId || obstacle.cardId === targetCardId)
    )) return false
    if (connectorObstacles.some((obstacle) => segmentIntersectsRect(start, end, obstacle, padding))) return false
    return !reservedSegments.some((segment) =>
      segment.sourceKey !== sourceKey
      && verticalSegmentsOverlap(start, end, segment.start, segment.end)
    )
  }

  function validRoute(points: Point[], checkReservations = true) {
    return points.length >= 2
      && points.every((point) => point.x >= 0 && point.x <= bounds.width
        && point.y >= 4 && point.y <= bounds.height - 4)
      && points.slice(0, -1).every((point, index) => {
        const next = points[index + 1]
        if (!checkReservations) {
          const horizontal = point.y === next.y
          return (horizontal || point.x === next.x)
            && !obstacles.some((bar) =>
              segmentIntersectsRect(point, next, bar, padding)
              && (horizontal || bar.cardId === sourceCardId || bar.cardId === targetCardId)
            )
            && !connectorObstacles.some((connector) => segmentIntersectsRect(point, next, connector, padding))
        }
        return isFree(point, next)
      })
  }

  // FS can usually leave Finish horizontally, travel directly up/down
  // beside the predecessor and enter Start with one last horizontal run.
  // Do not force a separator detour unless a bar, foreign connector or
  // reserved vertical segment actually blocks this minimal route.
  if (sourceEndpoint === 'finish' && targetEndpoint === 'start' && targetArrow.x > sourceExit.x) {
    const direct: Point[] = [
      source,
      sourceExit,
      { x: sourceExit.x, y: targetArrow.y },
      targetArrow,
    ]
    const directRoute = direct.filter((point, index) =>
      index === 0 || point.x !== direct[index - 1].x || point.y !== direct[index - 1].y
    )
    if (validRoute(directRoute)) return directRoute
  }

  // All start-side departures descend immediately. Finish-side departures
  // retain the horizontal exit, then join the separator below their own row.
  const prefix = sourceEndpoint === 'start'
    ? [source, { x: source.x, y: sourceSeparator }]
    : [source, sourceExit, { x: sourceExit.x, y: sourceSeparator }]

  if (sourceEndpoint === 'start' && finishBelowBar && targetBar) {
    // SF: leave the actual Start connector vertically down to the next row
    // seam, then pick the nearest vertical corridor that can enter Finish
    // horizontally from the left, underneath the successor.
    // If the destination is ABOVE the predecessor, make a short leftward
    // move first so the mandatory downward departure never doubles back
    // over itself. If the destination is BELOW, the transition must also
    // clear the successor bar before reaching its lower lane.
    const destinationAbove = targetArrow.y < sourceSeparator
    const destinationBelow = targetBar.top > source.y
    const minArrivalWidth = Math.max(8, day / 2)
    const preferredTurnX = Math.min(
      source.x - (destinationAbove ? day : 0),
      targetArrow.x - minArrivalWidth,
      destinationBelow ? targetBar.left - padding - 5 : Infinity,
    )
    const maxAttempts = Math.min(64, Math.ceil(bounds.width / day) + 1)

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const turnX = preferredTurnX - attempt * day
      if (turnX < 4) break
      const raw: Point[] = [
        ...prefix,
        { x: turnX, y: sourceSeparator },
        { x: turnX, y: targetArrow.y },
        targetArrow,
      ]
      const route = raw.filter((point, index) =>
        index === 0 || point.x !== raw[index - 1].x || point.y !== raw[index - 1].y
      )
      if (validRoute(route)) return route
    }

    if (import.meta.env.DEV) console.warn('No se encontró un recorrido SF hacia Finish sin obstáculos.', {
      sourceCardId, targetCardId,
    })
    return []
  }

  if (ffOrigin && sourceBar && targetBar) {
    // Only the bar crossed by the vertical transition needs an outer bypass:
    // - target ABOVE source: upward transition must clear the SOURCE bar.
    // - target BELOW source: downward transition must clear the TARGET bar.
    // Never route around both bars when one is already below its track.
    const blockingBar = targetBar.top < sourceBar.top ? sourceBar : targetBar
    const nearestExteriorX = blockingBar.left - 2 * day
    const maxExteriorAttempts = Math.min(64, Math.ceil(bounds.width / day) + 1)
    for (let attempt = 0; attempt < maxExteriorAttempts; attempt += 1) {
      const exteriorX = nearestExteriorX - attempt * day
      if (exteriorX < 4) break

      const raw = [
        ...prefix,
        { x: exteriorX, y: sourceSeparator },
        { x: exteriorX, y: targetArrow.y },
        targetArrow,
      ]
      const route = raw.filter((point, index) =>
        index === 0 || point.x !== raw[index - 1].x || point.y !== raw[index - 1].y
      )
      if (validRoute(route)) return route
    }

    if (import.meta.env.DEV) console.warn('No se encontró un recorrido FF exterior sin conflicto vertical ni obstáculos.', {
      sourceCardId, targetCardId, sourceBar, targetBar,
    })
    return []
  }

  const lanes = [
    sourceSeparator,
    target.y - row / 2,
    target.y + row / 2,
    source.y + row * 1.5,
    source.y - row / 2,
    target.y - row * 1.5,
    target.y + row * 1.5,
  ].filter((y, i, all) => y >= 4 && y <= bounds.height - 4 && all.indexOf(y) === i)

  // A candidate reserves only the actual vertical interval, never an entire
  // day column. Perpendicular intersections remain valid.
  const maxTurns = Math.min(64, Math.ceil(bounds.width / day) + 1)
  const dayTurns = Array.from({ length: maxTurns }, (_, shift) => firstTurn + shift * day * turnDirection)
  // A long successor can extend more than 64 days. In that case the only
  // obstacle-free way to approach FF from above may be just left of its bar.
  const extraTurns = finishBelowBar ? [targetBar.left - padding - 5] : []
  const turns = [...new Set([...dayTurns, ...extraTurns])]
    .filter((x) => x >= 4 && x <= bounds.width - 4)
    .sort((a, b) => Math.abs(a - targetArrow.x) - Math.abs(b - targetArrow.x))
  for (const turnX of turns) {
    for (const laneY of lanes) {
      const raw = [
        ...prefix,
        ...(laneY !== sourceSeparator ? [{ x: sourceExit.x, y: laneY }] : []),
        { x: turnX, y: laneY },
        { x: turnX, y: targetArrow.y },
        targetArrow,
      ]
      const route = raw.filter((point, i) => i === 0 || point.x !== raw[i - 1].x || point.y !== raw[i - 1].y)
      if (validRoute(route)) return route
    }
  }

  if (import.meta.env.DEV) console.warn('No se encontró una ruta corta válida para la dependencia Gantt.', {
    source, target, sourceEndpoint, targetEndpoint, sourceKey,
  })
  return []
}

// External references share the real Card's row, but are not positioned by
// their own dates. Keep the line under the title/avatars, then rise to Start
// or finish under the target's bar with the same FF/SF marker.
function routeExternalDependency(
  source: Point,
  target: Point,
  sourceEndpoint: 'start' | 'finish',
  targetEndpoint: 'start' | 'finish',
  sourceBar: Rect,
  targetBar: Rect,
  dayWidth: number,
  reserved: DependencySegment[],
  sourceKey: string,
): Point[] {
  const laneY = Math.max(sourceBar.bottom, targetBar.bottom) + 5
  const finishArrival = targetEndpoint === 'finish'
  const arrow: Point = finishArrival
    ? { x: targetBar.right, y: targetBar.bottom + 5 }
    : { x: target.x - Math.max(1, dayWidth), y: target.y }
  const exit = sourceEndpoint === 'start' ? source : { x: source.x + 16, y: source.y }
  const prefix: Point[] = sourceEndpoint === 'start'
    ? [source, { x: source.x, y: laneY }]
    : [source, exit, { x: exit.x, y: laneY }]

  if (arrow.x <= exit.x) return []
  const offsets = finishArrival ? [0] : Array.from({ length: 12 }, (_, index) => 10 + index * 6)
  for (const offset of offsets) {
    const turnX = arrow.x - offset
    if (turnX <= exit.x) continue
    const raw: Point[] = finishArrival
      ? [...prefix, arrow]
      : [...prefix, { x: turnX, y: laneY }, { x: turnX, y: arrow.y }, arrow]
    const points = raw.filter((point, index) =>
      index === 0 || point.x !== raw[index - 1].x || point.y !== raw[index - 1].y
    )
    const verticalConflict = dependencySegments(points, 0, sourceKey).some((part) =>
      reserved.some((taken) => taken.sourceKey !== sourceKey &&
        verticalSegmentsOverlap(part.start, part.end, taken.start, taken.end))
    )
    if (!verticalConflict) return points
  }
  return []
}

function routeHasClearOrthogonalSegments(route: Point[], obstacles: Rect[], bounds: { width: number; height: number }) {
  return route.every((point) => point.x >= 0 && point.x <= bounds.width && point.y >= 4 && point.y <= bounds.height)
    && route.slice(0, -1).every((point, index) => {
      const next = route[index + 1]
      return (point.x === next.x || point.y === next.y)
        && !obstacles.some((obstacle) => segmentIntersectsRect(point, next, obstacle, 4))
    })
}

function verifySyntheticFfUnderBars() {
  const bounds = { width: 600, height: 350, dayWidth: 20 }
  const sourceBar: BarObstacle = { left: 220, right: 350, top: 195, bottom: 215, cardId: 1 }
  const aboveBar: BarObstacle = { left: 260, right: 430, top: 75, bottom: 95, cardId: 2 }
  // Wide predecessor/successor combinations must not force a detour around
  // the bar that the vertical line does not actually cross.
  const wideAboveBar: BarObstacle = { left: 80, right: 430, top: 75, bottom: 95, cardId: 5 }
  const belowBar: BarObstacle = { left: 260, right: 430, top: 255, bottom: 275, cardId: 3 }
  const crowdedNextBar: BarObstacle = { left: 260, right: 460, top: 105, bottom: 125, cardId: 4 }
  const source = { x: 375, y: 205 }

  const findRoute = (targetBar: BarObstacle, reserved: DependencySegment[] = []) =>
    routeDependency(
      source,
      { x: targetBar.right + 25, y: (targetBar.top + targetBar.bottom) / 2 },
      [sourceBar, targetBar],
      'finish',
      'finish',
      bounds,
      [],
      reserved,
      '1:finish',
      1,
      targetBar.cardId,
      targetBar,
      sourceBar,
    )

  const upperRoute = findRoute(aboveBar)
  const wideUpperRoute = findRoute(wideAboveBar)
  const lowerRoute = findRoute(belowBar)
  // Different sources may freely share a horizontal track.
  const occupiedHorizontal: DependencySegment[] = [{
    start: { x: 5, y: source.y + 15 },
    end: { x: bounds.width - 5, y: source.y + 15 },
    sourceKey: 'other:finish',
    dependencyId: 998,
  }]
  const sharedHorizontalRoute = findRoute(aboveBar, occupiedHorizontal)
  // A bar immediately below the target left only a 10px gap. The arrow must
  // remain in the middle of that gap, never 6px down plus a 4px exclusion.
  const crowdedRoute = routeDependency(
    source,
    { x: aboveBar.right + 25, y: (aboveBar.top + aboveBar.bottom) / 2 },
    [sourceBar, aboveBar, crowdedNextBar],
    'finish', 'finish', bounds, [], [], '1:finish', 1, aboveBar.cardId, aboveBar, sourceBar,
  )
  const reserved: DependencySegment[] = [{
    start: { x: 180, y: 100 },
    end: { x: 180, y: 230 },
    sourceKey: '999:finish',
    dependencyId: 999,
  }]
  const divertedRoute = findRoute(aboveBar, reserved)

  function followsFfShape(route: Point[], targetBar: BarObstacle, expectedTurnX: number) {
    const final = route.at(-1)
    const previous = route.at(-2)
    return route.length === 6
      && route[0].x === source.x && route[0].y === source.y
      && route[1].x === source.x + 16 && route[1].y === source.y
      && route[2].x === route[1].x && route[2].y === sourceBar.bottom + 5
      && route[3].x === expectedTurnX && route[3].y === route[2].y
      && route[4].x === expectedTurnX && route[4].y === targetBar.bottom + 5
      && final?.x === targetBar.right && final?.y === targetBar.bottom + 5
      && previous?.y === final.y && previous.x < final.x
      && routeHasClearOrthogonalSegments(route, [sourceBar, targetBar], bounds)
  }

  return followsFfShape(upperRoute, aboveBar, 180)
    && followsFfShape(wideUpperRoute, wideAboveBar, 180)
    && followsFfShape(lowerRoute, belowBar, 220)
    && followsFfShape(divertedRoute, aboveBar, 160)
    && followsFfShape(sharedHorizontalRoute, aboveBar, 180)
    && crowdedRoute.length > 0
    && crowdedRoute.at(-1)?.y === aboveBar.bottom + 5
    && verticalSegmentsOverlap({ x: 10, y: 10 }, { x: 10, y: 60 }, { x: 10, y: 40 }, { x: 10, y: 90 })
    && !verticalSegmentsOverlap({ x: 10, y: 10 }, { x: 10, y: 60 }, { x: 10, y: 60 }, { x: 10, y: 90 })
    && !verticalSegmentsOverlap({ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 30, y: 10 }, { x: 80, y: 10 })
    && !verticalSegmentsOverlap({ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 30, y: 0 }, { x: 30, y: 30 })
}

function verifySyntheticSfFinishArrival() {
  const bounds = { width: 620, height: 350, dayWidth: 20 }
  const sourceBar: BarObstacle = { left: 220, right: 350, top: 195, bottom: 215, cardId: 1 }
  const aboveBar: BarObstacle = { left: 260, right: 430, top: 75, bottom: 95, cardId: 2 }
  const belowBar: BarObstacle = { left: 260, right: 430, top: 255, bottom: 275, cardId: 3 }
  const start = { x: 195, y: 205 }
  const routeTo = (bar: BarObstacle, connectors: ConnectorObstacle[] = [], reserved: DependencySegment[] = []) =>
    routeDependency(start, { x: bar.right + 25, y: (bar.top + bar.bottom) / 2 },
      [sourceBar, bar], 'start', 'finish', bounds, connectors, reserved, '1:start', 1, bar.cardId, bar)

  const above = routeTo(aboveBar)
  const below = routeTo(belowBar)
  const blockedByConnector = routeTo(aboveBar,
    [{ cardId: 8, endpoint: 'start', left: 170, right: 180, top: 135, bottom: 155 }])
  const blockedByVertical = routeTo(aboveBar, [], [{
    start: { x: 175, y: 130 },
    end: { x: 175, y: 185 },
    sourceKey: '8:start',
    dependencyId: 99,
  }])
  const clearRoute = (points: Point[], targetBar: BarObstacle) =>
    points.length >= 3
    && points[0].x === start.x && points[0].y === start.y
    && points[1].x === start.x && points[1].y === start.y + 15
    && points.at(-1)?.x === targetBar.right
    && points.at(-1)?.y === targetBar.bottom + 5
    && points.at(-2)?.y === targetBar.bottom + 5
    && (points.at(-2)?.x ?? Infinity) < targetBar.right
    && routeHasClearOrthogonalSegments(points, [sourceBar, targetBar], bounds)

  return clearRoute(above, aboveBar)
    && clearRoute(below, belowBar)
    && clearRoute(blockedByConnector, aboveBar)
    && clearRoute(blockedByVertical, aboveBar)
    && above.some((point) => point.x === 175)
    && below.some((point) => point.x === start.x)
    && blockedByConnector.some((point) => point.x === 155)
    && blockedByVertical.some((point) => point.x === 155)
}

function verifySyntheticFsMinimalRoute() {
  const bounds = { width: 440, height: 210, dayWidth: 20 }
  const sourceBar: BarObstacle = { left: 32, right: 110, top: 35, bottom: 55, cardId: 1 }
  const targetBar: BarObstacle = { left: 351, right: 425, top: 95, bottom: 115, cardId: 2 }
  const thirdBar: BarObstacle = { left: 146, right: 164, top: 75, bottom: 95, cardId: 3 }
  const source = { x: 135, y: 45 }
  const target = { x: 326, y: 105 }
  const sourceKey = '1:finish'
  const route = (connectors: ConnectorObstacle[] = [], reserved: DependencySegment[] = []) =>
    routeDependency(source, target, [sourceBar, targetBar, thirdBar], 'finish', 'start',
      bounds, connectors, reserved, sourceKey, 1, 2)

  const direct = route()
  const blockedByConnector = route([{
    left: 144, right: 158, top: 77, bottom: 87, cardId: 3, endpoint: 'start',
  }])
  const blockedByReservedVertical = route([], [{
    start: { x: 151, y: 65 },
    end: { x: 151, y: 95 },
    sourceKey: '3:finish',
    dependencyId: 100,
  }])

  function isCompactFs(points: Point[]) {
    return points.length === 4
      && points[0].x === source.x && points[0].y === source.y
      && points[1].x === source.x + 16 && points[1].y === source.y
      && points[2].x === points[1].x && points[2].y === target.y
      && points[3].x === target.x - bounds.dayWidth && points[3].y === target.y
  }

  return isCompactFs(direct)
    && blockedByConnector.length > direct.length
    && blockedByReservedVertical.length > direct.length
    && blockedByConnector.at(-1)?.x === target.x - bounds.dayWidth
    && blockedByReservedVertical.at(-1)?.x === target.x - bounds.dayWidth
}

if (import.meta.env.DEV) {
  console.assert(
    verifySyntheticSfFinishArrival(),
    'SF must depart Start vertically and finish beneath the successor with the same marker as FF.',
  )
  console.assert(
    verifySyntheticFsMinimalRoute(),
    'FS must use its shortest valid Finish-exit/Start-entry route before trying detours.',
  )
  console.assert(
    verifySyntheticFfUnderBars(),
    'FF must skirt the predecessor underneath, travel by a free exterior lane and finish under the successor.',
  )
}

function timelineRange(cards: Card[]) {
  const plannedCards = cards.filter(planned)
  if (plannedCards.length === 0) {
    const today = dateKey(new Date())
    return { start: shift(today, -7), end: shift(today, 14) }
  }

  const start = plannedCards.reduce((value, card) => card.start_date! < value ? card.start_date! : value, plannedCards[0].start_date!)
  const end = plannedCards.reduce((value, card) => card.due_date! > value ? card.due_date! : value, plannedCards[0].due_date!)
  // Start arrivals reserve two days for the arrow and at least a third for
  // the first possible turn. Provide a little additional conflict space.
  // Compact zooms need more than two day-cells after Finish: connector
  // anchors and the 16px horizontal departure may extend over 40px.
  return { start: shift(start, -6), end: shift(end, 5) }
}

function buildDays(start: string, endInclusive: string): Day[] {
  return Array.from({ length: daysBetween(start, endInclusive) + 1 }, (_, index) => {
    const key = shift(start, index)
    return { key, date: parseDay(key) }
  })
}

function monday(value: string) {
  const date = parseDay(value)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return dateKey(date)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'UTC' }).format(date)
}

function compactDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseDay(value)).replace('.', '') : '—'
}

function compareGanttCards(first: GanttCard, second: GanttCard) {
  const startComparison = compareOptionalDates(first.card.start_date, second.card.start_date)
  if (startComparison !== 0) {
    return startComparison
  }

  const dueComparison = compareOptionalDates(first.card.due_date, second.card.due_date)
  if (dueComparison !== 0) {
    return dueComparison
  }

  return first.card.position - second.card.position || first.card.id - second.card.id
}

function compareOptionalDates(first?: string | null, second?: string | null) {
  if (first === null || first === undefined) {
    return second === null || second === undefined ? 0 : 1
  }

  if (second === null || second === undefined) {
    return -1
  }

  return first.localeCompare(second)
}

function topologicallySortSameStartCards(cards: GanttCard[]) {
  const cardsById = new Map(cards.map((item) => [item.card.id, item]))
  const outgoing = new Map<number, Set<number>>()
  const indegree = new Map(cards.map((item) => [item.card.id, 0]))

  function addEdge(predecessorId: number, successorId: number) {
    if (!cardsById.has(predecessorId) || !cardsById.has(successorId)) {
      return
    }

    const successors = outgoing.get(predecessorId) ?? new Set<number>()
    if (successors.has(successorId)) {
      return
    }

    successors.add(successorId)
    outgoing.set(predecessorId, successors)
    indegree.set(successorId, (indegree.get(successorId) ?? 0) + 1)
  }

  cards.forEach((item) => {
    item.card.dependencies?.predecessors.forEach((dependency) => {
      addEdge(dependency.card_id, item.card.id)
    })
    item.card.dependencies?.successors.forEach((dependency) => {
      addEdge(item.card.id, dependency.card_id)
    })
  })

  const ready = cards.filter((item) => indegree.get(item.card.id) === 0).sort(compareGanttCards)
  const ordered: GanttCard[] = []

  while (ready.length > 0) {
    const current = ready.shift()!
    ordered.push(current)

    outgoing.get(current.card.id)?.forEach((successorId) => {
      const nextIndegree = (indegree.get(successorId) ?? 0) - 1
      indegree.set(successorId, nextIndegree)
      if (nextIndegree === 0) {
        ready.push(cardsById.get(successorId)!)
        ready.sort(compareGanttCards)
      }
    })
  }

  if (ordered.length < cards.length) {
    const orderedIds = new Set(ordered.map((item) => item.card.id))
    ordered.push(...cards.filter((item) => !orderedIds.has(item.card.id)).sort(compareGanttCards))
  }

  return ordered
}

function sortGanttCards(cards: GanttCard[]) {
  const baseline = [...cards].sort(compareGanttCards)
  const sorted: GanttCard[] = []
  let index = 0

  while (index < baseline.length) {
    const startDate = baseline[index].card.start_date
    let end = index + 1
    while (end < baseline.length && baseline[end].card.start_date === startDate) {
      end += 1
    }

    const bucket = baseline.slice(index, end)
    sorted.push(...(startDate ? topologicallySortSameStartCards(bucket) : bucket))
    index = end
  }

  return sorted
}

function categoryGroups(board: BoardPayload, columns: BoardPayload['columns']): CategoryGroup[] {
  const items = columns.flatMap((column) => column.cards.map((card) => ({ card, column })))
  const groups = board.categories.map((category) => ({
    id: String(category.id),
    name: category.name,
    cards: sortGanttCards(items.filter(({ card }) => card.category_id === category.id)),
  }))
  const uncategorized = sortGanttCards(items.filter(({ card }) => card.category_id == null))
  if (uncategorized.length > 0) groups.push({ id: 'uncategorized', name: 'Sin categoría', cards: uncategorized })
  return groups.filter((group) => group.cards.length > 0)
}

function weekNumber(days: Day[], index: number) {
  const weekStart = monday(days[index].key)
  const weekEnd = shift(weekStart, 6)
  const weekStartDate = parseDay(weekStart)
  const monthStart = dateKey(new Date(Date.UTC(weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth(), 1)))
  const nextMonthStart = dateKey(new Date(Date.UTC(weekStartDate.getUTCFullYear(), weekStartDate.getUTCMonth() + 1, 1)))
  const labelMonthStart = monthStart >= weekStart && monthStart <= weekEnd ? monthStart : nextMonthStart > weekStart && nextMonthStart <= weekEnd ? nextMonthStart : monthStart

  if (labelMonthStart === nextMonthStart) {
    return 1
  }

  return Math.floor(daysBetween(monday(labelMonthStart), weekStart) / 7) + 1
}

function gridColumn(start: string, value: string) {
  return daysBetween(start, value) + 1
}

function dateEndColumn(start: string, value: string) {
  return gridColumn(start, shift(value, 1))
}

function datesForDrag(card: Card, mode: DragMode, dayDelta: number) {
  const start = card.start_date!
  const due = card.due_date!

  if (mode === 'move') {
    return {
      start: shift(start, dayDelta),
      due: shift(due, dayDelta),
    }
  }

  if (mode === 'resize-start') {
    return {
      start: dateKey(new Date(Math.min(parseDay(shift(start, dayDelta)).getTime(), parseDay(due).getTime()))),
      due,
    }
  }

  return {
    start,
    due: dateKey(new Date(Math.max(parseDay(shift(due, dayDelta)).getTime(), parseDay(start).getTime()))),
  }
}

function isWeekend(day: Day) {
  return day.date.getUTCDay() === 0 || day.date.getUTCDay() === 6
}

function readVisibility(storageKey: string): Visibility {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<Visibility> | null

    if (
      value
      && typeof value.start === 'boolean'
      && typeof value.end === 'boolean'
      && typeof value.progress === 'boolean'
    ) {
      return value as Visibility
    }
  } catch {
    return DEFAULT_COLUMNS
  }

  return DEFAULT_COLUMNS
}

function readCollapsed(storageKey: string) {
  return localStorage.getItem(storageKey) === 'true'
}

function visibleColumnTemplate(visibility: Visibility) {
  return [
    'minmax(200px, 1fr)',
    visibility.start ? '55px' : null,
    visibility.end ? '55px' : null,
    visibility.progress ? '70px' : null,
  ].filter(Boolean).join(' ')
}

function leftWidth(visibility: Visibility) {
  return TASK_WIDTH
    + (visibility.start ? 55 : 0)
    + (visibility.end ? 55 : 0)
    + (visibility.progress ? 70 : 0)
}

function monthSpans(days: Day[]) {
  const spans: { label: string; start: number; end: number }[] = []
  days.forEach((day, index) => {
    const label = formatMonth(day.date)
    const last = spans.at(-1)
    if (last?.label === label) last.end = index + 2
    else spans.push({ label, start: index + 1, end: index + 2 })
  })
  return spans
}

function yearSpans(days: Day[]) {
  const spans: { label: string; start: number; end: number }[] = []

  days.forEach((day, index) => {
    const label = String(day.date.getUTCFullYear())
    const last = spans.at(-1)

    if (last?.label === label) {
      last.end = index + 2
    } else {
      spans.push({ label, start: index + 1, end: index + 2 })
    }
  })

  return spans
}

function quarterSpans(days: Day[], includeYear: boolean) {
  const spans: { label: string; start: number; end: number }[] = []

  days.forEach((day, index) => {
    const quarter = Math.floor(day.date.getUTCMonth() / 3) + 1
    const label = includeYear
      ? `T${quarter} ${day.date.getUTCFullYear()}`
      : `T${quarter}`
    const last = spans.at(-1)

    if (last?.label === label) {
      last.end = index + 2
    } else {
      spans.push({ label, start: index + 1, end: index + 2 })
    }
  })

  return spans
}

function categoryRange(group: CategoryGroup, timelineStart: string) {
  const stats = categoryStats(group)
  if (!stats.start || !stats.end) return null
  return `${gridColumn(timelineStart, stats.start)} / ${dateEndColumn(timelineStart, stats.end)}`
}

function categoryStats(group: CategoryGroup): CategoryStats {
  const plannedCards = group.cards.filter(hasTemporalPlanning)
  const startDates = plannedCards.map(({ card }) => card.start_date).filter((value): value is string => Boolean(value))
  const endDates = plannedCards.map(({ card }) => card.due_date).filter((value): value is string => Boolean(value))
  const progressTotal = group.cards.reduce((total, item) => total + cardVisualProgress(item), 0)

  return {
    start: startDates.length > 0 ? startDates.reduce((value, date) => date < value ? date : value, startDates[0]) : null,
    end: endDates.length > 0 ? endDates.reduce((value, date) => date > value ? date : value, endDates[0]) : null,
    progress: group.cards.length > 0 ? Math.round(progressTotal / group.cards.length) : null,
  }
}

function weekSpans(days: Day[]) {
  const spans: { label: string; start: number; end: number }[] = []
  let lastWeek = ''
  days.forEach((day, index) => {
    const startOfWeek = monday(day.key)
    const last = spans.at(-1)
    if (last && lastWeek === startOfWeek) {
      last.end = index + 2
      return
    }

    lastWeek = startOfWeek
    spans.push({ label: `S${weekNumber(days, index)}`, start: index + 1, end: index + 2 })
  })
  return spans
}

type GanttProps = {
  board: BoardPayload
  cards: BoardPayload['columns']
  canEdit: boolean
  onOpen: (card: Card) => void
  onChange: () => Promise<void>
}

export function GanttView({ board, cards, canEdit, onOpen, onChange }: GanttProps) {
  const allCards = cards.flatMap((column) => column.workflow_state === 'backlog' ? [] : column.cards)
  const groups = useMemo(() => categoryGroups(board, cards), [board, cards])
  const [zoom, setZoom] = useState<Zoom>(() => (localStorage.getItem(`tickard:gantt-zoom:${board.board.id}`) as Zoom) || 'week')
  const visibilityStorageKey = `tickard:gantt-columns:${board.board.id}`
  const [visibility, setVisibility] = useState<Visibility>(() => readVisibility(visibilityStorageKey))
  const leftCollapsedStorageKey = `tickard:gantt-left-collapsed:${board.board.id}`
  const [leftCollapsed, setLeftCollapsed] = useState(() => readCollapsed(leftCollapsedStorageKey))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)
  const [dependencyPopover, setDependencyPopover] = useState<DependencyPopover | null>(null)
  const [dependencyCreation, setDependencyCreation] = useState<DependencyCreation | null>(null)
  const [hoveredCard, setHoveredCard] = useState<HoveredCard | null>(null)
  const suppressClickRef = useRef<number | null>(null)
  const timelineGridRef = useRef<HTMLDivElement>(null)
  const dependencyAnchorRefs = useRef(new Map<string, HTMLSpanElement>())
  const [dependencyGeometry, setDependencyGeometry] = useState<DependencyGeometry>({ width: 0, height: 0, dayWidth: 0, anchors: {}, obstacles: [], connectors: [], externalRefs: {} })
  const toolbarRef = useRef<HTMLDivElement>(null)
  const leftToolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarMinWidth, setToolbarMinWidth] = useState(0)
  const collapsedStorageKey = `tickard:gantt-collapsed:${board.board.id}`
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(collapsedStorageKey) ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const ganttDependencies = useMemo(() => {
    const cardsById = new Map(groups.flatMap((group) => group.cards).map((item) => [item.card.id, item.card]))
    const dependencies = new Map<number, GanttDependency>()

    groups.flatMap((group) => group.cards).forEach(({ card }) => {
      card.dependencies?.predecessors.forEach((dependency) => {
        if (cardsById.has(dependency.card_id) && cardsById.has(card.id)) {
          dependencies.set(dependency.id, { ...dependency, predecessorId: dependency.card_id, successorId: card.id })
        }
      })
      card.dependencies?.successors.forEach((dependency) => {
        if (cardsById.has(dependency.card_id) && cardsById.has(card.id)) {
          dependencies.set(dependency.id, { ...dependency, predecessorId: card.id, successorId: dependency.card_id })
        }
      })
    })

    return [...dependencies.values()]
  }, [groups])
  const externalDependencies = useMemo(() => {
    const external = new Map<number, ExternalGanttDependency>()
    groups.flatMap((group) => group.cards).forEach(({ card }) => {
      card.dependencies?.predecessors.forEach((dependency) => {
        if (dependency.board_id !== undefined && dependency.board_id !== board.board.id) {
          external.set(dependency.id, { ...dependency, localCardId: card.id, direction: 'incoming' })
        }
      })
      card.dependencies?.successors.forEach((dependency) => {
        if (dependency.board_id !== undefined && dependency.board_id !== board.board.id) {
          external.set(dependency.id, { ...dependency, localCardId: card.id, direction: 'outgoing' })
        }
      })
    })
    return [...external.values()]
  }, [groups, board.board.id])
  const externalByCard = useMemo(() => {
    const result = new Map<number, { incoming: ExternalGanttDependency[]; outgoing: ExternalGanttDependency[] }>()
    externalDependencies.forEach((dependency) => {
      if (!result.has(dependency.localCardId)) {
        result.set(dependency.localCardId, { incoming: [], outgoing: [] })
      }
      result.get(dependency.localCardId)![dependency.direction].push(dependency)
    })
    return result
  }, [externalDependencies])
  const baseRange = timelineRange(allCards)
  // Extra space on the left is for undated incoming board references; their
  // position never depends on the remote Card's start or due date.
  const range = externalDependencies.some((dependency) => dependency.direction === 'incoming')
    ? { ...baseRange, start: shift(baseRange.start, -16) }
    : baseRange
  const days = buildDays(range.start, range.end)
  const entries: TimelineEntry[] = []
  let row = 3
  groups.forEach((group) => {
    const isCollapsed = Boolean(collapsed[group.id])
    entries.push({ group, row, collapsed: isCollapsed })
    row += 1 + (isCollapsed ? 0 : group.cards.length)
  })

  const totalDays = days.length
  const totalLeftWidth = leftWidth(visibility)
  const gridStyle = {
    '--total-days': totalDays,
    '--data-rows': row - 3,
    '--left-columns': visibleColumnTemplate(visibility),
    '--left-width': `${totalLeftWidth}px`,
  } as GanttGridStyle

  useEffect(() => {
    localStorage.setItem(`tickard:gantt-zoom:${board.board.id}`, zoom)
  }, [board.board.id, zoom])

  useEffect(() => {
    localStorage.setItem(collapsedStorageKey, JSON.stringify(collapsed))
  }, [collapsedStorageKey, collapsed])

  useEffect(() => {
    localStorage.setItem(visibilityStorageKey, JSON.stringify(visibility))
  }, [visibility, visibilityStorageKey])

  useEffect(() => {
    localStorage.setItem(leftCollapsedStorageKey, String(leftCollapsed))
  }, [leftCollapsedStorageKey, leftCollapsed])

  useEffect(() => {
    if (!columnsOpen) {
      return
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setColumnsOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)

    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [columnsOpen])

  useLayoutEffect(() => {
    if (leftCollapsed || !leftToolbarRef.current) {
      return
    }

    const toolbar = leftToolbarRef.current
    const updateToolbarWidth = () => {
      const controls = Array.from(toolbar.children).filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
      const toolbarStyles = getComputedStyle(toolbar)
      const horizontalPadding = parseFloat(toolbarStyles.paddingLeft) + parseFloat(toolbarStyles.paddingRight)
      const gap = parseFloat(toolbarStyles.columnGap || toolbarStyles.gap) || 0
      const controlsWidth = controls.reduce((total, control) => total + control.getBoundingClientRect().width, 0)
      const measuredWidth = Math.ceil(horizontalPadding + controlsWidth + gap * Math.max(0, controls.length - 1))

      setToolbarMinWidth((currentWidth) => currentWidth === measuredWidth ? currentWidth : measuredWidth)
    }
    const observer = new ResizeObserver(updateToolbarWidth)

    updateToolbarWidth()
    Array.from(toolbar.children)
      .filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
      .forEach((control) => observer.observe(control))

    return () => observer.disconnect()
  }, [leftCollapsed])

  useLayoutEffect(() => {
    const grid = timelineGridRef.current
    if (!grid) {
      return
    }

    const measureDependencyGeometry = () => {
      const gridRect = grid.getBoundingClientRect()
      const anchors: Record<string, Point> = {}
      dependencyAnchorRefs.current.forEach((element, key) => {
        const rect = element.getBoundingClientRect()
        anchors[key] = {
          x: rect.left + rect.width / 2 - gridRect.left,
          y: rect.top + rect.height / 2 - gridRect.top,
        }
      })
      const obstacles = [...grid.querySelectorAll<HTMLElement>('[data-gantt-card-bar="true"]')].map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          cardId: Number(element.dataset.cardId),
          left: rect.left - gridRect.left,
          right: rect.right - gridRect.left,
          top: rect.top - gridRect.top,
          bottom: rect.bottom - gridRect.top,
        }
      })
      const connectors = [...dependencyAnchorRefs.current.entries()].map(([key, element]) => {
        const rect = element.getBoundingClientRect()
        const [cardId, endpoint] = key.split(':') as [string, 'start' | 'finish']

        return {
          cardId: Number(cardId),
          endpoint,
          left: rect.left - gridRect.left,
          right: rect.right - gridRect.left,
          top: rect.top - gridRect.top,
          bottom: rect.bottom - gridRect.top,
        }
      })
      const externalRefs: Record<number, Rect> = {}
      grid.querySelectorAll<HTMLElement>('[data-gantt-external-dependency]').forEach((element) => {
        const rect = element.getBoundingClientRect()
        externalRefs[Number(element.dataset.ganttExternalDependency)] = {
          left: rect.left - gridRect.left,
          right: rect.right - gridRect.left,
          top: rect.top - gridRect.top,
          bottom: rect.bottom - gridRect.top,
        }
      })
      const nextGeometry = {
        width: gridRect.width,
        height: gridRect.height,
        dayWidth: gridRect.width / Math.max(totalDays, 1),
        anchors,
        obstacles,
        connectors,
        externalRefs,
      }

      setDependencyGeometry((current) => JSON.stringify(current) === JSON.stringify(nextGeometry) ? current : nextGeometry)
    }

    const observer = new ResizeObserver(measureDependencyGeometry)
    observer.observe(grid)
    measureDependencyGeometry()
    window.addEventListener('scroll', measureDependencyGeometry, true)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', measureDependencyGeometry, true)
    }
  }, [collapsed, dependencyCreation, dragPreview, ganttDependencies, externalDependencies, leftCollapsed, totalDays, visibility, zoom])

  function beginDrag(event: ReactPointerEvent, item: GanttCard, mode: DragMode) {
    if (!canEdit || !item.card.start_date || !item.card.due_date || !timelineGridRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setHoveredCard(null)
    setDragError(null)

    const timelineWidth = timelineGridRef.current.getBoundingClientRect().width
    const dayWidth = timelineWidth / days.length
    setDragState({
      card: item.card,
      mode,
      pointerStartX: event.clientX,
      dayWidth,
    })
    setDragPreview({ cardId: item.card.id, start: item.card.start_date, due: item.card.due_date })
  }

  function updateHoveredCard(event: { currentTarget: HTMLElement }, card: Card | NonNullable<CardDependency['preview']>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const width = 230
    const height = 220
    const gap = 8
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    const top = rect.bottom + gap + height <= window.innerHeight
      ? rect.bottom + gap
      : Math.max(8, rect.top - height - gap)

    setHoveredCard({ card, left, top })
  }

  function openExternalDependency(dependency: ExternalGanttDependency, x: number, y: number) {
    setHoveredCard(null)
    setDependencyPopover({
      dependency: {
        ...dependency,
        predecessorId: dependency.direction === 'incoming' ? dependency.card_id : dependency.localCardId,
        successorId: dependency.direction === 'incoming' ? dependency.localCardId : dependency.card_id,
      },
      x,
      y,
    })
  }

  function renderExternalReference(dependency: ExternalGanttDependency) {
    const boardName = dependency.board_name || 'Otro tablero'
    const label = `${dependency.direction === 'incoming' ? 'Entra desde' : 'Sale hacia'} ${boardName}: ${dependency.title} (${dependency.type.toUpperCase()})`
    return (
      <span
        key={dependency.id}
        className={styles.externalReference}
        data-gantt-external-dependency={dependency.id}
        title={label}
        role="button"
        tabIndex={0}
        aria-label={label}
        onPointerEnter={(event) => { if (dependency.preview) updateHoveredCard(event, dependency.preview) }}
        onPointerMove={(event) => { if (dependency.preview) updateHoveredCard(event, dependency.preview) }}
        onPointerLeave={clearHoveredCard}
        onFocus={(event) => { if (dependency.preview) updateHoveredCard(event, dependency.preview) }}
        onBlur={clearHoveredCard}
        onClick={(event) => openExternalDependency(dependency, event.clientX, event.clientY)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            openExternalDependency(dependency, rect.left + rect.width / 2, rect.bottom)
          }
        }}
      >
        <span>{boardName}</span>
        <small>{dependency.type.toUpperCase()}</small>
      </span>
    )
  }

  function clearHoveredCard() {
    setHoveredCard(null)
  }

  const monthRows = monthSpans(days)
  const yearRows = yearSpans(days)
  const quarterRows = quarterSpans(days, false)
  const monthQuarterRows = quarterSpans(days, true)
  const weekRows = weekSpans(days)
  const showWeeks = zoom === 'week'
  const showMonths = zoom === 'month'
  const showQuarters = zoom === 'quarter'
  const today = dateKey(new Date())
  const todayColumn = gridColumn(range.start, today)
  const todayVisible = today >= range.start && today <= range.end
  const effectiveLeftWidth = Math.max(totalLeftWidth, toolbarMinWidth)
  const maxOutgoingReferences = Math.max(0, ...[...externalByCard.values()].map((items) => items.outgoing.length))
  const timelineRightReserve = leftCollapsed || maxOutgoingReferences > 0
    ? (leftCollapsed ? 360 : 160) + maxOutgoingReferences * 170
    : 0
  const cardRows = useMemo(() => {
    const result = new Map<number, { item: GanttCard; row: number }>()
    entries.forEach(({ group, row: groupRow, collapsed: isCollapsed }) => {
      if (!isCollapsed) {
        group.cards.forEach((item, index) => result.set(item.card.id, { item, row: groupRow + index + 1 }))
      }
    })
    return result
  }, [groups, collapsed])

  const externalRoutes = useMemo(() => {
    const routes = new Map<number, { points: Point[]; targetBar: Rect }>()
    if (!dependencyGeometry.width || !dependencyGeometry.height) return routes

    const reserved: DependencySegment[] = []
    externalDependencies.forEach((dependency) => {
      const local = cardRows.get(dependency.localCardId)
      const localBar = dependencyGeometry.obstacles.find((bar) => bar.cardId === dependency.localCardId)
      const remote = dependencyGeometry.externalRefs[dependency.id]
      if (!local || !hasTemporalPlanning(local.item) || !localBar || !remote) return

      const sourceEndpoint = dependency.type === 'ss' || dependency.type === 'sf' ? 'start' : 'finish'
      const targetEndpoint = dependency.type === 'ff' || dependency.type === 'sf' ? 'finish' : 'start'
      const outgoing = dependency.direction === 'outgoing'
      const sourceBar = outgoing ? localBar : remote
      const targetBar = outgoing ? remote : localBar
      const source = outgoing
        ? dependencyGeometry.anchors[`${dependency.localCardId}:${sourceEndpoint}`]
        : { x: sourceEndpoint === 'start' ? remote.left - 25 : remote.right + 25, y: (remote.top + remote.bottom) / 2 }
      const target = outgoing
        ? { x: targetEndpoint === 'start' ? remote.left - 25 : remote.right + 25, y: (remote.top + remote.bottom) / 2 }
        : dependencyGeometry.anchors[`${dependency.localCardId}:${targetEndpoint}`]
      if (!source || !target) return

      const sourceKey = `${outgoing ? dependency.localCardId : dependency.card_id}:${sourceEndpoint}`
      const points = routeExternalDependency(source, target, sourceEndpoint, targetEndpoint,
        sourceBar, targetBar, dependencyGeometry.dayWidth, reserved, sourceKey)
      if (!points.length) return
      routes.set(dependency.id, { points, targetBar })
      reserved.push(...dependencySegments(points, dependency.id, sourceKey))
    })
    return routes
  }, [cardRows, dependencyGeometry, externalDependencies])

  const plannedDependencyRoutes = useMemo(() => {
    const routes = new Map<number, Point[]>()
    const reservedSegments: DependencySegment[] = []

    ganttDependencies.forEach((dependency) => {
      const predecessor = cardRows.get(dependency.predecessorId)
      const successor = cardRows.get(dependency.successorId)
      if (!predecessor || !successor || !hasTemporalPlanning(predecessor.item) || !hasTemporalPlanning(successor.item)) {
        return
      }

      const sourceEndpoint = dependency.type === 'ss' || dependency.type === 'sf' ? 'start' : 'finish'
      const targetEndpoint = dependency.type === 'ff' || dependency.type === 'sf' ? 'finish' : 'start'
      const source = dependencyGeometry.anchors[`${dependency.predecessorId}:${sourceEndpoint}`]
      const target = dependencyGeometry.anchors[`${dependency.successorId}:${targetEndpoint}`]
      if (!source || !target) {
        return
      }

      const sourceKey = `${dependency.predecessorId}:${sourceEndpoint}`
      const route = routeDependency(
        source,
        target,
        dependencyGeometry.obstacles,
        sourceEndpoint,
        targetEndpoint,
        dependencyGeometry,
        dependencyGeometry.connectors.filter((connector) => connector.cardId !== dependency.predecessorId && connector.cardId !== dependency.successorId),
        reservedSegments,
        sourceKey,
        dependency.predecessorId,
        dependency.successorId,
        dependency.type === 'ff' || dependency.type === 'sf'
          ? dependencyGeometry.obstacles.find((bar) => bar.cardId === dependency.successorId)
          : undefined,
        dependency.type === 'ff'
          ? dependencyGeometry.obstacles.find((bar) => bar.cardId === dependency.predecessorId)
          : undefined,
      )
      if (route.length === 0) {
        return
      }

      routes.set(dependency.id, route)
      reservedSegments.push(...dependencySegments(route, dependency.id, sourceKey))
    })

    return routes
  }, [cardRows, dependencyGeometry, ganttDependencies])

  const unroutedDependencies = useMemo(() => {
    if (!dependencyGeometry.width || !dependencyGeometry.height) return []
    return ganttDependencies.filter((dependency) => {
      const predecessor = cardRows.get(dependency.predecessorId)
      const successor = cardRows.get(dependency.successorId)
      if (!predecessor || !successor || !hasTemporalPlanning(predecessor.item) || !hasTemporalPlanning(successor.item)) return false
      const from = dependency.type === 'ss' || dependency.type === 'sf' ? 'start' : 'finish'
      const to = dependency.type === 'ff' || dependency.type === 'sf' ? 'finish' : 'start'
      return Boolean(
        dependencyGeometry.anchors[`${dependency.predecessorId}:${from}`]
        && dependencyGeometry.anchors[`${dependency.successorId}:${to}`]
        && !plannedDependencyRoutes.has(dependency.id)
      )
    })
  }, [cardRows, dependencyGeometry, ganttDependencies, plannedDependencyRoutes])

  async function changeDependency(dependency: GanttDependency, type: GanttDependency['type']) {
    await api(`/card-dependencies/${dependency.id}`, { method: 'PATCH', body: JSON.stringify({ type }) })
    setDependencyPopover(null)
    await onChange()
  }

  async function deleteDependency(dependency: GanttDependency) {
    await api(`/card-dependencies/${dependency.id}`, { method: 'DELETE' })
    setDependencyPopover(null)
    await onChange()
  }

  function beginDependencyCreation(event: ReactPointerEvent, cardId: number, endpoint: 'start' | 'finish') {
    if (!canEdit) return
    event.preventDefault()
    event.stopPropagation()
    setHoveredCard(null)
    setDependencyPopover(null)
    setDragError(null)
    setDependencyCreation({ cardId, endpoint, cursorX: event.clientX, cursorY: event.clientY, targetId: null, targetEndpoint: null })
  }

  useEffect(() => {
    if (!dependencyCreation) return

    function handlePointerMove(event: PointerEvent) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-dependency-connector]')
      const targetId = target ? Number(target.dataset.cardId) : null
      const targetEndpoint = target?.dataset.endpoint as 'start' | 'finish' | undefined
      setDependencyCreation((current) => current ? {
        ...current,
        cursorX: event.clientX,
        cursorY: event.clientY,
        targetId: targetId && targetId !== current.cardId ? targetId : null,
        targetEndpoint: targetId && targetId !== current.cardId ? targetEndpoint ?? null : null,
      } : null)
    }

    function handlePointerUp() {
      const creation = dependencyCreation
      setDependencyCreation(null)
      if (!creation?.targetId || !creation.targetEndpoint) return
      const type = creation.endpoint === 'start' && creation.targetEndpoint === 'start'
        ? 'ss'
        : creation.endpoint === 'finish' && creation.targetEndpoint === 'start'
          ? 'fs'
          : creation.endpoint === 'finish' && creation.targetEndpoint === 'finish'
            ? 'ff'
            : 'sf'
      void api(`/cards/${creation.cardId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ successor_card_id: creation.targetId, type }),
      }).then(onChange).catch((error: unknown) => {
        setDragError(error instanceof Error ? error.message : 'No se pudo crear la dependencia.')
      })
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDependencyCreation(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [dependencyCreation, onChange])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const activeDrag = dragState

    function handlePointerMove(event: PointerEvent) {
      const dayDelta = Math.round((event.clientX - activeDrag.pointerStartX) / activeDrag.dayWidth)
      const dates = datesForDrag(activeDrag.card, activeDrag.mode, dayDelta)

      setDragPreview({ cardId: activeDrag.card.id, ...dates })
    }

    function handlePointerUp() {
      const preview = dragPreview
      setDragState(null)

      if (!preview || preview.cardId !== activeDrag.card.id) {
        return
      }

      const changed = preview.start !== activeDrag.card.start_date || preview.due !== activeDrag.card.due_date
      if (!changed) {
        setDragPreview(null)
        return
      }

      suppressClickRef.current = preview.cardId
      void api(`/cards/${preview.cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ start_date: preview.start, due_date: preview.due }),
      }).then(onChange).catch((error: unknown) => {
        setDragError(error instanceof Error ? error.message : 'No se pudieron guardar las fechas.')
      }).finally(() => {
        setDragPreview(null)
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragPreview, dragState, onChange])

  return (
    <div className={styles.gantt} data-zoom={zoom} data-left-collapsed={leftCollapsed} style={{ '--left-width': `${effectiveLeftWidth}px` } as CSSProperties}>
      {dragError && <p className={styles.dragError} role="alert">{dragError}</p>}
      {unroutedDependencies.length > 0 && <div role="status" aria-live="polite" style={{
        position: 'absolute', top: 58, right: 10, zIndex: 8, padding: '5px 9px',
        borderRadius: 6, background: '#fff3d6', color: '#744b0c',
        fontSize: 12, fontWeight: 600, boxShadow: '0 2px 8px #0002',
      }} title={unroutedDependencies.map((dependency) => {
        const from = cardRows.get(dependency.predecessorId)?.item.card.title ?? String(dependency.predecessorId)
        const to = cardRows.get(dependency.successorId)?.item.card.title ?? String(dependency.successorId)
        return `${dependency.type.toUpperCase()}: ${from} → ${to}`
      }).join('\n')}>
        ⚠ {unroutedDependencies.length} dependencia(s) sin trazado. Señaladas en sus orígenes.
      </div>}
      {leftCollapsed ? (
        <button
          className={`${styles.ganttLeft} ${styles.collapsedRail}`}
          type="button"
          title="Expandir panel"
          aria-label="Expandir panel"
          onClick={() => setLeftCollapsed(false)}
        >
          <ExpandColumnIcon />
        </button>
      ) : (
        <div className={styles.ganttLeft} style={gridStyle}>
          <>
            <div ref={(element) => {
              toolbarRef.current = element
              leftToolbarRef.current = element
            }} className={styles.leftToolbar}>
              <button type="button" title="Colapsar panel" aria-label="Colapsar panel" onClick={() => setLeftCollapsed(true)}>
                <CollapseColumnIcon />
              </button>
              {ZOOMS.map((value) => <button key={value} type="button" className={zoom === value ? styles.selected : ''} onClick={() => setZoom(value)}>{value === 'day' ? 'Día' : value === 'week' ? 'Semana' : value === 'month' ? 'Mes' : 'Trimestre'}</button>)}
              <button className={styles.visibilityButton} type="button" title="Columnas" aria-label="Configurar columnas" onClick={() => setColumnsOpen((open) => !open)}>
                <EyeLowVisionIcon />
              </button>
              {columnsOpen && (
                <div className={styles.columnsPopover} role="dialog" aria-label="Columnas">
                  <strong>Columnas</strong>
                  {(['start', 'end', 'progress'] as const).map((column) => (
                    <label key={column} className={styles.columnOption}>
                      <input
                        type="checkbox"
                        checked={visibility[column]}
                        onChange={() => setVisibility((current) => ({ ...current, [column]: !current[column] }))}
                      />
                      {column === 'start' ? 'Inicio' : column === 'end' ? 'Fin' : 'Progreso'}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.leftHeader}><span>Tarea</span>{visibility.start && <span>Inicio</span>}{visibility.end && <span>Fin</span>}{visibility.progress && <span>Progreso</span>}</div>
            {entries.map(({ group, row: groupRow, collapsed: isCollapsed }) => {
          const stats = categoryStats(group)

          return (
            <div key={group.id} className={styles.leftCategory} style={{ gridRow: groupRow }}>
              <div className={styles.categoryInfo}>
                <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))}>{isCollapsed ? '▸' : '▾'} {group.name}</button>
                <small>{group.cards.length}</small>
              </div>
              {visibility.start && <span>{compactDate(stats.start)}</span>}
              {visibility.end && <span>{compactDate(stats.end)}</span>}
              {visibility.progress && <span>{stats.progress === null ? '—' : `${stats.progress}%`}</span>}
            </div>
          )
            })}
            {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => <button key={item.card.id} className={`${styles.leftCard} ${index % 2 === 1 ? styles.leftCardAlternate : ''}`} style={{ gridRow: groupRow + index + 1 }} type="button" onClick={() => onOpen(item.card)}><strong>{item.card.title}</strong>{visibility.start && <span>{compactDate(item.card.start_date)}</span>}{visibility.end && <span>{compactDate(item.card.due_date)}</span>}{visibility.progress && <span>{`${cardVisualProgress(item)}%`}</span>}</button>))}
          </>
        </div>
      )}
        <div className={styles.timelineViewport}>
        <div ref={timelineGridRef} className={styles.timelineGrid} style={{ ...gridStyle, marginRight: timelineRightReserve }}>
          {(showMonths ? monthQuarterRows : showQuarters ? yearRows : monthRows).map((item) => <span key={item.label} className={showMonths || showQuarters ? styles.quarter : styles.month} style={{ gridRow: 1, gridColumn: `${item.start} / ${item.end}` }}>{item.label}</span>)}
          {showMonths && monthRows.map((month) => <span key={`month-${month.label}`} className={styles.month} style={{ gridRow: 2, gridColumn: `${month.start} / ${month.end}` }}>{month.label}</span>)}
          {showQuarters && quarterRows.map((quarter) => <span key={`quarter-${quarter.start}`} className={styles.quarter} style={{ gridRow: 2, gridColumn: `${quarter.start} / ${quarter.end}` }}>{quarter.label}</span>)}
          {!showMonths && !showQuarters && (showWeeks ? weekRows : days.map((day, index) => ({ label: formatDay(day.date), start: index + 1, end: index + 2 }))).map((item) => <span key={`${item.label}-${item.start}`} className={styles.day} style={{ gridRow: 2, gridColumn: `${item.start} / ${item.end}` }}>{item.label}</span>)}
          {entries.map(({ group, row: groupRow }) => <span key={`category-background-${group.id}`} className={styles.categoryRowBackground} style={{ gridRow: groupRow, gridColumn: '1 / -1' }} aria-hidden="true" />)}
          {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => <span key={`task-background-${item.card.id}`} className={`${styles.taskRowBackground} ${index % 2 === 1 ? styles.taskRowAlternate : ''}`} style={{ gridRow: groupRow + index + 1, gridColumn: '1 / -1' }} aria-hidden="true" />))}
          {zoom === 'day' && days.map((day, index) => isWeekend(day) && <span key={`weekend-${day.key}`} className={styles.weekend} style={{ gridRow: '2 / -1', gridColumn: index + 1 }} aria-hidden="true" />)}
          {zoom === 'day' && days.slice(0, -1).map((day, index) => <span key={`day-line-${day.key}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${index + 1} / span 1` }} aria-hidden="true" />)}
          {zoom === 'week' && weekRows.slice(0, -1).map((week) => <span key={`week-line-${week.start}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${week.end - 1} / span 1` }} aria-hidden="true" />)}
          {showMonths && monthRows.slice(0, -1).map((month) => <span key={`month-line-${month.end}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${month.end - 1} / span 1` }} aria-hidden="true" />)}
          {showQuarters && quarterRows.slice(0, -1).map((quarter) => <span key={`quarter-line-${quarter.end}`} className={styles.timeSeparator} style={{ gridRow: '2 / -1', gridColumn: `${quarter.end - 1} / span 1` }} aria-hidden="true" />)}
          {entries.map(({ group, row: groupRow }) => {
            const rangeValue = categoryRange(group, range.start)

            if (!rangeValue) {
              return null
            }

            const stats = categoryStats(group)
            const progress = stats.progress ?? 0
            const summaryStyle = {
              gridRow: groupRow,
              gridColumn: rangeValue,
              '--category-progress': `${progress}%`,
            } as CSSProperties

            return <span key={`summary-${group.id}`} className={styles.categorySummary} style={summaryStyle} aria-hidden="true" />
          })}
          {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.map((item, index) => {
            if (!hasTemporalPlanning(item)) {
              return false
            }

            const cardColor = item.card.color || item.column.color || 'var(--accent)'
            const progress = cardVisualProgress(item)
            const preview = dragPreview?.cardId === item.card.id ? dragPreview : null
            const startDate = preview?.start ?? item.card.start_date!
            const dueDate = preview?.due ?? item.card.due_date!
            const cardStyle = {
              gridRow: groupRow + index + 1,
              gridColumn: `${gridColumn(range.start, startDate)} / ${dateEndColumn(range.start, dueDate)}`,
              '--card-color': cardColor,
              '--card-progress': `${progress}%`,
            } as CardBarStyle

            const cardClassName = [
              styles.cardBar,
              item.column.workflow_state === 'pending' ? styles.pendingBar : '',
              preview ? styles.dragging : '',
              dependencyCreation ? styles.dependencyCreating : '',
            ].filter(Boolean).join(' ')

            const inReview = item.column.workflow_state === 'review'
            const isDone = item.column.workflow_state === 'done'
            const cardLabel = inReview
              ? `${item.card.title}, En revisión`
              : isDone
                ? `${item.card.title}, Completado`
                : item.card.title

            const dateLabel = `${compactDate(startDate)} — ${compactDate(dueDate)}`
            const workflowLabel = item.column.workflow_state === 'in_progress'
              ? 'En progreso'
              : item.column.workflow_state === 'review'
                ? 'En revisión'
                : item.column.workflow_state === 'done'
                  ? 'Completado'
                  : item.column.workflow_state === 'pending'
                    ? 'Pendiente'
                    : 'Backlog'

            void workflowLabel

            return (
              <button
                key={item.card.id}
                className={cardClassName}
                data-card-id={item.card.id}
                data-gantt-card-bar="true"
                type="button"
                onClick={() => {
                  if (suppressClickRef.current === item.card.id) {
                    suppressClickRef.current = null
                    return
                  }

                  onOpen(item.card)
                }}
                onPointerDown={(event) => beginDrag(event, item, 'move')}
                onPointerEnter={(event) => updateHoveredCard(event, item.card)}
                onPointerMove={(event) => updateHoveredCard(event, item.card)}
                onPointerLeave={clearHoveredCard}
                style={cardStyle}
                title={cardLabel}
                aria-label={cardLabel}
              >
                <span ref={(element) => { if (element) dependencyAnchorRefs.current.set(`${item.card.id}:start`, element); else dependencyAnchorRefs.current.delete(`${item.card.id}:start`) }} className={`${styles.dependencyConnector} ${styles.dependencyConnectorStart}`} data-dependency-connector="true" data-card-id={item.card.id} data-endpoint="start" data-readonly={!canEdit ? 'true' : undefined} data-target={dependencyCreation?.targetId === item.card.id && dependencyCreation.targetEndpoint === 'start' ? 'true' : undefined} onPointerDown={canEdit ? (event) => beginDependencyCreation(event, item.card.id, 'start') : undefined} role={canEdit ? 'button' : undefined} aria-hidden={!canEdit} aria-label={canEdit ? `Crear dependencia desde inicio de ${item.card.title}` : undefined} tabIndex={canEdit ? 0 : -1}><DependencyConnectorIcon /></span>
                {canEdit && <span className={`${styles.resizeHandle} ${styles.resizeHandleStart}`} onPointerDown={(event) => beginDrag(event, item, 'resize-start')} aria-hidden="true" />}
                {preview && <span className={styles.dragDates} aria-hidden="true">{dateLabel}</span>}
                {inReview && <EyeIcon />}
                {isDone && <DoneIcon />}
                {canEdit && <span className={`${styles.resizeHandle} ${styles.resizeHandleEnd}`} onPointerDown={(event) => beginDrag(event, item, 'resize-end')} aria-hidden="true" />}
                <span ref={(element) => { if (element) dependencyAnchorRefs.current.set(`${item.card.id}:finish`, element); else dependencyAnchorRefs.current.delete(`${item.card.id}:finish`) }} className={`${styles.dependencyConnector} ${styles.dependencyConnectorEnd}`} data-dependency-connector="true" data-card-id={item.card.id} data-endpoint="finish" data-readonly={!canEdit ? 'true' : undefined} data-target={dependencyCreation?.targetId === item.card.id && dependencyCreation.targetEndpoint === 'finish' ? 'true' : undefined} onPointerDown={canEdit ? (event) => beginDependencyCreation(event, item.card.id, 'finish') : undefined} role={canEdit ? 'button' : undefined} aria-hidden={!canEdit} aria-label={canEdit ? `Crear dependencia desde fin de ${item.card.title}` : undefined} tabIndex={canEdit ? 0 : -1}><DependencyConnectorIcon /></span>
              </button>
            )
          }))}
          {entries.flatMap(({ group, row: groupRow, collapsed: isCollapsed }) => isCollapsed ? [] : group.cards.flatMap((item, index) => {
            if (!hasTemporalPlanning(item)) return []
            const references = externalByCard.get(item.card.id)
            const incoming = references?.incoming ?? []
            const outgoing = references?.outgoing ?? []
            if (!leftCollapsed && incoming.length === 0 && outgoing.length === 0) return []

            const preview = dragPreview?.cardId === item.card.id ? dragPreview : null
            const start = preview?.start ?? item.card.start_date!
            const due = preview?.due ?? item.card.due_date!
            return (
              <span
                key={`card-extras-${item.card.id}`}
                className={styles.cardRowExtras}
                style={{ gridRow: groupRow + index + 1, gridColumn: `${gridColumn(range.start, start)} / ${dateEndColumn(range.start, due)}` }}
              >
                {incoming.length > 0 && <span className={styles.externalIncoming}>
                  {incoming.map(renderExternalReference)}
                </span>}
                {(leftCollapsed || outgoing.length > 0) && <span className={styles.cardRowTail}>
                  {leftCollapsed && <>
                    <span className={styles.cardRowName} title={item.card.title}>{item.card.title}</span>
                    {(item.card.assignees?.length ?? 0) > 0 && <span className={styles.cardRowAssignees}>
                      {item.card.assignees?.slice(0, 4).map((person) =>
                        <Avatar key={person.id} id={person.id} name={person.name} size={19} src={person.avatar_url} />
                      )}
                      {(item.card.assignees?.length ?? 0) > 4 &&
                        <span className={styles.cardRowAssigneeExtra}>+{item.card.assignees!.length - 4}</span>}
                    </span>}
                  </>}
                  {outgoing.length > 0 && <span className={styles.externalReferences}>
                    {outgoing.map(renderExternalReference)}
                  </span>}
                </span>}
              </span>
            )
          }))}
          <svg className={styles.dependencyLayer} width={dependencyGeometry.width} height={dependencyGeometry.height} viewBox={`0 0 ${dependencyGeometry.width} ${dependencyGeometry.height}`} aria-label="Dependencias de tareas">
            {dependencyCreation && (() => {
              const sourcePoint = dependencyGeometry.anchors[`${dependencyCreation.cardId}:${dependencyCreation.endpoint}`]
              const grid = timelineGridRef.current?.getBoundingClientRect()
              if (!sourcePoint || !grid) return null
              const targetPoint = {
                x: dependencyCreation.cursorX - grid.left,
                y: dependencyCreation.cursorY - grid.top,
              }
              const path = routeDependency(
                sourcePoint,
                targetPoint,
                [],
                dependencyCreation.endpoint,
                dependencyCreation.targetEndpoint ?? 'start',
                { width: grid.width, height: grid.height },
              )
              return <path className={styles.dependencyPreview} d={pathToSvg(path)} />
            })()}
            {ganttDependencies.map((dependency) => {
              const predecessor = cardRows.get(dependency.predecessorId)
              const successor = cardRows.get(dependency.successorId)
              if (!predecessor || !successor || !hasTemporalPlanning(predecessor.item) || !hasTemporalPlanning(successor.item)) return null
              const route = plannedDependencyRoutes.get(dependency.id)
              if (!route) return null
              const path = pathToSvg(route)
              const arrow = dependencyArrowPosition(route)
              const targetBar = dependency.type === 'ff' || dependency.type === 'sf'
                ? dependencyGeometry.obstacles.find((bar) => bar.cardId === dependency.successorId)
                : undefined
              return (
                <g key={dependency.id} className={`${styles.dependencyLineGroup} ${dependencyPopover?.dependency.id === dependency.id ? styles.dependencySelected : ''}`}>
                  <path className={styles.dependencyHitArea} d={path} onClick={(event) => setDependencyPopover({ dependency, x: event.clientX, y: event.clientY })} aria-label={`Dependencia ${dependency.type.toUpperCase()}: ${predecessor.item.card.title} → ${successor.item.card.title}`} />
                  <path className={styles.dependencyLine} d={path} aria-hidden="true" />
                  {(dependency.type === 'ff' || dependency.type === 'sf') && targetBar && arrow && <path
                    d={`M ${targetBar.right + FF_FINISH_MARKER_OFFSET_PX} ${targetBar.top} V ${arrow.point.y + 5}`}
                    className={styles.dependencyLine}
                    aria-hidden="true"
                  />}
                  {arrow && <g
                    className={styles.dependencyArrow}
                    transform={`translate(${arrow.point.x} ${arrow.point.y}) rotate(${arrow.angle}) scale(0.01875) translate(-439.1 -320)`}
                    aria-hidden="true"
                  >
                    {/* Font Awesome Free v7.3.1 — https://fontawesome.com — https://fontawesome.com/license/free — Copyright 2026 Fonticons, Inc. */}
                    <path d="M439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C266.6 515.2 246.3 515.2 233.8 502.7C221.3 490.2 221.3 469.9 233.8 457.4L371.2 320L233.9 182.6C221.4 170.1 221.4 149.8 233.9 137.3C246.4 124.8 266.7 124.8 279.2 137.3L439.2 297.3z" />
                  </g>}
                </g>
              )
            })}
            {externalDependencies.map((dependency) => {
              const geometry = externalRoutes.get(dependency.id)
              if (!geometry) return null
              const path = pathToSvg(geometry.points)
              const arrow = dependencyArrowPosition(geometry.points)
              const finishArrival = dependency.type === 'ff' || dependency.type === 'sf'
              const name = `${dependency.direction === 'incoming' ? dependency.title : cardRows.get(dependency.localCardId)?.item.card.title} → ${dependency.direction === 'outgoing' ? dependency.title : cardRows.get(dependency.localCardId)?.item.card.title}`
              return (
                <g key={`external-${dependency.id}`} className={`${styles.dependencyLineGroup} ${dependencyPopover?.dependency.id === dependency.id ? styles.dependencySelected : ''}`}>
                  <path className={styles.dependencyHitArea} d={path}
                    aria-label={`Dependencia externa ${dependency.type.toUpperCase()}: ${name}`}
                    onClick={(event) => openExternalDependency(dependency, event.clientX, event.clientY)} />
                  <path className={styles.dependencyLine} d={path} aria-hidden="true" />
                  {finishArrival && arrow && <path
                    className={styles.dependencyLine}
                    d={`M ${geometry.targetBar.right + FF_FINISH_MARKER_OFFSET_PX} ${geometry.targetBar.top} V ${arrow.point.y + 5}`}
                    aria-hidden="true" />}
                  {arrow && <g className={styles.dependencyArrow}
                    transform={`translate(${arrow.point.x} ${arrow.point.y}) rotate(${arrow.angle}) scale(0.01875) translate(-439.1 -320)`}
                    aria-hidden="true">
                    <path d="M439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C266.6 515.2 246.3 515.2 233.8 502.7C221.3 490.2 221.3 469.9 233.8 457.4L371.2 320L233.9 182.6C221.4 170.1 221.4 149.8 233.9 137.3C246.4 124.8 266.7 124.8 279.2 137.3L439.2 297.3z" />
                  </g>}
                </g>
              )
            })}
            {unroutedDependencies.map((dependency) => {
              const endpoint = dependency.type === 'ss' || dependency.type === 'sf' ? 'start' : 'finish'
              const origin = dependencyGeometry.anchors[`${dependency.predecessorId}:${endpoint}`]
              if (!origin) return null
              const from = cardRows.get(dependency.predecessorId)?.item.card.title ?? String(dependency.predecessorId)
              const to = cardRows.get(dependency.successorId)?.item.card.title ?? String(dependency.successorId)
              return <g key={`unrouted-${dependency.id}`} transform={`translate(${origin.x} ${origin.y - 13})`}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={(event) => setDependencyPopover({ dependency, x: event.clientX, y: event.clientY })}
                role="button" aria-label={`Dependencia sin recorrido: ${from} → ${to}`}>
                <title>{`Sin recorrido: ${dependency.type.toUpperCase()} · ${from} → ${to}`}</title>
                <circle r="8" fill="#b45309" stroke="white" strokeWidth="1.5" />
                <text y="4" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white">!</text>
              </g>
            })}
          </svg>
          {todayVisible && <>
            <span className={styles.todayLabel} style={{ gridRow: 2, gridColumn: `${todayColumn} / span 1` }}>Hoy</span>
            <span className={styles.todayLine} style={{ gridRow: '3 / -1', gridColumn: `${todayColumn} / span 1` }} aria-hidden="true" />
          </>}
        </div>
      </div>
      {dependencyPopover && (
        <div className={styles.dependencyPopover} role="dialog" aria-label="Tipo de dependencia" style={{ left: dependencyPopover.x, top: dependencyPopover.y }}>
          <strong>Tipo de dependencia</strong>
          {dependencyPopover.dependency.board_name && <small>
            Card externa: {dependencyPopover.dependency.title} · {dependencyPopover.dependency.board_name}
          </small>}
          {(['fs', 'ss', 'ff', 'sf'] as const).map((type) => (
            <label key={type}>
              <input type="radio" checked={dependencyPopover.dependency.type === type} disabled={!canEdit} onChange={() => void changeDependency(dependencyPopover.dependency, type)} />
              {type === 'fs' ? 'Fin → Inicio (FS)' : type === 'ss' ? 'Inicio → Inicio (SS)' : type === 'ff' ? 'Fin → Fin (FF)' : 'Inicio → Fin (SF)'}
            </label>
          ))}
          {canEdit && <button type="button" className="ghost" onClick={() => void deleteDependency(dependencyPopover.dependency)}>Eliminar dependencia</button>}
        </div>
      )}
      {hoveredCard && !dragState && !dragPreview && !dependencyCreation
        ? createPortal(
            <div className={styles.kanbanMiniCardPortal} style={{ left: hoveredCard.left, top: hoveredCard.top }}>
              <KanbanMiniCard card={hoveredCard.card} />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
