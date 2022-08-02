import { circleVertextSource, colorFragmentSource } from './shader';

const webgl = window.document.createElement('canvas').getContext('webgl');
export const support = !!webgl && webgl instanceof WebGLRenderingContext;

let circleProgram: WebGLProgram;

declare global {
  interface WebGLRenderingContext {
    [key: string]: number
  }
}

export const createProgram = (gl: WebGLRenderingContext, vSource: string, fSource: string): null | WebGLProgram => {
  // 编译shader
  const vertextShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vertextShader || !fragmentShader) return null;
  gl.shaderSource(vertextShader, vSource);
  gl.shaderSource(fragmentShader, fSource);
  gl.compileShader(vertextShader);
  gl.compileShader(fragmentShader);
  // 创建program
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertextShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  return program;
};

export function createFrameBuffer (gl: WebGLRenderingContext): null | WebGLFramebuffer
export function createFrameBuffer (gl: WebGLRenderingContext, texture: WebGLTexture | null ): null | WebGLFramebuffer
export function createFrameBuffer (gl: WebGLRenderingContext, width: number, height: number ): null | WebGLFramebuffer
export function createFrameBuffer (gl: WebGLRenderingContext, arg1?: number | WebGLTexture | null, arg2?: number): null | WebGLFramebuffer {
  const frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  if (arg1 !== undefined && typeof arg1 !== 'number' && arg2 === undefined) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, arg1, 0);
  } else if (typeof arg1 === 'number' || arg1 === undefined) {
    const w = arg1 || gl.canvas.width;
    const h = arg2 || gl.canvas.height;
    const curTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
    // 为帧缓存声明纹理空间
    const texture = createTexture(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // 将纹理绑定到帧缓存对应的附着点上
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindTexture(gl.TEXTURE_2D, curTexture);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return frameBuffer;
}

export function createTexture (gl: WebGLRenderingContext): WebGLTexture | null
export function createTexture (gl: WebGLRenderingContext, source: TexImageSource): WebGLTexture | null
export function createTexture (gl: WebGLRenderingContext, source: ArrayBufferView | null, width: number, height: number): WebGLTexture | null
export function createTexture (gl: WebGLRenderingContext, source?: TexImageSource | ArrayBufferView | null, width?: number, height?: number): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  configTeture(gl, texture, source, width, height);

  return texture;
}

export function configTeture (gl: WebGLRenderingContext, texture: WebGLTexture | null, source?: TexImageSource | ArrayBufferView | null, width?: number, height?: number): void {
  // 绑定纹理到当前操作对象
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 纹理属性设置
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  if (width && height) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source as (ArrayBufferView | null));
  } else if (source) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
  }
}

export function setTexture (gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture | null, uniform: string, index: number): void
export function setTexture (gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture | null, uniform: string, index: number, source: TexImageSource): void
export function setTexture (gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture | null, uniform: string, index: number, source: ArrayBufferView | null, width: number, height: number): void
export function setTexture (gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture | null, uniform: string, index: number, source?: TexImageSource | ArrayBufferView | null, width?: number, height?: number): void {
  gl.useProgram(program);
  // 获取着色器中的uniform变量，并指示其将从纹理0中获取值
  const uImage = gl.getUniformLocation(program, uniform);
  gl.uniform1i(uImage, index);
  gl.activeTexture(gl[`TEXTURE${index}`]);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 在texture上填充纹理，同时也会在着色器中赋值给u_image
  if (width && height) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source as (ArrayBufferView | null));
  } else if (source) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
  }
}

export const setAttribute = (gl: WebGLRenderingContext, program: WebGLProgram, data: number[], attribute: string, drawType: number, size = 2): void => {
  // 创建一个buff
  const buffer = gl.createBuffer();
  // 绑定buff到当前操作空间，并把值传给当前buff
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), drawType);
  // 获取顶点属性的在着色器中的索引，并激活它
  const aLocation = gl.getAttribLocation(program, attribute);
  gl.enableVertexAttribArray(aLocation);
  // 设置顶点属性如何从顶点缓冲对象中取值。每次从数组缓冲对象中读取2个值
  gl.vertexAttribPointer(aLocation, size, gl.FLOAT, false, 0, 0);
};

export const setUniformMat = (gl: WebGLRenderingContext, program: WebGLProgram, data: number[], uniform: string): void => {
  const uniformLocation = gl.getUniformLocation(program, uniform);
  gl.uniformMatrix4fv(uniformLocation, false, data);
};

export const setUniformVec4 = (gl: WebGLRenderingContext, program: WebGLProgram, uniform: string, data: number[]): void => {
  const uniformLocation = gl.getUniformLocation(program, uniform);
  gl.uniform4f(uniformLocation, data[0] || 0, data[1] || 0, data[2] || 0, data[3] || 0);
};

