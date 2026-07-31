export const englishModernTheme = {
  id: "english-modern",
  colors: {
    background: "#0b1220",
    surface: "#111c31",
    surfaceAlt: "#17243d",
    primary: "#38bdf8",
    secondary: "#a78bfa",
    accent: "#facc15",
    text: "#f8fafc",
    muted: "#cbd5e1",
    correct: "#22c55e",
    incorrect: "#ef4444",
  },
  typography: {
    family: '"Segoe UI","Noto Sans",Arial,sans-serif',
  },
} as const;

export const requiredThemeTokens = [
  `--bg:${englishModernTheme.colors.background}`,
  `--surface:${englishModernTheme.colors.surface}`,
  `--surface2:${englishModernTheme.colors.surfaceAlt}`,
  `--primary:${englishModernTheme.colors.primary}`,
  `--secondary:${englishModernTheme.colors.secondary}`,
  `--accent:${englishModernTheme.colors.accent}`,
  `--text:${englishModernTheme.colors.text}`,
  `--muted:${englishModernTheme.colors.muted}`,
  `--correct:${englishModernTheme.colors.correct}`,
  `--incorrect:${englishModernTheme.colors.incorrect}`,
] as const;

export function validateTemplateTheme(html: string, templateId: string): void {
  const compact = html.replace(/\s+/g, "");
  for (const token of requiredThemeTokens) {
    if (!compact.includes(token)) {
      throw new Error(
        `Template '${templateId}' không đồng bộ theme '${englishModernTheme.id}': thiếu ${token}`,
      );
    }
  }
  if (!compact.includes(`font-family:${englishModernTheme.typography.family}`)) {
    throw new Error(
      `Template '${templateId}' không dùng typography của theme '${englishModernTheme.id}'`,
    );
  }
}
