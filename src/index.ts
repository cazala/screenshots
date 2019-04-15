import { Bucket } from './Bucket'
import { env } from 'decentraland-commons'
import path from 'path'
import fs from 'fs'
import { Entry } from './types'
import { Builder } from './Builder'
import rimraf from 'rimraf'

const page = +env.get('PAGE', '0')
const size = +env.get('SIZE', '5')

console.log(`page: ${page}`)
console.log(`size: ${size}\n`)

const contestBucket = new Bucket(
  env.get('CONTEST_AWS_ACCESS_KEY', ''),
  env.get('CONTEST_AWS_ACCESS_SECRET', ''),
  env.get('CONTEST_AWS_BUCKET_NAME', '')
)

console.log(`contest bucket: ${contestBucket.bucketName}`)

const screenshotsBucket = new Bucket(
  env.get('SCREENSHOTS_AWS_ACCESS_KEY', ''),
  env.get('SCREENSHOTS_AWS_ACCESS_SECRET', ''),
  env.get('SCREENSHOTS_AWS_BUCKET_NAME', '')
)

console.log(`screenshots bucket: ${screenshotsBucket.bucketName}`)

const idsFile = env.get('IDS_PATH', 'ids.json')

let finished = false
let uploadQueue: string[] = []

const screenshotsPath = env.get('SCREENSHOTS_PATH', 'screenshots')

async function main() {
  // remove screenshots
  rimraf.sync('screenshots')
  fs.mkdirSync('screenshots')

  // create builder page object
  const builder = new Builder()
  await builder.launch({
    headless: env.get('CHROME_HEADLESS', 'true') === 'true',
    userDataDir: './userData'
  })
  await builder.getPage()

  // load ids to process
  const idsFilePath = path.resolve(__dirname, '..', idsFile)
  let ids: string[] = require(idsFilePath)

  // get page
  const start = page * size
  const end = start + size
  ids = ids.slice(start, end)

  // upload screenshots
  const uploadPromise = upload()

  const totalTime = Date.now()
  let iteration = 0

  for (const id of ids) {
    iteration++
    try {
      const iterationTime = Date.now()
      console.log(`\nproject id: ${id} (#${iteration})`)
      console.log(`fetching project from bucket`)
      const { project, scene } = (await contestBucket.readFile(id)) as Entry
      const hasScreenshots = await screenshotsBucket.checkFile(
        `${project.id}/preview.gif`
      )
      if (
        hasScreenshots &&
        env.get('SKIP_ALREADY_SCREENSHOTTED', 'true') === 'true'
      ) {
        console.log(
          'skipping this project bacause it has already been processed'
        )
        continue
      }
      await builder.load(project, scene)
      await builder.screenshot(project)
      await builder.remove(project)
      const minutes = (Date.now() - iterationTime) / 60000
      console.log(
        `time: ${minutes | 0} minutes ${((minutes % 1) * 60) | 0} seconds`
      )
      uploadQueue.push(project.id)
    } catch (e) {
      console.error(`\n[${id}] ${e.message}\n`)
      continue
    }
  }
  const minutes = (Date.now() - totalTime) / 60000
  console.log(
    `\ntotal time: ${minutes | 0} minutes ${((minutes % 1) * 60) | 0} seconds\n`
  )
  await builder.close()
  finished = true
  if (uploadQueue.length > 0) {
    console.log('uploading screenshots...')
    await uploadPromise
    console.log('all the screenshots have been uploaded ❤️')
  }
}

async function upload(): Promise<void> {
  if (uploadQueue.length > 0) {
    const ids = [...uploadQueue]
    for (const id of ids) {
      const promises = []
      for (let i = 0; i < 8; i++) {
        const filePath = `${screenshotsPath}/${id}-${i}.png`
        const file = fs.readFileSync(filePath)
        const key = `${id}/screenshot-${i}.png`
        promises.push(screenshotsBucket.uploadFile(key, file))
      }
      const gifPath = `${screenshotsPath}/${id}.gif`
      const file = fs.readFileSync(gifPath)
      const key = `${id}/preview.gif`
      promises.push(screenshotsBucket.uploadFile(key, file))
      await Promise.all(promises)
      uploadQueue = uploadQueue.filter(qid => qid !== id)
    }
  }
  if (uploadQueue.length === 0 && finished) {
    return // yay
  }
  await new Promise(resolve => setTimeout(resolve, 5000))
  return upload()
}

main().catch(console.error)
