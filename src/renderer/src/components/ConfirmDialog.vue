<template>
  <v-dialog v-model="isOpen" persistent max-width="400">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>

      <v-card-text>{{ text }}</v-card-text>

      <v-card-actions>
        <v-btn color="warning" :text="$t('common.cancel')" @click="cancel"></v-btn>

        <v-btn color="primary" :text="confirmLabel" @click="confirm"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'ConfirmDialog',

  data() {
    return {
      confirmLabel: '',
      isOpen: false,
      resolve: null,
      text: '',
      title: ''
    }
  },

  methods: {
    cancel() {
      this.isOpen = false
      this.resolve(false)
    },

    confirm() {
      this.isOpen = false
      this.resolve(true)
    },

    show({ title, text, confirmLabel }) {
      this.title = title
      this.text = text
      this.confirmLabel = confirmLabel ?? this.$t('common.delete')
      this.isOpen = true
      return new Promise((resolve) => {
        this.resolve = resolve
      })
    }
  }
}
</script>
