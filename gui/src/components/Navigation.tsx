import classNames from "classnames";
import { Keyboard, Map, RadioButtonChecked, Sensors } from "@mui/icons-material";
import { useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WorldContext } from "../providers/WorldProvider";
import styles from "./Navigation.module.css";

const logoSrc = "/LaionEye.png";

const Navigation = () => {
  const links = [
    {
      pageName: "Radar",
      pageDescription: "Live reconnaissance",
      url: "/radar",
      icon: <Map fontSize="small" />,
    },
    {
      pageName: "DSP Macro",
      pageDescription: "Combat automation",
      url: "/dsp-macro",
      icon: <Keyboard fontSize="small" />,
    },
    {
      pageName: "Recorder",
      pageDescription: "Pattern capture",
      url: "/recorder",
      icon: <RadioButtonChecked fontSize="small" />,
    },
  ];

  const navigate = useNavigate();
  const location = useLocation();
  const { me, world, healthCheck } = useContext(WorldContext);

  const healthTone = healthCheck.status === "passed" ? "passed" : "failed";
  const healthLabel =
    healthCheck.status === "passed" ? "Telemetry online" : "Telemetry degraded";
  const healthMessage =
    healthCheck.status === "passed"
      ? "Packet stream nominal"
      : healthCheck.message || "Waiting for telemetry";

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarPanel}>
          <div className={styles.sidebarBrand}>
            <div className={styles.sidebarLogoFrame}>
              <img className={styles.sidebarLogo} src={logoSrc} alt="LaionEye logo" />
            </div>
            <div className={styles.sidebarBrandText}>
              <span className={styles.sidebarEyebrow}>Command deck</span>
              <span className={styles.sidebarTitle}>LaionEye</span>
            </div>
          </div>

          <nav className={styles.navList} aria-label="Primary">
            {links.map((link) => {
              const isActive =
                location.pathname === link.url ||
                (link.url === "/radar" && location.pathname === "/");

              return (
                <button
                  type="button"
                  key={link.url}
                  className={classNames(styles.navButton, {
                    [styles.navButtonActive]: isActive,
                  })}
                  onClick={() => navigate(link.url)}
                >
                  <span className={styles.navIconWrap}>{link.icon}</span>
                  <span className={styles.navTextWrap}>
                    <span className={styles.navLabel}>{link.pageName}</span>
                    <span className={styles.navCaption}>{link.pageDescription}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className={styles.sidebarFooter}>
            <span className={styles.sidebarFooterLabel}>Active feed</span>
            <span className={styles.sidebarFooterValue}>
              {world.isInDungeon ? "Dungeon pulse" : "Surface sweep"}
            </span>
          </div>
        </div>
      </aside>

      <header className={styles.header}>
        <div className={styles.brandPanel}>
          <div className={styles.logoFrame}>
            <img className={styles.logo} src={logoSrc} alt="LaionEye logo" />
          </div>

          <div className={styles.brandCopy}>
            <span className={styles.brandEyebrow}>Albion tactical overlay</span>
            <h1 className={styles.brandTitle}>LaionEye</h1>
            <p className={styles.brandSubtitle}>
              Radar, macro control i live telemetry w jednym command view.
            </p>
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Operator</span>
            <span className={styles.infoValue}>{me.username}</span>
            <span className={styles.infoNote}>
              {me.guild || "Independent"} {me.alliance ? `• ${me.alliance}` : ""}
            </span>
          </div>

          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Current zone</span>
            <span className={styles.infoValue}>{world.map}</span>
            <span className={styles.infoNote}>
              {world.isInDungeon ? "Dungeon sector" : "Open-world route"}
            </span>
          </div>

          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Runtime</span>
            <span className={styles.infoValue}>
              <Sensors fontSize="inherit" />
              {healthLabel}
            </span>
            <span className={styles.infoNote}>{healthMessage}</span>
          </div>
        </div>

        <div className={styles.healthPanel} data-tone={healthTone}>
          <span className={styles.healthDot} />
          <div className={styles.healthText}>
            <span className={styles.healthTitle}>
              {healthTone === "passed" ? "System stable" : "Attention required"}
            </span>
            <span className={styles.healthSubtitle}>{healthMessage}</span>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navigation;
