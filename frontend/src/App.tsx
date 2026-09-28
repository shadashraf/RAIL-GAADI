import {
  Component,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LatLngBounds } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import "./live-marker.css";
import "./home-landmarks.css";
import "./header-layout.css";
import "./analytics.css";
import "./delay-analytics.css";
import "./corridors.css";
import "./live-service.css";
import "./refresh-live.css";
import "./train-search-results.css";
import "./station-search-results-polish.css";
import "./network-intelligence.css";
import "./network-intelligence-kpis.css";
import "./live-service-time.css";
import "./live-service-polish.css";
import "./home-premium.css";
import "./live-trains.css";
import "./navbar-polish.css";
import "./navbar-buttons.css";
import "./live-search-polish.css";
import "./live-search-active.css";
import "./live-journey-schedule.css";
import "./schedule-intelligence-polish.css";
import "./search-transition.css";
import "./search-icon.css";
import "./back-button.css";
import "./selection-states.css";
import "./home-live-search.css";
import { api, ApiError } from "./services/api";

type Page = "home" | "search" | "live" | "analytics" | "corridors" | "network";
type DetailContext = {
  parentPage: Page;
  label: string;
};
type Train = {
  train_number: string;
  name: string;
  source_station: string;
  destination_station: string;
  train_type: string;
};
type StationOption = {
  station_code: string;
  station_name: string;
  city?: string | null;
  is_active?: boolean | null;
};
type TrainSearchResult = Train & {
  train_name?: string;
  route_station_names: string[];
  current_station_code?: string | null;
  current_station_name?: string | null;
  from_station?: StationOption;
  to_station?: StationOption;
  status?: string | null;
  delay_minutes?: number | null;
  scheduled_arrival?: string | null;
  scheduled_departure?: string | null;
  ai_predicted_eta?: string | null;
  duration_minutes?: number | null;
};
type Station = {
  sequence: number;
  station_code: string;
  station_name: string;
  latitude: number | null;
  longitude: number | null;
  scheduled_arrival: string | null;
  scheduled_departure: string | null;
  actual_arrival: string | null;
  actual_departure: string | null;
  arrival_delay_minutes: number | null;
  departure_delay_minutes: number | null;
  platform_no: string | null;
  is_halt: boolean;
};
type RouteResponse = {
  train_number: string;
  stations: Station[];
  segments: Segment[];
};
type Segment = {
  from_station_code: string;
  to_station_code: string;
  distance_km: number | null;
  avg_speed_kmph: number | null;
};
type Delay = {
  latest_delay_minutes: number;
  fresh_delay_minutes: number;
  cumulative_delay_minutes: number;
  reason: string;
  confidence_level: string;
  confidence_score: number;
  evidence_summary: string;
};
type Prediction = {
  train_number: string;
  status?: string;
  predicted_arrival?: string | null;
  predicted_departure?: string | null;
  predicted_delay_minutes?: number | null;
  confidence_score?: number | null;
  model_version?: string | null;
  message?: string | null;
  prediction_source?: "ml" | "fallback";
  is_fallback?: boolean;
  evidence?: { factors?: Array<{ feature: string; importance: number }>; [key: string]: unknown };
};
type ForecastEntry = {
  station_code: string;
  predicted_arrival?: string | null;
  predicted_delay_minutes?: number | null;
  prediction_source?: "ml" | "fallback";
  is_fallback?: boolean;
};
type AnalyticsSummary = {
  active_trains: number;
  total_delay_minutes: number;
  trains: Array<{
    train_number: string;
    train_name: string;
    delay_minutes: number;
    reason: string;
    source: string;
    destination: string;
  }>;
};
type LivePosition = {
  status?: string;
  train_number?: string;
  current_station_code: string | null;
  previous_station_code: string | null;
  next_station_code: string | null;
  current_speed_kmph: number | null;
  updated_at: string | null;
};

type Corridor = {
  trainNumber: string;
  name: string;
  category: string;
  origin: string;
  destination: string;
  stations: number;
  status: "Running" | "Approaching" | "Delayed";
  delay: number;
  eta: string;
  progress: number;
  color: string;
  points: string;
  originPoint: [number, number];
  destinationPoint: [number, number];
  trainPoint: [number, number];
};

const corridorSeed: Corridor[] = [
  { trainNumber: "20801", name: "Magadh Express", category: "Superfast", origin: "New Delhi", destination: "Patna", stations: 18, status: "Running", delay: 8, eta: "18:40", progress: 68, color: "#0875c9", points: "474,114 420,156 365,198 310,238 250,280", originPoint: [474, 114], destinationPoint: [250, 280], trainPoint: [340, 216] },
  { trainNumber: "13401", name: "Danapur Intercity", category: "Express", origin: "Danapur", destination: "Bhagalpur", stations: 12, status: "Approaching", delay: 4, eta: "16:25", progress: 82, color: "#f28a2b", points: "252,284 296,302 350,307 405,295 445,272", originPoint: [252, 284], destinationPoint: [445, 272], trainPoint: [386, 299] },
  { trainNumber: "15658", name: "Brahmaputra Mail", category: "Mail / Express", origin: "Guwahati", destination: "Delhi", stations: 31, status: "Delayed", delay: 31, eta: "22:15", progress: 39, color: "#e05a55", points: "556,104 500,130 448,150 390,174 330,190 270,212 220,245", originPoint: [556, 104], destinationPoint: [220, 245], trainPoint: [430, 158] },
  { trainNumber: "63207", name: "Jhajha - Patna MEMU", category: "Passenger", origin: "Jhajha", destination: "Patna", stations: 22, status: "Running", delay: 2, eta: "15:55", progress: 54, color: "#55a995", points: "366,316 330,300 292,292 252,284 216,270", originPoint: [366, 316], destinationPoint: [216, 270], trainPoint: [292, 292] },
  { trainNumber: "63209", name: "Deoghar - Patna MEMU", category: "Passenger", origin: "Deoghar", destination: "Patna", stations: 19, status: "Running", delay: 6, eta: "17:05", progress: 47, color: "#8b6acb", points: "350,350 322,330 295,311 265,292 238,275", originPoint: [350, 350], destinationPoint: [238, 275], trainPoint: [295, 311] },
];

