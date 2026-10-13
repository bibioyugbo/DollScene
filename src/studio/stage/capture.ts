/**
 * Photo capture: the stage registers a function that renders one clean frame of the 3D canvas and
 * returns it as a PNG. Photo mode calls it after hiding the UI (the UI is DOM, never in the frame).
 */
let capture: (() => Promise<Blob>) | null = null

export const setCapture = (fn: typeof capture) => (capture = fn)

export async function takePhoto(): Promise<Blob> {
  if (!capture) throw new Error('The camera isn’t ready yet.')
  return capture()
}
