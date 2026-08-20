import { buildScalarDataFromSamples } from '../../shared/scalar_timeline'

export const buildShotsTimeline = (name, track, fps) => ({
  data: track.rows.map((r) => ({
    annotation: r.annotations || '',
    end: Math.round(r.end_seconds * fps),
    id: crypto.randomUUID(),
    start: Math.round(r.start_seconds * fps),
    vocabAnnotation: []
  })),
  hidden: false,
  id: crypto.randomUUID(),
  locked: false,
  name,
  type: 'shots',
  vocabulary: null
})

export const buildScalarTimeline = (name, track, fps) => {
  const valueColumn = Object.keys(track.dimensions || {})[0]
  const samples = track.rows.map((r) => ({ time: r.start_seconds, value: r[valueColumn] }))
  const knownInterval = track.sampling_interval_seconds || (fps ? 1 / fps : null)
  const { data, fps: sampleFps } = buildScalarDataFromSamples(samples, knownInterval)
  return {
    data,
    fps: sampleFps,
    id: crypto.randomUUID(),
    name,
    type: 'scalar'
  }
}

// Image/thumbnail are filled in later, once screenshots_generation_worker
// has actually produced the files — see generateImportedScreenshots() in
// api_functions.js.
export const buildScreenshotsTimeline = (name, track, fps) => {
  const frames = track.rows.map((r) => Math.round(r.start_seconds * fps))
  return {
    data: frames.map((frame) => ({
      frame,
      id: crypto.randomUUID(),
      image: null,
      thumbnail: null
    })),
    id: crypto.randomUUID(),
    name,
    type: 'screenshots'
  }
}

// Tags were exported as `categoryName/tagName` strings (see
// buildVocabIndex() in annotation_export_helpers.js) since AnnotationListSeries
// has no column for category hierarchy — split them back apart here so the
// rebuilt vocabulary keeps its original categories instead of one flat list.
const parseTag = (raw) => {
  const idx = raw.indexOf('/')
  if (idx === -1) return { categoryName: 'Tags', tagName: raw }
  return { categoryName: raw.slice(0, idx), tagName: raw.slice(idx + 1) }
}

export const applyTags = (track, shotsTimelines, vocabularies) => {
  const parent = shotsTimelines.get(track.parent)
  if (!parent) return

  const vocabulary = {
    categories: [],
    id: crypto.randomUUID(),
    name: track.vian?.name || track.parent
  }
  vocabularies.push(vocabulary)
  parent.vocabulary = vocabulary.id

  const categoriesByName = new Map()
  const tagIdByKey = new Map()

  track.rows.forEach((row, i) => {
    const segment = parent.data[i]
    if (!segment) return
    segment.vocabAnnotation = (row.annotations || []).map((raw) => {
      const { categoryName, tagName } = parseTag(raw)
      const key = `${categoryName} ${tagName}`
      if (!tagIdByKey.has(key)) {
        let category = categoriesByName.get(categoryName)
        if (!category) {
          category = { id: crypto.randomUUID(), name: categoryName, tags: [] }
          categoriesByName.set(categoryName, category)
          vocabulary.categories.push(category)
        }
        const tagId = crypto.randomUUID()
        category.tags.push({ id: tagId, name: tagName })
        tagIdByKey.set(key, tagId)
      }
      return tagIdByKey.get(key)
    })
  })
}
