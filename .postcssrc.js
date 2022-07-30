module.exports = {
  plugins: {
    'postcss-px-to-viewport': {
      viewportWidth: 750,
      unitPrecision: 3,
      viewportUnit: 'vw',
      minPixelValue: 1.1 //所有小于设置的样式都不被转换
    }
  }
}
