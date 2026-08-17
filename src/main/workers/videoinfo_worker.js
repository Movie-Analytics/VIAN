const { workerData, parentPort } = require('worker_threads')

import videoReaderPath from '../../../resources/video_reader.node?asset&asarUnpack'
const videoReader = require(videoReaderPath)

console.log('Started worker to retrieve video info')

const reader = new videoReader.VideoReader(workerData)
if (reader.open()) {
  const fps = reader.getFrameRate()
  const width = reader.getWidth()
  const height = reader.getHeight()
  const numFrames = reader.getNumFrames()
  const codecName = reader.getCodecName()
  const pixelFormat = reader.getPixelFormat()
  const formatName = reader.getFormatName()
  const bitRate = reader.getBitRate()
  parentPort.postMessage({
    bitRate,
    codecName,
    formatName,
    fps,
    height,
    numFrames,
    pixelFormat,
    width
  })
} else {
  parentPort.postMessage({ error: 'no-video-track' })
}
