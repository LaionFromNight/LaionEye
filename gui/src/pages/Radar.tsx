import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@mui/material";
import {
  Add,
  Close,
  FilterAltOutlined,
  Fullscreen,
  FullscreenExit,
  Group,
  Launch,
  MyLocation,
  Remove,
  Settings,
  SwapHoriz,
  TravelExplore,
  WarningAmber,
} from "@mui/icons-material";
import app from "../App.module.css";
import styles from "./Radar.module.css";
import { Player, WorldContext } from "../providers/WorldProvider";
import RadarRendering from "../utils/rendering";

type PlayerRelation = "enemy" | "alliance" | "guild";
type PlayerWithRelation = Player & { relation: PlayerRelation };
type AlbionMapEntry = {
  map_name?: string;
  redirect_url?: string;
};
type PersistedRadarPreferences = {
  zoom?: number;
  displayedSettings?: unknown;
  mapSide?: unknown;
};

const OBJECT_TYPE_OPTIONS = ["RESOURCE", "DUNGEONS", "MOBS"] as const;
const DUNGEON_OPTIONS = [
  "SOLO",
  "AVALON",
  "GROUP",
  "CORRUPTED",
  "HELLGATE",
  "ROAMING",
  "DISPLAY_NAME",
] as const;

const DEFAULT_DISPLAYED_SETTINGS = {
  object_types: ["RESOURCE", "DUNGEONS", "MOBS"],
  dungeons: [
    "SOLO",
    "AVALON",
    "GROUP",
    "CORRUPTED",
    "HELLGATE",
    "ROAMING",
    "DISPLAY_NAME",
  ],
  players_factions: {
    0: {
      label: "NonPvP",
      value: true,
    },
    1: {
      label: "Martlock",
      value: true,
    },
    2: {
      label: "Lymhurst",
      value: true,
    },
    3: {
      label: "Bridgewatch",
      value: true,
    },
    4: {
      label: "Fort Sterling",
      value: true,
    },
    5: {
      label: "Thetford",
      value: true,
    },
    6: {
      label: "Caerleon",
      value: true,
    },
    255: {
      label: "PvP",
      value: true,
    },
  },
  resources: {
    FIBER: [
      { label: "fiber_2_0", value: true, tier: 2, enchant: 0 },
      { label: "fiber_3_0", value: true, tier: 3, enchant: 0 },
      { label: "fiber_4_0", value: true, tier: 4, enchant: 0 },
      { label: "fiber_4_1", value: true, tier: 4, enchant: 1 },
      { label: "fiber_4_2", value: true, tier: 4, enchant: 2 },
      { label: "fiber_4_3", value: true, tier: 4, enchant: 3 },
      { label: "fiber_4_4", value: true, tier: 4, enchant: 3 },
      { label: "fiber_5_0", value: true, tier: 5, enchant: 0 },
      { label: "fiber_5_1", value: true, tier: 5, enchant: 1 },
      { label: "fiber_5_2", value: true, tier: 5, enchant: 2 },
      { label: "fiber_5_3", value: true, tier: 5, enchant: 3 },
      { label: "fiber_5_4", value: true, tier: 5, enchant: 3 },
      { label: "fiber_6_0", value: true, tier: 6, enchant: 0 },
      { label: "fiber_6_1", value: true, tier: 6, enchant: 1 },
      { label: "fiber_6_2", value: true, tier: 6, enchant: 2 },
      { label: "fiber_6_3", value: true, tier: 6, enchant: 3 },
      { label: "fiber_6_4", value: true, tier: 6, enchant: 3 },
      { label: "fiber_7_0", value: true, tier: 7, enchant: 0 },
      { label: "fiber_7_1", value: true, tier: 7, enchant: 1 },
      { label: "fiber_7_2", value: true, tier: 7, enchant: 2 },
      { label: "fiber_7_3", value: true, tier: 7, enchant: 3 },
      { label: "fiber_7_4", value: true, tier: 7, enchant: 3 },
      { label: "fiber_8_0", value: true, tier: 8, enchant: 0 },
      { label: "fiber_8_1", value: true, tier: 8, enchant: 1 },
      { label: "fiber_8_2", value: true, tier: 8, enchant: 2 },
      { label: "fiber_8_3", value: true, tier: 8, enchant: 3 },
      { label: "fiber_8_4", value: true, tier: 8, enchant: 3 },
    ],
    WOOD: [
      { label: "wood_2_0", value: true, tier: 2, enchant: 0 },
      { label: "wood_3_0", value: true, tier: 3, enchant: 0 },
      { label: "wood_4_0", value: true, tier: 4, enchant: 0 },
      { label: "wood_4_1", value: true, tier: 4, enchant: 1 },
      { label: "wood_4_2", value: true, tier: 4, enchant: 2 },
      { label: "wood_4_3", value: true, tier: 4, enchant: 3 },
      { label: "wood_4_4", value: true, tier: 4, enchant: 3 },
      { label: "wood_5_0", value: true, tier: 5, enchant: 0 },
      { label: "wood_5_1", value: true, tier: 5, enchant: 1 },
      { label: "wood_5_2", value: true, tier: 5, enchant: 2 },
      { label: "wood_5_3", value: true, tier: 5, enchant: 3 },
      { label: "wood_5_4", value: true, tier: 5, enchant: 3 },
      { label: "wood_6_0", value: true, tier: 6, enchant: 0 },
      { label: "wood_6_1", value: true, tier: 6, enchant: 1 },
      { label: "wood_6_2", value: true, tier: 6, enchant: 2 },
      { label: "wood_6_3", value: true, tier: 6, enchant: 3 },
      { label: "wood_6_4", value: true, tier: 6, enchant: 3 },
      { label: "wood_7_0", value: true, tier: 7, enchant: 0 },
      { label: "wood_7_1", value: true, tier: 7, enchant: 1 },
      { label: "wood_7_2", value: true, tier: 7, enchant: 2 },
      { label: "wood_7_3", value: true, tier: 7, enchant: 3 },
      { label: "wood_7_4", value: true, tier: 7, enchant: 3 },
      { label: "wood_8_0", value: true, tier: 8, enchant: 0 },
      { label: "wood_8_1", value: true, tier: 8, enchant: 1 },
      { label: "wood_8_2", value: true, tier: 8, enchant: 2 },
      { label: "wood_8_3", value: true, tier: 8, enchant: 3 },
      { label: "wood_8_4", value: true, tier: 8, enchant: 3 },
    ],
    ROCK: [
      { label: "rock_2_0", value: true, tier: 2, enchant: 0 },
      { label: "rock_3_0", value: true, tier: 3, enchant: 0 },
      { label: "rock_4_0", value: true, tier: 4, enchant: 0 },
      { label: "rock_4_1", value: true, tier: 4, enchant: 1 },
      { label: "rock_4_2", value: true, tier: 4, enchant: 2 },
      { label: "rock_4_3", value: true, tier: 4, enchant: 3 },
      { label: "rock_4_4", value: true, tier: 4, enchant: 3 },
      { label: "rock_5_0", value: true, tier: 5, enchant: 0 },
      { label: "rock_5_1", value: true, tier: 5, enchant: 1 },
      { label: "rock_5_2", value: true, tier: 5, enchant: 2 },
      { label: "rock_5_3", value: true, tier: 5, enchant: 3 },
      { label: "rock_5_4", value: true, tier: 5, enchant: 3 },
      { label: "rock_6_0", value: true, tier: 6, enchant: 0 },
      { label: "rock_6_1", value: true, tier: 6, enchant: 1 },
      { label: "rock_6_2", value: true, tier: 6, enchant: 2 },
      { label: "rock_6_3", value: true, tier: 6, enchant: 3 },
      { label: "rock_6_4", value: true, tier: 6, enchant: 3 },
      { label: "rock_7_0", value: true, tier: 7, enchant: 0 },
      { label: "rock_7_1", value: true, tier: 7, enchant: 1 },
      { label: "rock_7_2", value: true, tier: 7, enchant: 2 },
      { label: "rock_7_3", value: true, tier: 7, enchant: 3 },
      { label: "rock_7_4", value: true, tier: 7, enchant: 3 },
      { label: "rock_8_0", value: true, tier: 8, enchant: 0 },
      { label: "rock_8_1", value: true, tier: 8, enchant: 1 },
      { label: "rock_8_2", value: true, tier: 8, enchant: 2 },
      { label: "rock_8_3", value: true, tier: 8, enchant: 3 },
      { label: "rock_8_4", value: true, tier: 8, enchant: 3 },
    ],
    HIDE: [
      { label: "hide_2_0", value: true, tier: 2, enchant: 0 },
      { label: "hide_3_0", value: true, tier: 3, enchant: 0 },
      { label: "hide_4_0", value: true, tier: 4, enchant: 0 },
      { label: "hide_4_1", value: true, tier: 4, enchant: 1 },
      { label: "hide_4_2", value: true, tier: 4, enchant: 2 },
      { label: "hide_4_3", value: true, tier: 4, enchant: 3 },
      { label: "hide_4_4", value: true, tier: 4, enchant: 3 },
      { label: "hide_5_0", value: true, tier: 5, enchant: 0 },
      { label: "hide_5_1", value: true, tier: 5, enchant: 1 },
      { label: "hide_5_2", value: true, tier: 5, enchant: 2 },
      { label: "hide_5_3", value: true, tier: 5, enchant: 3 },
      { label: "hide_5_4", value: true, tier: 5, enchant: 3 },
      { label: "hide_6_0", value: true, tier: 6, enchant: 0 },
      { label: "hide_6_1", value: true, tier: 6, enchant: 1 },
      { label: "hide_6_2", value: true, tier: 6, enchant: 2 },
      { label: "hide_6_3", value: true, tier: 6, enchant: 3 },
      { label: "hide_6_4", value: true, tier: 6, enchant: 3 },
      { label: "hide_7_0", value: true, tier: 7, enchant: 0 },
      { label: "hide_7_1", value: true, tier: 7, enchant: 1 },
      { label: "hide_7_2", value: true, tier: 7, enchant: 2 },
      { label: "hide_7_3", value: true, tier: 7, enchant: 3 },
      { label: "hide_7_4", value: true, tier: 7, enchant: 3 },
      { label: "hide_8_0", value: true, tier: 8, enchant: 0 },
      { label: "hide_8_1", value: true, tier: 8, enchant: 1 },
      { label: "hide_8_2", value: true, tier: 8, enchant: 2 },
      { label: "hide_8_3", value: true, tier: 8, enchant: 3 },
      { label: "hide_8_4", value: true, tier: 8, enchant: 3 },
    ],
    ORE: [
      { label: "ore_2_0", value: true, tier: 2, enchant: 0 },
      { label: "ore_3_0", value: true, tier: 3, enchant: 0 },
      { label: "ore_4_0", value: true, tier: 4, enchant: 0 },
      { label: "ore_4_1", value: true, tier: 4, enchant: 1 },
      { label: "ore_4_2", value: true, tier: 4, enchant: 2 },
      { label: "ore_4_3", value: true, tier: 4, enchant: 3 },
      { label: "ore_4_4", value: true, tier: 4, enchant: 3 },
      { label: "ore_5_0", value: true, tier: 5, enchant: 0 },
      { label: "ore_5_1", value: true, tier: 5, enchant: 1 },
      { label: "ore_5_2", value: true, tier: 5, enchant: 2 },
      { label: "ore_5_3", value: true, tier: 5, enchant: 3 },
      { label: "ore_5_4", value: true, tier: 5, enchant: 3 },
      { label: "ore_6_0", value: true, tier: 6, enchant: 0 },
      { label: "ore_6_1", value: true, tier: 6, enchant: 1 },
      { label: "ore_6_2", value: true, tier: 6, enchant: 2 },
      { label: "ore_6_3", value: true, tier: 6, enchant: 3 },
      { label: "ore_6_4", value: true, tier: 6, enchant: 3 },
      { label: "ore_7_0", value: true, tier: 7, enchant: 0 },
      { label: "ore_7_1", value: true, tier: 7, enchant: 1 },
      { label: "ore_7_2", value: true, tier: 7, enchant: 2 },
      { label: "ore_7_3", value: true, tier: 7, enchant: 3 },
      { label: "ore_7_4", value: true, tier: 7, enchant: 3 },
      { label: "ore_8_0", value: true, tier: 8, enchant: 0 },
      { label: "ore_8_1", value: true, tier: 8, enchant: 1 },
      { label: "ore_8_2", value: true, tier: 8, enchant: 2 },
      { label: "ore_8_3", value: true, tier: 8, enchant: 3 },
      { label: "ore_8_4", value: true, tier: 8, enchant: 3 },
    ],
  },
};

