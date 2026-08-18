// Deterministic layout for the /ecosystem map.
//
// No force simulation on purpose: the same data must always draw the same map,
// first paint or tenth, so positions carry meaning instead of physics artefacts.
//
// Three tiers, and they are the whole argument of the drawing:
//
//   0. ITC at the centre.
//   1. The inner circle — every organization we have actually worked with,
//      always drawn individually and always named. Five nodes, not seventy.
//   2. Eight cluster discs holding the rest of the city. A disc opens into its
//      members when you click it or zoom into it, and never before, which is
//      what keeps the overview at ~15 marks instead of ~130.
//
// The hubs sit at fixed angles and fixed radii: opening one, or filtering the
// map, cannot re-shuffle anything else. That stability is why the camera never
// has to re-frame and why the map feels like a place rather than a redraw.
//
// The one thing that does move the geometry is the viewport: the tier ring is an
// ellipse matched to the container's aspect, so a portrait phone gets a tall map
// and a laptop gets a wide one instead of a square with dead margins.

import { CLUSTERS, EDGES, ITC_ID, TIE_ORDER } from '../data/ecosystem';

const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Tier radii in world units. Only their ratios matter — the camera supplies the
// scale — but the gaps are sized so a tier's radial labels end before the next
// tier's marks begin.
const CENTER_R = 50;
const FAMILY_RADIUS = 172;
const INNER_RADIUS = 344;
const HUB_RADIUS = 596;

// Vertical distance between two member names on an open cluster's ring. It is a
// row height, not an arc length, because member names are horizontal and two
// horizontal names collide on the vertical axis or not at all.
const MEMBER_ROW = 30;
// Members take the outward 200° of their ring and the wide gap faces the map
// centre, so a cluster can never write over the middle of the map.
const MEMBER_SPREAD = (200 / 360) * TAU;
const MIN_RING = 110;

const NODE_R = {
  family: 21,
  inner: 14,
  member: 9.5,
};

// Labels are drawn at a constant size on screen, not in world units, so they
// stay readable on a phone at fit zoom. That means the room they need is
// measured in screen pixels and handed to the camera, not baked into the frame.
// The renderer draws at exactly these sizes, so the two can never disagree.
export const LABEL_PX = {
  hub: { wide: 15, compact: 11.5 },
  node: { wide: 14, compact: 11.5 },
  member: { wide: 12.5, compact: 11 },
};

const charPx = (fontPx) => fontPx * 0.56;

// Clockwise from the top. Order is editorial: the clusters ITC works through sit
// first, the historical institutions sit opposite them. Slots are fixed even
// when a cluster is filtered away, so filtering never rotates the map.
export const CLUSTER_ORDER = [
  'bridges',
  'institutions',
  'capital',
  'business',
  'heritage',
  'culture',
  'research',
  'talent',
];

const CLUSTER_ANGLE = CLUSTER_ORDER.reduce((map, id, index) => {
  map[id] = -TAU / 4 + (index * TAU) / CLUSTER_ORDER.length;
  return map;
}, {});

// The ITC family (sibling chapters) parks in the gap between the last and first
// slot, so it reads as part of us rather than as one more org in the city. It
// sits deep in that gap on purpose: close to a neighbouring spoke, its name and
// the inner circle's names would fight.
const FAMILY_ANGLE = -TAU / 4 - 0.6;
// Total spread for the inner circle's fan within one cluster's slot. Capped, and
// not per-node, because an inner name must never drift onto its neighbour's
// bearing — the two tiers are only legible while each keeps its own spoke.
const INNER_FAN = 0.52;

// How many documented links each organization carries. Node size follows it, so
// the connectors of the scene read as connectors before you click anything.
const DEGREE = EDGES.reduce((map, edge) => {
  map[edge.a] = (map[edge.a] || 0) + 1;
  map[edge.b] = (map[edge.b] || 0) + 1;
  return map;
}, {});

const degree = (id) => Math.min(DEGREE[id] || 0, 6);

const tieRank = (tie) => {
  const index = TIE_ORDER.indexOf(tie);
  return index === -1 ? TIE_ORDER.length : index;
};

