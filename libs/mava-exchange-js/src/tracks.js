/**
 * Track definitions for annotation data — the JS counterpart of
 * mava-exchange's `tracks.py`. A track describes one Parquet file inside a
 * `.mediapkg` archive; each builder here returns a plain object with a
 * `columns` array and a `toManifest()` method producing the same shape as
 * the Python library's `to_dict()`.
 */

const MAVA_TYPES = {
  OBSERVATION: 'mava:ObservationSeries',
  ANNOTATION: 'mava:AnnotationSeries',
  ANNOTATION_LIST: 'mava:AnnotationListSeries'
}

/** Optional hierarchy / provenance edges, emitted only when present. */
function relations({ parent, derivedFrom, method } = {}) {
  const rel = {}
  if (parent != null) rel.parent = parent
  if (derivedFrom && derivedFrom.length) rel.derived_from = derivedFrom
  if (method != null) rel.method = method
  return rel
}

/** Describes one measured quantity (column) within an ObservationSeries. */
function dimensionSpec(name, description = '', range = '') {
  return { description, name, range }
}

function dimensionsManifest(dimensions) {
  const out = {}
  for (const d of dimensions) {
    out[d.name] = { description: d.description || '', ...(d.range ? { range: d.range } : {}) }
  }
  return out
}

/** Dense, regularly-sampled numeric time series (e.g. emotion scores). */
function observationSeries({
  name,
  description = '',
  dimensions,
  samplingInterval,
  parent,
  derivedFrom,
  method,
  vian
}) {
  const columns = ['start_seconds', ...dimensions.map((d) => d.name)]
  return {
    columns,
    name,
    type: MAVA_TYPES.OBSERVATION,
    toManifest: () => ({
      columns,
      description,
      dimensions: dimensionsManifest(dimensions),
      type: MAVA_TYPES.OBSERVATION,
      ...relations({ derivedFrom, method, parent }),
      ...(samplingInterval != null ? { sampling_interval_seconds: samplingInterval } : {}),
      ...(vian ? { vian } : {})
    })
  }
}

/** Sparse interval annotations with a single string value per segment. */
function annotationSeries({ name, description = '', parent, derivedFrom, method, vian }) {
  const columns = ['start_seconds', 'end_seconds', 'annotations']
  return {
    columns,
    name,
    type: MAVA_TYPES.ANNOTATION,
    toManifest: () => ({
      columns,
      description,
      type: MAVA_TYPES.ANNOTATION,
      ...relations({ derivedFrom, method, parent }),
      ...(vian ? { vian } : {})
    })
  }
}

/** Sparse interval annotations with multiple string values per segment. */
function annotationListSeries({ name, description = '', parent, derivedFrom, method, vian }) {
  const columns = ['start_seconds', 'end_seconds', 'annotations']
  return {
    columns,
    name,
    type: MAVA_TYPES.ANNOTATION_LIST,
    toManifest: () => ({
      columns,
      description,
      type: MAVA_TYPES.ANNOTATION_LIST,
      ...relations({ derivedFrom, method, parent }),
      ...(vian ? { vian } : {})
    })
  }
}

module.exports = {
  MAVA_TYPES,
  annotationListSeries,
  annotationSeries,
  dimensionSpec,
  observationSeries
}
