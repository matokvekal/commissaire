import React, { useRef, useState, useEffect } from "react";
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

const RacingRider: React.FC<Props> = ({ rider, color, forceBell = false, isFlashing = false, raceEnded = false, onClick, onDoubleClick }) => {
  const clickCountRef = useRef<number>(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { skin } = useSkin();
  const isPro = skin === "gaming";

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
      data-testid={`racing-rider-${rider.bibNumber}`}
      data-laps={`${rider.lapsCounter}/${rider.totalLaps}`}
      className={`${styles.rider} ${glowClass} ${raceEnded ? styles.onTrack : ""}`}
      style={{ background: bgStyle, "--glow-color": color } as React.CSSProperties}
      onClick={handleClick}
      onDoubleClick={(e) => { e.preventDefault(); }}
    >
      {paceProgress != null && (
        <div
          className={`${styles.paceBorder} ${paceOverdue ? styles.paceBorderOverdue : ""}`}
          style={{ "--pace-progress": Math.min(paceProgress, 1) } as React.CSSProperties}
          aria-hidden="true"
        />
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