const byTieThenName = (a, b) => tieRank(a.tie) - tieRank(b.tie) || a.name.localeCompare(b.name);

// The cluster ring is an ellipse whose proportions are *solved*, not guessed.
//
// The frame the camera fits is the ring plus one disc radius on every side, so
// it is (R·ax + disc) by (R/ax + disc). Making that box's aspect equal the
// aspect of the room actually left for the drawing is what makes both axes bind
// at once — the difference between a map that fills the screen and one floating
// in a band of dead margin. A fixed exponent cannot do it: the leftover room is
// the viewport minus the floating chrome minus the width the cluster names ask
// for, and none of that scales with the viewport.
//
// Dropping the disc term (the tempting sqrt(roomW / roomH)) is what leaves a
// phone a third empty, because there a disc is 1.7× oversized and no longer a
// rounding error against the radius.
//
// Area is preserved either way, since ay is 1 / ax. The clamp keeps a very tall
// or very wide window from turning the ring into a slit.
const squash = (roomW, roomH, disc) => {
  const a = roomH * HUB_RADIUS;
  const b = (roomH - roomW) * disc;
  const c = -roomW * HUB_RADIUS;
  const ax = clamp((-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a), 0.6, 1.45);
  return { ax, ay: 1 / ax };
};

// A label is described as a direction out of its own mark — the renderer turns
// that into a position, at whatever the current zoom makes a readable offset.
//
// Horizontal, for the marks on the two inner tiers: there are only a handful of
// them and they are the names that matter most, so they are never rotated.
// Placement follows the outward direction — beside the mark on the flanks, above
// or below it at the poles.
const flatLabel = (x, y) => {
  const angle = Math.atan2(y, x);
  const cos = Math.cos(angle);
  if (Math.abs(cos) < 0.4) {
    const above = Math.sin(angle) <= 0;
    return { ux: 0, uy: above ? -1 : 1, anchor: 'middle', rotate: 0, baseline: above ? 'auto' : 'hanging' };
  }
  return {
    ux: Math.sign(cos),
    uy: 0,
    anchor: cos > 0 ? 'start' : 'end',
    rotate: 0,
    baseline: 'middle',
  };
};

// Members get the same horizontal treatment as everything else — nothing on this
// map is rotated, because a fan of tilted names around an open cluster reads as
// a chart accident.
//
// Unlike the inner tiers, a member name is *always* pushed out sideways, never
// above or below its dot. That is what makes the collision problem
// one-dimensional: two horizontal names on the same flank can only overlap on
// the vertical axis, and the row spacing below is what rules that out.
const memberLabel = (angle) => {
  const right = Math.cos(angle) >= 0;
  return { ux: right ? 1 : -1, uy: 0, anchor: right ? 'start' : 'end', rotate: 0, baseline: 'middle' };
};

// Members are spaced by equal *height*, not by equal angle.
//
// Equal angles is the obvious layout and it is the wrong one: near the top and
// bottom of a ring, a whole angular step buys almost no vertical distance, so
// that is exactly where names pile up — and it is why this ring used to need
// rotated labels to be legible at all. Respacing each flank so its dots' heights
// are evenly distributed puts the same number of names on the same arc with a
// guaranteed row height, and the dots stay exactly on the circle.
//
// Each contiguous run of same-facing members is respaced on its own, so the run
// that reads down the right of the ring and the run that reads down the left
// never trade places.
const spaceByHeight = (angles) => {
  const facing = angles.map((angle) => (Math.cos(angle) >= 0 ? 1 : -1));
  let start = 0;
  for (let i = 1; i <= angles.length; i += 1) {
    if (i < angles.length && facing[i] === facing[start]) continue;
    const end = i - 1;
    if (end > start) {
      const from = Math.sin(angles[start]);
      const to = Math.sin(angles[end]);
      for (let j = start; j <= end; j += 1) {
        const height = from + ((to - from) * (j - start)) / (end - start);
        const arc = Math.asin(clamp(height, -1, 1));
        angles[j] = facing[start] > 0 ? arc : Math.PI - arc;
      }
    }
    start = i;
  }
  return angles;
};

