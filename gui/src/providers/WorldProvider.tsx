import React, { useState } from "react";

type PlayerCharacter = {
  username: string;
  guild: string;
  alliance: string;
};

export type HarvestableObject = {
  id: number;
  type: number;
  tier: number;
  location: {
    x: number;
    y: number;
  };
  enchant: number;
  size: number;
  unique_name: string;
  item_type: string;
};

export type DungeonObject = {
  id: number;
  dungeon_type: string;
  tier: number;
  location: {
    x: number;
    y: number;
  };
  enchant: number;
  name: string;
  unique_name: string;
  is_consumable: boolean;
};

export type ChestObject = {
  id: number;
  location: {
    x: number;
    y: number;
  };
  name1: string;
  name2: string;
  chest_name: string;
  enchant: number;
  debug: any;
};

export type MistObject = {
  id: number;
  location: {
    x: number;
    y: number;
  };
  name: string;
  enchant: number;
};

export type MobObject = {
  id: number;
  type_id: number;
  location: {
    x: number;
    y: number;
  };
  health: {
    max: number;
    value: number;
  };
  unique_name: string;
  enchant: number;
  tier: number | string;
  mob_type: string;
  harvestable_type: string;
  rarity: number;
  mob_name: string;
  avatar: string;
  aggroradius: string;
};

export type Player = {
  id: number;
  username: string;
  guild: string;
  alliance: string;
  faction: string;
  speed: number;
  health: {
    max: number;
    value: number;
  };
  position: string;
  equipments: string[];
  spells: any[];
  location: {
    x: number;
    y: number;
  };
  isMounted: boolean;
};

export type RadarWidget = {
  harvestable_list: HarvestableObject[];
  dungeon_list: DungeonObject[];
  chest_list: ChestObject[];
  mist_list: MistObject[];
  mob_list: MobObject[];
  players_list: Player[];
};

export type RadarPosition = {
  x: number;
  y: number;
};

export type World = {
  map: string;
  isInDungeon: boolean;
};

type HealthCheck = {
  status: string;
  message: string;
};

type WorldContextData = {
  me: PlayerCharacter;
  world: World;
  healthCheck: HealthCheck;
  radarPosition: RadarPosition;
  radarWidget: RadarWidget;
  initWorld: (me: unknown, world: unknown) => void;
  initPlayer: (me: unknown) => void;
  updateHealthCheck: (healthCheck: unknown) => void;
  updateLocation: (map: unknown, isInDungeon: unknown) => void;
  updateRadarWidget: (payload: unknown) => void;
  updateRadarPosition: (x: unknown, y: unknown) => void;
};

