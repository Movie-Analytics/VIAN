<template>
  <v-table density="compact">
    <thead>
      <tr>
        <th>{{ $t('components.shortcutsList.headers.shortcut') }}</th>

        <th>{{ $t('components.shortcutsList.headers.description') }}</th>
      </tr>
    </thead>

    <tbody>
      <template v-for="group in groups" :key="group.title">
        <tr class="bg-surface-light">
          <th colspan="2">{{ group.title }}</th>
        </tr>

        <tr v-for="entry in group.entries" :key="entry.action">
          <td class="shortcut-key">{{ entry.key }}</td>

          <td>{{ entry.action }}</td>
        </tr>
      </template>
    </tbody>
  </v-table>
</template>

<script>
export default {
  name: 'ShortcutsList',

  computed: {
    groups() {
      return [
        {
          entries: [
            { action: this.$t('components.shortcutsList.playback.playPause'), key: 'Space' },
            { action: this.$t('components.shortcutsList.playback.nextFrame'), key: '→' },
            { action: this.$t('components.shortcutsList.playback.previousFrame'), key: '←' },
            { action: this.$t('components.shortcutsList.playback.stop'), key: 'k' },
            { action: this.$t('components.shortcutsList.playback.playForward'), key: 'l' },
            { action: this.$t('components.shortcutsList.playback.previousSegment'), key: '↑' },
            {
              action: this.$t('components.shortcutsList.playback.nextSegment'),
              key: '↓ / Tab'
            }
          ],

          title: this.$t('components.shortcutsList.groups.playback')
        },
        {
          entries: [
            {
              action: this.$t('components.shortcutsList.segmentation.deleteSegment'),
              key: 'Delete / Backspace'
            },
            { action: this.$t('components.shortcutsList.segmentation.mergeSegments'), key: 'm' },
            { action: this.$t('components.shortcutsList.segmentation.splitSegment'), key: 'c' },
            { action: this.$t('components.shortcutsList.shotMarking.setInPoint'), key: 'i' },
            { action: this.$t('components.shortcutsList.shotMarking.setOutPoint'), key: 'o' }
          ],

          title: this.$t('components.shortcutsList.groups.segmentation')
        },
        {
          entries: [
            { action: this.$t('components.shortcutsList.editing.undo'), key: 'Ctrl/Cmd + Z' },
            {
              action: this.$t('components.shortcutsList.editing.redo'),
              key: 'Ctrl/Cmd + Shift + Z'
            }
          ],

          title: this.$t('components.shortcutsList.groups.editing')
        }
      ]
    }
  }
}
</script>

<style scoped>
.shortcut-key {
  font-family: monospace;
  white-space: nowrap;
  width: 1%;
}
</style>
