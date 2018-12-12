/////////////////////////////////////////////////////////
// Viewing.Extension.WallAnalyzerModified
// Author - Yumo Chi - yumochi2@illinois.edu
//
// built and modified based on work by Philippe Leefsma, May 2017
//
// The goal of this extension is to allow user to further granularized BIM models
/////////////////////////////////////////////////////////
import MultiModelExtensionBase from 'Viewer.MultiModelExtensionBase'
import MeshPropertyPanel from './MeshPropertyPanel'
import Worker from 'worker-loader!./worker.js'
import './Viewing.Extension.WallAnalyzer.scss'
import WidgetContainer from 'WidgetContainer'
import EventTool from 'Viewer.EventTool'
import Toolkit from 'Viewer.Toolkit'
import { ReactLoader } from 'Loader'
import Switch from 'Switch'
import React from 'react'
import d3 from 'd3'

import Button from 'react-bootstrap/lib/Button';
import FormControl from 'react-bootstrap/lib/FormControl';
import DropdownButton from 'react-bootstrap/lib/DropdownButton';
import MenuItem from 'react-bootstrap/lib/MenuItem';

import ThreeBSP from './threeCSG';

class WallAnalyzerExtension extends MultiModelExtensionBase {

  /////////////////////////////////////////////////////////
  // Class constructor
  //
  /////////////////////////////////////////////////////////
  constructor (viewer, options) {

    super (viewer, options)

    this.onLevelWallsClicked = this.onLevelWallsClicked.bind(this)
    this.onLevelFloorClicked = this.onLevelFloorClicked.bind(this)
    this.onEnableWireFrame = this.onEnableWireFrame.bind(this)
    this.onWorkerMessage = this.onWorkerMessage.bind(this)
    this.onMouseMove = this.onMouseMove.bind(this)
    this.renderTitle = this.renderTitle.bind(this)

    // function added to find all dbID
    this.getAlldbIds = this.getAlldbIds.bind(this)

    // function added to control message from worker
    this.onWorkerMessageWrapper = this.onWorkerMessageWrapper.bind(this)
    this.onWorkerMessageProcessSection = this.onWorkerMessageProcessSection.bind(this)

    // function added to render meshes for section
    this.onSectionFloorClicked = this.onSectionFloorClicked.bind(this)

    // function added for paper
    // add preprocessing function to deal with user drawn sections 
    this.postBoundingBoxesInfo = this.postBoundingBoxesInfo.bind(this)
    this.retrieveSections = this.retrieveSections.bind(this)
    this.extractBoundingBox = this.extractBoundingBox.bind(this)
    this.findElementBoundingBox = this.findElementBoundingBox.bind(this)

    // function added to help test if a building element is 
    // inside a bounding box
    this.findSections = this.findSections.bind(this)
    this._getBBOX = this._getBBOX.bind(this)

    // add drop down button function
    this.renderDropDown = this.renderDropDown.bind(this)
    this.renderMenu = this.renderMenu.bind(this)
    this.renderMeshMenu = this.renderMeshMenu.bind(this)
    this.renderAddOn = this.renderAddOn.bind(this)

    // add functions to allow 2D model sectioning
    this.render2DInterface = this.render2DInterface.bind(this)
    this.extractModelWidth = this.extractModelWidth.bind(this)
    this.extractModelHeight = this.extractModelHeight.bind(this)
    this.extract2DAreas = this.extract2DAreas.bind(this)

    // added functions to save section box that user draws
    this.saveSectionBox = this.saveSectionBox.bind(this)
    this.loadSectionBox = this.loadSectionBox.bind(this)

    // create trial function to create mesh for a selected item
    this.trial = this.trial.bind(this)


    // function to allow more complex event handeling
    this.eventTool = new EventTool(this.viewer)

    this.react = this.options.react

    /////////////////////////////////////////////////////////
    // Yumo Notes - creates a worker to process mesh meta info
    // in the background
    /////////////////////////////////////////////////////////

    this.worker = new Worker()

    this.intersectMeshes = []

    this.nbMeshesLoaded = 0

    this.wireframe = false
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  get className() {

    return 'wall-analyzer'
  }

  /////////////////////////////////////////////////////////
  // Extension Id
  //
  /////////////////////////////////////////////////////////
  static get ExtensionId () {

    return 'Viewing.Extension.WallAnalyzer'
  }

  /////////////////////////////////////////////////////////
  // Load callback
  // Modified by Yumo Chi (2018-10-04) to add buttons
  //
  /////////////////////////////////////////////////////////
  load () {

    this.react.setState({

      sectionBox:{},
      bBoxes: [],
      boxKeys: [],
      zones: {
                  a:[
                  [ 0.9999999999999998, 0, 0, -117.3212966918945],
                  [ 0, 0.9999999999999998, 0, -51.32601165771483],
                  [ 0, 0, 1, -31.037012100219727],
                  [ -0.9999999999999998, 0, 0, -106.79097747802732],
                  [ 0, -0.9999999999999998, 0, -51.65189743041991],
                  [ 0, 0, -1, -24.38190269470215]
                  ],
                  b:[
                  [ 0.9999999999999998, 0, 0, -117.3212966918945],
                  [ 0, 0.9999999999999998, 0, -88.17474365234374],
                  [ 0, 0, 1, -31.037012100219727],
                  [ -0.9999999999999998, 0, 0, -106.79097747802732],
                  [ 0, -0.9999999999999998, 0, 51.90516281127928],
                  [ 0, 0, -1, -24.38190269470215]
                  ],
                  c:[
                  [ 0.9999999999999998, 0, 0, -104.36467742919919],
                  [ 0, 0.9999999999999998, 0, 50.93488693237303],
                  [ 0, 0, 1, -31.037012100219727],
                  [ -0.9999999999999998, 0, 0, -106.79097747802732],
                  [ 0, -0.9999999999999998, 0, -88.73913574218749],
                  [ 0, 0, -1, -24.38190269470215]
                  ]
                },
      heights:{
        "level 1" : [
          [0,0,1,-5.512819290161133],
          [0,0,-1,-8.394502639770508]
        ],
        "level 2" : [
          [0,0,1,-18.400054931640625],
          [0,0,-1,4.429952621459961]
        ],
        "level 3" : [
          [0,0,1,-31.72292709350586],
          [0,0,-1,17.10234832763672]
        ]
      },
      boxIDCounter: 0,
      loader: true,
      levels: [],
      sections: [],
      // added buttons to 
      buttons: ['Misc'],
      Misc: []

    }).then (() => {

      this.react.pushRenderExtension(this)
    })

    console.log('Viewing.Extension.WallAnalyzer loaded')


    // creating linesMaterial 
    this.linesMaterial = this.createLinesMaterial()

    // render this as overlay to the viewer
    this.viewer.impl.createOverlayScene (
      'wallAnalyzer', this.linesMaterial)

    /////////////////////////////////////////////////////////
    // Yumo Notes - add event listener for the worker to 
    // interact with
    /////////////////////////////////////////////////////////
    this.worker.addEventListener(
      'message',
      this.onWorkerMessageWrapper)

    // sending bounding box info to worker
    const state = this.react.getState()
    const zones = state.zones

    this.postBoundingBoxesInfo('BoundingBox', 3)

    // create section based on user preference

    return true
  }

  /////////////////////////////////////////////////////////
  // Unload callback
  //
  /////////////////////////////////////////////////////////
  unload () {

    console.log('Viewing.Extension.WallAnalyzer unloaded')

    this.viewer.impl.removeOverlayScene ('wallAnalyzer')

    if (this.notification) {

      this.options.notify.remove(this.notification)
    }

    this.eventTool.off()

    super.unload ()

    return true
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  reset () {

    this.options.notify.remove(this.notification)

    this.notification = null

    this.react.setState({
      sectionBox: {},
      bBoxes: [],
      boxKeys: [],
      zones: {
                  a:[
                  [ 0.9999999999999998, 0, 0, -117.3212966918945],
                  [ 0, 0.9999999999999998, 0, -51.32601165771483],
                  [ 0, 0, 1, -31.037012100219727],
                  [ -0.9999999999999998, 0, 0, -106.79097747802732],
                  [ 0, -0.9999999999999998, 0, -51.65189743041991],
                  [ 0, 0, -1, -24.38190269470215]
                  ],
                  b:[
                  [ 0.9999999999999998, 0, 0, -117.3212966918945],
                  [ 0, 0.9999999999999998, 0, -88.17474365234374],
                  [ 0, 0, 1, -31.037012100219727],
                  [ -0.9999999999999998, 0, 0, -106.79097747802732],
                  [ 0, -0.9999999999999998, 0, 51.90516281127928],
                  [ 0, 0, -1, -24.38190269470215]
                  ],
                  c:[
                  [ 0.9999999999999998, 0, 0, -104.36467742919919],
                  [ 0, 0.9999999999999998, 0, 50.93488693237303],
                  [ 0, 0, 1, -31.037012100219727],
                  [ -0.9999999999999998, 0, 0, -106.79097747802732],
                  [ 0, -0.9999999999999998, 0, -88.73913574218749],
                  [ 0, 0, -1, -24.38190269470215]
                  ]
                },
      heights:{
        "level 1" : [
          [0,0,1,-5.512819290161133],
          [0,0,-1,-8.394502639770508]
        ],
        "level 2" : [
          [0,0,1,-18.400054931640625],
          [0,0,-1,4.429952621459961]
        ],
        "level 3" : [
          [0,0,1,-31.72292709350586],
          [0,0,-1,17.10234832763672]
        ]
      },
      boxIDCounter: 0,
      loader: true,
      levels: [],
      sections: [],
      buttons: ['Misc'],
      Misc: []
    })

  }

  /////////////////////////////////////////////////////////
  // Yumo Notes - function to interact with message from 
  // workers, seem to be made for a specifc level
  //
  /////////////////////////////////////////////////////////
  onWorkerMessage (msg) {


    const state = this.react.getState()

    const data = msg.data    

    const material = this.levelMaterials[data.level]

    // build mesh from the meta data 
    const mesh = this.buildMesh(data, material)

    // set levelIdx 
    const levelIdx = data.levelCount - data.level - 1

    // set the level info in the state or create them
    const level = state.levels[levelIdx] || {
        strokeColor: this.levelColors[data.level],
        fillColor: this.levelColors[data.level],
        name: `Level ${data.level+1}`,
        walls: {
          name: `Walls [Level #${data.level+1}]`,
          active: false,
          meshes: []
        },
        floor: {
          meshes: data.floorDbIds.map((dbId) => {
              return Toolkit.buildComponentMesh(
                this.viewer, this.viewer.model,
                dbId, null, material)
          }),
          name: `Floor [Level #${data.level+1}]`,
          dbIds: data.floorDbIds,
          active: false,
          paths: []
        },
        report: {
          level: `Level ${data.level+1}`,
          boundingBox: msg.levelBox,
          walls: []
        }
    }

    // retrieve specific level
    state.levels[levelIdx] = level

    // push new mesh into the level
    level.walls.meshes.push(mesh)

    // The map() method creates a new array with the results 
    // of calling a function for every array element.
    // create paths for the floor of the level
    const lines = data.pathEdges.map((edge) => {

      const geometry = new THREE.Geometry()

      edge.start.z += 0.05
      edge.end.z += 0.05

      geometry.vertices.push(
        new THREE.Vector3(
          edge.start.x,
          edge.start.y,
          edge.start.z))

      geometry.vertices.push(
        new THREE.Vector3(
          edge.end.x,
          edge.end.y,
          edge.end.z))

      geometry.computeLineDistances()

      return new THREE.Line(geometry,
        this.linesMaterial,
        THREE.LinePieces)
    })

    level.floor.paths.push({
      lines
    })

    const wall = {
      path: data.pathEdges,
      dbId: mesh.dbId
    }

    Toolkit.getProperties(
      this.viewer.model,
      mesh.dbId).then((properties) => {

        wall.properties = properties
      })

    level.report.walls.push(wall)

    const progress =
      (++this.nbMeshesLoaded) * 100 /
      (data.levelCount * data.wallCount)

    if (progress === 100) {

      this.notification.dismissAfter = 2000
      this.notification.status = 'success'
    }

    this.notification.message =
      `Processing Meshes `+
      `- Progress: ${progress.toFixed(2)}%`

    this.options.notify.update(this.notification)

    this.react.setState({
      levels: state.levels
    })
  }

  /////////////////////////////////////////////////////////
  // original function that returns the bounding box of model component
  // param: 
  //       dbId - dbId of the model component to retrieve bounding box for
  //
  /////////////////////////////////////////////////////////
  getComponentBoundingBox (dbId) {

    const model = this.viewer.model

    const fragIds = Toolkit.getLeafFragIds(
      model, dbId)

    const fragList = model.getFragmentList()

    return this.getModifiedWorldBoundingBox(
      fragIds, fragList)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onToolbarCreated (event) {

    this.panel = new MeshPropertyPanel(this.viewer)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onModelRootLoaded () {

    super.onModelRootLoaded()

    this.notification = this.options.notify.add({
      message: 'Loading geometry, please wait ...',
      title: 'Wall Analyzer',
      dismissible: false,
      status: 'loading',
      dismissAfter: 0,
      position: 'tl'
    })

    this.options.loader.show(false)
  }

  /////////////////////////////////////////////////////////
  // Yumo Notes's - Once model loads, we most model info. Get the 
  // floor and wall component with getComponentsByParentName
  //
  /////////////////////////////////////////////////////////
  onModelCompletedLoad (event) {

    const model = this.viewer.model

    this.postModelInfo ()

    // get all the components with Floors in their name
    this.getComponentsByParentName(
      'Floors', model).then((floorsIds) => {

        // record the number of floors in the model
        const nbFloors = floorsIds.length

        // add a different color and material for each floor for 
        // rendering mesh later
        const colors = d3.scale.linear()
          .domain([0, nbFloors * .33, nbFloors * .66, nbFloors])
          .range(['#FCB843', '#C2149F', '#0CC4BD', '#0270E9'])

          this.levelMaterials = []
          this.levelColors = []

          floorsIds.forEach((dbId, idx) => {

            const levelMaterial = new THREE.MeshPhongMaterial({
              side: THREE.DoubleSide,
              color: colors(idx)
            })

            this.viewer.impl.matman().addMaterial(
              this.guid(),
              levelMaterial,
              true)

            this.levelMaterials.push(levelMaterial)

            this.levelColors.push(colors(idx))

            this.postComponent (
              dbId, 'Floors', floorsIds.length)
          })
      })

    this.getComponentsByParentName(
      'Walls', model).then((wallIds) => {

        wallIds.forEach((dbId) => {

          return this.postComponent (
            dbId, 'Walls', wallIds.length)
        })
    })

    this.react.setState({
      loader: false
    })


    this.findElementBoundingBox()

  }



  /////////////////////////////////////////////////////////
  // Function added by Yumo to control communication between 
  // worker and wall analyzer. The communication pattern
  // between wall analyzer and worker is meant to return mesh
  // for walls, now workers will process bounding box for 
  // for wall analyzer 
  /////////////////////////////////////////////////////////
  onWorkerMessageWrapper(msg){

    const data = msg.data    
    if (data.msgId === 'MSG_ID_SECTIONBOUNDINGBOX'){
      this.retrieveSections(data)
    }

    else if (data.msgId === 'MSG_ID_SECTION_FLOOR_MESH'){
      this.onWorkerMessageProcessSection(msg)
    }

    else{
      this.onWorkerMessage(msg)

    }
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to post bounding box based on 
  // user defined values to worker
  /////////////////////////////////////////////////////////
  postBoundingBoxesInfo(category, count){

    const state = this.react.getState()

    const zones = state.zones

    const msg = {
      boundingBox: zones,
      msgId: 'MSG_ID_BOUNDINGBOX',
      category,
      count,
    }

    // send this information to the worker
    this.worker.postMessage(msg)

  }


  /////////////////////////////////////////////////////////
  // Yumo's Notes - send message for worker to process model
  //
  /////////////////////////////////////////////////////////
  async postModelInfo () {

    const model = this.viewer.model

    const instanceTree = model.getData().instanceTree

    this.rootId = instanceTree.getRootId()

    const fragIds = await Toolkit.getFragIds(
      model, this.rootId)

    const fragList = model.getFragmentList()

    const boundingBox =
      this.getModifiedWorldBoundingBox(
        fragIds, fragList)

    const msg = {
      msgId: 'MSG_ID_MODEL_INFO',
      boundingBox
    }

    this.worker.postMessage(msg)
  }

  /////////////////////////////////////////////////////////
  // Yumo Notes - Functions to send message to worker to process
  // mesh for different components, 
  // Param - catergory - category for building element, either floor or wall in this case
  //
  /////////////////////////////////////////////////////////
  postComponent (dbId, category, count) {

    const geometry = this.getComponentGeometry(dbId)

    const msg = {
      boundingBox: this.getComponentBoundingBox(dbId),
      matrixWorld: geometry.matrixWorld,
      nbMeshes: geometry.meshes.length,
      msgId: 'MSG_ID_COMPONENT',
      category,
      count,
      dbId
    }

    // save all metadata for all fragments for the element
    geometry.meshes.forEach((mesh, idx) => {

      msg['positions' + idx] = mesh.positions
      msg['indices' + idx] = mesh.indices
      msg['stride' + idx] = mesh.stride
    })

    // send this information to the worker
    this.worker.postMessage(msg)
  }

  /////////////////////////////////////////////////////////
  // Yumo Notes - function to build mesh for data with material
  // specified. Data specified vertices and faces for the meshes
  // 
  /////////////////////////////////////////////////////////
  buildMesh (data, material) {

    const geometry = new THREE.Geometry()

    data.vertices.forEach((vertex) => {

      geometry.vertices.push(
        new THREE.Vector3(
          vertex.x,
          vertex.y,
          vertex.z))
    })

    data.faces.forEach((face) => {

      geometry.faces.push(
        new THREE.Face3(
          face.a,
          face.b,
          face.c))
    })

    geometry.computeFaceNormals()

    //geometry.computeVertexNormals()

    // Notes: after here, it just seem like regular code to create meshes
    // the key is in the calculation for the vertices and faces

    const matrixWorld = new THREE.Matrix4()

    matrixWorld.fromArray(data.matrixWorld)

    const mesh = new THREE.Mesh(
      geometry, material)

    mesh.applyMatrix(matrixWorld)

    mesh.dbId = data.dbId

    return mesh
  }

  /////////////////////////////////////////////////////////
  // Yumo Notes - Function to get floor and wall components 
  // based on name, bascially instancetree keep tarck of all 
  // the name of the dbId
  /////////////////////////////////////////////////////////
  getComponentsByParentName (name, model) {

    const instanceTree = model.getData().instanceTree

    const rootId = instanceTree.getRootId()

    let parentId = 0

    instanceTree.enumNodeChildren(rootId,
      (childId) => {

        const nodeName = instanceTree.getNodeName(childId)

        if (nodeName.indexOf(name) > -1) {

          parentId = childId
        }
      })

    return parentId > 0
      ? Toolkit.getLeafNodes(model, parentId)
      : []
  }

  /////////////////////////////////////////////////////////
  // Yumo Notes - Function to get component geometry in term of 
  // dbId 
  /////////////////////////////////////////////////////////
  getComponentGeometry (dbId) {

    const fragIds = Toolkit.getLeafFragIds(
      this.viewer.model, dbId)

    let matrixWorld = null

    const meshes = fragIds.map((fragId) => {

      // retrieve relevant information from viewer based on model and fragment id
      // return a variety of meta information on mesh
      const renderProxy = this.viewer.impl.getRenderProxy(
        this.viewer.model,
        fragId)

      // get geometry from renderProxy
      const geometry = renderProxy.geometry

      // rendering details, such as index, normal, uv, and position
      const attributes = geometry.attributes 

      // either assign vb array of the geometry returned or the attributess
      const positions = geometry.vb
        ? geometry.vb
        : attributes.position.array

      // get indices for the attributes
      const indices = attributes.index.array || geometry.ib

      // get stride of the fragments
      const stride = geometry.vb ? geometry.vbstride : 3

      // capture relevant matrixWorld
      matrixWorld = matrixWorld ||
        renderProxy.matrixWorld.elements

      return {
        positions,
        indices,
        stride
      }
    })

    return {
      matrixWorld,
      meshes
    }
  }

  /////////////////////////////////////////////////////////
  // Yumo Notes - creates mesh material for drawing wireframe-style geometries
  //
  /////////////////////////////////////////////////////////
  createLinesMaterial (color = 0xFF0000, opacity = 1.0) {

    return new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      linewidth: 10,
      opacity
    })
  }

  /////////////////////////////////////////////////////////
  //returns bounding box as it appears in the viewer
  // (transformations could be applied)
  //
  /////////////////////////////////////////////////////////
  getModifiedWorldBoundingBox (fragIds, fragList) {

    const fragbBox = new THREE.Box3()
    const nodebBox = new THREE.Box3()

    fragIds.forEach(function(fragId) {

      fragList.getWorldBounds(fragId, fragbBox)

      nodebBox.union(fragbBox)
    })

    return nodebBox
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  hexToRgbA (hex, alpha) {

    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {

      var c = hex.substring(1).split('')

      if (c.length == 3) {

        c = [c[0], c[0], c[1], c[1], c[2], c[2]]
      }

      c = '0x' + c.join('')

      return `rgba(${(c>>16)&255},${(c>>8)&255},${c&255},${alpha})`
    }

    throw new Error('Bad Hex Number: ' + hex)
  }


  // /////////////////////////////////////////////////////////
  // //
  // //
  // /////////////////////////////////////////////////////////
  onMouseMove (event) {

    const pointer = event.pointers
      ? event.pointers[0]
      : event

    const rayCaster = this.pointerToRaycaster(
      this.viewer.impl.canvas,
      this.viewer.impl.camera,
      pointer)

    const intersectResults = rayCaster.intersectObjects(
      this.intersectMeshes, true)

  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async onSelection (event) {

    if (event.selections.length) {

      const dbId = event.selections[0].dbIdArray[0]
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onLevelWallsClicked (level) {

    const state = this.react.getState()

    level.walls.active = !level.walls.active

    this.react.setState({
      levels: state.levels
    })

    const meshes = level.walls.meshes

    meshes.forEach((mesh) => {

      if (level.walls.active) {

        this.viewer.impl.scene.add(mesh)
        this.intersectMeshes.push(mesh)

      } else {

        this.viewer.impl.scene.remove(mesh)
      }
    })

    if (!level.walls.active) {

      const meshIds = meshes.map((mesh) => {
        return mesh.id
      })

      this.intersectMeshes =
        this.intersectMeshes.filter((mesh) => {

          return !meshIds.includes(mesh.id)
        })
    }

    const nbActiveWalls = state.levels.filter((level) => {
      return level.walls.active
    })

    const nbActiveFloors = state.levels.filter((level) => {
      return level.floor.active
    })

    if ((nbActiveWalls.length + nbActiveFloors.length)) {

      Toolkit.hide(this.viewer, this.rootId)
      this.eventTool.activate()

    } else {

      Toolkit.show(this.viewer, this.rootId)
      this.eventTool.deactivate()
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  drawLine (line) {

    this.viewer.impl.addOverlay(
      'wallAnalyzer', line)
  }

  clearLine (line) {

    this.viewer.impl.removeOverlay(
      'wallAnalyzer', line)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onLevelFloorClicked (level) {

    const state = this.react.getState()

    level.floor.active = !level.floor.active

    this.react.setState({
      levels: state.levels
    })

    const meshes = level.floor.meshes

    if (level.floor.active) {

      level.floor.paths.forEach((path) => {

        path.lines.forEach((line) => {

          this.drawLine(line)
        })
      })

      meshes.forEach((mesh) => {
        this.viewer.impl.scene.add(mesh)
        this.intersectMeshes.push(mesh)
      })

    } else {

      level.floor.paths.forEach((path) => {

        path.lines.forEach((line) => {

          this.clearLine(line)
        })
      })

      meshes.forEach((mesh) => {
        this.viewer.impl.scene.remove(mesh)
      })

      const meshIds = meshes.map((mesh) => {
        return mesh.id
      })

      this.intersectMeshes =
        this.intersectMeshes.filter((mesh) => {

          return !meshIds.includes(mesh.id)
        })
    }

    const viewerState = this.viewer.getState({viewport: true})

    this.viewer.restoreState(viewerState)


    const nbActiveWalls = state.levels.filter((level) => {
      return level.walls.active
    })

    const nbActiveFloors = state.levels.filter((level) => {
      return level.floor.active
    })

    if ((nbActiveWalls.length + nbActiveFloors.length)) {

      Toolkit.hide(this.viewer, this.rootId)
      this.eventTool.activate()

    } else {

      Toolkit.show(this.viewer, this.rootId)
      this.eventTool.deactivate()
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onEnableWireFrame (checked) {

    this.wireframe = checked

    this.levelMaterials.forEach((material) => {

      material.wireframe = checked
    })

    this.viewer.impl.sceneUpdated(true)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async setDocking (docked) {

    const id = WallAnalyzerExtension.ExtensionId

    if (docked) {

      await this.react.popRenderExtension(id)

      this.react.pushViewerPanel(this, {
        height: 250,
        width: 350
      })

    } else {

      await this.react.popViewerPanel(id)

      this.react.pushRenderExtension(this)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onLevelReportClicked (e, report) {

    e.stopPropagation()

    const data = "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(report, null, 2))

    const a = document.createElement('a')
    a.setAttribute("download", `${report.level}.json`)
    a.setAttribute("href", data)

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderContent () {

    const state = this.react.getState()

    let hasActiveItem = false

    const levels = state.levels

    const items = levels.map((level) => {

      hasActiveItem =
        hasActiveItem ||
        level.walls.active ||
        level.floor.active

      const wallsActive = level.walls.active ? ' active' : ''

      const floorActive = level.floor.active ? ' active' : ''

      const style = {
        backgroundColor: this.hexToRgbA(level.fillColor, 0.3),
        border: `2px solid ${level.strokeColor}`
      }

      return (
        <div key={level.walls.name} className='list-item'>

          <div className="item-color" style={style}>
          </div>

          <label>
            {level.name}
          </label>

          <div onClick={(e) => {
            this.onLevelReportClicked(e, level.report)
          }}
            className="level-report">
            <span className="fa fa-cloud-download"/>
              report.json
          </div>

          <div onClick={() => this.onLevelFloorClicked(level)}
              className={"level-floor" + floorActive}>
            Floor
          </div>

          <div onClick={() => this.onLevelWallsClicked(level)}
            className={"level-walls" + wallsActive}>
            Walls
          </div>

        </div>
      )
    })

    return (
      <div className="content">

        <ReactLoader show={state.loader}/>

        <div className="row">


          <label>
          Select an item to isolate walls or floor on this level:
          </label>
        </div>

        <div className="item-list-container">
            {items}
        </div>

        {
          hasActiveItem &&
          <div className="row">
            Enable wireframe:
          </div>
        }

        {
          hasActiveItem &&
          <div className="row">
            <Switch className="control-element"
              onChange={this.onEnableWireFrame}
              checked={this.wireframe}/>
          </div>
        }
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderTitle (titleOpts = {}) {

    const docked = titleOpts.docked

    const spanClass = docked
      ? 'fa fa-chain-broken'
      : 'fa fa-chain'

    return (
      <div className="title">
        <label>
          Wall Analyzer Modified
        </label>
        {
          titleOpts.showDocking &&
          <div className="wall-analyzer-controls">
            <button onClick={() => this.setDocking(docked)}
              title="Toggle docking mode">
              <span className={spanClass}/>
            </button>
          </div>
        }
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to process floor and wall meshes 
  // based on sections, the current function is modeled after
  // the mesh process for wall by level
  /////////////////////////////////////////////////////////

  onWorkerMessageProcessSection(msg) {


    const state = this.react.getState()

    const data = msg.data    

    // here the wall are originall asscoiated with the level
    // it is in, however, section do not have material associated
    // with it. I will use a hacky solution right now
    const sectionLevel = parseInt(data.section.split(' ')[1]) - 1
    const material = this.levelMaterials[sectionLevel ]

    // build mesh from the meta data 
    const mesh = this.buildMesh(data, material)

    // set levelIdx 
    const sectionId = data.section

    // set the level info in the state or create them
    // however this is effectively putting the mesh meta info
    // inside an object associated with an level, however
    // for the expressed purpose of displaying sections,
    // I dont want to place the mesh info inside the level
    const section = state.sections[sectionId] || {
        strokeColor: this.levelColors[sectionLevel],
        fillColor: this.levelColors[sectionLevel],
        name: `${sectionId}`,
        walls: {
          name: `Walls [Section #${sectionId}]`,
          active: false,
          meshes: []
        },
        floor: {
          meshes: [],
          name: `Floor [Section #${sectionId}]`,
          dbIds: data.dbId,
          active: false,
          paths: []
        },
        report: {
          level: `Level ${sectionLevel+1}`,
          boundingBox: msg.sectionBox,
          walls: []
        }
    }

    // retrieve specific level
    state.sections[sectionId] = section

    // push new mesh into the level
    section.floor.meshes.push(mesh)

    // The map() method creates a new array with the results 
    // of calling a function for every array element.
    // create paths for the floor of the level
    const lines = data.pathEdges.map((edge) => {

      const geometry = new THREE.Geometry()

      edge.start.z += 0.05
      edge.end.z += 0.05

      geometry.vertices.push(
        new THREE.Vector3(
          edge.start.x,
          edge.start.y,
          edge.start.z))

      geometry.vertices.push(
        new THREE.Vector3(
          edge.end.x,
          edge.end.y,
          edge.end.z))

      geometry.computeLineDistances()

      return new THREE.Line(geometry,
        this.linesMaterial,
        THREE.LinePieces)
    })

    section.floor.paths.push({
      lines
    })

    // const wall = {
    //   path: data.pathEdges,
    //   dbId: mesh.dbId
    // }

    // Toolkit.getProperties(
    //   this.viewer.model,
    //   mesh.dbId).then((properties) => {

    //     wall.properties = properties
    //   })

    // level.report.walls.push(wall)

    // const progress =
    //   (++this.nbMeshesLoaded) * 100 /
    //   (data.levelCount * data.wallCount)

    // if (progress === 100) {

    //   this.notification.dismissAfter = 2000
    //   this.notification.status = 'success'
    // }

    // this.notification.message =
    //   `Processing Meshes `+
    //   `- Progress: ${progress.toFixed(2)}%`

    // this.options.notify.update(this.notification)

    this.react.setState({
      sections: state.sections
    })
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to render section floor
  //
  /////////////////////////////////////////////////////////

    onSectionFloorClicked (sectionId) {

    const state = this.react.getState()
    console.log('state', state)

    // retrieve relevant section
    let section = state.sections[sectionId]

    section.floor.active = !section.floor.active

    this.react.setState({
      sections: state.sections
    })

    const meshes = section.floor.meshes

    if (section.floor.active) {

      section.floor.paths.forEach((path) => {

        path.lines.forEach((line) => {

          this.drawLine(line)
        })
      })

      meshes.forEach((mesh) => {
        this.viewer.impl.scene.add(mesh)
        this.intersectMeshes.push(mesh)
      })

    } else {

      section.floor.paths.forEach((path) => {

        path.lines.forEach((line) => {

          this.clearLine(line)
        })
      })

      meshes.forEach((mesh) => {
        this.viewer.impl.scene.remove(mesh)
      })

      const meshIds = meshes.map((mesh) => {
        return mesh.id
      })

      this.intersectMeshes =
        this.intersectMeshes.filter((mesh) => {

          return !meshIds.includes(mesh.id)
        })
    }

    const viewerState = this.viewer.getState({viewport: true})

    this.viewer.restoreState(viewerState)


    // const nbActiveWalls = state.sections.filter((section) => {
    //   return section.walls.active
    // })

    let nbActiveFloors = []

    for(let sectionName in state.sections) {

      let section = state.sections[sectionName]

      if(section.floor.active) {
         nbActiveFloors.push(sectionName)
      }
    }



    // if ((nbActiveWalls.length + nbActiveFloors.length)) {
    if ((nbActiveFloors.length)) {

      Toolkit.hide(this.viewer, this.rootId)
      this.eventTool.activate()

    } else {

      Toolkit.show(this.viewer, this.rootId)
      this.eventTool.deactivate()
    }
  }


  /////////////////////////////////////////////////////////
  // Function added by Yumo to preprocess user provided area,
  // meant to provide functional parameters for paper. Will 
  // be updated soon
  /////////////////////////////////////////////////////////
  retrieveSections(data){
    let sectionBoundingBoxes = data.boxes
    // get current state
    const state = this.react.getState()
    // get the current saved sections in the state
    let currSectionBox = state.sectionBox
    // get the current names of the saved boxes
    let currBoxKeys = state.boxKeys
    // get current bounding boxes
    let currBBoxes = state.bBoxes

    // get the current zones in the state
    let zones = state.zones
    // get the corresponding heights of the levels in the state
    let heights = state.heights
    // iterate through the zones
    for (let box in sectionBoundingBoxes) {
      
        // create new title
        let title = box

        // retrieve the planes in zones
        let sBox = sectionBoundingBoxes[box]['sBox']
        let bBox = sectionBoundingBoxes[box]['bBox']
        
        // save the new planes in currSectionBox
        let newSBox = sBox.map(function(plane) { 
          let newPlane = new THREE.Vector4() 
          newPlane.x = plane.x
          newPlane.y = plane.y
          newPlane.z = plane.z
          newPlane.w = plane.w
          return newPlane
        })

        // create min and max to hold max and min of the bounding box
        let bBoxMin = bBox.min
        let bBoxMax = bBox.max

        // create the bounding box for  the section cut
        let newBBox = new THREE.Box3(bBoxMin, bBoxMax)

        // save the bounding box
        currBBoxes.push(newBBox)

        // save the section cut
        currSectionBox[title] = newSBox

        // save the corresonding title of the section cut
        currBoxKeys.push(title)


    }

      // set state again
      this.react.setState({
      sectionBox: currSectionBox,
      boxKeys: currBoxKeys,
      bBoxes: currBBoxes

    })


  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to find elements inside a user 
  // provided section box
  /////////////////////////////////////////////////////////

  findElementBoundingBox(){

    // get current state  
    const state = this.react.getState()

    // create empty dictionary to hold information of each bim elem's section box
    let sectionToDbIds = {}

    for (let key of state.boxKeys){
      sectionToDbIds[key] = []
    }

    // get instance tree of model
    const instanceTree = this.viewer.model.getData().instanceTree

    // get all dbId in a model
    let dbIds = this.getAlldbIds(instanceTree.getRootId())

    // get rootID to search for all the child
    const rootId = instanceTree.getRootId()

    let parentId = 0

    // test each children to see which section it is in
    for (let dbId of dbIds){

    let tempBoxes = this.findSections(this.viewer.model, dbId)


    for (let box of tempBoxes){
      let index =  state.bBoxes.indexOf(box)
      let boxKey = state.boxKeys[index]
      sectionToDbIds[boxKey].push(dbId)
      }
    }



  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to extract bounding box based on 
  // user provided section box, meant to provide functional 
  // parameters for paper. Will be updated soon
  //
  /////////////////////////////////////////////////////////

  extractBoundingBox(){

    const state = this.react.getState()

    // cycle through all the elements of the model

    let elements = this.findSections(this.viewer.model, 3188)


  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to test if an model element is 
  // inside a boundingBox
  //
  /////////////////////////////////////////////////////////
  /**
  * gets all section that the selected element overlaps more than 50 percent
  * of its volume with
  */
  findSections(model, dbId){
    const state = this.react.getState()

    const modelFloors = state.bBoxes;

    if(!modelFloors){
      return null;
    }
    const box = this._getBBOX(model, dbId);
    const origin = new THREE.Vector3();
    const boxX = box.max.x - box.min.x;
    const boxY = box.max.y - box.min.y;
    const boxZ = box.max.z - box.min.z;
    const boxVolume = boxX*boxY*boxZ;
    const doesOverlap = (floor)=>{
      if(!isFinite(floor.min.x)){
        return false;
      }
      const minX = Math.max(floor.min.x, box.min.x);
      const minY = Math.max(floor.min.y, box.min.y);
      const minZ = Math.max(floor.min.z, box.min.z);
      const maxX = Math.min(floor.max.x, box.max.x);
      const maxY = Math.min(floor.max.y, box.max.y);
      const maxZ = Math.min(floor.max.z, box.max.z);
      const dX = Math.max(maxX - minX, 0)
      const dY = Math.max(maxY - minY, 0)
      const dZ = Math.max(maxZ - minZ, 0)
      const intersectVolume = dX*dY*dZ;
      return intersectVolume / boxVolume > 0.5;
    }
    return modelFloors.filter(doesOverlap.bind(null));
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo. This is essentially a helper 
  // function for findSections, however, this can be eliminated
  // because it simply generate a bounding box given a specific 
  // dbId
  //
  /////////////////////////////////////////////////////////


  _getBBOX(model, dbId){
  const fragBox = new THREE.Box3()
  const nodeBox = new THREE.Box3()

  const it = model.getData().instanceTree;
  const fragList = model.getFragmentList();
  it.enumNodeFragments(dbId, fragId=>{
    fragList.getWorldBounds(fragId, fragBox);
    nodeBox.union(fragBox);
  }, true);
  return nodeBox;
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo. A helper function for 
  // findSections, it finds all the dbID for a model
  /////////////////////////////////////////////////////////
  getAlldbIds (rootId) {
    let instanceTree = this.viewer.model.getData().instanceTree
    let alldbId = []
    if (!rootId) {
      return alldbId
    }
    let queue = []
    queue.push(rootId)
    while (queue.length > 0) {
      let node = queue.shift()
      alldbId.push(node);
      instanceTree.enumNodeChildren(node, function(childrenIds) {
        queue.push(childrenIds);
      });
    }
    return alldbId;
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to load sectionbox buttons
  //
  /////////////////////////////////////////////////////////
  trial(){
    const selected = NOP_VIEWER.getSelection()

    const dbId = selected[0]
    // decided to call this category component
    const category = 'Component'
    const count = 1

    const geometry = this.getComponentGeometry(dbId)

    const state = this.react.getState()

    // msgId also matters
    const msg = {
      boundingBox: this.getComponentBoundingBox(dbId),
      matrixWorld: geometry.matrixWorld,
      nbMeshes: geometry.meshes.length,
      msgId: 'MSG_ID_COMPONENT_Test',
      category,
      count,
      dbId
    }

    geometry.meshes.forEach((mesh, idx) => {

      msg['positions' + idx] = mesh.positions
      msg['indices' + idx] = mesh.indices
      msg['stride' + idx] = mesh.stride
    })

    this.worker.postMessage(msg)

    const levels = state.levels

    const level = levels[0]

    const meshes = level.floor.meshes


      level.floor.paths.forEach((path) => {

        path.lines.forEach((line) => {

          this.drawLine(line)
        })
      })

      meshes.forEach((mesh) => {
        this.viewer.impl.scene.add(mesh)
        this.intersectMeshes.push(mesh)
      })

}
  /////////////////////////////////////////////////////////
  // Function added by Yumo to load sectionbox buttons
  //
  /////////////////////////////////////////////////////////
  loadSectionBox(title){
    //Get the state
    const state = this.react.getState()

    // Get the sectionBox
    let currSectionBox = state.sectionBox
    let cutPlanes = currSectionBox[title]
    // Set planes from sectionBox
    NOP_VIEWER.setCutPlanes(cutPlanes)

  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to add Save section buttons
  //
  /////////////////////////////////////////////////////////
  saveSectionBox(){

    // Declare the keys of the selection box
    const Keys = ['a', 'b', 'c', 'd']
    const state = this.react.getState()
    // Get the ID
    let i = state.boxIDCounter

    // get previous misc items
    // subject to change
    let newMisc = state.Misc
    // get box key of curr section box
    let newBoxKey = Keys[i % Keys.length]
    // update previous box key to include new key
    newMisc.push(newBoxKey)
    // increment i
    i += 1
    // get planes from section box
    const boxPlanes = NOP_VIEWER.getCutPlanes()
    // Define the saved box
    let newSectionBox = state.sectionBox
    

    newSectionBox[newBoxKey] = boxPlanes

    // Set state to include sectionbox info
    this.react.setState({

      sectionBox: newSectionBox,
      Misc: newMisc,
      boxIDCounter: i,
    })
    
    
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to add dropdown buttons
  //
  /////////////////////////////////////////////////////////
  renderMenu(title, i){
    return(
      <MenuItem 
      key={i} 
      eventKey={i}
      id = {`${title}-${i}`}
      onClick = {()=>this.loadSectionBox(title)}
      >
        {title}
      </MenuItem>);
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to add dropdown buttons for rendering
  // Section mesh
  /////////////////////////////////////////////////////////
  renderMeshMenu(title, i){
    return(
      <MenuItem 
      key={i} 
      eventKey={i}
      id = {`${title}-${i}`}
      onClick = {()=>this.onSectionFloorClicked(title)}
      >
        {title}
      </MenuItem>);
  }


  /////////////////////////////////////////////////////////
  // Function added by Yumo to involke function to add button
  //
  /////////////////////////////////////////////////////////
  renderAddOn(title, i){
    const state = this.react.getState();

    return (
      <div>
        <div>
          <div>
            <h5>Manually Set & Load Section</h5>
          </div>
            <DropdownButton
            bsStyle={'default'}
            title={title}
            key={i}
            id={`dropdown-basic-${i}`}
            >
            {state.boxKeys.map(this.renderMenu)}
            </DropdownButton>
            <Button 
            bsStyle="primary"
            onClick = {this.extractBoundingBox}>
              Extract Section
            </Button>
        </div>
        <div>
          <div>
            <h5>Render Mesh for Each Section</h5>
          </div>
            <DropdownButton
            bsStyle={'default'}
            title={title}
            key={i}
            id={`dropdown-basic-${i}`}
            >
            {state.boxKeys.map(this.renderMeshMenu)}
            </DropdownButton>
        </div>
      </div>
  );
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to add dropdown buttons - No longer Used
  //
  /////////////////////////////////////////////////////////
  renderDropDown(title, i){
    const state = this.react.getState()

    return (
      <DropdownButton
        bsStyle={'default'}
        title={title}
        key={i}
        id={`dropdown-basic-${i}`}
      >
        {state.levels.map(this.renderMenu)}
      </DropdownButton>
  );
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo extract width set by user
  //
  /////////////////////////////////////////////////////////
  extractModelWidth(){
    // get measurement set by user
    const widthHTML = document.getElementsByClassName('measure-selection-area')[0]
    const width = widthHTML.offsetWidth
    const widthLeft = widthHTML.offsetLeft
    
    // set width in state
    this.react.setState({

      width: width,
      widthLeft: widthLeft
    })
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to extract height set by user
  //
  /////////////////////////////////////////////////////////
  extractModelHeight(){
    // get measurement set by user
    const heightHTML = document.getElementsByClassName('measure-selection-area')[0]
    const height = heightHTML.offsetWidth
    const heightTop = heightHTML.offsetTop
    
    // set height in state
    this.react.setState({

      width: width,
      heightTop: heightTop
    })
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to extract areas set by user 
  //
  /////////////////////////////////////////////////////////

  extract2DAreas(){
    //get area parameters defined by user in html form
    const areasHTML = document.getElementsByClassName('measure-selection-area')
    //process areasHTML in steps of 4
    let i = 0
    for (i=0; i < areasHTML.length; i+4) {
      // Runs 5 times, with values of step 0 through 4.
      console.log(areasHTML[i])
      console.log(areasHTML[i+1])
      console.log(areasHTML[i+2])
      console.log(areasHTML[i+3])
    }
  }

  /////////////////////////////////////////////////////////
  // Function to add by Yumo to render interface for 2D 
  // model division
  //
  /////////////////////////////////////////////////////////

  render2DInterface(){
    return(
      <div>
        <div>
          <h3>2D Model Division</h3>
        </div>
        <div>
          <h5>Setup Parameter for cut</h5>
        </div>
        <div>
          <Button 
          bsStyle="primary"
          onClick = {this.extractModelWidth}>
            Set Width
          </Button>
        </div>
        <div>
          <Button 
          bsStyle="primary"
          onClick = {this.extractModelHeight}>
            Set Height
          </Button>
        </div>
        <div>
          <h5>Set areas on 2D drawing</h5>
        </div>
        <div>
          <Button 
          bsStyle="primary"
          onClick = {this.extract2DAreas}>
            Extract Areas
          </Button>
        </div>
        <div>
          <Button 
          bsStyle="primary"
          onClick = {this.trial}>
            Test
          </Button>
        </div>
        <div>
          <Button 
          bsStyle="primary"
          onClick = {()=>this.onSectionFloorClicked('level 1 a')}>
            Render Section Level 1 a
          </Button>
        </div>
      </div>
      );
  }


  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  render (opts = {}) {
    const state = this.react.getState()

    return (
      <WidgetContainer
        renderTitle={() => this.renderTitle(opts.docked)}
        showTitle={opts.showTitle}
        className={this.className}>
        { 
          // state.buttons.map(this.renderDropDown)
          this.render2DInterface()
        }
        { this.renderAddOn("Display Section", 0) }

        { this.renderContent() }

      </WidgetContainer>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  WallAnalyzerExtension.ExtensionId,
  WallAnalyzerExtension)


