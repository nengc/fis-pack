# fis-pack
yog2/fis plugin for pack page and compatible well

## Features
- Compatible with the yog2/fis
- Noninvasive pack the page js and css in one
- Can cross yog2 app

## Install

```
npm install fis-pack -g
```

## How to Use

### Import the module
```js
var fisPack = require('fis-pack');
```
### Set project name as a param
```js
fis.config.set('projectName','yog');
```
### Prepare the param
```js
var entry = {
    "pkg/pio_demo.css": [
        "**/demo.tpl:deps"
    ],
    "pkg/pio_demo.js": [
        "**/demo.tpl:deps"
    ],
    "pkg/pio_test.css": [
        "**/test.tpl:deps"
    ],
    "pkg/pio_test.js": [
        "**/test.tpl:deps"
    ]
}
```
### Use the plugin in the postpackager stage
```js
//clone the original ret
var retClone = JSON.parse(JSON.stringify(ret));

for (var i in etrys) {
    if (JSON.stringify(etrys[i]).indexOf('.css"') !== -1) {
        realRet = fisPack(retClone, settings, etrys[i], opt);
    } else {
        realRet = fisPack(retClone, settings, etrys[i], opt, false);
    }
}
//if use the other app component in yog2 project,need remove the map not in the current app
for (var key in realRet.map.res) {
    if (key.indexOf(fis.get('namespace') + ':') === -1) {
        delete realRet.map.res[key];
    }
}

//get app map info
function getMap() {
    var path = require('path');
    var root = fis.project.getProjectPath();
    var map = fis.file.wrap(path.join(root, fis.get('namespace') + '-map.json'));
    return map;
}

var map = getMap();
//save the app map to the release dir
fs.writeFileSync('../'+fis.get('projectName')+'/' + map.release, JSON.stringify(realRet.map));

```
### The result
```
![github](https://github.com/nengc/resources/blob/master/fis-pack-01.png "github") 

```
#### Pack before
![github](https://github.com/nengc/resources/blob/master/fis-pack-02.png "github") 

```
#### Pack after
![github](https://github.com/nengc/resources/blob/master/fis-pack-03.png "github") 

