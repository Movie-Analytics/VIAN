import * as cheerio from 'cheerio'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

const generateEAFContent = () => {
  let timeorder = '<TIME_ORDER>\n'
  let tiers = ''
  let timeslotid = 1
  let annotationid = 1

  useUndoableStore().timelines.forEach((t) => {
    if (t.type !== 'shots') return

    tiers += `<TIER LINGUISTIC_TYPE_REF="default-lt" TIER_ID="${t.name}">\n`

    t.data.forEach((s) => {
      const start = Math.round((s.start / useMainStore().fps) * 1000)
      const end = Math.round((s.end / useMainStore().fps) * 1000)

      tiers += `
        <ANNOTATION>
            <ALIGNABLE_ANNOTATION ANNOTATION_ID="a${annotationid}"
                TIME_SLOT_REF1="ts${timeslotid}" TIME_SLOT_REF2="ts${timeslotid + 1}">
                <ANNOTATION_VALUE>${s.annotation || ''}</ANNOTATION_VALUE>
            </ALIGNABLE_ANNOTATION>
        </ANNOTATION>
      `
      annotationid += 1

      timeorder += `<TIME_SLOT TIME_SLOT_ID="ts${timeslotid}" TIME_VALUE="${start}"/>\n`
      timeorder += `<TIME_SLOT TIME_SLOT_ID="ts${timeslotid + 1}" TIME_VALUE="${end}"/>\n`
      timeslotid += 2
    })

    tiers += '</TIER>\n'
  })
  timeorder += '</TIME_ORDER>\n'

  const videoPath = useMainStore().video.replace('app://', '')
  return `
    <ANNOTATION_DOCUMENT AUTHOR="" DATE="2025-01-20T14:41:12+01:00"
      FORMAT="3.0" VERSION="3.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd">
      <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds">
        <MEDIA_DESCRIPTOR
          MEDIA_URL="file:///${videoPath}"
          MIME_TYPE="video/mp4" />
        <PROPERTY NAME="lastUsedAnnotationId">0</PROPERTY>
      </HEADER>
      ${timeorder}
      ${tiers}
      <LINGUISTIC_TYPE GRAPHIC_REFERENCES="false"
        LINGUISTIC_TYPE_ID="default-lt" TIME_ALIGNABLE="true"/>
      <CONSTRAINT
        DESCRIPTION="Time subdivision of parent annotation's time interval, no time gaps allowed within this interval" STEREOTYPE="Time_Subdivision"/>
      <CONSTRAINT
        DESCRIPTION="Symbolic subdivision of a parent annotation. Annotations refering to the same parent are ordered" STEREOTYPE="Symbolic_Subdivision"/>
      <CONSTRAINT DESCRIPTION="1-1 association with a parent annotation" STEREOTYPE="Symbolic_Association"/>
      <CONSTRAINT
        DESCRIPTION="Time alignable annotations within the parent annotation's time interval, gaps are allowed" STEREOTYPE="Included_In"/>
    </ANNOTATION_DOCUMENT>
  `
}

export const parseEafAnnotations = (xmlContent) => {
  const xml = cheerio.load(xmlContent)
  const timemap = new Map()
  xml('TIME_SLOT').each((_, element) => {
    timemap.set(
      element.attribs.time_slot_id,
      Math.round((Number(element.attribs.time_value) / 1000) * useMainStore().fps)
    )
  })

  const timelines = new Map()
  xml('ALIGNABLE_ANNOTATION').each((_, element) => {
    const timelineId = element.parent.parent.attribs.tier_id
    if (!timelines.has(timelineId)) {
      timelines.set(timelineId, {
        data: [],
        id: crypto.randomUUID(),
        name: timelineId,
        type: 'shots'
      })
    }
    const text = xml(element).find('ANNOTATION_VALUE').text()
    timelines.get(timelineId).data.push({
      annotation: text,
      end: timemap.get(element.attribs.time_slot_ref2),
      id: crypto.randomUUID(),
      start: timemap.get(element.attribs.time_slot_ref1)
    })
  })
  return [...timelines.values()]
}

export const parseTsvAnnotations = (content) => {
  const lines = content.split('\n').map((s) => s.split('\t'))
  if (lines.length <= 1) {
    return null
  }
  const secondsIndex = lines[0].findIndex((e) => e === 'start in seconds')
  const annotationsIndex = lines[0].findIndex((e) => e === 'annotations')
  if (lines[0].includes('duration in seconds')) {
    // Annotation timeline
    const durationIndex = lines[0].findIndex((e) => e === 'duration in seconds')
    return {
      data: lines
        .slice(1)
        .map((l) => ({
          annotation: JSON.parse(l[annotationsIndex] || '[]').join(' • '),
          end: Math.floor(
            (parseFloat(l[secondsIndex]) + parseFloat(l[durationIndex])) * useMainStore().fps
          ),
          id: crypto.randomUUID(),
          start: Math.floor(parseFloat(l[secondsIndex]) * useMainStore().fps),
          vocabAnnotation: []
        }))
        .filter((l) => !isNaN(l.start) && !isNaN(l.end)),
      type: 'shots'
    }
  }
  return {
    data: lines
      .slice(1)
      .map((l) => parseFloat(l[annotationsIndex]))
      .filter((d) => !Number.isNaN(d)),
    fps: 1 / (parseFloat(lines[2][secondsIndex]) - parseFloat(lines[1][secondsIndex])),
    type: 'scalar'
  }
}

export const exportElanAnnotations = () => {
  const blob = new Blob([generateEAFContent()], { type: 'text/eaf' })

  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'annotations.eaf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const exportVocabJson = (vocab) => {
  const jsonText = JSON.stringify(vocab.categories)
  const blob = new Blob([jsonText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = vocab.name + '.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const importVocabJson = () => {
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.json'
  fileInput.addEventListener('change', (event) => {
    const [file] = event.target.files
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      let vocab = JSON.parse(content)
      if ('vocabularies' in vocab) {
        // Old VIAN vocabulary export format
        vocab = vocab.vocabularies
        for (const category of vocab) {
          category.id = category.uuid
          category.tags = category.words
          delete category.uuid
          delete category.category
          delete category.unique_id
          delete category.words
          delete category.image_urls
          delete category.comment
          delete category.visible

          for (const tag of category.tags) {
            tag.id = tag.uuid
            delete tag.unique_id
            delete tag.uuid
            delete tag.parent
            delete tag.children
            delete tag.organization_group
            delete tag.complexity_lvl
            delete tag.complexity_group
            delete tag.image_urls
            delete tag.comment
          }
        }
      }
      useUndoableStore().vocabularies.push({
        categories: vocab,
        id: crypto.randomUUID(),
        name: file.name.replace('.json', '')
      })
    }
    reader.readAsText(file)
  })
  fileInput.click()
}
