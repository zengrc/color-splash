// a_position: 顶点位置
// a_texCoord: 纹理坐标[-1, 1]
// v_texCoord: 从顶点着色器传数据到片元着色器的变量
// u_projection: 从canva坐标系转换成webgl坐标系的变换举证
// u_rotate: 旋转矩阵
// u_translate: 平移矩阵
export const vertextSource = `
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
export const fragmentSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;

  void main() {
    gl_FragColor = texture2D(u_image, v_texCoord);
  }
`;

export const splashVertextSource = `
  attribute vec2 a_position;
  uniform mat4 u_projection;
  uniform mat4 u_translate;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main(void) {
    gl_Position = u_projection * u_translate * vec4(a_position, 0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

export const splashFragmentSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;

  void main() {
    vec4 texture = texture2D(u_image, v_texCoord);
    float lumi = 0.299 * texture.r + 0.587 * texture.g + 0.114 * texture.b;
    gl_FragColor = vec4(lumi, lumi, lumi, 1);
  }
`;

export const pickVertextSource = `
  attribute vec2 a_position;
  uniform mat4 u_projection;
  uniform mat4 u_rotate;
  uniform mat4 u_translate;
  void main(void) {
    gl_Position = u_projection * u_translate * u_rotate * vec4(a_position, 0, 1.0);
  }
`;

export const pickFragmentSource = `
  precision mediump float;
  uniform vec4 u_id;

  void main() {
    gl_FragColor = u_id;
  }
`;