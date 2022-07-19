export interface SplashOptions {
  elm?: Element,
}

export interface Splash {
  reset: (src: HTMLImageElement) => void,
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

const createProgram = (gl: WebGLRenderingContext) => {
  // 编译shader
  const vertextShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vertextShader || !fragmentShader) return;
  gl.shaderSource(vertextShader, vertextSource);
  gl.shaderSource(fragmentShader, fragmentSource);
  gl.compileShader(vertextShader);
  gl.compileShader(fragmentShader);
  // 创建program
  const program = gl.createProgram();
  if (!program) return;
  gl.attachShader(program, vertextShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  return program;
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

const initWebgl = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl');
  if (!gl) return;
  const program = createProgram(gl);
  if (!program) return;
  // 纹理坐标，原点在图片左下角
  // 由于采用TRIANGLE_STRIP绘图，坐标需要是Z字形排列
  const aTexCoord = [
    0.0, 0.0, // 左下
    1.0, 0.0, // 右下
    0.0, 1.0, // 左上
    1.0, 1.0, // 右上
  ];
  setAttribute(gl, program, aTexCoord, 'a_texCoord', gl.STATIC_DRAW);
  const projectionMat = createProjectionMat(0, gl.canvas.width, 0, gl.canvas.height);
  setUniformMat(gl, program, projectionMat, 'u_projection');

  const updateDraw = (width: number, height: number, translate: { x: number, y: number }, rotate: number) => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // 绘制时，让图片中心与canvas左上角重叠
    const left =  -width / 2;
    const right = width / 2;
    const top = -height / 2;
    const bottom = height / 2;
    const aPosData = [
      left, top,
      right, top,
      left, bottom,
      right, bottom,
    ];
    // 旋转
    setUniformMat(gl, program, createRotateMat(rotate), 'u_rotate');
    // 平移
    const _t = { x: width / 2 + translate.x, y: height / 2 + translate.y };
    setUniformMat(gl, program, createTranslateMat(_t.x, _t.y), 'u_translate');
    setAttribute(gl, program, aPosData, "a_position", gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resetImage = (source: HTMLImageElement) => {
    // 创建一个纹理
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

    updateDraw(source.width, source.height, { x: 0, y: 0 }, 0);
  };

  return {
    reset: resetImage
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