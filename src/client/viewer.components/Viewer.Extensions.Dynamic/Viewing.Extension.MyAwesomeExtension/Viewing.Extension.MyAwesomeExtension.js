/**
 * @fileoverview  MyAwesomeExtension.js - Working progress toward model divider extension for 
 * auto4DBIM. There is still major work to do for this code. Much of the current codes comes
 * Viewing.Extension.BarChart by Philippe Leefsma. This is will be mostly removed in the
 * future to make way for model divider's proper code.
 *
 * @author yumochi2@illinois.edu (Yumo Chi)
 */

/////////////////////////////////////////////////////////
// Viewing.Extension.BarChart
// by Philippe Leefsma, March 2017
//
/////////////////////////////////////////////////////////
import MultiModelExtensionBase from 'Viewer.MultiModelExtensionBase'
import DropdownButton from 'react-bootstrap/lib/DropdownButton'
import MenuItem from 'react-bootstrap/lib/MenuItem'
import Form from 'react-bootstrap/lib/Form'
import WidgetContainer from 'WidgetContainer'
import {ReactLoader as Loader} from 'Loader'
import './Viewing.Extension.MyAwesomeExtension.scss'
import transform from 'lodash/transform'
import Toolkit from 'Viewer.Toolkit'
import sortBy from 'lodash/sortBy'
import BarChart from 'BarChart'
import d3 from 'd3'
import React from 'react';

class MyAwesomeExtension extends MultiModelExtensionBase {

