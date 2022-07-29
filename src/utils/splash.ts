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
  previewElm?: Element
}

export interface Splash {
  reset: (src: HTMLImageElement) => void,
  destroy: () => void,
  SPLASH_MODE: typeof SPLASH_MODE,
  switch: (m: SPLASH_MODE) => void,
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
  const splashSize = 5;
  let mode = SPLASH_MODE.MOVE;
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
    // 绘制两次，一次在framebuffer上，一次在canvas上，保持两者变换一致
    WEBGL.DrawCube(
      gl, pickProgram, frameBuffer,
      [{ mat: aPosData, name: 'a_position', drawType: gl.DYNAMIC_DRAW }],
      [{ mat: translateMat, name: 'u_translate' }, { mat: roateMat, name: 'u_rotate' }],
    );
    WEBGL.DrawCube(
      gl, program, null,
      [{ mat: aPosData, name: 'a_position', drawType: gl.DYNAMIC_DRAW }, { mat: aTexCoord, name: 'a_texCoord', drawType: gl.STATIC_DRAW }],
      [{ mat: translateMat, name: 'u_translate' }, { mat: roateMat, name: 'u_rotate' }],
    );
  };

  const resetImage = (source: HTMLImageElement) => {
    const ratioW = gl.canvas.width / source.width;
    const ratioH = gl.canvas.height / source.height;
    const ratio = Math.min(ratioW, ratioH);
    size.width = source.width * ratio;
    size.height = source.height * ratio;
    translate.x = gl.canvas.width / 2;
    translate.y = gl.canvas.height / 2;
    rotate = 0;
    patchTexture = WEBGL.createTexture(gl, null, size.width, size.height);
    patchBuffer = WEBGL.createFrameBuffer(gl, patchTexture);
    WEBGL.setTexture(gl, program, picTexture, 'u_image', 0, source);
    WEBGL.setTexture(gl, program, patchTexture, 'u_image_patch', 1);
    WEBGL.clear(gl, patchBuffer, 1, 1, 1, 1);
    switchMode(SPLASH_MODE.COLOR);
    // updateDraw();
  };

  const move = (diffX: number, diffY: number, x: number, y: number, preX: number, preY: number) => {
    if (mode === SPLASH_MODE.MOVE) {
      translate.x += diffX;
      translate.y += diffY;
      updateDraw();
    } else {
      patchDraw({x, y}, { x: preX, y: preY });
      updateDraw();
      WEBGL.DrawCircle(gl, null, x, y, splashSize, 1, 1, 1, 0.2, 20, true);
      // WEBGL.DrawCircle(gl, null, offsetX, offsetY, 10, 1, 0, 1, 1);
      previewDraw({ x, y });
    }
  };

  const patchDraw = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    // 由于patchdraw的结果会作为纹理，再下次绘制图片的过程中叠加进去，而纹理和webgl的y轴是相反的，所以投影矩阵，y也得反过来
    const projMat = WEBGL.createProjectionMat(0, size.width, size.height, 0);
    // 由于此时的point是在已经做过旋转平移后的图片基础上获取到的point，需要还原之前的操作
    // 还原1，先平移回原点
    const translateMat1 = WEBGL.createTranslateMat(-translate.x, -translate.y);
    // 还原2，旋转回原角度
    const roateMat = WEBGL.createRotateMat(-rotate);
    // 还原后，移动图片，让其左上角与canvas重叠
    const translateMat2 = WEBGL.createTranslateMat(size.width / 2, size.height / 2);
    // 计算两点间向量
    let v = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len = Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
    v = { x: v.x / len, y: v.y / len }; // 归一
    const v1 = { x: v.y * splashSize, y: -v.x * splashSize }; // 与v垂直的一侧向量，长度splashSize
    const v2 = { x: -v.y * splashSize, y: v.x * splashSize }; // 与v垂直的另一侧向量，长度splashSize

    const p1v1 = { x: v1.x + p1.x, y: v1.y + p1.y };
    const p1v2 = { x: v2.x + p1.x, y: v2.y + p1.y };
    const p2v1 = { x: v1.x + p2.x, y: v1.y + p2.y };
    const p2v2 = { x: v2.x + p2.x, y: v2.y + p2.y };

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
        { mat: translateMat2, name: 'u_translate2' }
      ],
      size.width, size.height,
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

  touchListener.checkValid = ({ offsetX, offsetY }) => {
    updateDraw();
    gl.useProgram(pickProgram)
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const pixel = new Uint8Array(4);
    gl.readPixels(offsetX, gl.canvas.height - offsetY, 1 , 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return WEBGL.isObjUidMatch(1, pixel);
  };

  touchListener.on('touchMove', ({ diffX, diffY, x, y, preX, preY }) => {
    move(diffX, diffY, x, y, preX, preY);
  });

  touchListener.on('touchEnd', ({ x, y }) => {
    if (mode !== SPLASH_MODE.MOVE) {
      updateDraw();
      previewDraw({ x, y });
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
    event: { on: event.on, off: event.off }
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