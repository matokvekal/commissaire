import React from "react";
import styles from "./raceTile.module.css";
import { resolveRaceImage } from "@/utils/resolveRaceImage";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import type { RaceCardProps } from "@/types/types";
import { effectiveRaceStatus } from "@/utils/raceStatus";

const STATUS_COLOR: Record<string, string> = {
  running: "#3edda4",
  upcoming: "#63a6fc",
  finished: "#aab8cc"
};

const STATUS_LABEL: Record<string, string> = {
  running: "Live",
  upcoming: "Soon",
  finished: "Done"
};

const RaceTile: React.FC<RaceCardProps> = ({
  uuid,
  name,
  date,
  image,
  status,
  ridersCount,
  isFavorite,
  onToggleFavorite
}) => {
  const navigate = useNavigate();

  const resolvedImage = resolveRaceImage(image);

  const statusKey = effectiveRaceStatus(status, date);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(uuid);
  };

  return (
    <div className={styles.tile} onClick={() => navigate(`/race/${uuid}`)}>
      <div className={styles.imgWrap}>
        <img src={resolvedImage} alt={name} className={styles.img} />

        <span
          className={styles.statusBadge}
          style={{ background: STATUS_COLOR[statusKey] }}
        >
          {statusKey === "running" && <span className={styles.dot} />}
          {STATUS_LABEL[statusKey]}
        </span>

        <button className={`${styles.favBtn} ${isFavorite ? styles.favActive : ""}`} onClick={handleFavorite}>
          <Heart
            width={13}
            height={13}
            fill={isFavorite ? "currentColor" : "none"}
            strokeWidth={2}
          />
        </button>
      </div>

      <div className={styles.info}>
        <div className={styles.name}>{name}</div>
        {date && <div className={styles.date}>{date}</div>}
        {ridersCount > 0 && (
          <div className={styles.riders}>{ridersCount} riders</div>
        )}
      </div>
    </div>
  );
};

export default RaceTile;
