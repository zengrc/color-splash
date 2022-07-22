const webgl = window.document.createElement('canvas').getContext('webgl');
export const support = !!webgl && webgl instanceof WebGLRenderingContext;

export const createProgram = (gl: WebGLRenderingContext, vSource: string, fSource: string): undefined | WebGLProgram => {
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

export const createFrameBuffer = (gl: WebGLRenderingContext, width?: number, height?: number): undefined | WebGLFramebuffer => {
  const frameBuffer = gl.createFramebuffer();
  const w = width || gl.canvas.width;
  const h = height || gl.canvas.height;
  if (!frameBuffer) return;
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

  // 为帧缓存声明纹理空间
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  // 将纹理绑定到帧缓存对应的附着点上
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  return frameBuffer;
};

export const createTexture = (gl: WebGLRenderingContext): WebGLTexture | undefined => {
  const texture = gl.createTexture();
  if (!texture) return;
  // 绑定纹理到当前操作对象
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 纹理属性设置
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
};

export const setTextureFromImage = (gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, uniform: string, source: TexImageSource): void => {
  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 获取着色器中的uniform变量，并指示其将从纹理0中获取值
  const uImage = gl.getUniformLocation(program, uniform);
  gl.uniform1i(uImage, 0);
  // 在texture上填充纹理，同时也会在着色器中赋值给u_image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
};

export const setTextureFromData = (gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, uniform: string, width: number, height: number, data: ArrayBufferView | null): void => {
  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // 获取着色器中的uniform变量，并指示其将从纹理0中获取值
  const uImage = gl.getUniformLocation(program, uniform);
  gl.uniform1i(uImage, 0);
  // 在texture上填充纹理，同时也会在着色器中赋值给u_image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
};

export const setAttribute = (gl: WebGLRenderingContext, program: WebGLProgram, data: number[], attribute: string, drawType: number): void => {
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