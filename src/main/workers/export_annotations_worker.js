const { workerData, parentPort } = require('worker_threads')
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')
import {
  buildVocabIndex,
  readVianStore,
  screenshotFileName,
  sortedByStart,
  timeReadable
} from './annotation_export_helpers'

const csvField = (value) => {
  const s = value === null || typeof value === 'undefined' ? '' : String(value)
  return /["\r\n,]/u.test(s) ? `"${s.replace(/"/gu, '""')}"` : s
}

const csvRow = (fields) => fields.map(csvField).join(',') + '\r\n'

// Screenshots aren't linked to a segment in the data model — a screenshot
// "belongs" to a segment if its frame falls inside the segment's range,
// same containment check the UI uses in ImageDialog.vue's
// getAssociatedAnnotations() (there: per-screenshot; here: the reverse).
const collectScreenshots = (undoableStore) =>
  (undoableStore.timelines || [])
    .filter((timeline) => timeline.type.startsWith('screenshots'))
    .flatMap((timeline) => timeline.data.map((s) => ({ frame: s.frame, image: s.image })))

const vocabColumnHeader = (vocabColumns) =>
  vocabColumns.map(({ categoryName, vocabName }) => `${vocabName}::${categoryName}`)

const buildSegmentRow = ({
  fps,
  projectName,
  screenshots,
  segment,
  segNo,
  tagInfo,
  timeline,
  usedScreenshots,
  vocabColumns
}) => {
  const categoryTags = Array.from({ length: vocabColumns.length }, () => [])
  for (const tagId of segment.vocabAnnotation || []) {
    const info = tagInfo.get(tagId)
    if (info) categoryTags[info.columnIndex].push(info.tagName)
  }

  const matching = screenshots.filter((s) => s.frame >= segment.start && s.frame < segment.end)
  const screenshotRefs = matching.map((s) => {
    const filename = `${projectName}_${screenshotFileName(s.frame, fps)}`
    usedScreenshots.set(s.image, filename)
    return filename
  })

  const row = [
    timeline.name,
    segNo,
    timeReadable(segment.start, fps),
    timeReadable(segment.end, fps),
    timeReadable(segment.end - segment.start, fps),
    Math.round(((segment.end - segment.start) / fps) * 1000),
    screenshotRefs.join(', '),
    segment.annotation || ''
  ]
  categoryTags.forEach((tags) => row.push(tags.join(', ')))
  return row
}

const buildCsv = (undoableStore, fps, projectName, usedScreenshots) => {
  const shotTimelines = (undoableStore.timelines || []).filter((t) => t.type === 'shots')
  const { tagInfo, vocabColumns } = buildVocabIndex(undoableStore.vocabularies)
  const screenshots = collectScreenshots(undoableStore)

  const header = [
    'Track Name',
    'Segmentation No.',
    'Timecode Segment Start',
    'Timecode Segment End',
    'Duration',
    'Duration (ms)',
    'Screenshots',
    'Free text annotation',
    ...vocabColumnHeader(vocabColumns)
  ]

  const rows = shotTimelines.flatMap((timeline) =>
    sortedByStart(timeline).map((segment, i) =>
      buildSegmentRow({
        fps,
        projectName,
        screenshots,
        segNo: i + 1,
        segment,
        tagInfo,
        timeline,
        usedScreenshots,
        vocabColumns
      })
    )
  )

  return [header, ...rows].map(csvRow).join('')
}

const exportAnnotations = async (storePath, location, projectName) => {
  const { mainStore, undoableStore } = readVianStore(storePath)
  const { fps } = mainStore

  // Path separators would corrupt the zip's flat file layout.
  const safeProjectName = projectName.replaceAll(/[/\\]/gu, '_')

  // Image path -> filename inside the zip (screenshots sit alongside the CSV)
  const usedScreenshots = new Map()
  const csv = buildCsv(undoableStore, fps, safeProjectName, usedScreenshots)

  const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vian-annotations-'))
  fs.writeFileSync(path.join(tmpPath, 'annotations.csv'), csv)

  for (const [imagePath, filename] of usedScreenshots) {
    try {
      fs.copyFileSync(imagePath.replace('app://', ''), path.join(tmpPath, filename))
    } catch (err) {
      console.error('Failed to copy screenshot:', imagePath, err)
    }
  }

  const finalLocation = location.endsWith('.zip') ? location : `${location}.zip`
  const output = fs.createWriteStream(finalLocation)
  const archive = archiver('zip')

  archive.pipe(output)
  archive.directory(tmpPath, false)
  await archive.finalize()
  fs.rmSync(tmpPath, { recursive: true })
}

console.log('Started annotations export worker')

exportAnnotations(workerData.storePath, workerData.location, workerData.projectName)
  .then(() => {
    parentPort.postMessage(true)
  })
  .catch((err) => {
    throw err
  })