// A collapsed hub's name sits outside the disc, horizontal — the cluster names
// are the primary read of the overview, so they never get rotated either. On a
// narrow viewport they go above or below instead: a name beside a disc costs its
// full width on each flank, which on a phone is most of the screen and on a
// portrait tablet is still enough to shrink the marks to specks.
const hubLabel = (hub, stack) => {
  if (!stack) return flatLabel(hub.x, hub.y);
  // A threshold rather than a bare sign test, and biased so that the two discs
  // sitting on the horizontal both go below. Their sin is ±1e-16, so a sign test
  // sent them to opposite sides of their own row; and above them is where the
  // inner circle's own names live, which is the one place a cluster name must
  // not land.
  const below = Math.sin(hub.angle) > -0.15;
  return {
    ux: 0,
    uy: below ? 1 : -1,
    anchor: 'middle',
    rotate: 0,
    baseline: below ? 'hanging' : 'auto',
  };
};

// One ring per open cluster. A ring carries two flanks, so it only has to be
// tall enough for half its members' rows.
const ringRadius = (count) => Math.max(MIN_RING, Math.ceil(count / 2) * MEMBER_ROW);

// orgs: the visible subset (filters already applied).
// expanded: set of cluster ids currently open.
// available: the box left for the drawing once the floating chrome is taken
//   off, in screen pixels. Only its proportions are used here — the scale
//   itself is the camera's business.
export const layoutEcosystem = ({
  orgs,
  available = { w: 1, h: 1 },
  expanded,
  compact = false,
  stack = false,
  fitRings = false,
}) => {
  const open = expanded || new Set();
  // Every mark grows on a phone. The map there is fitted at roughly a third of
  // the scale it gets on a laptop, and a laptop-sized disc becomes a speck.
  const mark = compact ? 1.7 : 1;

  // How much screen room the names need beyond the marks, worked out before any
  // geometry because the ring's proportions are solved against what is left.
  // Beside a disc a name costs its whole width; above one, only half of it.
  const drawn = orgs.filter((org) => org.id !== ITC_ID && org.cluster !== 'itc');
  const hubPx = compact ? LABEL_PX.hub.compact : LABEL_PX.hub.wide;
  const memberPx = compact ? LABEL_PX.member.compact : LABEL_PX.member.wide;
  const longest = CLUSTER_ORDER.reduce((max, id) => {
    if (!drawn.some((org) => org.cluster === id)) return max;
    const cluster = CLUSTERS.find((entry) => entry.id === id);
    return Math.max(max, ((cluster && (cluster.mapLabel || cluster.name)) || '').length);
  }, 0);
  const beside = !stack;
  // Member names run sideways off their rings, so their length is owed on x. On
  // y they only ever cost a line, for the one or two members sitting at a
  // ring's vertical poles.
  const memberRoom = fitRings
    ? drawn.reduce(
        (max, org) => (org.tie === 'none' ? Math.max(max, (org.short || '').length) : max),
        0,
      ) * charPx(memberPx)
    : 0;
  const padX = (beside ? 22 + longest * charPx(hubPx) : 8 + (longest * charPx(hubPx)) / 2) + memberRoom;
  const padY = (beside ? 26 : 20 + hubPx * 2) + (memberRoom ? memberPx * 2.4 : 0);
  const roomFor = (axis, pad) => Math.max(axis - 2 * pad, axis * 0.5);
  const { ax, ay } = squash(
    roomFor(available.w, padX),
    Math.max(1, roomFor(available.h, padY)),
    46 * mark,
  );
  // Only the outer ring follows the viewport's proportions. The two inner tiers
  // stay circular: they hold few enough marks that squashing them would just
  // crowd the ones on the narrow axis.
  const onHubRing = (angle, radius) => ({
    x: Math.cos(angle) * radius * ax,
    y: Math.sin(angle) * radius * ay,
  });
  const onRing = (angle, radius) => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  });

  const centerOrg = orgs.find((org) => org.id === ITC_ID) || null;
  const center = centerOrg
    ? { ...centerOrg, x: 0, y: 0, r: CENTER_R * mark, angle: 0, tier: 'center', isCenter: true }
    : null;

  // Tier 1a: sibling chapters, closest to us.
  const familyOrgs = orgs
    .filter((org) => org.id !== ITC_ID && org.cluster === 'itc')
    .sort(byTieThenName);
  const family = familyOrgs.map((org, index) => {
    const angle = FAMILY_ANGLE + (index - (familyOrgs.length - 1) / 2) * 0.34;
    const position = onRing(angle, FAMILY_RADIUS);
    const r = NODE_R.family * mark;
    return {
      ...org,
      ...position,
      r,
      angle,
      tier: 'family',
      label: flatLabel(position.x, position.y),
    };
  });

  // Tier 1b: the inner circle — anyone we have a tie with, fanned out on their
  // own cluster's spoke so the tie and the cluster read at the same time.
  const city = orgs.filter((org) => org.id !== ITC_ID && org.cluster !== 'itc');
  const linked = city.filter((org) => org.tie !== 'none');
  const inner = [];
  CLUSTER_ORDER.forEach((clusterId) => {
    const group = linked.filter((org) => org.cluster === clusterId).sort(byTieThenName);
    group.forEach((org, index) => {
      const angle =
        CLUSTER_ANGLE[clusterId] +
        (group.length > 1 ? (index / (group.length - 1) - 0.5) * INNER_FAN : 0);
      const position = onRing(angle, INNER_RADIUS);
      const r = (NODE_R.inner + degree(org.id) * 1.4) * mark;
      inner.push({
        ...org,
        ...position,
        r,
        angle,
        tier: 'inner',
        label: flatLabel(position.x, position.y),
      });
    });
  });

  // Tier 2: one disc per cluster, holding everyone we have no shared work with.
  const hubs = [];
  const members = [];
  CLUSTER_ORDER.forEach((clusterId) => {
    const cluster = CLUSTERS.find((entry) => entry.id === clusterId);
    const held = city.filter((org) => org.cluster === clusterId && org.tie === 'none');
    const promoted = linked.filter((org) => org.cluster === clusterId);
    if (held.length === 0 && promoted.length === 0) return;

    const angle = CLUSTER_ANGLE[clusterId];
    const position = onHubRing(angle, HUB_RADIUS);
    const ring = ringRadius(held.length);
    const isOpen = open.has(clusterId);
    const hub = {
      ...cluster,
      ...position,
      angle,
      r: (held.length ? 21 + Math.sqrt(held.length) * 6.6 : 20) * mark,
      ring,
      isOpen,
      memberCount: held.length,
      linkedCount: promoted.length,
      totalCount: held.length + promoted.length,
      linkedIds: promoted.map((org) => org.id),
    };
    hub.label = hubLabel(hub, stack);
    hubs.push(hub);

    if (!isOpen) return;
    const sorted = held.slice().sort(byTieThenName);
    // Spread across the open arc, centred on the outward direction, then
    // respaced so every name gets its own row.
    const memberAngles = spaceByHeight(
      sorted.map((_, index) =>
        sorted.length === 1
          ? angle
          : angle + MEMBER_SPREAD * (index / (sorted.length - 1) - 0.5),
      ),
    );
    sorted.forEach((org, index) => {
      const memberAngle = memberAngles[index];
      const x = hub.x + Math.cos(memberAngle) * ring;
      const y = hub.y + Math.sin(memberAngle) * ring;
      const r = (NODE_R.member + degree(org.id) * 1.1) * mark;
      members.push({
        ...org,
        x,
        y,
        r,
        angle: memberAngle,
        tier: 'member',
        hubId: clusterId,
        hubX: hub.x,
        hubY: hub.y,
        label: memberLabel(memberAngle),
      });
    });
  });

  const nodes = [...(center ? [center] : []), ...family, ...inner, ...members];
  const nodeById = nodes.reduce((map, node) => {
    map[node.id] = node;
    return map;
  }, {});
  const hubById = hubs.reduce((map, hub) => {
    map[hub.id] = hub;
    return map;
  }, {});

  // The frame is what the camera fits: the marks only, and deliberately
  // independent of which clusters are open, so opening a disc never moves the
  // camera. The room the names need travels separately, in screen pixels,
  // because that is the unit they are drawn in.
  // Normally only the marks are framed, so opening a disc never moves the
  // camera. When every disc is open at once — which is what a filter does — the
  // rings are the drawing, and they have to fit.
  const reach = (hub) => (fitRings ? hub.ring + 14 : hub.r);
  // A real bounding box, not a symmetric one: the overview is symmetric anyway,
  // and a filter that leaves two clusters standing should frame those two rather
  // than the empty circle they used to belong to.
  const box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const cover = (x, y, r) => {
    box.minX = Math.min(box.minX, x - r);
    box.maxX = Math.max(box.maxX, x + r);
    box.minY = Math.min(box.minY, y - r);
    box.maxY = Math.max(box.maxY, y + r);
  };
  if (center) cover(0, 0, center.r);
  [...family, ...inner].forEach((node) => cover(node.x, node.y, node.r + 8));
  hubs.forEach((hub) => cover(hub.x, hub.y, reach(hub)));

  return {
    center,
    family,
    inner,
    hubs,
    members,
    nodes,
    nodeById,
    hubById,
    tierRadii: { family: FAMILY_RADIUS, inner: INNER_RADIUS, hub: HUB_RADIUS, ax, ay },
    frame: {
      cx: (box.minX + box.maxX) / 2,
      cy: (box.minY + box.maxY) / 2,
      halfW: Math.max(60, (box.maxX - box.minX) / 2),
      halfH: Math.max(60, (box.maxY - box.minY) / 2),
      padX,
      padY,
    },
  };
};

