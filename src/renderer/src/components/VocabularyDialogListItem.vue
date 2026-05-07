<template>
  <v-list-item
    :active="isSelected"
    :class="{ 'category-container': item.tags }"
    @click="$emit('select')"
  >
    <v-list-item-title v-if="isEditing">
      <v-text-field
        ref="name"
        v-model="editValue"
        density="compact"
        @click.stop=""
        @keydown.stop=""
        @keyup.stop=""
        @keyup.enter="$emit('save', editValue)"
      />
    </v-list-item-title>

    <v-list-item-title v-else>
      {{ item.name }}
    </v-list-item-title>

    <template #append>
      <div v-if="isEditing" class="d-flex">
        <v-btn
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.cancel'),
            location: 'bottom'
          }"
          icon="mdi-close"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.cancel')"
          @click.stop="$emit('cancel')"
        />

        <v-btn
          v-tooltip="{
            text: $t('components.vocabularyDialogListItem.tooltips.save'),
            location: 'bottom'
          }"
          icon="mdi-check"
          variant="text"
          size="small"
          :aria-label="$t('components.vocabularyDialogListItem.tooltips.save')"
          @click.stop="$emit('save', editValue)"
        />
      </div>

      <div v-else class="d-flex">
        <v-menu>
          <template #activator="{ props }">
            <v-btn variant="text" density="compact" icon v-bind="props">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>

          <v-list class="pb-0 pt-0">
            <v-list-item
              :title="$t('components.vocabularyDialogListItem.tooltips.editItem')"
              @click.stop="$emit('edit')"
            ></v-list-item>

            <v-list-item
              v-if="showExport"
              :title="$t('components.vocabularyDialogListItem.tooltips.exportItem')"
              @click.stop="$emit('export', item.id)"
            ></v-list-item>

            <v-list-item
              :title="$t('components.vocabularyDialogListItem.tooltips.deleteItem')"
              @click.stop="$emit('delete', item.id)"
            ></v-list-item>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-list-item>

  <v-list-item v-if="item.tags" class="tag-container">
    <v-list>
      <VocabularyDialogTag
        v-for="tag in item.tags"
        :key="tag.id"
        :item="tag"
        :is-editing="tag.id === editTagId"
        @edit="startEdit(tag.id)"
        @save="saveEdit"
        @delete="deleteTag(tag.id)"
        @cancel="cancelEdit"
      ></VocabularyDialogTag>

      <v-chip variant="outlined" prepend-icon="mdi-plus" class="ma-1" @click="addTag">
        {{
          $t('components.vocabularyDialogList.add', {
            itemType: $t('components.vocabularyDialogList.types.tag')
          })
        }}
      </v-chip>
    </v-list>
  </v-list-item>
</template>

<script>
import VocabularyDialogTag from '@renderer/components/VocabularyDialogTag.vue'
import { mapStores } from 'pinia'
import { useUndoableStore } from '@renderer/stores/undoable'

export default {
  name: 'VocabularyDialogListItem',
  components: { VocabularyDialogTag },

  props: {
    isEditing: {
      type: Boolean
    },

    isSelected: {
      type: Boolean
    },

    item: {
      type: Object,
      required: true
    },

    showExport: {
      type: Boolean
    }
  },

  emits: ['select', 'edit', 'save', 'cancel', 'export', 'delete'],

  data() {
    return {
      editAfterCreation: false,
      editTagId: null,
      editValue: ''
    }
  },

  computed: {
    ...mapStores(useUndoableStore)
  },

  watch: {
    async isEditing(newVal) {
      if (newVal) {
        await this.$nextTick()
        this.$refs.name.focus()
        this.$refs.name.select()
      }
    }
  },

  async mounted() {
    this.editValue = this.item.name
    if (this.isEditing) {
      await this.$nextTick()
      this.$refs.name.focus()
      this.$refs.name.select()
    }
  },

  methods: {
    addTag() {
      const itemType = this.$t('components.vocabularyDialogList.types.tag')
      this.editTagId = this.undoableStore.vocabularyAdd(
        this.item.id,
        this.$t('components.vocabularyDialogList.new', { itemType })
      )
      this.editAfterCreation = true
    },

    cancelEdit() {
      if (this.editAfterCreation) {
        this.deleteTag(this.editTagId)
      }
      this.editTagId = null
      this.editAfterCreation = false
    },

    deleteTag(id) {
      this.undoableStore.vocabularyDelete(id)
    },

    saveEdit(newName) {
      if (this.editTagId) {
        this.undoableStore.vocabularyRename(this.editTagId, newName)
      }
      this.editAfterCreation = false
      this.cancelEdit()
    },

    startEdit(id) {
      this.editTagId = id
    }
  }
}
</script>

<style scoped>
.v-text-field :deep(.v-input__details) {
  display: none;
}
.v-text-field :deep(.v-field__input) {
  padding: 0;
}
.tag-container {
  padding: 0 12px !important;
  margin-bottom: 8px;
  border-radius: 0 0 4px 4px !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-top: 0;
}
.category-container {
  border-radius: 4px 4px 0 0 !important;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: 0;
}
</style>
