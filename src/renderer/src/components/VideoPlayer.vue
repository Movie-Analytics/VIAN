<template>
  <v-sheet class="align-center d-flex flex-column h-100 w-100">
    <div id="video-grid" class="h-100">
      <video
        ref="video"
        class="height-min-0 ma-auto pa-2"
        crossorigin="anonymous"
        @durationchange="durationChange"
        @timeupdate="videoTimeUpdate"
      >
        <source v-if="mainStore.video !== null" :src="mainStore.video" type="video/mp4" />

        <track
          v-if="undoableStore.subtitles !== null && undoableStore.subtitlesVisible"
          kind="subtitles"
          :src="undoableStore.subtitles"
          default
        />
      </video>

      <div class="d-flex flex-0-0 flex-column">
        <div class="d-flex justify-space-between min-wide-control px-2">
          <div class="align-center d-flex">
            <v-tooltip :text="$t('components.videoPlayer.tooltips.jumpBackward')" location="top">
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="$t('components.videoPlayer.tooltips.jumpBackward')"
                  @click="jumpBackward"
                >
                  <v-icon>mdi-skip-backward</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <v-tooltip :text="$t('components.videoPlayer.tooltips.previousFrame')" location="top">
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="$t('components.videoPlayer.tooltips.previousFrame')"
                  @click="backwardClicked"
                >
                  <v-icon>mdi-step-backward</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <v-tooltip
              :text="
                playingState
                  ? $t('components.videoPlayer.tooltips.pausePlayback')
                  : $t('components.videoPlayer.tooltips.playVideo')
              "
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="
                    playingState
                      ? $t('components.videoPlayer.tooltips.pausePlayback')
                      : $t('components.videoPlayer.tooltips.playVideo')
                  "
                  @click="playPauseClicked"
                >
                  <v-icon v-if="playingState">mdi-pause</v-icon>

                  <v-icon v-else>mdi-play</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <v-tooltip :text="$t('components.videoPlayer.tooltips.nextFrame')" location="top">
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="$t('components.videoPlayer.tooltips.nextFrame')"
                  @click="forwardClicked"
                >
                  <v-icon>mdi-step-forward</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <v-tooltip :text="$t('components.videoPlayer.tooltips.jumpForward')" location="top">
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="$t('components.videoPlayer.tooltips.jumpForward')"
                  @click="jumpForward"
                >
                  <v-icon>mdi-skip-forward</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <v-chip
              v-tooltip="{
                text: $t('components.videoPlayer.playbackRateHelp'),
                location: 'top'
              }"
              class="playback-rate"
              variant="text"
            >
              {{ playbackRate }}x
            </v-chip>

            <p>{{ readableTime }}</p>
          </div>

          <div class="align-center d-flex">
            <v-tooltip
              v-if="pictureInPictureEnabled"
              :text="$t('components.videoPlayer.tooltips.pictureInPicture')"
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="$t('components.videoPlayer.tooltips.pictureInPicture')"
                  @click="pictureInPictureClicked"
                >
                  <v-icon>mdi-picture-in-picture-top-right</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <v-tooltip :text="$t('components.videoPlayer.tooltips.takeScreenshot')" location="top">
              <template #activator="{ props }">
                <v-btn
                  density="comfortable"
                  size="small"
                  icon
                  v-bind="props"
                  :aria-label="$t('components.videoPlayer.tooltips.takeScreenshot')"
                  @click="screenshotClicked"
                >
                  <v-icon>mdi-camera</v-icon>
                </v-btn>
              </template>
            </v-tooltip>

            <div class="volume-control">
              <v-tooltip
                :text="
                  volume === 0
                    ? $t('components.videoPlayer.tooltips.unmuteOrAdjustVolume')
                    : $t('components.videoPlayer.tooltips.adjustVolume')
                "
                location="top"
              >
                <template #activator="{ props }">
                  <v-btn
                    density="comfortable"
                    size="small"
                    icon
                    v-bind="props"
                    :aria-label="
                      volume === 0
                        ? $t('components.videoPlayer.tooltips.unmuteOrAdjustVolume')
                        : $t('components.videoPlayer.tooltips.adjustVolume')
                    "
                    @click.stop="toggleVolumeSlider"
                  >
                    <v-icon>{{ volume === 0 ? 'mdi-volume-mute' : 'mdi-volume-high' }}</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>

              <v-menu
                v-model="showVolumeSlider"
                :close-on-content-click="false"
                location="top"
                offset="10"
              >
                <template #activator="{ props }">
                  <div v-bind="props"></div>
                </template>

                <v-card min-width="50" class="overflow-hidden pa-2">
                  <v-slider
                    v-model="volume"
                    class="volume-slider"
                    direction="vertical"
                    :step="1"
                    :min="0"
                    :max="100"
                    hide-details
                    @update:model-value="updateVolume"
                  >
                  </v-slider>
                </v-card>
              </v-menu>
            </div>

            <v-tooltip
              v-if="undoableStore.subtitles !== null"
              :text="
                undoableStore.subtitlesVisible
                  ? $t('components.videoPlayer.tooltips.hideSubtitles')
                  : $t('components.videoPlayer.tooltips.showSubtitles')
              "
              location="top"
            >
              <template #activator="{ props }">
                <v-btn
                  icon
                  v-bind="props"
                  :aria-label="
                    undoableStore.subtitlesVisible
                      ? $t('components.videoPlayer.tooltips.hideSubtitles')
                      : $t('components.videoPlayer.tooltips.showSubtitles')
                  "
                  @click="toggleSubtitles"
                >
                  <v-icon v-if="undoableStore.subtitlesVisible">mdi-subtitles</v-icon>

                  <v-icon v-else>mdi-subtitles-outline</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </div>
        </div>

        <v-slider
          v-model="sliderPosition"
          :max="mainStore.videoDuration"
          :step="0.1"
          hide-details="true"
          class="px-2"
          @update:model-value="sliderMoved"
        ></v-slider>
      </div>
    </div>
  </v-sheet>
