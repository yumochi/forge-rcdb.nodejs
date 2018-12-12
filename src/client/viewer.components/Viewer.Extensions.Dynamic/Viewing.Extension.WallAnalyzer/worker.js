
import EdgesGeometry from './EdgesGeometry'
import sortBy from 'lodash/sortBy'
//CSG - Constructive Solid Geometry
import ThreeBSP from './threeCSG'
import THREELib from "three-js"

const THREE = THREELib()

THREE.EdgesGeometry = EdgesGeometry

/////////////////////////////////////////////////////////
// Yumo Notes - Creating mesh for bounding box
//
/////////////////////////////////////////////////////////
function createSectionBoundingMesh (bbox) {

  const geometry = new THREE.BoxGeometry(
    bbox.max.x - bbox.min.x,
    bbox.max.y - bbox.min.y,
    bbox.max.z - bbox.min.z)

  const mesh = new THREE.Mesh(geometry)

  const transform = new THREE.Matrix4()

  transform.makeTranslation((bbox.max.x + bbox.min.x) * 0.5, (bbox.max.y + bbox.min.y) * 0.5,
    (bbox.max.z + bbox.min.z) * 0.5)

  mesh.applyMatrix(transform)

  return mesh
}

/////////////////////////////////////////////////////////
// Function added by Yumo to pass in bounding box for the 
// secctions that the user created
/////////////////////////////////////////////////////////
function postSectionWallMesh(mesh, opts){
    const geometry = mesh.geometry

  const msg = Object.assign({}, {
    matrixWorld: mesh.matrix.elements,
    vertices: geometry.vertices,
    sectionName: mesh.sectionName,
    pathEdges: mesh.pathEdges,
    msgId: 'MSG_ID_SECTION_WALL_MESH',
    faces: geometry.faces,
    dbId: mesh.dbId
  }, opts)

  self.postMessage(msg)
}

/////////////////////////////////////////////////////////
// Function added by Yumo to pass in bounding box for the 
// secctions that the user created
/////////////////////////////////////////////////////////
function postSectionFloorMesh(mesh, opts){
    const geometry = mesh.geometry

  const msg = Object.assign({}, {
    matrixWorld: mesh.matrix.elements,
    vertices: geometry.vertices,
    sectionName: mesh.sectionName,
    pathEdges: mesh.pathEdges,
    msgId: 'MSG_ID_SECTION_FLOOR_MESH',
    faces: geometry.faces,
    dbId: mesh.dbId
  }, opts)

  self.postMessage(msg)
}

/////////////////////////////////////////////////////////
// Function added by Yumo to pass in bounding box for the 
// secctions that the user created
/////////////////////////////////////////////////////////
function postSectionBox(sectionBoundingBoxes){

  const msg = Object.assign({}, {
    boxes:sectionBoundingBoxes,
    msgId: 'MSG_ID_SECTIONBOUNDINGBOX',
  })

  self.postMessage(msg)

}
/////////////////////////////////////////////////////////
// Function added by Yumo to pass in bounding box for the 
// secctions that the user created
/////////////////////////////////////////////////////////
function getBoundingBoxInfo(){

  return new Promise((resolve) => {

    const msgHandler = (event) => {

      if (event.data.msgId === 'MSG_ID_BOUNDINGBOX') {

        const data = event.data

        const bBoxes = event.data['boundingBox']
        // get the bounding box of the event
        let sectionBoundingBoxes = []

        for (let boxKey in bBoxes){
          sectionBoundingBoxes.push([boxKey, bBoxes[boxKey]])
        }

          if (sectionBoundingBoxes.length === data.count) {

            self.removeEventListener(
              'message', msgHandler)

            resolve (sectionBoundingBoxes)
          }
      }
    }

    self.addEventListener('message', msgHandler)
  })

}


/////////////////////////////////////////////////////////
// Function added by Yumo to test simple component mesh rendering
// simple code to test if I can use the worker to render simple 
// mesh for a selected object
/////////////////////////////////////////////////////////
function getComponentTest (category) {

  return new Promise((resolve) => {

    const meshes = []

    const msgHandler = (event) => {

      if (event.data.msgId === 'MSG_ID_COMPONENT_Test') {

        const data = event.data

        if (data.category === category) {

          const mesh = buildComponentMesh (data)

          meshes.push(mesh)

          if (meshes.length === data.count) {

            self.removeEventListener(
              'message', msgHandler)

            resolve (meshes)
          }
        }
      }
    }

    self.addEventListener('message', msgHandler)
  })
}



