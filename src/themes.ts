export type ThemeId = "classic" | "pongal" | "diwali" | "christmas";

export type Theme = {
  id: ThemeId;
  label: string;
  /** Page / floor color behind the drawing. */
  floor: string;
  floorGlow: string;
  line: string;
  dot: string;
  ink: string;
  muted: string;
  accent: string;
  buttonFace: string;
  buttonText: string;
  /** Logo / header mark color. */
  mark: string;
};

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: "classic",
    label: "Classic",
    floor: "#1c1612",
    floorGlow: "#2a221c",
    line: "#f3efe6",
    dot: "#f3efe6",
    ink: "#f3efe6",
    muted: "#a39c92",
    accent: "#c4a574",
    buttonFace: "#f3efe6",
    buttonText: "#1c1612",
    mark: "#f3efe6",
  },
  pongal: {
    id: "pongal",
    label: "Pongal · Sankranti",
    floor: "#4a1c0a",
    floorGlow: "#6b2a10",
    line: "#fff6e8",
    dot: "#e1b12c",
    ink: "#fff6e8",
    muted: "#e8c9a0",
    accent: "#e1b12c",
    buttonFace: "#e1b12c",
    buttonText: "#3a1406",
    mark: "#fff6e8",
  },
  diwali: {
    id: "diwali",
    label: "Diwali",
    floor: "#0c1026",
    floorGlow: "#1a2050",
    line: "#e8c547",
    dot: "#ffd978",
    ink: "#f4efe4",
    muted: "#b8b3c9",
    accent: "#e8c547",
    buttonFace: "#e8c547",
    buttonText: "#0c1026",
    mark: "#f4efe4",
  },
  christmas: {
    id: "christmas",
    label: "Christmas",
    floor: "#0f1a14",
    floorGlow: "#1c2e22",
    line: "#f3efe6",
    dot: "#d4a017",
    ink: "#f4efe4",
    muted: "#b7c4b8",
    accent: "#c43c3c",
    buttonFace: "#c43c3c",
    buttonText: "#fff6f0",
    mark: "#f3efe6",
  },
};

export const THEME_IDS: ThemeId[] = ["classic", "pongal", "diwali", "christmas"];
