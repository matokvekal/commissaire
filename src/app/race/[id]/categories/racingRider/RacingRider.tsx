import React, { useRef, useState, useEffect, useMemo } from "react";
import styles from "./racingRider.module.css";
import { RiderProps } from "@/types/types";
import { formatTime, parseClockTimeMs } from "@/utils/timeUtils";
import { useSkin } from "@/hooks/useSkin";
import { Bell } from "lucide-react";

interface Props {
  rider: RiderProps;
  color: string;
  forceBell?: boolean;
  isFlashing?: boolean;
  raceEnded?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

type Pt = { x: number; y: number };

// Walk the perimeter of a rounded rect (w x h, corner radius r), starting at
// top-center and going clockwise, returning `count` evenly-spaced points.
// Used to lay the pace dots directly on the card's actual edge. The card's
// height is only a *minimum* (racingRider.module.css `.rider` uses
// min-height, not height) and its border-radius differs by skin (16px
// classic, 12px gaming — dots only ever render in gaming), so the geometry
// is computed from the card's real measured size, not assumed constants.
function roundedRectPerimeterPoints(w: number, h: number, r: number, count: number): Pt[] {
  const straightX = w / 2 - r;
  const straightY = h - 2 * r;
  const straightBottom = w - 2 * r;
  const arc = (Math.PI / 2) * r;
  const segs = [straightX, arc, straightY, arc, straightBottom, arc, straightY, arc, straightX];
  const total = segs.reduce((a, b) => a + b, 0);

  const pointAt = (t: number): Pt => {
    let d = ((t % total) + total) % total;
    if (d <= segs[0]) return { x: w / 2 + d, y: 0 };
    d -= segs[0];
    if (d <= segs[1]) {
      const a = -Math.PI / 2 + (d / segs[1]) * (Math.PI / 2);
      return { x: w - r + r * Math.cos(a), y: r + r * Math.sin(a) };
    }
    d -= segs[1];
    if (d <= segs[2]) return { x: w, y: r + d };
    d -= segs[2];
    if (d <= segs[3]) {
      const a = (d / segs[3]) * (Math.PI / 2);
      return { x: w - r + r * Math.cos(a), y: h - r + r * Math.sin(a) };
    }
    d -= segs[3];
    if (d <= segs[4]) return { x: w - r - d, y: h };
    d -= segs[4];
    if (d <= segs[5]) {
      const a = Math.PI / 2 + (d / segs[5]) * (Math.PI / 2);
      return { x: r + r * Math.cos(a), y: h - r + r * Math.sin(a) };
    }
    d -= segs[5];
    if (d <= segs[6]) return { x: 0, y: h - r - d };
    d -= segs[6];
    if (d <= segs[7]) {
      const a = Math.PI + (d / segs[7]) * (Math.PI / 2);
      return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
    }
    d -= segs[7];
    return { x: r + d, y: 0 };
  };

  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) pts.push(pointAt((i / count) * total));
  return pts;
}

// Dense enough to read as a dotted line, not scattered points — same inset
// (3px) the old conic-gradient ring used (padding: 3px before masking to a
// frame). Gaming-skin card radius is 12px, so the inset path radius is 9px.
const PACE_DOT_COUNT = 60;
const PACE_DOT_CARD_RADIUS = 12;
const PACE_DOT_INSET = 3;

