<template>
  <div ref="parent" class="d-flex w-100" :class="{ 'flex-column': isVertical }">
    <div :style="panel1Style" class="d-flex height-min-0">
      <slot name="panel1"></slot>
    </div>

    <div
      class="d-flex justify-center"
      :class="[isVertical ? 'gutter-horizontal' : 'gutter-vertical']"
      @mousedown="onGutterMouseDown"
      @touchstart="onGutterTouchStart"
    >
      <div :class="gutterColor"></div>
    </div>

    <div :style="panel2Style" class="d-flex height-min-0">
      <slot name="panel2"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SplitterContainer',

  props: {
    horizontalBreakpoint: {
      default: null,
      required: false,
      type: Number
    },

    initalPanel1Percent: {
      default: 50,
      required: false,
      type: Number
    },

    layout: {
      default: 'horizontal',
      required: false,
      type: String
    },

    storageKey: {
      default: null,
      required: false,
      type: String
    }
  },

  data() {
    const savedPanel1Percent = this.storageKey
      ? Number.parseFloat(localStorage.getItem(`splitter:${this.storageKey}`))
      : Number.NaN

    const panel1Percent =
      Number.isFinite(savedPanel1Percent) && savedPanel1Percent > 0 && savedPanel1Percent < 100
        ? savedPanel1Percent
        : this.initalPanel1Percent

    return {
      currentLayout: this.layout,
      gutterColor: 'bg-grey-lighten-3',
      isDragging: false,
      mouseMoveListener: null,
      mouseUpListener: null,
      panel1Percent,
      panel2Percent: 100 - panel1Percent,
      resizeObserver: null
    }
  },

  computed: {
    isVertical() {
      return this.currentLayout === 'vertical'
    },

    panel1Style() {
      return {
        'flex-basis': `calc(${this.panel1Percent}% - 7.5px)`
      }
    },

    panel2Style() {
      return {
        'flex-basis': `calc(${this.panel2Percent}% - 7.5px)`
      }
    }
  },

  watch: {
    '$vuetify.theme.global.name'(val) {
      if (val === 'dark') {
        this.gutterColor = 'bg-grey-darken-3'
      } else {
        this.gutterColor = 'bg-grey-lighten-3'
      }
    }
  },

  mounted() {
    if (this.currentLayout === 'horizontal' && this.horizontalBreakpoint !== null) {
      this.resizeObserver = new ResizeObserver(this.handleElementResize)
      this.resizeObserver.observe(this.$refs.parent)
    }
  },

  beforeUnmount() {
    if (this.resizeObserver !== null) {
      this.resizeObserver.unobserve(this.$refs.parent)
    }
  },

  methods: {
    handleElementResize(e) {
      if (e[0].contentRect.width < this.horizontalBreakpoint) {
        this.currentLayout = 'vertical'
      } else {
        this.currentLayout = 'horizontal'
      }
    },

    mouseMove(e) {
      this.resize(e)
    },

    mouseUp() {
      document.removeEventListener('mousemove', this.mouseMove)
      document.removeEventListener('mouseup', this.mouseUp)

      if (this.storageKey) {
        localStorage.setItem(`splitter:${this.storageKey}`, String(this.panel1Percent))
      }
    },

    onGutterMouseDown(e) {
      this.resizeStart(e)
    },

    onGutterTouchStart(e) {
      this.resizeStart(e)
    },

    resize(e) {
      e.preventDefault()

      const rect = this.$refs.parent.getBoundingClientRect()
      const mousePos =
        this.currentLayout === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top
      const parentSize =
        this.currentLayout === 'horizontal'
          ? this.$refs.parent.offsetWidth
          : this.$refs.parent.offsetHeight

      const requestedPercent = (mousePos / parentSize) * 100
      const panel1Percent = Math.min(95, Math.max(5, requestedPercent))

      this.panel1Percent = panel1Percent
      this.panel2Percent = 100 - panel1Percent
    },

    resizeStart(e) {
      e.preventDefault()
      document.addEventListener('mousemove', this.mouseMove)
      document.addEventListener('mouseup', this.mouseUp)
    }
  }
}
</script>

<style scoped>
.gutter-horizontal {
  cursor: ns-resize;
  height: 10px;
}
.gutter-horizontal > div {
  height: 3px;
  width: calc(100% - 100px);
  min-width: 50px;
  align-self: center;
}

.gutter-vertical {
  cursor: ew-resize;
  width: 15px;
  min-height: 100%;
  align-self: stretch;
}
.gutter-vertical > div {
  width: 3px;
  height: calc(100% - 100px);
  min-height: 50px;
  margin: auto;
}
</style>
