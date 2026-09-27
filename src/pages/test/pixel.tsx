import * as React from "react";
import Head from "next/head";

import PixelSprite from "../../components/pixel/PixelSprite";
import { ALL_SPRITES } from "../../components/pixel/sprites";

// Dev gallery of every pixel-art sprite used by the UI.
export default function TestPixelPage() {
  return (
    <div style={{ padding: 20 }}>
      <Head>
        <title>Everdell Pixel Art</title>
      </Head>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {Object.entries(ALL_SPRITES).map(([name, sprite]) => (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: 10,
              background: "#f6e7c1",
              border: "3px solid #3b2210",
            }}
          >
            <PixelSprite sprite={sprite} px={5} />
            <code style={{ fontSize: 11 }}>{name}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
