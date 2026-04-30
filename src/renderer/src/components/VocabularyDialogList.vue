<template>
  <v-container>
    <v-row>
      <v-col class="list-column">
        <v-list active-class="v-list-item--active">
          <VocabularyDialogListItem
            v-for="item in items"
            :key="item.id"
            :item="item"
            :is-editing="item.id === editVocabularyId"
            :is-selected="item.id === selectedVocabularyId"
            show-export
            @edit="startEdit('vocabulary', item.id)"
            @save="saveEdit"
            @cancel="cancelEdit"
            @export="exportToFile"
            @delete="deleteVocabulary(item.id)"
            @select="select('vocabulary', item)"
          />

          <v-list-item
            :title="
              $t('components.vocabularyDialogList.add', {
                itemType: $t('components.vocabularyDialogList.types.vocabulary')
              })
            "
            prepend-icon="mdi-plus"
            @click="addVocabulary"
          />
        </v-list>
      </v-col>

      <v-col v-if="selectedVocabularyId" class="list-column">
        <v-list active-class="v-list-item--active">
          <VocabularyDialogListItem
            v-for="item in selectedVocabulary.categories"
            :key="item.id"
            :item="item"
            :is-editing="item.id === editCategoryId"
            :is-selected="item.id === selectedCategoryId"
            @edit="startEdit('category', item.id)"
            @save="saveEdit"
            @cancel="cancelEdit"
            @delete="deleteCategory(item.id)"
            @select="select('category', item)"
          />

          <v-list-item
            :title="
              $t('components.vocabularyDialogList.add', {
                itemType: $t('components.vocabularyDialogList.types.category')
              })
            "
            prepend-icon="mdi-plus"
            @click="addCategory"
          />
        </v-list>
      </v-col>

      <v-spacer v-else></v-spacer>
    </v-row>
  </v-container>
</template>

<script>
import { exportVocabJson } from '@renderer/importexport'
import { mapStores } from 'pinia'
import { useUndoableStore } from '@renderer/stores/undoable'

import VocabularyDialogListItem from '@renderer/components/VocabularyDialogListItem.vue'

export default {
  name: 'VocabularyDialogList',
  components: { VocabularyDialogListItem },

  props: {
    id: { type: [String, null], required: true },
    items: { type: Array, required: true }
  },

  data() {
    return {
      editAfterCreation: false,
      editCategoryId: null,
      editVocabularyId: null,
      selectedCategory: null,
      selectedCategoryId: null,
      selectedVocabulary: null,
      selectedVocabularyId: null
    }
  },

  computed: {
    ...mapStores(useUndoableStore)
  },

  methods: {
    addCategory() {
      const itemType = this.$t('components.vocabularyDialogList.types.category')
      this.editCategoryId = this.undoableStore.vocabularyAdd(
        this.selectedVocabularyId,
        this.$t('components.vocabularyDialogList.new', { itemType })
      )
      this.editAfterCreation = true
    },

    addVocabulary() {
      const itemType = this.$t('components.vocabularyDialogList.types.vocabulary')
      this.editVocabularyId = this.undoableStore.vocabularyAdd(
        this.id,
        this.$t('components.vocabularyDialogList.new', { itemType })
      )
      this.editAfterCreation = true
    },

    cancelEdit() {
      if (this.editVocabularyId && this.editAfterCreation) {
        this.deleteVocabulary(this.editVocabularyId)
      } else if (this.editCategoryId && this.editAfterCreation) {
        this.deleteCategory(this.editCategoryId)
      }
      this.editVocabularyId = null
      this.editCategoryId = null
      this.editAfterCreation = false
    },

    deleteCategory(id) {
      this.undoableStore.vocabularyDelete(id)
      this.selectedCategoryId = null
      this.selectedCategory = null
    },

    deleteVocabulary(id) {
      this.undoableStore.vocabularyDelete(id)
      this.selectedVocabularyId = null
      this.selectedVocabulary = null
    },

    exportToFile(id) {
      exportVocabJson(this.undoableStore.vocabularies.find((v) => v.id === id))
    },

    saveEdit(newName) {
      if (this.editVocabularyId) {
        this.undoableStore.vocabularyRename(this.editVocabularyId, newName)
      } else if (this.editCategoryId) {
        this.undoableStore.vocabularyRename(this.editCategoryId, newName)
      }
      this.editAfterCreation = false
      this.cancelEdit()
    },

    select(itemType, item) {
      if (itemType === 'vocabulary') {
        this.selectedVocabularyId = item.id
        this.selectedVocabulary = item
      } else if (itemType === 'category') {
        this.selectedCategoryId = item.id
        this.selectedCategory = item
      }
    },

    startEdit(itemType, id) {
      if (itemType === 'vocabulary') {
        this.editVocabularyId = id
      } else if (itemType === 'category') {
        this.editCategoryId = id
      }
    }
  }
}
</script>

<style scoped>
.list-column {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
