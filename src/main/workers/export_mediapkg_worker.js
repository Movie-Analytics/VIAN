const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
// VIAN-specific glue lives here; the generic writer/track builders live in
// libs/mava-exchange-js (linked via a `file:` dependency, not a relative
// path — the main-process build flattens src/main/workers/* into out/main/*,
// which breaks relative paths into libs/) so that package can be extracted
// on its own later.
const mava = require('mava-exchange-js')

// Row objects below are keyed by mava-exchange's spec column names
// (start_seconds, end_seconds, annotations), not VIAN's own naming
// convention — see libs/mava-exchange-js/README.md.
/* eslint-disable camelcase */

const slugify = (s) => {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
  return slug || 'track'
}

// Tags encode their category as `categoryName/tagName` in the exported
// string, since AnnotationListSeries has no column for category hierarchy —
// see applyTags() in import_mediapkg_worker.js, which splits it back apart.
const buildVocabIndex = (vocabularies) => {
  const tagIndex = new Map()
  const vocabNameById = new Map()
  for (const vocab of vocabularies || []) {
    vocabNameById.set(vocab.id, vocab.name)
    for (const category of vocab.categories || []) {
      for (const tag of category.tags || []) {
        tagIndex.set(tag.id, `${category.name}/${tag.name}`)
      }
    }
  }
  return { tagIndex, vocabNameById }
}

/** Guarantees unique, spec-compliant (lowercase, no-space) track names. */
const makeTrackNamer = () => {
  const used = new Set()
  return (name, id) => {
    let slug = slugify(name)
    if (used.has(slug)) slug = `${slug}_${id.slice(0, 8)}`
    used.add(slug)
    return slug
  }
}

const addShotsTimeline = (writer, videoId, timeline, fps, vocabIndex, trackName) => {
  const segments = timeline.data.slice().sort((a, b) => a.start - b.start)
  const name = trackName(timeline.name, timeline.id)
  const rows = segments.map((s) => ({
    annotations: s.annotation || '',
    end_seconds: s.end / fps,
    start_seconds: s.start / fps
  }))
  writer.addTrack(
    videoId,
    mava.annotationSeries({
      description: `Shots timeline '${timeline.name}'`,
      name,
      vian: { name: timeline.name }
    }),
    rows
  )

  const hasTags = segments.some((s) => s.vocabAnnotation && s.vocabAnnotation.length)
  if (!hasTags) return

  const { tagIndex, vocabNameById } = vocabIndex
  const tagRows = segments.map((s) => ({
    annotations: (s.vocabAnnotation || []).map((id) => tagIndex.get(id)).filter(Boolean),
    end_seconds: s.end / fps,
    start_seconds: s.start / fps
  }))
  writer.addTrack(
    videoId,
    mava.annotationListSeries({
      description: `Vocabulary tags for '${timeline.name}'`,
      name: `${name}_tags`,
      parent: name,
      vian: { name: vocabNameById.get(timeline.vocabulary) || timeline.name }
    }),
    tagRows,
    { listValued: true }
  )
}

const addScalarTimeline = (writer, videoId, timeline, fps, trackName) => {
  // A scalar timeline's own sample rate (from its TSV import) may differ
  // from the video's fps.
  const sampleFps = timeline.fps || fps
  const name = trackName(timeline.name, timeline.id)
  const rows = timeline.data.map((value, i) => ({ start_seconds: i / sampleFps, value }))
  writer.addTrack(
    videoId,
    mava.observationSeries({
      description: `Scalar timeline '${timeline.name}'`,
      dimensions: [mava.dimensionSpec('value', timeline.name)],
      name,
      samplingInterval: 1 / sampleFps,
      vian: { name: timeline.name }
    }),
    rows
  )
}

const addScreenshotsTimeline = (writer, videoId, timeline, fps, trackName) => {
  const shots = timeline.data.slice().sort((a, b) => a.frame - b.frame)
  const name = trackName(timeline.name, timeline.id)
  const rows = shots.map((s) => ({
    annotations: '',
    end_seconds: (s.frame + 1) / fps,
    start_seconds: s.frame / fps
  }))
  writer.addTrack(
    videoId,
    mava.annotationSeries({
      description: `Screenshots timeline '${timeline.name}'`,
      name,
      vian: { kind: 'screenshots', name: timeline.name }
    }),
    rows
  )
}

const exportMediaPkg = async (storePath, location, videoId) => {
  const undoableStore = JSON.parse(fs.readFileSync(path.join(storePath, 'undoable.json'), 'utf8'))
  const mainStore = JSON.parse(fs.readFileSync(path.join(storePath, 'main.json'), 'utf8'))
  const { fps } = mainStore

  const finalLocation = location.endsWith('.mediapkg') ? location : `${location}.mediapkg`
  const writer = new mava.MediaPackageWriter(finalLocation, {
    description: `Exported from VIAN project '${videoId}'`
  })

  writer.addVideo(videoId, (mainStore.video || '').replace('app://', ''), {
    durationSeconds: mainStore.videoDuration,
    fps,
    height: mainStore.height,
    width: mainStore.width
  })

  const vocabIndex = buildVocabIndex(undoableStore.vocabularies)
  const trackName = makeTrackNamer()

  for (const timeline of undoableStore.timelines || []) {
    if (timeline.type === 'shots') {
      addShotsTimeline(writer, videoId, timeline, fps, vocabIndex, trackName)
    } else if (timeline.type === 'scalar') {
      addScalarTimeline(writer, videoId, timeline, fps, trackName)
    } else if (timeline.type.startsWith('screenshots')) {
      addScreenshotsTimeline(writer, videoId, timeline, fps, trackName)
    }
  }

  await writer.write()
}

console.log('Started mediapkg export worker')

exportMediaPkg(workerData.storePath, workerData.location, workerData.videoId)
  .then(() => {
    parentPort.postMessage(true)
  })
  .catch((err) => {
    throw err
  })
