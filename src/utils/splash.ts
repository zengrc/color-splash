import registerTouch from './touch';

export interface SplashOptions {
  elm?: Element,
}

export interface Splash {
  reset: (src: HTMLImageElement) => void,
  move: (x: number, y: number) => void
}

const webgl = window.document.createElement('canvas').getContext('webgl');
const webglSupport = !!webgl && webgl instanceof WebGLRenderingContext;

// a_position: 顶点位置
// a_texCoord: 纹理坐标[-1, 1]
// v_texCoord: 从顶点着色器传数据到片元着色器的变量
// u_projection: 从canva坐标系转换成webgl坐标系的变换举证
// u_rotate: 旋转矩阵
// u_translate: 平移矩阵
const vertextSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform mat4 u_projection;
  uniform mat4 u_rotate;
  uniform mat4 u_translate;
  void main(void) {
    gl_Position = u_projection * u_translate * u_rotate * vec4(a_position, 0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// precision mediump float 设置精度
// v_texCoord: 从顶点着色器传过来的变量
// u_image: 图片
const fragmentSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;

  void main() {
    gl_FragColor = texture2D(u_image, v_texCoord);
  }
`;

const pickVertextSource = `
  attribute vec2 a_position;
  uniform mat4 u_projection;
  uniform mat4 u_rotate;
  uniform mat4 u_translate;
  void main(void) {
    gl_Position = u_projection * u_translate * u_rotate * vec4(a_position, 0, 1.0);
  }
`;

const pickFragmentSource = `
  precision mediump float;
  uniform vec4 u_id;

  void main() {
    gl_FragColor = u_id;
  }
`;

const createProjectionMat = (left: number, right: number, top: number, bottom: number) => {
  // 坐标变换矩阵
  // 由于webgl是列为主的顺序，也就是说数组头4个是第一列，接着4个是第二列，如此类推
  return [
    2 / (right - left), 0, 0, 0,
    0, -2 / (bottom - top), 0, 0,
    0, 0, 2, 0,
    -(right + left) / (right - left), (top + bottom) / (bottom - top), -1, 1
  ]
};

const createTranslateMat = (x: number, y: number) => { // 平移矩阵
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, 0, 1
  ]
};

const createRotateMat = (rotate: number) => { // 旋转矩阵
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

const createProgram = (gl: WebGLRenderingContext, vSource: string, fSource: string) => {
  // 编译shader
  const vertextShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vertextShader || !fragmentShader) return;
  gl.shaderSource(vertextShader, vSource);
  gl.shaderSource(fragmentShader, fSource);
  gl.compileShader(vertextShader);
  gl.compileShader(fragmentShader);
  // 创建program
  const program = gl.createProgram();
  if (!program) return;
  gl.attachShader(program, vertextShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  return program;
};

const createFrameBuffer = (gl: WebGLRenderingContext) => {
  const frameBuffer = gl.createFramebuffer();
  if (!frameBuffer) return;
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

  // 为帧缓存声明纹理空间
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  // 将纹理绑定到帧缓存对应的附着点上
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  return frameBuffer;
};

const setAttribute = (gl: WebGLRenderingContext, program: WebGLProgram, data: number[], attribute: string, drawType: number) => {
  // 创建一个buff
  const buffer = gl.createBuffer();
  // 绑定buff到当前操作空间，并把值传给当前buff
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), drawType);
  // 获取顶点属性的在着色器中的索引，并激活它
  const aLocation = gl.getAttribLocation(program, attribute);
  gl.enableVertexAttribArray(aLocation);
  // 设置顶点属性如何从顶点缓冲对象中取值。每次从数组缓冲对象中读取2个值
  gl.vertexAttribPointer(aLocation, 2, gl.FLOAT, false, 0, 0);
};

const setUniformMat = (gl: WebGLRenderingContext, program: WebGLProgram, data: number[], uniform: string) => {
  const uniformLocation = gl.getUniformLocation(program, uniform);
  gl.uniformMatrix4fv(uniformLocation, false, data);
};

const setUniformVec4 = (gl: WebGLRenderingContext, program: WebGLProgram, uniform: string, x: number, y: number, z: number, w: number) => {
  const uniformLocation = gl.getUniformLocation(program, uniform);
  gl.uniform4f(uniformLocation, x, y, z, w);
};

const initWebgl = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl');
  if (!gl) return;
  const program = createProgram(gl, vertextSource, fragmentSource);
  const pickProgram = createProgram(gl, pickVertextSource, pickFragmentSource); // 判断点击时是否击中图片
  const frameBuffer = createFrameBuffer(gl);
  if (!program || !pickProgram || !frameBuffer) return;
  // 设置不变的矩阵
  // 纹理坐标，原点在图片左下角
  // 由于采用TRIANGLE_STRIP绘图，坐标需要是Z字形排列
  const aTexCoord = [
    0.0, 0.0, // 左下
    1.0, 0.0, // 右下
    0.0, 1.0, // 左上
    1.0, 1.0, // 右上
  ];
  const projectionMat = createProjectionMat(0, gl.canvas.width, 0, gl.canvas.height);
  // 
  gl.useProgram(program);
  setAttribute(gl, program, aTexCoord, 'a_texCoord', gl.STATIC_DRAW);
  setUniformMat(gl, program, projectionMat, 'u_projection');
  // 
  gl.useProgram(pickProgram);
  setUniformMat(gl, pickProgram, projectionMat, 'u_projection');
  const u_id = [
    ((1 >>  0) & 0xFF) / 0xFF,
    ((1 >>  8) & 0xFF) / 0xFF,
    ((1 >> 16) & 0xFF) / 0xFF,
    ((1 >> 24) & 0xFF) / 0xFF,
  ];
  setUniformVec4(gl, pickProgram, 'u_id', u_id[0], u_id[1], u_id[2], u_id[3]);

  const size = {
    width: 0,
    height: 0
  };
  const translate = {
    x: 0,
    y: 0
  };
  let rotate = 0;
  const updateDraw = () => {
    gl.clearColor(0, 0, 0, 0);
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
    // 绘制两次，一次在framebuffer上，一次在canvas上，保持两者变换一致
    gl.useProgram(pickProgram)
    // 旋转
    setUniformMat(gl, pickProgram, createRotateMat(rotate), 'u_rotate');
    // 平移
    setUniformMat(gl, pickProgram, createTranslateMat(translate.x, translate.y), 'u_translate');
    // 坐标
    setAttribute(gl, pickProgram, aPosData, "a_position", gl.DYNAMIC_DRAW);
    // 通过bindFramebuffer声明接下来绘制将发生在buffer上
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // bindFramebuffer绑定null，则绘制在canvas上
    gl.useProgram(program);
    setUniformMat(gl, program, createRotateMat(rotate), 'u_rotate');
    setUniformMat(gl, program, createTranslateMat(translate.x, translate.y), 'u_translate');
    setAttribute(gl, program, aPosData, "a_position", gl.DYNAMIC_DRAW);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resetImage = (source: HTMLImageElement) => {
    // 创建一个纹理
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const texture = gl.createTexture();
    if (!texture) return;
    // 绑定纹理到当前操作对象
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // 纹理属性设置
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // 获取着色器中的u_image，并指示其将从纹理0中获取值
    const uImage = gl.getUniformLocation(program, "u_image");
    gl.uniform1i(uImage, 0);
    // 在最开始创建的texture上填充纹理，同时也会在着色器中赋值给u_image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const ratioW = gl.canvas.width / source.width;
    const ratioH = gl.canvas.height / source.height;
    const ratio = Math.min(ratioW, ratioH);
    size.width = source.width * ratio;
    size.height = source.height * ratio;
    translate.x = gl.canvas.width / 2;
    translate.y = gl.canvas.height / 2;
    rotate = 0;
    updateDraw();
  };

  const move = (diffX: number, diffY: number) => {
    translate.x += diffX;
    translate.y += diffY;
    updateDraw();
  };

  const { unregister } = registerTouch(canvas, ({ offsetX, offsetY }) => {
    updateDraw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const pixel = new Uint8Array(4);
    gl.readPixels(offsetX, gl.canvas.height - offsetY, 1 , 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const id = pixel[0] + (pixel[1] << 8) + (pixel[2] << 16) + (pixel[3] << 24);
    gl.useProgram(program);
    if (id === 1) return true;
    return false;
  }, ({ diffX, diffY }) => {
    move(diffX, diffY);
  });

  const destroy = () => {
    unregister();
  };

  return {
    reset: resetImage,
    move,
    destroy
  };
}

export default function init (opt: SplashOptions): Splash | undefined {
  const container = opt.elm || window.document.body;
  const canvas = window.document.createElement('canvas');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.append(canvas);
  return initWebgl(canvas);
}