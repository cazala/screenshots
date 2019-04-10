import puppeteer from 'puppeteer'
import { env } from 'decentraland-commons'
import { Gif } from './Gif'
import { Project, Scene, Metric } from './types'

export const BUILDER_URL = env.get(
  'BUILDER_URL',
  'https://builder-screenshots.now.sh'
)
const SCREEN_WIDTH = +env.get('SCREEN_WIDTH', '1366')
const SCREEN_HEIGHT = +env.get('SCREEN_HEIGHT', '768')

export class Builder {
  private browser: puppeteer.Browser | null = null
  private page: puppeteer.Page | null = null

  async launch(options?: puppeteer.LaunchOptions) {
    if (this.browser != null) return
    console.log('launching puppeteer')
    console.log(
      options && options.headless === false
        ? 'headless: false'
        : 'headless: true'
    )
    this.browser = await puppeteer.launch(options)
  }

  async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser != null) return this.browser
    await this.launch()
    return this.browser!
  }

  async getPage() {
    if (this.page != null) return this.page
    const browser = await this.getBrowser()
    this.page = await browser.newPage()
    if ((await this.page.url()) !== BUILDER_URL) {
      console.log(`navigating to ${BUILDER_URL}`)
      await this.page.goto(BUILDER_URL)
    }
    await this.page.setViewport({
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT
    })
    await this.page.evaluate(() => {
      localStorage.setItem('builder-tutorial', '1')
      localStorage.setItem('builder-shortcut-popup', '1')
      localStorage.setItem('builder-localstorage-toast', '1')
    })
    return this.page
  }

  async load(project: Project, scene: Scene) {
    const page = await this.getPage()
    console.log(`loading project into builder`)
    page.evaluate(
      (project, scene) => {
        const store = (window as any).store
        store.dispatch({
          type: 'Create project',
          payload: { project }
        })
        store.dispatch({
          type: 'Create scene',
          payload: { scene }
        })
      },
      project,
      scene
    )
  }

  async screenshot(project: Project) {
    const page = await this.getPage()

    console.log(`check if scene has content`)
    const isEmpty = await page.evaluate((sceneId: string) => {
      const state = (window as any).store.getState()
      const scene = state.scene.present.data[sceneId] as Scene
      return Object.keys(scene.entities).length === 0
    }, project.sceneId)

    if (isEmpty) {
      throw new Error('Scene is empty')
    }

    console.log('wait for editor to open')
    await page.waitFor('#main-canvas')

    console.log(`waiting for babylon to init`)
    await page.waitFor(() => !document.querySelector('.Preview.loading'))

    console.log(`waiting for scene to provision`)
    let metrics: Metric | null = null
    while (!metrics || metrics.entities === 0) {
      metrics = await page.evaluate((sceneId: string) => {
        const state = (window as any).store.getState()
        const scene = state.scene.present.data[sceneId] as Scene
        return scene.metrics
      }, project.sceneId)
    }

    console.log(`waiting for assets to load`)
    let isLoading = true
    let loops = 0
    while (isLoading) {
      await page.waitFor(100)
      isLoading = await page.evaluate(
        () => !!(window as any).editor.getLoadingEntity()
      )
      loops++
      if (loops % 50 === 0) {
        console.log(`DON'T KILL ME PLEASE 🙏🏻`)
      }
    }

    console.log(`set camera zoom`)
    const side = Math.max(project.layout.cols, project.layout.rows)
    const zoom = (side - 1) * 25
    await page.evaluate(
      zoom => (window as any).editor.setCameraZoomDelta(zoom),
      zoom
    )

    const stepAngle = Math.PI / 16
    let angle = 0
    let step = 0

    const gif = new Gif(
      `${env.get('SCREENSHOTS_PATH', 'screenshots')}/${project.id}.gif`,
      996,
      720
    )

    while (angle < Math.PI * 2) {
      let options: any = {}
      if (step % 4 == 0) {
        const num = (step / 4) | 0
        console.log(`taking screenshots #${num + 1}`)
        options.path = `${env.get('SCREENSHOTS_PATH', 'screenshots')}/${
          project.id
        }-${num}.png`
      }

      await page.evaluate(
        rotation => (window as any).editor.setCameraRotation(rotation),
        angle
      )

      const canvas = await page.$('#main-canvas')
      const buffer = await canvas!.screenshot(options)
      gif.addFrame(buffer)

      angle += stepAngle
      step++
    }
  }

  async remove(project: Project) {
    const page = await this.getPage()
    await page.evaluate(
      project =>
        (window as any).store.dispatch({
          type: 'Delete project',
          payload: { project }
        }),
      project
    )
  }

  async close() {
    if (this.browser) {
      console.log('closing browser')
      await this.browser!.close()
    }
  }
}
