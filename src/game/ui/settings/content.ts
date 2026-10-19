import type { SettingsTab } from "./types";

// Propuestas visuales: no son valores efectivos de configuración.
export const settingsTabs: SettingsTab[] = [
  {
    id: "general", label: "General", sections: [
      { title: "Idioma", description: "Idioma de los menús y la interfaz.", fields: [
        { label: "Idioma del juego", preview: "Español" },
      ] },
      { title: "Interfaz", description: "Presentación de la información en pantalla.", fields: [
        { label: "Escala de la interfaz", preview: "100 %" },
        { label: "Ayudas contextuales", preview: "Activadas" },
      ] },
    ],
  },
  {
    id: "graphics", label: "Gráficos", sections: [
      { title: "Pantalla", description: "Opciones de visualización.", fields: [
        { label: "Modo de pantalla", preview: "Ventana" },
      ] },
      { title: "Calidad visual", description: "Equilibrio entre detalle y rendimiento.", fields: [
        { label: "Calidad de las sombras", preview: "Media" },
        { label: "Suavizado de bordes", preview: "Activado" },
      ] },
    ],
  },
  {
    id: "audio", label: "Audio", sections: [
      { title: "Volumen", description: "Niveles de sonido del juego.", fields: [
        { label: "Volumen general", preview: "80 %" },
        { label: "Música", preview: "50 %" },
      ] },
      { title: "Sonidos de la ciudad", description: "Ambiente y avisos sonoros.", fields: [
        { label: "Sonido ambiental", preview: "Activado" },
        { label: "Avisos de la interfaz", preview: "Activados" },
      ] },
    ],
  },
  {
    id: "controls", label: "Controles", sections: [
      { title: "Cámara", description: "Preferencias de movimiento de la cámara.", fields: [
        { label: "Sensibilidad del zoom", preview: "Normal" },
        { label: "Invertir desplazamiento", preview: "Desactivado" },
      ] },
      { title: "Teclado", description: "Personalización de los atajos del juego.", fields: [
        { label: "Asignación de teclas", preview: "Predeterminada" },
      ] },
    ],
  },
];
