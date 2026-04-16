import { useContext, useEffect } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import Navigation from "./components/Navigation";
import DSPMacro from "./pages/DSPMacro";
import Radar from "./pages/Radar";
import Recorder from "./pages/Recorder";
import app from "./App.module.css";
import WebsocketProvider, {
  WebsocketContext,
} from "./providers/WebsocketProvider";
import WorldProvider, { WorldContext } from "./providers/WorldProvider";

const App = () => {
  return (
    <WebsocketProvider>
      <WorldProvider>
        <Init>
          <Router />
        </Init>
      </WorldProvider>
    </WebsocketProvider>
  );
};

const Layout = () => {
  return (
    <div className={app.layoutShell}>
      <Navigation />
      <div className={app.layoutContent}>
        <Outlet />
      </div>
    </div>
  );
};

const Router = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          index: true,
          element: <Radar />,
        },
        {
          path: "/radar",
          element: <Radar />,
        },
        {
          path: "/dsp-macro",
          element: <DSPMacro />,
        },
        {
          path: "/recorder",
          element: <Recorder />,
        },
        {
          path: "/dps-marker",
          element: <Navigate replace to="/radar" />,
        },
      ],
    },
  ]);
  return <RouterProvider router={router} />;
};

const Init = ({ children }: { children: React.ReactNode }) => {
  const { lastMessage } = useContext(WebsocketContext);
  const {
    initPlayer,
    initWorld,
    updateHealthCheck,
    updateLocation,
    updateRadarPosition,
    updateRadarWidget,
  } = useContext(WorldContext);

  useEffect(() => {
    if (lastMessage === null) {
      return;
    }

    try {
      const ws_event = JSON.parse(lastMessage.data) as {
        type?: string;
        payload?: unknown;
      };
      const payload =
        typeof ws_event.payload === "object" && ws_event.payload !== null
          ? (ws_event.payload as Record<string, unknown>)
          : {};

      if (ws_event.type == "init_world") {
        initWorld(payload.me, payload.world);
      } else if (ws_event.type == "init_character") {
        initPlayer(payload);
      } else if (ws_event.type == "health_check") {
        updateHealthCheck(payload);
      } else if (ws_event.type == "update_location") {
        updateLocation(payload.map as string, payload.isInDungeon as boolean);
      } else if (ws_event.type == "radar_update") {
        updateRadarWidget(payload);
      } else if (ws_event.type == "radar_position_update") {
        updateRadarPosition(
          (payload.position as { x?: number; y?: number } | undefined)?.x as number,
          (payload.position as { x?: number; y?: number } | undefined)?.y as number
        );
      }
    } catch (error) {
      console.error("Failed to process websocket event", error, lastMessage.data);
    }
  }, [
    initPlayer,
    initWorld,
    lastMessage,
    updateHealthCheck,
    updateLocation,
    updateRadarPosition,
    updateRadarWidget,
  ]);

  return <>{children}</>;
};

export default App;
