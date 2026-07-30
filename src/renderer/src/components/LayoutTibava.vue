<!-- eslint-disable vue/enforce-style-attribute -->
<template>
  <SplitterContainer id="toplevel-splitter" layout="vertical" storage-key="layout-tibava-top-level">
    <template #panel1>
      <SplitterContainer :horizontal-breakpoint="700" storage-key="layout-tibava-video-info">
        <template #panel1>
          <v-card class="h-100 w-100">
            <VideoPlayer></VideoPlayer>
          </v-card>
        </template>

        <template #panel2>
          <v-card class="d-flex flex-column h-100 w-100">
            <v-tabs v-model="tab" show-arrows class="flex-0-0">
              <v-tab value="info">{{ $t('pages.video.tabs.info') }}</v-tab>

              <v-tab :disabled="undoableStore.shotTimelines.length == 0" value="shots">
                {{ $t('pages.video.tabs.segmentation') }}
              </v-tab>

              <v-tab value="selection">{{ $t('pages.video.tabs.annotation') }}</v-tab>
            </v-tabs>

            <v-card-text class="d-flex flex-1-1 flex-column height-min-0">
              <v-tabs-window
                id="info-tabs"
                v-model="tab"
                class="d-flex flex-1-1 flex-column height-min-0"
              >
                <v-tabs-window-item value="info">
                  <p v-if="mainStore.fps">{{ $t('pages.video.info.fps') }}: {{ mainStore.fps }}</p>

                  <p v-if="mainStore.height && mainStore.width">
                    {{ $t('pages.video.info.resolution') }}: {{ mainStore.width }} x
                    {{ mainStore.height }}
                  </p>

                  <p v-if="duration">{{ $t('pages.video.info.duration') }}: {{ duration }}</p>

                  <p v-if="mainStore.numFrames">
                    {{ $t('pages.video.info.totalFrames') }}: {{ mainStore.numFrames }}
                  </p>
                </v-tabs-window-item>

                <v-tabs-window-item value="shots" class="h-100">
                  <ShotList></ShotList>
                </v-tabs-window-item>

                <v-tabs-window-item value="selection" class="h-100 overflow-y-auto">
                  <ShotDetail></ShotDetail>
                </v-tabs-window-item>
              </v-tabs-window>
            </v-card-text>
          </v-card>
        </template>
      </SplitterContainer>
    </template>

    <template #panel2>
      <div class="d-flex flex-1-1 flex-column height-min-0">
        <v-card class="d-flex flex-1-1 flex-column height-min-0">
          <v-card-text class="d-flex flex-1-1 flex-column height-min-0">
            <Timelines></Timelines>
          </v-card-text>
        </v-card>
      </div>
    </template>
  </SplitterContainer>
</template>

<script>
import { mapStores } from 'pinia'

import ShotDetail from '@renderer/components/ShotDetail.vue'
import ShotList from '@renderer/components/ShotList.vue'
import SplitterContainer from '@renderer/components/SplitterContainer.vue'
import Timelines from '@renderer/components/Timelines.vue'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import { useMainStore } from '@renderer/stores/main'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'LayoutTibava',
  components: { ShotDetail, ShotList, SplitterContainer, Timelines, VideoPlayer },

  data: () => ({
    tab: null
  }),

  computed: {
    ...mapStores(useMainStore, useUndoableStore),

    duration() {
      if (this.mainStore.numFrames === null) return null
      return this.mainStore.timeReadableFrame(this.mainStore.numFrames)
    }
  }
}
</script>

<style scoped>
#toplevel-splitter {
  height: calc(100vh - 80px);
}
</style>

<!-- eslint-disable-next-line vue/enforce-style-attribute -->
<style>
#info-tabs > .v-window__container {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
