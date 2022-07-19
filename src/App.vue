<template>
  <div id="app">
    <div id="color-splash"></div>
    <input id="select-photo" type="file" accept="image/*" @change="selectImage" />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import splashInit, { Splash } from './utils/splash';

export default defineComponent({
  name: 'App',
  setup() {
    let splash: Splash | undefined = undefined;

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
              splash?.reset(img);
            }
            img.src = ev.target.result as string;
          }
          (e.target as HTMLInputElement).value = '';
        };
        reader.readAsDataURL(file);
      }
    };

    onMounted(() => {
      const divContainer = window.document.querySelector('#color-splash');
      if (divContainer) {
        splash = splashInit({ elm: divContainer })
      }
    });

    return {
      selectImage
    }
  }
});
</script>

<style>
body {
  margin: auto;
  position: relative;
}

#app, #color-splash {
  width: 100%;
  height: 100vh;
  position: relative;
}

#select-photo {
  opacity: 0;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
