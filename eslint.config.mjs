import electronToolkit from '@electron-toolkit/eslint-config'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from '@vue/eslint-config-prettier'

export default [
  ...pluginVue.configs['flat/recommended'],
  js.configs.recommended,
  js.configs.all,
  electronToolkit,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        $t: 'readonly',
        APP_VERSION: 'readonly',
        IS_ELECTRON: 'readonly'
      },
      sourceType: 'module'
    },
    rules: {
      'capitalized-comments': [
        'error',
        'always',
        {
          ignoreConsecutiveComments: true
        }
      ],
      'class-methods-use-this': 'off',
      'id-length': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
      'max-statements': 'off',
      'no-console': 'off',
      'no-magic-numbers': 'off',
      'no-ternary': 'off',
      'no-warning-comments': 'warn',
      'one-var': 'off',
      'prefer-destructuring': 'off',
      'prefer-template': 'off',
      'sort-imports': [
        'error',
        {
          allowSeparatedGroups: true
        }
      ],
      'sort-keys': 'off',
      'vue/block-lang': 'error',
      'vue/block-order': 'error',
      'vue/block-tag-newline': 'error',
      'vue/component-name-in-template-casing': 'error',
      'vue/component-options-name-casing': 'error',
      'vue/custom-event-name-casing': 'error',
      'vue/define-emits-declaration': 'error',
      'vue/define-macros-order': 'error',
      'vue/define-props-declaration': 'error',
      'vue/enforce-style-attribute': 'error',
      'vue/html-button-has-type': 'error',
      'vue/html-comment-content-newline': 'error',
      'vue/html-comment-content-spacing': 'error',
      'vue/html-comment-indent': 'error',
      'vue/match-component-file-name': 'error',
      'vue/match-component-import-name': 'error',
      'vue/max-lines-per-block': 'error',
      'vue/max-props': 'error',
      'vue/max-template-depth': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/new-line-between-multi-line-property': 'error',
      'vue/next-tick-style': 'error',
      'vue/no-boolean-default': 'error',
      'vue/no-deprecated-delete-set': 'error',
      'vue/no-deprecated-model-definition': 'error',
      'vue/no-duplicate-attr-inheritance': 'error',
      'vue/no-empty-component-block': 'error',
      'vue/no-multiple-objects-in-class': 'error',
      'vue/no-potential-component-option-typo': 'error',
      'vue/no-ref-object-reactivity-loss': 'error',
      'vue/no-required-prop-with-default': 'error',
      'vue/no-restricted-block': 'error',
      'vue/no-restricted-call-after-await': 'error',
      'vue/no-restricted-class': 'error',
      'vue/no-restricted-component-names': 'error',
      'vue/no-restricted-component-options': 'error',
      'vue/no-restricted-custom-event': 'error',
      'vue/no-restricted-html-elements': 'error',
      'vue/no-restricted-props': 'error',
      'vue/no-restricted-static-attribute': 'error',
      'vue/no-restricted-v-bind': 'error',
      'vue/no-restricted-v-on': 'error',
      'vue/no-root-v-if': 'error',
      'vue/no-setup-props-reactivity-loss': 'error',
      'vue/no-static-inline-styles': 'error',
      'vue/no-template-target-blank': 'error',
      'vue/no-this-in-before-route-enter': 'error',
      'vue/no-undef-properties': [
        'error',
        {
          ignores: [
            'mainStore',
            'metaStore',
            'tempStore',
            'undoStore',
            'undoableStore',
            '$router',
            '$route',
            '$t',
            '$i18n',
            '$vuetify'
          ]
        }
      ],
      'vue/no-unsupported-features': 'error',
      'vue/no-unused-emit-declarations': 'error',
      'vue/no-unused-properties': 'error',
      'vue/no-unused-refs': 'error',
      'vue/no-use-v-else-with-v-for': 'error',
      'vue/no-useless-mustaches': 'error',
      'vue/no-useless-v-bind': 'error',
      'vue/no-v-text': 'error',
      'vue/padding-line-between-blocks': 'error',
      'vue/padding-line-between-tags': 'error',
      'vue/padding-lines-in-component-definition': 'error',
      'vue/prefer-define-options': 'error',
      'vue/prefer-prop-type-boolean-first': 'error',
      'vue/prefer-separate-static-class': 'error',
      'vue/prefer-true-attribute-shorthand': 'error',
      'vue/prefer-use-template-ref': 'error',
      'vue/require-default-export': 'error',
      'vue/require-default-prop': 'off',
      'vue/require-direct-export': 'error',
      'vue/require-explicit-slots': 'error',
      'vue/require-macro-variable-name': 'error',
      'vue/require-name-property': 'error',
      'vue/require-typed-object-prop': 'error',
      'vue/require-typed-ref': 'error',
      'vue/script-indent': 'error',
      'vue/slot-name-casing': 'error',
      'vue/sort-keys': 'error',
      'vue/static-class-names-order': 'error',
      'vue/v-for-delimiter-style': 'error',
      'vue/valid-define-options': 'error'
    }
  },
  {
    ignores: [
      '.gitignore',
      '**/typed-router.d.*',
      'node_modules',
      'dist',
      'electron.vite.config*',
      'out',
      'vite_web.config.mjs',
      // port of the mava-exchange format. Keep separate for now till extracted and contributed back to MAVA project.
      'libs/mava-exchange-js/**'
    ]
  }
]
