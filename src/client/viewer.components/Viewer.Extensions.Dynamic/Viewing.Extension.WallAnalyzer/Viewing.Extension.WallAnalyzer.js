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

import Snap from 'imports-loader?this=>window,fix=>module.exports=0!snapsvg/dist/snap.svg.js';

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

    // add drop down button function
    this.renderDropDown = this.renderDropDown.bind(this)
    this.renderMenu = this.renderMenu.bind(this)
    this.renderButton = this.renderButton.bind(this)
    this.initiateSVG = this.initiateSVG.bind(this)
    this.onMouseClick = this.onMouseClick.bind(this)
    this.makeid = this.makeid.bind(this)
    this.drawPushpin = this.drawPushpin.bind(this)


    this.onClick = this.onClick.bind(this)

    this.eventTool = new EventTool(this.viewer)

    this.react = this.options.react

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

    console.log('inside')
    return 'Viewing.Extension.WallAnalyzer'
  }

  /////////////////////////////////////////////////////////
  // Load callback
  // Modified by Yumo Chi (2018-10-04) to add buttons
  //
  /////////////////////////////////////////////////////////
  load () {

    this.react.setState({

      loader: true,
      levels: [],
      // added buttons to 
      buttons: ['Level', 'Misc']

    }).then (() => {

      this.react.pushRenderExtension(this)
    })

    console.log('Viewing.Extension.WallAnalyzer loaded')

    this.eventTool.on ('mousemove', this.onMouseMove)

    this.eventTool.on ('singleclick', this.onClick)

    this.linesMaterial = this.createLinesMaterial()

    this.viewer.impl.createOverlayScene (
      'wallAnalyzer', this.linesMaterial)

    this.worker.addEventListener(
      'message',
      this.onWorkerMessage)

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
      loader: true,
      levels: [],
      buttons: ['Level', 'Misc']
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onWorkerMessage (msg) {

    const state = this.react.getState()

    const data = msg.data

    const material = this.levelMaterials[data.level]

    const mesh = this.buildMesh(data, material)

    const levelIdx = data.levelCount - data.level - 1

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

    state.levels[levelIdx] = level

    level.walls.meshes.push(mesh)

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
  //
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
  //
  //
  /////////////////////////////////////////////////////////
  onModelCompletedLoad (event) {

    const model = this.viewer.model

    this.postModelInfo ()

    this.getComponentsByParentName(
      'Floors', model).then((floorsIds) => {

        const nbFloors = floorsIds.length

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
  }

  /////////////////////////////////////////////////////////
  //
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
  //
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

    geometry.meshes.forEach((mesh, idx) => {

      msg['positions' + idx] = mesh.positions
      msg['indices' + idx] = mesh.indices
      msg['stride' + idx] = mesh.stride
    })

    this.worker.postMessage(msg)
  }

  /////////////////////////////////////////////////////////
  //
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

    const matrixWorld = new THREE.Matrix4()

    matrixWorld.fromArray(data.matrixWorld)

    const mesh = new THREE.Mesh(
      geometry, material)

    mesh.applyMatrix(matrixWorld)

    mesh.dbId = data.dbId

    return mesh
  }

  /////////////////////////////////////////////////////////
  //
  //
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
  //
  //
  /////////////////////////////////////////////////////////
  getComponentGeometry (dbId) {

    const fragIds = Toolkit.getLeafFragIds(
      this.viewer.model, dbId)

    let matrixWorld = null

    const meshes = fragIds.map((fragId) => {

      const renderProxy = this.viewer.impl.getRenderProxy(
        this.viewer.model,
        fragId)

      const geometry = renderProxy.geometry

      const attributes = geometry.attributes

      const positions = geometry.vb
        ? geometry.vb
        : attributes.position.array

      const indices = attributes.index.array || geometry.ib

      const stride = geometry.vb ? geometry.vbstride : 3

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
  //
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

  /////////////////////////////////////////////////////////
  // Creates Raycaster object from the pointer
  //
  /////////////////////////////////////////////////////////
  pointerToRaycaster (domElement, camera, pointer) {

    const pointerVector = new THREE.Vector3()
    const pointerDir = new THREE.Vector3()
    const ray = new THREE.Raycaster()

    const rect = domElement.getBoundingClientRect()

    const x = ((pointer.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((pointer.clientY - rect.top) / rect.height) * 2 + 1

    if (camera.isPerspective) {

      pointerVector.set(x, y, 0.5)

      pointerVector.unproject(camera)

      ray.set(camera.position,
        pointerVector.sub(
          camera.position).normalize())

    } else {

      pointerVector.set(x, y, -1)

      pointerVector.unproject(camera)

      pointerDir.set(0, 0, -1)

      ray.set(pointerVector,
        pointerDir.transformDirection(
          camera.matrixWorld))
    }

    return ray
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
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

    //console.log(intersectResults)
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
  onClick (event) {

    const pointer = event.pointers
      ? event.pointers[0]
      : event

    const rayCaster = this.pointerToRaycaster(
      this.viewer.impl.canvas,
      this.viewer.impl.camera,
      pointer)

    const intersectResults = rayCaster.intersectObjects(
      this.intersectMeshes, true)

    if (intersectResults.length) {

      const mesh = intersectResults[0].object

      this.panel.setVisible(false)

      this.panel.setNodeProperties(mesh.dbId)

      this.panel.setVisible(true)
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
  // Function added by Yumo to add dropdown buttons
  //
  /////////////////////////////////////////////////////////
  renderMenu(level, i){
    return(<MenuItem key={i} eventKey={i}>{level.name}</MenuItem>);
  }


  /////////////////////////////////////////////////////////
  // Function added by Yumo to initiate the and prompt user to 
  // insert svg on to the model by clicking
  //
  /////////////////////////////////////////////////////////
  onMouseClick (event) {
    console.log('onMouseClick called')
    var screenPoint = {
        x: event.clientX,
        y: event.clientY
    }; 

    //get the selected 3D position of the object
    var hitTest = this.viewer.impl.hitTest(screenPoint.x,screenPoint.y,true); 
    if(hitTest)
    {  
       this.drawPushpin({x:hitTest.intersectPoint.x,
                    y:hitTest.intersectPoint.y,
                    z:hitTest.intersectPoint.z});
    }
  }
 
  //generate a random id for each pushpin markup
  makeid() {
    console.log('makeid called')
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    
    for( var i=0; i < 5; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));
    
    return text;
    }

  drawPushpin(pushpinModelPt){  
    console.log('drawPushpin called')
    //convert 3D position to 2D screen coordination
    var screenpoint = this.viewer.worldToClient(
                      new THREE.Vector3(pushpinModelPt.x,
                                        pushpinModelPt.y,
                                        pushpinModelPt.z,));

      //build the div container
      var randomId = this.makeid();
      var htmlMarker = '<div id="mymk' + randomId + '"></div>';
      var parent = this.viewer.container
      $(parent).append(htmlMarker);
      $('#mymk'+randomId ).css({
          'pointer-events': 'none',
          'width': '20px',
          'height': '20px',
          'position': 'absolute',
          'overflow': 'visible' 
          });
        
      //build the svg element and draw a circle
        $('#mymk'+randomId).append('<svg id="mysvg'+randomId+ '"></svg>')
        var snap = Snap($('#mysvg'+randomId)[0]);
        var rad = 12;
        var circle = snap.paper.circle(14, 14, rad);
        circle.attr({
            fill: "#FF8888",
            fillOpacity: 0.6,
            stroke: "#FF0000",
            strokeWidth: 3
        }); 

        //set the position of the SVG
        //adjust to make the circle center is the position of the click point
        var $container = $('#mymk'+randomId); 
        $container.css({
            'left': screenpoint.x - rad*2,
            'top': screenpoint.y - rad
        }); 
        
        //store 3D point data to the DOM
        var div = $('#mymk'+randomId);
        //add radius info with the 3D data
        pushpinModelPt.radius = rad;
        var storeData = JSON.stringify(pushpinModelPt);
        div.data('3DData', storeData);
  }

  initiateSVG(){
    console.log('initiateSVG called');
    console.log(this.viewer)

    this.viewer.container.addEventListener("click", this.onMouseClick)
    //delegate the event of CAMERA_CHANGE_EVENT
    this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, function(rt){  

      //find out all pushpin markups
      var $eles = $("div[id^='mymk']"); 
      console.log($eles)
      var DOMeles = $eles.get();

      for(var index in DOMeles){
         
        //get each DOM element
        var DOMEle = DOMeles[index];
        var divEle = $('#' + DOMEle.id);
        //get out the 3D coordination
         var val = divEle.data('3DData'); 
         var pushpinModelPt = JSON.parse(val);
         //get the updated screen point
         var screenpoint = this.viewer.worldToClient(new THREE.Vector3(
          pushpinModelPt.x,
          pushpinModelPt.y,
          pushpinModelPt.z,)); 
          //update the SVG position.
          divEle.css({
              'left': screenpoint.x - pushpinModelPt.radius*2,
              'top': screenpoint.y - pushpinModelPt.radius
              }); 
        } 
    });  
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to involke function to add button
  //
  /////////////////////////////////////////////////////////
  renderButton(){
    return (
      <Button 
      bsStyle="primary"
      onClick={this.initiateSVG}>
        Set Boundry
      </Button>
  );
  }

  /////////////////////////////////////////////////////////
  // Function added by Yumo to add dropdown buttons
  //
  /////////////////////////////////////////////////////////
  renderDropDown(title, i){
    const state = this.react.getState();

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
        }
        { 
          this.renderButton()
        }
        { this.renderContent () }

      </WidgetContainer>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  WallAnalyzerExtension.ExtensionId,
  WallAnalyzerExtension)


