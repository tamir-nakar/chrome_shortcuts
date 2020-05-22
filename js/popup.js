import Item from "./item.js";
//data layer
const item = new Item('a','b','c');
let groupsMap = {};
let displayNameSet = new Set();
//dom elements
let aliases;
let groupsSideBar;
//etc
let groupContextMenu;
let itemContextMenu;
let contextMenuTarget;
let menus;

const swalAlert = Swal.mixin({
  customClass: {
    confirmButton: "button success",
    cancelButton: "button danger",
  },
  buttonsStyling: false,
});

function remove(alias) {
  swalAlert
    .fire({
      title: "Are you sure?",
      text: `Delete '${alias}' ?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "No, cancel!",
      reverseButtons: true,
    })
    .then((result) => {
      if (result.value) {
        chrome.storage.sync.remove(alias, function () {
          $(`[id='${alias}']`).remove();
        });
        Swal.fire("Success!", `'${alias}' was deleted successfully`, "success");
      } else if (
        /* Read more about handling dismissals below */
        result.dismiss === Swal.DismissReason.cancel
      ) {
      }
    });
}

window.addEventListener("DOMContentLoaded", async () => {
  await _init();
});

async function _init() {
  _initDomReferences();
  _initContextMenus();
  _initEvents();
  await _fetchGroupsMapAsync();
  _drawGroups();
  _forceSelectGroupByName("General");
}

function _initContextMenus() {
  groupContextMenu = new ContextMenu({
    theme: "default", // or 'blue'

    items: [
      {
        icon: "import",
        name: "Import to group",
        action: () => console.log("jQuery"),
      },

      {
        icon: "export",
        name: "Export group",
        action: () => console.log("Script"),
      },

      {icon: "trash", name: "Delete group", action: () => console.log("Net")},
    ],
  });

  itemContextMenu = new ContextMenu({
    theme: "default", // or 'blue'

    items: [
      {
        icon: "trash",
        name: "Delete item",
        action: async () => {
          const displayName = contextMenuTarget.getAttribute("displayname");
          const groupName = contextMenuTarget.getAttribute("group");
          await _removeItemAsync(displayName, groupName);
          _forceSelectGroupByName(groupName);
          itemContextMenu.hide();
          //document.querySelector(`[displayName="${...}"]`)
        },
      },

      {
        icon: "edit",
        name: "Edit item",
        action: async () => {
          const displayName = contextMenuTarget.getAttribute("displayname");
          const groupName = contextMenuTarget.getAttribute("group");
          const item = groupsMap[groupName].find(
            (i) => i.displayName === displayName
          );
          await _editItem(item); //async
          itemContextMenu.hide();
        },
      },
    ],
  });

  menus = [groupContextMenu, itemContextMenu];
}
function _drawGroups() {
  rightSideBar.innerHTML = '<div class="addGroupBtn">newGroup</div>'; // clean
  document
    .querySelector(".addGroupBtn")
    .addEventListener("click", () => _addNewGroup());
  Object.keys(groupsMap).forEach((groupName) => _drawSingleGroup(groupName));
}

function _drawSingleGroup(groupName) {
  const elemToAdd = document.createElement("div");
  elemToAdd.classList.add("sideBarItem");
  elemToAdd.innerText = groupName;

  //elemToAdd.id = groupName.replace(/ /g, "_").replace(/()/g "Xx");
  elemToAdd.setAttribute("groupName", groupName);
  elemToAdd.addEventListener("click", (e) => _handleGroupSelected(e));
  elemToAdd.addEventListener(
    "contextmenu",
    (e) => _openContextMenu(e, groupContextMenu),
    false
  );
  elemToAdd.addEventListener("dragover", (e) => console.log("over"));
  elemToAdd.addEventListener("dragleave", (e) => console.log("leave"));
  elemToAdd.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.target.className == "sideBarItem") {
      const draggedItem = JSON.parse(e.dataTransfer.getData("text"));
      _handleItemTransferAsync(draggedItem, groupName);
    }
  });
  groupsSideBar.insertBefore(elemToAdd, document.querySelector(".addGroupBtn"));
}

async function _handleItemTransferAsync(draggedItem, newGroupName) {
  const displayName = draggedItem.displayName;
  const oldGroup = draggedItem.group;
  const data = await _getStoredDataAsync();
  const storedItem = data.items.find(
    (item) => item.displayName === displayName
  );
  storedItem.group = newGroupName;
  draggedItem.group = newGroupName;
  //await _storeDataAsync(data);
  chrome.storage.sync.set(data);
  _removeItemFromGroupsMap(oldGroup, displayName);
  groupsMap[newGroupName].push(draggedItem);
  _forceSelectGroupByName(oldGroup); // redraw to see item dissappear
}

function _removeItemFromGroupsMap(group, displayName) {
  const index = groupsMap[group].findIndex(
    (item) => item.displayName === displayName
  );
  if (index > -1) {
    groupsMap[group].splice(index, 1);
  }
}
function _storeDataAsync(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

function _initDomReferences() {
  aliases = document.querySelector("#aliases");
  groupsSideBar = document.querySelector("#rightSideBar");
}

function _openContextMenu(e, menu) {
  e.preventDefault();
  contextMenuTarget = e.target;
  // open the menu with a delay
  const time = menu.isOpen() ? 100 : 0;
  // hide the current menu (if any)
  menu.hide();
  // display menu at mouse click position
  setTimeout(() => {
    menu.show(e.pageX, e.pageY);
  }, time);
  // close the menu if the user clicks anywhere on the screen
  document.addEventListener("mousedown", (e) => _hideAllMenus(e), false);
}

function _hideAllMenus(e) {
  if (e.target.className.includes("context-menu")) {
    return;
  }
  menus.forEach((menu) => (menu.isOpen() ? menu.hide() : ""));
}

function _hideContextMenu(menu) {
  menu.hide();
  document.removeEventListener("click", _hideContextMenu(menu));
}

function _initEvents() {
  document
    .querySelector("#export")
    .addEventListener("click", () => handleExportAsync());

  document
    .querySelector("#selectFiles")
    .addEventListener("change", async () => await handleImportAsync());

  document
    .querySelectorAll(".sideBarItem")
    .forEach((item) =>
      item.addEventListener("click", (e) => _handleGroupSelected(e))
    );

  document
    .querySelector("#clear")
    .addEventListener("click", () => _clearActiveGroupItems());

  document
    .querySelector(".addSiteBtn")
    .addEventListener("click", () => _addItem());

  document
    .querySelector(".addGroupBtn")
    .addEventListener("click", () => _addNewGroup());

  //allow dragging
  document.addEventListener("dragover", function (event) {
    event.preventDefault();
  });
}
function _ShowItemsOfSelectedGroup() {
  console.log("@_ShowItemsOfSelectedGroup");
  console.log(groupsMap);
  const activeGroupName = _getActiveGroupName();

  groupsMap[activeGroupName].forEach((item) => _drawSingleItem(item));
}

function _getActiveGroupName() {
  return document.querySelector(".sideBarItem.active").innerText;
}

function _selectGroup(e) {
  document
    .querySelectorAll(".sideBarItem")
    .forEach((item) => item.classList.remove("active"));
  e.target.classList.add("active");
}

function _selectGroupByName(groupName) {
  document
    .querySelectorAll(".sideBarItem")
    .forEach((item) => item.classList.remove("active"));
  document.querySelector(`[groupName="${groupName}"]`).classList.add("active");

  //.querySelector(`#${groupName.replace(/ /g, "_")}`)
  //.classList.add("active");
}

function _clearActiveGroupItems() {
  const activeGroupName = _getActiveGroupName();

  swalAlert
    .fire({
      title: "Are you sure?",
      text: "You're about do clear your alias list",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    })
    .then((result) => {
      if (result.value) {
        clear();
        displayNameSet = new Set();
      } else if (
        /* Read more about handling dismissals below */
        result.dismiss === Swal.DismissReason.cancel
      ) {
      }
    });
}
function clear() {
  chrome.storage.sync.clear(function () {
    Swal.fire("Success!", "Clear Succedded", "success");
  });
  groupsMap = {};
  displayNameSet = new Set();
  aliases.innerHTML = "";
}

function _addItem() {
  let title;
  let url;
  //async func
  chrome.tabs.query({active: true, lastFocusedWindow: true}, function (tabs) {
    if (tabs[0] != null) {
      title = tabs[0].title;
      url = tabs[0].url;
    }
    Swal.fire({
      title: "<strong>ADD NEW SITE </strong>",
      icon: "info",
      html: `<div align="left">Display name: <input type="text" id="displayNameInput" class="swal2-input" name="displayName" value="${title}" required><br> 
             Group: <select class="swal2-input"  id="groupSelect" name="fname">
             ${(() => {
               let t = "";
               console.log(groupsMap);
               for (opt in groupsMap) {
                 t += `<option value=${opt}>${opt}</option>`;
               }
               return t;
             })()}</select><br> 
         Alias (optional): <input class="swal2-input"type="text" id="aliasInput" name="fname"><br></div>`,
      showCloseButton: true,
      showCancelButton: true,
      focusConfirm: true,
      confirmButtonText: "SAVE",
      cancelButtonText: "Cacel",
      preConfirm: () => {
        let displayName = Swal.getPopup().querySelector("#displayNameInput")
          .value;
        if (!displayName) {
          Swal.showValidationMessage(`Display name must be provided.`);
        }
        if (displayNameSet.has(displayName)) {
          Swal.showValidationMessage(
            `DisplayName already exists. please choose another`
          );
        }
      },
    }).then((res) => {
      if (res && res.value) {
        const groupSelectElem = document.querySelector("#groupSelect");
        const group =
          groupSelectElem.options[groupSelectElem.selectedIndex].value;
        const displayName = document.querySelector("#displayNameInput").value;
        const alias = document.querySelector("#aliasInput").value;

        set(alias, url, displayName, group);
      }
    });
  });
}

async function _editItem(item) {
  const oldGroup = item.group;
  const oldDisplayName = item.displayName;
  const oldAlias = item.alias;

  const res = await Swal.fire({
    title: "<strong>Edit </strong>",
    icon: "info",
    html: `<div align="left">Display name: <input type="text" id="displayNameInput" class="swal2-input" name="displayName" value="${oldDisplayName}" required><br> 
             Group: <select class="swal2-input"  id="groupSelect" name="fname">
             ${(() => {
               let t = "";
               for (opt in groupsMap) {
                 t += `<option value=${opt} ${
                   opt === oldGroup ? "selected" : ""
                 }>${opt}</option> `;
               }
               return t;
             })()}</select><br> 
         Alias (optional): <input class="swal2-input"type="text" id="aliasInput" name="fname" value=${
           oldAlias ? oldAlias : ""
         } ><br></div>`,
    showCloseButton: true,
    showCancelButton: true,
    focusConfirm: true,
    confirmButtonText: "SAVE",
    cancelButtonText: "Cacel",
    preConfirm: () => {
      let displayNameFromInput = Swal.getPopup().querySelector(
        "#displayNameInput"
      ).value;
      // let groupFromInput = Swal.getPopup().querySelector("#groupSelect").value;
      // let aliasFromInput = Swal.getPopup().querySelector("#aliasInput").value;
      if (!displayNameFromInput) {
        Swal.showValidationMessage(`Display name must be provided.`);
      }
      if (
        displayNameSet.has(displayNameFromInput) &&
        displayNameFromInput !== oldDisplayName
      ) {
        Swal.showValidationMessage(
          `DisplayName already exists. please choose another`
        );
      }
    },
  });

  if (res && res.value) {
    const groupSelectElem = document.querySelector("#groupSelect");
    const newGroup =
      groupSelectElem.options[groupSelectElem.selectedIndex].value;
    const newDisplayName = document.querySelector("#displayNameInput").value;
    const newAlias = document.querySelector("#aliasInput").value;

    item.group = newGroup;
    item.displayName = newDisplayName;
    item.alias = newAlias;
    if (newDisplayName !== oldDisplayName) {
      displayNameSet.delete(oldDisplayName);
    }
    displayNameSet.add(newDisplayName);

    const DONT_DRAW_ITEM = false;
    await _removeItemAsync(oldDisplayName, oldGroup);
    await setAsync(
      item.alias,
      item.url,
      item.displayName,
      item.group,
      DONT_DRAW_ITEM
    );
    await _fetchGroupsMapAsync();
    await _forceSelectGroupByName(oldGroup);
  }
}

async function _fetchGroupsMapAsync(givenData) {
  try {
    let data;
    if (!givenData) {
      data = await _getStoredDataAsync();
      console.log("@init@fetchGroupsMapAsync Stored data is:");
      console.log(data);
    } else {
      data = givenData;
    }

    if (!data.items) {
      // first time ever
      // init data
      data.items = [
        {
          displayName: "_dummy_",
          alias: "_dummy_",
          url: "_dummy",
          group: "General",
        },
      ];

      chrome.storage.sync.set(data);
    }
    const items = data.items;

    items.forEach((item) => {
      const groupName = item.group || "General";
      if (!groupsMap.hasOwnProperty(groupName)) {
        groupsMap[groupName] = [];
      }

      if (!displayNameSet.has(item.displayName)) {
        groupsMap[groupName].push(item);
        displayNameSet.add(item.displayName);
      }
    });
  } catch (e) {
    console.error(`@fetchGroupsMapAsync - ${e.message}`);
  }
}

function _getStoredDataAsync() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (obj) => {
      if (chrome.runtime.lastError) {
        reject();
      } else {
        resolve(obj);
      }
    });
  });
}

