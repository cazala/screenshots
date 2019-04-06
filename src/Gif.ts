const GIFEncoder = require('gifencoder')
const PNG = require('png-js')
const fs = require('fs')

function decode(png: any) {
  return new Promise(r => {
    png.decode((pixels: any) => r(pixels))
  })
}

export class Gif {
  encoder: any

  constructor(public path: string, width: number, height: number) {
    const encoder = new GIFEncoder(width, height)
    encoder.createWriteStream().pipe(fs.createWriteStream(path))
    encoder.start()
    encoder.setRepeat(0)
    encoder.setDelay(150)
    encoder.setQuality(10)
    this.encoder = encoder
  }

  async addFrame(buffer: any) {
    const png = new PNG(buffer)
    await decode(png).then(pixels => this.encoder.addFrame(pixels))
  }
}
