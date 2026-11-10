/**
 * YOUR OWN SOUNDS (optional)
 *
 * Every scary sound of the Backrooms and the Skinwalker is made by the synthesizer, so the game
 * works without any audio file. If you want to use a recording instead:
 *
 *   1. Put the file in  public/sounds/   (mp3, ogg or wav), e.g.  public/sounds/susurro.mp3
 *   2. Uncomment (or add) its line below with the file name.
 *
 * The game then plays your file instead of the synthesized sound. Music loops repeat forever,
 * so cut them to loop cleanly. Leave a line commented out to keep the synthesized sound.
 */

/** Every place in the game where a scary sound can go. */
export type CustomSoundName =
  // ---- Music (loops) ----
  /** Backrooms and Skinwalker: the creepy background music (replaces the drones and music box) */
  | 'musica_backrooms'
  /** Plays on top while something chases you (fades in with the danger) */
  | 'musica_persecucion'
  // ---- Background, every few seconds in the Backrooms ----
  | 'pasos_lejanos' // footsteps somewhere in the rooms
  | 'golpe_lejano' // a knock / door slam far away
  | 'susurro' // whispers
  | 'rechinido' // metal creaking
  | 'gota' // water dripping
  | 'chispa' // a lamp sparking and buzzing
  | 'grito_lejano' // a scream, very far away
  // ---- Moments ----
  | 'apagon' // the lights go out (warehouse, Skinwalker blackouts)
  | 'luz_vuelve' // the lights come back
  | 'latido' // one heartbeat (repeats faster as the danger grows, or with 1 heart left)
  | 'risa' // a Sonrisa giggling close to you
  | 'puerta_abre' // the locked door of the maze opens
  | 'palanca' // pulling a lever in the red corridor
  | 'pasillo_alarga' // the red corridor stretches (it took you back)
  | 'huesos' // a copy of a friend cracks into a werewolf
  | 'rasgar' // the Skinwalker tears through the wallpaper
  | 'pared_mueve' // the maze walls move
  | 'grito_skinwalker' // the Skinwalker screams
  | 'arana_glitch' // the glitched spider stutters (like a game breaking)
  | 'arana_patas'; // the spider's legs tapping fast

export const CUSTOM_SOUNDS: Partial<Record<CustomSoundName, string>> = {
  // musica_backrooms: 'musica_backrooms.mp3',
  // musica_persecucion: 'musica_persecucion.mp3',
  // pasos_lejanos: 'pasos_lejanos.mp3',
  // golpe_lejano: 'golpe_lejano.mp3',
  // susurro: 'susurro.mp3',
  // rechinido: 'rechinido.mp3',
  // gota: 'gota.mp3',
  // chispa: 'chispa.mp3',
  // grito_lejano: 'grito_lejano.mp3',
  // apagon: 'apagon.mp3',
  // luz_vuelve: 'luz_vuelve.mp3',
  // latido: 'latido.mp3',
  // risa: 'risa.mp3',
  // puerta_abre: 'puerta_abre.mp3',
  // palanca: 'palanca.mp3',
  // pasillo_alarga: 'pasillo_alarga.mp3',
  // huesos: 'huesos.mp3',
  // rasgar: 'rasgar.mp3',
  // pared_mueve: 'pared_mueve.mp3',
  // grito_skinwalker: 'grito_skinwalker.mp3',
  // arana_glitch: 'arana_glitch.mp3',
  // arana_patas: 'arana_patas.mp3',
};
