import React from "react";
import socketIOClient from "socket.io-client";
import NavigationPrompt from "react-router-navigation-prompt";
import "./index.css";
import { connect } from "react-redux";
import { default as RDraggable } from "react-draggable";
import WithHeader from "../projectEditor/Components/WithHeader";
import { StoreX as Store } from "../../storeX";
import { instanceOf } from "prop-types";
import {
  showToastr,
  showToastrError,
  baseAddress,
  isUserLoggedIn,
  cleanPayload
} from "../../actions/common";
import { fetchPerformance, openPort } from "./actions";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { loadProject } from "./thunks.js";
import Cookies from "universal-cookie";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  Navbar,
  NavItem
} from "reactstrap";
import { NavLink } from "react-router-dom";
import Modal from "react-bootstrap/Modal";
import RegisterForm from "../register/form";
import LoginForm from "../login/form";
import FormInput from "../form/FormInput";

const cookies = new Cookies();

// a little function to help us with reordering the result
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const getItemStyle = (isDragging, draggableStyle) => ({
  userSelect: "none",
  ...draggableStyle,
  boxShadow: isDragging
    ? `0 25px 50px rgba(255,20,147,0.50), 0 20px 15px rgba(255,20,147,0.42)`
    : ""
});

const move = (source, destination, droppableSource, droppableDestination) => {
  const sourceClone = Array.from(source);
  const destClone = Array.from(destination);
  const [removed] = sourceClone.splice(droppableSource.index, 1);

  destClone.splice(droppableDestination.index, 0, removed);

  const result = [];
  result.push({ value: sourceClone, id: droppableSource.droppableId });
  result.push({ value: destClone, id: droppableDestination.droppableId });

  return result;
};

const getListStyle = isDraggingOver => ({
  width: "13rem",
  background: isDraggingOver ? "lightblue" : "transparent"
});

class Performance extends React.Component {
  static propTypes = {
    cookies: instanceOf(Cookies).isRequired
  };
  constructor(props) {
    super(props);
    this.state = {
      endpoint: baseAddress(),
      performanceId: this.props.match.params.id,
      items: [[], [], []],
      prevItems: this.props.blocks.bs,
      projectName: "",
      projectDescription: "",
      openPorts: [],
      oscIP: [],
      isProjectChanged: undefined,
      view: localStorage.getItem("editorView" + this.props.match.params.id)
        ? localStorage.getItem("editorView" + this.props.match.params.id)
        : localStorage.getItem("editorView")
        ? localStorage.getItem("editorView")
        : "Column",
      projectsDropdownOpen: false,
      viewDropdownOpen: false,
      isModalOpen: false,
      isRegisterModalOpen: false,
      isLoginModalOpen: false
    };
    this.canvasRef = React.createRef();
    this.onDragEnd = this.onDragEnd.bind(this);
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
    this.toggleViewDropdown = this.toggleViewDropdown.bind(this);
    this.toggleProjectsDropdown = this.toggleProjectsDropdown.bind(this);
    this.timer = null;
  }

  getList = id => {
    let x = this.state["items"];
    return x[id.split("_")[1]];
  };
  onDragEnd = result => {
    const { source, destination } = result;
    // dropped outside the list
    if (!destination) {
      return;
    }
    // console.log(source, destination);
    if (source.droppableId === destination.droppableId) {
      const items = reorder(
        this.getList(source.droppableId),
        source.index,
        destination.index
      );

      let finalResult = this.state.items;
      finalResult[parseInt(source.droppableId.split("_")[1])] = items;

      this.setState({ items: finalResult });
    } else {
      const result = move(
        this.getList(source.droppableId),
        this.getList(destination.droppableId),
        source,
        destination
      );
      let finalResult = this.state.items;
      finalResult[parseInt(result[0]["id"].split("_")[1])] = result[0]["value"];
      finalResult[parseInt(result[1]["id"].split("_")[1])] = result[1]["value"];
      this.setState({
        items: finalResult
      });
    }
  };