export const WorldContext = React.createContext<WorldContextData>({
  me: {
    username: "Waiting for backend",
    guild: "Waiting for backend",
    alliance: "Waiting for backend",
  },
  world: {
    map: "None",
    isInDungeon: false,
  },
  healthCheck: {
    status: "failed",
    message: "Waiting for backend",
  },
  radarPosition: {
    x: 0,
    y: 0,
  },
  radarWidget: {
    harvestable_list: [],
    dungeon_list: [],
    chest_list: [],
    mist_list: [],
    mob_list: [],
    players_list: [],
  },
  initWorld: () => {},
  initPlayer: () => {},
  updateHealthCheck: () => {},
  updateLocation: () => {},
  updateRadarPosition: () => {},
  updateRadarWidget: () => {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const toStringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toBooleanValue = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const sanitizeLocation = (value: unknown) => {
  const location = isRecord(value) ? value : {};

  return {
    x: toFiniteNumber(location.x),
    y: toFiniteNumber(location.y),
  };
};

const sanitizeHealth = (value: unknown) => {
  const health = isRecord(value) ? value : {};

  return {
    max: toFiniteNumber(health.max),
    value: toFiniteNumber(health.value),
  };
};

const sanitizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const sanitizeUnknownArray = (value: unknown) => (Array.isArray(value) ? value : []);

const sanitizeHarvestableObject = (value: unknown): HarvestableObject => {
  const item = isRecord(value) ? value : {};

  return {
    id: toFiniteNumber(item.id),
    type: toFiniteNumber(item.type),
    tier: toFiniteNumber(item.tier),
    location: sanitizeLocation(item.location),
    enchant: toFiniteNumber(item.enchant),
    size: toFiniteNumber(item.size),
    unique_name: toStringValue(item.unique_name),
    item_type: toStringValue(item.item_type, "unknown"),
  };
};

const sanitizeDungeonObject = (value: unknown): DungeonObject => {
  const item = isRecord(value) ? value : {};

  return {
    id: toFiniteNumber(item.id),
    dungeon_type: toStringValue(item.dungeon_type),
    tier: toFiniteNumber(item.tier),
    location: sanitizeLocation(item.location),
    enchant: toFiniteNumber(item.enchant),
    name: toStringValue(item.name),
    unique_name: toStringValue(item.unique_name),
    is_consumable: toBooleanValue(item.is_consumable),
  };
};

const sanitizeChestObject = (value: unknown): ChestObject => {
  const item = isRecord(value) ? value : {};

  return {
    id: toFiniteNumber(item.id),
    location: sanitizeLocation(item.location),
    name1: toStringValue(item.name1),
    name2: toStringValue(item.name2),
    chest_name: toStringValue(item.chest_name),
    enchant: toFiniteNumber(item.enchant),
    debug: item.debug ?? null,
  };
};

const sanitizeMistObject = (value: unknown): MistObject => {
  const item = isRecord(value) ? value : {};

  return {
    id: toFiniteNumber(item.id),
    location: sanitizeLocation(item.location),
    name: toStringValue(item.name),
    enchant: toFiniteNumber(item.enchant),
  };
};

const sanitizeMobObject = (value: unknown): MobObject => {
  const item = isRecord(value) ? value : {};

  return {
    id: toFiniteNumber(item.id),
    type_id: toFiniteNumber(item.type_id),
    location: sanitizeLocation(item.location),
    health: sanitizeHealth(item.health),
    unique_name: toStringValue(item.unique_name),
    enchant: toFiniteNumber(item.enchant),
    tier: toFiniteNumber(item.tier),
    mob_type: toStringValue(item.mob_type),
    harvestable_type: toStringValue(item.harvestable_type),
    rarity: toFiniteNumber(item.rarity),
    mob_name: toStringValue(item.mob_name),
    avatar: toStringValue(item.avatar),
    aggroradius: toStringValue(item.aggroradius),
  };
};

const sanitizePlayer = (value: unknown): Player => {
  const item = isRecord(value) ? value : {};

  return {
    id: toFiniteNumber(item.id),
    username: toStringValue(item.username),
    guild: toStringValue(item.guild),
    alliance: toStringValue(item.alliance),
    faction: toStringValue(item.faction, String(toFiniteNumber(item.faction))),
    speed: toFiniteNumber(item.speed),
    health: sanitizeHealth(item.health),
    position: toStringValue(item.position),
    equipments: sanitizeStringArray(item.equipments),
    spells: sanitizeUnknownArray(item.spells),
    location: sanitizeLocation(item.location),
    isMounted: toBooleanValue(item.isMounted),
  };
};

const sanitizeRadarWidget = (payload: unknown): RadarWidget => {
  const value = isRecord(payload) ? payload : {};

  return {
    harvestable_list: Array.isArray(value.harvestable_list)
      ? value.harvestable_list.map(sanitizeHarvestableObject)
      : [],
    dungeon_list: Array.isArray(value.dungeon_list)
      ? value.dungeon_list.map(sanitizeDungeonObject)
      : [],
    chest_list: Array.isArray(value.chest_list)
      ? value.chest_list.map(sanitizeChestObject)
      : [],
    mist_list: Array.isArray(value.mist_list)
      ? value.mist_list.map(sanitizeMistObject)
      : [],
    mob_list: Array.isArray(value.mob_list)
      ? value.mob_list.map(sanitizeMobObject)
      : [],
    players_list: Array.isArray(value.players_list)
      ? value.players_list.map(sanitizePlayer)
      : [],
  };
};

const sanitizePlayerCharacter = (value: unknown): PlayerCharacter => {
  const item = isRecord(value) ? value : {};

  return {
    username: toStringValue(item.username, "Waiting for backend"),
    guild: toStringValue(item.guild, "Waiting for backend"),
    alliance: toStringValue(item.alliance, "Waiting for backend"),
  };
};

const sanitizeWorld = (value: unknown): World => {
  const item = isRecord(value) ? value : {};

  return {
    map: toStringValue(item.map, "None"),
    isInDungeon: toBooleanValue(item.isInDungeon),
  };
};

const sanitizeHealthCheck = (value: unknown): HealthCheck => {
  const item = isRecord(value) ? value : {};

  return {
    status: toStringValue(item.status, "failed"),
    message: toStringValue(item.message, "Waiting for backend"),
  };
};

type WorldProviderProps = {
  children: React.ReactNode;
};

const WorldProvider = ({ children }: WorldProviderProps) => {
  const [me, setMe] = useState<PlayerCharacter>({
    username: "Waiting for backend",
    guild: "Waiting for backend",
    alliance: "Waiting for backend",
  });

  const [radarPosition, setRadarPosition] = useState<RadarPosition>({
    x: 0,
    y: 0,
  });

  const [radarWidget, setRadarWidget] = useState<RadarWidget>({
    harvestable_list: [],
    dungeon_list: [],
    chest_list: [],
    mist_list: [],
    mob_list: [],
    players_list: [],
  });

  const [world, setWorld] = useState<World>({
    map: "None",
    isInDungeon: false,
  });

  const [healthCheck, setHealthCheck] = useState<HealthCheck>({
    status: "failed",
    message: "System Booting Up",
  });

  const initWorld = (me: unknown, world: unknown) => {
    setMe(sanitizePlayerCharacter(me));
    setWorld(sanitizeWorld(world));
  };

  const initPlayer = (me: unknown) => {
    setMe(sanitizePlayerCharacter(me));
  };

  const updateLocation = (map: unknown, isInDungeon: unknown) =>
    setWorld(sanitizeWorld({ map, isInDungeon }));

  const updateHealthCheck = (payload: unknown) => {
    setHealthCheck(sanitizeHealthCheck(payload));
  };

  const updateRadarPosition = (x: unknown, y: unknown) => {
    setRadarPosition({
      x: toFiniteNumber(x),
      y: toFiniteNumber(y),
    });
  };

  const updateRadarWidget = (payload: unknown) => {
    setRadarWidget(sanitizeRadarWidget(payload));
  };

  return (
    <WorldContext.Provider
      value={{
        me,
        world,
        healthCheck,
        radarPosition,
        radarWidget,
        initWorld,
        initPlayer,
        updateHealthCheck,
        updateLocation,
        updateRadarPosition,
        updateRadarWidget,
      }}
    >
      {children}
    </WorldContext.Provider>
  );
};

export default WorldProvider;
