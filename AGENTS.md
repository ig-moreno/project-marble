# Project Marble — instrucciones para agentes de código

## Proyecto y alcance
Project Marble es un proyecto personal de simulación urbana y tráfico en navegador. El objetivo inmediato es construir una base jugable de forma incremental, no preparar un lanzamiento ni migrar de motor.

Tecnologías actuales: TypeScript, Svelte 5, Babylon.js y Vite. Mantener esta pila. **No proponer ni iniciar una migración a Godot** salvo petición explícita.

## Organización y responsabilidades
- `src/pages/HomePage.svelte` es una **landing comercial** independiente; no es el menú principal del juego.
- Todo el juego vive en `src/pages/GamePage.svelte`, incluidos menú de nueva partida, futura carga de partidas, HUD, paneles y pausa.
- Svelte gestiona la interfaz; Babylon.js representa la escena 3D; la simulación debe poder funcionar sin depender de la UI ni del renderizador.
- Reutilizar los módulos existentes antes de crear nuevas capas. Evitar convertir `Game.ts` en una jerarquía de gestores prematuramente.
- No introducir escenarios fijos ni botones de prueba en la experiencia normal. Una nueva partida debe comenzar con un mundo vacío.

## Forma de trabajar
- Hacer cambios pequeños, verificables y relacionados con la tarea solicitada.
- Inspeccionar el código actual antes de editar. No asumir que el GDD ya está implementado.
- Preservar el comportamiento existente, especialmente cámara, construcción, borrado de carreteras y pausa.
- Ejecutar `npm run build` tras cambios de código cuando el entorno lo permita; comunicar claramente lo que no se haya comprobado. El repositorio no tiene por qué disponer aún de tests automatizados.
- No modificar la landing comercial salvo solicitud expresa.
- Trabajar sobre la rama indicada por el usuario; **no hacer commits en `develop` ni fusionar ramas sin autorización**. En esta fase la rama de trabajo es `feat/game-foundation-cleanup`.
- Antes de cambios arquitectónicos o de alcance amplio, explicar brevemente la propuesta y esperar conformidad.
- Responder al usuario en español, de forma directa y práctica.

## Modelo de simulación previsto (no confundir con funcionalidad existente)
- La ciudad se construye sobre una cuadrícula ortogonal de baldosas de 10 × 10 metros.
- Una carretera estándar tiene dos carriles de 3 m, uno por sentido, con circulación por la derecha y aceras de 2 m.
- La cuadrícula sirve para construir; **el tráfico debe circular por un grafo de carriles dirigidos**, con trayectorias geométricas continuas. No utilizar el recorrido por centros de baldosa como arquitectura definitiva.
- Distinguir tramo recto, curva, T, cruce y calle sin salida. Una curva de dos conexiones no es una intersección.
- Los vehículos pueden tener longitudes diferentes (incluidos camiones). Evitar física detallada innecesaria.
- La simulación de tráfico debe impedir colisiones entre vehículos y con peatones mediante conflictos y reservas de trayectorias, no mediante correcciones visuales posteriores.
- Controles por acceso: sin señal, STOP, ceda el paso o semáforo. Se admiten combinaciones en una misma intersección. Respetar prioridades y no entrar si la salida está bloqueada.
- Los pasos de peatones y sus prioridades forman parte del modelo de intersección.
- Se contempla espera segura dentro de la intersección para ciertos giros a la izquierda; no simplificar a «un solo coche por intersección» sin acuerdo.
- Tiempo previsto: 30 minutos reales equivalen a un día de juego; distinguir tiempo simulado de segundos físicos para el tráfico.
- Edificios, personas, viajes y aparcamientos deberán integrarse gradualmente, sin crear flujos ficticios al arrancar.

## Prioridad de implementación
1. Limpiar dependencias del antiguo escenario de pruebas y validar el arranque vacío.
2. Introducir dentro de `GamePage` el ciclo de vida de una partida y la acción «Nueva partida».
3. Desarrollar progresivamente el modelo lógico de carreteras y carriles.
4. Añadir selección e inspección de elementos y, después, circulación y reglas de tráfico.

No implementar de golpe todas las reglas futuras. El GDD describe decisiones de diseño, **no requisitos para una sola tarea**.

## Fuente de decisiones
El GDD maestro de Project Marble contiene el detalle funcional. Si está accesible, consultarlo para decisiones no recogidas aquí; si no, preguntar en lugar de inventar reglas. Ante contradicciones, priorizar las decisiones más recientes expresadas por el usuario.