/////////////////////////////////////////////////////////
// Yumo Notes - This function seems like the interaction handeler 
// between worker and server, ie handels messages 
//
/////////////////////////////////////////////////////////
function getModelInfo () {

  return new Promise((resolve) => {

    const msgHandler = (event) => {

      if (event.data.msgId === 'MSG_ID_MODEL_INFO') {

        self.removeEventListener(
          'message', msgHandler)

        resolve (event.data)
      }
    }

    self.addEventListener('message', msgHandler)
  })
}

/////////////////////////////////////////////////////////
// Yumo Notes - Function to create mesh for the building element
// also provide meta information associated with the meshes

// Get components for categories, right now there seems to 
// be two categories, walls and levels, seems like this is 
// processing messages from server
// It process every one of the component sent over
//
/////////////////////////////////////////////////////////
function getComponents (category) {

  return new Promise((resolve) => {

    const meshes = []

    const msgHandler = (event) => {

      if (event.data.msgId === 'MSG_ID_COMPONENT') {

        const data = event.data

        // if category matches
        if (data.category === category) {

          // build meshes for the element
          const mesh = buildComponentMesh (data)

          meshes.push(mesh)

          if (meshes.length === data.count) {

            self.removeEventListener(
              'message', msgHandler)

            resolve (meshes)
          }
        }
      }
    }

    self.addEventListener('message', msgHandler)
  })
}

/////////////////////////////////////////////////////////
// Yumo Notes - build meshes for the components that are
// retrieved
//
/////////////////////////////////////////////////////////
function buildComponentMesh (data) {
  // data passed in controls numbers of meshes rendered
  const vertexArray = []

  for (let idx=0; idx < data.nbMeshes; ++idx) {

    // get mesh meta data on position indices and stride
    const meshData = {
      positions: data['positions' + idx],
      indices: data['indices' + idx],
      stride: data['stride' + idx]
    }

    getMeshGeometry (meshData, vertexArray)
  }

  // create holder for geometry
  const geometry = new THREE.Geometry()

  // populate the geometry holder
  for (var i = 0; i < vertexArray.length; i += 3) {

    geometry.vertices.push(vertexArray[i])
    geometry.vertices.push(vertexArray[i + 1])
    geometry.vertices.push(vertexArray[i + 2])

    const face = new THREE.Face3(i, i + 1, i + 2)

    geometry.faces.push(face)
  }

  // transform the mesh in world position
  const matrixWorld = new THREE.Matrix4()

  if(data.matrixWorld) {

    matrixWorld.fromArray(data.matrixWorld)
  }

  // create mesh based on meta data
  const mesh = new THREE.Mesh(geometry)

  mesh.applyMatrix(matrixWorld)

  // save bounding box for the mesh
  mesh.boundingBox = data.boundingBox

  // transform the mesh into  Binary Space Partitioning (BSP)
  // create construction solid geometry from mesh
  mesh.bsp = new ThreeBSP(mesh)

  mesh.dbId = data.dbId

  return mesh
}

/////////////////////////////////////////////////////////
// Yumo Notes - Function to get vertices for the mesh shapes
//
/////////////////////////////////////////////////////////
function getMeshGeometry (data, vertexArray) {

  const offsets = [{
    count: data.indices.length,
    index: 0,
    start: 0}
  ]

  for (var oi = 0, ol = offsets.length; oi < ol; ++oi) {

    var start = offsets[oi].start
    var count = offsets[oi].count
    var index = offsets[oi].index

    for (var i = start, il = start + count; i < il; i += 3) {

      const a = index + data.indices[i]
      const b = index + data.indices[i + 1]
      const c = index + data.indices[i + 2]

      const vA = new THREE.Vector3()
      const vB = new THREE.Vector3()
      const vC = new THREE.Vector3()

      vA.fromArray(data.positions, a * data.stride)
      vB.fromArray(data.positions, b * data.stride)
      vC.fromArray(data.positions, c * data.stride)

      vertexArray.push(vA)
      vertexArray.push(vB)
      vertexArray.push(vC)
    }
  }
}

/////////////////////////////////////////////////////////
// Yumo Notes - Function to send mesh information for a building element 
// back for the viewer
/////////////////////////////////////////////////////////
function postWallMesh (mesh, opts) {

  const geometry = mesh.geometry

  const msg = Object.assign({}, {
    matrixWorld: mesh.matrix.elements,
    vertices: geometry.vertices,
    floorDbIds: mesh.floorDbIds,
    pathEdges: mesh.pathEdges,
    msgId: 'MSG_ID_WALL_MESH',
    faces: geometry.faces,
    dbId: mesh.dbId
  }, opts)

  self.postMessage(msg)
}