  /////////////////////////////////////////////////////////
  // Class constructor
  //
  /////////////////////////////////////////////////////////
  constructor (viewer, options) {

    super (viewer, options)

    this.toggleTheming = this.toggleTheming.bind(this)

    this.onStopResize = this.onStopResize.bind(this)

    this.renderTitle = this.renderTitle.bind(this)

    this.render = this.render.bind(this)

    this.react = options.react

    /**
    * binding saveSection, a file used to allow user to name model section. Not sure if 
    * this is necessary, but following suit.
    **/

    this.saveSection = this.saveSection.bind(this)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  get className() {

    return 'MyAwesomeExtension'
  }

  /////////////////////////////////////////////////////////
  // Extension Id
  //
  /////////////////////////////////////////////////////////
  static get ExtensionId() {

    return 'Viewing.Extension.MyAwesomeExtension'
  }

  /////////////////////////////////////////////////////////
  // Load callback
  //
  /////////////////////////////////////////////////////////
  load () {

    this.react.setState({
      activeProperty: '',
      showLoader: true,
      disabled: false,
      theming: false,
      items: [],
      data: [],
      sectionName: []
    }).then (() => {

      this.react.pushRenderExtension(this)

      const model = this.viewer.activeModel ||
        this.viewer.model

      if (model) {

        this.loadChart (model)
      }
    })

    this.viewer.loadDynamicExtension(
      'Viewing.Extension.ContextMenu', {
        buildMenu: (menu) => {
          return menu.map((item) => {
            const title = item.title.toLowerCase()
            if (title === 'show all objects') {
              return {
                title: 'Show All objects',
                target: () => {
                  Toolkit.isolateFull(this.viewer)
                  this.viewer.fitToView()
                }
              }
            }
            return item
          })
        }
      })

    console.log('Viewing.Extension.MyAwesomeExtension loaded')

    return true
  }

  /////////////////////////////////////////////////////////
  // Unload callback
  //
  /////////////////////////////////////////////////////////
  unload () {

    const state = this.react.getState()

    if (state.theming) {

      this.toggleTheming()
    }

    console.log('Viewing.Extension.MyAwesomeExtension unloaded')

    super.unload ()

    return true
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async loadChart (model) {

    await this.react.setState({
      showLoader: true
    })

    if (!model.getData().instanceTree)
      return

    this.componentIds = await Toolkit.getLeafNodes(model)

    const chartProperties =
      this.options.chartProperties ||
      await Toolkit.getPropertyList(
        this.viewer, this.componentIds, model)

    $('#my-awesome-extension-dropdown').parent().find('ul').css({
      height: Math.min(
        $('.my-awesome-extension').height() - 42,
        chartProperties.length * 26 + 16)
    })

    await this.react.setState({
      items: chartProperties
    })

    this.setActiveProperty (
      chartProperties[this.options.defaultIndex || 0])

    const fragIds = await Toolkit.getFragIds(
      model, this.componentIds)

    this.fragIdToMaterial = {}

    const fragList = model.getFragmentList()

    fragIds.forEach((fragId) => {

      const material = fragList.getMaterial(fragId)

      if (material) {

        this.fragIdToMaterial[fragId] = material
      }
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onModelActivated (event) {

    if (event.source !== 'model.loaded') {

      this.loadChart(event.model)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onModelCompletedLoad (event) {

    this.loadChart(event.model)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  toggleTheming () {

    const state = this.react.getState()

    const theming = !state.theming

    this.react.setState({
      theming
    })

    if (theming) {

      state.data.forEach((group) => {

        group.dbIds.forEach((dbId) => {

          const model = this.viewer.activeModel ||
            this.viewer.model

          Toolkit.setMaterial(
            model, dbId,
            group.material)
        })
      })

    } else {

      for(const fragId in this.fragIdToMaterial) {

        const material = this.fragIdToMaterial[fragId]

        const model = this.viewer.activeModel ||
          this.viewer.model

        const fragList =
          model.getFragmentList()

        fragList.setMaterial(fragId, material)
      }
    }

    this.viewer.impl.invalidate(
      true, false, false)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async setActiveProperty (propName, disable) {

    const state = this.react.getState()

    await this.react.setState({
      activeProperty: disable ? propName : '',
      disabled: disable,
      showLoader: true
    })

    const data = await this.buildPropertyData (propName)

    await this.react.setState({
      activeProperty: propName,
      showLoader: false,
      guid: this.guid(),
      disabled: false,
      data
    })

    if (state.theming) {

      data.forEach((group) => {

        group.dbIds.forEach((dbId) => {

          const model = this.viewer.activeModel ||
            this.viewer.model

          Toolkit.setMaterial(
            model, dbId,
            group.material)
        })
      })

      this.viewer.impl.invalidate(
        true, false, false)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  createMaterial (clrStr) {

    const clr = parseInt(clrStr.replace('#',''), 16)

    const props = {
      shading: THREE.FlatShading,
      name: this.guid(),
      specular: clr,
      shininess: 0,
      emissive: 0,
      diffuse: 0,
      color: clr
    }

    const material = new THREE.MeshPhongMaterial(props)

    this.viewer.impl.matman().addMaterial(
      props.name, material, true)

    return material
  }

  /////////////////////////////////////////////////////////
  // Group object map for small values:
  // If one entry of the map is smaller than minPercent,
  // this entry will be merged in the "group" entry
  //
  /////////////////////////////////////////////////////////
  groupMap (map, group, totalValue, minPercent) {

    return transform (map, (result, value, key) => {

      if (value.length * 100 / totalValue < minPercent) {

        result[group] = (result[group] || []).concat(value)

      } else {

        result[key] = value
      }
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async buildPropertyData (propName) {

    const model = this.viewer.activeModel ||
      this.viewer.model

    const componentsMap =
      await Toolkit.mapComponentsByProp(
        model, propName,
        this.componentIds)

    for (const key in componentsMap) {

      if (!key.length || key.indexOf('<') > -1) {

        delete componentsMap[key]
      }
    }

    const groupedMap = this.groupMap(
      componentsMap, 'Other',
      this.componentIds.length, 2.0)

    const keys = Object.keys (groupedMap)

    const colors = d3.scale.linear()
      .domain([0, keys.length * .33, keys.length * .66, keys.length])
      .range(['#FCB843', '#C2149F', '#0CC4BD', '#0270E9'])

    const data = keys.map((key, idx) => {

      const dbIds = groupedMap[key]

      const color = colors(idx)

      const percent =
        100 * dbIds.length /
        this.componentIds.length

      return {
        label: `${key}: ${percent.toFixed(2)}% (${dbIds.length})`,
        material: this.createMaterial(color),
        value: dbIds.length,
        shortLabel: key,
        percent,
        dbIds,
        color
      }
    })

    return sortBy(data, (entry) => -1 * entry.value)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onStopResize () {

    const state = this.react.getState()

    $('#my-awesome-extension-dropdown').parent().find('ul').css({
      height: Math.min(
        $('.my-awesome-extension').height() - 42,
        state.items.length * 26 + 16)
    })

    this.react.setState({
      guid: this.guid()
    })
  }
/////////////////////////////////////////////////////////
//  functions added by Yumo Chi 
//
/////////////////////////////////////////////////////////

//-------------------------------------------------------------------------
/**
 * Get section name from user and save to state
 * @param {} event Event triggered by clicking on saving file button
 */

  saveSection(event){
    console.log('working!')
    console.log(event)

  }
  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderTitle () {

    const state = this.react.getState()

    const menuItems = state.items.map((item, idx) => {
      return (
        <MenuItem eventKey={idx} key={idx} onClick={() => {

          this.setActiveProperty (item, true)
        }}>
          { item }
        </MenuItem>
      )
    })

    const themingClr = {
      color: state.theming
        ? '#FF0000'
        : '#9b9b9b'
    }

    return (
      <div className="title controls" id = "my-awesome-extension-title">
        <label id = "my-awesome-extension-title-label">
          Model Divider
        </label>

        { /* <DropdownButton
          title={"Property: " + state.activeProperty }
          disabled={state.disabled}
          key="my-awesome-extension-dropdown"
          id="my-awesome-extension-dropdown">
         { menuItems }
        </DropdownButton>

        <button onClick={this.toggleTheming}
          disabled={state.disabled}
          title="color theming"
          id= "my-awesome-extension-title-button">
          <span className="fa fa-paint-brush" style={themingClr}>
          </span>
        </button> */ }
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  render (opts = {showTitle: true}) {

    const state = this.react.getState()

    return (
      <div>
        <div>
        <p>This is a simple tool for sectioning a model and saving the space for the project. 
        Simply section the appropriate space and enter an unique name, then save the information.</p>
        </div>
        <div>
        <input
          id = "userSectionName"
          type="text"
          value="Enter desired name"
        />
        <button
          onClick={this.saveSection}
          title="save file">
          Save
        </button>
        </div>
      </div>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  MyAwesomeExtension.ExtensionId,
  MyAwesomeExtension)

export default 'Viewing.Extension.MyAwesomeExtension'
