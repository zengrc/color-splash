import XEvent from "./event";

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

const eventList = ['touchStart', 'touchMove', 'touchEnd'] as const;

export default class TouchListener extends XEvent<typeof eventList> {
  touchType = TOUCH_TYPE.SINGLE_TOUCH;
  curTouch: undefined | { x: number, y: number }[] = undefined;
  touchTimer: undefined | number = undefined;
  checkValid: undefined | ((param: TouchCheckParam) => boolean) = undefined;
  rect: DOMRect;
  offsetTop: number;
  offsetLeft: number;
  elm: Element;

  constructor(elm: HTMLCanvasElement) {
    super(eventList);
    this.elm = elm;
    this.rect = elm.getBoundingClientRect();
    this.offsetTop = this.rect.top;
    this.offsetLeft = this.rect.left;

    this.elm.addEventListener('touchstart', this.onTouchStart);
    this.elm.addEventListener('touchmove', this.onTouchMove);
  }

  onTouchStart = (e: Event) => {
    e.preventDefault();
    this.curTouch = undefined;
    window.clearTimeout(this.touchTimer);
    this.touchTimer = window.setTimeout(() => { // 双指不一定同时触发，设一个timeout
      const { touches } = e as TouchEvent;
      if (!touches.length || touches.length > 2) return;
      const touch0 = touches[0];
      const touch1 = touches[1];

      const ret = this.checkValid ? this.checkValid({
        offsetX: touch0.clientX - this.offsetLeft,
        offsetY: touch0.clientY - this.offsetTop
      }) : true;
      if (!ret) return;
      if (touches.length === 1) {
        this.touchType = TOUCH_TYPE.SINGLE_TOUCH;
        this.curTouch = [{ x: touch0.clientX, y: touch0.clientY }];
      } else if (touches.length === 2) {
        this.touchType = TOUCH_TYPE.DOUBLE_TOUCH;
        this.curTouch = [
          { x: touch0.clientX, y: touch0.clientX },
          { x: touch1.clientY, y: touch1.clientY }
        ];
      }
    }, 100);
  };

  onTouchMove = (e: Event) => {
    e.preventDefault()
    if (this.curTouch) {
      const { touches } = e as TouchEvent;
      const touch0 = touches[0];
      // const touch1 = e.touches[1];
      if (this.touchType === TOUCH_TYPE.SINGLE_TOUCH && touch0) {
        const diffX = touch0.clientX - this.curTouch[0].x;
        const diffY = touch0.clientY - this.curTouch[0].y;
        this.curTouch[0].x = touch0.clientX;
        this.curTouch[0].y = touch0.clientY;
        this.emit('touchMove' ,{
          diffX,
          diffY,
          offsetX: touch0.clientX - this.offsetLeft,
          offsetY: touch0.clientY - this.offsetTop
        });
      }
    }
  }

  onTouchEnd = (e: Event) => {
    e.preventDefault()
    if (this.curTouch) {
      this.emit('touchEnd');
    }
  }

  unregister = () => {
    this.elm.removeEventListener('touchstart', this.onTouchStart);
    this.elm.removeEventListener('touchmove', this.onTouchMove);
    this.clear();
  };
}