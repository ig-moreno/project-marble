# Configuración

Los ajustes de tráfico están en `game/simulation.ts`: velocidad, aceleración, frenado, separación, reacción de la cola, umbrales de parada, dimensiones de vehículos y precisión del cálculo de ejes.

`game/testScenario.ts` contiene la red, rutas y posiciones iniciales de las pruebas de desarrollo. Las medidas de baldosas, carriles y calzada se comparten desde `game/world.ts` para mantener el modelo y el render alineados.

- `game/camera.ts`: posición inicial, límites y comportamiento interno de cámara. El FOV, si se configura explícitamente en el futuro, pertenece aquí.
- `game/rendering.ts`: parámetros técnicos del motor y requisitos mínimos de pantalla.
- `game/world.ts`: geometría del mundo compartida por lógica y render.
- `game/simulation.ts`: paso de simulación, reloj de ciudad y parámetros físicos del tráfico. Las velocidades se expresan en metros por segundo, salvo el movimiento antiguo indicado en baldosas por segundo.
- `userSettings.ts`: preferencias del jugador entre partidas. Contiene la resolución predeterminada existente; audio, gráficos y controles se añadirán cuando se implementen. La pantalla actual (`game/ui/settings/`) sigue siendo una vista previa, sin aplicación ni persistencia.
- `sessionSettings.ts`: opciones de creación de cada partida. Actualmente solo las dimensiones del mapa. Las futuras economías personalizadas pertenecerán aquí cuando se definan; aún no hay selector ni guardado de partidas.

Los módulos de configuración contienen datos TypeScript sin dependencias de Svelte ni Babylon.js. Evitar mezclar preferencias del jugador con reglas internas. Una opción gráfica elegida por el usuario pertenece a `userSettings.ts`; los detalles técnicos que utiliza el renderizador pertenecen a `game/rendering.ts`.

Mover un valor aquí no implementa una opción editable ni su persistencia. Los valores actuales se conservan.