type DisplayedSettings = typeof DEFAULT_DISPLAYED_SETTINGS;

const OBJECT_TYPE_LABELS: Record<(typeof OBJECT_TYPE_OPTIONS)[number], string> = {
  RESOURCE: "Resources",
  DUNGEONS: "Dungeons",
  MOBS: "Mobs",
};

const RESOURCE_ROWS = [
  {
    label: "T2-T3",
    matchesTier: (tier: number) => tier === 2 || tier === 3,
  },
  {
    label: "T4",
    matchesTier: (tier: number) => tier === 4,
  },
  {
    label: "T5",
    matchesTier: (tier: number) => tier === 5,
  },
  {
    label: "T6",
    matchesTier: (tier: number) => tier === 6,
  },
  {
    label: "T7",
    matchesTier: (tier: number) => tier === 7,
  },
  {
    label: "T8",
    matchesTier: (tier: number) => tier === 8,
  },
] as const;

const RADAR_PREFERENCES_STORAGE_KEY = "laioneye.radar.preferences";

const normalizeText = (value?: string | null) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const cloneDefaultDisplayedSettings = (): DisplayedSettings =>
  JSON.parse(JSON.stringify(DEFAULT_DISPLAYED_SETTINGS)) as DisplayedSettings;

const sanitizeDisplayedSettings = (input: unknown): DisplayedSettings => {
  const defaults = cloneDefaultDisplayedSettings();

  if (!input || typeof input !== "object") {
    return defaults;
  }

  const candidate = input as Partial<DisplayedSettings>;

  if (Array.isArray(candidate.object_types)) {
    const nextObjectTypes = candidate.object_types.filter(
      (value): value is DisplayedSettings["object_types"][number] =>
        OBJECT_TYPE_OPTIONS.includes(value as (typeof OBJECT_TYPE_OPTIONS)[number])
    );

    if (nextObjectTypes.length > 0) {
      defaults.object_types = nextObjectTypes;
    }
  }

  if (Array.isArray(candidate.dungeons)) {
    const nextDungeons = candidate.dungeons.filter(
      (value): value is DisplayedSettings["dungeons"][number] =>
        DUNGEON_OPTIONS.includes(value as (typeof DUNGEON_OPTIONS)[number])
    );

    if (nextDungeons.length > 0) {
      defaults.dungeons = nextDungeons;
    }
  }

  if (candidate.players_factions && typeof candidate.players_factions === "object") {
    const nextFactions = candidate.players_factions as Record<
      string,
      { value?: unknown }
    >;

    Object.keys(defaults.players_factions).forEach((key) => {
      const typedKey = Number(key) as keyof DisplayedSettings["players_factions"];
      const persistedEntry = nextFactions[String(key)];

      if (persistedEntry && typeof persistedEntry.value === "boolean") {
        defaults.players_factions[typedKey].value = persistedEntry.value;
      }
    });
  }

  if (candidate.resources && typeof candidate.resources === "object") {
    const nextResources = candidate.resources as Record<
      string,
      Array<{ label?: string; value?: unknown }>
    >;

    (
      Object.keys(defaults.resources) as Array<keyof DisplayedSettings["resources"]>
    ).forEach((resourceKey) => {
      const persistedEntries = nextResources[String(resourceKey)];
      if (!Array.isArray(persistedEntries)) {
        return;
      }

      const valueByLabel = new Map(
        persistedEntries
          .filter(
            (entry): entry is { label: string; value: boolean } =>
              typeof entry?.label === "string" && typeof entry?.value === "boolean"
          )
          .map((entry) => [entry.label, entry.value])
      );

      defaults.resources[resourceKey] = defaults.resources[resourceKey].map((entry) => ({
        ...entry,
        value: valueByLabel.get(entry.label) ?? entry.value,
      }));
    });
  }

  return defaults;
};

