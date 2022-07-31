<template>
  <div id="app">
    <div id="color-splash"></div>
    <div class="btn-list">
      <div class="btn">
        选择图片
        <input id="select-photo" type="file" accept="image/*" @change="selectImage" />
      </div>
      <div class="btn" @click="switchMode(SPLASH_MODE.COLOR)" :class="{ actived: mode === SPLASH_MODE.COLOR }">
        涂色
      </div>
      <div class="btn" @click="switchMode(SPLASH_MODE.GRAY)" :class="{ actived: mode === SPLASH_MODE.GRAY }">
        涂灰
      </div>
      <div class="btn" @click="switchMode(SPLASH_MODE.MOVE)" :class="{ actived: mode === SPLASH_MODE.MOVE }">
        移动图片
      </div>
      <div class="btn" @click="onSave">
        保存
      </div>
    </div>
    <div id="splash-preview"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import splashInit, { Splash, SPLASH_MODE } from './utils/splash';

export default defineComponent({
  name: 'App',
  setup() {
    const splash = ref<Splash>();
    const mode = ref<SPLASH_MODE>();

    const selectImage = (e: Event) => {
      if (!splash) {
        (e.target as HTMLInputElement).value = '';
        return;
      }
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target && ev.target.result) {
            const img = new Image();
            img.onload = () => {
              splash.value?.reset(img);
            }
            img.src = ev.target.result as string;
          }
          (e.target as HTMLInputElement).value = '';
        };
        reader.readAsDataURL(file);
      }
    };

    const switchMode = (mode: SPLASH_MODE) => {
      splash.value?.switch(mode);
    };

    const onSave = () => {
      splash.value?.save();
    };

    onMounted(() => {
      const divContainer = window.document.querySelector('#color-splash');
      const previewContainer = window.document.querySelector('#splash-preview');
      if (divContainer && previewContainer) {
        splash.value = splashInit({ elm: divContainer, previewElm: previewContainer });
        splash.value?.event.on('splash-switch', (m) => {
          mode.value = m;
        })
      }
    });

    return {
      selectImage,
      splash,
      switchMode,
      SPLASH_MODE,
      mode,
      onSave
    }
  }
});
</script>

<style>
body {
  margin: auto;
  position: relative;
  background: black;
}
</style>

<style lang="scss" scoped>

#app, #color-splash {
  width: 100%;
  height: 100vh;
  position: relative;
}

.btn-list {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.btn {
  flex-shrink: 0;
  width: 200px;
  height: 48px;
  border: solid 1px rgb(255, 85, 0);
  background: linear-gradient(lightcoral, lightsalmon);
  border-radius: 18px;
  color: rgb(52, 40, 40);
  font-size: 32px;
  line-height: 48px;
  text-align: center;
  margin: 10px 10px;
  overflow: hidden;
  position: relative;
  &.actived {
    background: linear-gradient(rgb(75, 247, 227), rgb(75, 195, 251));
    border: solid 1px rgb(183, 255, 245);
    color: rgb(16, 50, 14);
  }
}

#select-photo {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}

#splash-preview {
  position: absolute;
  bottom: 50px;
  right: 50px;
  width: 200px;
  height: 300px;
}
</style>