function NetworkDashboard({ trains, onOpenTrain }: { trains: Train[]; onOpenTrain: (trainNumber: string) => void }) {
  const trainLookup = new Map(trains.map((train) => [train.train_number, train]));
  return <LiveNetworkIntelligence trains={trains} onOpenTrain={onOpenTrain} />;

  /* Legacy map layout retained below as a data-shape reference while the
     intelligence view remains the active network experience. */
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [activeNumber, setActiveNumber] = useState(corridorSeed[0].trainNumber);
  const corridors = corridorSeed.map((corridor) => ({
    ...corridor,
    ...(trainLookup.get(corridor.trainNumber)
      ? { name: trainLookup.get(corridor.trainNumber)?.name ?? corridor.name }
      : {}),
  }));
  const types = ["All types", ...Array.from(new Set(corridors.map((corridor) => corridor.category)))];
  const filtered = corridors.filter((corridor) => {
    const haystack = `${corridor.trainNumber} ${corridor.name} ${corridor.origin} ${corridor.destination}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (typeFilter === "All types" || corridor.category === typeFilter);
  });
  const active = corridors.find((corridor) => corridor.trainNumber === activeNumber) ?? corridors[0];
  const avgDelay = Math.round(corridors.reduce((sum, corridor) => sum + corridor.delay, 0) / corridors.length);

  return (
    <section className="corridors-page">
      <div className="corridors-hero">
        <div><span className="section-kicker">Network geography / operations map</span><h1>Railway corridors</h1><p>See the active Indian rail network, movement status, and route-level performance at a glance.</p></div>
        <div className="network-live-status"><span className="live-dot" /> Network live <small>Updated 42 sec ago</small></div>
      </div>
      <div className="corridor-stats">
        <div><span>Active corridors</span><strong>{corridors.length}</strong><em><b>+2</b> since morning</em></div>
        <div><span>Stations covered</span><strong>102</strong><em>Across 5 active routes</em></div>
        <div><span>Trains running</span><strong>18</strong><em><b>92%</b> on network</em></div>
        <div><span>Avg delay</span><strong>{avgDelay}<small> min</small></strong><em><b>↓ 8%</b> vs yesterday</em></div>
      </div>
      <div className="network-layout">
        <article className="network-map-panel">
          <div className="panel-heading"><div><span className="panel-eyebrow">Live topology</span><h2>India rail network</h2></div><div className="map-keys"><span><i className="key-running" /> Running</span><span><i className="key-delay" /> Delayed</span></div></div>
          <div className="network-map-wrap">
            <svg className="network-map" viewBox="0 0 700 500" role="img" aria-label="Stylized India railway network map">
              <path className="india-silhouette" d="M190 75 260 47 329 59 390 38 460 66 514 105 578 120 600 168 574 204 600 250 566 279 550 330 514 370 481 430 445 457 413 430 383 462 350 430 318 407 287 380 253 355 218 327 190 287 160 258 139 220 160 177 145 133Z" />
              <path className="india-coast" d="M190 75 160 177 139 220 160 258 190 287 218 327 253 355 287 380 318 407 350 430 383 462 413 430 445 457 481 430 514 370 550 330 566 279 600 250" />
              {corridors.map((corridor) => <g key={corridor.trainNumber} className={activeNumber === corridor.trainNumber ? "network-route active" : "network-route"} onMouseEnter={() => setActiveNumber(corridor.trainNumber)} onClick={() => setActiveNumber(corridor.trainNumber)}><polyline points={corridor.points} style={{ stroke: corridor.color }} /><circle cx={corridor.trainPoint[0]} cy={corridor.trainPoint[1]} r="7" className="moving-train" style={{ fill: corridor.color }}><title>{corridor.trainNumber} · {corridor.status}</title></circle><circle cx={corridor.originPoint[0]} cy={corridor.originPoint[1]} r="5" className="map-station origin-station" /><circle cx={corridor.destinationPoint[0]} cy={corridor.destinationPoint[1]} r="5" className="map-station destination-station" /></g>)}
              <text x="438" y="92" className="map-label">Guwahati</text><text x="460" y="105" className="map-label small">15658</text><text x="463" y="124" className="map-label">New Delhi</text><text x="233" y="302" className="map-label">Patna</text><text x="385" y="333" className="map-label">Jhajha</text><text x="211" y="260" className="map-label">Danapur</text>
            </svg>
            <div className="map-active-callout"><span style={{ background: active.color }} /><div><strong>{active.trainNumber} · {active.status}</strong><small>{active.origin} → {active.destination} · +{active.delay} min</small></div></div>
          </div>
          <div className="map-footer"><span><i className="origin-key" /> Origin / destination</span><span><i className="movement-key" /> Live movement</span><b>{active.progress}% route complete</b></div>
        </article>
        <aside className="corridor-side">
          <div className="corridor-filter"><div className="filter-label">Route explorer</div><label className="corridor-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search train or station" /></label><div className="type-filters">{types.map((type) => <button key={type} className={typeFilter === type ? "active" : ""} onClick={() => setTypeFilter(type)}>{type}</button>)}</div></div>
          <div className="corridor-results-head"><strong>Active corridors</strong><span>{filtered.length} routes</span></div>
          <div className="corridor-cards">{filtered.map((corridor) => <button className={activeNumber === corridor.trainNumber ? "corridor-card active" : "corridor-card"} key={corridor.trainNumber} onMouseEnter={() => setActiveNumber(corridor.trainNumber)} onClick={() => setActiveNumber(corridor.trainNumber)}><div className="corridor-card-head"><span className="corridor-code" style={{ color: corridor.color }}>{corridor.trainNumber}</span><span className={`status-chip status-${corridor.status.toLowerCase()}`}>{corridor.status}</span></div><strong>{corridor.name}</strong><small>{corridor.category}</small><div className="corridor-route"><span>{corridor.origin}</span><i /><span>{corridor.destination}</span></div><div className="corridor-card-meta"><span>{corridor.stations} stations</span><span><b className={corridor.delay > 15 ? "delay-high" : ""}>+{corridor.delay}m</b> delay</span><span>ETA {corridor.eta}</span></div><div className="corridor-progress"><i style={{ width: `${corridor.progress}%`, background: corridor.color }} /></div><span className="corridor-open" onClick={(event) => { event.stopPropagation(); onOpenTrain(corridor.trainNumber); }}>Open live service →</span></button>)}</div>
        </aside>
      </div>
    </section>
  );
}

const networkFlowLanes = [
  { id: "gaya-howrah", label: "Gaya → Howrah", meta: "GAYA  ·  HWH", status: "Healthy", color: "#52c78a", points: "35,92 160,68 286,110 410,86 545,132 690,102", trains: 6, delay: 7 },
  { id: "patna-delhi", label: "Patna → Delhi", meta: "PNBE  ·  NDLS", status: "Watch", color: "#f0a35b", points: "32,224 155,190 282,228 420,176 548,205 690,166", trains: 8, delay: 18 },
  { id: "bhagalpur-howrah", label: "Bhagalpur → Howrah", meta: "BGP  ·  HWH", status: "Delayed", color: "#ec6d67", points: "35,356 152,318 284,360 412,316 540,350 690,300", trains: 4, delay: 31 },
];

const networkNodes = [
  { name: "Gaya", code: "GAYA", x: 160, y: 68, load: "normal" },
  { name: "Patna", code: "PNBE", x: 282, y: 228, load: "high" },
  { name: "Bhagalpur", code: "BGP", x: 152, y: 318, load: "high" },
  { name: "Mughalsarai", code: "DDU", x: 420, y: 176, load: "watch" },
  { name: "Howrah", code: "HWH", x: 690, y: 102, load: "normal" },
  { name: "New Delhi", code: "NDLS", x: 690, y: 166, load: "watch" },
  { name: "Kiul", code: "KIUL", x: 412, y: 316, load: "high" },
];

function LiveNetworkIntelligence({ trains, onOpenTrain }: { trains: Train[]; onOpenTrain: (trainNumber: string) => void }) {
  const [activeLane, setActiveLane] = useState("patna-delhi");
  const [query, setQuery] = useState("");
  const filteredLanes = networkFlowLanes.filter((lane) => `${lane.label} ${lane.meta}`.toLowerCase().includes(query.toLowerCase()));
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  useEffect(() => {
    api.getAnalyticsSummary().then((payload) => setSummary(payload as AnalyticsSummary)).catch(() => setSummary(null));
  }, []);
  const trainNames = new Map(trains.map((train) => [train.train_number, train.name]));
  const activeCount = summary?.active_trains ?? trains.length;
  const delayedCount = summary?.trains.filter((train) => train.delay_minutes > 0).length ?? 0;
  const onTimeCount = Math.max(0, activeCount - delayedCount);
  const averageDelay = activeCount ? Math.round((summary?.total_delay_minutes ?? 0) / activeCount) : 0;
  const visibleLanes = filteredLanes.length ? filteredLanes : networkFlowLanes;

  return (
    <section className="intelligence-page">
      <div className="intelligence-header">
        <div><span className="section-kicker">Network operations / live intelligence</span><h1>Live Network Intelligence</h1><p>Real-time flow, corridor health, and AI delay signals across the active railway network.</p></div>
        <div className="intelligence-live"><i /> LIVE NETWORK <small>streaming · 42 sec ago</small></div>
      </div>

      <div className="pulse-grid">
        <div className="pulse-card running"><span>Running</span><strong>{Math.max(0, activeCount - delayedCount)}</strong><em>Trains moving now</em></div>
        <div className="pulse-card delayed"><span>Delayed</span><strong>{delayedCount}</strong><em>Needs attention</em></div>
        <div className="pulse-card on-time"><span>On time</span><strong>{onTimeCount}</strong><em>Within schedule</em></div>
        <div className="pulse-card cancelled"><span>Cancelled</span><strong>01</strong><em>Service affected</em></div>
      </div>
      <div className="network-mini-stats">
        <div><span>Active trains</span><strong>{activeCount}</strong><em>Backend active services</em></div>
        <div><span>Delayed trains</span><strong>{delayedCount}</strong><em>{activeCount ? Math.round((delayedCount / activeCount) * 100) : 0}% of active fleet</em></div>
        <div><span>Avg delay</span><strong>{averageDelay}<small> min</small></strong><em>Current network average</em></div>
        <div><span>Predictions generated</span><strong>1,284</strong><em>91% route coverage</em></div>
      </div>

      <div className="intelligence-grid">
        <article className="flow-panel intelligence-panel">
          <div className="intelligence-panel-heading"><div><span className="panel-eyebrow">Live Train Flow</span><h2>Corridor movement</h2></div><span className="flow-legend"><i /> moving <i /> station node</span></div>
          <div className="flow-canvas">
            <div className="flow-grid-lines" />
            <svg viewBox="0 0 720 420" className="flow-svg" role="img" aria-label="Live connected train corridors">
              {visibleLanes.map((lane) => <g key={lane.id} className={activeLane === lane.id ? "flow-lane active" : "flow-lane"} onMouseEnter={() => setActiveLane(lane.id)} onClick={() => setActiveLane(lane.id)}><polyline points={lane.points} style={{ stroke: lane.color }} /><circle className="flow-train train-one" r="6" style={{ fill: lane.color }}><animateMotion dur={`${7 + lane.trains / 2}s`} repeatCount="indefinite" path={lane.points.replaceAll(" ", " L").replace(/^/, "M")} /></circle><circle className="flow-train train-two" r="4" style={{ fill: lane.color }}><animateMotion dur={`${10 + lane.trains / 2}s`} begin="-4s" repeatCount="indefinite" path={lane.points.replaceAll(" ", " L").replace(/^/, "M")} /></circle></g>)}
              {networkNodes.map((node) => <g key={node.code} className={`network-node node-${node.load}`}><circle cx={node.x} cy={node.y} r="8" /><circle cx={node.x} cy={node.y} r="15" className="node-ring" /><text x={node.x + 13} y={node.y - 5}>{node.name}</text><text x={node.x + 13} y={node.y + 9} className="node-code">{node.code}</text></g>)}
            </svg>
            <div className="flow-tooltip"><span style={{ background: networkFlowLanes.find((lane) => lane.id === activeLane)?.color }} /><div><strong>{networkFlowLanes.find((lane) => lane.id === activeLane)?.label}</strong><small>{networkFlowLanes.find((lane) => lane.id === activeLane)?.trains} trains in motion · avg delay +{networkFlowLanes.find((lane) => lane.id === activeLane)?.delay}m</small></div></div>
          </div>
          <div className="flow-footer"><span><i className="flow-key-train" /> train movement</span><span><i className="flow-key-hotspot" /> congestion node</span><b>Click a corridor to inspect</b></div>
        </article>

        <article className="health-panel intelligence-panel">
          <div className="intelligence-panel-heading"><div><span className="panel-eyebrow">Network Health</span><h2>System status</h2></div><span className="health-badge">GOOD</span></div>
          <div className="health-ring"><div><strong>82</strong><span>/ 100</span><small>healthy</small></div></div>
          <div className="health-metrics"><span><i className="health-good" /> Signal availability <b>96%</b></span><span><i className="health-watch" /> Corridor stability <b>78%</b></span><span><i className="health-good" /> Prediction coverage <b>91%</b></span></div>
        </article>

        <article className="delay-panel intelligence-panel"><div className="intelligence-panel-heading"><div><span className="panel-eyebrow">Top Delay Corridors</span><h2>Where time is being lost</h2></div><button className="mini-action">24h ↗</button></div><div className="delay-ranking">{networkFlowLanes.slice().sort((a, b) => b.delay - a.delay).map((lane, index) => <button key={lane.id} className="delay-rank" onMouseEnter={() => setActiveLane(lane.id)} onClick={() => setActiveLane(lane.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{lane.label}</strong><small>{lane.trains} active trains · {lane.status}</small><i><em style={{ width: `${Math.min(100, lane.delay * 2.1)}%`, background: lane.color }} /></i></div><b>+{lane.delay}m</b></button>)}</div></article>

        <article className="hotspot-panel intelligence-panel"><div className="intelligence-panel-heading"><div><span className="panel-eyebrow">Congestion Hotspots</span><h2>Pressure points</h2></div><span className="hotspot-live">● 3 active</span></div><div className="hotspot-list">{[{ station: "Patna Jn", code: "PNBE", traffic: "Heavy", count: "12 trains", color: "#ec6d67" }, { station: "Mughalsarai Jn", code: "DDU", traffic: "Watch", count: "8 trains", color: "#f0a35b" }, { station: "Kiul Jn", code: "KIUL", traffic: "Heavy", count: "9 trains", color: "#ec6d67" }].map((hotspot) => <div className="hotspot-row" key={hotspot.code}><span className="hotspot-node" style={{ background: hotspot.color }} /><div><strong>{hotspot.station} <small>{hotspot.code}</small></strong><span>{hotspot.count} in section</span></div><b style={{ color: hotspot.color }}>{hotspot.traffic}</b></div>)}</div></article>
      </div>

      <div className="intelligence-lower-grid">
        <article className="movement-panel intelligence-panel"><div className="intelligence-panel-heading"><div><span className="panel-eyebrow">Live Movement</span><h2>Train activity</h2></div><label className="intelligence-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter corridor" /></label></div><div className="movement-list">{[{ number: "20801", name: trainNames.get("20801") ?? "Magadh Express", state: "Moving", station: "DDU → PNBE", speed: "74 km/h", color: "#52c78a" }, { number: "15658", name: trainNames.get("15658") ?? "Brahmaputra Mail", state: "Stopped", station: "KIUL Jn · 06m halt", speed: "0 km/h", color: "#ec6d67" }, { number: "13401", name: trainNames.get("13401") ?? "Danapur Intercity", state: "Approaching", station: "BGP · 8 min away", speed: "52 km/h", color: "#f0a35b" }].map((train) => <button className="movement-row" key={train.number} onClick={() => onOpenTrain(train.number)}><i style={{ background: train.color }} /><div><strong>{train.number} · {train.name}</strong><small>{train.station}</small></div><span className={`movement-state ${train.state.toLowerCase()}`}>{train.state}</span><b>{train.speed}</b></button>)}</div></article>
        <article className="alerts-panel intelligence-panel"><div className="intelligence-panel-heading"><div><span className="panel-eyebrow">AI Delay Alerts</span><h2>Predicted events</h2></div><span className="alert-count">3 new</span></div><div className="alert-list"><div className="ai-alert critical"><i>!</i><div><strong>Patna Jn congestion</strong><span>20801 may arrive <b>+14m</b> late</span><small>confidence 88% · 18 min horizon</small></div></div><div className="ai-alert watch"><i>↗</i><div><strong>Bhagalpur dwell extension</strong><span>13401 ETA impact <b>+7m</b></span><small>confidence 76% · 11 min horizon</small></div></div><div className="ai-alert info"><i>✓</i><div><strong>Gaya–Howrah recovering</strong><span>15658 delay reducing by <b>4m</b></span><small>confidence 82% · live trend</small></div></div></div></article>
      </div>

      <div className="active-corridor-strip"><div><span className="panel-eyebrow">Active Corridors</span><h2>Network lanes</h2></div><div className="active-corridor-items">{networkFlowLanes.map((lane) => <button className={activeLane === lane.id ? "active" : ""} key={lane.id} onClick={() => setActiveLane(lane.id)}><i style={{ background: lane.color }} /><span><strong>{lane.label}</strong><small>{lane.status} · +{lane.delay}m avg</small></span><b>↗</b></button>)}</div></div>
    </section>
  );
}

type AnalyticsDatum = {
  label: string;
  count: number;
  color: string;
};

function DonutChart({ data, totalDelay }: { data: AnalyticsDatum[]; totalDelay: number | null }) {
  const [active, setActive] = useState(0);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const gradient = data
    .map((item) => {
      const start = total ? (offset / total) * 360 : 0;
      offset += item.count;
      return `${item.color} ${start}deg ${(total ? offset / total : 0) * 360}deg`;
    })
    .join(", ");

  return (
    <div className="chart-content donut-layout">
      {data.length > 0 ? <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }} aria-label="Reported delay reasons by active service">
        <div className="donut-hole">
          <strong>{totalDelay == null ? "—" : `${Math.round(totalDelay)} min`}</strong>
          <span>Total delay</span>
        </div>
      </div> : <div className="analytics-chart-empty">Reported reason data unavailable</div>}
      <div className="chart-legend">
        {data.map((item, index) => (
          <button
            key={item.label}
            className={active === index ? "legend-active" : ""}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => setActive(index)}
            title={`${item.count} active service records`}
          >
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
            <b>{total ? `${Math.round((item.count / total) * 100)}%` : "—"}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

type DelayComparisonDatum = { label: string; scheduled: number | null; actual: number | null };

function DelayBarChart({ data }: { data: DelayComparisonDatum[] }) {
  const max = Math.max(1, ...data.map((item) => Math.abs(item.actual ?? 0)));
  return (
    <div className="chart-content bar-chart-wrap">
      <div className="analytics-fleet-rows">
        {data.length ? data.slice(0, 8).map((item) => (
          <div className="analytics-fleet-row" key={item.label}>
            <strong>{item.label}</strong>
            <div className="analytics-fleet-track" title={item.actual == null ? "Actual delay unavailable" : `${item.actual > 0 ? "+" : ""}${item.actual} min actual delay`}>
              {item.actual != null && <i style={{ width: `${Math.max(3, (Math.abs(item.actual) / max) * 100)}%` }} />}
            </div>
            <b>{item.actual == null ? "Unavailable" : `${item.actual > 0 ? "+" : ""}${item.actual} min`}</b>
          </div>
        )) : <div className="analytics-chart-empty">No active service delay records are available.</div>}
      </div>
      <div className="chart-caption"><span><i className="key-scheduled" /> Scheduled baseline <b>Unavailable</b></span><span><i className="key-actual" /> Actual delay</span></div>
    </div>
  );
}

function EtaScatterChart({ testMae, residualP90 }: { testMae: number | null; residualP90: number | null }) {
  return (
    <div className="chart-content scatter-wrap">
      <div className="validation-unavailable">
        <span className="validation-icon">↗</span>
        <strong>Point-level validation data unavailable</strong>
        <span>The current API does not expose observed ETA-error samples or regression statistics.</span>
      </div>
      <div className="validation-metrics">
        <div><span>Test MAE</span><strong>{testMae == null ? "Unavailable" : `${testMae} min`}</strong></div>
        <div><span>Validation residual P90</span><strong>{residualP90 == null ? "Unavailable" : `${residualP90} min`}</strong></div>
        <div><span>R²</span><strong>Unavailable</strong></div>
      </div>
    </div>
  );
}

class MapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="map-card map-error">
          <div className="map-heading">
            <div>
              <span className="section-kicker">India network view</span>
              <h3>Route map unavailable</h3>
            </div>
          </div>
          <div className="map-empty">
            <strong>Station route data is still available</strong>
            <span>Use the station flow on the left while the map reloads.</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const navItems: { id: Page; label: string; icon?: string }[] = [
  { id: "home", label: "Home" },
  { id: "search", label: "Train Search" },
  { id: "live", label: "Live Trains" },
  { id: "analytics", label: "Analytics" },
  { id: "corridors", label: "Corridors" },
  { id: "network", label: "Network Intelligence", icon: "⌁" },
];

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return formatTime(value);
  const elapsedMinutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
  if (elapsedMinutes === 0) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return `${Math.floor(elapsedHours / 24)} days ago`;
}

function resultStatusLabel(value: string | null | undefined) {
  const status = (value ?? "").trim().toLowerCase().replaceAll("_", "-");
  if (status === "running" || status === "at-station" || status === "departed") return "LIVE";
  if (status === "upcoming" || status === "scheduled" || status === "not-started") return "UPCOMING";
  if (status === "completed") return "COMPLETED";
  if (status === "not-running") return "NOT RUNNING";
  if (status === "cancelled") return "CANCELLED";
  return status ? status.replaceAll("-", " ").toUpperCase() : "STATUS UNAVAILABLE";
}

function scheduledMinutes(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timeOnly = value.match(/^(\d{1,2}):(\d{2})/);
  if (timeOnly) return Number(timeOnly[1]) * 60 + Number(timeOnly[2]);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

function formatDuration(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Duration unavailable";
  const totalMinutes = Math.max(0, Math.round(value));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} hr${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} min` : ""}` : `${minutes} min`;
}

function SearchIcon() {
  return <img className="search-icon-image" src="/search-icon.png" alt="" aria-hidden="true" />;
}

function RefreshLiveButton({
  refreshing,
  refreshError,
  onRefresh,
  label = "Refresh Live",
  showLiveBadge = true,
}: {
  refreshing: boolean;
  refreshError: string;
  onRefresh: () => void;
  label?: string;
  showLiveBadge?: boolean;
}) {
  return (
    <button
      className={`secondary-button refresh-live-button${refreshing ? " is-refreshing" : ""}${refreshError ? " is-error" : ""}`}
      type="button"
      aria-label={refreshError ? `${label} failed: ${refreshError}` : label}
      aria-busy={refreshing}
      disabled={refreshing}
      title={refreshError || "Refresh live train data"}
      onClick={onRefresh}
    >
      <span className="refresh-live-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" focusable="false">
          <path d="M16.7 7.1A7 7 0 0 0 4.2 5.2L3 6.5m0 0V3.7m0 2.8h2.8M3.3 12.9a7 7 0 0 0 12.5 1.9l1.2-1.3m0 0v2.8m0-2.8h-2.8" />
        </svg>
      </span>
      <span className="refresh-live-label">{label}</span>
      {showLiveBadge && <span className="refresh-live-badge"><i />LIVE</span>}
    </button>
  );
}

function RouteMap({
  route,
  currentStationCode,
}: {
  route: RouteResponse | null;
  currentStationCode?: string | null;
}) {
  const mappedStations = useMemo(() => {
    const seen = new Set<string>();
    return (route?.stations ?? []).filter((station) => {
      if (
        station.latitude == null ||
        station.longitude == null ||
        !Number.isFinite(station.latitude) ||
        !Number.isFinite(station.longitude) ||
        seen.has(station.station_code)
      ) {
        return false;
      }
      seen.add(station.station_code);
      return true;
    });
  }, [route?.stations]);
  const points = useMemo(
    () =>
      mappedStations.map(
        (station) =>
          [station.latitude as number, station.longitude as number] as [
            number,
            number,
          ],
      ),
    [mappedStations],
  );
  const hasGeometry = points.length > 1;
  const currentMapIndex = mappedStations.findIndex(
    (station) => station.station_code === currentStationCode,
  );

  function FocusRoute() {
    const map = useMap();

    useEffect(() => {
      if (!hasGeometry) return;
      const bounds = new LatLngBounds(points);
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 7 });
    }, [map, hasGeometry, points]);

    return null;
  }

  return (
    <div className="map-card">
      <div className="map-heading">
        <div>
          <span className="section-kicker">India network view</span>
          <h3>Live route map</h3>
        </div>
        <span className={`map-state ${hasGeometry ? "ready" : ""}`}>
          {hasGeometry ? "ROUTE READY" : "ORIGIN / DESTINATION"}
        </span>
      </div>
      <div className="map-wrap">
        {hasGeometry ? (
          <MapContainer
            key={route?.train_number ?? "static-route-map"}
            center={points[0]}
            zoom={5}
            scrollWheelZoom={false}
            zoomControl={false}
            className="leaflet-map static-route-map"
          >
            <FocusRoute />
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {currentMapIndex > 0 && (
              <Polyline
                positions={points.slice(0, currentMapIndex + 1)}
                pathOptions={{ color: "#9aabb5", weight: 5, opacity: 0.7, dashArray: "4 8" }}
              />
            )}
            <Polyline
              positions={points.slice(Math.max(currentMapIndex, 0))}
              pathOptions={{ color: "#52c78a", weight: 5, opacity: 0.95 }}
            />
            {mappedStations.map((station, index) => {
              const isOrigin = index === 0;
              const isDestination = index === mappedStations.length - 1;
              const isCurrent = station.station_code === currentStationCode;
              const isJunction = /(?:jn|junction|central|terminal|cantt|city)/i.test(
                `${station.station_name} ${station.station_code}`,
              );
              return (
                <CircleMarker
                  key={station.station_code}
                  center={[station.latitude as number, station.longitude as number]}
                  className={isCurrent ? "current-map-marker" : ""}
                  radius={isCurrent ? 10 : isOrigin || isDestination || isJunction ? 7 : 4}
                  pathOptions={{
                    color: isCurrent ? "#ffffff" : isDestination ? "#d55355" : isJunction ? "#f0a35b" : "#0875c9",
                    fillColor: isCurrent ? "#52c78a" : isDestination ? "#d55355" : isJunction ? "#f0a35b" : "#ffffff",
                    fillOpacity: 1,
                    weight: isCurrent ? 4 : isJunction ? 3 : 2,
                  }}
                >
                  <Tooltip permanent={isOrigin || isDestination || isCurrent || isJunction}>
                    {station.station_name} ({station.station_code})
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="map-empty">
            <strong>Route geometry waiting</strong>
            <span>Station coordinates are required for the station-to-station route.</span>
          </div>
        )}
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-line passed-route" />
          Passed route
        </span>
        <span>
          <i className="legend-line live-route" />
          Upcoming route
        </span>
        <span>
          <i className="legend-dot current-station" />
          Current train
        </span>
      </div>
    </div>
  );
}

function LiveServicePage({
  train,
  trainNumber,
  route,
  delay,
  prediction,
  forecast,
  livePosition,
  refreshing,
  refreshError,
  lastUpdatedAt,
  displaySpeedKmph,
  currentStationName,
  delayReasonSummary,
  onRefresh,
  onAnalytics,
}: {
  train?: Train;
  trainNumber: string;
  route: RouteResponse | null;
  delay: Delay | null;
  prediction: Prediction | null;
  forecast: ForecastEntry[];
  livePosition: LivePosition | null;
  refreshing: boolean;
  refreshError: string;
  lastUpdatedAt: string | null;
  displaySpeedKmph: number | null;
  currentStationName: string;
  delayReasonSummary: string;
  onRefresh: () => void;
  onAnalytics: () => void;
}) {
  const [showAllHalts, setShowAllHalts] = useState(true);
  const [isJourneyExpanded, setIsJourneyExpanded] = useState(false);
  const stations = useMemo(() => {
    const seen = new Set<string>();
    return (route?.stations ?? []).filter((station) => {
      if (seen.has(station.station_code)) return false;
      seen.add(station.station_code);
      return true;
    });
  }, [route?.stations]);
  const matchedCurrentIndex = livePosition?.current_station_code
    ? stations.findIndex((station) => station.station_code === livePosition.current_station_code)
    : -1;
  const currentIndex = matchedCurrentIndex;
  const isMajorStation = (station: Station, index: number) =>
    station.is_halt ||
    /(?:jn|junction|central|terminal|cantt|city)/i.test(
      `${station.station_name} ${station.station_code}`,
    ) ||
    index === 0 ||
    index === stations.length - 1;
  const importantStations = stations.filter(
    (station, index) => isMajorStation(station, index) || index === currentIndex,
  );
  const visibleStations = showAllHalts ? stations : importantStations;
  const intermediateHaltCount = Math.max(0, stations.length - importantStations.length);
  const reportedCurrentDelay = delay?.latest_delay_minutes ?? null;
  const hasReportedCurrentDelay = reportedCurrentDelay != null;
  const currentDelay = reportedCurrentDelay ?? 0;
  const confidenceScore = delay?.confidence_score ?? prediction?.confidence_score ?? null;
  const confidence = confidenceScore == null ? null : Math.round(confidenceScore * 100);
  const currentDelayLabel = hasReportedCurrentDelay
    ? `${currentDelay > 0 ? "+" : ""}${Math.round(currentDelay)} min`
    : "Unavailable";
  const currentDelayTone = hasReportedCurrentDelay && currentDelay > 0 ? "delay-value" : "live-value";
  const delayEvidence = [
    { label: "Latest delay", value: delay?.latest_delay_minutes },
    { label: "Fresh delay", value: delay?.fresh_delay_minutes },
    { label: "Cumulative delay", value: delay?.cumulative_delay_minutes },
  ].filter((item): item is { label: string; value: number } => item.value != null);
  const destinationStation = stations[stations.length - 1];
  const predictedDestination = prediction?.predicted_arrival ?? null;
  const currentStationCode = livePosition?.current_station_code ?? (currentIndex >= 0 ? stations[currentIndex]?.station_code : null);
  const previousStationCode = livePosition?.previous_station_code ?? (currentIndex > 0 ? stations[currentIndex - 1]?.station_code : null);
  const nextStationCode = livePosition?.next_station_code ?? (currentIndex >= 0 ? stations[currentIndex + 1]?.station_code : null);
  const routeProgress = currentIndex >= 0 && stations.length > 0
    ? `${Math.round((currentIndex / Math.max(stations.length - 1, 1)) * 100)}%`
    : "Unavailable";

  function predictedTime(station: Station) {
    const forecastEntry = forecast.find((entry) => entry.station_code === station.station_code);
    if (forecastEntry?.predicted_arrival) return forecastEntry.predicted_arrival;
    if (station.station_code === destinationStation?.station_code && prediction?.predicted_arrival) {
      return prediction.predicted_arrival;
    }
    return null;
  }

  function predictionLabel(station: Station) {
    const entry = forecast.find((item) => item.station_code === station.station_code);
    const hasPrediction = Boolean(entry?.predicted_arrival) || (station.station_code === destinationStation?.station_code && Boolean(prediction?.predicted_arrival));
    if (!hasPrediction) return "Unavailable";
    return entry?.is_fallback || prediction?.is_fallback ? "Fallback ETA" : "AI Predicted";
  }

  function stationState(index: number) {
    if (matchedCurrentIndex < 0) return "upcoming";
    if (index < matchedCurrentIndex) return "passed";
    if (index === matchedCurrentIndex) return "current";
    return "upcoming";
  }

  function scheduledTime(value: string | null) {
    return value ? formatTime(value) : "—";
  }

  function actualTime(value: string | null) {
    return value ? formatTime(value) : null;
  }

  useEffect(() => {
    setShowAllHalts(true);
    setIsJourneyExpanded(false);
  }, [route?.train_number]);

  return (
    <section className="live-service-page">
      <div className="live-service-header">
        <div>
          <div className="breadcrumb">Train Search / Live Service</div>
          <h1>{train?.train_number ?? route?.train_number ?? trainNumber} · {train?.name ?? "Train details unavailable"}</h1>
          <p>{train?.source_station ?? stations[0]?.station_name ?? "Unavailable"} <b>→</b> {train?.destination_station ?? destinationStation?.station_name ?? "Unavailable"} <span className="service-tag">{train?.train_type ?? "Live service"}</span></p>
        </div>
        <div className="live-service-actions"><RefreshLiveButton refreshing={refreshing} refreshError={refreshError} onRefresh={onRefresh} showLiveBadge={Boolean(livePosition)} /></div>
      </div>

      <div className="prediction-banner">
        <div><span className="prediction-label">{prediction?.is_fallback ? "Fallback ETA" : "AI Predicted arrival"}</span><strong>{formatTime(predictedDestination)}</strong><small>{prediction ? prediction.is_fallback ? "Route/speed fallback" : "ML ETA" : "Prediction unavailable"} · confidence {confidence == null ? "Unavailable" : `${confidence}%`}</small></div>
        <div className="prediction-divider" />
        <div><span className="prediction-label">Scheduled arrival</span><strong className="scheduled-time">{formatTime(destinationStation?.scheduled_arrival)}</strong><small>{!hasReportedCurrentDelay ? "Delay unavailable" : currentDelay > 0 ? `+${Math.round(currentDelay)} min expected delay` : "On schedule"}</small></div>
        <div className="prediction-confidence"><span>ETA confidence</span><strong>{confidence == null ? "Unavailable" : `${confidence}%`}</strong><div><i style={{ width: `${confidence ?? 0}%` }} /></div><small>{confidence == null ? "Model confidence unavailable" : "Model + live movement evidence"}</small></div>
      </div>

      <div className="live-status-card">
        <div className="live-status-intro"><span className={livePosition ? "status-pulse" : "status-pulse is-unavailable"} /><div><span className="panel-eyebrow">Live train status · {livePosition?.status ?? (livePosition ? "LIVE" : "Unavailable")}</span><h2>{currentStationName}</h2><small>{livePosition ? "Current position from the live service API" : "Live position unavailable"}</small></div></div>
        <div className="live-status-grid">
          <div><span>Previous station</span><strong>{previousStationCode ?? "—"}</strong></div>
          <div><span>Current station</span><strong className={currentStationCode ? "live-value" : ""}>{currentStationCode ?? "—"}</strong></div>
          <div><span>Next station</span><strong>{nextStationCode ?? "—"}</strong></div>
          <div><span>Speed</span><strong>{displaySpeedKmph != null ? `${Math.round(displaySpeedKmph)} km/h` : "—"}</strong></div>
          <div><span>Current delay</span><strong className={currentDelayTone}>{currentDelayLabel}</strong></div>
          <div><span>Last updated</span><strong>{formatRelativeTime(lastUpdatedAt ?? livePosition?.updated_at)}</strong></div>
        </div>
        <div className="live-reason"><b>AI delay reason</b><span>{delayReasonSummary}</span><button onClick={onAnalytics}>View evidence →</button></div>
      </div>

      <div className="live-metrics-strip">
        <article><span>Current delay</span><strong className={currentDelayTone}>{currentDelayLabel}</strong><em>{delay?.fresh_delay_minutes == null ? "Fresh delay unavailable" : `${Math.round(delay.fresh_delay_minutes)} min fresh movement`}</em></article>
        <article className="prediction-metric"><span>AI predicted delay</span><strong>{prediction?.predicted_delay_minutes != null ? `+${Math.round(prediction.predicted_delay_minutes)} min` : "Unavailable"}</strong><em>Model projection at destination</em></article>
        <article className="prediction-metric"><span>Destination ETA</span><strong>{formatTime(predictedDestination)}</strong><em>AI Predicted arrival</em></article>
        <article><span>Route progress</span><strong>{routeProgress}</strong><em>{currentIndex >= 0 && stations.length > 0 ? `${currentIndex + 1} of ${stations.length} stations` : "Live route progress unavailable"}</em></article>
        <article><span>Confidence</span><strong className="confidence-value">{confidence == null ? "Unavailable" : `${confidence}%`}</strong><em>{delay?.confidence_level ?? (prediction ? "Prediction confidence" : "Unavailable")}</em></article>
      </div>

      <section className="station-board schedule-intelligence" aria-labelledby="schedule-intelligence-title">
        <header className="schedule-intelligence-header">
          <div className="schedule-heading-copy">
            <span className="panel-eyebrow">Schedule Intelligence</span>
            <h2 id="schedule-intelligence-title">Station Timings</h2>
            <p>Real-time station timings with live updates and AI-powered predictions</p>
          </div>
          <div className="schedule-heading-controls">
            <span className="prediction-key"><i /> AI Predicted</span>
            <button className="halt-toggle" aria-expanded={showAllHalts} onClick={() => setShowAllHalts((expanded) => !expanded)}>
              {showAllHalts ? "Hide intermediate halts" : `Show all halts (${intermediateHaltCount})`}
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
            </button>
          </div>
          <div className="schedule-legend" aria-label="Station status legend">
            <span><i className="legend-passed" />Passed</span>
            <span><i className="legend-current" />Current</span>
            <span><i className="legend-upcoming" />Upcoming</span>
          </div>
        </header>
        <div className="station-timeline">
          {visibleStations.map((station) => {
            const stationIndex = stations.indexOf(station);
            const stationDelay = station.arrival_delay_minutes ?? station.departure_delay_minutes ?? (hasReportedCurrentDelay ? currentDelay : null);
            const state = stationState(stationIndex);
            const isCurrent = stationIndex === matchedCurrentIndex && matchedCurrentIndex >= 0;
            const statusLabel = isCurrent ? "Live now" : state === "passed" ? "Passed" : "Upcoming";

            return (
              <div className={`station-timeline-item ${state}`} key={`${station.station_code}-${station.sequence}`}>
                <div className="station-rail-column">
                  <span className="station-rail-node" />
                  {isCurrent && (
                    <span className="station-train-marker" role="img" aria-label="Train current position">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                        <path d="M7 3.5h10a2.5 2.5 0 0 1 2.5 2.5v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3V6a2.5 2.5 0 0 1 2.5-2.5Z" />
                        <path d="M6 11h12M8 7.5h.1m7.8 0h.1M8 18l-2 2m10-2 2 2M8 14.5h.1m7.8 0h.1" />
                      </svg>
                    </span>
                  )}
                  {isCurrent && <span className="station-live-now">LIVE NOW</span>}
                </div>
                <article className={`station-row station-card ${state} ${isMajorStation(station, stationIndex) ? "major-station" : "intermediate-halt"}`}>
                  <div className="station-identity">
                    <span className="station-card-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M6 3.5h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" /><path d="M5 9h10M7 6.5h.1m5.8 0h.1M7 14.5l-1.5 2m7-2 1.5 2" /></svg>
                    </span>
                    <div className="station-name">
                      <strong>{station.station_name}</strong>
                      <span className="station-code-platform"><b>{station.station_code}</b><i />Platform {station.platform_no ?? "—"}</span>
                      <span className="station-ai-reason">AI evidence · {delay?.reason ?? "Unavailable"}</span>
                    </div>
                    <span className={`station-state-badge ${state}`}>
                      {isCurrent && <i className="station-live-indicator" />}{statusLabel}
                    </span>
                  </div>

                  <div className="station-timing-group arrival-time">
                    <span className="station-timing-heading">Arrival</span>
                    <span className="scheduled-time-value"><small>Scheduled</small>{scheduledTime(station.scheduled_arrival)}</span>
                    {actualTime(station.actual_arrival) && <span className="actual-arrival-time"><small>Live</small>{actualTime(station.actual_arrival)}</span>}
                  </div>

                  <div className="station-timing-group departure-time">
                    <span className="station-timing-heading">Departure</span>
                    <span className="scheduled-time-value"><small>Scheduled</small>{scheduledTime(station.scheduled_departure)}</span>
                    {actualTime(station.actual_departure) && <span className="actual-departure-time"><small>Live</small>{actualTime(station.actual_departure)}</span>}
                  </div>

                  <div className="station-prediction-group">
                    <span className="station-timing-heading">AI Predicted</span>
                    <strong className="predicted-time"><small>{predictionLabel(station)}</small>{formatTime(predictedTime(station))}</strong>
                    <b className={`station-delay-difference${stationDelay != null && stationDelay > 0 ? " has-delay" : ""}`}>
                      {stationDelay == null ? "Unavailable" : stationDelay > 0 ? `+${Math.round(stationDelay)} min` : stationDelay < 0 ? `${Math.abs(Math.round(stationDelay))} min early` : "On time"}
                    </b>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </section>

      <section className={`journey-panel journey-collapsible ${isJourneyExpanded ? "is-expanded" : "is-collapsed"}`} aria-labelledby="live-journey-title">
        <div className="service-panel-heading"><div><span className="panel-eyebrow">Live journey</span><h2 id="live-journey-title">Where is the train?</h2></div><span className="journey-legend" aria-label="Journey status"><i className="passed-dot" /> Passed <i className="current-dot" /> Current <i className="upcoming-dot" /> Upcoming</span></div>
        <div className="journey-summary"><div><span>Previous station</span><strong>{previousStationCode ?? "—"}</strong></div><div className="journey-summary-current"><span>Current station</span><strong>{currentStationCode && <i />} {currentStationCode ?? "—"}</strong></div><div><span>Next station</span><strong>{nextStationCode ?? "—"}</strong></div><div><span>Route progress</span><strong>{routeProgress}</strong></div></div>
        <div id="live-journey-timeline" className="journey-expandable" aria-hidden={!isJourneyExpanded}><div className="journey-timeline">{visibleStations.map((station) => { const stationIndex = stations.indexOf(station); return <button key={station.station_code} className={`journey-stop ${stationState(stationIndex)} ${isMajorStation(station, stationIndex) ? "major-stop" : "halt-stop"}`} tabIndex={isJourneyExpanded ? 0 : -1}><span className="journey-line" /><i /> <strong>{station.station_code}</strong><small>{station.station_name}</small><em>{stationState(stationIndex) === "current" ? "Current" : formatTime(predictedTime(station))}</em></button>; })}</div></div>
        <button className="view-stations-button" aria-expanded={isJourneyExpanded} aria-controls="live-journey-timeline" onClick={() => setIsJourneyExpanded((expanded) => !expanded)}>{isJourneyExpanded ? "Hide Live Journey ↑" : "View Live Journey →"}</button>
      </section>

      <section className="service-analysis" aria-labelledby="delay-analysis-title">
        <div className="service-analysis-main">
          <span className="panel-eyebrow">Delay analysis</span>
          <h2 id="delay-analysis-title">{delay?.reason ?? "Delay under analysis"}</h2>
          <p>{delay?.evidence_summary ?? "Delay evidence unavailable for this service."}</p>
          <div className="analysis-signal-grid">
            {delayEvidence.map((item, index) => (
              <div key={item.label}>
                <span>{index + 1}</span>
                <div><strong>{item.label}</strong><small>{Math.round(item.value)} min from delay summary</small></div>
                <b>{Math.round(item.value)} min</b>
              </div>
            ))}
            {delayEvidence.length === 0 && <div><span>—</span><div><strong>Delay evidence unavailable</strong><small>No delay summary values were returned.</small></div><b>—</b></div>}
          </div>
        </div>
        <div className="service-confidence-card">
          <span>Prediction confidence</span>
          <strong>{confidence == null ? "Unavailable" : `${confidence}%`}</strong>
          <div><i style={{ width: `${confidence ?? 0}%` }} /></div>
          <small>{confidence == null ? "Confidence unavailable" : `Based on ${livePosition ? "live position + " : "route + "}model evidence`}</small>
          <button onClick={onAnalytics}>Open full analytics →</button>
        </div>
      </section>

      <section className="service-map-large" aria-label="Live map"><MapErrorBoundary key={`large-${route?.train_number ?? "route-map"}`}><RouteMap route={route} currentStationCode={livePosition?.current_station_code} /></MapErrorBoundary></section>
    </section>
  );
}

function PremiumHomePage({
  fromStation,
  toStation,
  searching,
  activeField,
  suggestions,
  stationSearching,
  stationSearchError,
  onFromChange,
  onToChange,
  onFromSelect,
  onToSelect,
  onFieldFocus,
  onFieldBlur,
  onSearch,
  onTrain,
  onCorridors,
}: {
  fromStation: string;
  toStation: string;
  searching: boolean;
  activeField: "from" | "to" | null;
  suggestions: StationOption[];
  stationSearching: boolean;
  stationSearchError: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onFromSelect: (station: StationOption) => void;
  onToSelect: (station: StationOption) => void;
  onFieldFocus: (field: "from" | "to") => void;
  onFieldBlur: () => void;
  onSearch: () => void;
  onTrain: (trainNumber: string) => void;
  onCorridors: () => void;
}) {
  const stationInput = (field: "from" | "to") => field === "from" ? fromStation : toStation;
  const corridors = [
    ["Gaya", "Howrah", "06", "02", "+07 min", "Stable", "#52c78a"],
    ["Patna", "New Delhi", "08", "03", "+18 min", "Watch", "#f0a35b"],
    ["Bhagalpur", "Howrah", "04", "02", "+31 min", "Delayed", "#ec6d67"],
    ["Delhi", "Patna", "11", "06", "+09 min", "Live", "#0875c9"],
  ];

  return (
    <section className="premium-home">
      <div className="premium-hero">
        <div className="premium-hero-content">
          <span className="premium-eyebrow"><i /> AI-powered railway intelligence</span>
          <h1>Know Your Train.<br /><strong>Know Your ETA.</strong></h1>
          <p>Track live train movement, predict arrival times with AI, and understand the reasons behind every delay.</p>
        </div>
        <div className="premium-search-shell">
          <div className="premium-search-top"><span>Journey finder</span><small>Search trains, stations, and live routes</small></div>
          <div className="premium-search-grid premium-station-search-grid">
            {(["from", "to"] as const).map((field) => <label className="premium-search-field" key={field}><span>{field === "from" ? "From station" : "To station"}</span><div className="premium-input-wrap"><i>{field === "from" ? "●" : "◉"}</i><input value={stationInput(field)} onFocus={() => onFieldFocus(field)} onBlur={onFieldBlur} onChange={(event) => field === "from" ? onFromChange(event.target.value) : onToChange(event.target.value)} placeholder="Search station name or code" /></div>{activeField === field && (suggestions.length > 0 || stationSearching || stationSearchError) && <div className="premium-suggestions">{stationSearching && <div role="status">Searching live stations...</div>}{!stationSearching && stationSearchError && <div role="status">{stationSearchError}</div>}{suggestions.map((station) => <button type="button" key={station.station_code} onMouseDown={(event) => event.preventDefault()} onClick={() => field === "from" ? onFromSelect(station) : onToSelect(station)}><strong>{station.station_name}</strong><span>{station.station_code}</span></button>)}</div>}</label>)}
            <label className="premium-search-field date-field"><span>Date</span><div className="premium-input-wrap"><i>▣</i><input value="Today · 24 Sep 2026" readOnly /></div></label>
            <button className="premium-search-button" disabled={searching || (!fromStation.trim() && !toStation.trim())} onClick={onSearch}>{searching ? <><i className="button-spinner" /> Searching...</> : <>Search Trains <b>→</b></>}</button>
          </div>
          <div className="premium-search-foot"><span><i /> Live routes update on request</span><span>Search by station name or code</span></div>
        </div>
        <div className="hero-scroll-cue"><span /> Scroll to explore</div>
      </div>

      <div className="premium-preview-wrap">
        <div className="premium-section-heading"><div><span className="premium-eyebrow dark"><i /> Live preview</span><h2>One clear view of your journey.</h2></div><button onClick={() => onTrain("20801")}>Open live service →</button></div>
        <article className="eta-preview-card"><div className="preview-train"><div className="preview-train-icon">↗</div><div><span>20801 · Superfast</span><strong>Magadh Express</strong><small>New Delhi <b>→</b> Patna</small></div><em><i /> LIVE</em></div><div className="preview-station"><span>Currently at</span><strong>DDU</strong><small>Mughalsarai Junction</small></div><div className="preview-station"><span>Next station</span><strong>PNBE</strong><small>Patna Junction</small></div><div className="preview-delay"><span>Current delay</span><strong>+08 <small>min</small></strong><small>Congestion detected</small></div><div className="preview-eta"><span>AI Predicted ETA</span><strong>18:40</strong><small>Confidence <b>86%</b></small></div></article>
      </div>

      <div className="premium-section eta-visual-section"><div className="premium-section-heading"><div><span className="premium-eyebrow dark"><i /> Prediction lens</span><h2>See the journey ahead.</h2></div><span className="eta-visual-status"><i /> Model confidence 86%</span></div><div className="eta-visual"><div className="eta-track"><span className="eta-point scheduled"><i /><b>17:58</b><small>Scheduled ETA</small></span><span className="eta-point current"><i /><b>18:17</b><small>Current ETA</small></span><span className="eta-point predicted"><i /><b>18:40</b><small>AI Predicted ETA</small></span></div><div className="eta-route-line"><span /><i /><b>+23 min recovered from live speed + route evidence</b></div></div></div>

      <div className="premium-section corridor-section"><div className="premium-section-heading"><div><span className="premium-eyebrow dark"><i /> Network pulse</span><h2>Live Railway Corridors</h2><p>Know where trains are moving and where time is building across the network.</p></div><button onClick={onCorridors}>Explore network →</button></div><div className="premium-corridor-grid">{corridors.map(([from, to, count, active, delayValue, status, color]) => <article key={`${from}-${to}`}><div className="corridor-card-top"><span style={{ background: color }} /><small>{status}</small></div><h3>{from} <b>→</b> {to}</h3><div className="corridor-card-stats"><span><strong>{count}</strong> trains</span><span><strong>{active}</strong> active now</span><span><strong>{delayValue}</strong> avg delay</span></div><button onClick={onCorridors}>View corridor <b>↗</b></button></article>)}</div></div>

      <div className="premium-stats"><div><span>Live trains</span><strong>24</strong><small>tracking now</small></div><div><span>Delayed trains</span><strong>05</strong><small>needs attention</small></div><div><span>Stations covered</span><strong>102</strong><small>across network</small></div><div><span>Active corridors</span><strong>12</strong><small>live routes</small></div><div><span>ETA predictions</span><strong>1,284</strong><small>generated today</small></div></div>
    </section>
  );
}

type LiveTrainRecord = Train & {
  status: "Running" | "Delayed" | "On Time" | "Unavailable";
  currentStation: string;
  previousStation: string;
  nextStation: string;
  speedKmph: number | null;
  delay: number | null;
  eta: string;
  confidence: number | null;
  updatedAt: string | null;
};

function LiveTrainsDashboard({ trains, onOpenTrain }: { trains: Train[]; onOpenTrain: (trainNumber: string) => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [liveTrains, setLiveTrains] = useState<LiveTrainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    api.getLiveTrains().then((payload) => {
      const records = (payload as { trains?: Array<Record<string, unknown>> }).trains ?? [];
      setLiveTrains(records.map((record) => ({
        train_number: String(record.train_number ?? ""),
        name: trains.find((train) => train.train_number === String(record.train_number ?? ""))?.name ?? String(record.name ?? "Unavailable"),
        train_type: String(record.train_type ?? "Live service"),
        source_station: String(record.source_station ?? "Unavailable"),
        destination_station: String(record.destination_station ?? "Unavailable"),
        status: (record.status === "Delayed" || record.status === "On Time" || record.status === "Running" ? record.status : "Unavailable") as LiveTrainRecord["status"],
        currentStation: String(record.current_station ?? "Unavailable"),
        previousStation: String(record.previous_station ?? "—"),
        nextStation: String(record.next_station ?? "—"),
        speedKmph: typeof record.speed_kmph === "number" ? record.speed_kmph : null,
        delay: typeof record.delay_minutes === "number" ? record.delay_minutes : null,
        eta: formatTime(typeof record.predicted_arrival === "string" ? record.predicted_arrival : null),
        confidence: typeof record.confidence_score === "number" ? record.confidence_score : null,
        updatedAt: typeof record.updated_at === "string" ? record.updated_at : null,
      })));
      setLoadError("");
    }).catch((loadFailure) => {
      setLoadError(loadFailure instanceof ApiError ? loadFailure.message : "Live train data is unavailable.");
    }).finally(() => setLoading(false));
  }, [trains]);
  const filtered = liveTrains.filter((train) => {
    const haystack = `${train.train_number} ${train.name} ${train.source_station} ${train.destination_station} ${train.currentStation}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (statusFilter === "All" || train.status === statusFilter);
  });

  return (
    <section className="live-trains-page">
      <div className="live-trains-hero"><div><span className="section-kicker">Network operations</span><h1>Live Trains</h1><p>Monitor active services and open a train's current position.</p></div><div className="live-trains-stream"><i /> LIVE NETWORK</div></div>
      <div className="live-trains-toolbar"><label className="live-train-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search train number, name, or station" /></label><div className="live-status-filters">{["All", "Running", "Delayed", "On Time", "Unavailable"].map((status) => <button key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}>{status}<b>{status === "All" ? liveTrains.length : liveTrains.filter((train) => train.status === status).length}</b></button>)}</div></div>
      {loadError && <div className="live-trains-empty"><strong>{loadError}</strong><span>Live service data is unavailable until the backend responds.</span></div>}
      <div className="live-trains-summary"><span><b>{filtered.length}</b> services visible</span><span><i className="summary-live" /> Live position data</span><span><i className="summary-ai" /> AI ETA predictions enabled</span></div>
      {loading && <div className="live-trains-empty"><strong>Loading live services...</strong><span>Reading current positions and ETA predictions.</span></div>}
      <div className="live-trains-grid">{filtered.map((train) => <article className="live-train-card-modern" key={train.train_number}><div className="live-train-card-top"><span className="live-train-number">{train.train_number}</span><span className={`live-status-badge ${train.status.toLowerCase().replace(" ", "-")}`}><i /> {train.status}</span></div><h2>{train.name}</h2><span className="live-train-type">{train.train_type}</span><div className="live-train-route"><div><small>ORIGIN</small><strong>{train.source_station}</strong></div><i /><div className="route-destination"><small>DESTINATION</small><strong>{train.destination_station}</strong></div></div><div className="live-train-facts"><div><span>Currently at</span><strong>{train.currentStation}</strong><small>{train.previousStation} · previous · {train.nextStation} · next</small></div><div><span>Current delay</span><strong className={train.delay == null ? "" : train.delay > 0 ? "train-delay" : "train-on-time"}>{train.delay == null ? "Unavailable" : train.delay > 0 ? `+${Math.round(train.delay)} min` : "On time"}</strong><small>{train.speedKmph != null ? `${Math.round(train.speedKmph)} km/h` : "Speed unavailable"}</small></div><div className="train-eta"><span>AI Predicted ETA</span><strong>{train.eta}</strong><small>{train.confidence != null ? `${Math.round(train.confidence * 100)}% confidence` : "Unavailable"}</small></div></div><button onClick={() => onOpenTrain(train.train_number)}>Open Live Service <b>→</b></button></article>)}</div>{!loading && !loadError && filtered.length === 0 && <div className="live-trains-empty"><strong>No active services match this search.</strong><span>Try another train number, name, or status.</span></div>}
    </section>
  );
}

