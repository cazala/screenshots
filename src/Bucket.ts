import * as AWS from 'aws-sdk'

export class Bucket {
  public bucketName: string
  private s3: AWS.S3

  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string
  ) {
    this.bucketName = bucketName
    this.s3 = new AWS.S3({ accessKeyId, secretAccessKey })
  }

  private promisify<T>(fn: Function) {
    return function(...args: any[]) {
      return new Promise<T>((resolve, reject) =>
        fn.apply(void 0, [
          ...args,
          (error: Error | null, result: T) =>
            error ? reject(error) : resolve(result)
        ])
      )
    }
  }

  async readFile(key: string) {
    const params = {
      Bucket: this.bucketName,
      Key: key
    }
    const file = await this.promisify<AWS.S3.GetObjectOutput>(
      this.s3.getObject.bind(this.s3)
    )(params)
    return this.parseFileBody(file)
  }

  async listFiles(
    continuationToken?: string,
    contents: AWS.S3.ObjectList = []
  ): Promise<AWS.S3.ObjectList> {
    const params: AWS.S3.ListObjectsV2Request = {
      Bucket: this.bucketName
    }
    if (continuationToken) {
      params.ContinuationToken = continuationToken
    }

    const listObjects = this.promisify<AWS.S3.ListObjectsV2Output>(
      this.s3.listObjectsV2.bind(this.s3)
    )
    const data = await listObjects(params)
    contents = contents.concat(data.Contents || [])

    return data.IsTruncated
      ? this.listFiles(data.NextContinuationToken, contents)
      : contents.map(file => this.parseFileBody(file))
  }

  async checkFile(key: string) {
    const params = {
      Bucket: this.bucketName,
      Key: key
    }
    const headObject = this.promisify<boolean>(this.s3.headObject.bind(this.s3))
    try {
      const result = await headObject(params)
      return !!result
    } catch (e) {
      return false
    }
  }

  async uploadFile(key: string, data: Buffer) {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: data,
      ACL: 'public-read'
    }
    return this.promisify<AWS.S3.ManagedUpload>(this.s3.upload.bind(this.s3))(
      params
    )
  }

  parseFileBody(file: AWS.S3.GetObjectOutput) {
    if (file.Body) {
      return JSON.parse(file.Body.toString())
    }
  }
}
