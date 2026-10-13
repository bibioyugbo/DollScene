/**
 * DollScene event scenes: procedural environments rendered inside the studio's R3F <Canvas>.
 *   import { SCENES, SceneEnvironment } from './scenes'
 *   <SceneEnvironment id="wedding" time="golden" weather="clear" animate />
 * The character stands at the world origin (or a PhotoSpot), floor y = 0, facing +Z.
 */
export type { PhotoSpot, SceneDef, SceneId, TimeOfDay, Weather } from './types'
export { SCENES, SCENE_BY_ID } from './defs'
export { SceneEnvironment, type SceneEnvironmentProps } from './SceneEnvironment'
export { preloadScenes } from './loaders'
export { BlobShadow } from './kit/Lights'
