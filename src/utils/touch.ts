export enum TOUCH_TYPE {
  SINGLE_TOUCH, // 单指
  DOUBLE_TOUCH // 双指
}

interface TouchParam {
  diffX: number,
  diffY: number,
  offsetX: number,
  offsetY: number
}

interface TouchCheckParam {
  offsetX: number,
  offsetY: number
}

export default function register (canvas: HTMLCanvasElement, checkValid: (param: TouchCheckParam) => boolean, callback: (param: TouchParam) => void) {
  let touchType = TOUCH_TYPE.SINGLE_TOUCH;
  let curTouch: undefined | {x: number, y: number}[] = undefined;
  let touchTimer: undefined | number = undefined;
  const rect = canvas.getBoundingClientRect();
  const { top: offsetTop, left: offsetLeft } = rect;

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    curTouch = undefined;
    window.clearTimeout(touchTimer);
    touchTimer = window.setTimeout(() => { // 双指不一定同时触发，设一个timeout
      if (!e.touches.length || e.touches.length > 2) return;
      const touch0 = e.touches[0];
      const touch1 = e.touches[1];
      const ret = checkValid({
        offsetX: touch0.clientX - offsetLeft,
        offsetY: touch0.clientY - offsetTop
      });
      if (!ret) return;
      if (e.touches.length === 1) {
        touchType = TOUCH_TYPE.SINGLE_TOUCH;
        curTouch = [{ x: touch0.clientX, y: touch0.clientY }];
      } else if (e.touches.length === 2) {
        touchType = TOUCH_TYPE.DOUBLE_TOUCH;
        curTouch = [
          { x: touch0.clientX, y: touch0.clientX },
          { x: touch1.clientY, y: touch1.clientY }
        ];
      }
    }, 100);
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault()
    if (curTouch) {
      const touch0 = e.touches[0];
      // const touch1 = e.touches[1];
      if (touchType === TOUCH_TYPE.SINGLE_TOUCH && touch0) {
        const diffX = touch0.clientX - curTouch[0].x;
        const diffY = touch0.clientY - curTouch[0].y;
        curTouch[0].x = touch0.clientX;
        curTouch[0].y = touch0.clientY;
        callback({
          diffX,
          diffY,
          offsetX: touch0.clientX - offsetLeft,
          offsetY: touch0.clientY - offsetTop
        });
      }
    }
  }

  canvas.addEventListener('touchstart', onTouchStart);
  canvas.addEventListener('touchmove', onTouchMove);

  const unregister = () => {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
  };

  return {
    unregister
  }
}