let aliasesMap = {};

function _updateAliasesMap() {
  aliasesMap = {};
  chrome.storage.sync.get(null, function (data) {
    if (data.items) {
      data.items.forEach((item) => {
        // handle alias
        const itemAlias = item.alias;
        if (itemAlias && itemAlias !== "_dummy_") {
          aliasesMap[itemAlias] = item.url;
        }
      });
    }
  });
}

chrome.storage.onChanged.addListener(() => _updateAliasesMap());

const re = /[\d\s\+\-=\(\)\*]+/g;
const link = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/;

// On input changed, call this
chrome.omnibox.onInputChanged.addListener(function (text, suggest) {
  const suggestions = [];
  for (key in aliasesMap) {
    if (key.startsWith(text) || text == "") {
      var desc = `<match>${text}: </match><dim>${key} → </dim><url>${aliasesMap[key]}</url>`;
      suggestions.push({content: aliasesMap[key], description: desc});
    }
  }
  if (text.match(re)) {
    var result = eval(text).toString();
    // alert(result);
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>= </match><url>${result}</url>`,
    });
  } else if (suggestions.length > 0) {
    var first = suggestions.splice(0, 1)[0];
    chrome.omnibox.setDefaultSuggestion({description: first["description"]});
  } else {
    chrome.omnibox.setDefaultSuggestion({
      description: `<match>${text}: </match><dim> - Google Search</dim>`,
    });
  }
  suggest(suggestions);
});

// User has accepted what is typed into the omnibox. (by pressing enter)
chrome.omnibox.onInputEntered.addListener(function (text) {
  if (text in aliasesMap) {
    chrome.tabs.update({url: aliasesMap[text]});
  } else if (text.match(link)) {
    chrome.tabs.update({url: text});
  } else if (text.match(re)) {
    var result = eval(text).toString();
    chrome.tabs.update({url: `https://google.com/search?q=${result}`});
  } else {
    chrome.tabs.update({url: `https://google.com/search?q=${text}`});
  }
});

// Starting input
chrome.omnibox.onInputStarted.addListener(function () {
  chrome.storage.sync.get(null, function (obj) {
    for (o in obj) {
      aliasesMap[o] = obj[o];
    }
  });
});