function _removeStoredDataAsync(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

function _drawSingleItem(item) {
  if (item.displayName !== "_dummy_") {
    const divElemToAdd = document.createElement("div");
    divElemToAdd.classList.add("card");
    divElemToAdd.setAttribute("displayName", item.displayName);
    divElemToAdd.setAttribute("group", item.group);

    divElemToAdd.setAttribute("draggable", true);

    divElemToAdd.addEventListener(
      "contextmenu",
      (e) => _openContextMenu(e, itemContextMenu),
      false
    );
    divElemToAdd.innerHTML = `${item.displayName}---->${item.alias || ""}`;
    aliases.appendChild(divElemToAdd);
    divElemToAdd.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(item)); // add draggedItem to event
      event.target.style.opacity = 0.5;
    });

    divElemToAdd.addEventListener("dragend", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(item)); // add draggedItem to event
      event.target.style.opacity = 1;
    });
  }
}
// Store newly input keys
async function setAsync(
  alias,
  url,
  displayName,
  group = "General",
  isAlsoDraw = true
) {
  const item = {
    displayName: null,
    alias: null,
    url: null,
    group,
  };
  item.alias = alias;
  item.url = url;
  item.displayName = displayName;

  let obj = await _getStoredDataAsync();

  if (!Object.keys(obj).length) {
    obj = {items: [item]};
  }
  const newArr = [...obj.items, item];

  obj = {items: newArr};
  await _storeDataAsync(obj);

  // handle group
  const groupName = item.group;
  if (!groupsMap.hasOwnProperty(groupName)) {
    groupsMap[groupName] = [];
  }
  groupsMap[groupName].push(item);

  if (isAlsoDraw) {
    _drawSingleItem(item);
  }
}
function set(alias, url, displayName, group = "General") {
  const item = {
    displayName: null,
    alias: null,
    url: null,
    group,
  };
  item.alias = alias;
  item.url = url;
  item.displayName = displayName;

  chrome.storage.sync.get(null, function (obj) {
    if (!Object.keys(obj).length) {
      obj = {items: [item]};
    }
    const newArr = [...obj.items, item];

    obj = {items: newArr};

    chrome.storage.sync.set(obj);
  });
  // handle group
  const groupName = item.group;
  if (!groupsMap.hasOwnProperty(groupName)) {
    groupsMap[groupName] = [];
  }
  groupsMap[groupName].push(item);

  _drawSingleItem(item);
}
function _handleGroupSelected(e) {
  // meant to be invoked from a click event
  _selectGroup(e);
  _clearItems();
  _ShowItemsOfSelectedGroup();
}

