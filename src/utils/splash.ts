import TouchListener from './touch';
// import './splash.css';
import {
  vertextSource, fragmentSource,
  pickVertextSource, pickFragmentSource,
  splashVertextSource, splashFragmentSource,
  previewVertextSource, previewFragmentSource
} from './shader';
import * as WEBGL from './webgl';
import XEvent from './event';

const splashEvent = ['splash-switch'] as const;
class SplashEvent extends XEvent<typeof splashEvent> {}

export interface SplashOptions {
  elm?: Element,
}

export interface Splash {
  reset: (src: HTMLImageElement) => void,
  destroy: () => void,
  SPLASH_MODE: typeof SPLASH_MODE,
  switch: (m: SPLASH_MODE) => void,
  output: () => string | undefined,
  event: {
    on: SplashEvent['on'],
    off: SplashEvent['off']
  }
}

export enum SPLASH_MODE {
  MOVE,
  COLOR,
  GRAY
}

const initWebgl = (canvas: HTMLCanvasElement): Splash | undefined => {
  const gl = canvas.getContext('webgl');
  if (!gl) return;
  // gl.enable(gl.DEPTH_TEST);
  // gl.depthFunc(gl.LEQUAL);
  const event = new SplashEvent(splashEvent);
  // 绘制变量
  const size = {
    width: 0,
    height: 0
  };
  const translate = {
    x: 0,
    y: 0
  };
  let rotate = 0;
  let scale = 1;
  const minScale = 0.5;
  const maxScale = 3;
  const splashSize = 5;
  let mode = SPLASH_MODE.MOVE;
  const saveInfo: {
    canvas: HTMLCanvasElement | null,
    gl: WebGLRenderingContext | null,
    drawProgram: WebGLProgram | null,
    texTure: WebGLTexture | null,
  } = {
    canvas: null,
    gl: null,
    drawProgram: null,
    texTure: null,
  };
  const sourceInfo = { width: 0, height: 0, patchW: 0, patchH: 0, src: null as (HTMLImageElement | null) };
  // 创建webgl program
  const program = WEBGL.createProgram(gl, vertextSource, fragmentSource);
  const pickProgram = WEBGL.createProgram(gl, pickVertextSource, pickFragmentSource); // 判断点击时是否击中图片
  const patchProgram = WEBGL.createProgram(gl, splashVertextSource, splashFragmentSource); // 灰度或彩色化像素
  const previewProgram = WEBGL.createProgram(gl, previewVertextSource, previewFragmentSource);
  const frameBuffer = WEBGL.createFrameBuffer(gl);
  let patchBuffer: WebGLFramebuffer | null;
  let patchTexture: WebGLTexture | null;
  const touchListener = new TouchListener(canvas);
  const picTexture = WEBGL.createTexture(gl);
  if (!program || !pickProgram || !frameBuffer || !patchProgram || !picTexture || !previewProgram) return;
  // 设置不变的矩阵
  // 纹理坐标，原点在图片左下角
  // 由于采用TRIANGLE_STRIP绘图，坐标需要是Z字形排列
  const aTexCoord = [
    0.0, 0.0, // 左下
    1.0, 0.0, // 右下
    0.0, 1.0, // 左上
    1.0, 1.0, // 右上
  ];
  const projectionMat = WEBGL.createProjectionMat(0, gl.canvas.width, 0, gl.canvas.height);
  // 不变的变量
  gl.useProgram(program);
  WEBGL.setUniformMat(gl, program, projectionMat, 'u_projection');
  // 不变的变量
  gl.useProgram(pickProgram);
  WEBGL.setUniformMat(gl, pickProgram, projectionMat, 'u_projection');
  const uid = WEBGL.getObjUid(1);
  WEBGL.setUniformVec4(gl, pickProgram, 'u_id', uid);
  // 不变的变量
  gl.useProgram(previewProgram);
  WEBGL.setUniformMat(gl, previewProgram, projectionMat, 'u_projection');
  const scaleUnitW = gl.canvas.width / 5;
  const scaleUnitH = gl.canvas.height / 5;
  const previewRect = {
    left: Math.round(scaleUnitW * 3.2),
    right: Math.round(scaleUnitW * 4.7),
    top: Math.round(scaleUnitH * 3.5),
    bottom: Math.round(scaleUnitH * 4.8),
    width: 0,
    height: 0
  };
  previewRect.width = previewRect.right - previewRect.left;
  previewRect.height = previewRect.bottom - previewRect.top;
  const previewAPosData = [
    previewRect.left, previewRect.bottom,
    previewRect.right, previewRect.bottom,
    previewRect.left, previewRect.top,
    previewRect.right, previewRect.top,
  ];

  const updateDraw = () => {
    // 绘制时，让图片中心与canvas左上角重叠
    const left =  -size.width / 2;
    const right = size.width / 2;
    const top = -size.height / 2;
    const bottom = size.height / 2;
    const aPosData = [
      left, top,
      right, top,
      left, bottom,
      right, bottom,
    ];
    const roateMat = WEBGL.createRotateMat(rotate);
    const translateMat = WEBGL.createTranslateMat(translate.x, translate.y);
    const scaleMat = WEBGL.createScaleMat(scale);
    // 绘制两次，一次在framebuffer上，一次在canvas上，保持两者变换一致
    // framebuffer的用来判断点击是否点中图形
    WEBGL.DrawCube(
      gl, pickProgram, frameBuffer,
      [{ mat: aPosData, name: 'a_position', drawType: gl.DYNAMIC_DRAW }],
      [{ mat: translateMat, name: 'u_translate' }, { mat: roateMat, name: 'u_rotate' }, { mat: scaleMat, name: 'u_scale' }],
    );
    WEBGL.DrawCube(
      gl, program, null,
      [{ mat: aPosData, name: 'a_position', drawType: gl.DYNAMIC_DRAW }, { mat: aTexCoord, name: 'a_texCoord', drawType: gl.STATIC_DRAW }],
      [{ mat: translateMat, name: 'u_translate' }, { mat: roateMat, name: 'u_rotate' }, { mat: scaleMat, name: 'u_scale' }],
    );
  };

  const resetImage = (source: HTMLImageElement) => {
    const ratioW = gl.canvas.width / source.width;
    const ratioH = gl.canvas.height / source.height;
    const ratio = Math.min(ratioW, ratioH);
    size.width = source.width * ratio;
    size.height = source.height * ratio;
    sourceInfo.width = source.width;
    sourceInfo.height = source.height;
    sourceInfo.patchW = size.width;
    sourceInfo.patchH = size.height;
    sourceInfo.src = source;
    translate.x = gl.canvas.width / 2;
    translate.y = gl.canvas.height / 2;
    rotate = 0;
    scale = 1;
    patchTexture = WEBGL.createTexture(gl, null, size.width, size.height);
    patchBuffer = WEBGL.createFrameBuffer(gl, patchTexture);
    WEBGL.setTexture(gl, program, picTexture, 'u_image', 0, source);
    WEBGL.setTexture(gl, program, patchTexture, 'u_image_patch', 1);
    WEBGL.clear(gl, patchBuffer, 1, 1, 1, 1);
    switchMode(SPLASH_MODE.COLOR);
    // updateDraw();
  };

  const patchDraw = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    // 由于patchdraw的结果会作为纹理，再下次绘制图片的过程中叠加进去，而纹理和webgl的y轴是相反的，所以投影矩阵，y也得反过来
    // 同时由于涂色是发生在缩小放大之后，实际的矩阵变换应该是放大缩小之后的宽高
    const width = size.width * scale;
    const height = size.height * scale;
    const projMat = WEBGL.createProjectionMat(0, width, height, 0);
    // 由于此时的point是在已经做过旋转平移后的图片基础上获取到的point，需要还原之前的操作
    // 还原1，先平移回原点
    const translateMat1 = WEBGL.createTranslateMat(-translate.x, -translate.y);
    // 还原2，旋转回原角度
    const roateMat = WEBGL.createRotateMat(-rotate);
    // 还原3，还原缩放大小
    const scaleMat = WEBGL.createRotateMat(1 / scale);
    // 还原后，移动图片，让其左上角与canvas重叠
    const translateMat2 = WEBGL.createTranslateMat(width / 2, height / 2);
    // 计算两点间向量
    let p1p2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len = Math.sqrt(Math.pow(p1p2.x, 2) + Math.pow(p1p2.y, 2));
    p1p2 = { x: p1p2.x / len, y: p1p2.y / len }; // 归一
    const v1 = { x: p1p2.y * splashSize, y: -p1p2.x * splashSize }; // 与v垂直的一侧向量，长度splashSize
    const v2 = { x: -p1p2.y * splashSize, y: p1p2.x * splashSize }; // 与v垂直的另一侧向量，长度splashSize

    // 向量p1p2，p1作为起点，需要往反方向扩展splashSize的长度
    const p1v1 = { x: v1.x + p1.x - p1p2.x * splashSize, y: v1.y + p1.y - p1p2.y * splashSize };
    const p1v2 = { x: v2.x + p1.x - p1p2.x * splashSize, y: v2.y + p1.y - p1p2.y * splashSize };
    // 向量p1p2，p2作为终点，需要往正方向扩展splashSize的长度
    const p2v1 = { x: v1.x + p2.x + p1p2.x * splashSize, y: v1.y + p2.y + p1p2.y * splashSize };
    const p2v2 = { x: v2.x + p2.x + p1p2.x * splashSize, y: v2.y + p2.y + p1p2.y * splashSize };

    const aPosData = [
      p1v1.x, p1v1.y,
      p1v2.x, p1v2.y,
      p2v1.x, p2v1.y,
      p2v2.x, p2v2.y,
    ];

    WEBGL.DrawCube(
      gl, patchProgram, patchBuffer,
      [{ mat: aPosData, name: 'a_position', drawType: gl.DYNAMIC_DRAW }],
      [
        { mat: projMat, name: 'u_projection' },
        { mat: roateMat, name: 'u_rotate' },
        { mat: translateMat1, name: 'u_translate1' },
        { mat: translateMat2, name: 'u_translate2' },
        { mat: scaleMat, name: 'u_scale' }
      ],
      size.width, size.height, // 这里的宽高是用来指示画图大小的，上面缩放后的宽高是用来计算坐标位置的对应关系，两者不必相等
      true
    );
  }

  const previewDraw = (center?: { x: number, y: number }) => {
    const readRatio = 1.3;
    const readW = Math.ceil(previewRect.width / readRatio); // 放大1.2倍，所以读取时读小一点
    const readH = Math.ceil(previewRect.height / readRatio); // 放大1.2倍，所以读取时读小一点
    const data = new Uint8ClampedArray(readW * readH * 4);
    const centerX = center ? center.x : translate.x;
    const centerY = center ? center.y : translate.y;
    const left = centerX - readW / 2;
    const bottom = centerY + readH / 2;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(left, gl.canvas.height - bottom, readW, readH, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const previewTeture = gl.createTexture();
    WEBGL.setTexture(gl, previewProgram, previewTeture, 'u_image', 3);
    WEBGL.configTeture(gl, previewTeture, data, readW, readH);
    WEBGL.DrawCube(gl, previewProgram, null, [
      { mat: previewAPosData, name: 'a_position', drawType: gl.STATIC_DRAW },
      { mat: aTexCoord, name: 'a_texCoord', drawType: gl.STATIC_DRAW },
    ], [], gl.canvas.width, gl.canvas.height, true);
  };

  const output = (): string | undefined => {
    if (!sourceInfo.src) return;
    if (!saveInfo.canvas) {
      saveInfo.canvas = document.createElement('canvas');
      saveInfo.gl = saveInfo.canvas.getContext('webgl');
      if (!saveInfo.gl) return;
      saveInfo.drawProgram = WEBGL.createProgram(saveInfo.gl, vertextSource, fragmentSource);
      if (!saveInfo.drawProgram) return;
      saveInfo.texTure = WEBGL.createTexture(saveInfo.gl);
      WEBGL.setTexture(saveInfo.gl, saveInfo.drawProgram, saveInfo.texTure, 'u_image', 0, sourceInfo.src);
    }
    if (!saveInfo.gl || !saveInfo.drawProgram) return;
    saveInfo.canvas.width = sourceInfo.width;
    saveInfo.canvas.height = sourceInfo.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, patchBuffer);
    const data = new Uint8ClampedArray(sourceInfo.patchW * sourceInfo.patchH * 4);
    gl.readPixels(0, 0, sourceInfo.patchW, sourceInfo.patchH, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const pTexture = saveInfo.gl.createTexture();
    WEBGL.setTexture(saveInfo.gl, saveInfo.drawProgram, pTexture, 'u_image_patch', 1);
    WEBGL.configTeture(saveInfo.gl, pTexture, data, sourceInfo.patchW, sourceInfo.patchH);
    
    const left =  0;
    const right = sourceInfo.width;
    const top = 0;
    const bottom = sourceInfo.height;
    const aPosData = [
      left, top,
      right, top,
      left, bottom,
      right, bottom,
    ];
    const roateMat = WEBGL.createRotateMat(0);
    const translateMat = WEBGL.createTranslateMat(0, 0);
    const scaleMat = WEBGL.createScaleMat(1);
    const projMat = WEBGL.createProjectionMat(0, sourceInfo.width, 0, sourceInfo.height);
    WEBGL.DrawCube(
      saveInfo.gl, saveInfo.drawProgram, null,
      [{ mat: aPosData, name: 'a_position', drawType: saveInfo.gl.STATIC_DRAW }, { mat: aTexCoord, name: 'a_texCoord', drawType: saveInfo.gl.STATIC_DRAW }],
      [{ mat: translateMat, name: 'u_translate' }, { mat: roateMat, name: 'u_rotate' }, { mat: projMat, name: 'u_projection' }, { mat: scaleMat, name: 'u_scale' }],
    );

    const ret = saveInfo.canvas.toDataURL();
    return ret;
    // const a = document.createElement('a');
    // a.href = ret;
    // a.download = `IMG${Date.now()}.png`;
    // const ev = new MouseEvent('click', {
    //   bubbles: true,
    //   cancelable: true,
    //   view: window
    // })
    // a.dispatchEvent(ev);
  };

  touchListener.checkValid = ({ offsetX, offsetY }) => {
    updateDraw();
    gl.useProgram(pickProgram)
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const pixel = new Uint8Array(4);
    gl.readPixels(offsetX, gl.canvas.height - offsetY, 1 , 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return WEBGL.isObjUidMatch(1, pixel);
  };

  touchListener.on('touchMove', ({ touches, preTouches }) => {
    if (mode === SPLASH_MODE.MOVE) {
      if (touchListener.touchType === touchListener.TOUCH_TYPE.SINGLE_TOUCH) {
        const diffX = touches[0].x - preTouches[0].x;
        const diffY = touches[0].y - preTouches[0].y;
        translate.x += diffX;
        translate.y += diffY;
      } else if (touchListener.touchType === touchListener.TOUCH_TYPE.DOUBLE_TOUCH) {
        const lenPow = Math.pow(touches[0].x - touches[1].x, 2) + Math.pow(touches[0].y - touches[1].y, 2);
        const preLen = Math.pow(preTouches[0].x - preTouches[1].x, 2) + Math.pow(preTouches[0].y - preTouches[1].y, 2);
        const diffScale = +Math.sqrt(lenPow / preLen).toFixed(2);
        scale *= diffScale;
        const center = { x: (touches[0].x + touches[1].x) / 2, y: (touches[0].y + touches[1].y) / 2 };
        const preCenter = { x: (preTouches[0].x + preTouches[1].x) / 2, y: (preTouches[0].y + preTouches[1].y) / 2 };
        // translate就是目前图案中心的位移
        // 双指中心到图案中心的单位向量不变，长度等于放大缩小的倍数
        // 所以有 (translate - center) = scale * (preTranslate - preCenter)
        translate.x = diffScale * (translate.x - preCenter.x) + center.x;
        translate.y = diffScale * (translate.y - preCenter.y) + center.y;
      }
      updateDraw();
    } else {
      if (touchListener.touchType === touchListener.TOUCH_TYPE.SINGLE_TOUCH) {
        const { x, y } = touches[0];
        const { x: preX, y: preY } = preTouches[0];
        patchDraw({x, y}, { x: preX, y: preY });
        updateDraw();
        WEBGL.DrawCircle(gl, null, x, y, splashSize, 1, 1, 1, 0.2, 20, true);
        // WEBGL.DrawCircle(gl, null, offsetX, offsetY, 10, 1, 0, 1, 1);
        previewDraw({ x, y });
      }
    }
  });

  touchListener.on('touchEnd', ({ x, y }) => {
    if (mode !== SPLASH_MODE.MOVE) {
      updateDraw();
      previewDraw({ x, y });
    } else {
      let tempScale = scale;
      if (scale > maxScale) tempScale = maxScale;
      else if (scale < minScale) tempScale = minScale;
      if (scale !== tempScale) {
        scale = tempScale;
        const diffScale = +(tempScale / scale).toFixed(2);
        translate.x = diffScale * (translate.x - x) + x;
        translate.y = diffScale * (translate.y - y) + y;
        updateDraw();
      }
    }
  });

  const destroy = () => {
    touchListener.clear();
  };

  const switchMode = (m: SPLASH_MODE) => {
    mode = m;
    event.emit('splash-switch', mode);
    if (m !== SPLASH_MODE.MOVE) {
      if (m === SPLASH_MODE.COLOR) {
        gl.useProgram(patchProgram);
        const uMode = gl.getUniformLocation(patchProgram, 'u_mode');
        gl.uniform1i(uMode, 0); // 0相应位置是彩色
      } else if (m === SPLASH_MODE.GRAY) {
        gl.useProgram(patchProgram);
        const uMode = gl.getUniformLocation(patchProgram, 'u_mode');
        gl.uniform1i(uMode, 1); // 1相应位置是灰色
      }
      updateDraw();
    }
  };

  return {
    reset: resetImage,
    destroy,
    switch: switchMode,
    SPLASH_MODE,
    event: { on: event.on, off: event.off },
    output
  };
}

export default function init (opt: SplashOptions): Splash | undefined {
  const container = opt.elm || window.document.body;
  const canvas = window.document.createElement('canvas');
  // canvas.style.background = 'red';
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.append(canvas);

  return initWebgl(canvas);
}