// Edge geometry. Links into ITC run straight to the hub. Everything else bows
// away from the map centre, which keeps long chords from piling up over ITC and
// makes parallel edges individually readable.
export const edgePath = (from, to) => {
  if (!from || !to) return '';
  if (from.isCenter || to.isCenter) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  let nx = -(to.y - from.y) / distance;
  let ny = (to.x - from.x) / distance;
  if (mx * nx + my * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const bow = Math.min(distance * 0.22, 190);
  return `M ${from.x} ${from.y} Q ${mx + nx * bow} ${my + ny * bow} ${to.x} ${to.y}`;
};

// Hub-to-hub ribbon: a bundle of cross-city links read as one gesture instead
// of forty crossings. It bows away from the centre, like every other non-ITC
// link, so a bundle never runs through the ITC mark.
const bundleControl = (from, to) => {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  let nx = -(to.y - from.y) / distance;
  let ny = (to.x - from.x) / distance;
  if (mx * nx + my * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const bow = Math.min(distance * 0.3, 300);
  return { x: mx + nx * bow, y: my + ny * bow };
};

export const bundlePath = (from, to) => {
  const control = bundleControl(from, to);
  return `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
};

// Where a bundle's weight is written: the apex of its own curve, so the number
// sits on the ribbon it counts.
export const bundleLabel = (from, to) => {
  const control = bundleControl(from, to);
  return {
    x: 0.25 * from.x + 0.5 * control.x + 0.25 * to.x,
    y: 0.25 * from.y + 0.5 * control.y + 0.25 * to.y,
  };
};

// The faint ellipse a tier sits on: the only remaining scale mark in the
// drawing, and the reason the three tiers read as three tiers.
export const tierEllipse = (radius, { ax, ay }) => ({
  rx: radius * ax,
  ry: radius * ay,
});

// A slice of a circle's rim, used for the gauge that tells you how much of a
// collapsed cluster ITC has actually worked with.
export const rimArc = (cx, cy, radius, from, to) => {
  const large = Math.abs(to - from) > Math.PI ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M ${cx + Math.cos(from) * radius} ${cy + Math.sin(from) * radius} A ${radius} ${radius} 0 ${large} ${sweep} ${
    cx + Math.cos(to) * radius
  } ${cy + Math.sin(to) * radius}`;
};