function _forceSelectGroupByName(groupName) {
  _selectGroupByName(groupName);
  _clearItems();
  _ShowItemsOfSelectedGroup();
}

function _clearItems() {
  aliases.innerHTML = "";
}
function _addNewGroup() {
  Swal.fire({
    title: "<strong>ADD GROUP </strong>",
    icon: "info",
    html: `Group name: <input type="text" class="swal2-input" id="groupName">`,
    showCloseButton: true,
    showCancelButton: true,
    focusConfirm: false,
    confirmButtonText: "Add group",
    cancelButtonText: "Cacel",
    preConfirm: () => {
      let groupName = String(Swal.getPopup().querySelector("#groupName").value);
      if (!groupName) {
        Swal.showValidationMessage(`A group name must be provided.`);
      }
      if (groupsMap.hasOwnProperty(groupName.trim())) {
        Swal.showValidationMessage(
          `Group name already exists. please choose another`
        );
      }
    },
  }).then((res) => {
    if (res && res.value) {
      const groupName = String(
        document.querySelector("#groupName").value
      ).trim();
      if (!groupsMap.hasOwnProperty(groupName)) {
        groupsMap[groupName] = [];

        _drawSingleGroup(groupName);
        _storeGroup(groupName);
      } else {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Your group name is already taken. Please try another one",
        });
      }
    }
  });
}

function _storeGroup(groupName) {
  set("_dummy_", "_dummy_", "_dummy_", groupName);
}

function _selectGeneralGroup() {
  const e = {target: document.querySelector("#generalGroup")};
  _selectGroup(e);
}

async function _removeItemAsync(displayName, groupName) {
  const data = await _getStoredDataAsync();
  const items = data.items;
  const idxToRemove = items.findIndex(
    (item) => item.displayName === displayName
  );
  if (idxToRemove > -1) {
    items.splice(idxToRemove, 1);
  }
  await _storeDataAsync({items});
  //  chrome.storage.sync.set({items});
  displayNameSet.delete(displayName);
  groupMapIdx = groupsMap[groupName].findIndex(
    (i) => i.displayName === displayName
  );
  if (groupMapIdx > -1) {
    groupsMap[groupName].splice(groupMapIdx, 1);
  }
}