</template>

<script>
import api from '@renderer/api'
import { mapStores } from 'pinia'
import shortcuts from '@renderer/shortcuts'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'VideoPlayer',

  data() {
    return {
      playbackRate: 1,
      playingState: false,
      showVolumeSlider: false,
      sliderPosition: 0,
      volume: 100
    }
  },

  computed: {
    pictureInPictureEnabled() {
      return document.pictureInPictureEnabled
    },

    readableTime() {
      return this.mainStore.timeReadableSec(this.tempStore.playPosition, true)
    },

    ...mapStores(useMainStore, useTempStore, useUndoableStore)
  },

  watch: {
    'tempStore.playJumpPosition'(newValue) {
      // Use a proxy value because updating currentTime based on playPosition
      // directly is prone to timing issues
      if (newValue !== null) {
        this.$refs.video.currentTime = newValue
        this.tempStore.playPosition = newValue
        this.tempStore.playJumpPosition = null
      }
    }
  },

  mounted() {
    // Register event handlers for menu buttons
    api.onTogglePlayback(this.playPauseClicked)
    api.onFrameForward(this.forwardClicked)
    api.onFrameBackward(this.backwardClicked)
    api.onPlaybackForward(this.playForward)
    api.onStopPlayback(this.stopPlayback)
    api.onSegmentPrevious(this.navigateToPreviousSegment)
    api.onSegmentNext(this.navigateToNextSegment)

    shortcuts.register(' ', this.playPauseClicked)
    shortcuts.register('ArrowRight', this.forwardClicked)
    shortcuts.register('ArrowLeft', this.backwardClicked)
    shortcuts.register('k', this.stopPlayback)
    shortcuts.register('l', this.playForward)
    shortcuts.register('ArrowUp', this.navigateToPreviousSegment)
    shortcuts.register('ArrowDown', this.navigateToNextSegment)
    shortcuts.register('Tab', this.navigateToNextSegment)
  },

  beforeUnmount() {
    for (const key of [' ', 'ArrowRight', 'ArrowLeft', 'k', 'l', 'ArrowUp', 'ArrowDown', 'Tab']) {
      shortcuts.clear(key)
    }
  },

  methods: {
    backwardClicked() {
      this.$refs.video.currentTime -= 1 / this.mainStore.fps
    },

    durationChange(event) {
      this.mainStore.videoDuration = event.target.duration
    },

    forwardClicked() {
      this.$refs.video.currentTime += 1 / this.mainStore.fps
    },

    jumpBackward() {
      this.$refs.video.currentTime = Math.max(0, this.$refs.video.currentTime - 5)
    },

    jumpForward() {
      this.$refs.video.currentTime = Math.min(
        this.$refs.video.duration,
        this.$refs.video.currentTime + 5
      )
    },

    navigateToNextSegment() {
      const currentTime = Math.ceil(this.$refs.video.currentTime * this.mainStore.fps)

      if (this.tempStore.selectedSegments.size > 0) {
        const [selectedSegId, selectedTimelId] = this.tempStore.selectedSegments
          .entries()
          .next().value
        const timeline = this.undoableStore.timelines.find((t) => t.id === selectedTimelId)
        const segmentIndex = timeline.data.findIndex((s) => s.id === selectedSegId)
        const nextSegment = timeline.data[segmentIndex + 1] || timeline.data[0]
        this.$refs.video.currentTime = (nextSegment.start || nextSegment.frame) / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[nextSegment.id, timeline.id]])
      } else if (this.undoableStore.shotTimelines.length > 0) {
        const timeline = this.undoableStore.shotTimelines[0]
        const segment = timeline.data.filter((s) => s.start > currentTime)[0] || timeline.data[0]
        this.$refs.video.currentTime = segment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[segment.id, timeline.id]])
      }
    },

    navigateToPreviousSegment() {
      const currentTime = Math.floor(this.$refs.video.currentTime * this.mainStore.fps)

      if (this.tempStore.selectedSegments.size > 0) {
        const [selectedSegId, selectedTimelId] = this.tempStore.selectedSegments
          .entries()
          .next().value
        const timeline = this.undoableStore.timelines.find((t) => t.id === selectedTimelId)
        const segIndex = timeline.data.findIndex((s) => s.id === selectedSegId)
        const nextSegment = timeline.data[segIndex - 1] || timeline.data[timeline.data.length - 1]
        this.$refs.video.currentTime = (nextSegment.start || nextSegment.frame) / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[nextSegment.id, timeline.id]])
      } else if (this.undoableStore.shotTimelines.length > 0) {
        const timeline = this.undoableStore.shotTimelines[0]
        const filtered = timeline.data.filter((s) => s.start < currentTime)
        const segment = filtered[filtered.length - 1] || timeline.data[timeline.data.length - 1]
        this.$refs.video.currentTime = segment.start / this.mainStore.fps
        this.tempStore.selectedSegments = new Map([[segment.id, timeline.id]])
      }
    },

    pictureInPictureClicked() {
      this.$refs.video.requestPictureInPicture()
    },

    playForward() {
      if (this.playbackRate === 16 && this.playingState) {
        this.playbackRate = 1
      } else if (this.playingState) {
        this.playbackRate = Math.min(16, this.playbackRate * 2)
      }
      this.$refs.video.playbackRate = this.playbackRate
      this.$refs.video.play()
      this.playingState = true
    },

    playPauseClicked() {
      if (this.playingState) {
        this.stopPlayback()
      } else {
        this.$refs.video.play()
        this.playingState = true
      }
    },

    screenshotClicked() {
      this.undoableStore.generateScreenshot(
        Math.floor(this.$refs.video.currentTime * this.mainStore.fps)
      )
    },

    sliderMoved(value) {
      this.$refs.video.currentTime = value
    },

    stopPlayback() {
      this.$refs.video.pause()
      this.playingState = false
    },

    toggleSubtitles() {
      this.undoableStore.subtitlesVisible = !this.undoableStore.subtitlesVisible
    },

    toggleVolumeSlider(event) {
      // Don't show slider if it's a double click
      if (event?.detail === 2) return
      this.showVolumeSlider = !this.showVolumeSlider
    },

    updateVolume(value) {
      if (this.$refs.video) {
        this.$refs.video.volume = value / 100
      }
    },

    videoTimeUpdate(event) {
      this.tempStore.playPosition = event.target.currentTime
      this.sliderPosition = event.target.currentTime
    }
  }
}
</script>

<style scoped>
video {
  max-width: 100%;
  max-height: 100%;
}
.min-wide-control {
  min-width: 300px;
}
.playback-rate {
  font-family: monospace;
  font-size: 0.9em;
  min-width: 40px !important;
  opacity: 0.7;
  pointer-events: auto !important;
}
.volume-control {
  position: relative;
  display: flex;
  align-items: center;
}
.volume-slider :deep(> .v-input__control) {
  /* min height sets the height of the slider here */
  min-height: 80px;
}
#video-grid {
  display: grid;
  align-content: center;
}
</style>
