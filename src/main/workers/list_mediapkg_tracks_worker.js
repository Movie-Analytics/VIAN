const { workerData, parentPort } = require('worker_threads')
const mava = require('mava-exchange-js')

// Tag tracks (ANNOTATION_LIST) aren't separately selectable — they're pulled
// in automatically as vocabulary of their parent shots track, same as on export.
const listMediaPkgTracks = async (mediaPkgFile) => {
  const manifest = await mava.readManifest(mediaPkgFile)
  return Object.entries(manifest.tracks)
    .filter(([, track]) => track.type !== mava.MAVA_TYPES.ANNOTATION_LIST)
    .map(([trackName, track]) => ({
      kind: track.vian?.kind || null,
      name: track.vian?.name || trackName,
      trackName
    }))
}

console.log('Started mediapkg track listing worker')

listMediaPkgTracks(workerData.mediaPkgFile)
  .then((tracks) => {
    parentPort.postMessage(tracks)
  })
  .catch((err) => {
    throw err
  })
