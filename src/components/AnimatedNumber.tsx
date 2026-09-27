import * as React from "react";

import styles from "../styles/AnimatedNumber.module.css";
import anim from "../styles/animations.module.css";

// A number that bumps and shows a floating +N / -N when it changes.
const AnimatedNumber: React.FC<{ value: number; className?: string }> = ({
  value,
  className,
}) => {
  const prevValue = React.useRef(value);
  const nextId = React.useRef(0);
  const [bumpKey, setBumpKey] = React.useState(0);
  const [deltas, setDeltas] = React.useState<{ id: number; delta: number }[]>(
    []
  );

  React.useEffect(() => {
    const delta = value - prevValue.current;
    prevValue.current = value;
    if (delta !== 0) {
      const id = nextId.current++;
      setBumpKey((k) => k + 1);
      setDeltas((ds) => [...ds, { id, delta }]);
    }
  }, [value]);

  return (
    <span className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <span key={bumpKey} className={bumpKey ? anim.bump : undefined}>
        {value}
      </span>
      {deltas.map(({ id, delta }) => (
        <span
          key={id}
          aria-hidden={true}
          className={[
            styles.delta,
            delta > 0 ? styles.plus : styles.minus,
            anim.floatUp,
          ].join(" ")}
          onAnimationEnd={() =>
            setDeltas((ds) => ds.filter((d) => d.id !== id))
          }
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      ))}
    </span>
  );
};

export default AnimatedNumber;
