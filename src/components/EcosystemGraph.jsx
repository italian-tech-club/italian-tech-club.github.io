import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Minus, Maximize2, X } from 'lucide-react';
import { TIES, TIE_ORDER, ITC_ID, findOrg } from '../data/ecosystem';
import {
  layoutEcosystem,
  edgePath,
  bundlePath,
  bundleLabel,
  rimArc,
  tierEllipse,
  LABEL_PX,
  CLUSTER_ORDER,
} from '../lib/ecosystemLayout';

// The map. It owns its camera (pan, zoom, pinch, fit) and its level of detail,
// because detail is an editorial control here, not a performance trick:
//
//   overview  — ITC, the organizations we work with, and eight cluster discs.
//               Fifteen marks. You can read the whole argument in one look.
//   a cluster — click a disc, or simply zoom into it, and it blooms into its
//               members on two staggered rings. Discs never move when they open,
//               so nothing else on the map shifts under you.
//   a node    — hover or select and the rest of the map recedes to a fifth: you
//               see one organization and exactly what it is attached to.
//
// Encoding, once: colour = ITC's tie (three validated hues + a neutral),
// position = cluster, tier = how close to ITC, dash = kind of link. Never a
// second colour scale.
//
// Two rules keep the camera smooth, and both are load-bearing:
//
//   1. No SVG filters. A feGaussianBlur is re-rasterized on every frame of a
//      pan, once per node that carries it, and eighty of them is the difference
//      between a map that glides and one that stutters. Glows are painted with
//      radial gradients instead, which the compositor handles for free.
//   2. Every mark is a memoized component fed the *quantized* zoom, so a pan —
//      where the zoom does not change at all — re-renders nothing but the
//      viewBox attribute.

const EDGE_DASH = {
  partner: null,
  cohost: null,
  institutional: '8 7',
  network: '2 7',
  venue: '14 6 2 6',
};

// Zoom is measured against the fitted frame: 1 is "the whole map on screen".
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 4.5;
// Move in past this and the clusters you are looking at open by themselves.
const EXPAND_ZOOM = 1.9;
// Screen-pixel sizes are recomputed in 3.5% zoom steps rather than continuously.
// Between two steps every mark's props are identical, which is what lets memo
// hold during a pan and through most of a wheel gesture.
const SCALE_STEP = 1.035;

const TAU = Math.PI * 2;

const tieColor = (tie, theme) => (theme === 'dark' ? TIES[tie].dark : TIES[tie].light);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const quantize = (scale) =>
  Math.pow(SCALE_STEP, Math.round(Math.log(scale) / Math.log(SCALE_STEP)));

const labelSpot = (mark, gap, unit) => {
  const distance = mark.r + gap * unit;
  return { x: mark.x + mark.label.ux * distance, y: mark.y + mark.label.uy * distance };
};

// One collapsed or open cluster disc. Memoized on scalars only: during a pan
// nothing here changes, so nothing here re-renders.
const HubMark = memo(function HubMark({
  hub,
  unit,
  dim,
  hot,
  filtered,
  compact,
  palette,
  hubFont,
  rimColors,
  onHover,
  onToggle,
}) {
  const { ink, inkMid, inkSoft, guide } = palette;
  const enter = useCallback(() => onHover(hub.id), [onHover, hub.id]);
  const leave = useCallback(() => onHover(hub.id, true), [onHover, hub.id]);
  const toggle = useCallback(() => onToggle(hub), [onToggle, hub]);

  return (
    <motion.g
      animate={{ opacity: dim }}
      transition={{ duration: 0.25 }}
      className="cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      aria-label={`${hub.name} — ${hub.totalCount} organizations`}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      onClick={(event) => {
        event.stopPropagation();
        toggle();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      }}
    >
      {hub.isOpen ? (
        <>
          {/* Open: the member ring's own field, and the name in the middle of
              it, which is also the button that folds the cluster up. */}
          <circle
            cx={hub.x}
            cy={hub.y}
            r={hub.ring}
            fill="url(#eco-open)"
            stroke={guide}
            strokeWidth={unit}
            strokeOpacity={0.08}
          />
          <circle cx={hub.x} cy={hub.y} r={Math.min(78, hub.ring * 0.5)} fill="transparent" />
          {/* A filter throws every disc open at once, so eight cluster names end
              up on screen together. At the size a deliberately opened cluster
              earns, that is shouting; the filtered read is the dots. */}
          <text
            x={hub.x}
            y={hub.y - (filtered ? 2 : 3) * unit}
            textAnchor="middle"
            className="font-display"
            fontSize={(compact ? 16 : filtered ? 14 : 21) * unit}
            fontWeight={filtered ? '700' : '800'}
            fill={hot ? ink : inkMid}
            opacity={filtered ? 0.6 : 1}
          >
            {hub.mapLabel || hub.name}
          </text>
          {!filtered && (
            <text
              x={hub.x}
              y={hub.y + 17 * unit}
              textAnchor="middle"
              fontSize={(compact ? 11 : 12.5) * unit}
              fontWeight="600"
              fill={inkSoft}
              opacity="0.8"
            >
              {hot ? 'click to fold up' : `${hub.memberCount} organizations`}
            </text>
          )}
        </>
      ) : (
        <>
          <circle cx={hub.x} cy={hub.y} r={hub.r + 12 * unit} fill="transparent" />
          {hot && (
            <circle cx={hub.x} cy={hub.y} r={hub.r * 1.9} fill="url(#eco-hub-halo)" />
          )}
          <circle cx={hub.x} cy={hub.y} r={hub.r} fill="url(#eco-disc)" />
          <circle
            cx={hub.x}
            cy={hub.y}
            r={hub.r}
            fill="none"
            stroke={guide}
            strokeWidth={hot ? 1.6 * unit : unit}
            opacity={hot ? 0.34 : 0.17}
          />
          {/* Rim gauge: the whole circumference is this cluster, one slot per
              organization in it, and a slot is coloured when we have actually
              worked with that organization. The disc is never anonymous, and
              "how much of this have we touched" reads before you click. */}
          {rimColors.map((color, index) => {
            const slot = TAU / hub.totalCount;
            const from = -TAU / 4 + index * slot;
            return (
              <path
                key={`rim-${hub.id}-${index}`}
                d={rimArc(hub.x, hub.y, hub.r, from + slot * 0.12, from + slot * 0.88)}
                fill="none"
                stroke={color}
                strokeWidth={Math.max(hub.r * 0.15, 2.4 * unit)}
                strokeLinecap="round"
              />
            );
          })}
          <text
            x={hub.x}
            y={hub.y + hub.r * 0.02}
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none font-display"
            fontSize={hub.r * 0.74}
            fontWeight="800"
            fill={ink}
            opacity={hot ? 0.92 : 0.62}
          >
            {hub.memberCount}
          </text>
          <text
            x={labelSpot(hub, 12, unit).x}
            y={labelSpot(hub, 12, unit).y}
            textAnchor={hub.label.anchor}
            dominantBaseline={hub.label.baseline}
            className="pointer-events-none font-display"
            fontSize={hubFont * unit}
            fontWeight="700"
            fill={hot ? ink : inkMid}
          >
            {hub.mapLabel || hub.name}
          </text>
        </>
      )}
    </motion.g>
  );
});