/////////////////////////////////////////////////////////
// Yumo Notes - Creating mesh for bounding box
//
/////////////////////////////////////////////////////////
function createBoundingMesh (bbox) {

  const geometry = new THREE.BoxGeometry(
    bbox.max.x - bbox.min.x,
    bbox.max.y - bbox.min.y,
    bbox.max.z - bbox.min.z)

  const mesh = new THREE.Mesh(geometry)

  const transform = new THREE.Matrix4()

  transform.makeTranslation(0, 0,
    (bbox.max.z + bbox.min.z) * 0.5)

  mesh.applyMatrix(transform)

  return mesh
}

/////////////////////////////////////////////////////////
// Yumo Notes - Get the hard edges for a mesh
//
/////////////////////////////////////////////////////////
function getHardEdges (mesh, matrix = null) {

  const edgesGeom = new THREE.EdgesGeometry(mesh.geometry)

  const positions = edgesGeom.attributes.position

  matrix = matrix || mesh.matrixWorld

  const edges = []

  for (let idx = 0;
       idx < positions.length;
       idx += (2 * positions.itemSize)) {

    const start = new THREE.Vector3(
      positions.array[idx],
      positions.array[idx + 1],
      positions.array[idx + 2])

    const end = new THREE.Vector3(
      positions.array[idx + 3],
      positions.array[idx + 4],
      positions.array[idx + 5])

    start.applyMatrix4(matrix)

    end.applyMatrix4(matrix)

    edges.push({
      start,
      end
    })
  }

  return edges
}

/////////////////////////////////////////////////////////
// Yumo Notes - Function to save the bounding boxes of the 
// floors
//
/////////////////////////////////////////////////////////
function mergeBoxes (boxes) {

  const mergedBoxes = []

  let height = -Number.MAX_VALUE

  for (let idx = 0; idx < boxes.length; ++idx) {

    const box = boxes[idx]

    const diff = box.max.z - height

    // check if box is worth saving
    if (diff > 0.5) {

      height = box.max.z

      mergedBoxes.push(box)

    } else {

      const lastBox = mergedBoxes[mergedBoxes.length-1]

      lastBox.max.x = Math.max(lastBox.max.x, box.max.x)
      lastBox.max.y = Math.max(lastBox.max.y, box.max.y)

      lastBox.min.x = Math.min(lastBox.min.x, box.min.x)
      lastBox.min.y = Math.min(lastBox.min.y, box.min.y)

      lastBox.dbIds.push(box.dbIds[0])
    }
  }

  return mergedBoxes
}