export const getObjUid = (index: number): number[] => {
  return [ // 将1拆分成4个部分，每部分8个字节，最大值是255，同时除255(0xff)，归一化，因为webgl绘制的时候颜色范围是0-1
    ((index >>  0) & 0xFF) / 0xFF,
    ((index >>  8) & 0xFF) / 0xFF,
    ((index >> 16) & 0xFF) / 0xFF,
    ((index >> 24) & 0xFF) / 0xFF,
  ];
};

export const isObjUidMatch = (index: number, uid: number[] | Uint8Array | Uint16Array | Uint32Array) => {
  const id = uid[0] + (uid[1] << 8) + (uid[2] << 16) + (uid[3] << 24);
  return id === index;
};

export const createProjectionMat = (left: number, right: number, top: number, bottom: number): number[] => {
  // 坐标变换矩阵
  // 由于webgl是列为主的顺序，也就是说数组头4个是第一列，接着4个是第二列，如此类推
  return [
    2 / (right - left), 0, 0, 0,
    0, -2 / (bottom - top), 0, 0,
    0, 0, 2, 0,
    -(right + left) / (right - left), (top + bottom) / (bottom - top), -1, 1
  ]
};

export const createRotateMat = (rotate: number): number[] => { // 旋转矩阵
  rotate = rotate * Math.PI / 180;
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);
  return [
    cos, sin, 0, 0,
    -sin, cos, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]
};

export const createTranslateMat = (x: number, y: number): number[] => { // 平移矩阵
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, 0, 1
  ]
};

export const createScaleMat = (scale: number): number[] => { // 平移矩阵
  return [
    scale, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]
};

// export const creaateCircleVertext = (center: { x: number, y: number }, radius: number, count: number) => {
//   const list = [];
//   for (let i = 0; i <= )
// }

export const DrawCube = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  frameBuffer: WebGLFramebuffer | null,
  attributes?: { mat: number[], name: string, drawType: number }[],
  uniforms?: { mat: number[], name: string }[],
  width?: number,
  height?: number,
  keep?: boolean,
) => {
  const w = width || gl.canvas.width;
  const h = height || gl.canvas.height;
  gl.viewport(0, 0, w, h);
  gl.useProgram(program),
  // 通过bindFramebuffer声明接下来绘制将发生在buffer上
  // bindFramebuffer绑定null，则绘制在canvas上
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  uniforms?.forEach(uniform => {
    setUniformMat(gl, program, uniform.mat, uniform.name);
  });
  attributes?.forEach(attribute => {
    setAttribute(gl, program, attribute.mat, attribute.name, attribute.drawType);
  });
  if (!keep) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (frameBuffer) gl.bindFramebuffer(gl.FRAMEBUFFER, null); // 将当前绘制空间重新指定为canvas
}

export const DrawCircle = (
  gl: WebGLRenderingContext,
  frameBuffer: WebGLBuffer | null,
  x: number, y: number, radius: number,
  r: number, g: number, b: number, a: number,
  count = 20,
  fill = false,
  projMat?: number[] | null,
  width?: number,
  height?: number,
) : void => {
  circleProgram = circleProgram || createProgram(gl, circleVertextSource, colorFragmentSource);
  if (!circleProgram) return;
  if (a !== 1) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.useProgram(circleProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  const w = width || gl.canvas.width;
  const h = height || gl.canvas.height;
  gl.viewport(0, 0, w, h);
  setUniformMat(gl, circleProgram, projMat || createProjectionMat(0, gl.canvas.width, 0, gl.canvas.height), 'u_projection');
  setUniformMat(gl, circleProgram, createTranslateMat(x, y), 'u_translate');
  setUniformVec4(gl, circleProgram, 'u_color', [r, g, b, a]);
  const radiusLoc = gl.getUniformLocation(circleProgram, 'u_radius');
  gl.uniform1f(radiusLoc, radius);
  const radianUnit = 2 * Math.PI / count;
  const radianData: number[] = [];
  const flagData: number[] = [];
  for (let i = 0; i < count; i += 1) {
    radianData.push(i * radianUnit);
    flagData.push(1);
  }
  let drawShape = gl.LINE_LOOP;
  let drawCount = count;
  if (fill) {
    radianData.unshift(0);
    flagData.push(0);
    drawShape = gl.TRIANGLE_FAN;
    drawCount = radianData.length - 1;
  }
  setAttribute(gl, circleProgram, radianData, 'a_radian', gl.STATIC_DRAW, 1);
  setAttribute(gl, circleProgram, flagData, 'a_flag', gl.STATIC_DRAW, 1);
  gl.drawArrays(drawShape, 0, drawCount);
  if (frameBuffer) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (a !== 1) {
    gl.disable(gl.BLEND);
  }
};

export const clear = (gl: WebGLRenderingContext, frameBuffer: WebGLFramebuffer | null, r: number, g: number, b: number, a: number): void => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  gl.clearColor(r, g, b, a);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}