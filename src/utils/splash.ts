import registerTouch from './touch';
import './splash.css';
import {
  vertextSource, fragmentSource,
  pickVertextSource, pickFragmentSource,
  splashVertextSource, splashFragmentSource
} from './shader';
import * as WEBGL from './webgl';

export interface SplashOptions {
  elm?: Element,
  previewElm?: Element
}

export interface Splash {
  reset: (src: HTMLImageElement) => void,
  move: (x: number, y: number, offsetX: number, offsetY: number) => void,
  destroy: () => void,
  SPLASH_MODE: typeof SPLASH_MODE,
  switch: (m: SPLASH_MODE) => void
}

export enum SPLASH_MODE {
  MOVE,
  COLOR,
  GRAY
}

const initWebgl = (canvas: HTMLCanvasElement, previewCanvas: HTMLCanvasElement): Splash | undefined => {
  const gl = canvas.getContext('webgl');
  if (!gl) return;
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
  const frameBuffer = WEBGL.createFrameBuffer(gl);
  let patchBuffer: WebGLBuffer | null;
  let patchTexture: WebGLTexture | null;
  const picTexture = WEBGL.createTexture(gl);
  if (!program || !pickProgram || !frameBuffer || !patchProgram || !picTexture) return;
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
  WEBGL.setAttribute(gl, program, aTexCoord, 'a_texCoord', gl.STATIC_DRAW);
  WEBGL.setUniformMat(gl, program, projectionMat, 'u_projection');
  // 不变的变量
  gl.useProgram(pickProgram);
  WEBGL.setUniformMat(gl, pickProgram, projectionMat, 'u_projection');
  const uid = WEBGL.getObjUid(1);
  WEBGL.setUniformVec4(gl, pickProgram, 'u_id', uid);

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
      [{ mat: aPosData, name: 'a_position', drawType: gl.DYNAMIC_DRAW }],
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
    updateDraw();
  };

  const move = (diffX: number, diffY: number, offsetX: number, offsetY: number) => {
    if (mode === SPLASH_MODE.MOVE) {
      translate.x += diffX;
      translate.y += diffY;
      updateDraw();
    } else {
      updateDraw();
      patchDraw({x: offsetX, y: offsetY});
      previewPortion({ x: offsetX, y: offsetY });
    }
  };

  const patchDraw = (point: {x: number, y: number}) => {
    // 由于patchdraw的结果会作为纹理，再下次绘制图片的过程中叠加进去，而纹理和webgl的y轴是相反的，所以投影矩阵，y也得反过来
    const projMat = WEBGL.createProjectionMat(0, size.width, size.height, 0);
    // 由于此时的point是在已经做过旋转平移后的图片基础上获取到的point，需要还原之前的操作
    // 还原1，先平移回原点
    const translateMat1 = WEBGL.createTranslateMat(-translate.x, -translate.y);
    // 还原2，旋转回原角度
    const roateMat = WEBGL.createRotateMat(-rotate);
    // 还原后，移动图片，让其左上角与canvas重叠
    const translateMat2 = WEBGL.createTranslateMat(size.width / 2, size.height / 2);
    const left = point.x - splashSize;
    const top = point.y - splashSize;
    const bottom = point.y + splashSize;
    const right = point.x + splashSize;
    const aPosData = [
      left, bottom,
      right, bottom,
      left, top,
      right, top,
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

  const previewPortion = (center?: { x: number, y: number }) => {
    const previewCTX = previewCanvas.getContext('2d');
    if (!previewCTX) return;
    const data = new Uint8ClampedArray(previewCTX.canvas.width * previewCTX.canvas.height * 4);
    const centerX = center ? center.x : translate.x;
    const centerY = center ? center.y : translate.y;
    const left = centerX - previewCTX.canvas.width / 2;
    const bottom = centerY + previewCTX.canvas.height / 2;
    gl.readPixels(left, gl.canvas.height - bottom, previewCTX.canvas.width, previewCTX.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const imageData = previewCTX.createImageData(previewCTX.canvas.width, previewCTX.canvas.height);
    imageData.data.set(data);
    previewCTX.putImageData(imageData, 0, 0);
  };

  const { unregister } = registerTouch(canvas, ({ offsetX, offsetY }) => {
    updateDraw();
    gl.useProgram(pickProgram)
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const pixel = new Uint8Array(4);
    gl.readPixels(offsetX, gl.canvas.height - offsetY, 1 , 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return WEBGL.isObjUidMatch(1, pixel);
  }, ({ diffX, diffY, offsetX, offsetY }) => {
    move(diffX, diffY, offsetX, offsetY);
  });

  const destroy = () => {
    unregister();
  };

  const switchMode = (m: SPLASH_MODE) => {
    mode = m;
    const previewParent = previewCanvas.parentElement;
    if (m !== SPLASH_MODE.MOVE) {
      if (previewParent) {
        previewParent.style.opacity = '1';
        previewParent.style.pointerEvents = 'none';
        updateDraw();
        previewPortion();
      }
    } else {
      if (previewParent) {
        previewParent.style.opacity = '0';
        previewParent.style.pointerEvents = 'none';
      }
    }
  };

  return {
    reset: resetImage,
    move,
    destroy,
    switch: switchMode,
    SPLASH_MODE
  };
}

export default function init (opt: SplashOptions): Splash | undefined {
  const container = opt.elm || window.document.body;
  const canvas = window.document.createElement('canvas');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.append(canvas);
  // preview container
  let previewContainer: Element;
  const previewCanvas = window.document.createElement('canvas');
  previewCanvas.classList.add('_splash-preview-canvas');
  if (opt.previewElm) {
    previewContainer = opt.previewElm;
    previewCanvas.width = previewContainer.clientWidth;
    previewCanvas.height = previewContainer.clientHeight;
  }
  else {
    previewContainer = window.document.createElement('div');
    previewContainer.classList.add('_splash-preview-container');
    window.document.body.append(previewContainer);
    setTimeout(() => { // append之后，要获取到真实的宽高，需要等一段时间
      previewCanvas.width = previewContainer.clientWidth;
      previewCanvas.height = previewContainer.clientHeight;
    }, 20);
  }
  previewContainer.append(previewCanvas);

  return initWebgl(canvas, previewCanvas);
}