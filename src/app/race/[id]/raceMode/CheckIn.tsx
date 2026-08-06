import React, { useEffect, useState } from "react";
import styles from "./checkIn.module.css";
import { CategoryProps, RiderProps } from "@/types/types";
import useRiderStore from "@/stores/ridersStore";
import useUIStore from "@/stores/uiStore";
import StatusModal from "../../components/modals/StatusModal";
import QuickAddRider from "./QuickAddRider";
import Icons from "@/constants/Icons";
import { recordRaceEvent } from "@/services/cloud/raceEvents";
import { canForRace } from "@/services/cloud/permissions";
import { riderInCategory } from "../schedule/Schedule";

interface Props {
  raceUuid: string;
  waveNum: number;
  categories: CategoryProps[];
}

const CheckIn: React.FC<Props> = ({ raceUuid, waveNum, categories }) => {
  const { riders, getRiders, updateRider, patchRiders } = useRiderStore();
  const { openModal } = useUIStore();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [selectedRider, setSelectedRider] = useState<RiderProps | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [groupByCat, setGroupByCat] = useState(false);
  const [sortByStanding, setSortByStanding] = useState(false);
  const [standingScope, setStandingScope] = useState<"category" | "overall">("category");

  useEffect(() => { getRiders(raceUuid); }, [raceUuid, getRiders]);

  const waveRiders = riders.filter(
    (r) => r.raceUuid === raceUuid && categories.some((c) => riderInCategory(r, c))
  );

  const filtered = waveRiders.filter((r) => {
    if (filterCat !== "all" && r.category !== filterCat) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      String(r.bibNumber).includes(q)
    );
  });

  // Standing = the seeding number imported per rider (position_start).
  // When enabled we order by it — either within each category, or as one
  // overall standing across the whole wave (races where standing is global).
  const byStanding = (a: RiderProps, b: RiderProps) =>
    (a.position_start ?? Infinity) - (b.position_start ?? Infinity);

  const displayed = sortByStanding
    ? [...filtered].sort((a, b) => {
        if (standingScope === "category" && a.category !== b.category)
          return a.category.localeCompare(b.category);
        return byStanding(a, b);
      })
    : filtered;

  // Per-rider category color. Prefer the rider's own color (set from its exact
  // category incl. subCategory); fall back to a composite category lookup so a
  // shared category name (e.g. "Masters Men " 19-29 vs 30-49) resolves correctly.
  const catColorOfRider = (rider: RiderProps) =>
    rider.color ??
    categories.find(
      (c) => c.name === rider.category && (c.subCategory ?? null) === (rider.subCategory ?? null)
    )?.color ??
    "#63a6fc";

  const catNames = [...new Set(waveRiders.map((r) => r.category))].sort();

  const recordCheckin = (rider: RiderProps, checked: boolean) =>
    recordRaceEvent({
      raceUuid,
      riderId: rider.id,
      bibNumber: rider.bibNumber,
      eventType: "RIDER_CHECKIN",
      payload: { riderLocalId: rider.id, riderPatch: { checked } },
    });

  const toggleCheck = (rider: RiderProps) => {
    if (!canForRace(raceUuid, "CHECKIN_RIDER")) return;
    updateRider({ ...rider, checked: !rider.checked });
    void recordCheckin(rider, !rider.checked);
  };

  /**
   * Check in every rider currently shown, in a SINGLE store write.
   *
   * This used to loop `updateRider` + `recordRaceEvent` per rider, which meant
   * three IndexedDB round-trips each (rider write, `persist` re-writing the
   * whole array, event write). On a real start list that froze the screen and
   * a stale in-flight `getRiders` could land mid-flood and revert the ticks.
   * Keep it batched: one `patchRiders`, then drain the event log serially in
   * the background so it never competes with the UI write.
   */
  const checkAll = async () => {
    if (!canForRace(raceUuid, "CHECKIN_RIDER")) return;
    const unchecked = filtered.filter((r) => !r.checked && !["DNS", "DNF", "DSQ"].includes(r.status));
    if (unchecked.length === 0) return;

    const checkedIn = unchecked.map((r) => ({ ...r, checked: true }));
    await patchRiders(checkedIn);

    void (async () => {
      for (const r of checkedIn) {
        try {
          await recordCheckin(r, true);
        } catch (e) {
          console.warn("Check-in event not logged for bib", r.bibNumber, e);
        }
      }
    })();
  };

  const allAccountedFor = filtered.length > 0 && filtered.every(
    (r) => r.checked || ["DNS", "DNF", "DSQ"].includes(r.status)
  );

  const isRaceActive = categories.some(
    (c) => c.status === "running" || c.status === "finished"
  );

  const handleStatusChange = (status: any) => {
    if (selectedRider) updateRider({ ...selectedRider, status });
  };

  /**
   * One-tap DNS straight from the row (BUGS.md #25). Marking a rider DNS is the
   * commonest pre-start action on this screen and used to cost three taps
   * (Status → modal → DNS). Toggles back to "standing" so it's undoable, and
   * writes the same field the Status menu does, so the two stay in step.
   */
  const toggleDns = (rider: RiderProps) => {
    if (!canForRace(raceUuid, "MARK_DNS")) return;
    const nowDns = rider.status !== "DNS";
    updateRider({
      ...rider,
      status: nowDns ? "DNS" : "standing",
      // A DNS rider never takes the line, so they can't stay checked in.
      checked: nowDns ? false : rider.checked,
    });
  };

  const catMetaOf = (name: string, sub: string | null) =>
    categories.find((c) => c.name === name && (c.subCategory ?? null) === sub);

  // Group the displayed riders into per-category blocks (name + subCategory),
  // ordered by category start time then name, for the "blocks" check-in view.
  const groups = (() => {
    const map = new Map<string, { key: string; name: string; sub: string | null; color: string; riders: RiderProps[] }>();
    for (const r of displayed) {
      const sub = r.subCategory ?? null;
      const key = `${r.category} ${sub ?? ""}`;
      if (!map.has(key)) map.set(key, { key, name: r.category, sub, color: catColorOfRider(r), riders: [] });
      map.get(key)!.riders.push(r);
    }
    return [...map.values()].sort((a, b) => {
      const sa = catMetaOf(a.name, a.sub)?.startTime ?? "";
      const sb = catMetaOf(b.name, b.sub)?.startTime ?? "";
      if (sa !== sb) return sa.localeCompare(sb);
      return a.name.localeCompare(b.name);
    });
  })();

  const renderRow = (rider: RiderProps) => {
    const hasStatus = ["DNS", "DNF", "DSQ"].includes(rider.status);
    const statusClass = rider.status === "DNS"
      ? styles.dnsBadge
      : rider.status === "DNF"
      ? styles.dnfBadge
      : rider.status === "DSQ"
      ? styles.dsqBadge
      : "";
    return (
      <div
        key={rider.id}
        data-testid={`checkin-row-${rider.bibNumber}`}
        data-checked={rider.checked ? "yes" : "no"}
        data-status={rider.status}
        className={`${styles.row} ${rider.checked ? styles.checked : ""} ${hasStatus ? styles.out : ""}`}
      >
        <span className={styles.rowColorBar} style={{ background: catColorOfRider(rider) }} title={rider.category} />
        <div className={styles.leftArea}>
          {hasStatus ? (
            <button
              className={`${styles.statusInlineBadge} ${statusClass}`}
              onClick={() => { setSelectedRider(rider); openModal("modalStatus"); }}
              title="Tap to change status"
            >
              {rider.status}
            </button>
          ) : isRaceActive ? (
            <>
              <span className={`${styles.checkBtn} ${rider.checked ? styles.checkedBtn : styles.lockedBtn}`} title="Check-in locked" />
              <button className={styles.statusTrigger} onClick={() => { setSelectedRider(rider); openModal("modalStatus"); }}>Status</button>
            </>
          ) : (
            <>
              <button
                className={`${styles.checkBtn} ${rider.checked ? styles.checkedBtn : ""}`}
                onClick={() => toggleCheck(rider)}
                title={rider.checked ? "Uncheck" : "Check in"}
              />
              <button
                className={styles.dnsTrigger}
                onClick={() => toggleDns(rider)}
                title="Mark as DNS (did not start)"
                aria-label={`Mark #${rider.bibNumber} DNS`}
              >
                DNS
              </button>
              <button className={styles.statusTrigger} onClick={() => { setSelectedRider(rider); openModal("modalStatus"); }}>Status</button>
            </>
          )}
        </div>
        {sortByStanding && (
          <span className={styles.standingNum} title="Standing">
            {rider.position_start ?? "–"}
          </span>
        )}
        <span className={styles.bib}>#{rider.bibNumber}</span>
        <span className={styles.name}>{rider.lastName} {rider.firstName}</span>
        <span className={styles.cat}>
          <span className={styles.catDot} style={{ background: catColorOfRider(rider) }} />
          {rider.category}
        </span>
      </div>
    );
  };

  const renderCard = (rider: RiderProps) => {
    const hasStatus = ["DNS", "DNF", "DSQ"].includes(rider.status);
    const isChecked = rider.checked;
    const catColor = catColorOfRider(rider);
    const tileBg = isChecked
      ? `linear-gradient(160deg, #3edda4, #2fcf95)`
      : hasStatus
      ? "#d0d8ea"
      : catColor;
    return (
      <div key={rider.id} className={`${styles.checkTile} ${hasStatus ? styles.checkTileOut : ""}`}>
        {/* Category color strip — always visible, even when checked (green) or out (grey) */}
        <span className={styles.tileCatStrip} style={{ background: catColor }} title={rider.category} />
        <div className={styles.checkTileInner} style={{ background: tileBg }}>
          <button
            className={styles.tileStatusTrigger}
            onClick={() => { setSelectedRider(rider); openModal("modalStatus"); }}
            title="Change status"
          >⋯</button>
          {isChecked && !hasStatus && <div className={styles.checkMark}>✓</div>}
          <div className={styles.checkTileBib}>{rider.bibNumber}</div>
          {hasStatus && <div className={styles.tileStatusBadge}>{rider.status}</div>}
        </div>
        <button
          className={styles.checkTileBtn}
          onClick={() => { if (!isRaceActive && !hasStatus) toggleCheck(rider); }}
          disabled={isRaceActive || hasStatus}
        >
          {isChecked ? "✓ Go Live" : "Go Live"}
        </button>
      </div>
    );
  };

  const renderGroupHeader = (g: { name: string; sub: string | null; color: string; riders: RiderProps[] }) => (
    <div className={styles.catGroupHeader}>
      <span className={styles.catGroupBar} style={{ background: g.color }} />
      <span className={styles.catGroupName}>{g.name}{g.sub ? ` · ${g.sub}` : ""}</span>
      <span className={styles.catGroupCount}>
        ✓ {g.riders.filter((r) => r.checked).length}/{g.riders.length}
      </span>
    </div>
  );

  return (
    <div className={styles.container}>
      {isRaceActive && (
        <div className={styles.raceLockBanner}>
          🏁 Race in progress — check-in locked. You can still change rider status.
        </div>
      )}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <img src={Icons.search} alt="" width={14} height={14} />
          <input
            className={styles.search}
            placeholder="Search name or bib…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={styles.catSelect} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">All</option>
          {catNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >☰</button>
          <button
            className={`${styles.viewBtn} ${viewMode === "cards" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("cards")}
            title="Card view"
          >⊞</button>
        </div>
      </div>

      <div className={styles.standingBar}>
        <label className={styles.standingToggle}>
          <input
            type="checkbox"
            checked={groupByCat}
            onChange={(e) => setGroupByCat(e.target.checked)}
          />
          <span>Group by category</span>
        </label>
        <label className={styles.standingToggle}>
          <input
            type="checkbox"
            checked={sortByStanding}
            onChange={(e) => setSortByStanding(e.target.checked)}
          />
          <span>Sort by standing</span>
        </label>
        {sortByStanding && (
          <div className={styles.scopeToggle}>
            <button
              className={`${styles.scopeBtn} ${standingScope === "category" ? styles.scopeBtnActive : ""}`}
              onClick={() => setStandingScope("category")}
            >Per category</button>
            <button
              className={`${styles.scopeBtn} ${standingScope === "overall" ? styles.scopeBtnActive : ""}`}
              onClick={() => setStandingScope("overall")}
            >Overall</button>
          </div>
        )}
      </div>

      <div className={styles.counts}>
        <span className={styles.countItem}>✓ {waveRiders.filter((r) => r.checked).length} checked</span>
        <span className={styles.countItem}>✗ {waveRiders.filter((r) => r.status === "DNS").length} DNS</span>
        <span className={styles.countItem}>Total {waveRiders.length}</span>
        {!allAccountedFor && !isRaceActive && (
          <button className={styles.checkAllBtn} onClick={checkAll}>
            ✓ Check All
          </button>
        )}
      </div>

      {groupByCat ? (
        <div className={styles.groupWrap}>
          {groups.map((g) => (
            <div key={g.key} className={styles.catGroup}>
              {renderGroupHeader(g)}
              {viewMode === "list" ? (
                <div className={styles.list}>{g.riders.map(renderRow)}</div>
              ) : (
                <div className={styles.cardGrid}>{g.riders.map(renderCard)}</div>
              )}
            </div>
          ))}
        </div>
      ) : viewMode === "list" ? (
        <div className={styles.list}>{displayed.map(renderRow)}</div>
      ) : (
        <div className={styles.cardGrid}>{displayed.map(renderCard)}</div>
      )}

      <button className={styles.addBtn} onClick={() => setShowAdd((v) => !v)}>
        {showAdd ? "− Close" : "+ Quick Add Rider"}
      </button>

      {showAdd && (
        <QuickAddRider
          raceUuid={raceUuid}
          waveNum={waveNum}
          categories={categories}
          onDone={() => setShowAdd(false)}
        />
      )}

      {selectedRider && <StatusModal rider={selectedRider} onStatusChange={handleStatusChange} />}
    </div>
  );
};

export default CheckIn;
