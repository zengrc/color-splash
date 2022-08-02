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
  TOUCH_TYPE = TOUCH_TYPE;
  private curTouch: undefined | { x: number, y: number }[] = undefined;
  private touchTimer: undefined | number = undefined;
  checkValid: undefined | ((param: TouchCheckParam) => boolean) = undefined;
  private rect: DOMRect;
  private offsetTop: number;
  private offsetLeft: number;
  elm: Element;

  constructor(elm: HTMLCanvasElement) {
    super(eventList);
    this.elm = elm;
    this.rect = elm.getBoundingClientRect();
    this.offsetTop = this.rect.top;
    this.offsetLeft = this.rect.left;

    this.elm.addEventListener('touchstart', this.onTouchStart);
    this.elm.addEventListener('touchmove', this.onTouchMove);
    this.elm.addEventListener('touchend', this.onTouchEnd)
  }

  private onTouchStart = (e: Event) => {
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
          { x: touch0.clientX, y: touch0.clientY },
          { x: touch1.clientX, y: touch1.clientY }
        ];
      }
    }, 100);
  };

  private onTouchMove = (e: Event) => {
    e.preventDefault()
    if (this.curTouch) {
      const { touches } = e as TouchEvent;
      const touch0 = touches[0];
      const touch1 = touches[1];
      if (this.touchType === TOUCH_TYPE.SINGLE_TOUCH && touch0) {
        this.emit('touchMove', {
          touches: [
            { x: touch0.clientX - this.offsetLeft, y: touch0.clientY - this.offsetTop },
          ],
          preTouches: [
            { x: this.curTouch[0].x - this.offsetLeft, y: this.curTouch[0].y - this.offsetTop },
          ]
        });
        this.curTouch[0].x = touch0.clientX;
        this.curTouch[0].y = touch0.clientY;
      } else if (this.touchType === TOUCH_TYPE.DOUBLE_TOUCH && touch0 && touch1) {
        this.emit('touchMove', {
          touches: [
            { x: touch0.clientX - this.offsetLeft, y: touch0.clientY - this.offsetTop },
            { x: touch1.clientX - this.offsetLeft, y: touch1.clientY - this.offsetTop }
          ],
          preTouches: [
            { x: this.curTouch[0].x - this.offsetLeft, y: this.curTouch[0].y - this.offsetTop },
            { x: this.curTouch[1].x - this.offsetLeft, y: this.curTouch[1].y - this.offsetTop },
          ]
        });
        this.curTouch[0].x = touch0.clientX;
        this.curTouch[0].y = touch0.clientY;
        this.curTouch[1].x = touch1.clientX;
        this.curTouch[1].y = touch1.clientY;
      }
    }
  }

  private onTouchEnd = (e: Event) => {
    e.preventDefault()
    if (this.curTouch) {
      this.emit('touchEnd', {
        x: this.curTouch[0].x - this.offsetLeft,
        y: this.curTouch[0].y - this.offsetTop
      });
    }
  }

  clear = () => {
    this.elm.removeEventListener('touchstart', this.onTouchStart);
    this.elm.removeEventListener('touchmove', this.onTouchMove);
    this.elm.removeEventListener('touchend', this.onTouchEnd);
    this.clear();
  };
}