  blockStyle = id => {
    const top = (id % 15) * 20 + "px";
    const left = (id % 15) * 20 + "px";
    const zIndex = this.state.selectedBlock
      ? id === this.state.selectedBlock
        ? 1
        : 0
      : 0;
    return {
      position: "absolute",
      top: top,
      left: left,
      zIndex: zIndex
    };
  };

  renderBlockList = (blocks, nowOut) => {
    blocks = blocks.map(column => {
      const col = column.filter(item => item !== undefined);
      return col;
    });
    if (this.state.view === "Floating") {
      let finalBlock = [];
      blocks.forEach(o => {
        finalBlock = finalBlock.concat(o);
      });
      return (
        <div
          style={{
            top: "5px",
            height: this.state.windowH - 95,
            width: this.state.windowW - 20,
            position: "relative"
          }}
        >
          <div className="boxContainer">
            {finalBlock.map(b => (
              <RDraggable
                bounds="parent"
                cancel="input"
                onDrag={() => {
                  if (this.state.selectedBlock !== b.id) {
                    this.setState({ selectedBlock: b.id });
                  }
                }}
              >
                <div
                  className="no-cursor"
                  onClick={() => {
                    this.setState({ selectedBlock: b.id });
                  }}
                  style={this.blockStyle(b.id)}
                >
                  <div>
                    <WithHeader
                      key={b.id}
                      blockInfo={b}
                      nowOut={nowOut}
                      disablePatching={true}
                    />
                  </div>
                </div>
              </RDraggable>
              // <ExampleWrapper />
            ))}
          </div>
        </div>
      );
    } else {
      return (
        <React.Fragment>
          <DragDropContext onDragEnd={this.onDragEnd}>
            {blocks.map((b, listIndex) => (
              <div
                style={{
                  paddingTop: "5px",
                  paddingLeft: "10px"
                }}
              >
                <Droppable droppableId={"droppable_" + listIndex}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={getListStyle(snapshot.isDraggingOver)}
                    >
                      {b.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={getItemStyle(
                                snapshot.isDragging,
                                provided.draggableProps.style
                              )}
                            >
                              <WithHeader
                                key={item.id}
                                blockInfo={item}
                                nowOut={nowOut}
                                disablePatching={true}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </DragDropContext>
        </React.Fragment>
      );
    }
  };

  componentWillReceiveProps(nextProps) {
    if (nextProps.match.params.id !== this.props.match.params.id)
      this.setState({ performanceId: nextProps.match.params.id }, () => {
        this.loadState();
      });
    if (this.state.prevItems !== nextProps.blocks.bs) {
      let length = this.state.items.length;
      let newValue = [];
      for (let i = 0; i < length; i++) {
        newValue[i] = [];
      }
      nextProps.blocks.bs.forEach(o => {
        this.state.items.every((arr, index) => {
          arr = arr.filter(e => e !== undefined);
          const found = arr.find(element => element["id"] === o["id"]);
          if (found === undefined) {
            if (index === length - 1) {
              newValue[0].push(o);
            }
            return true;
          } else {
            const i = arr.findIndex(element => element["id"] === o["id"]);
            newValue[index][i] = o;
            return false;
          }
        });
      });
      var checkUpdate = this.state.isProjectChanged;
      if (checkUpdate === undefined) {
        checkUpdate = false;
      } else {
        checkUpdate = true;
      }

      this.setState({
        isProjectChanged: checkUpdate,
        items: newValue,
        prevItems: nextProps.blocks.bs
      });
    }
  }

  componentDidMount() {
    this.loadState();
    this.updateWindowDimensions();
    window.addEventListener("resize", this.updateWindowDimensions);
    const { endpoint } = this.state;
    const socket = socketIOClient(endpoint);
    socket.on("openPort", data => {
      // console.log(data);
      this.setState({
        openPorts: data
      });
    });
    socket.on("oscData", data => {
      let senderIp = data.sender_ip;
      let portNumber = data.portNumber;
      let targetType = data.component;
      let targetComponent = this.findComponents(
        portNumber,
        targetType,
        senderIp
      );
      // console.log(targetComponent);
      targetComponent.forEach(comp => {
        this.handleOscInput(comp, data);
      });
    });
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    let maxColumn = Math.floor((window.innerWidth - 100) / 220);
    let items = this.state.items;
    if (items.length !== maxColumn) {
      let sizeChange = maxColumn - items.length;
      if (sizeChange > 0) {
        while (sizeChange--) {
          items.push([]);
        }
      } else if (sizeChange < 0) {
        while (sizeChange++ < 0) {
          items[items.length - 2] = items[items.length - 2].concat(
            items[items.length - 1]
          );
          items.pop();
        }
      }
    }
    this.setState({
      windowW: window.innerWidth,
      windowH: window.innerHeight,
      items: items
    });
  }

  findComponents(oscPort, targetType, senderIp) {
    let components = [];
    let oscIP = this.state.oscIP;
    this.props.blocks["bs"].forEach((comp, index) => {
      let compIP =
        oscIP.filter(x => x.id === comp.id).length === 1
          ? oscIP.filter(x => x.id === comp.id)[0]["ip"]
          : undefined;
      console.log(comp.typeName);
      console.log(compIP);
      if (
        !!comp.oscPort &&
        comp.oscPort == oscPort &&
        comp.typeName == targetType &&
        compIP == senderIp
      ) {
        components.push({ id: comp.id, index: index });
      }
    });
    return components;
  }

  handleOscInput(comp, data) {
    switch (data.component) {
      case "Delay":
        break;
      case "Transposer":
        break;
      case "Pan":
        break;
      case "Player":
        this.handleOscPlayer(comp.id, comp.index, data);
        break;
      case "SignalGen":
        break;
      case "GranSynth":
        break;
      case "Speaker":
        break;
      case "DirectInput":
        break;
      case "Pitch":
        break;
      case "Reverb":
        break;
      case "Routing":
        break;
      case "Mixer":
        this.handleOscMixer(comp.id, data);
        break;
      case "Oscilloscope":
        break;
      case "Spectroscope":
        break;
      case "SamplePlayer":
        this.handleOscSamplePlayer(comp.id, comp.index, data);
        break;
      default:
        console.log("Unhandles case " + data.component);
    }
  }

  handleOscSamplePlayer(id, index, data) {
    let field,
      value,
      num = {},
      ignore = false,
      ind;
    switch (data.type) {
      case "random":
        field = "random";
        value = data.value === 1 ? true : false;
        break;
      case "loop":
        field = "loop";
        value = data.value === 1 ? true : false;
        break;
      case "playbackSpeed":
        field = "speed";
        value = data.value * 2;
        break;
      case "volume":
        field = "masterVolume";
        value = Math.round(data.value * 100);
        break;
      case "playPause":
        ind = data.value[0] - 1;
        if (
          data.value[1] === 0 &&
          this.props.blocks["bs"][index].audioObj.options[`path${ind}`] !== ""
        ) {
          if (this.props.blocks["bs"][index].audioObj.players[ind].isPlaying) {
            this.props.blocks["bs"][index].audioObj.pause(ind);
          } else {
            this.props.blocks["bs"][index].audioObj.play(ind);
          }
          field = "playings";
          value = undefined;
          num = { ind };
        } else {
          ignore = true;
        }
        break;
      case "stop":
        ind = data.value[0] - 11;
        if (
          data.value[1] === 0 &&
          this.props.blocks["bs"][index].audioObj.options[`path${ind}`] !== ""
        ) {
          field = "playings";
          value = undefined;
          num = { ind };
          this.props.blocks["bs"][index].audioObj.stop(ind);
        } else {
          ignore = true;
        }

        break;
      case "reverse":
        if (data.value === 0) {
          field = "reversed";
          value = undefined;
        } else {
          ignore = true;
        }

        break;
      default:
        console.log("Unhandles case " + data.type);
    }
    if (!ignore) {
      this.props.dispatch({
        type: "CHANGE_BLOCK",
        id: id,
        field,
        value,
        ...num
      });
    }
  }

  handleOscPlayer(id, index, data) {
    let field,
      value,
      ignore = false;
    switch (data.type) {
      case "loop":
        field = "loop";
        value = data.value === 1 ? true : false;
        break;
      case "playbackSpeed":
        field = "speed";
        value = data.value * 2;
        break;
      case "volume":
        field = "volume";
        value = Math.round(data.value * 100);
        break;
      case "playPause":
        if (
          data.value === 0 &&
          this.props.blocks["bs"][index].audioObj.options.path !== ""
        ) {
          if (this.props.blocks["bs"][index].audioObj.isPlaying) {
            this.props.blocks["bs"][index].audioObj.pause();
          } else {
            this.props.blocks["bs"][index].audioObj.play();
          }

          field = "playing";
          value = undefined;
        } else {
          ignore = true;
        }
        break;
      case "stop":
        if (
          data.value === 0 &&
          this.props.blocks["bs"][index].audioObj.options.path !== ""
        ) {
          field = "playing";
          value = undefined;
          this.props.blocks["bs"][index].audioObj.stop();
        } else {
          ignore = true;
        }

        break;
      case "reverse":
        if (
          data.value === 0 &&
          this.props.blocks["bs"][index].audioObj.options.path !== ""
        ) {
          this.props.blocks["bs"][index].audioObj.reverse(res => {
            // console.log(res);
          });
        } else {
          ignore = true;
        }

        break;
      case "seek":
        if (this.props.blocks["bs"][index].audioObj.options.path !== "") {
          this.props.blocks["bs"][index].audioObj.seek(data.value);
        }
        ignore = true;
        break;
      default:
        console.log("Unhandles case " + data.type);
    }
    if (!ignore) {
      this.props.dispatch({
        type: "CHANGE_BLOCK",
        id: id,
        field,
        value
      });
    }
  }

  handleOscMixer(id, data) {
    let field, value;
    switch (data.type) {
      case "playerVolume":
        field = "node" + (data.value[0] - 1) + "Gain";
        value = data.value[1];
        break;
      case "mainVolume":
        field = "masterGain";
        value = data.value;
        break;
      default:
        console.log("Unhandles case " + data.type);
    }
    this.props.dispatch({
      type: "CHANGE_BLOCK",
      id: id,
      field,
      value
    });
  }

  openNewPort(blocks) {
    blocks.forEach(block => {
      if (
        block.osc &&
        block.oscPort &&
        this.state.openPorts.indexOf(block.oscPort) === -1
      ) {
        this.setState({ openPorts: [...this.state.openPorts, block.oscPort] });
        // console.log({ portNumber: block.oscPort });
        openPort({ portNumber: block.oscPort })
          .then(data => {
            if (data.err) {
              showToastrError(data);
            } else {
              showToastr("success", data["message"]);
            }
          })
          .catch(error => {
            showToastrError(error);
          });
      }
    });
  }

  loadState() {
    if (this.state.performanceId !== "new") {
      fetchPerformance(this.state.performanceId)
        .then(res => {
          let { name, oscip, content } = res;
          this.props.dispatch(loadProject(content));
          oscip = JSON.parse(oscip);
          this.setState({
            projectName: name,
            oscIP: oscip
          });
        })
        .catch(err => {
          showToastrError(err);
        });
    } else {
      this.props.dispatch(loadProject(localStorage.getItem("localProject")));
      this.setState({
        projectName: "",
        projectDescription: ""
      });
    }
  }

  handleOnChange = (name, value) => {
    const params = { [name]: value };
    this.setState(params);
  };

  checkIfAllPortsAreOpen(blocks) {
    let flag = true;
    blocks.forEach(block => {
      if (
        block.osc &&
        block.oscPort &&
        this.state.openPorts.indexOf(block.oscPort) === -1
      ) {
        flag = false;
      }
    });
    return flag;
  }

  toggleViewDropdown() {
    this.setState({ viewDropdownOpen: !this.state.viewDropdownOpen });
  }

  toggleProjectsDropdown() {
    this.setState({ projectsDropdownOpen: !this.state.projectsDropdownOpen });
  }

  handleOnChange = (name, value) => {
    const params = { [name]: value };
    this.setState(params);
  };

  toggleModal = () => this.setState({ isModalOpen: !this.state.isModalOpen });

  toggleLoginModal = () => {
    this.setState({ isLoginModalOpen: !this.state.isLoginModalOpen });
  };

  render() {
    let { items } = this.state;
    const openPortsButton = this.checkIfAllPortsAreOpen(this.props.blocks["bs"])
      ? false
      : true;
    if (openPortsButton) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.openNewPort(this.props.blocks["bs"]);
      }, 2000);
    }
    return (
      <React.Fragment>
        <div style={{ backgroundColor: "Yellow" }}>
          <NavigationPrompt
            renderIfNotActive={true}
            // Confirm navigation if going to a path that does not start with current path:
            when={(crntLocation, nextLocation) =>
              !nextLocation ||
              !nextLocation.pathname.startsWith(crntLocation.pathname)
            }
          >
            {({ isActive, onCancel, onConfirm }) => {
              if (isActive) {
                return (
                  <Modal centered show={true}>
                    <div>
                      <Modal.Body>
                        WARNING: you are leaving the performance.
                      </Modal.Body>
                      <Modal.Footer>
                        <button className="btn btn-success" onClick={onCancel}>
                          Stay On Page
                        </button>
                        <button className="btn btn-warning" onClick={onConfirm}>
                          Leave
                        </button>
                      </Modal.Footer>
                    </div>
                  </Modal>
                );
              }
            }}
          </NavigationPrompt>
          <Navbar light expand="md" style={{ padding: "0 90px 0 90px" }}>
            <div className="container-fluid">
              <Nav navbar>
                <Dropdown
                  nav
                  isOpen={this.state.projectsDropdownOpen}
                  toggle={this.toggleProjectsDropdown}
                >
                  <DropdownToggle nav caret>
                    View
                  </DropdownToggle>
                  <DropdownMenu tog>
                    <DropdownItem
                      disabled={this.state.view === "Floating"}
                      onClick={() =>
                        this.setState({ view: "Floating" }, () => {
                          localStorage.setItem(
                            "editorView" + this.props.match.params.id,
                            "Floating"
                          );
                        })
                      }
                    >
                      <span
                        className={
                          this.state.view === "Floating" ? "fa fa-check " : ""
                        }
                      ></span>{" "}
                      Floating
                    </DropdownItem>
                    <DropdownItem
                      disabled={this.state.view === "Column"}
                      onClick={() =>
                        this.setState({ view: "Column" }, () => {
                          localStorage.setItem(
                            "editorView" + this.props.match.params.id,
                            "Column"
                          );
                        })
                      }
                    >
                      <span
                        className={
                          this.state.view === "Column" ? "fa fa-check " : ""
                        }
                      ></span>{" "}
                      Column
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
                <h6 style={{ paddingTop: "10px", paddingLeft: "10px" }}>
                  <span class="badge badge-secondary">
                    OSC IP: 18.224.253.25
                  </span>
                </h6>
              </Nav>
              <Nav className="ml-auto" navbar>
                <NavItem>
                  <NavLink className="nav-link" to="/contact">
                    <span className="fa fa-expand " />
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink className="nav-link" to="/contact">
                    <span className="fa fa-compress " />
                  </NavLink>
                </NavItem>
              </Nav>
            </div>
          </Navbar>
          <div className="container-fluid">
            <div>
              <div className="row" style={{ paddingLeft: "50px" }}>
                {this.renderBlockList(items, this.props.blocks.nowOut)}
              </div>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

const mapStateToProps = state => ({
  blocks: state.blocks
});

export default connect(mapStateToProps)(Performance);