/////////////////////////////////////////////////////////
// Yumo Notes - main function of worker
//
/////////////////////////////////////////////////////////
async function workerMain () {

  /////////////////////////////////////////////////////////
  // Yumo Notes - get components for floors and wall. Also get
  // model information
  /////////////////////////////////////////////////////////
  const res = await Promise.all([
    getComponents('Floors'),
    getComponents('Walls'),
    getModelInfo(),
    getComponentTest('Component'),
    getBoundingBoxInfo()
  ])

  /////////////////////////////////////////////////////////
  // Yumo Notes - assign the meshes for floor and wall and
  // model information
  /////////////////////////////////////////////////////////
  const floorMeshes = res[0]
  const wallMeshes = res[1]
  const modelInfo = res[2]
  const componentMeshes = res[3]
  let zones = res[4]

  /////////////////////////////////////////////////////////
  // Yumo Notes - get the bounding box of the model
  /////////////////////////////////////////////////////////
  const modelBox = modelInfo.boundingBox

  /////////////////////////////////////////////////////////
  // Yumo Notes - get the bounding box values for each floor
  // note that each floor's x and y are just the model's min
  // and max, also each mesh has a dbId.  
  // This is the threshold that is created for each component
  /////////////////////////////////////////////////////////
  const extBoxes = floorMeshes.map((mesh) => {

    const min = {
      x: modelBox.min.x,
      y: modelBox.min.y,
      z: mesh.boundingBox.min.z
    }

    const max = {
      x: modelBox.max.x,
      y: modelBox.max.y,
      z: mesh.boundingBox.max.z
    }

    return {
      dbIds: [mesh.dbId],
      min,
      max
    }
  })


  /////////////////////////////////////////////////////////
  // Yumo Notes - sort the bounding boxes' meta data for the 
  // floors 
  /////////////////////////////////////////////////////////
  const orderedExtBoxes = sortBy(extBoxes, (box) => {

    return box.min.z
  })

  // last box is model top
  orderedExtBoxes.push({

    min: {
      x: modelBox.min.x,
      y: modelBox.min.y,
      z: modelBox.max.z
    },

    max:{
      x: modelBox.max.x,
      y: modelBox.max.y,
      z: modelBox.max.z
    },

    dbIds: []
  })

  /////////////////////////////////////////////////////////
  // Yumo Notes - use the bounding box information of the floors 
  // to create bounding box for the levels in  a logical way, ie 
  // minimum of the next floor and the max of the current floor 
  // form the bounding box of the current level
  /////////////////////////////////////////////////////////
  const mergedBoxes = mergeBoxes(orderedExtBoxes)

  // create variable to hold bounding boxes and sections boxes for 
  // cutplanes 
  let boxes = {}

  // create variable to hold height for levels 
  let heights = []

  // retrieve relevant height info by interating though mergedBoxes
  // the basic idea here is to assign the bbox min of the current
  // floor to the min of current level and the max of next floor 
  // to max of current level
  for (let idx = 0; idx < mergedBoxes.length-1 ; idx++) {
    // create a name that can be used to identify each level individually
    let levelName = "level".concat(' ', idx+1)
    let level = {
                  'name': levelName,
                  'min': mergedBoxes[idx].min, 
                  'max': mergedBoxes[idx+1].max,
                }
    // store level info in heights            
    heights.push(level)

  }

      // iterate through the zones
    for (let zoneIdx in zones) {
      // iterate through the levels in heights
      for (let levelIdx in heights){
        // create new title
        let level = heights[levelIdx]
        let levelName = level['name']

        let zoneName = zones[zoneIdx][0]
        let zone = zones[zoneIdx][1]
        let title = levelName.concat(' ', zoneName)

        // retrieve the planes in zones

        let planes = zone

        // retrieve the z values min and max of the level
        let levelMin = level['min']['z']
        let levelMax = level['max']['z']  

        planes[2] = [ 0, 0, 1, -levelMax]
        planes[5] = [ 0, 0, -1, levelMin]
        
        // save the new planes in section boxes for x,y axis
        let newBox = planes.map(function(plane) { 
          plane = new THREE.Vector4(...plane) 
          return plane;
        })

        // create min and max to hold max and min of the bounding box
        let bBoxMin = new THREE.Vector3()
        let bBoxMax = new THREE.Vector3()

        // get the min and max x y z of the vectors
        if (-newBox[0]['w'] < newBox[3]['w']){
          bBoxMin['x'] = -newBox[0]['w']
          bBoxMax['x'] = newBox[3]['w']
        } 
        else{
          bBoxMin['x'] = newBox[3]['w']
          bBoxMax['x'] = -newBox[0]['w']
        }

        if (-newBox[1]['w'] < newBox[4]['w']){
          bBoxMin['y'] = -newBox[1]['w']
          bBoxMax['y'] = newBox[4]['w']
        } 
        else{
          bBoxMin['y'] = newBox[4]['w']
          bBoxMax['y'] = -newBox[1]['w']
        }

        if (levelMin < levelMax){
          bBoxMin['z'] = levelMin
          bBoxMax['z'] = levelMax
        } 
        else{
          bBoxMin['z'] = levelMax
          bBoxMax['z'] = levelMin
        }

        // create the bounding box for  the section cut
        let bBox = new THREE.Box3(bBoxMin, bBoxMax)

        // save the bounding box
        boxes[title] = {
          'bBox': bBox, 
          'sBox': newBox
        }

      }
    }

    postSectionBox(boxes)

  // cycling through each floor's bounding box
  for (let idx = mergedBoxes.length-2; idx >= 0 ; --idx) {

    const levelBox = {
      max: mergedBoxes[idx + 1].min,
      min: mergedBoxes[idx].max
    }

    /////////////////////////////////////////////////////////
    // Yumo Notes - creating bounding mesh for each level box
    // and create constructive solide geometry for these boxes
    // Constructive solid geometry allows a modeler to create 
    // a complex surface or object by using Boolean operators 
    // to combine simpler objects.
    /////////////////////////////////////////////////////////

    // create mesh for the bounding box 
    const levelBoundingMesh = createBoundingMesh(levelBox)

    // create binary space partition for the level bounding box
    const levelBSP = new ThreeBSP(levelBoundingMesh)

    // cycle through all the wall mesh
    wallMeshes.forEach((wallMesh) => {
      // check where the level and the wall clash and save the result
      const resultBSP = levelBSP.intersect(wallMesh.bsp)

      // save the intersecting mesh of the two bounding box
      const mesh = resultBSP.toMesh()

      // get the part edges
      const edges = getHardEdges(mesh)

      /////////////////////////////////////////////////////////
      // Yumo Notes - changing edges for the mesh, filtering out edges that 
      // are not in the level box
      /////////////////////////////////////////////////////////
      const filteredEdges = edges.filter((edge) => {

        return (
          (edge.start.z < levelBox.min.z + 0.1) &&
          (edge.end.z   < levelBox.min.z + 0.1)
        )
      })

      // save a floor id for the mesh
      mesh.floorDbIds = mergedBoxes[idx].dbIds

      /////////////////////////////////////////////////////////
      // Yumo Notes - changing edges for the mesh with filtering 
      // edges, notes that the mesh here is still meta data
      /////////////////////////////////////////////////////////

      // set the path edge for the mesh  
      mesh.pathEdges = filteredEdges

      // save dbId for the mesh
      mesh.dbId = wallMesh.dbId

      // post info for the wall
      postWallMesh (mesh, {
        levelCount: mergedBoxes.length-1,
        wallCount: wallMeshes.length,
        level: idx,
        levelBox
      })
    })

  }

    // create mesh for uesr drawn sections
  for (let box in boxes){
      const sectionBox = boxes[box].bBox 
      const sectionBoxMesh = createSectionBoundingMesh(sectionBox)
      const sectionBSP = new ThreeBSP(sectionBoxMesh)

      // interate through floor mesh to see bsp intersect
      floorMeshes.forEach((floorMesh) => {
      // check where the section and the floor intersect and save the result
      const resultBSP = sectionBSP.intersect(floorMesh.bsp)

      // save the intersecting mesh of the two bounding box
      const mesh = resultBSP.toMesh()

      // get the part edges
      const edges = getHardEdges(mesh)

      /////////////////////////////////////////////////////////
      // Yumo Notes - changing edges for the mesh, filtering out edges that 
      // are not in the level box
      /////////////////////////////////////////////////////////
      const filteredEdges = edges.filter((edge) => {

        return (
          (edge.start.z < sectionBox.min.z + 0.1) &&
          (edge.end.z   < sectionBox.min.z + 0.1)
        )
      })

            // save a floor id for the mesh
      mesh.sectionName = box

      /////////////////////////////////////////////////////////
      // Yumo Notes - changing edges for the mesh with filtering 
      // edges, notes that the mesh here is still meta data
      /////////////////////////////////////////////////////////

      // set the path edge for the mesh  
      mesh.pathEdges = filteredEdges

      // save dbId for the mesh
      mesh.dbId = floorMesh.dbId

      // post info for the wall
      postSectionFloorMesh (mesh, {
        sectionCount: Object.keys(boxes).length,
        floorCount: floorMeshes.length,
        section: box,
        sectionBox
      })

    })

    // iterate though wall meshes
    wallMeshes.forEach((wallMesh) => {
    // check where the section and the wall clash and save the result
      const resultBSP = sectionBSP.intersect(wallMesh.bsp)

      // save the intersecting mesh of the two bounding box
      const mesh = resultBSP.toMesh()

      // get the part edges
      const edges = getHardEdges(mesh)

      /////////////////////////////////////////////////////////
      // Yumo Notes - changing edges for the mesh, filtering out edges that 
      // are not in the level box
      /////////////////////////////////////////////////////////
      const filteredEdges = edges.filter((edge) => {

        return (
          (edge.start.z < sectionBox.min.z + 0.1) &&
          (edge.end.z   < sectionBox.min.z + 0.1)
        )
      })

            // save a floor id for the mesh
      mesh.sectionName = box

      /////////////////////////////////////////////////////////
      // Yumo Notes - changing edges for the mesh with filtering 
      // edges, notes that the mesh here is still meta data
      /////////////////////////////////////////////////////////

      // set the path edge for the mesh  
      mesh.pathEdges = filteredEdges

      // save dbId for the mesh
      mesh.dbId = wallMesh.dbId

      // post info for the wall
      postSectionWallMesh (mesh, {
        sectionCount: Object.keys(boxes).length,
        wallCount: wallMeshes.length,
        section: box,
        sectionBox
      })

    })    


  }

  self.close()
}

/////////////////////////////////////////////////////////
// Run the worker
//
/////////////////////////////////////////////////////////
workerMain ()
