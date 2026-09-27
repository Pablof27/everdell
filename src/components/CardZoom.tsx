import * as React from "react";
import { createPortal } from "react-dom";

import styles from "../styles/CardZoom.module.css";

// Hover-to-inspect: shows an enlarged version of a board element next to it.

type ZoomState = { rect: DOMRect; content: React.ReactNode } | null;

const ZoomContext = React.createContext<(state: ZoomState) => void>(() => {
  return;
});

const ZoomOverlay: React.FC<{ rect: DOMRect; content: React.ReactNode }> = ({
  rect,
  content,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(
    null
  );
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const gap = 14;
    const margin = 8;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right + gap;
    if (left + width > vw - margin) {
      left = rect.left - gap - width;
    }
    if (left < margin) {
      left = Math.max(
        margin,
        Math.min(vw - width - margin, rect.left + rect.width / 2 - width / 2)
      );
    }
    const top = Math.max(
      margin,
      Math.min(vh - height - margin, rect.top + rect.height / 2 - height / 2)
    );
    setPos({ left, top });
  }, [rect]);
  return createPortal(
    <div
      ref={ref}
      className={styles.zoom}
      style={
        pos
          ? { left: pos.left, top: pos.top }
          : { left: 0, top: 0, visibility: "hidden" }
      }
      aria-hidden={true}
    >
      {content}
    </div>,
    document.body
  );
};

export const ZoomProvider: React.FC = ({ children }) => {
  const [state, setState] = React.useState<ZoomState>(null);
  React.useEffect(() => {
    if (!state) {
      return;
    }
    const hide = () => setState(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [state]);
  return (
    <ZoomContext.Provider value={setState}>
      {children}
      {state && <ZoomOverlay rect={state.rect} content={state.content} />}
    </ZoomContext.Provider>
  );
};

export const Zoomable: React.FC<{
  render: () => React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({ render, className, disabled = false, children }) => {
  const show = React.useContext(ZoomContext);
  const timer = React.useRef<number | null>(null);
  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  React.useEffect(() => clear, []);
  if (disabled) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div
      className={className}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        clear();
        timer.current = window.setTimeout(() => {
          show({ rect: el.getBoundingClientRect(), content: render() });
        }, 450);
      }}
      onMouseLeave={() => {
        clear();
        show(null);
      }}
      onMouseDown={() => {
        clear();
        show(null);
      }}
    >
      {children}
    </div>
  );
};
