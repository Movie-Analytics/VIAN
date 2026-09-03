<template>
  <v-dialog v-model="isOpen" max-width="500">
    <v-card :title="$t('components.mergeAnnotationsDialog.title')">
      <v-card-text>
        <v-checkbox
          v-for="item in items"
          :key="item.id"
          v-model="item.selected"
          :label="item.annotation"
          hide-details
        ></v-checkbox>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>

        <v-btn color="warning" :text="$t('common.cancel')" @click="cancel"></v-btn>

        <v-btn color="primary" :text="$t('common.merge')" @click="confirm"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'MergeAnnotationsDialog',

  data() {
    return {
      isOpen: false,
      items: [],
      resolve: null
    }
  },

  methods: {
    cancel() {
      this.isOpen = false
      this.resolve(null)
    },

    confirm() {
      this.isOpen = false
      this.resolve(
        this.items
          .filter((item) => item.selected)
          .map((item) => item.annotation)
          .join('\n')
      )
    },

    show(annotations) {
      this.items = annotations.map((annotation, index) => ({
        annotation,
        id: index,
        selected: true
      }))
      this.isOpen = true
      return new Promise((resolve) => {
        this.resolve = resolve
      })
    }
  }
}
</script>
