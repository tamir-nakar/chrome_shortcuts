async function handleImportAsync() {
  try {
    const files = document.getElementById("selectFiles").files;
    if (files.length <= 0) {
      return false;
    }

    const fr = new FileReader();

    fr.onload = async function (e) {
      try {
        let newData = await _getStoredDataAsync();
        const importedData = JSON.parse(e.target.result);
        const importedItems = importedData.items;
        const newGroupNamesSet = new Set();
        const nameConversionMap = {};

        importedItems.forEach((item) => {
          if (item.displayName !== "_dummy_") {
            let groupName = String(item.group).trim();
            debugger;

            if (
              groupsMap.hasOwnProperty(groupName) &&
              !newGroupNamesSet.has(groupName)
            ) {
              groupName = _getNewGroupName(
                groupName,
                newGroupNamesSet,
                nameConversionMap
              );
              item.group = groupName;
            }
            // if (!groupsMap.hasOwnProperty(groupName)) {
            //   groupsMap[groupName] = [];
            // }

            if (!displayNameSet.has(item.displayName)) {
              //groupsMap[groupName].push(item);
              newData.items.push(item);
            }
          }
        });
        chrome.storage.sync.set(newData);

        await _fetchGroupsMapAsync(newData);
        _drawGroups();
        _forceSelectGroupByName("General");

        Swal.fire("Success!", "Improt process ended successfully", "success");
      } catch (e) {
        console.error(`@handleImportAsync: ${e.message}`);
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text:
            "Something went wrong! Please make sure to load an '.smd' file and try again",
        });
      }
    };

    fr.readAsText(files.item(0));
  } catch (e) {}
}

function handleExportAsync(groupsArr) {
  const d = new Date();
  chrome.storage.sync.get(null, function (obj) {
    const newObj = groupsArr
      ? obj.filter((item) => groupsArr.includes(item.group))
      : obj;
    downloadObjectAsJson(
      newObj,
      `Aliases Backup ${
        d.getUTCMonth() + 1
      }/${d.getUTCDate()}/${d.getUTCFullYear()}`
    );
  });
}

function downloadObjectAsJson(exportObj, exportName) {
  var dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(exportObj));
  var downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".smd");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function _getNewGroupName(originalGroupName, set, map) {
  let res = null;

  if (map[originalGroupName]) {
    res = map[originalGroupName];
  } else {
    let counter = 1;
    let temp = originalGroupName;
    while (groupsMap.hasOwnProperty(temp)) {
      temp = `${originalGroupName} (${counter++})`;
    }
    set.add(temp);
    map[originalGroupName] = temp;
    res = temp;
  }

  return res;
}
