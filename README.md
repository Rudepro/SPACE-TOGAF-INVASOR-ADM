# SPACE INVADERS — TOGAF EDITION

Proyecto arcade inspirado en el clásico Space Invaders con mejoras modernas: niveles con dificultad incremental, jefes, poderes, guardado de progreso, HUD y un sistema de audio completo.

## Objetivo del juego
- Destruye todas las oleadas de enemigos evitando sus disparos.
- Aprovecha los power-ups que sueltan algunos enemigos.
- Derrota a los jefes para avanzar en los niveles clave.
- Maximiza tu puntuación y conserva tus vidas.

## Controles
- Flechas izquierda/derecha o A/D: mover la nave.
- Espacio: disparar.
- P: pausar/reanudar.
- M: silenciar/activar audio.

## Arquitectura del sistema
- index.html: estructura de pantallas (menú, juego, pausa, selección de nivel, puntuaciones, game over) y el canvas del juego.
- styles.css: estilo retro con tipografía tipo arcade, animaciones, HUD y disposición responsive.
- game.js: motor del juego con los siguientes módulos principales:
  - Máquina de estados: `MENU`, `GAME`, `PAUSE`, `LEVEL_COMPLETE`, `GAME_OVER`, `CONTROLS`, `HIGHSCORES`, `LEVEL_SELECT`, `BOSS_WARNING`.
  - Bucle principal render/update con `requestAnimationFrame`.
  - Render sobre `<canvas>`: jugador, enemigos, balas, power-ups, partículas, jefe y rejilla de fondo.
  - Entidades: `Player`, `PlayerBullet`, `Enemy`, `EnemyBullet`, `Boss`, `PowerUp`, `Particle`.
  - Sonido: `SoundManager` con carga de `sounds/*.mp3`, reproducción en loop, mute global y un jingle sintetizado de `Level_Start` via Web Audio API.
  - Persistencia: `localStorage` para `highScores`, `lastLevelPassed`, `canContinue`.
  - UI/HUD: lectura y escritura de elementos del DOM para mostrar puntuación, vidas, nivel y power-up activo.

## Funcionalidades
- Dificultad incremental por nivel (velocidad, cantidad, cadencia de disparo de enemigos).
- Tres patrones de movimiento de enemigos: lineal, seno y zigzag.
- Power-ups: Escudo (3 impactos) y Fuego Rápido (cadencia temporal aumentada).
- Jefes con barra de vida, movimiento lateral y disparo múltiple.
- Pausa, selección de nivel (hasta el último superado), continuar partida, mejores puntuaciones.
- Sistema de partículas para explosiones y feedback visual.

## Sistema de niveles
- La configuración está en `levelConfig` dentro de `game.js`.
- Niveles 3, 6, 9 y 10 incluyen jefe.
- Parámetros por nivel: `enemyCount`, `enemySpeed`, `fireRate`, `waves` (parámetro disponible para escalar densidad) e `isBoss`.
- Al iniciar un nivel:
  1) Se reproduce el jingle `Level_Start` (sintetizado, no requiere archivo).
  2) Comienza la música de fondo: `Game_Theme` o `Boss` (si es jefe).

## Power-ups y mecánicas
- Tipos:
  - Escudo (`shield`): activa un escudo con 3 puntos que absorben daño.
  - Fuego Rápido (`rapidfire`): reduce temporalmente el tiempo entre disparos del jugador.
- Indicadores visuales: anillo para escudo, ráfagas laterales para fuego rápido.
- Probabilidad de drop: ~15% al destruir enemigos.

## Sonidos
- Música:
  - Menú principal: `Main_Menu` (loop)
  - Nivel normal: `Game_Theme` (loop)
  - Nivel jefe: `Boss` (loop)
  - Jingle inicio de nivel: `Level_Start` (sintetizado en runtime)
- Efectos:
  - Disparo jugador: `Shot`
  - Enemigo destruido: `Enemy_Died`
  - Recoger power-up: `Coin`
  - Activar escudo: `Shield_Activate` (archivo esperado)
  - Perder vida: `Player_Lost_Life`
  - Derrota del jefe: `Boss_Explosion` (archivo esperado)
  - Game Over: `Game_Over`
  - Nivel completado: `Level_Win`
  - Juego completado: `Game_Win`
  - Alerta/entrada de jefe (UFO): `UFO`
