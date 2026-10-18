
import type {
  PauseMenuContext,
  PauseMenuOption,
} from "./types";

export class PauseMenuManager {
  private context: PauseMenuContext = "game";

  setContext(context: PauseMenuContext): void {
    this.context = context;
  }

  getContext(): PauseMenuContext {
    return this.context;
  }

  getOptions(): PauseMenuOption[] {
    switch (this.context) {
      case "tutorial":
        return [
          {
            id: "resume",
            label: "Continuar tutorial",
            variant: "primary",
          },
          {
            id: "restart",
            label: "Reiniciar tutorial",
            disabled: true,
          },
          {
            id: "settings",
            label: "Ajustes",
            disabled: true,
          },
          {
            id: "exit",
            label: "Salir del tutorial",
            disabled: true,
            variant: "danger",
          },
        ];

      case "editor":
        return [
          {
            id: "resume",
            label: "Continuar editando",
            variant: "primary",
          },
          {
            id: "save",
            label: "Guardar mapa",
            disabled: true,
          },
          {
            id: "settings",
            label: "Ajustes",
            disabled: true,
          },
          {
            id: "exit",
            label: "Salir del editor",
            disabled: true,
            variant: "danger",
          },
        ];

      case "game":
      default:
        return [
          {
            id: "resume",
            label: "Continuar",
            variant: "primary",
          },
          {
            id: "save",
            label: "Guardar partida",
            disabled: true,
          },
          {
            id: "settings",
            label: "Ajustes",
            disabled: true,
          },
          {
            id: "exit",
            label: "Salir al menú",
            disabled: true,
            variant: "danger",
          },
        ];
    }
  }
}
