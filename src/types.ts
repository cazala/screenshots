export type Entry = {
  project: Project
  scene: Scene
  contest: Contest
}

export type Project = {
  id: string
  title: string
  description: string
  layout: { cols: number; rows: number }
  parcels: { x: number; y: number }[]
  sceneId: string
  createdAt: number
}

export type Scene = {
  id: string
  entities: Record<string, Entity>
  components: Record<string, Component>
  metrics: Metric
  limits: Metric
  ground: {
    assetId: string
    componentId: string
  }
}

export type Contest = {
  email: string
  ethAddress?: string
  hasAcceptedTerms: boolean
  projects: Record<string, number>
}

export type Entity = {
  id: string
  components: string[]
}

export type Component = {
  id: string
  type: string
  data: any
}

export type Metric = {
  triangles: number
  materials: number
  geometries: number
  bodies: number
  entities: number
  textures: number
}

export type TransformComponent = Component & {
  type: 'Transfrom'
  data: {
    position: {
      x: number
      y: number
      z: number
    }
    rotation: {
      x: number
      y: number
      z: number
      w: number
    }
  }
}

export type GLTFShapeComponent = Component & {
  type: 'GLTFShape'
  data: {
    src: string
  }
}
