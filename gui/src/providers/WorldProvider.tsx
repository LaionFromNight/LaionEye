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
  tier: string;
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
  initWorld: (me: PlayerCharacter, world: World) => void;
  initPlayer: (me: PlayerCharacter) => void;
  updateHealthCheck: (healthCheck: HealthCheck) => void;
  updateLocation: (map: string, isInDungeon: boolean) => void;
  updateRadarWidget: (payload: RadarWidget) => void;
  updateRadarPosition: (x: number, y: number) => void;
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

  const initWorld = (me: PlayerCharacter, world: World) => {
    setMe({
      username: me.username,
      guild: me.guild,
      alliance: me.alliance,
    });
    setWorld({
      map: world.map,
      isInDungeon: world.isInDungeon,
    });
  };

  const initPlayer = (me: PlayerCharacter) => {
    setMe({
      username: me.username,
      guild: me.guild,
      alliance: me.alliance,
    });
  };

  const updateLocation = (map: string, isInDungeon: boolean) =>
    setWorld((prev) => ({
      ...prev,
      map,
      isInDungeon,
    }));

  const updateHealthCheck = (payload: HealthCheck) => {
    setHealthCheck(payload);
  };

  const updateRadarPosition = (x: number, y: number) => {
    setRadarPosition({
      x: x,
      y: y,
    });
  };

  const updateRadarWidget = (payload: RadarWidget) => {
    setRadarWidget(payload);
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
