import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";
type Lang = "tr" | "ru" | "uz";

interface UiState {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "light",
      lang: "tr",
      setTheme: (t) => {
        set({ theme: t });
        applyTheme(t);
      },
      setLang: (l) => set({ lang: l }),
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        get().setTheme(next);
      },
    }),
    { name: "sadiyakargo-ui" }
  )
);

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