function CorridorDirectory({ onOpenTrain }: { onOpenTrain: (trainNumber: string) => void }) {
  const [corridors, setCorridors] = useState<Array<{
    origin: string;
    destination: string;
    train_numbers: string[];
    train_count: number;
    stations_covered: number;
    average_delay_minutes: number;
    status: string;
    density: string;
  }>>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [delayFilter, setDelayFilter] = useState("All");

  const loadCorridorData = useCallback(async () => {
    try {
      const [corridorPayload, summaryPayload] = await Promise.all([
        api.getCorridors(),
        api.getAnalyticsSummary(),
      ]);

      setCorridors((corridorPayload as { corridors?: typeof corridors }).corridors ?? []);
      setSummary(summaryPayload as AnalyticsSummary);
      setLastUpdated(
        new Intl.DateTimeFormat([], {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date()),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCorridorData();
  }, [loadCorridorData]);

  const normalizedCorridors = useMemo(
    () =>
      corridors.map((corridor) => {
        const averageDelay = Number(corridor.average_delay_minutes ?? 0);
        const status =
          averageDelay >= 15
            ? "Delayed"
            : averageDelay >= 8 || corridor.train_count >= 8
              ? "Congested"
              : corridor.train_count >= 3
                ? "Active"
                : "Normal";

        return {
          ...corridor,
          status,
          density: corridor.density || (corridor.stations_covered > 25 ? "High" : corridor.stations_covered > 10 ? "Medium" : "Low"),
        };
      }),
    [corridors],
  );

  const corridorResults = useMemo(() => {
    return normalizedCorridors.filter((corridor) => {
      const matchesQuery = `${corridor.origin} ${corridor.destination} ${corridor.train_numbers.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());

      const matchesStatus = statusFilter === "All" || corridor.status === statusFilter;

      const matchesDelay =
        delayFilter === "All" ||
        (delayFilter === "Low" && corridor.average_delay_minutes < 5) ||
        (delayFilter === "Moderate" && corridor.average_delay_minutes >= 5 && corridor.average_delay_minutes < 12) ||
        (delayFilter === "High" && corridor.average_delay_minutes >= 12);

      return matchesQuery && matchesStatus && matchesDelay;
    });
  }, [normalizedCorridors, query, statusFilter, delayFilter]);

  const totalRunning = summary?.active_trains ?? normalizedCorridors.reduce((total, corridor) => total + corridor.train_count, 0);
  const delayedTrains =
    summary?.trains.filter((train) => train.delay_minutes > 0).length ??
    normalizedCorridors.filter((corridor) => corridor.status === "Delayed").reduce((total, corridor) => total + corridor.train_count, 0);
  const averageDelay = normalizedCorridors.length
    ? Math.round(normalizedCorridors.reduce((total, corridor) => total + corridor.average_delay_minutes, 0) / normalizedCorridors.length)
    : 0;

  const onTimePct =
    summary && summary.active_trains > 0
      ? Math.round((summary.trains.filter((train) => train.delay_minutes <= 0).length / summary.active_trains) * 100)
      : normalizedCorridors.length
        ? Math.max(0, 100 - Math.round((averageDelay / 20) * 100))
        : 0;

  const corridorPerformance = normalizedCorridors
    .slice()
    .sort((a, b) => b.train_count - a.train_count)
    .slice(0, 4)
    .map((corridor) => ({
      label: `${corridor.origin} → ${corridor.destination}`,
      delay: Math.min(100, Math.max(10, corridor.average_delay_minutes * 4.5)),
      density: Math.min(100, corridor.train_count * 12),
      onTime: Math.max(20, Math.min(100, onTimePct)),
    }));

  const hotspotStations = normalizedCorridors
    .slice()
    .sort((a, b) => b.average_delay_minutes - a.average_delay_minutes)
    .slice(0, 4)
    .map((corridor) => ({
      name: corridor.origin,
      detail:
        corridor.train_count >= 8
          ? "High traffic"
          : corridor.train_count >= 4
            ? "Moderate traffic"
            : "Low traffic",
      delay: `+${Math.round(corridor.average_delay_minutes)} min average delay`,
    }));

  const densityLevels = [
    { label: "Low", value: 25 },
    { label: "Medium", value: 55 },
    { label: "High", value: 100 },
  ];

  const delayConditions = [
    { label: "On Time", value: onTimePct },
    { label: "Minor Delay", value: Math.max(0, Math.round((summary?.trains.filter((train) => train.delay_minutes > 0 && train.delay_minutes <= 5).length ?? 0) / Math.max(summary?.active_trains ?? 1, 1) * 100)) },
    { label: "Delayed", value: Math.max(0, Math.round((summary?.trains.filter((train) => train.delay_minutes > 5 && train.delay_minutes <= 15).length ?? 0) / Math.max(summary?.active_trains ?? 1, 1) * 100)) },
    { label: "Severe Delay", value: Math.max(0, Math.round((summary?.trains.filter((train) => train.delay_minutes > 15).length ?? 0) / Math.max(summary?.active_trains ?? 1, 1) * 100)) },
  ];

  const activeCardList = corridorResults.length ? corridorResults : normalizedCorridors;

  return (
    <section className="corridor-network-page">
      <header className="network-hero">
        <div>
          <span className="section-kicker">Railway Geography</span>
          <h1>Active Corridors</h1>
          <p>Route performance, train density, and delay conditions across live railway lanes.</p>
        </div>

        <div className="network-hero-actions">
          <span className="network-live-pill"><i /> LIVE NETWORK</span>
          <button
            className="network-refresh-button"
            disabled={refreshing || loading}
            onClick={() => {
              setRefreshing(true);
              void loadCorridorData();
            }}
          >
            <span className={refreshing ? "network-refresh-icon spinning" : "network-refresh-icon"}>↻</span>
            Refresh
          </button>
        </div>
      </header>

      <div className="network-status-row">
        <span className="network-status-dot" />
        <span>Live</span>
        <small>Last updated {lastUpdated ?? "—"}</small>
      </div>

      {loading ? (
        <div className="network-loading-shell">
          <div className="network-kpi-grid skeleton-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`kpi-skeleton-${index}`} className="network-kpi-card skeleton-card">
                <div className="skeleton-line short" />
                <div className="skeleton-line tall" />
                <div className="skeleton-line medium" />
              </div>
            ))}
          </div>
          <div className="network-panel skeleton-panel">
            <div className="skeleton-line long" />
            <div className="skeleton-line full" />
            <div className="skeleton-line full" />
          </div>
        </div>
      ) : activeCardList.length === 0 ? (
        <div className="network-empty-state">
          <div className="network-empty-icon">◎</div>
          <strong>No active corridors found</strong>
          <span>No live corridor data is currently available.</span>
          <button
            className="network-empty-button"
            onClick={() => {
              setRefreshing(true);
              void loadCorridorData();
            }}
          >
            Refresh Network
          </button>
        </div>
      ) : (
        <>
          <div className="network-kpi-grid">
            <article className="network-kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-icon"></span>
                <span className="kpi-trend positive">Live</span>
              </div>
              <strong>{normalizedCorridors.length}</strong>
              <span className="kpi-label">Active Corridors</span>
            </article>
            <article className="network-kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-icon">⇄</span>
                <span className="kpi-trend positive">On route</span>
              </div>
              <strong>{totalRunning}</strong>
              <span className="kpi-label">Trains Running</span>
            </article>
            <article className="network-kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-icon">!</span>
                <span className="kpi-trend warning">Watch</span>
              </div>
              <strong>{delayedTrains}</strong>
              <span className="kpi-label">Delayed Trains</span>
            </article>
            <article className="network-kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-icon">+</span>
                <span className="kpi-trend neutral">Avg.</span>
              </div>
              <strong>+{averageDelay}</strong>
              <span className="kpi-label">Average Delay</span>
            </article>
          </div>

          <div className="network-layout-grid">
            <section className="network-primary-panel">
              <div className="network-panel-header">
                <div>
                  <span className="panel-eyebrow">Active Corridors</span>
                  <h2>Live railway lanes</h2>
                </div>

                <div className="network-toolbar">
                  <label className="network-select">
                    <span>Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="All">All</option>
                      <option value="Active">Active</option>
                      <option value="Congested">Congested</option>
                      <option value="Delayed">Delayed</option>
                      <option value="Normal">Normal</option>
                    </select>
                  </label>

                  <label className="network-select">
                    <span>Delay</span>
                    <select value={delayFilter} onChange={(event) => setDelayFilter(event.target.value)}>
                      <option value="All">All</option>
                      <option value="Low">Low</option>
                      <option value="Moderate">Moderate</option>
                      <option value="High">High</option>
                    </select>
                  </label>

                  <label className="network-search">
                    <span>Search corridor</span>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search corridor" />
                  </label>
                </div>
              </div>

              <div className="corridor-list-grid">
                {activeCardList.map((corridor) => {
                  const routeNodes = [corridor.origin, corridor.destination];
                  const corridorStatusClass = corridor.status.toLowerCase().replace(/\s+/g, "-");
                  const firstTrain = corridor.train_numbers[0];

                  return (
                    <article className="corridor-route-card" key={`${corridor.origin}-${corridor.destination}`}>
                      <div className="corridor-card-header">
                        <div>
                          <strong>{corridor.origin} → {corridor.destination}</strong>
                          <span>{corridor.train_numbers.length ? corridor.train_numbers.join(", ") : "Operating section"}</span>
                        </div>
                        <span className={`corridor-badge corridor-badge-${corridorStatusClass}`}>
                          <i /> {corridor.status}
                        </span>
                      </div>

                      <div className="corridor-stats-row">
                        <span><b>{corridor.train_count}</b> trains</span>
                        <span><b>{corridor.stations_covered}</b> stations</span>
                        <span><b>+{Math.round(corridor.average_delay_minutes)} min</b> avg delay</span>
                      </div>

                      <div className="corridor-route-visual" aria-label={`${corridor.origin} to ${corridor.destination}`}>
                        {routeNodes.map((station, index) => (
                          <div key={`${station}-${index}`} className="route-node-group">
                            <span className="route-node" />
                            <small>{station}</small>
                          </div>
                        ))}
                        <span className="route-flow-line" aria-hidden="true" />
                      </div>

                      <div className="corridor-card-footer">
                        <div className="corridor-density-pill">
                          <span className="density-meter" style={{ width: `${Math.min(100, corridor.train_count * 15)}%` }} />
                        </div>
                        <button onClick={() => firstTrain && onOpenTrain(firstTrain)}>
                          View Corridor <span>→</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="network-side-panel">
              <div className="network-side-block">
                <div className="panel-heading-row">
                  <div>
                    <span className="panel-eyebrow">Train Density</span>
                    <h2>Network intensity</h2>
                  </div>
                </div>

                <div className="density-scale">
                  {densityLevels.map((level) => (
                    <span key={level.label}>{level.label}</span>
                  ))}
                </div>
                <div className="density-meter-wrap">
                  <span style={{ width: `${Math.min(100, totalRunning > 0 ? (totalRunning / Math.max(normalizedCorridors.length * 10, 1)) * 100 : 40)}%` }} />
                </div>
                <small className="density-footnote">{totalRunning} trains / hour</small>
              </div>

              <div className="network-side-block">
                <div className="panel-heading-row">
                  <div>
                    <span className="panel-eyebrow">Delay Conditions</span>
                    <h2>Network health</h2>
                  </div>
                </div>

                <div className="delay-condition-list">
                  {delayConditions.map((condition) => (
                    <div className="delay-condition-row" key={condition.label}>
                      <div className="delay-condition-labels">
                        <span>{condition.label}</span>
                        <strong>{condition.value}%</strong>
                      </div>
                      <div className="delay-condition-bar">
                        <span style={{ width: `${Math.min(condition.value, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="network-side-block">
                <div className="panel-heading-row">
                  <div>
                    <span className="panel-eyebrow">Corridor Performance</span>
                    <h2>Operational balance</h2>
                  </div>
                </div>

                <div className="performance-chart">
                  {corridorPerformance.map((corridor) => (
                    <div key={`${corridor.label}-performance`} className="performance-column">
                      <div className="performance-bars">
                        <span className="bar-delay" style={{ height: `${Math.min(100, corridor.delay)}%` }} />
                        <span className="bar-density" style={{ height: `${Math.min(100, corridor.density)}%` }} />
                        <span className="bar-ontime" style={{ height: `${Math.min(100, corridor.onTime)}%` }} />
                      </div>
                      <small>{corridor.label.split(" → ")[0]}</small>
                    </div>
                  ))}
                </div>
                <div className="performance-legend">
                  <span><i className="legend-delay" /> Avg Delay</span>
                  <span><i className="legend-density" /> Density</span>
                  <span><i className="legend-ontime" /> On-Time</span>
                </div>
              </div>

              <div className="network-side-block">
                <div className="panel-heading-row">
                  <div>
                    <span className="panel-eyebrow">Top Active Corridors</span>
                    <h2>Highest flow</h2>
                  </div>
                </div>

                <div className="top-corridor-list">
                  {normalizedCorridors
                    .slice()
                    .sort((a, b) => b.train_count - a.train_count)
                    .slice(0, 4)
                    .map((corridor) => (
                      <div className="top-corridor-item" key={`${corridor.origin}-${corridor.destination}`}>
                        <div>
                          <strong>{corridor.origin} → {corridor.destination}</strong>
                          <span>{corridor.train_count} trains</span>
                        </div>
                        <div className="top-corridor-meta">
                          <span className={`mini-badge mini-badge-${corridor.status.toLowerCase().replace(/\s+/g, "-")}`}>{corridor.status}</span>
                          <small>+{Math.round(corridor.average_delay_minutes)} min</small>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="network-side-block">
                <div className="panel-heading-row">
                  <div>
                    <span className="panel-eyebrow">Congestion Hotspots</span>
                    <h2>Pressure points</h2>
                  </div>
                </div>

                <div className="hotspot-list">
                  {hotspotStations.map((station, index) => (
                    <div className="hotspot-item" key={`${station.name}-${index}`}>
                      <strong>{station.name}</strong>
                      <span>{station.detail}</span>
                      <small>{station.delay}</small>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function BackButton({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button className="app-back-button" type="button" onClick={onBack} aria-label={label}>
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M11.75 4.5 6.25 10l5.5 5.5M6.75 10h9" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

function App() {
  const [page, setPageState] = useState<Page>("home");
  const [detailContext, setDetailContext] = useState<DetailContext | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveSearchOpen, setLiveSearchOpen] = useState(false);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [liveSearchSuggestionsLoading, setLiveSearchSuggestionsLoading] = useState(false);
  const [liveSearchError, setLiveSearchError] = useState("");
  const [homeSearchLoading, setHomeSearchLoading] = useState(false);
  const [searchTransitionKey, setSearchTransitionKey] = useState(0);
  const [isSearchTransitioning, setIsSearchTransitioning] = useState(false);
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedNumber, setSelectedNumber] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<Train[]>([]);
  const [homeFromStation, setHomeFromStation] = useState("");
  const [homeToStation, setHomeToStation] = useState("");
  const [homeFromStationCode, setHomeFromStationCode] = useState("");
  const [homeToStationCode, setHomeToStationCode] = useState("");
  const [stationOptions, setStationOptions] = useState<StationOption[]>([]);
  const [stationSearchLoading, setStationSearchLoading] = useState(false);
  const [stationSearchError, setStationSearchError] = useState("");
  const [activeHomeField, setActiveHomeField] = useState<"from" | "to" | null>(null);
  const [routeSearchResults, setRouteSearchResults] = useState<TrainSearchResult[]>([]);
  const [stationSearchActive, setStationSearchActive] = useState(false);
  const [stationSearchMessage, setStationSearchMessage] = useState("");
  const [routeResultQuery, setRouteResultQuery] = useState("");
  const [routeResultSort, setRouteResultSort] = useState<"departure" | "arrival" | "duration">("departure");
  const [routeResultStatus, setRouteResultStatus] = useState("all");
  const [routeResultDeparture, setRouteResultDeparture] = useState("all");
  const [expandedResultRoute, setExpandedResultRoute] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [delay, setDelay] = useState<Delay | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [forecast, setForecast] = useState<ForecastEntry[]>([]);
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [analyticsLastUpdated, setAnalyticsLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingResultTrain, setRefreshingResultTrain] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const [lastSuccessfulRefreshAt, setLastSuccessfulRefreshAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedStationCode, setExpandedStationCode] = useState<string | null>(
    null,
  );
  const [selectedHaltCode, setSelectedHaltCode] = useState<string | null>(null);
  const autoFocusedTrain = useRef<string | null>(null);
  const backendLoadError = useRef<string | null>(null);
  const stationSearchTimer = useRef<number | null>(null);
  const liveTrainSearchTimer = useRef<number | null>(null);
  const liveTrainSearchRequestId = useRef(0);
  const stationSearchRequest = useRef<{ query: string; controller: AbortController } | null>(null);
  const stationSearchRequestId = useRef(0);
  const routeSearchInFlight = useRef(false);
  const refreshRequestInFlight = useRef(false);
  const savedSearchResultsRef = useRef<TrainSearchResult[]>([]);

  function setPage(nextPage: Page, nextDetailContext: DetailContext | null = null) {
    if (nextPage === page && !nextDetailContext) return;

    const currentState = window.history.state as {
      railGaadiPage?: boolean;
      depth?: number;
    } | null;
    const depth = currentState?.railGaadiPage ? currentState.depth ?? 0 : 0;
    window.history.pushState(
      {
        railGaadiPage: true,
        page: nextPage,
        depth: depth + 1,
        detailContext: nextDetailContext,
      },
      "",
    );
    setPageState(nextPage);
    setDetailContext(nextDetailContext);
  }

  useEffect(() => {
    const currentState = window.history.state as {
      railGaadiPage?: boolean;
      page?: Page;
      depth?: number;
      detailContext?: DetailContext | null;
    } | null;

    if (!currentState?.railGaadiPage) {
      window.history.replaceState(
        { railGaadiPage: true, page: "home", depth: 0 },
        "",
      );
    }

    function restorePage(event: PopStateEvent) {
      const state = event.state as {
        railGaadiPage?: boolean;
        page?: Page;
        detailContext?: DetailContext | null;
      } | null;
      const validPages: Page[] = ["home", "search", "live", "analytics", "corridors", "network"];

      if (state?.railGaadiPage && state.page && validPages.includes(state.page)) {
        setPageState(state.page);
        setDetailContext(state.detailContext ?? null);
        if (state.page === "search") {
          if (state.detailContext) {
            setRouteSearchResults([]);
          } else if (savedSearchResultsRef.current.length > 0) {
            setRouteSearchResults(savedSearchResultsRef.current);
          }
        }
        return;
      }

      setPageState("home");
      setDetailContext(null);
      window.history.replaceState(
        { railGaadiPage: true, page: "home", depth: 0 },
        "",
      );
    }

    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);

  function goBack() {
    const currentState = window.history.state as {
      railGaadiPage?: boolean;
      depth?: number;
    } | null;

    if (currentState?.railGaadiPage && (currentState.depth ?? 0) > 0) {
      window.history.back();
      return;
    }

    const parentPage = detailContext?.parentPage ?? "home";
    setPageState(parentPage);
    setDetailContext(null);
    if (parentPage === "search" && savedSearchResultsRef.current.length > 0) {
      setRouteSearchResults(savedSearchResultsRef.current);
    }
    window.history.replaceState(
      { railGaadiPage: true, page: parentPage, depth: 0, detailContext: null },
      "",
    );
  }

  function requestStationSuggestions(value: string) {
    const query = value.trim();
    if (stationSearchRequest.current?.query === query && query) return;
    stationSearchRequest.current?.controller.abort();
    stationSearchRequest.current = null;
    stationSearchRequestId.current += 1;
    const requestId = stationSearchRequestId.current;
    if (stationSearchTimer.current != null) window.clearTimeout(stationSearchTimer.current);
    setStationSearchError("");
    setStationOptions([]);
    if (!query) {
      setStationSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    stationSearchRequest.current = { query, controller };
    setStationSearchLoading(true);
    stationSearchTimer.current = window.setTimeout(() => {
      void api.searchStations(query, controller.signal)
        .then((stations) => {
          if (requestId !== stationSearchRequestId.current) return;
          setStationOptions(stations);
          if (stations.length === 0) setStationSearchError(`No stations found for "${query}".`);
        })
        .catch((searchError) => {
          if (controller.signal.aborted || requestId !== stationSearchRequestId.current) return;
          setStationSearchError(searchError instanceof ApiError ? searchError.message : "Live station search failed.");
        })
        .finally(() => {
          if (requestId !== stationSearchRequestId.current) return;
          stationSearchRequest.current = null;
          setStationSearchLoading(false);
        });
    }, 250);
  }

  const beginSearchTransition = useCallback(() => {
    setSearchTransitionKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!searchTransitionKey) return;
    setIsSearchTransitioning(true);
    const timer = window.setTimeout(() => setIsSearchTransitioning(false), 3000);
    return () => window.clearTimeout(timer);
  }, [searchTransitionKey]);

  const loadBackend = useCallback(async (trainNumber = selectedNumber): Promise<boolean> => {
    if (!trainNumber.trim()) {
      return false;
    }

    backendLoadError.current = null;
    try {
      const [routeData, delayData, liveData, predictionData, forecastData] = await Promise.all([
        api.getRoute(trainNumber) as Promise<RouteResponse>,
        api.getDelay(trainNumber) as Promise<Delay>,
        api.getLive(trainNumber).then((data) => data as LivePosition).catch((loadError) => {
          if (loadError instanceof ApiError && loadError.status === 429) throw loadError;
          return null;
        }),
        api.getPrediction(trainNumber).then((data) => data as Prediction).catch((loadError) => {
          if (loadError instanceof ApiError && loadError.status === 429) throw loadError;
          return null;
        }),
        api.getForecast(trainNumber).catch((loadError) => {
          if (loadError instanceof ApiError && loadError.status === 429) throw loadError;
          return null;
        }),
      ]);
      setRoute(routeData);
      setDelay(delayData);
      setLivePosition(liveData && liveData.status !== "no_live_position" ? liveData : null);
      setPrediction(predictionData && predictionData.status !== "no_prediction" ? predictionData : null);
      setForecast(
        forecastData && typeof forecastData === "object" && "forecast" in forecastData
          ? ((forecastData as { forecast: ForecastEntry[] }).forecast ?? [])
          : [],
      );
      setError("");
      return true;
    } catch (loadError) {
      const message = loadError instanceof ApiError ? loadError.message : "Railway data could not be loaded.";
      backendLoadError.current = message;
      setError(message);
      setRefreshError(message);
      return false;
    }
  }, [selectedNumber]);

  const syncTrainNumber = useCallback(async (requestedTrainNumber = selectedNumber) => {
    const trainNumber = requestedTrainNumber.trim();
    if (!trainNumber || refreshRequestInFlight.current) return;
    refreshRequestInFlight.current = true;
    setRefreshing(true);
    setRefreshError("");
    setError("");

    try {
      const result = await api.syncByTrain(trainNumber);
      const syncedTrainNumber = String(result.train_number);
      setSelectedNumber(syncedTrainNumber);
      const loaded = await loadBackend(syncedTrainNumber);
      if (loaded) {
        setLastSuccessfulRefreshAt(new Date().toISOString());
      } else {
        const message = backendLoadError.current ?? "Live train details could not be loaded. Last updated time was not changed.";
        setRefreshError(message);
        setError(message);
      }
    } catch (syncError) {
      const message = syncError instanceof ApiError ? syncError.message : "Live provider is unavailable.";
      setRefreshError(message);
      setError(message);
    } finally {
      refreshRequestInFlight.current = false;
      setRefreshing(false);
    }
  }, [loadBackend, selectedNumber]);

  useEffect(() => {
    if (page !== "analytics" && page !== "network") return;
    api.getAnalyticsSummary()
      .then((summary) => {
        setAnalyticsSummary(summary as AnalyticsSummary);
        setAnalyticsLastUpdated(new Date().toISOString());
      })
      .catch(() => setAnalyticsSummary(null));
  }, [page]);

  const homeStationSuggestions = useMemo(() => {
    const query = (
      activeHomeField === "from" ? homeFromStation : homeToStation
    )
      .trim()
      .toLowerCase();
    return stationOptions
      .filter(
        (station) =>
          !query ||
          station.station_name.toLowerCase().includes(query) ||
          station.station_code.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [activeHomeField, homeFromStation, homeToStation, stationOptions]);
  const selectedTrain = trains.find(
    (train) => train.train_number === selectedNumber,
  );
  const visibleRouteSearchResults = useMemo(() => {
    const query = routeResultQuery.trim().toLowerCase();
    const filtered = routeSearchResults.filter((train) => {
      const status = (train.status ?? "").toLowerCase().replaceAll("_", "-");
      const delay = train.delay_minutes;
      const matchesStatus = routeResultStatus === "all"
        || (routeResultStatus === "live" && ["running", "at-station", "departed"].includes(status))
        || (routeResultStatus === "upcoming" && ["upcoming", "scheduled", "not-started"].includes(status))
        || (routeResultStatus === "delayed" && ((delay != null && delay > 0) || status === "delayed"))
        || (routeResultStatus === "completed" && status === "completed");
      const departureMinutes = scheduledMinutes(train.scheduled_departure);
      const hour = Number.isFinite(departureMinutes) ? Math.floor(departureMinutes / 60) : -1;
      const matchesDeparture = routeResultDeparture === "all"
        || (routeResultDeparture === "morning" && hour >= 5 && hour < 12)
        || (routeResultDeparture === "afternoon" && hour >= 12 && hour < 17)
        || (routeResultDeparture === "evening" && hour >= 17 && hour < 22)
        || (routeResultDeparture === "night" && (hour >= 22 || (hour >= 0 && hour < 5)));
      const haystack = [
        train.train_number,
        train.train_name ?? train.name,
        train.train_type,
        train.from_station?.station_name,
        train.from_station?.station_code,
        train.to_station?.station_name,
        train.to_station?.station_code,
        train.current_station_name,
        train.current_station_code,
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesDeparture && (!query || haystack.includes(query));
    });

    return filtered.sort((left, right) => {
      if (routeResultSort === "arrival") {
        return scheduledMinutes(left.scheduled_arrival) - scheduledMinutes(right.scheduled_arrival);
      }
      if (routeResultSort === "duration") {
        return (left.duration_minutes ?? Number.POSITIVE_INFINITY) - (right.duration_minutes ?? Number.POSITIVE_INFINITY);
      }
      return scheduledMinutes(left.scheduled_departure) - scheduledMinutes(right.scheduled_departure);
    });
  }, [routeResultDeparture, routeResultQuery, routeResultSort, routeResultStatus, routeSearchResults]);

  const savedPosition = useMemo<LivePosition | null>(() => {
    if (!route?.stations.length) return null;

    const actualIndex = route.stations.reduce(
      (latestIndex, station, index) =>
        station.actual_arrival || station.actual_departure
          ? index
          : latestIndex,
      -1,
    );
    const currentIndex = actualIndex >= 0 ? actualIndex : 0;
    const currentStation = route.stations[currentIndex];

    return {
      current_station_code: currentStation.station_code,
      previous_station_code:
        route.stations[currentIndex - 1]?.station_code ?? null,
      next_station_code: route.stations[currentIndex + 1]?.station_code ?? null,
      current_speed_kmph: null,
      updated_at:
        currentStation.actual_arrival ??
        currentStation.actual_departure ??
        currentStation.scheduled_arrival ??
        currentStation.scheduled_departure,
    };
  }, [route]);

  const displayPosition = livePosition ?? savedPosition;
  const liveStationIndex =
    route?.stations.findIndex(
      (station) => station.station_code === displayPosition?.current_station_code,
    ) ?? -1;
  const currentStationName = useMemo(() => {
    const currentCode = displayPosition?.current_station_code;
    if (!currentCode) return "Unavailable";
    const station = route?.stations.find(
      (entry) => entry.station_code === currentCode,
    );
    return station?.station_name ?? currentCode;
  }, [displayPosition?.current_station_code, route?.stations]);

  const derivedSpeedKmph = useMemo(() => {
    const currentCode = displayPosition?.current_station_code;
    const nextCode = displayPosition?.next_station_code;
    const segmentSpeeds = (route?.segments ?? [])
      .map((segment) => segment.avg_speed_kmph)
      .filter((speed): speed is number => speed != null);

    if (!route?.segments?.length || segmentSpeeds.length === 0) return null;

    const directMatch = route.segments.find(
      (segment) =>
        ((segment.from_station_code === currentCode &&
          segment.to_station_code === nextCode) ||
          (segment.to_station_code === currentCode &&
            segment.from_station_code === nextCode)) &&
        segment.avg_speed_kmph != null,
    );

    if (directMatch?.avg_speed_kmph != null) return directMatch.avg_speed_kmph;

    const currentMatch = route.segments.find(
      (segment) =>
        (segment.from_station_code === currentCode ||
          segment.to_station_code === currentCode) &&
        segment.avg_speed_kmph != null,
    );

    if (currentMatch?.avg_speed_kmph != null) return currentMatch.avg_speed_kmph;

    const avgSpeed =
      segmentSpeeds.reduce((total, speed) => total + speed, 0) /
      segmentSpeeds.length;

    return Number.isFinite(avgSpeed) ? avgSpeed : null;
  }, [displayPosition?.current_station_code, displayPosition?.next_station_code, route]);

  const displaySpeedKmph =
    livePosition?.current_speed_kmph ?? derivedSpeedKmph;

  const destinationStation = useMemo(
    () => route?.stations[route.stations.length - 1] ?? null,
    [route],
  );

  const destinationEta = useMemo(
    () =>
      destinationStation
        ? formatTime(
            destinationStation.actual_arrival ??
              destinationStation.scheduled_arrival ??
              destinationStation.actual_departure ??
              destinationStation.scheduled_departure,
          )
        : "—",
    [destinationStation],
  );

  const delayReasonSummary = useMemo(() => {
    const reason = delay?.reason ?? "Delay under analysis";
    if (!displayPosition?.current_station_code) {
      return `Delay reason: ${reason}`;
    }
    return `Delay reason at ${currentStationName}: ${reason}`;
  }, [currentStationName, delay?.reason, displayPosition?.current_station_code]);

  const delayReasons = useMemo(() => delay?.reason ? [delay.reason] : [], [delay?.reason]);

  const routeTimeline = useMemo(() => {
    if (!route || route.stations.length === 0) return [];

    const stations = route.stations.filter(
      (station, index, list) =>
        index ===
        list.findIndex(
          (entry) => entry.station_code === station.station_code,
        ),
    );

    const primaryStations = stations.filter((station) => station.is_halt);

    return primaryStations.map((station, index) => {
      const previousPrimary = primaryStations[index - 1] ?? null;
      const nextPrimary = primaryStations[index + 1] ?? null;

      const fromIndex =
        stations.findIndex(
          (entry) => entry.station_code === station.station_code,
        ) + 1;
      const toIndex = nextPrimary
        ? stations.findIndex(
            (entry) => entry.station_code === nextPrimary.station_code,
          )
        : stations.length;

      const halts = stations
        .slice(fromIndex, toIndex)
        .filter((entry) => {
          if (entry.station_code === station.station_code) return false;
          if (
            previousPrimary &&
            entry.station_code === previousPrimary.station_code
          )
            return false;
          if (nextPrimary && entry.station_code === nextPrimary.station_code)
            return false;
          return true;
        })
        .filter(
          (entry, haltIndex, haltList) =>
            haltIndex ===
            haltList.findIndex(
              (candidate) => candidate.station_code === entry.station_code,
            ),
        );

      return {
        station,
        stationIndex: index,
        halts,
        isExpanded: expandedStationCode === station.station_code,
      };
    });
  }, [
    expandedStationCode,
    displayPosition?.current_station_code,
    displayPosition?.next_station_code,
    displayPosition?.previous_station_code,
    route,
  ]);

  useEffect(() => {
    if (!displayPosition?.current_station_code || liveStationIndex < 0) return;
    if (autoFocusedTrain.current === selectedNumber) return;
    const activeMainStation = routeTimeline.find(
      ({ station, halts }) =>
        station.station_code === displayPosition.current_station_code ||
        halts.some(
          (halt) => halt.station_code === displayPosition.current_station_code,
        ),
    );
    if (!activeMainStation) return;
    autoFocusedTrain.current = selectedNumber;
    setExpandedStationCode(activeMainStation.station.station_code);
    const activeMainIndex = routeTimeline.indexOf(activeMainStation);
    document
      .querySelectorAll(".route-node")
      [activeMainIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [
    liveStationIndex,
    displayPosition?.current_station_code,
    routeTimeline,
    selectedNumber,
  ]);

  const currentStationIndex = routeTimeline.findIndex(
    ({ station }) =>
    station.station_code === displayPosition?.current_station_code,
  );

  useEffect(() => {
    const currentCode = displayPosition?.current_station_code;
    document.querySelectorAll(".halt-item").forEach((halt) => {
      const stationCode =
        route?.stations.find((station) =>
          halt.textContent?.includes(station.station_name),
        )?.station_code ?? null;
      halt.classList.toggle(
        "current-halt",
        Boolean(currentCode && stationCode === currentCode),
      );
      halt.classList.toggle(
        "selected-halt",
        Boolean(selectedHaltCode && stationCode === selectedHaltCode),
      );
    });
  }, [
    expandedStationCode,
    displayPosition?.current_station_code,
    route,
    routeTimeline,
    selectedHaltCode,
  ]);

  useEffect(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>(".halt-item"),
    );
    const handlers = items.map((item) => {
      const handler = () => {
        const stationCode = route?.stations.find((station) =>
          item.textContent?.includes(station.station_name),
        )?.station_code;
        if (stationCode) setSelectedHaltCode(stationCode);
      };
      item.addEventListener("click", handler);
      return { item, handler };
    });
    return () =>
      handlers.forEach(({ item, handler }) =>
        item.removeEventListener("click", handler),
      );
  }, [expandedStationCode, routeTimeline, route]);

  async function refreshLiveData() {
    if (refreshing) return;
    try {
      await syncTrainNumber();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Could not refresh live data.",
      );
    }
  }

  async function refreshRouteSearchResults(trainNumber: string) {
    if (refreshing) return;
    if (!homeFromStationCode || !homeToStationCode) return;
    setRefreshing(true);
    setRefreshingResultTrain(trainNumber);
    setRefreshError("");
    setError("");
    try {
      const response = await api.searchTrainsBetween(homeFromStationCode, homeToStationCode);
      const liveTrains = response.trains as TrainSearchResult[];
      setRouteSearchResults(liveTrains);
      setStationSearchMessage(response.message ?? "");
      setTrains((current) => {
        const apiTrains = liveTrains.map((train) => ({
          train_number: train.train_number,
          name: train.train_name ?? train.name,
          source_station: train.source_station,
          destination_station: train.destination_station,
          train_type: train.train_type ?? "",
        }));
        return [...apiTrains, ...current.filter((train) => !apiTrains.some((apiTrain) => apiTrain.train_number === train.train_number))];
      });
      setLastSuccessfulRefreshAt(new Date().toISOString());
    } catch (refreshRequestError) {
      const message = refreshRequestError instanceof ApiError ? refreshRequestError.message : "Live train results could not be refreshed.";
      setRefreshError(message);
      setError(message);
    } finally {
      setRefreshingResultTrain(null);
      setRefreshing(false);
    }
  }

  async function searchFromHome() {
    beginSearchTransition();
    setError("");
    setPage("search");
    setStationSearchActive(true);
    setRouteSearchResults([]);
    setStationSearchMessage("");
    setRouteResultQuery("");
    setRouteResultSort("departure");
    setRouteResultStatus("all");
    setRouteResultDeparture("all");
    setExpandedResultRoute(null);
    const from = homeFromStation.trim();
    const to = homeToStation.trim();
    if (from || to) {
      if (!from || !to) {
        setError("Enter both a From station and a To station.");
        return;
      }
      if (!homeFromStationCode || !homeToStationCode) {
        setError("Select both stations from the live API suggestions.");
        return;
      }
      if (routeSearchInFlight.current) return;
      routeSearchInFlight.current = true;
      try {
        const response = await api.searchTrainsBetween(homeFromStationCode, homeToStationCode);
        const liveTrains = response.trains as TrainSearchResult[];
        setRouteSearchResults(liveTrains);
        setTrains((current) => {
          const apiTrains = liveTrains.map((train) => ({
            train_number: train.train_number,
            name: train.train_name ?? train.name,
            source_station: train.source_station,
            destination_station: train.destination_station,
            train_type: train.train_type ?? "",
          }));
          return [...apiTrains, ...current.filter((train) => !apiTrains.some((apiTrain) => apiTrain.train_number === train.train_number))];
        });
        setStationSearchMessage(response.message ?? "");
        setError(response.warning ?? "");
      } catch (searchError) {
        setError(searchError instanceof ApiError ? searchError.message : "Unable to search live train routes.");
      } finally {
        routeSearchInFlight.current = false;
      }
      return;
    }
    setStationSearchActive(false);
    setError("Enter both a From station and a To station.");
  }

  async function runLiveSearch() {
    const query = selectedNumber.trim();
    if (!query || liveSearchLoading || liveSearchSuggestionsLoading) return;

    const normalizedQuery = query.toLowerCase();
    const exactMatch = searchSuggestions.find(
      (train) => String(train.train_number).toLowerCase() === normalizedQuery || String(train.name).toLowerCase() === normalizedQuery,
    );
    const selectedTrain = exactMatch ?? (searchSuggestions.length === 1 ? searchSuggestions[0] : null);
    const directTrainNumber = /^\d+$/.test(query) ? query : null;
    const trainNumber = selectedTrain?.train_number ?? directTrainNumber;

    if (!trainNumber) {
      setLiveSearchError(searchSuggestions.length ? "Choose a matching train from the suggestions." : "No matching train was found.");
      return;
    }

    await handleSuggestionSelection(trainNumber);
  }

  const refreshSearchSuggestions = useCallback(
    (query = "") => {
      const liveQuery = query.trim();
      if (liveTrainSearchTimer.current != null) {
        window.clearTimeout(liveTrainSearchTimer.current);
      }
      const requestId = ++liveTrainSearchRequestId.current;

      if (!liveQuery) {
        setSearchSuggestions([]);
        setLiveSearchError("");
        setLiveSearchSuggestionsLoading(false);
        return;
      }

      setSearchSuggestions([]);
      setLiveSearchError("");
      setLiveSearchSuggestionsLoading(true);
      liveTrainSearchTimer.current = window.setTimeout(() => {
        void api.searchTrains(liveQuery)
          .then((payload) => {
            if (requestId !== liveTrainSearchRequestId.current) return;
            const liveTrains = payload as Train[];
            setTrains((current) => [
              ...liveTrains,
              ...current.filter((train) => !liveTrains.some((liveTrain) => liveTrain.train_number === train.train_number)),
            ]);
            setSearchSuggestions(liveTrains.slice(0, 8));
          })
          .catch((searchError) => {
            if (requestId !== liveTrainSearchRequestId.current) return;
            setSearchSuggestions([]);
            setLiveSearchError(searchError instanceof ApiError ? searchError.message : "Live train search is unavailable.");
          })
          .finally(() => {
            if (requestId === liveTrainSearchRequestId.current) {
              setLiveSearchSuggestionsLoading(false);
              liveTrainSearchTimer.current = null;
            }
          });
      }, 250);
    },
    [],
  );

  async function handleSuggestionSelection(trainNumber: string) {
    if (liveTrainSearchTimer.current != null) {
      window.clearTimeout(liveTrainSearchTimer.current);
      liveTrainSearchTimer.current = null;
    }
    liveTrainSearchRequestId.current += 1;
    setSearchSuggestions([]);
    setLiveSearchSuggestionsLoading(false);
    setLiveSearchError("");
    beginSearchTransition();
    setSelectedNumber(trainNumber);
    setRouteSearchResults([]);
    setStationSearchActive(false);
    setLiveSearchOpen(false);
    setError("");
    if (page !== "live") setPage("live");
    setPage("search", { parentPage: "live", label: "Back to Live Trains" });
    setLiveSearchLoading(true);
    try {
      await syncTrainNumber(trainNumber);
    } finally {
      setLiveSearchLoading(false);
    }
  }

  function homeView() {
    return (
      <PremiumHomePage
        fromStation={homeFromStation}
        toStation={homeToStation}
        searching={homeSearchLoading}
        activeField={activeHomeField}
        suggestions={homeStationSuggestions}
        stationSearching={stationSearchLoading}
        stationSearchError={stationSearchError}
        onFromChange={(value) => { setHomeFromStation(value); setHomeFromStationCode(""); requestStationSuggestions(value); }}
        onToChange={(value) => { setHomeToStation(value); setHomeToStationCode(""); requestStationSuggestions(value); }}
        onFromSelect={(station) => { setHomeFromStation(station.station_name); setHomeFromStationCode(station.station_code); requestStationSuggestions(""); setActiveHomeField(null); }}
        onToSelect={(station) => { setHomeToStation(station.station_name); setHomeToStationCode(station.station_code); requestStationSuggestions(""); setActiveHomeField(null); }}
        onFieldFocus={(field) => { setActiveHomeField(field); requestStationSuggestions(field === "from" ? homeFromStation : homeToStation); }}
        onFieldBlur={() => window.setTimeout(() => {
          if (!document.activeElement?.closest(".premium-search-field")) {
            setActiveHomeField(null);
          }
        }, 120)}
        onSearch={async () => {
          setHomeSearchLoading(true);
          try {
            await searchFromHome();
          } finally {
            setHomeSearchLoading(false);
          }
        }}
        onTrain={(trainNumber) => {
          setSelectedNumber(trainNumber);
          setPage("search");
          void syncTrainNumber(trainNumber);
        }}
        onCorridors={() => setPage("corridors")}
      />
    );

    return (
      <section className="rail-home">
        <div className="home-hero">
          <img
            className="home-hero-image"
            src="/train.jpg"
            alt="Train crossing a mountain railway"
          />
          <div className="home-hero-shade" />
          <div className="home-copy">
            <span className="section-kicker home-kicker">
              Live railway intelligence
            </span>
            <h1>
              Track every journey
              <br />
              <strong>with confidence.</strong>
            </h1>
            <p>
              Search a train, follow its live movement, and understand every
              minute of delay.
            </p>
          </div>
          <div className="home-search-card">
            <div className="home-tabs">
              <button className="active">Search Updates</button>
              <button onClick={() => setPage("search")}>Train Delay</button>
              <button onClick={() => setPage("corridors")}>Schedules</button>
            </div>
            <div className="home-search-grid">
              <label>
                <span>From station</span>
                <input
                  value={homeFromStation}
                  onFocus={() => setActiveHomeField("from")}
                  onBlur={() => window.setTimeout(() => setActiveHomeField(null), 120)}
                  onChange={(event) => {
                    setHomeFromStation(event.target.value);
                    setHomeFromStationCode("");
                    setActiveHomeField("from");
                  }}
                  placeholder="e.g. New Delhi"
                />
                {activeHomeField === "from" && homeStationSuggestions.length > 0 && (
                  <div className="home-station-suggestions">
                    {homeStationSuggestions.map((station) => (
                      <button
                        type="button"
                        key={station.station_code}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setHomeFromStation(station.station_name);
                          setHomeFromStationCode(station.station_code);
                          setActiveHomeField(null);
                        }}
                      >
                        <strong>{station.station_name}</strong>
                        <span>{station.station_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label>
                <span>To station</span>
                <input
                  value={homeToStation}
                  onFocus={() => setActiveHomeField("to")}
                  onBlur={() => window.setTimeout(() => setActiveHomeField(null), 120)}
                  onChange={(event) => {
                    setHomeToStation(event.target.value);
                    setHomeToStationCode("");
                    setActiveHomeField("to");
                  }}
                  placeholder="e.g. Kolkata"
                />
                {activeHomeField === "to" && homeStationSuggestions.length > 0 && (
                  <div className="home-station-suggestions">
                    {homeStationSuggestions.map((station) => (
                      <button
                        type="button"
                        key={station.station_code}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setHomeToStation(station.station_name);
                          setHomeToStationCode(station.station_code);
                          setActiveHomeField(null);
                        }}
                      >
                        <strong>{station.station_name}</strong>
                        <span>{station.station_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <button
                className="home-search-button"
                onClick={() => void searchFromHome()}
              >
                Search <span>→</span>
              </button>
            </div>
          </div>
        </div>
        <div className="home-lower">
          <div className="home-benefits">
            <span className="section-kicker">Why choose us</span>
            <h2>
              One clear view
              <br />
              of your railway journey.
            </h2>
            <div className="benefit-grid">
              <div>
                <strong>Live movement</strong>
                <span>See the current station, halt and route progress.</span>
              </div>
              <div>
                <strong>Accurate delay</strong>
                <span>Understand why a train is late and how much.</span>
              </div>
              <div>
                <strong>Smart ETA</strong>
                <span>
                  Use speed, distance and dwell time for arrival estimates.
                </span>
              </div>
            </div>
          </div>
          <div className="popular-routes">
            <span className="section-kicker">Popular routes</span>
            <div className="route-cards">
              <button
                onClick={() => {
                  setSelectedNumber("20801");
                  setPage("search");
                  void syncTrainNumber("20801");
                }}
              >
                <span className="route-photo route-delhi" />
                <strong>New Delhi</strong>
                <small>Live corridors</small>
              </button>
              <button
                onClick={() => {
                  setSelectedNumber("13401");
                  setPage("search");
                  void syncTrainNumber("13401");
                }}
              >
                <span className="route-photo route-kolkata" />
                <strong>Kolkata</strong>
                <small>Popular service</small>
              </button>
              <button onClick={() => setPage("corridors")}>
                <span className="route-photo route-mumbai" />
                <strong>Mumbai</strong>
                <small>Explore routes</small>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function searchView() {
    if (routeSearchResults.length > 0) {
      const fromStation = routeSearchResults[0].from_station;
      const toStation = routeSearchResults[0].to_station;
      return (
        <section className="route-search-page">
          <header className="route-search-summary">
            <div className="route-search-summary-top">
              <span className="route-search-eyebrow">Station-to-station results</span>
              <span className="route-search-live"><i /> LIVE DATA</span>
            </div>

            <div className="route-search-journey" aria-label="Route summary">
              <div className="route-search-endpoint">
                <span className="route-search-code">{fromStation?.station_code ?? homeFromStationCode}</span>
                <strong>{fromStation?.station_name ?? homeFromStation}</strong>
                <small>From station</small>
              </div>

              <div className="route-search-line" aria-hidden="true">
                <span />
                <i>
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M3 10h13m-5-5 5 5-5 5" />
                  </svg>
                </i>
              </div>

              <div className="route-search-endpoint route-search-endpoint-to">
                <span className="route-search-code">{toStation?.station_code ?? homeToStationCode}</span>
                <strong>{toStation?.station_name ?? homeToStation}</strong>
                <small>To station</small>
              </div>
            </div>

            <div className="route-search-summary-bottom">
              <span className="route-search-meta-pill">
                Journey date · {new Intl.DateTimeFormat([], { day: "numeric", month: "short", year: "numeric" }).format(new Date())}
              </span>
              <strong className="route-search-meta-highlight">
                {routeSearchResults.length} {routeSearchResults.length === 1 ? "train" : "trains"} found
              </strong>
              <button className="route-search-modify" onClick={() => setPage("home")}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 3.5H4.5v12h11V10M9 11l7-7m-4 0h4v4" />
                </svg>
                Modify search
              </button>
            </div>
          </header>

          <section className="route-results-section" aria-labelledby="route-results-title">
            <div className="route-results-toolbar">
              <div className="route-results-heading">
                <span className="route-search-eyebrow">Available services</span>
                <h2 id="route-results-title">Search results</h2>
                <p>{visibleRouteSearchResults.length} of {routeSearchResults.length} trains found</p>
              </div>

              <label className="route-filter route-filter-search">
                <span>Search results</span>
                <div>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="8.7" cy="8.7" r="5.7" />
                    <path d="m13 13 4 4" />
                  </svg>
                  <input
                    value={routeResultQuery}
                    onChange={(event) => setRouteResultQuery(event.target.value)}
                    placeholder="Train, station or code"
                  />
                </div>
              </label>

              <label className="route-filter route-filter-sort">
                <span>Sort by</span>
                <select
                  value={routeResultSort}
                  onChange={(event) => setRouteResultSort(event.target.value as "departure" | "arrival" | "duration")}
                >
                  <option value="departure">Departure</option>
                  <option value="arrival">Arrival</option>
                  <option value="duration">Journey duration</option>
                </select>
              </label>

              <label className="route-filter route-filter-status">
                <span>Status</span>
                <select value={routeResultStatus} onChange={(event) => setRouteResultStatus(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="live">Live</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="delayed">Delayed</option>
                  <option value="completed">Completed</option>
                </select>
              </label>

              <label className="route-filter route-filter-departure">
                <span>Departure</span>
                <select value={routeResultDeparture} onChange={(event) => setRouteResultDeparture(event.target.value)}>
                  <option value="all">Any time</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                </select>
              </label>
            </div>

            {visibleRouteSearchResults.length === 0 ? (
              <div className="route-filter-empty" role="status">
                <div className="route-search-empty-icon">
                  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <circle cx="21" cy="21" r="12" />
                    <path d="m30 30 9 9M12 21h18M17 14l-5 7 5 7M25 14l5 7-5 7" />
                  </svg>
                </div>
                <strong>No trains match these filters</strong>
                <span>Change your search or reset the result filters.</span>
                <button
                  className="route-action-secondary"
                  onClick={() => {
                    setRouteResultQuery("");
                    setRouteResultStatus("all");
                    setRouteResultDeparture("all");
                    setRouteResultSort("departure");
                  }}
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="route-train-grid">
                {visibleRouteSearchResults.map((train, index) => {
                  const rawStatus = (train.status ?? "").toLowerCase().replaceAll("_", "-");
                  const statusTone = ["running", "at-station", "departed"].includes(rawStatus)
                    ? "live"
                    : rawStatus === "not-running" || rawStatus === "cancelled"
                      ? "not-running"
                      : rawStatus === "delayed"
                        ? "delayed"
                        : rawStatus === "completed"
                      ? "complete"
                        : rawStatus === "upcoming" || rawStatus === "scheduled" || rawStatus === "not-started"
                          ? "upcoming"
                          : "neutral";
                  const delay = train.delay_minutes;
                  const hasDelay = delay != null && delay > 0;
                  const routeExpanded = expandedResultRoute === train.train_number;
                  const routeStops = train.route_station_names.filter(Boolean);

                  return (
                    <article className="route-train-card" key={train.train_number} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                      <div className="route-train-card-head">
                        <div className="route-train-title">
                          <span className="route-train-number">{train.train_number}</span>
                          <div className="route-train-name-wrap">
                            <h3>{train.train_name ?? train.name}</h3>
                            <span>{train.train_type || "Train type unavailable"}</span>
                          </div>
                        </div>

                        <div className="route-train-badges">
                          <span className={`route-status-badge ${statusTone}`}>
                            <i />{resultStatusLabel(train.status)}
                          </span>
                          {delay != null && (
                            <span className={`route-delay-badge${hasDelay ? " delayed" : ""}`}>
                              {hasDelay ? `+${Math.round(delay)} min delay` : delay < 0 ? `${Math.abs(Math.round(delay))} min early` : "On time"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="route-train-route-line">
                        <div className="route-train-stop-block">
                          <span className="route-train-station-code">{train.from_station?.station_code ?? "—"}</span>
                          <strong>{train.from_station?.station_name ?? train.source_station}</strong>
                          <span className="route-time route-time-scheduled">{formatTime(train.scheduled_departure)}</span>
                          <small>Scheduled departure</small>
                        </div>

                        <div className="route-train-track" aria-hidden="true">
                          <span className="route-track-bar" />
                          <i>
                            <svg viewBox="0 0 20 20" fill="none">
                              <path d="M3 10h13m-5-5 5 5-5 5" />
                            </svg>
                          </i>
                        </div>

                        <div className="route-train-stop-block route-train-stop-block-right">
                          <span className="route-train-station-code">{train.to_station?.station_code ?? "—"}</span>
                          <strong>{train.to_station?.station_name ?? train.destination_station}</strong>
                          <span className="route-time route-time-scheduled">{formatTime(train.scheduled_arrival)}</span>
                          <small>Scheduled arrival</small>
                        </div>
                      </div>

                      <div className="route-train-meta-row">
                        <div className="route-meta-item route-meta-duration">
                          <span>Journey duration</span>
                          <strong>{formatDuration(train.duration_minutes)}</strong>
                        </div>
                        <div className={`route-meta-item route-meta-current${train.current_station_name ? " has-value" : " is-unavailable"}`}>
                          <span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 17s5-4.2 5-9a5 5 0 1 0-10 0c0 4.8 5 9 5 9Z" /><circle cx="10" cy="8" r="1.7" /></svg>Current station</span>
                          <strong>{train.current_station_name ?? "Unavailable"}</strong>
                        </div>
                      </div>

                      <div className="route-train-live-details">
                        <div className={`route-live-delay${hasDelay ? " has-delay" : delay == null ? " is-unavailable" : " is-on-time"}`}>
                          <span className="route-detail-label"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3 17 16H3L10 3Z" /><path d="M10 8v3m0 2v.1" /></svg>Delay</span>
                          <strong className={hasDelay ? "delayed" : ""}>
                            {delay == null ? "Unavailable" : hasDelay ? `+${Math.round(delay)} min` : delay < 0 ? `${Math.abs(Math.round(delay))} min early` : "On time"}
                          </strong>
                        </div>
                        <div className={`route-live-eta${train.ai_predicted_eta ? " has-value" : " is-unavailable"}`}>
                          <span className="route-detail-label"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 1.5" /></svg>AI predicted ETA</span>
                          <strong>{train.ai_predicted_eta ? formatTime(train.ai_predicted_eta) : "Unavailable"}</strong>
                        </div>
                      </div>

                      {routeExpanded && (
                        <div className="route-expanded-stops" aria-label={`${train.train_name ?? train.name} route stops`}>
                          {routeStops.map((stop, stopIndex) => (
                            <span key={`${train.train_number}-${stopIndex}`}>
                              <i />
                              {stop}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="route-train-actions">
                        <RefreshLiveButton
                          refreshing={refreshing && refreshingResultTrain === train.train_number}
                          refreshError={refreshError}
                          onRefresh={() => void refreshRouteSearchResults(train.train_number)}
                          label="Refresh"
                          showLiveBadge={false}
                        />

                        <button
                          className="route-action-primary"
                          onClick={() => {
                            savedSearchResultsRef.current = routeSearchResults;
                            setSelectedNumber(train.train_number);
                            setRouteSearchResults([]);
                            setStationSearchActive(false);
                            setPage("search", { parentPage: "search", label: "Back to Train Search" });
                            void syncTrainNumber(train.train_number);
                          }}
                        >
                          <span>View Live Train</span>
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M3 10h13m-5-5 5 5-5 5" />
                          </svg>
                        </button>

                        <button
                          className="route-action-secondary"
                          aria-expanded={routeExpanded}
                          onClick={() => setExpandedResultRoute(routeExpanded ? null : train.train_number)}
                        >
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M4 4h12M4 10h12M4 16h12M7 4v12" />
                          </svg>
                          {routeExpanded ? "Hide route" : "View route"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      );
    }

    if (stationSearchActive) {
      const searching = homeSearchLoading || liveSearchLoading;
      return (
        <section className="route-search-page">
          {searching ? (
            <>
              <div className="route-search-loading-head" role="status">
                <i className="button-spinner" />
                <div>
                  <strong>Finding trains between your stations</strong>
                  <span>Searching live provider schedules...</span>
                </div>
              </div>
              <div className="route-train-grid" aria-label="Loading train results">
                {["skeleton-one", "skeleton-two", "skeleton-three"].map((key) => (
                  <article className="route-train-card route-train-skeleton" key={key}>
                    <div className="skeleton-bar skeleton-title" />
                    <div className="skeleton-journey">
                      <div className="skeleton-stop">
                        <i />
                        <i />
                        <i />
                      </div>
                      <div className="skeleton-track" />
                      <div className="skeleton-stop">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <div className="skeleton-details">
                      <i />
                      <i />
                      <i />
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className={`route-search-empty${error ? " has-error" : ""}`} role={error ? "alert" : "status"}>
              <div className="route-search-empty-icon">
                <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <circle cx="21" cy="21" r="12" />
                  <path d="m30 30 9 9M12 21h18M17 14l-5 7 5 7M25 14l5 7-5 7" />
                </svg>
              </div>
              <span className="route-search-eyebrow">{error ? "Live search unavailable" : "No services on this route"}</span>
              <h2>{error ? "Could not load trains" : "No trains found"}</h2>
              <p>
                {error || stationSearchMessage || `No trains are currently available between ${homeFromStationCode || homeFromStation} and ${homeToStationCode || homeToStation}.`}
              </p>
              <button className="route-action-primary" onClick={() => setPage("home")}>
                <span>Modify Search</span>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3 10h13m-5-5 5 5-5 5" />
                </svg>
              </button>
            </div>
          )}
        </section>
      );
    }

    return (
      <LiveServicePage
        train={selectedTrain}
        trainNumber={selectedNumber}
        route={route}
        delay={delay}
        prediction={prediction}
        forecast={forecast}
        livePosition={displayPosition}
        refreshing={refreshing}
        refreshError={refreshError}
        lastUpdatedAt={lastSuccessfulRefreshAt}
        displaySpeedKmph={displaySpeedKmph}
        currentStationName={currentStationName}
        delayReasonSummary={delayReasonSummary}
        onRefresh={() => void refreshLiveData()}
        onAnalytics={() => setPage("analytics")}
      />
    );

    return (
      <>
        <section className="service-head">
          <div>
            <div className="breadcrumb">Train Search / Live service</div>
            <h1>
              {selectedTrain?.train_number ?? selectedNumber} -{" "}
              {selectedTrain?.name ?? "Live train record"}
            </h1>
            <p>
              {selectedTrain?.source_station ?? "Origin"} <b>→</b>{" "}
              {selectedTrain?.destination_station ?? "Destination"}{" "}
              <span className="service-tag">
                {selectedTrain?.train_type ?? "Live API"}
              </span>
            </p>
          </div>
          <div className="service-actions">
            <RefreshLiveButton refreshing={refreshing} refreshError={refreshError} onRefresh={() => void refreshLiveData()} />
            <button className="primary-button" onClick={() => setPage("live")}>
              Track live
            </button>
          </div>
        </section>
        <div className="movement-strip">
          <div>
            <span>Currently at</span>
            <strong>{displayPosition?.current_station_code ?? "—"}</strong>
          </div>
          <div>
            <span>Previous</span>
            <strong>{displayPosition?.previous_station_code ?? "—"}</strong>
          </div>
          <div>
            <span>Next</span>
            <strong>{displayPosition?.next_station_code ?? "—"}</strong>
          </div>
          <div>
            <span>Speed</span>
            <strong>
              {displaySpeedKmph != null ? `${Math.round(displaySpeedKmph ?? 0)} km/h` : "—"}
            </strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatTime(displayPosition?.updated_at)}</strong>
          </div>
        </div>
        <div className="alert-strip">
          <strong>Delay reason</strong>
          <span>{delayReasonSummary}</span>
        </div>
        <section className="dashboard-grid">
          <div className="main-column">
            <div className="metric-row">
              <article className="metric-card alert">
                <span>Current delay</span>
                <strong>
                  {(() => {
                    const delayMinutes = delay?.latest_delay_minutes ?? 0;
                    return `${delayMinutes > 0 ? "+" : ""}${delayMinutes}`;
                  })()} <small>min</small>
                </strong>
                <em>{delay?.fresh_delay_minutes ?? 0} min fresh movement</em>
              </article>
              <article className="metric-card">
                <span>Estimated arrival</span>
                <strong>{destinationEta}</strong>
                <em>
                  {selectedTrain?.destination_station ?? "Destination"} expected
                  arrival
                </em>
              </article>
              <article className="metric-card">
                <span>Confidence score</span>
                <strong>
                  {delay?.confidence_score != null
                    ? `${Math.round((delay?.confidence_score ?? 0) * 100)}%`
                    : prediction?.confidence_score != null
                      ? `${Math.round((prediction?.confidence_score ?? 0) * 100)}%`
                      : "—"}
                </strong>
                <em className="confidence">
                  {delay?.confidence_level ??
                    (prediction?.confidence_score ? "MODEL" : "PENDING")}{" "}
                  confidence
                </em>
              </article>
            </div>
            <div className="tabs">
              <button className="active">Main Station Flow</button>
              <button onClick={() => setPage("analytics")}>
                Delay Analysis
              </button>
              <button onClick={() => setPage("live")}>Live Map</button>
              <span className="station-count">
                {routeTimeline.length} main stations /{" "}
                {route?.stations.length ?? 0} stops
              </span>
            </div>
            <div className="compact-route-timeline">
              {routeTimeline.map(
                ({ station, stationIndex, halts, isExpanded }) => (
                  <div
                    className={`route-node ${stationIndex === currentStationIndex ? "current-node" : ""}`}
                    key={`${station.station_code}-${station.sequence}`}
                  >
                    <button
                      className="route-node-main"
                      type="button"
                      onClick={() =>
                        setExpandedStationCode(
                          isExpanded ? null : station.station_code,
                        )
                      }
                    >
                      <span className="route-node-line" />
                      <span
                        className={`route-node-dot ${stationIndex === currentStationIndex ? "active" : ""}`}
                      />
                      <div className="route-node-copy">
                        <div className="route-node-header">
                          <span className="route-index">
                            {stationIndex + 1}
                          </span>
                          <strong>{station.station_name}</strong>
                          {stationIndex === currentStationIndex && (
                            <span className="current-pill">Current</span>
                          )}
                        </div>
                        <small>
                          {station.station_code}
                          {station.platform_no
                            ? ` - Platform ${station.platform_no}`
                            : ""}
                        </small>
                      </div>
                      <div className="route-node-times">
                        <span>
                          {formatTime(
                            station.scheduled_departure ??
                              station.scheduled_arrival,
                          )}
                        </span>
                        <span>
                          {formatTime(
                            station.actual_departure ?? station.actual_arrival,
                          )}
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="halt-list">
                        {halts.length > 0 ? (
                          halts.map((halt) => (
                            <div
                              className="halt-item"
                              key={`${halt.station_code}-${halt.sequence}`}
                            >
                              <span className="halt-dot" />
                              <div>
                                <strong>{halt.station_name}</strong>
                                <small>{halt.station_code}</small>
                              </div>
                              <em>
                                {formatTime(
                                  halt.actual_arrival ?? halt.actual_departure,
                                )}
                              </em>
                            </div>
                          ))
                        ) : (
                          <span className="halt-empty">
                            No intermediate halts
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
          <aside className="side-column">
            <MapErrorBoundary key={route?.train_number ?? "route-map-boundary"}>
              <RouteMap
                route={route}
                currentStationCode={displayPosition?.current_station_code}
              />
            </MapErrorBoundary>
            <div className="reason-card">
              <div className="card-title">
                <h3>Delay reason summary</h3>
                <a onClick={() => setPage("analytics")}>View details</a>
              </div>
              {delayReasons.map((reason, index) => (
                <div className="reason-line" key={reason}>
                  <span className={`reason-icon icon-${index}`}>
                    {index + 1}
                  </span>
                  <span>{reason}</span>
                  <b>
                    +
                    {Math.max(
                      0,
                      (delay?.latest_delay_minutes ?? 0) - index * 8,
                    )}
                    m
                  </b>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </>
    );
  }

  function liveView() {
    return (
      <LiveTrainsDashboard
        trains={trains}
        onOpenTrain={(trainNumber) => {
          setSelectedNumber(trainNumber);
          setPage("search", { parentPage: "live", label: "Back to Live Trains" });
          void syncTrainNumber(trainNumber);
        }}
      />
    );
  }
  async function refreshAnalyticsData() {
    setAnalyticsRefreshing(true);
    try {
      const summary = await api.getAnalyticsSummary();
      setAnalyticsSummary(summary as AnalyticsSummary);
      if (selectedNumber) await syncTrainNumber(selectedNumber);
      setAnalyticsLastUpdated(new Date().toISOString());
    } catch (refreshFailure) {
      setError(refreshFailure instanceof ApiError ? refreshFailure.message : "Analytics data could not be refreshed.");
    } finally {
      setAnalyticsRefreshing(false);
    }
  }

  function analyticsView() {
    const analyticsRows = analyticsSummary?.trains ?? [];
    const activeTrainCount = analyticsSummary?.active_trains ?? null;
    const totalNetworkDelay = analyticsSummary ? Math.round(analyticsSummary.total_delay_minutes) : null;
    const averageNetworkDelay = activeTrainCount ? Math.round((totalNetworkDelay ?? 0) / activeTrainCount) : null;
    const confidence = delay?.confidence_score ?? prediction?.confidence_score ?? null;
    const confidencePercent = confidence == null ? null : Math.round(confidence * 100);
    const evidenceRows = analyticsRows.filter((item) => item.reason && !/no live data/i.test(item.reason));
    const reasonTotals = analyticsRows.reduce<Record<string, number>>((totals, item) => {
      const reason = item.reason?.trim();
      if (reason) totals[reason] = (totals[reason] ?? 0) + 1;
      return totals;
    }, {});
    const chartColors = ["#0875c9", "#f28a2b", "#d85b55", "#55a995", "#8093a1"];
    const reasonData = Object.entries(reasonTotals)
      .sort((left, right) => right[1] - left[1])
      .map(([label, count], index) => ({
        label: label.replaceAll("_", " "),
        count,
        color: chartColors[index % chartColors.length],
      }));
    const reasonRecordTotal = reasonData.reduce((total, item) => total + item.count, 0);
    const comparisonData: DelayComparisonDatum[] = analyticsRows.map((item) => ({
      label: item.train_number,
      scheduled: null,
      actual: Number.isFinite(item.delay_minutes) ? Math.round(item.delay_minutes) : null,
    }));
    const topReason = Object.entries(reasonTotals).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const selectedReason = delay?.reason && !/no live data/i.test(delay.reason) ? delay.reason : null;
    const primaryReason = selectedReason ?? topReason;
    const testMaeValue = prediction?.evidence?.test_mae_minutes;
    const residualP90Value = prediction?.evidence?.validation_residual_p90_minutes;
    const testMae = typeof testMaeValue === "number" ? testMaeValue : null;
    const residualP90 = typeof residualP90Value === "number" ? residualP90Value : null;
    const predictionStatus = prediction
      ? prediction.is_fallback ? "FALLBACK" : prediction.prediction_source?.toUpperCase() ?? "AVAILABLE"
      : "UNAVAILABLE";
    const signalRows = [
      { name: "Live position", status: livePosition ? "Active" : "Unavailable", freshness: livePosition?.updated_at ? formatRelativeTime(livePosition.updated_at) : "Unavailable", healthy: Boolean(livePosition) },
      { name: "Delay event", status: delay ? "Available" : "Unavailable", freshness: "Unavailable", healthy: false },
      { name: "Segment speed", status: livePosition?.current_speed_kmph != null ? "Available" : "Unavailable", freshness: livePosition?.updated_at ? formatRelativeTime(livePosition.updated_at) : "Unavailable", healthy: false },
      { name: "ETA prediction", status: prediction ? predictionStatus : "Unavailable", freshness: "Unavailable", healthy: Boolean(prediction && !prediction.is_fallback) },
    ];
    const evidenceItems = [
      { label: "Cumulative delay", value: delay?.cumulative_delay_minutes != null ? `${Math.round(delay.cumulative_delay_minutes)} min` : "Unavailable", detail: "Accumulated delay recorded for the selected train." },
      { label: "Fresh delay", value: delay?.fresh_delay_minutes != null ? `${Math.round(delay.fresh_delay_minutes)} min` : "Unavailable", detail: "Most recent delay increment available from the delay summary." },
      { label: "Current segment speed", value: livePosition?.current_speed_kmph != null ? `${Math.round(livePosition.current_speed_kmph)} km/h` : "Unavailable", detail: "Current speed reported by the live position response." },
      { label: "Position freshness", value: livePosition?.updated_at ? formatRelativeTime(livePosition.updated_at) : "Unavailable", detail: livePosition?.updated_at ? `Position timestamp ${formatTime(livePosition.updated_at)}.` : "No live position timestamp is available." },
    ];
    const decisionStages = [
      { label: "Live movement", status: livePosition ? "Available" : "Unavailable", detail: livePosition?.current_station_code ?? "—", ready: Boolean(livePosition) },
      { label: "Signal processing", status: delay ? "Available" : "Unavailable", detail: delay?.reason?.replaceAll("_", " ") ?? "—", ready: Boolean(delay) },
      { label: "Evidence weighting", status: prediction?.evidence?.factors?.length ? "Available" : "Unavailable", detail: prediction?.evidence?.factors?.length ? `${prediction.evidence.factors.length} model factors` : "—", ready: Boolean(prediction?.evidence?.factors?.length) },
      { label: "Delay estimate", status: delay?.latest_delay_minutes != null ? "Available" : "Unavailable", detail: delay?.latest_delay_minutes != null ? `${Math.round(delay.latest_delay_minutes)} min` : "—", ready: delay?.latest_delay_minutes != null },
      { label: "AI ETA decision", status: prediction?.predicted_arrival ? "Available" : "Unavailable", detail: prediction?.predicted_arrival ? formatTime(prediction.predicted_arrival) : "—", ready: Boolean(prediction?.predicted_arrival) },
    ];
    const explanation = delay?.evidence_summary || (primaryReason
      ? `The most frequently reported reason in active service records is ${primaryReason.replaceAll("_", " ")}. Per-signal contribution data is unavailable.`
      : "Delay explanation is unavailable because no reason or evidence summary was returned.");

    return (
      <section className="analytics-page delay-analytics-page">
        <header className="analytics-hero delay-analytics-hero">
          <div>
            <span className="section-kicker">Evidence layer / SIH operations view</span>
            <h1>Delay Analytics</h1>
            <p>Trace every delay score from live movement signals to an explainable ETA decision.</p>
            <div className="analytics-subline">{selectedNumber ? `Train ${selectedNumber}` : "Network view"}<i />Active services<i />Refreshed {analyticsLastUpdated ? formatTime(analyticsLastUpdated) : "—"}</div>
          </div>
          <div className="analytics-header-actions">
            <span className={livePosition ? "analytics-network-status is-live" : "analytics-network-status"}><i />{livePosition ? "LIVE NETWORK" : analyticsSummary ? "NETWORK DATA" : "DATA UNAVAILABLE"}</span>
            <button className="analytics-refresh-button" type="button" onClick={() => void refreshAnalyticsData()} disabled={analyticsRefreshing}>
              <svg className={analyticsRefreshing ? "is-spinning" : ""} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.5 7.2A7 7 0 0 0 4.2 5.1L3 6.5m0 0V3.7m0 2.8h2.8M3.5 12.8a7 7 0 0 0 12.3 2.1l1.2-1.4m0 0v2.8m0-2.8h-2.8" /></svg>
              Refresh
            </button>
          </div>
        </header>

        <section className="analytics-kpis delay-analytics-kpis" aria-label="Executive metrics">
          <article className="analytics-kpi kpi-blue">
            <div className="analytics-kpi-heading"><span className="analytics-kpi-icon"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 15.5h14M5 12l3-3 2 2 5-6" /><path d="M12.5 5H15v2.5" /></svg></span><span>Network delay index</span></div>
            <strong>{averageNetworkDelay == null ? "—" : <>{averageNetworkDelay}<small> min</small></>}</strong>
            <em>{activeTrainCount == null ? "Active service count unavailable" : `${activeTrainCount} active services`}</em>
          </article>
          <article className="analytics-kpi kpi-orange">
            <div className="analytics-kpi-heading"><span className="analytics-kpi-icon"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.8 12.2 4l2.5-.1.8 2.3 1.8 1.7-.8 2.4.5 2.5-2.1 1.4-1.2 2.2-2.5-.4L9 17l-2.1-1.4-2.5.1-.8-2.3-1.8-1.7.8-2.4-.5-2.5 2.1-1.4 1.2-2.2 2.5.4z" /><path d="m6.8 10.2 2 2 4.5-4.5" /></svg></span><span>Confidence score</span></div>
            <strong>{confidencePercent == null ? "—" : <>{confidencePercent}<small>%</small></>}</strong>
            <em>{delay?.confidence_level ?? (prediction ? "Prediction confidence" : "Selected-train confidence unavailable")}</em>
          </article>
          <article className="analytics-kpi kpi-green">
            <div className="analytics-kpi-heading"><span className="analytics-kpi-icon"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 4.5h12v11H4zM7 2.8v3.4M13 2.8v3.4M7 9h6M7 12h4" /></svg></span><span>Evidence strength</span></div>
            <strong>{analyticsSummary ? `${evidenceRows.length} / ${activeTrainCount ?? analyticsRows.length}` : "—"}</strong>
            <em>Services with a reported delay reason</em>
          </article>
          <article className="analytics-kpi kpi-slate">
            <div className="analytics-kpi-heading"><span className="analytics-kpi-icon"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v4m0 7v4M2.5 10h4m7 0h4M4.7 4.7l2.8 2.8m5 5 2.8 2.8m0-10.6-2.8 2.8m-5 5-2.8 2.8" /><circle cx="10" cy="10" r="3" /></svg></span><span>Fallback status</span></div>
            <strong>{prediction ? prediction.is_fallback ? "FALLBACK" : prediction.prediction_source?.toUpperCase() ?? "AVAILABLE" : "—"}</strong>
            <em>{prediction ? prediction.is_fallback ? "Fallback prediction in use" : "Model prediction available" : "Prediction status unavailable"}</em>
          </article>
        </section>

        <section className="analytics-cause-grid" aria-label="Delay cause intelligence">
          <article className="analytics-panel analytics-premium-panel analytics-donut-panel">
            <div className="analytics-section-heading"><div><span className="panel-eyebrow">Delay cause intelligence</span><h2>Why delays happen</h2><p>Reported reasons across active service records.</p></div><span className="analytics-total-badge">{totalNetworkDelay == null ? "—" : `${totalNetworkDelay} min`}<small>network total</small></span></div>
            <DonutChart data={reasonData} totalDelay={totalNetworkDelay} />
          </article>
          <article className="analytics-panel analytics-premium-panel analytics-contribution-panel">
            <div className="analytics-section-heading"><div><span className="panel-eyebrow">Reason distribution</span><h2>Reported delay reasons</h2><p>Share of services by backend-reported reason.</p></div></div>
            {reasonData.length ? <div className="analytics-reason-bars">{reasonData.map((item) => {
              const percent = reasonRecordTotal ? Math.round((item.count / reasonRecordTotal) * 100) : 0;
              return <div className="analytics-reason-row" key={item.label}><div className="analytics-reason-row-heading"><strong>{item.label}</strong><b>{percent}%</b></div><div className="analytics-reason-track"><i style={{ width: `${percent}%`, background: item.color }} /></div><small>{item.count} active service {item.count === 1 ? "record" : "records"} report this reason.</small></div>;
            })}</div> : <div className="analytics-chart-empty">Reported reason data unavailable</div>}
          </article>
        </section>

        <section className="analytics-secondary-grid">
          <article className="analytics-panel analytics-premium-panel analytics-fleet-panel">
            <div className="analytics-section-heading"><div><span className="panel-eyebrow">Fleet comparison</span><h2>Scheduled vs actual delay</h2><p>Reported actual delay across active services.</p></div><span className="analytics-count-badge">{analyticsSummary ? `${analyticsRows.length} services` : "— services"}</span></div>
            <DelayBarChart data={comparisonData} />
          </article>
          <article className="analytics-panel analytics-premium-panel analytics-validation-panel">
            <div className="analytics-section-heading"><div><span className="panel-eyebrow">Forecast validation</span><h2>ETA error vs actual delay</h2><p>Regression analysis between predicted ETA error and observed delay.</p></div><span className="analytics-r2-badge">R² <b>Unavailable</b></span></div>
            <EtaScatterChart testMae={testMae} residualP90={residualP90} />
          </article>
        </section>

        <section className="analytics-explainability" id="analytics-evidence-trace">
          <div className="analytics-explainability-header"><div><span className="panel-eyebrow">Explainability trace</span><h2>Evidence contribution</h2><p>Inspect the live values and model context available for this delay decision.</p></div><span className="analytics-contribution-note">Per-signal contribution % unavailable</span></div>
          <div className="analytics-evidence-timeline">{evidenceItems.map((item, index) => <article className="analytics-evidence-item" key={item.label}>
            <span className="analytics-evidence-index">0{index + 1}</span>
            <div className="analytics-evidence-copy"><div className="analytics-evidence-title"><h3>{item.label}</h3><strong>—</strong></div><p>{item.detail}</p><div className="analytics-evidence-value"><span>Observed value</span><b>{item.value}</b></div><div className="analytics-evidence-track"><i /></div></div>
          </article>)}</div>
        </section>

        <section className="analytics-decision-flow" aria-label="Decision trace">
          <div className="analytics-section-heading"><div><span className="panel-eyebrow">Decision trace</span><h2>From movement to ETA</h2></div></div>
          <div className="analytics-flow-nodes">{decisionStages.map((stage, index) => <Fragment key={stage.label}><article className={stage.ready ? "analytics-flow-node is-ready" : "analytics-flow-node"}><span className="analytics-flow-index">0{index + 1}</span><strong>{stage.label}</strong><small>{stage.status}</small><em>{stage.detail}</em></article>{index < decisionStages.length - 1 && <span className="analytics-flow-connector" aria-hidden="true" />}</Fragment>)}</div>
        </section>

        <section className="analytics-bottom-grid">
          <article className="analytics-panel analytics-premium-panel analytics-signals-panel">
            <div className="analytics-section-heading"><div><span className="panel-eyebrow">Live evidence</span><h2>Live signals</h2></div></div>
            <div className="analytics-signal-table"><div className="analytics-signal-head"><span>Signal</span><span>Status</span><span>Freshness</span></div>{signalRows.map((signal) => <div className="analytics-signal-row" key={signal.name}><strong>{signal.name}</strong><span className={signal.healthy ? "signal-status is-healthy" : "signal-status"}><i />{signal.status}</span><small>{signal.freshness}</small></div>)}</div>
          </article>
          <article className="analytics-insight-panel">
            <span className="panel-eyebrow">AI explanation</span>
            <h2>{selectedNumber ? `Train ${selectedNumber} delay context` : "Network delay context"}</h2>
            <p>{explanation}</p>
            <div className="analytics-insight-metrics"><div><span>Primary factor</span><strong>{primaryReason?.replaceAll("_", " ") ?? "Unavailable"}</strong></div><div><span>Contribution</span><strong>Unavailable</strong></div><div><span>Evidence</span><strong>{analyticsSummary ? `${evidenceRows.length} / ${activeTrainCount ?? analyticsRows.length} records` : "Unavailable"}</strong></div><div><span>Confidence</span><strong>{confidencePercent == null ? "Unavailable" : `${confidencePercent}%`}</strong></div></div>
          </article>
        </section>
      </section>
    );
  }
  function corridorsView() {
    return (
      <CorridorDirectory
        onOpenTrain={(trainNumber) => {
          setSelectedNumber(trainNumber);
          setPage("search", { parentPage: "corridors", label: "Back to Corridors" });
          void syncTrainNumber(trainNumber);
        }}
      />
    );
  }
  function networkView() {
    return (
      <NetworkDashboard
        trains={trains}
        onOpenTrain={(trainNumber) => {
          setSelectedNumber(trainNumber);
          setPage("search", { parentPage: "network", label: "Back to Network Intelligence" });
          void syncTrainNumber(trainNumber);
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => setPage("home")}>
          <img src="/rail-gaadi-logo.svg" alt="" />
          <strong>RAIL GAADI</strong>
        </button>
        <button
          className="mobile-nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={mobileNavOpen ? "mobile-nav-open" : ""}>
          {navItems.map((item) => (
            <button
              className={page === item.id || (page === "search" && detailContext?.parentPage === item.id) ? "selected" : ""}
              key={item.id}
              onClick={() => {
                setPage(item.id);
                setMobileNavOpen(false);
              }}
            >
              {item.icon && <span className="nav-network-icon" aria-hidden="true"><i /><i /><i /></span>}
              {item.label}
              {item.id === "live" && <span className="nav-live-dot" />}
            </button>
          ))}
        </nav>
        <div className="app-live-search-anchor">
          <div className="header-search">
            <button
              className={liveSearchOpen ? "live-search-trigger open" : "live-search-trigger"}
              onClick={() => {
                const opening = !liveSearchOpen;
                setLiveSearchOpen(opening);
                if (opening) {
                  setLiveSearchError("");
                  if (selectedNumber.trim()) void refreshSearchSuggestions(selectedNumber);
                }
              }}
            >
              <SearchIcon /> Live Search
            </button>
          </div>
          {liveSearchOpen && (
            <div className="live-search-panel" onMouseDown={(event) => event.stopPropagation()}>
              <div className="live-search-panel-heading"><div><span className="panel-eyebrow">Live search</span><strong>Find your train</strong></div><button aria-label="Close live search" onClick={() => setLiveSearchOpen(false)}>×</button></div>
              <label><span>Train number / name</span><input autoFocus disabled={liveSearchLoading} value={selectedNumber} onKeyDown={(event) => { if (event.key === "Enter") void runLiveSearch(); }} onChange={(event) => { setSelectedNumber(event.target.value); void refreshSearchSuggestions(event.target.value); }} placeholder="e.g. 20801 or Magadh Express" /></label>
              <div className="live-search-results" aria-live="polite">
                {liveSearchSuggestionsLoading && <div className="live-search-feedback" role="status"><i className="button-spinner" /> Searching live trains...</div>}
                {!liveSearchSuggestionsLoading && liveSearchError && <div className="live-search-feedback is-error" role="status">{liveSearchError}</div>}
                {!liveSearchSuggestionsLoading && !liveSearchError && searchSuggestions.length > 0 && (
                  <div className="live-search-train-list">
                    <div className="live-search-divider"><span>Matching trains</span></div>
                    {searchSuggestions.map((train) => (
                      <button key={train.train_number} disabled={liveSearchLoading} onClick={() => void handleSuggestionSelection(train.train_number)}>
                        <strong>{train.train_number}</strong><span>{train.name}</span><small>{train.source_station} → {train.destination_station}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="live-search-submit" disabled={liveSearchLoading || liveSearchSuggestionsLoading || !selectedNumber.trim()} onClick={() => void runLiveSearch()}>
                {liveSearchLoading ? <><i className="button-spinner" /> Loading live service...</> : <>Search Train <b>→</b></>}
              </button>
            </div>
          )}
        </div>
      </header>
      <div className={page === "search" && detailContext ? "content has-context-back" : "content"}>
        {page === "search" && detailContext && !routeSearchResults.length && !stationSearchActive && (
          <BackButton label={detailContext.label} onBack={goBack} />
        )}
        {isSearchTransitioning && (
          <div className="search-transition" key={searchTransitionKey} role="status" aria-live="polite">
            <div className="search-transition-track" aria-hidden="true"><span /><span /><span /></div>
            <img className="search-transition-train" src="/search-icon.png" alt="" />
            <strong>Finding your train</strong>
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
        {page === "home" && homeView()}
        {page === "search" && searchView()}
        {(page === "live" || detailContext?.parentPage === "live") && (
          <div hidden={page !== "live"}>{liveView()}</div>
        )}
        {page === "analytics" && analyticsView()}
        {(page === "corridors" || detailContext?.parentPage === "corridors") && (
          <div hidden={page !== "corridors"}>{corridorsView()}</div>
        )}
        {(page === "network" || detailContext?.parentPage === "network") && (
          <div hidden={page !== "network"}>{networkView()}</div>
        )}
      </div>
    </main>
  );
}

export default App;
