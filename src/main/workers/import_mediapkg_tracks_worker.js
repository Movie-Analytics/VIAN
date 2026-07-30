const { workerData, parentPort } = require('worker_threads')
const mava = require('mava-exchange-js')
import {
  applyTags,
  buildScalarTimeline,
  buildScreenshotsTimeline,
  buildShotsTimeline
} from './mediapkg_import_helpers'

// Builds timelines for a chosen subset of a .mediapkg's tracks, converted to
// the already-open project's own fps (not the mediapkg's) since they're
// being merged into that project's existing timelines. Doesn't write
// anything to disk — see importMediaPkgIntoProject() in api_functions.js,
// which merges the result into the project's undoable.json and generates
// the actual screenshot files.
const importMediaPkgTracks = async (mediaPkgFile, fps, trackNames) => {
  const pkg = await mava.readMediaPackage(mediaPkgFile)
  const video = pkg.videos[0]
  if (!video) throw new Error('No video found in mediapkg')

  const selected = new Set(trackNames)
  const shotsTimelines = new Map()
  const listTracks = []
  const timelines = []
  const vocabularies = []
  const screenshotJobs = []

  for (const [trackName, track] of Object.entries(video.tracks)) {
    const displayName = track.vian?.name || trackName
    if (track.type === mava.MAVA_TYPES.ANNOTATION_LIST) {
      if (selected.has(track.parent)) listTracks.push(track)
    } else if (!selected.has(trackName)) {
      // Not a track the user chose to import — skip it.
    } else if (track.type === mava.MAVA_TYPES.ANNOTATION && track.vian?.kind === 'screenshots') {
      const timeline = buildScreenshotsTimeline(displayName, track, fps)
      timelines.push(timeline)
      screenshotJobs.push({
        frames: timeline.data.map((s) => s.frame),
        timelineId: timeline.id
      })
    } else if (track.type === mava.MAVA_TYPES.ANNOTATION) {
      const timeline = buildShotsTimeline(displayName, track, fps)
      shotsTimelines.set(trackName, timeline)
      timelines.push(timeline)
    } else if (track.type === mava.MAVA_TYPES.OBSERVATION) {
      timelines.push(buildScalarTimeline(displayName, track, fps))
    }
  }

  listTracks.forEach((track) => applyTags(track, shotsTimelines, vocabularies))

  return { screenshotJobs, timelines, vocabularies }
}

console.log('Started mediapkg tracks import worker')

importMediaPkgTracks(workerData.mediaPkgFile, workerData.fps, workerData.trackNames)
  .then((result) => {
    parentPort.postMessage(result)
  })
  .catch((err) => {
    throw err
  })
