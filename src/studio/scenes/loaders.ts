import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { SceneId, SceneProps } from './types'

type SceneModule = { default: ComponentType<SceneProps> }

const loaders: Record<SceneId, () => Promise<SceneModule>> = {
  prom2016: () => import('./prom2016'),
  wedding: () => import('./wedding'),
  rave: () => import('./rave'),
  fall: () => import('./fall'),
  beach: () => import('./beach'),
  rooftop: () => import('./rooftop'),
  moviefest: () => import('./moviefest'),
  cinema: () => import('./cinema'),
  halloween: () => import('./halloween'),
}

export const components = Object.fromEntries(Object.entries(loaders).map(([id, load]) => [id, lazy(load)])) as Record<SceneId, LazyExoticComponent<ComponentType<SceneProps>>>

/** Fetch scene code ahead of time (e.g. when the scene picker opens) so switching is instant. */
export function preloadScenes(ids: SceneId[] = Object.keys(loaders) as SceneId[]) {
  return Promise.all(ids.map((id) => loaders[id]()))
}