const loadPersistedRadarPreferences = (): {
  zoom: number;
  displayedSettings: DisplayedSettings;
  mapSide: "left" | "right";
} => {
  const defaults = {
    zoom: 3.5,
    displayedSettings: cloneDefaultDisplayedSettings(),
    mapSide: "left" as const,
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(RADAR_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as PersistedRadarPreferences;

    return {
      zoom:
        typeof parsed.zoom === "number" && parsed.zoom >= 1 && parsed.zoom <= 5
          ? parsed.zoom
          : defaults.zoom,
      displayedSettings: sanitizeDisplayedSettings(parsed.displayedSettings),
      mapSide: parsed.mapSide === "right" ? "right" : defaults.mapSide,
    };
  } catch {
    return defaults;
  }
};

const Radar = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [persistedPreferences] = useState(loadPersistedRadarPreferences);

  const { me, world, radarWidget, radarPosition } = useContext(WorldContext);
  const [zoom, setZoom] = useState(persistedPreferences.zoom);
  const [displayedSettings, setDisplayedSettings] = useState<DisplayedSettings>(
    persistedPreferences.displayedSettings
  );
  const [activeTab, setActiveTab] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapSide, setMapSide] = useState<"left" | "right">(persistedPreferences.mapSide);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [albionMapLinks, setAlbionMapLinks] = useState<Record<string, string>>({});

  const toggleFullscreen = () => setIsFullscreen((value) => !value);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      RADAR_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        zoom,
        displayedSettings,
        mapSide,
      })
    );
  }, [displayedSettings, mapSide, zoom]);

  useEffect(() => {
    let isMounted = true;

    fetch("/mapKeys/albion_maps.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load Albion map index");
        }
        return response.json() as Promise<AlbionMapEntry[]>;
      })
      .then((entries) => {
        if (!isMounted) {
          return;
        }

        const nextLinks = entries.reduce<Record<string, string>>((accumulator, entry) => {
          const mapName = normalizeText(entry.map_name);
          if (mapName && entry.redirect_url) {
            accumulator[mapName] = entry.redirect_url;
          }
          return accumulator;
        }, {});

        setAlbionMapLinks(nextLinks);
      })
      .catch(() => {
        if (isMounted) {
          setAlbionMapLinks({});
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const syncCanvasSize = () => {
      const rect = parent.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      if (width <= 0 || height <= 0) return;

      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      setCanvasSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    };

    syncCanvasSize();

    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(parent);
    window.addEventListener("resize", syncCanvasSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context || canvasSize.width === 0 || canvasSize.height === 0) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();

    radarWidget.harvestable_list.forEach((resource) => {
      RadarRendering.renderResource(
        context,
        canvas,
        radarPosition,
        resource,
        zoom,
        displayedSettings
      );
    });

    radarWidget.dungeon_list.forEach((dungeon) => {
      RadarRendering.renderDungeon(
        context,
        canvas,
        radarPosition,
        dungeon,
        zoom,
        displayedSettings
      );
    });

    radarWidget.chest_list.forEach((chest) => {
      RadarRendering.renderChest(
        context,
        canvas,
        radarPosition,
        chest,
        zoom,
        displayedSettings
      );
    });

    radarWidget.mist_list.forEach((mist) => {
      RadarRendering.renderMist(
        context,
        canvas,
        radarPosition,
        mist,
        zoom,
        displayedSettings
      );
    });

    radarWidget.mob_list.forEach((mob) => {
      RadarRendering.renderMob(
        context,
        canvas,
        radarPosition,
        { ...mob, tier: Number(mob.tier) },
        zoom,
        displayedSettings
      );
    });

    context.restore();
    RadarRendering.renderCenter(context, canvas);
    RadarRendering.renderTheScreenView(context, canvas, zoom);
  }, [
    canvasSize.height,
    canvasSize.width,
    displayedSettings,
    radarPosition,
    radarWidget,
    zoom,
  ]);

  const myGuildName = normalizeText(me?.guild);
  const myAllianceName = normalizeText(me?.alliance);
  const currentAlbionMapUrl = useMemo(
    () => albionMapLinks[normalizeText(world.map)],
    [albionMapLinks, world.map]
  );

  const {
    sortedPlayers,
    friendsCount,
    enemyCount,
    allianceCount,
    guildCount,
  } = useMemo(() => {
    const bucket = (player: Player) => {
      const playerGuild = normalizeText(player.guild);
      const playerAlliance = normalizeText(player.alliance);

      if (myGuildName && playerGuild && playerGuild === myGuildName) return 2;
      if (myAllianceName && playerAlliance && playerAlliance === myAllianceName) {
        return 1;
      }
      return 0;
    };

    const filteredPlayers = (radarWidget.players_list ?? []).filter((player) => {
      const factionKey =
        String(player.faction) as unknown as keyof DisplayedSettings["players_factions"];
      return displayedSettings.players_factions[factionKey]?.value ?? true;
    });

    let friendlyPlayers = 0;
    let hostilePlayers = 0;
    let alliancePlayers = 0;
    let guildPlayers = 0;

    const relationByPlayer = new Map<number, PlayerRelation>();

    filteredPlayers.forEach((player) => {
      const value = bucket(player);
      const relation =
        value === 2 ? "guild" : value === 1 ? "alliance" : "enemy";

      relationByPlayer.set(player.id, relation);

      if (relation === "enemy") hostilePlayers += 1;
      else friendlyPlayers += 1;

      if (relation === "alliance") alliancePlayers += 1;
      if (relation === "guild") guildPlayers += 1;
    });

    const sorted = filteredPlayers
      .slice()
      .sort((playerA, playerB) => {
        const bucketA = bucket(playerA);
        const bucketB = bucket(playerB);

        if (bucketA !== bucketB) return bucketA - bucketB;

        const factionA = Number(playerA.faction);
        const factionB = Number(playerB.faction);
        if (factionA !== factionB) return factionB - factionA;

        return String(playerA.username).localeCompare(String(playerB.username));
      })
      .map((player) => ({
        ...player,
        relation: relationByPlayer.get(player.id) ?? "enemy",
      })) as PlayerWithRelation[];

    return {
      sortedPlayers: sorted,
      friendsCount: friendlyPlayers,
      enemyCount: hostilePlayers,
      allianceCount: alliancePlayers,
      guildCount: guildPlayers,
    };
  }, [displayedSettings.players_factions, myAllianceName, myGuildName, radarWidget.players_list]);

  const settingsCounts = useMemo(() => {
    const enabledFactions = Object.values(displayedSettings.players_factions).filter(
      (entry) => entry.value
    ).length;
    const totalFactions = Object.keys(displayedSettings.players_factions).length;
    const resourceEntries = Object.values(displayedSettings.resources).flatMap(
      (entries) => entries
    );
    const enabledResources = resourceEntries.filter((entry) => entry.value).length;

    return {
      enabledFactions,
      totalFactions,
      enabledResources,
      totalResources: resourceEntries.length,
    };
  }, [displayedSettings.players_factions, displayedSettings.resources]);

  const objectMetrics = useMemo(
    () => [
      {
        label: "Resources",
        value: radarWidget.harvestable_list.length,
        enabled: displayedSettings.object_types.includes("RESOURCE"),
      },
      {
        label: "Dungeons",
        value: radarWidget.dungeon_list.length,
        enabled: displayedSettings.object_types.includes("DUNGEONS"),
      },
      {
        label: "Mobs",
        value: radarWidget.mob_list.length,
        enabled: displayedSettings.object_types.includes("MOBS"),
      },
      {
        label: "Chests",
        value: radarWidget.chest_list.length,
        enabled: true,
      },
      {
        label: "Mists",
        value: radarWidget.mist_list.length,
        enabled: true,
      },
    ],
    [
      displayedSettings.object_types,
      radarWidget.chest_list.length,
      radarWidget.dungeon_list.length,
      radarWidget.harvestable_list.length,
      radarWidget.mist_list.length,
      radarWidget.mob_list.length,
    ]
  );

  const heroStats = useMemo(
    () => [
      {
        icon: <Group fontSize="small" />,
        label: "Contacts",
        value: String(sortedPlayers.length),
        note:
          sortedPlayers.length > 0
            ? `${friendsCount} friendly contacts`
            : "No players detected",
      },
      {
        icon: <WarningAmber fontSize="small" />,
        label: "Threats",
        value: String(enemyCount),
        note: enemyCount > 0 ? "Hostiles in range" : "No hostiles flagged",
      },
      {
        icon: <TravelExplore fontSize="small" />,
        label: "Zone",
        value: world.map || "Unknown",
        note: world.isInDungeon ? "Dungeon sector" : "Open terrain",
        href: currentAlbionMapUrl,
      },
      {
        icon: <MyLocation fontSize="small" />,
        label: "Position",
        value: `${radarPosition.x.toFixed(0)} / ${radarPosition.y.toFixed(0)}`,
        note: `${zoom.toFixed(1)}x zoom`,
      },
    ],
    [
      currentAlbionMapUrl,
      enemyCount,
      friendsCount,
      radarPosition.x,
      radarPosition.y,
      sortedPlayers.length,
      world.isInDungeon,
      world.map,
      zoom,
    ]
  );

  const toggleObjectType = (type: (typeof OBJECT_TYPE_OPTIONS)[number]) => {
    setDisplayedSettings((previous) => ({
      ...previous,
      object_types: previous.object_types.includes(type)
        ? previous.object_types.filter((entry) => entry !== type)
        : [...previous.object_types, type],
    }));
  };

  const toggleDungeon = (dungeon: (typeof DUNGEON_OPTIONS)[number]) => {
    setDisplayedSettings((previous) => ({
      ...previous,
      dungeons: previous.dungeons.includes(dungeon)
        ? previous.dungeons.filter((entry) => entry !== dungeon)
        : [...previous.dungeons, dungeon],
    }));
  };

  const toggleFaction = (factionKey: string) => {
    setDisplayedSettings((previous) => {
      const faction =
        factionKey as unknown as keyof DisplayedSettings["players_factions"];

      return {
        ...previous,
        players_factions: {
          ...previous.players_factions,
          [faction]: {
            ...previous.players_factions[faction],
            value: !previous.players_factions[faction].value,
          },
        },
      };
    });
  };

  const setAllResourcesOfType = (resourceKey: string, value: boolean) => {
    setDisplayedSettings((previous) => {
      const current =
        previous.resources[
          resourceKey as keyof DisplayedSettings["resources"]
        ] ?? [];

      return {
        ...previous,
        resources: {
          ...previous.resources,
          [resourceKey]: current.map((entry) => ({ ...entry, value })),
        },
      };
    });
  };

  const toggleResourceEntry = (resourceKey: string, index: number) => {
    setDisplayedSettings((previous) => {
      const current =
        previous.resources[
          resourceKey as keyof DisplayedSettings["resources"]
        ] ?? [];

      return {
        ...previous,
        resources: {
          ...previous.resources,
          [resourceKey]: current.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, value: !entry.value } : entry
          ),
        },
      };
    });
  };

  const setHighResourcesOfType = (resourceKey: string) => {
    setDisplayedSettings((previous) => {
      const current =
        previous.resources[
          resourceKey as keyof DisplayedSettings["resources"]
        ] ?? [];

      return {
        ...previous,
        resources: {
          ...previous.resources,
          [resourceKey]: current.map((entry) => ({
            ...entry,
            value: /_(2|3)$/.test(entry.label),
          })),
        },
      };
    });
  };

  const getResourceRows = (
    entries: DisplayedSettings["resources"][keyof DisplayedSettings["resources"]]
  ) =>
    RESOURCE_ROWS.map((row) => ({
      label: row.label,
      entries: entries
        .map((entry, index) => ({ ...entry, index }))
        .filter((entry) => row.matchesTier(entry.tier))
        .sort((left, right) => {
          if (left.tier !== right.tier) return left.tier - right.tier;
          return left.enchant - right.enchant;
        }),
    })).filter((row) => row.entries.length > 0);

  const listedPlayers = isFullscreen
    ? sortedPlayers.filter((player) => player.relation === "enemy")
    : sortedPlayers;
  const hostilePlayers = sortedPlayers.filter((player) => player.relation === "enemy");

  const playerSummaryCards = isFullscreen
    ? [{ label: "Enemies", value: enemyCount }]
    : [
        { label: "Enemies", value: enemyCount },
        { label: "Friendly", value: friendsCount },
        { label: "Guild", value: guildCount },
        { label: "Alliance", value: allianceCount },
      ];

  const getGuildBadgeTone = (player: PlayerWithRelation) => {
    const playerGuildName = normalizeText(player.guild);
    return myGuildName && playerGuildName && playerGuildName === myGuildName
      ? "guild"
      : "hostile";
  };

  const getAllianceBadgeTone = (player: PlayerWithRelation) => {
    const playerAllianceName = normalizeText(player.alliance);
    return myAllianceName &&
      playerAllianceName &&
      playerAllianceName === myAllianceName
      ? "alliance"
      : "hostile";
  };

  const radarThreatLevel = useMemo(() => {
    if (hostilePlayers.some((player) => !player.isMounted)) {
      return "dismounted";
    }

    if (hostilePlayers.some((player) => player.isMounted)) {
      return "mounted";
    }

    return "clear";
  }, [hostilePlayers]);

  const openExternalUrl = (url?: string | null) => {
    const normalizedUrl = url?.trim();
    if (!normalizedUrl) return;

    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
  };

  const openKillboardSearch = (query?: string | null) => {
    const normalizedQuery = query?.trim();
    if (!normalizedQuery) return;

    const url = `https://albiononline.com/killboard/search?q=${encodeURIComponent(
      normalizedQuery
    )}`;
    openExternalUrl(url);
  };

  const radarPanel = (
    <div className={`${styles.panel} ${styles.radarPanel}`}>
      {!isFullscreen && (
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleWrap}>
            <span className={styles.eyebrow}>Tactical feed</span>
            <h2 className={styles.panelTitle}>Scene overview</h2>
            <p className={styles.panelSubtitle}>
              Canvas jest skalowany responsywnie i zachowuje ten sam punkt
              odniesienia niezależnie od trybu.
            </p>
          </div>

          <div className={styles.liveBadgeRow}>
            <span className={styles.liveBadge}>
              <FilterAltOutlined fontSize="inherit" />
              {displayedSettings.object_types.length}/3 layers
            </span>
            <span className={styles.liveBadge}>
              {enemyCount} hostile{enemyCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      <div
        className={styles.canvasFrame}
        data-threat-level={radarThreatLevel}
      >
        {!isFullscreen && (
          <div className={styles.canvasHudTop}>
            <div className={styles.hudCluster}>
              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>Center</span>
                <span className={styles.hudValue}>You</span>
              </div>
              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>Visible players</span>
                <span className={styles.hudValue}>{sortedPlayers.length}</span>
              </div>
            </div>

            <div className={styles.hudCluster}>
              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>Coordinates</span>
                <span className={styles.hudValue}>
                  {radarPosition.x.toFixed(1)} / {radarPosition.y.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className={styles.canvasElement} />

        {!isFullscreen && (
          <div className={styles.canvasHudBottom}>
            <div className={styles.hudCluster}>
              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>World state</span>
                <span className={styles.hudValue}>
                  {world.isInDungeon ? "Dungeon traffic" : "Surface patrol"}
                </span>
              </div>
            </div>

            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.enemyDot}`} />
                Threat
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.friendlyDot}`} />
                Alliance
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.guildDot}`} />
                Guild
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.controlsDock}>
        <div className={styles.controls}>
          {!isFullscreen && (
            <div className={styles.metricStrip}>
              {objectMetrics.map((metric) => (
                <div
                  className={styles.metricCard}
                  data-enabled={metric.enabled ? "true" : "false"}
                  key={metric.label}
                >
                  <span className={styles.metricLabel}>{metric.label}</span>
                  <span className={styles.metricValue}>{metric.value}</span>
                  <span className={styles.metricNote}>
                    {metric.enabled ? "Visible on radar" : "Temporarily hidden"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actionStrip}>
            {isFullscreen && (
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() =>
                  setMapSide((value) => (value === "left" ? "right" : "left"))
                }
              >
                <SwapHoriz fontSize="small" />
                {mapSide === "left" ? "Map right" : "Map left"}
              </button>
            )}

            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => setActiveTab("settings")}
            >
              <Settings fontSize="small" />
              Filters
            </button>

            <div className={styles.zoomControl}>
              <button
                type="button"
                aria-label="Decrease zoom"
                className={styles.zoomStep}
                onClick={() => setZoom((value) => Math.max(value - 0.2, 1))}
              >
                <Remove fontSize="small" />
              </button>
              <span className={styles.zoomValue}>{zoom.toFixed(1)}x</span>
              <button
                type="button"
                aria-label="Increase zoom"
                className={styles.zoomStep}
                onClick={() => setZoom((value) => Math.min(value + 0.2, 5))}
              >
                <Add fontSize="small" />
              </button>
            </div>

            <button
              type="button"
              className={styles.secondaryAction}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <FullscreenExit fontSize="small" />
              ) : (
                <Fullscreen fontSize="small" />
              )}
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>
        </div>

        {!isFullscreen && (
          <div className={styles.filterPreviewRow}>
            {OBJECT_TYPE_OPTIONS.map((type) => (
              <span
                className={styles.filterPreview}
                data-active={
                  displayedSettings.object_types.includes(type) ? "true" : "false"
                }
                key={type}
              >
                {OBJECT_TYPE_LABELS[type]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const playersPanel = (
    <aside className={`${styles.panel} ${styles.playersPanel}`}>
      <div className={styles.playersHeader}>
        <div className={styles.panelTitleWrap}>
          <span className={styles.eyebrow}>
            {isFullscreen ? "Hostile contacts" : "Nearby contacts"}
          </span>
          <h2 className={styles.panelTitle}>
            {isFullscreen ? "Enemy list" : "Player intelligence"}
          </h2>
          <p className={styles.panelSubtitle}>
            {isFullscreen
              ? "Scroll działa lokalnie tylko w tej liście."
              : "Wrogowie są zawsze wyżej, potem sojusz, na końcu gildia."}
          </p>
        </div>

        <div className={styles.playersSummary}>
          {playerSummaryCards.map((card) => (
            <div className={styles.summaryCard} key={card.label}>
              <span className={styles.summaryLabel}>{card.label}</span>
              <span className={styles.summaryValue}>{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.playersList}>
        {listedPlayers.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>
              {isFullscreen ? "No enemies detected" : "No players detected"}
            </div>
            <p>
              {isFullscreen
                ? "Radar nie widzi teraz żadnych wrogów albo są odfiltrowani."
                : "Radar nie widzi teraz żadnych kontaktów albo wszystkie są odfiltrowane."}
            </p>
          </div>
        ) : (
          listedPlayers.map((player) => (
            <article
              className={styles.playerCard}
              data-relation={player.relation}
              key={player.id}
            >
              <div className={styles.playerTopRow}>
                <div className={styles.playerIdentity}>
                  <div className={styles.factionIconWrap}>
                    <img
                      className={styles.factionIcon}
                      src={`/mapMarker/faction/faction_${player.faction}.png`}
                      alt={`Faction ${player.faction}`}
                    />
                  </div>

                  <div className={styles.playerText}>
                    <div className={styles.playerNameRow}>
                      <button
                        type="button"
                        className={styles.playerNameButton}
                        onClick={() => openKillboardSearch(player.username)}
                        title={`Search ${player.username}`}
                      >
                        <span className={styles.playerName}>{player.username}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.badgeRow}>
                <button
                  type="button"
                  className={styles.playerPill}
                  data-tone={getGuildBadgeTone(player)}
                  data-empty={player.guild ? "false" : "true"}
                  title={player.guild || "No guild"}
                  onClick={() => openKillboardSearch(player.guild)}
                  disabled={!player.guild}
                >
                  {player.guild || " "}
                </button>
                <button
                  type="button"
                  className={styles.playerPill}
                  data-tone={getAllianceBadgeTone(player)}
                  data-empty={player.alliance ? "false" : "true"}
                  title={player.alliance || "No alliance"}
                  onClick={() => openKillboardSearch(player.alliance)}
                  disabled={!player.alliance}
                >
                  {player.alliance || " "}
                </button>
              </div>

              <div className={styles.statusRow}>
                <span
                  className={styles.playerPill}
                  data-tone={player.isMounted ? "mounted" : "dismounted"}
                >
                  {player.isMounted ? "Mounted" : "Dismounted"}
                </span>
              </div>

              <div className={styles.equipmentGrid}>
                {(player.equipments ?? []).map((equipment, index) =>
                  equipment === "None" ? (
                    <div className={styles.equipmentSlot} key={index}>
                      <span className={styles.equipmentPlaceholder}>Empty</span>
                    </div>
                  ) : (
                    <div className={styles.equipmentSlot} key={index}>
                      <img
                        src={`https://render.albiononline.com/v1/item/${equipment}`}
                        alt={equipment}
                        title={equipment}
                      />
                    </div>
                  )
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );

  return (
    <div
      className={`${app.container} ${styles.page}`}
      data-fullscreen={isFullscreen ? "true" : "false"}
    >
      <div className={styles.pageInner}>
        {!isFullscreen && (
          <section className={`${styles.panel} ${styles.heroPanel}`}>
            <div className={styles.heroGrid}>
              <div className={styles.heroMain}>
                <span className={styles.eyebrow}>Live reconnaissance</span>
                <div className={styles.heroTitleRow}>
                  <h1 className={styles.heroTitle}>Radar</h1>
                  <span
                    className={styles.statusPill}
                    data-tone={world.isInDungeon ? "warning" : "calm"}
                  >
                    {world.isInDungeon ? "Dungeon zone" : "Open world"}
                  </span>
                </div>
                <p className={styles.heroSubtitle}>
                  Czytelniejszy podgląd pobliskich graczy, zasobów i wejść. Ten
                  widok skupia się wyłącznie na szybkim odczycie sytuacji.
                </p>

                <div className={styles.identityStrip}>
                  <div className={styles.identityCard}>
                    <span className={styles.identityLabel}>User</span>
                    <span className={styles.identityValue}>{me.username}</span>
                  </div>
                  <div className={styles.identityCard}>
                    <span className={styles.identityLabel}>Guild</span>
                    <span className={styles.identityValue}>
                      {me.guild || "No guild"}
                    </span>
                  </div>
                  <div className={styles.identityCard}>
                    <span className={styles.identityLabel}>Alliance</span>
                    <span className={styles.identityValue}>
                      {me.alliance || "No alliance"}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.statGrid}>
                {heroStats.map((stat) => (
                  <div
                    className={styles.statCard}
                    data-actionable={stat.href ? "true" : "false"}
                    key={stat.label}
                  >
                    <div className={styles.statIconRow}>
                      <span className={styles.statLabel}>{stat.label}</span>
                      <div className={styles.statIconActions}>
                        {stat.href && (
                          <button
                            type="button"
                            className={styles.statAction}
                            onClick={() => openExternalUrl(stat.href)}
                            title={`Open ${stat.value} map reference`}
                          >
                            <Launch fontSize="small" />
                          </button>
                        )}
                        {stat.icon}
                      </div>
                    </div>
                    {stat.href ? (
                      <button
                        type="button"
                        className={styles.statLinkButton}
                        onClick={() => openExternalUrl(stat.href)}
                        title={`Open ${stat.value} map reference`}
                      >
                        <span className={styles.statValue}>{stat.value}</span>
                        <span className={styles.statNote}>{stat.note}</span>
                        <span className={styles.statLinkMeta}>Open zone reference</span>
                      </button>
                    ) : (
                      <>
                        <span className={styles.statValue}>{stat.value}</span>
                        <span className={styles.statNote}>{stat.note}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section
          className={styles.workspace}
          data-map-side={mapSide}
          data-fullscreen={isFullscreen ? "true" : "false"}
        >
          {isFullscreen && mapSide === "right" ? (
            <>
              {playersPanel}
              {radarPanel}
            </>
          ) : (
            <>
              {radarPanel}
              {playersPanel}
            </>
          )}
        </section>
      </div>

      <Modal open={activeTab === "settings"} onClose={() => setActiveTab("")}>
        <div className={styles.settingsModal}>
          <div className={styles.settingsHeader}>
            <div>
              <span className={styles.eyebrow}>Visibility controls</span>
              <h2 className={styles.settingsTitle}>Radar filters</h2>
              <p className={styles.settingsDescription}>
                Steruj tym, co ma zostać widoczne na radarze bez przeładowania
                całego widoku.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close settings"
              className={styles.iconAction}
              onClick={() => setActiveTab("")}
            >
              <Close fontSize="small" />
            </button>
          </div>

          <div className={styles.settingsBody}>
            <section className={styles.settingsSection}>
              <div className={styles.settingsSectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Object layers</h3>
                  <p className={styles.sectionDescription}>
                    Włączaj lub ukrywaj główne warstwy na canvasie.
                  </p>
                </div>
              </div>

              <div className={styles.toggleWrap}>
                {OBJECT_TYPE_OPTIONS.map((type) => (
                  <button
                    type="button"
                    className={styles.filterButton}
                    data-active={
                      displayedSettings.object_types.includes(type)
                        ? "true"
                        : "false"
                    }
                    key={type}
                    onClick={() => toggleObjectType(type)}
                  >
                    {OBJECT_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.settingsSection}>
              <div className={styles.settingsSectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Faction visibility</h3>
                  <p className={styles.sectionDescription}>
                    Odfiltruj frakcje, których nie chcesz widzieć w panelu
                    graczy.
                  </p>
                </div>
              </div>

              <div className={styles.toggleWrap}>
                {Object.entries(displayedSettings.players_factions).map(
                  ([factionKey, faction]) => (
                    <button
                      type="button"
                      className={styles.filterButton}
                      data-active={faction.value ? "true" : "false"}
                      key={factionKey}
                      onClick={() => toggleFaction(factionKey)}
                    >
                      {faction.label}
                    </button>
                  )
                )}
              </div>
            </section>

            <section className={styles.settingsSection}>
              <div className={styles.settingsSectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Dungeon markers</h3>
                  <p className={styles.sectionDescription}>
                    Wybierz które typy wejść i etykiet mają być aktywne.
                  </p>
                </div>
              </div>

              <div className={styles.toggleWrap}>
                {DUNGEON_OPTIONS.map((dungeon) => (
                  <button
                    type="button"
                    className={styles.filterButton}
                    data-active={
                      displayedSettings.dungeons.includes(dungeon)
                        ? "true"
                        : "false"
                    }
                    key={dungeon}
                    onClick={() => toggleDungeon(dungeon)}
                  >
                    {dungeon}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.settingsSection}>
              <div className={styles.settingsSectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Resource nodes</h3>
                  <p className={styles.sectionDescription}>
                    Precyzyjna kontrola tierów i enchantów dla każdego typu
                    zasobu.
                  </p>
                </div>
              </div>

              {Object.entries(displayedSettings.resources).map(
                ([resourceKey, entries]) => (
                  <div className={styles.resourceCard} key={resourceKey}>
                    <div className={styles.resourceCardHeader}>
                      <div>
                        <h4 className={styles.resourceTitle}>{resourceKey}</h4>
                        <p className={styles.resourceDescription}>
                          Szybkie włączanie całego typu albo pojedynczych
                          wariantów.
                        </p>
                      </div>

                      <div className={styles.resourceActions}>
                        <button
                          type="button"
                          className={styles.ghostAction}
                          onClick={() => setAllResourcesOfType(resourceKey, true)}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={styles.ghostAction}
                          onClick={() => setAllResourcesOfType(resourceKey, false)}
                        >
                          None
                        </button>
                        <button
                          type="button"
                          className={styles.ghostAction}
                          onClick={() => setHighResourcesOfType(resourceKey)}
                        >
                          High resources
                        </button>
                      </div>
                    </div>

                    <div className={styles.resourceRows}>
                      {getResourceRows(entries).map((row) => (
                        <div className={styles.resourceRow} key={`${resourceKey}-${row.label}`}>
                          <div className={styles.resourceRowLabel}>{row.label}</div>
                          <div className={styles.resourceRowItems}>
                            {row.entries.map((resource) => (
                              <button
                                type="button"
                                className={styles.resourceToggle}
                                data-active={resource.value ? "true" : "false"}
                                key={resource.label}
                                onClick={() =>
                                  toggleResourceEntry(resourceKey, resource.index)
                                }
                                title={`${resourceKey} T${resource.tier}.${resource.enchant}`}
                              >
                                <img
                                  src={`/mapMarker/resources/${resource.label}.png`}
                                  alt={resource.label}
                                />
                                <span>{`T${resource.tier}.${resource.enchant}`}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </section>
          </div>

          <div className={styles.settingsFooter}>
            <p className={styles.settingsFootnote}>
              {displayedSettings.object_types.length}/{OBJECT_TYPE_OPTIONS.length} layers,
              {" "}
              {settingsCounts.enabledFactions}/{settingsCounts.totalFactions} factions,
              {" "}
              {settingsCounts.enabledResources}/{settingsCounts.totalResources} resources enabled.
            </p>

            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => setActiveTab("")}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Radar;