- Reservados para sistema de preguntas: `Correct_Answer`, `Incorrect_Answer`.
- Ubicación de archivos: carpeta `sounds/` con nombres exactos `<Nombre>.mp3`.

## Guardado y progreso
- `highScores`: top 10 por puntuación.
- `lastLevelPassed`: último nivel superado (habilita selección de nivel).
- `canContinue`: permite continuar desde el último nivel alcanzado.

## Cómo ejecutar
1) Abre `index.html` en tu navegador (preferible lanzar con un servidor local para evitar bloqueos de autoplay en algunos navegadores).
2) Si el audio no suena inicialmente, realiza una interacción (clic en botones del menú) para desbloquear el contexto de audio.

## Estructura del proyecto
```
SPACE TOGAF INVASOR ADM/
├─ index.html
├─ styles.css
├─ game.js
└─ sounds/
   ├─ Boss.mp3
   ├─ Coin.mp3
   ├─ Correct_Answer.mp3
   ├─ Enemy_Died.mp3
   ├─ Game_Over.mp3
   ├─ Game_Theme.mp3
   ├─ Game_Win.mp3
   ├─ Incorrect_Answer.mp3
   ├─ Level_Win.mp3
   ├─ Main_Menu.mp3
   ├─ Player_Lost_Life.mp3
   ├─ Player_Win_Life.mp3
   ├─ Shot.mp3
   ├─ UFO.mp3
   ├─ Boss_Explosion.mp3        (añadir)
   └─ Shield_Activate.mp3       (añadir)
```

## Personalización de niveles
- Edita `levelConfig` en `game.js`.
- Sugerencia de escalado:
  - `enemyCount`: 5 → 25
  - `enemySpeed`: 1.0 → 3.0
  - `fireRate`: 0.015 → 0.06
  - Marca `isBoss: true` en los niveles que desees jefe.

## Sistema de preguntas (extensión opcional)
Actualmente no hay preguntas in-game, pero el audio está preparado (`Correct_Answer`, `Incorrect_Answer`). Propuesta de integración:
- Archivo `questions.json` con un arreglo de preguntas. Formato sugerido:
```json
[
  {
    "id": 1,
    "question": "¿Qué es TOGAF?",
    "answers": [
      { "text": "Un framework de arquitectura empresarial", "correct": true },
      { "text": "Un lenguaje de programación", "correct": false },
      { "text": "Un gestor de base de datos", "correct": false }
    ],
    "explanation": "TOGAF es un marco para diseñar, planificar e implementar arquitectura empresarial."
  }
]
```
- Hooks a añadir en `game.js`:
  - Mostrar pregunta en momentos clave (p. ej., entre oleadas o al tomar ciertos power-ups).
  - Lógica `handleAnswer(isCorrect)`:
    - `isCorrect = true`: reproducir `Correct_Answer`, dar bonus de puntos/vida/power-up.
    - `isCorrect = false`: reproducir `Incorrect_Answer`, penalizar (p. ej., acelerar enemigos o quitar puntos).
- UI: overlay con la pregunta y opciones, bloqueando el input del juego hasta responder.

## Buenas prácticas y notas
- Audio: asegúrate de que los nombres coincidan exactamente y que los archivos estén en `sounds/`.
- Derechos de autor: usa únicamente audios e imágenes de los cuales tengas derechos.
- Rendimiento: mantener sprites simples y limitar partículas en dispositivos modestos.

## Roadmap sugerido
- Oleadas múltiples por nivel (`waves`).
- Sistema de preguntas integrado con recompensas/penalizaciones.
- Nuevos power-ups: doble disparo, bomba de pantalla, ralentización temporal.
- Nuevos tipos de enemigos con patrones avanzados.
- Puntuaciones con nombres personalizados.

---
¡Disfruta el juego y si necesitas nuevas mecánicas o integrar el sistema de preguntas, puedo implementarlo rápidamente! 
