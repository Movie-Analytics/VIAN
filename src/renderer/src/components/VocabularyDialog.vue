<template>
  <v-dialog v-model="dialogShown" persistent max-width="1000">
    <v-card>
      <v-card-title>{{ $t('components.vocabularyDialog.title') }}</v-card-title>

      <v-card-text>
        <VocabularyDialogList :id="null" :items="undoableStore.vocabularies"></VocabularyDialogList>
      </v-card-text>

      <v-card-actions>
        <v-btn color="primary" @click="importVocab">
          {{ $t('common.import') }}
        </v-btn>

        <v-spacer></v-spacer>

        <v-btn color="primary" @click="dialogShown = false">
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapStores } from 'pinia'

import { importVocabJson } from '@renderer/importexport'
import { useMainStore } from '@renderer/stores/main'
import { useTempStore } from '@renderer/stores/temp'
import { useUndoStore } from '@renderer/stores/undo'
import { useUndoableStore } from '@renderer/stores/undoable'

import VocabularyDialogList from '@renderer/components/VocabularyDialogList.vue'

export default {
  name: 'VocabularyDialog',
  components: { VocabularyDialogList },

  data: () => ({
    dialogShown: false,
    editId: null,
    editModel: ''
  }),

  computed: {
    ...mapStores(useMainStore, useTempStore, useUndoableStore, useUndoStore)
  },

  methods: {
    importVocab() {
      importVocabJson()
    },

    show() {
      this.dialogShown = true
    }
  }
}
</script>
