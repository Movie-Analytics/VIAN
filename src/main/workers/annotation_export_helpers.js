// Local relative `require()`s between worker files don't survive the
// main-process build (it flattens src/main/workers/* into out/main/*, same
// issue noted in export_mediapkg_worker.js for libs/mava-exchange-js) — so
// this shared module is pulled in via `import`, which electron-vite's
// `?nodeWorker` bundling actually resolves and inlines, unlike `require()`.
import fs from 'fs'
import path from 'path'

// Shared by every worker that reads a project's persisted store
// (export_mediapkg_worker.js, export_screenshot(s)_worker.js, export_annotations_worker.js).
export const readVianStore = (storePath) => {
  const mainStore = JSON.parse(fs.readFileSync(path.join(storePath, 'main.json'), 'utf8'))
  const undoableStore = JSON.parse(fs.readFileSync(path.join(storePath, 'undoable.json'), 'utf8'))
  return { mainStore, undoableStore }
}

export const sortedByStart = (timeline) => timeline.data.slice().sort((a, b) => a.start - b.start)

// Tag id -> its category/vocab context. Shared by the mediapkg exporter
// (needs "categoryName/tagName" strings) and the annotations CSV exporter
// (needs tags grouped into one column per vocabulary/category pair).
export const buildVocabIndex = (vocabularies) => {
  const tagInfo = new Map()
  const vocabNameById = new Map()
  // One entry per (vocabulary, category) pair, in the order they're defined —
  // the annotations CSV exporter turns this into one column group per entry.
  const vocabColumns = []
  for (const vocab of vocabularies || []) {
    vocabNameById.set(vocab.id, vocab.name)
    for (const category of vocab.categories || []) {
      const columnIndex = vocabColumns.length
      vocabColumns.push({ categoryName: category.name, vocabName: vocab.name })
      for (const tag of category.tags || []) {
        tagInfo.set(tag.id, {
          categoryName: category.name,
          columnIndex,
          tagName: tag.name,
          vocabId: vocab.id
        })
      }
    }
  }
  return { tagInfo, vocabColumns, vocabNameById }
}

export const tagCategoryLabel = (tagInfo, tagId) => {
  const info = tagInfo.get(tagId)
  return info && `${info.categoryName}/${info.tagName}`
}

const slugify = (s) => {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
  return slug || 'track'
}

/** Guarantees unique, filesystem/spec-safe names derived from timeline names. */
export const makeUniqueNamer = () => {
  const used = new Set()
  return (name, id) => {
    let slug = slugify(name)
    if (used.has(slug)) slug = `${slug}_${id.slice(0, 8)}`
    used.add(slug)
    return slug
  }
}

// File-safe timecode used to name exported screenshot images, e.g. "00-01-23_45.jpg".
export const screenshotFileName = (frame, fps) => {
  const t = frame / fps
  const hours = Math.floor(t / 3600)
  const minutes = Math.floor((t % 3600) / 60)
  const seconds = (t % 60).toFixed(2).replace('.', ',')

  const formattedHours = String(hours).padStart(2, '0')
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  return (
    `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
      .replaceAll(':', '-')
      .replace(',', '_') + '.jpg'
  )
}

// Human-readable SMPTE-style timecode "HH:MM:SS:FF", matching the renderer's
// useMainStore().timeReadableFrame(frame, true).
export const timeReadable = (frame, fps) => {
  const t = frame / fps
  const hours = Math.floor(t / 3600)
  const minutes = Math.floor((t % 3600) / 60)
  const seconds = Math.floor(t % 60)
  const frameNum = Math.floor((t % 1) * fps)
    .toString()
    .padStart(2, '0')

  const formattedHours = String(hours).padStart(2, '0')
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}:${frameNum}`
}