// One organization: ITC, a sibling chapter, an inner-circle org, or a member of
// an open cluster. Same memo bargain as the discs.
const NodeMark = memo(function NodeMark({
  node,
  unit,
  compact,
  theme,
  opacity,
  active,
  named,
  color,
  labelFont,
  palette,
  onSelect,
  onHover,
}) {
  const enter = useCallback(() => onHover(node.id), [onHover, node.id]);
  const leave = useCallback(() => onHover(node.id, true), [onHover, node.id]);
  const pick = useCallback(
    (event) => {
      event.stopPropagation();
      onSelect(node.id);
    },
    [onSelect, node.id],
  );

  const spot = named && !node.isCenter ? labelSpot(node, node.tier === 'member' ? 10 : 11, unit) : null;

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${node.name} — ${TIES[node.tie].label}`}
      className="cursor-pointer outline-none"
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity, scale: 1 }}
      exit={{ opacity: 0, scale: 0.3 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        originX: `${node.tier === 'member' ? node.hubX : 0}px`,
        originY: `${node.tier === 'member' ? node.hubY : 0}px`,
      }}
      onClick={pick}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      {/* Hit area, always larger than the mark, and never smaller than a
          fingertip. */}
      <circle cx={node.x} cy={node.y} r={node.r + (compact ? 15 : 10) * unit} fill="transparent" />

      {active && (
        // ITC gets a thin neutral hairline rather than the usual thick ring in
        // its own tie colour: green at 1.6× lands right outside the tricolour
        // and reads as a second, broken flag.
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={node.r * (node.isCenter ? 1.36 : 1.62)}
          fill="none"
          stroke={node.isCenter ? palette.inkSoft : color}
          strokeWidth={node.r * (node.isCenter ? 0.045 : 0.13)}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: node.isCenter ? 0.45 : 0.85, scale: 1 }}
          style={{ originX: `${node.x}px`, originY: `${node.y}px` }}
        />
      )}

      {node.isCenter ? (
        <>
          <circle cx={node.x} cy={node.y} r={node.r * 2.4} fill="url(#eco-core-halo)" />
          <circle
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill={theme === 'dark' ? '#f8fafc' : '#0f172a'}
          />
          {/* Tricolour ring — the only brand colour in the drawing. It runs on
              a neutral track, because the white third of an Italian flag is
              invisible on a white page and the ring read as broken without
              one. */}
          <circle
            cx={node.x}
            cy={node.y}
            r={node.r * 1.15}
            fill="none"
            stroke={palette.guide}
            strokeWidth={node.r * 0.1}
            opacity={theme === 'dark' ? 0.16 : 0.1}
          />
          {[
            ['#009246', 0],
            [theme === 'dark' ? '#f1f2f1' : '#e4e7e4', 1],
            ['#CE2B37', 2],
          ].map(([stroke, third]) => {
            const ring = node.r * 1.15;
            const arc = (TAU * ring) / 3;
            const nick = ring * 0.07;
            return (
              <circle
                key={stroke}
                cx={node.x}
                cy={node.y}
                r={ring}
                fill="none"
                stroke={stroke}
                strokeWidth={node.r * 0.1}
                strokeDasharray={`${arc - nick} ${arc * 2 + nick}`}
                strokeDashoffset={-arc * third}
              />
            );
          })}
          <text
            x={node.x}
            y={node.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none font-display"
            fontSize={node.r * 0.4}
            fontWeight="800"
            fill={theme === 'dark' ? '#0f172a' : '#ffffff'}
          >
            ITC
          </text>
        </>
      ) : (
        <>
          {node.tie !== 'none' && (
            <circle cx={node.x} cy={node.y} r={node.r * 2.6} fill={`url(#eco-halo-${node.tie})`} />
          )}
          <circle cx={node.x} cy={node.y} r={node.r} fill={color} />
          {/* Ring style repeats the colour, so the tie survives a colour-blind
              read: solid = ITC network, double = partner, dashed =
              collaborator, bare dot = no shared work yet. */}
          {node.tie === 'network' && (
            <circle cx={node.x} cy={node.y} r={node.r * 1.35} fill="none" stroke={color} strokeWidth={node.r * 0.2} />
          )}
          {node.tie === 'partner' && (
            <>
              <circle cx={node.x} cy={node.y} r={node.r * 1.2} fill="none" stroke={color} strokeWidth={node.r * 0.11} />
              <circle cx={node.x} cy={node.y} r={node.r * 1.48} fill="none" stroke={color} strokeWidth={node.r * 0.11} />
            </>
          )}
          {node.tie === 'collaborator' && (
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r * 1.35}
              fill="none"
              stroke={color}
              strokeWidth={node.r * 0.2}
              strokeDasharray={`${node.r * 0.34} ${node.r * 0.28}`}
            />
          )}
        </>
      )}

      {spot && (
        <text
          x={spot.x}
          y={spot.y}
          textAnchor={node.label.anchor}
          dominantBaseline={node.label.baseline}
          className="pointer-events-none font-display"
          fill={active ? color : node.tier === 'member' ? palette.inkMid : palette.ink}
          fontSize={labelFont * unit}
          fontWeight={node.tier === 'member' ? 600 : 700}
          opacity={node.tier === 'member' && !active ? 0.92 : 1}
        >
          {node.short}
        </text>
      )}
    </motion.g>
  );
});