const RacingRider: React.FC<Props> = ({ rider, color, forceBell = false, isFlashing = false, raceEnded = false, onClick, onDoubleClick }) => {
  const clickCountRef = useRef<number>(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { skin } = useSkin();
  const isPro = skin === "gaming";

  // Measure the card's real rendered box (not the min-height default) so the
  // pace dots trace its actual edge instead of drifting off it when content
  // pushes the card taller. Only observed in the gaming skin, where the dots
  // can render at all.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<{ w: number; h: number }>({ w: 76, h: 84 });
  useEffect(() => {
    if (!isPro || !cardRef.current) return;
    const el = cardRef.current;
    const ro = new ResizeObserver(() => {
      setCardSize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPro]);

  const paceDotPoints = useMemo(() => {
    const w = Math.max(cardSize.w - PACE_DOT_INSET * 2, PACE_DOT_CARD_RADIUS * 2 + 1);
    const h = Math.max(cardSize.h - PACE_DOT_INSET * 2, PACE_DOT_CARD_RADIUS * 2 + 1);
    return roundedRectPerimeterPoints(w, h, PACE_DOT_CARD_RADIUS - PACE_DOT_INSET, PACE_DOT_COUNT).map((p) => ({
      x: p.x + PACE_DOT_INSET,
      y: p.y + PACE_DOT_INSET,
    }));
  }, [cardSize.w, cardSize.h]);

  const lapsRemaining = rider.totalLaps - rider.lapsCounter;
  const showBell = forceBell || (lapsRemaining === 2);
  const showStripes = forceBell || (lapsRemaining === 1);

  // Live ticking clock: how long since this rider last crossed (or since race start if never).
  // Only ticks once the race has actually started — before that the card shows a frozen 00:00.
  const hasStarted = rider.raceStatus === "running" || rider.raceStatus === "finished";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasStarted) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasStarted]);
  const sinceArriveBaseline = parseClockTimeMs(rider.timeArrive) ?? parseClockTimeMs(rider.timeStartRace);
  const sinceArriveMs = hasStarted && sinceArriveBaseline != null ? now - sinceArriveBaseline : null;
  const sinceArrive = sinceArriveMs != null ? formatTime(sinceArriveMs / 1000) : null;

  // Last completed lap's time — read straight from lapsDetails (the authoritative,
  // per-lap history) rather than the separately-tracked elapsedLastLap field, which
  // can end up stale/blank depending on which code path last touched the rider.
  const lastLap = rider.lapsDetails && rider.lapsDetails.length > 0
    ? rider.lapsDetails[rider.lapsDetails.length - 1]
    : null;
  const lastLapTime = lastLap?.lapTime ?? rider.elapsedLastLap ?? null;

  // PRO-only pace border: how far into an "expected" lap (paced off the rider's own
  // last lap) they are right now, traced clockwise around the card's edge starting
  // top-center. Sampled on its own 10s tick — deliberately chunkier than the 1s
  // "since arrival" tick above, which keeps driving the text row untouched.
  const [paceNow, setPaceNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isPro || !hasStarted) return;
    const t = setInterval(() => setPaceNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, [isPro, hasStarted]);

  const lastLapMs = lastLap ? new Date(lastLap.endTime).getTime() - new Date(lastLap.startTime).getTime() : null;
  const paceSinceArriveMs = hasStarted && sinceArriveBaseline != null ? paceNow - sinceArriveBaseline : null;
  const paceProgress = isPro && hasStarted && lastLapMs && lastLapMs > 0 && paceSinceArriveMs != null
    ? paceSinceArriveMs / lastLapMs
    : null;
  const paceOverdue = paceProgress != null && paceProgress >= 1;
  // Index of the leading (blinking) dot — dots before it stay solid, marking
  // elapsed progress; nothing is rendered past it (mirrors the old ring only
  // painting the elapsed arc, not the full circle).
  const paceDotIndex = paceProgress != null
    ? Math.min(Math.floor(Math.min(paceProgress, 1) * PACE_DOT_COUNT), PACE_DOT_COUNT - 1)
    : null;

  const bgStyle = color;

  // Single source of truth for tap disambiguation: the browser always eventually fires
  // a 'click' event, for touch and mouse alike (the viewport meta tag already kills the
  // old 300ms mobile click delay). A separate touchend-based detector used to run in
  // parallel with this one — two independent state machines reacting to the same taps —
  // which could desync and swallow a double-tap on active (still-racing) riders.
  const handleClick = (e: React.MouseEvent) => {
    clickCountRef.current++;

    if (clickCountRef.current === 1) {
      // Wait to see if a second click comes within 300ms
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          onClick(); // Single click
          setNow(Date.now()); // snap the "since arrive" clock to 0 right away, don't wait for the next tick
        }
        clickCountRef.current = 0;
      }, 300);
    } else if (clickCountRef.current === 2) {
      // Double click detected
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      onDoubleClick();
      clickCountRef.current = 0;
    }
  };

  const glowClass = isFlashing ? styles.flash : "";

  return (
    <div
      ref={cardRef}
      data-testid={`racing-rider-${rider.bibNumber}`}
      data-laps={`${rider.lapsCounter}/${rider.totalLaps}`}
      className={`${styles.rider} ${glowClass} ${raceEnded ? styles.onTrack : ""}`}
      style={{ background: bgStyle, "--glow-color": color } as React.CSSProperties}
      onClick={handleClick}
      onDoubleClick={(e) => { e.preventDefault(); }}
    >
      {paceDotIndex != null && (
        <div className={styles.paceDots} aria-hidden="true">
          {paceOverdue ? (
            <span
              className={`${styles.paceDot} ${styles.paceDotOverdue}`}
              style={{ left: `${paceDotPoints[0].x}px`, top: `${paceDotPoints[0].y}px` }}
            />
          ) : (
            paceDotPoints.slice(0, paceDotIndex + 1).map((pt, i) => (
              <span
                key={i}
                className={`${styles.paceDot} ${i === paceDotIndex ? styles.paceDotCurrent : ""}`}
                style={{ left: `${pt.x}px`, top: `${pt.y}px` }}
              />
            ))
          )}
        </div>
      )}
      {raceEnded && (
        <div className={styles.onTrackRibbon} title="Race ended — this rider is still on the track">
          ⚑ ON TRACK
        </div>
      )}
      {showBell && (
        <div className={styles.bellBadge} title={`2 laps left! (${rider.lapsCounter}/${rider.totalLaps})`}>
          <Bell size={16} color="#ffd60a" fill="#ffd60a" />
        </div>
      )}
      {showStripes && (
        <div className={styles.flagBadge} title={`Last lap! (${rider.lapsCounter}/${rider.totalLaps})`}>
          <div className={styles.flagCloth} />
          <div className={styles.flagPole} />
        </div>
      )}
      <div className={styles.bib}>{rider.bibNumber}</div>
      <div className={styles.laps}>
        <span className={styles.lapsLabel}>finish:</span>
        {rider.lapsCounter}/{rider.totalLaps}
      </div>
      {rider.totalLaps > 0 && (
        <div className={styles.remaining}>
          {lapsRemaining === 1 ? 'Last' : `${Math.max(0, lapsRemaining)} left`}
        </div>
      )}
      {!hasStarted ? (
        <div className={styles.lapTime}>
          <span className={styles.lapTimeCell}>00:00</span>
          <span className={styles.lapTimeCell}>00:00</span>
        </div>
      ) : (lastLapTime || sinceArrive) && (
        <div className={styles.lapTime}>
          <span className={styles.lapTimeCell}>{lastLapTime ?? "--:--"}</span>
          <span className={styles.lapTimeCell}>{sinceArrive ?? "--:--"}</span>
        </div>
      )}
      <div className={`${styles.pos} ${typeof rider.position_category === "number" && rider.position_category >= 1 && rider.position_category <= 3 ? styles.posPodium : ""}`}>{rider.position_category ?? "—"}</div>
    </div>
  );
};

export default RacingRider;
