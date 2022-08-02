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
  uniform mat4 u_scale;
  void main(void) {
    gl_Position = u_projection * u_translate * u_rotate * u_scale * vec4(a_position, 0, 1.0);
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
  uniform sampler2D u_image_patch;

  void main() {
    vec4 texture = texture2D(u_image, v_texCoord);
    vec4 patch = texture2D(u_image_patch, v_texCoord);
    bool flag = true;
    if (patch.r > 0.0) {
      float gray = 0.299 * texture.r + 0.587 * texture.g + 0.114 * texture.b;
      gl_FragColor = vec4(gray, gray, gray, texture.a);
    } else {
      gl_FragColor = texture;
    }
  }
`;

export const splashVertextSource = `
  attribute vec2 a_position;
  uniform mat4 u_projection;
  uniform mat4 u_rotate;
  uniform mat4 u_translate1;
  uniform mat4 u_translate2;
  void main(void) {
    gl_Position = u_projection * u_translate2 * u_rotate * u_translate1 * vec4(a_position, 0, 1.0);
  }
`;

export const splashFragmentSource = `
  precision mediump float;
  uniform int u_mode;

  void main() {
    if (u_mode == 1) {
      gl_FragColor = vec4(1, 1, 1, 1);
    }else {
      gl_FragColor = vec4(0, 0, 0, 0);
    }
  }
`;

export const pickVertextSource = `
  attribute vec2 a_position;
  uniform mat4 u_projection;
  uniform mat4 u_rotate;
  uniform mat4 u_translate;
  uniform mat4 u_scale;
  void main(void) {
    gl_Position = u_projection * u_translate * u_rotate * u_scale * vec4(a_position, 0, 1.0);
  }
`;

export const pickFragmentSource = `
  precision mediump float;
  uniform vec4 u_id;

  void main() {
    gl_FragColor = u_id;
  }
`;

export const previewVertextSource = `
  attribute vec2 a_position;
  uniform mat4 u_projection;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main(void) {
    gl_Position = u_projection * vec4(a_position, 0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

export const previewFragmentSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;

  void main() {
    vec4 texture = texture2D(u_image, v_texCoord);
    gl_FragColor = texture;
  }
`;

// 实心圆用TRIANGLE_FAN画，第一个顶点需要时圆心，此时a_flag设置为0.0，其余圆周上的点a_flag设置1.0
// 空心圆用LINE_LOOP画，所有点都是圆周上的点
export const circleVertextSource = `
  attribute float a_radian;
  attribute float a_flag;
  uniform mat4 u_projection;
  uniform float u_radius;
  uniform mat4 u_translate;

  void main(void) {
    gl_Position = u_projection * u_translate * vec4(a_flag * u_radius * cos(a_radian), a_flag * u_radius * sin(a_radian), 0, 1.0);
  }
`;

export const colorFragmentSource = `
  precision mediump float;
  uniform vec4 u_color;

  void main() {
    gl_FragColor = u_color;
  }
`;