// Every link on the map. Split out so a pan never walks the edge list.
const EdgeLayer = memo(function EdgeLayer({ edges, nodeById, focusId, hoveredHub, inkSoft, theme }) {
  return (
    <g fill="none">
      {edges.map((edge) => {
        const from = nodeById[edge.a];
        const to = nodeById[edge.b];
        const touchesItc = edge.a === ITC_ID || edge.b === ITC_ID;
        const onFocus = !focusId || edge.a === focusId || edge.b === focusId;
        return (
          <motion.path
            key={`${edge.a}-${edge.b}-${edge.kind}`}
            d={edgePath(from, to)}
            stroke={touchesItc ? tieColor(to.id === ITC_ID ? from.tie : to.tie, theme) : inkSoft}
            strokeWidth={touchesItc ? 2.6 : focusId && onFocus ? 2.2 : 1.3}
            strokeDasharray={EDGE_DASH[edge.kind] || undefined}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: 1,
              opacity: onFocus ? (touchesItc ? (hoveredHub ? 0.3 : 0.95) : 0.3) : 0.05,
            }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
    </g>
  );
});

const EcosystemGraph = ({
  orgs,
  edges,
  theme,
  selectedId,
  hoveredId,
  focusClusterId,
  cardOpen,
  filtered,
  onSelect,
  onHover,
}) => {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [openIds, setOpenIds] = useState([]);
  const [hoveredHub, setHoveredHub] = useState(null);
  const autoOpened = useRef(new Set());
  const suppressed = useRef(new Set());

  // Measure the container: the camera frames the real box, so the map fills a
  // phone in portrait and a laptop in landscape instead of a square in both.
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const compact = size.w > 0 && size.w < 640;
  // Below this the cluster names stop sitting beside their discs: two full names
  // on the flanks cost more width than the drawing between them can spare.
  const stack = size.w > 0 && size.w < 900;
  // Room the floating chrome takes, so "fit" centres the map in what is
  // actually visible rather than behind the panels.
  const insets = useMemo(
    () =>
      compact
        ? { top: 104, bottom: 118, left: 16, right: 16 }
        : { top: 96, bottom: 132, left: 32, right: 32 },
    [compact],
  );

  // Searching or filtering is a request to see the survivors by name, so every
  // disc opens: the filter has already made the map small enough to hold them.
  const expanded = useMemo(
    () => (filtered ? new Set(CLUSTER_ORDER) : new Set(openIds)),
    [filtered, openIds],
  );
  const aspect = size.h > 0 ? size.w / size.h : 1;
  const available = useMemo(
    () => ({
      w: Math.max(120, size.w - insets.left - insets.right),
      h: Math.max(120, size.h - insets.top - insets.bottom),
    }),
    [size, insets],
  );

  const layout = useMemo(
    () => layoutEcosystem({ orgs, available, expanded, compact, stack, fitRings: filtered }),
    [orgs, available, expanded, compact, stack, filtered],
  );
  const { center, family, inner, hubs, members, nodeById, hubById, tierRadii, frame } = layout;

  // The scale at which the whole frame is on screen. Everything else is
  // expressed as a multiple of it.
  // Names are given the room they asked for, but never more than half the axis:
  // a long cluster name on a narrow phone would otherwise squeeze the marks down
  // to nothing.
  const fitScale = useMemo(() => {
    const room = (axis, pad) => Math.max(axis - 2 * pad, axis * 0.5);
    return Math.min(
      room(available.w, frame.padX) / (2 * frame.halfW),
      room(available.h, frame.padY) / (2 * frame.halfH),
    );
  }, [available, frame]);

  const fitCamera = useMemo(
    () => ({
      cx: frame.cx - (insets.left - insets.right) / 2 / fitScale,
      cy: frame.cy - (insets.top - insets.bottom) / 2 / fitScale,
      scale: fitScale,
    }),
    [insets, fitScale, frame.cx, frame.cy],
  );

  const [camera, setCamera] = useState(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const view = camera || fitCamera;
  const viewRef = useRef(view);
  viewRef.current = view;
  const zoom = view.scale / fitScale;

  // Back to the overview: every disc folds up, the camera returns to the frame.
  const fit = useCallback(() => {
    autoOpened.current = new Set();
    suppressed.current = new Set();
    setOpenIds([]);
    setCamera(fitCamera);
  }, [fitCamera]);

  // Flipping orientation re-proportions the layout; re-frame rather than leave
  // the camera pointing at coordinates that no longer hold anything.
  const portrait = aspect < 1;
  useEffect(() => {
    setCamera(null);
  }, [portrait]);

  const tween = useRef(null);
  const flyTo = useCallback((target) => {
    if (tween.current) cancelAnimationFrame(tween.current);
    const from = cameraRef.current || viewRef.current;
    const startedAt = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startedAt) / 480);
      // easeOutQuint, same curve as the rest of the site.
      const e = 1 - Math.pow(1 - t, 5);
      setCamera({
        cx: from.cx + (target.cx - from.cx) * e,
        cy: from.cy + (target.cy - from.cy) * e,
        // Scale interpolates geometrically, or the middle of a long zoom lurches.
        scale: from.scale * Math.pow(target.scale / from.scale, e),
      });
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => tween.current && cancelAnimationFrame(tween.current), []);

  // Screen point to world point, so zooming can pin whatever is under the
  // cursor — or under the middle of a pinch.
  const toData = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: view.cx + (clientX - rect.left - rect.width / 2) / view.scale,
      y: view.cy + (clientY - rect.top - rect.height / 2) / view.scale,
    };
  };

  const zoomBy = (factor, anchor) => {
    if (tween.current) cancelAnimationFrame(tween.current);
    setCamera((current) => {
      const from = current || fitCamera;
      const scale = clamp(from.scale * factor, fitScale * MIN_ZOOM, fitScale * MAX_ZOOM);
      if (!anchor) return { ...from, scale };
      // Keep the anchor point pinned while the window shrinks around it.
      const ratio = from.scale / scale;
      return {
        scale,
        cx: anchor.x + (from.cx - anchor.x) * ratio,
        cy: anchor.y + (from.cy - anchor.y) * ratio,
      };
    });
  };

  const wheelRef = useRef(null);
  wheelRef.current = (event) => {
    event.preventDefault();
    zoomBy(Math.exp(-event.deltaY * 0.0018), toData(event.clientX, event.clientY));
  };

  // The <svg> only exists once the container has been measured, so this cannot
  // run on mount alone — it would attach to nothing and scroll-zoom would be dead.
  const mounted = size.w > 0;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const listener = (event) => wheelRef.current(event);
    svg.addEventListener('wheel', listener, { passive: false });
    return () => svg.removeEventListener('wheel', listener);
  }, [mounted]);

  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const dragged = useRef(false);

  // A trackpad or a 120Hz stylus fires pointermove faster than the screen
  // repaints. Deltas are accumulated and spent once per frame, so a drag costs
  // one React commit per painted frame rather than two or three.
  const pan = useRef({ dx: 0, dy: 0, frame: null });
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const fitCameraRef = useRef(fitCamera);
  fitCameraRef.current = fitCamera;

  const flushPan = useCallback(() => {
    pan.current.frame = null;
    const { dx, dy } = pan.current;
    pan.current.dx = 0;
    pan.current.dy = 0;
    if (!dx && !dy) return;
    // Panning stops where the drawing does, so the map can never be lost.
    const box = frameRef.current;
    const limitX = box.halfW + 300;
    const limitY = box.halfH + 300;
    setCamera((current) => {
      const from = current || fitCameraRef.current;
      return {
        ...from,
        cx: clamp(from.cx - dx, box.cx - limitX, box.cx + limitX),
        cy: clamp(from.cy - dy, box.cy - limitY, box.cy + limitY),
      };
    });
  }, []);

  const handlePointerDown = (event) => {
    pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
    }
    // Deliberately no setPointerCapture: capturing on the <svg> retargets the
    // following pointerup, which makes Chrome resolve the click against the svg
    // instead of the node that was pressed — nothing would ever select.
  };

  const handlePointerMove = (event) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.current.distance > 0) {
        // Pinch around the point between the fingers, the way every other map does.
        const midpoint = toData((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        zoomBy(distance / pinch.current.distance, midpoint);
      }
      pinch.current = { distance };
      dragged.current = true;
      return;
    }

    const dx = (event.clientX - previous.clientX) / view.scale;
    const dy = (event.clientY - previous.clientY) / view.scale;
    if ((Math.abs(dx) + Math.abs(dy)) * view.scale > 3) dragged.current = true;
    if (tween.current) cancelAnimationFrame(tween.current);
    pan.current.dx += dx;
    pan.current.dy += dy;
    if (!pan.current.frame) pan.current.frame = requestAnimationFrame(flushPan);
  };

  const endPointer = (event) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  useEffect(() => () => pan.current.frame && cancelAnimationFrame(pan.current.frame), []);

  // The card covers the right of a wide viewport and the bottom of a phone, so
  // what the camera centres on is the free part of the screen, not the window.
  const cardShift = useCallback(
    (scale) => {
      if (!cardOpen) return { dx: 0, dy: 0 };
      return compact
        ? { dx: 0, dy: (size.h * 0.22) / scale }
        : { dx: 168 / scale, dy: 0 };
    },
    [cardOpen, compact, size.h],
  );

  // Opening a cluster: mark it open and move in far enough that its rings, and
  // their names, have room. The disc itself does not move.
  const zoomToHub = useCallback(
    (hub) => {
      suppressed.current.delete(hub.id);
      setOpenIds((list) => (list.includes(hub.id) ? list : [...list, hub.id]));
      // Fit the ring, leaving room for the names that hang off it — and that
      // room is owed on width, not on height, because member names run sideways.
      // Charging it to both axes is what left an open cluster sitting in a third
      // of the screen with its dots too small to read. On a phone the allowance
      // is deliberately thin: readable dots you can pan around beat a whole ring
      // that fits and cannot be read.
      const roomX = compact ? 70 : 150;
      const roomY = compact ? 30 : 44;
      const span = 2 * (hub.ring + 14);
      const wanted = Math.min((available.w - 2 * roomX) / span, (available.h - 2 * roomY) / span);
      // Never less zoomed than the overview — the disc opening is the change the
      // reader asked for, and the biggest cluster only just fits either way.
      const scale = clamp(wanted, fitScale * 1.05, fitScale * 4);
      const shift = cardShift(scale);
      // Aim at the members, not at the hub. The ring is only populated on its
      // outward 200° — the wide gap faces the map centre — so centring the
      // camera on the hub itself frames a half-empty circle and pushes the names
      // to one edge.
      const bias = hub.ring * 0.34;
      flyTo({
        cx: hub.x + Math.cos(hub.angle) * bias + shift.dx,
        cy: hub.y + Math.sin(hub.angle) * bias + shift.dy,
        scale,
      });
    },
    [available, cardShift, compact, fitScale, flyTo],
  );

  const closeHub = useCallback((id) => {
    autoOpened.current.delete(id);
    suppressed.current.add(id);
    setOpenIds((list) => list.filter((entry) => entry !== id));
  }, []);

  // Semantic zoom: past EXPAND_ZOOM, whichever clusters are actually on screen
  // resolve into their members. Back out and they fold up again.
  useEffect(() => {
    if (!size.w || filtered) return;
    if (zoom < EXPAND_ZOOM * 0.92) {
      if (autoOpened.current.size === 0 && suppressed.current.size === 0) return;
      const toClose = [...autoOpened.current];
      autoOpened.current = new Set();
      suppressed.current = new Set();
      if (toClose.length) setOpenIds((list) => list.filter((id) => !toClose.includes(id)));
      return;
    }
    const halfViewW = size.w / (2 * view.scale);
    const halfViewH = size.h / (2 * view.scale);
    // At most two at a time, nearest the middle of the screen first: the point
    // of moving in is to read one neighbourhood, not to re-crowd the map.
    const inView = hubs
      .filter(
        (hub) =>
          !suppressed.current.has(hub.id) &&
          Math.abs(hub.x - view.cx) < halfViewW + hub.ring * 0.6 &&
          Math.abs(hub.y - view.cy) < halfViewH + hub.ring * 0.6,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - view.cx, a.y - view.cy) - Math.hypot(b.x - view.cx, b.y - view.cy),
      )
      .slice(0, 2);
    const next = inView.map((hub) => hub.id).filter((id) => !openIds.includes(id));
    const stale = [...autoOpened.current].filter((id) => !inView.some((hub) => hub.id === id));
    if (!next.length && !stale.length) return;
    next.forEach((id) => autoOpened.current.add(id));
    stale.forEach((id) => autoOpened.current.delete(id));
    setOpenIds((list) => [...list.filter((id) => !stale.includes(id)), ...next]);
  }, [zoom, view.cx, view.cy, view.scale, size, hubs, openIds, filtered]);

  // A selection can arrive from the card's link list or from search, for an
  // organization currently folded inside a disc — open it, then go there.
  useEffect(() => {
    if (!selectedId || !size.w) return;
    const node = nodeById[selectedId];
    if (!node) {
      const org = findOrg(selectedId);
      const hub = org && hubById[org.cluster];
      if (hub) zoomToHub(hub);
      return;
    }
    const readable = fitScale * 1.55;
    const scale = Math.max(cameraRef.current?.scale || fitScale, readable);
    const shift = cardShift(scale);
    flyTo({ cx: node.x + shift.dx, cy: node.y + shift.dy, scale });
    // Re-running on nodeById would fight the camera every time a disc opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // A single-cluster filter is a request to look at that cluster.
  useEffect(() => {
    if (!focusClusterId || !size.w) return;
    const hub = hubById[focusClusterId];
    if (hub) zoomToHub(hub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusClusterId]);

  // Type and label offsets are specified in screen pixels and converted back to
  // world units here: a name has to stay readable at fit zoom on a phone, where
  // the whole map is scaled to about a third. The conversion runs off the
  // quantized zoom, so most frames of a gesture hand every mark the same number
  // it had last frame and memo does the rest.
  const unit = 1 / quantize(view.scale);
  const type = {
    hub: compact ? LABEL_PX.hub.compact : LABEL_PX.hub.wide,
    node: compact ? LABEL_PX.node.compact : LABEL_PX.node.wide,
    member: compact ? LABEL_PX.member.compact : LABEL_PX.member.wide,
  };

  const palette = useMemo(
    () =>
      theme === 'dark'
        ? { ink: '#e6ebf2', inkMid: '#98a3b4', inkSoft: '#7b8798', guide: '#ffffff', accent: '#1baf7a' }
        : { ink: '#0f172a', inkMid: '#4a5768', inkSoft: '#7b8798', guide: '#0f172a', accent: '#009246' },
    [theme],
  );
  const { ink, inkMid, inkSoft, guide, accent } = palette;

  // Focus mode answers "what is this one organization attached to" by taking the
  // rest of the map down to a fifth. ITC is attached to everything the map is
  // about, so focusing it would dim the drawing in order to describe the
  // drawing — the centre is exempt, and hovering it changes nothing.
  const attention = hoveredId || selectedId;
  const focusId = attention === ITC_ID ? null : attention;
  const neighbours = useMemo(() => {
    if (!focusId) return null;
    const set = new Set([focusId]);
    edges.forEach((edge) => {
      if (edge.a === focusId) set.add(edge.b);
      if (edge.b === focusId) set.add(edge.a);
    });
    return set;
  }, [focusId, edges]);

  const drawableEdges = useMemo(
    () => edges.filter((edge) => nodeById[edge.a] && nodeById[edge.b]),
    [edges, nodeById],
  );

  // A focused node's links that land inside a still-closed disc: drawn as a stub
  // to the disc, so "there are three more, over there" is visible rather than
  // silently dropped.
  const stubs = useMemo(() => {
    if (!focusId || !nodeById[focusId]) return [];
    const from = nodeById[focusId];
    const seen = new Set();
    return edges
      .filter((edge) => edge.a === focusId || edge.b === focusId)
      .map((edge) => (edge.a === focusId ? edge.b : edge.a))
      .filter((otherId) => !nodeById[otherId])
      .map((otherId) => {
        const org = findOrg(otherId);
        const hub = org && hubById[org.cluster];
        if (!hub || seen.has(hub.id)) return null;
        seen.add(hub.id);
        return { from, hub };
      })
      .filter(Boolean);
  }, [focusId, nodeById, hubById, edges]);

  // Hovering a disc answers "who does this cluster work with", aggregated: one
  // ribbon per neighbouring cluster, weighted by how many documented links it
  // bundles. Only on hover — permanently drawn, it is the spaghetti we removed.
  const bundles = useMemo(() => {
    if (!hoveredHub || focusId) return [];
    const counts = {};
    edges.forEach((edge) => {
      const a = findOrg(edge.a);
      const b = findOrg(edge.b);
      if (!a || !b || a.cluster === b.cluster) return;
      if (a.cluster !== hoveredHub && b.cluster !== hoveredHub) return;
      const other = a.cluster === hoveredHub ? b.cluster : a.cluster;
      counts[other] = (counts[other] || 0) + 1;
    });
    const source = hubById[hoveredHub];
    if (!source) return [];
    return Object.entries(counts)
      .map(([id, count]) => (hubById[id] ? { target: hubById[id], count, source } : null))
      .filter(Boolean);
  }, [hoveredHub, focusId, edges, hubById]);

  // Precomputed once per layout: a fresh array per frame would defeat the memo
  // on every disc.
  const rimColors = useMemo(() => {
    const map = {};
    hubs.forEach((hub) => {
      map[hub.id] = hub.linkedIds.map((id) => tieColor(findOrg(id)?.tie || 'none', theme));
    });
    return map;
  }, [hubs, theme]);

  const bundled = useMemo(() => new Set(bundles.map((entry) => entry.target.id)), [bundles]);
  // A disc only ever opens because someone asked to read it, so its members are
  // named — unless a filter has thrown so many open at once that naming them all
  // would be the crowding we are here to avoid.
  const showMemberLabels = members.length <= 40;
  const viewBox = `${view.cx - size.w / (2 * view.scale)} ${view.cy - size.h / (2 * view.scale)} ${
    size.w / view.scale
  } ${size.h / view.scale}`;

  const nodeOpacity = (node) => {
    if (neighbours) return neighbours.has(node.id) ? 1 : 0.18;
    if (hoveredHub) return node.cluster === hoveredHub || node.isCenter ? 1 : 0.42;
    return 1;
  };

  // Stable handlers: a memoized mark must never be handed a fresh function, or
  // the memo is decorative.
  const hoverHub = useCallback((id, leaving) => {
    setHoveredHub((current) => (leaving ? (current === id ? null : current) : id));
  }, []);
  const toggleHub = useCallback(
    (hub) => {
      if (dragged.current) return;
      if (hub.isOpen && !filtered) closeHub(hub.id);
      else zoomToHub(hub);
    },
    [closeHub, filtered, zoomToHub],
  );
  const hoverNode = useCallback(
    (id, leaving) => onHover(leaving ? null : id),
    [onHover],
  );
  const selectNode = useCallback(
    (id) => {
      if (!dragged.current) onSelect(id);
    },
    [onSelect],
  );

  // A filter opens every disc, but that is the filter talking, not a place the
  // reader navigated to — so it gets no breadcrumbs.
  const openHubs = filtered ? [] : hubs.filter((hub) => hub.isOpen);
  const marks = useMemo(
    () => [...members, ...family, ...inner, ...(center ? [center] : [])],
    [members, family, inner, center],
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      {size.w > 0 && (
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          role="img"
          aria-label="Map of Italian organizations in New York and their links to Italian Tech Club NYC"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onDoubleClick={(event) => zoomBy(1.8, toData(event.clientX, event.clientY))}
          onClick={() => {
            if (!dragged.current) onSelect(null);
          }}
        >
          <defs>
            {/* Glows, painted rather than filtered — see the note at the top. */}
            <radialGradient id="eco-core-halo">
              <stop offset="0%" stopColor={accent} stopOpacity={theme === 'dark' ? 0.5 : 0.26} />
              <stop offset="55%" stopColor={accent} stopOpacity={theme === 'dark' ? 0.16 : 0.08} />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="eco-field">
              <stop offset="0%" stopColor={accent} stopOpacity={theme === 'dark' ? 0.13 : 0.05} />
              <stop offset="34%" stopColor={accent} stopOpacity={theme === 'dark' ? 0.07 : 0.026} />
              <stop offset="62%" stopColor={accent} stopOpacity={theme === 'dark' ? 0.028 : 0.01} />
              <stop offset="82%" stopColor={accent} stopOpacity={theme === 'dark' ? 0.008 : 0.003} />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="eco-hub-halo">
              <stop offset="35%" stopColor={guide} stopOpacity={theme === 'dark' ? 0.14 : 0.09} />
              <stop offset="100%" stopColor={guide} stopOpacity="0" />
            </radialGradient>
            {TIE_ORDER.filter((tie) => tie !== 'none').map((tie) => (
              <radialGradient key={tie} id={`eco-halo-${tie}`}>
                <stop offset="26%" stopColor={tieColor(tie, theme)} stopOpacity={theme === 'dark' ? 0.42 : 0.3} />
                <stop offset="100%" stopColor={tieColor(tie, theme)} stopOpacity="0" />
              </radialGradient>
            ))}
            {/* The discs read as physical chips, not as skeleton placeholders:
                a light source top-left, a crisp rim, a real numeral. */}
            {/* An open cluster keeps a faint body, so a ring of dots still
                reads as one thing rather than as loose confetti. */}
            <radialGradient id="eco-open">
              <stop offset="0%" stopColor={guide} stopOpacity={theme === 'dark' ? 0.05 : 0.028} />
              <stop offset="70%" stopColor={guide} stopOpacity={theme === 'dark' ? 0.022 : 0.012} />
              <stop offset="100%" stopColor={guide} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="eco-disc" cx="36%" cy="30%" r="82%">
              <stop offset="0%" stopColor={theme === 'dark' ? '#334155' : '#ffffff'} />
              <stop offset="100%" stopColor={theme === 'dark' ? '#171f2e' : '#dfe5ec'} />
            </radialGradient>
          </defs>

          {/* The field ITC sits in: one soft disc, tight around the inner
              circle. It is the only thing on the map that is purely
              atmospheric, so it stops well before the cluster ring. */}
          <circle cx="0" cy="0" r={tierRadii.inner * 1.75} fill="url(#eco-field)" />

          {/* Structure: one dashed ellipse for the cluster ring, one circle for
              the inner circle, and a spoke through the annulus between them.
              The spokes stop short of the middle — drawn all the way in they
              read as dust across the most important part of the drawing. */}
          <g stroke={guide} fill="none" opacity={theme === 'dark' ? 0.11 : 0.08}>
            {hubs.map((hub) => {
              const length = Math.hypot(hub.x, hub.y) || 1;
              const t0 = Math.min(0.94, (tierRadii.inner + 34) / length);
              return (
                <line
                  key={`spoke-${hub.id}`}
                  x1={hub.x * t0}
                  y1={hub.y * t0}
                  x2={hub.x * 0.97}
                  y2={hub.y * 0.97}
                  strokeWidth={unit}
                />
              );
            })}
            <circle cx="0" cy="0" r={tierRadii.inner} strokeWidth={unit} />
            <ellipse
              cx="0"
              cy="0"
              {...tierEllipse(tierRadii.hub, tierRadii)}
              strokeWidth={unit}
              strokeDasharray={`${2 * unit} ${9 * unit}`}
            />
          </g>

          {/* Cluster-to-cluster bundles, on hover only. */}
          <g fill="none" strokeLinecap="round">
            {bundles.map(({ source, target, count }) => (
              <motion.path
                key={`bundle-${target.id}`}
                d={bundlePath(source, target)}
                stroke={inkSoft}
                strokeWidth={1.2 + count * 0.9}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.28 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            ))}
          </g>

          {/* Belongs-to: an inner-circle organization tied back to its cluster,
              so the two tiers are visibly the same map. */}
          <g fill="none" stroke={inkSoft} strokeDasharray={`${2 * unit} ${8 * unit}`} strokeWidth={1.4 * unit}>
            {inner.map((node) => {
              const hub = hubById[node.cluster];
              if (!hub) return null;
              return (
                <line
                  key={`home-${node.id}`}
                  x1={node.x}
                  y1={node.y}
                  x2={hub.x}
                  y2={hub.y}
                  opacity={neighbours && !neighbours.has(node.id) ? 0.05 : 0.22}
                />
              );
            })}
          </g>

          <EdgeLayer
            edges={drawableEdges}
            nodeById={nodeById}
            focusId={focusId}
            hoveredHub={hoveredHub}
            inkSoft={inkSoft}
            theme={theme}
          />

          <g fill="none">
            {stubs.map(({ from, hub }) => (
              <motion.line
                key={`stub-${hub.id}`}
                x1={from.x}
                y1={from.y}
                x2={hub.x}
                y2={hub.y}
                stroke={inkSoft}
                strokeWidth={1.6 * unit}
                strokeDasharray={`${4 * unit} ${8 * unit}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </g>

          {/* Tier 2: the discs. */}
          <g>
            {hubs.map((hub) => (
              <HubMark
                key={hub.id}
                hub={hub}
                unit={unit}
                compact={compact}
                filtered={filtered}
                hot={hoveredHub === hub.id}
                dim={
                  neighbours
                    ? stubs.some((stub) => stub.hub.id === hub.id)
                      ? 1
                      : 0.2
                    : hoveredHub && hoveredHub !== hub.id && !bundled.has(hub.id)
                      ? 0.4
                      : 1
                }
                palette={palette}
                hubFont={type.hub}
                rimColors={rimColors[hub.id]}
                onHover={hoverHub}
                onToggle={toggleHub}
              />
            ))}
          </g>

          {/* Bundle weights, drawn over the discs they connect. */}
          <g>
            {bundles.map(({ source, target, count }) => (
              <motion.text
                key={`bundle-count-${target.id}`}
                x={bundleLabel(source, target).x}
                y={bundleLabel(source, target).y}
                textAnchor="middle"
                className="pointer-events-none font-display"
                fontSize={13 * unit}
                fontWeight="800"
                fill={inkSoft}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: 0.25 }}
              >
                {count}
              </motion.text>
            ))}
          </g>

          {/* Tiers 1 and 3: everything drawn as an individual organization. */}
          <g>
            <AnimatePresence>
              {marks.map((node) => (
                <NodeMark
                  key={node.id}
                  node={node}
                  unit={unit}
                  compact={compact}
                  theme={theme}
                  palette={palette}
                  opacity={nodeOpacity(node)}
                  active={node.id === selectedId || node.id === hoveredId}
                  named={node.tier !== 'member' || node.id === selectedId || node.id === hoveredId || showMemberLabels}
                  color={tieColor(node.tie, theme)}
                  labelFont={node.tier === 'member' ? type.member : type.node}
                  onSelect={selectNode}
                  onHover={hoverNode}
                />
              ))}
            </AnimatePresence>
          </g>
        </svg>
      )}

      {/* Where you are: one pill per open cluster, and the way back out. */}
      <AnimatePresence>
        {(openHubs.length > 0 || zoom > 1.25) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute bottom-4 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 sm:bottom-auto sm:top-4"
          >
            {openHubs.slice(0, 3).map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => closeHub(hub.id)}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 py-1.5 pl-3 pr-2 text-xs font-bold text-slate-700 shadow-sm backdrop-blur transition-colors hover:text-itc-red dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
              >
                {hub.mapLabel || hub.name}
                <span className="font-semibold text-slate-400">{hub.memberCount}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
            {openHubs.length > 3 && (
              <span className="pointer-events-none rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                +{openHubs.length - 3}
              </span>
            )}
            <button
              type="button"
              onClick={fit}
              className="pointer-events-auto rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm backdrop-blur transition-colors hover:text-itc-green dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400"
            >
              Whole map
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera controls, wide screens only: on a phone, pinch and double-tap are
          the native gestures and the "Whole map" pill is the way back. */}
      <div className="absolute bottom-4 right-4 hidden flex-col gap-1.5 sm:flex">
        {[
          { icon: Plus, label: 'Zoom in', action: () => zoomBy(1.5, null) },
          { icon: Minus, label: 'Zoom out', action: () => zoomBy(1 / 1.5, null) },
          { icon: Maximize2, label: 'Fit the whole map', action: fit },
        ].map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            title={label}
            aria-label={label}
            className="rounded-xl border border-slate-200 bg-white/85 p-2.5 text-slate-600 shadow-sm backdrop-blur transition-colors hover:text-itc-green dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default EcosystemGraph;
