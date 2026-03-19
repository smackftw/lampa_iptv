# Lampa Plugin API Notes

Verified API signatures from direct reading of Lampa source code (`yumata/lampa-source`) and a real plugin (`nb557/plugins/kp_source.js`).

---

## Plugin Initialization

Always guard with `window.appready` before registering anything:

```js
function addPlugin() {
  // register components, settings, etc.
}

if (window.appready) {
  addPlugin();
} else {
  Lampa.Listener.follow('app', function(e) {
    if (e.type === 'ready') addPlugin();
  });
}
```

App lifecycle events fired on `Lampa.Listener`:
- `{type: 'start'}` — before initialization begins
- `{type: 'ready'}` — fully initialized, safe to use all APIs

Source: `src/app.js`, `nb557/kp_source.js`

---

## Component Registration

Register a new screen component:

```js
Lampa.Component.add('my_component', MyComponentClass);
```

A component is an ES6 class. Lampa instantiates it with the activity object:

```js
class MyComponent {
  constructor(object) {
    // object = {component, url, title, page, ...}
    this.activity = object;
  }
  create() { /* called when screen is created; return DOM element */ }
  start()  { /* called when screen becomes active */ }
  pause()  { /* screen goes to background */ }
  stop()   { /* screen leaves foreground */ }
  destroy(){ /* screen is removed */ }
}
```

Source: `src/core/component.js`

---

## Screen Navigation (Activity)

Push a new screen onto the navigation stack:

```js
Lampa.Activity.push({
  component: 'my_component',   // registered name
  url: '',                     // arbitrary string (can be empty)
  title: 'Screen Title',
  page: 1,
  // ...any extra fields, available in component constructor
});
```

Replace current screen (no back entry):

```js
Lampa.Activity.replace(object, clear);
```

Get the currently active activity object:

```js
const active = Lampa.Activity.active();
// returns {component, activity, url, title, ...}
```

Go back:

```js
Lampa.Activity.back();
```

Global activity lifecycle events (on `Lampa.Listener`):

```js
Lampa.Listener.follow('activity', function(e) {
  // e.type: 'init' | 'create' | 'start' | 'destroy' | 'archive'
  // e.component: component name string
  // e.object: full activity object
});
```

Source: `src/interaction/activity/activity.js`

---

## Player

### Play a stream

```js
Lampa.Player.play({
  url: 'http://stream.m3u8',        // required
  title: 'Channel Name',            // display title
  quality: { '720p': 'url', ... },  // optional quality map
  subtitles: [{ url, label }],      // optional
  playlist: [{ title, url }],       // optional
  timeline: { percent, time },      // optional resume position
  iptv: true,                       // flag for IPTV mode
});
```

IPTV shorthand:

```js
Lampa.Player.iptv({ url, title, ... });
```

### Player control

```js
Lampa.Player.close();    // close player
Lampa.Player.opened();   // → boolean: is player open
```

### Player events (`Lampa.Player.listener`)

```js
Lampa.Player.listener.follow('create',   function(e) { /* e.data, e.abort */ });
Lampa.Player.listener.follow('start',    function(e) { /* e.data */ });
Lampa.Player.listener.follow('ready',    function(e) { /* e.data */ });
Lampa.Player.listener.follow('destroy',  function()  { });
Lampa.Player.listener.follow('external', function(e) { /* handed to external player */ });
```

### Video-level events (`Lampa.PlayerVideo.listener`)

```js
Lampa.PlayerVideo.listener.follow('play',        function() {});
Lampa.PlayerVideo.listener.follow('pause',       function() {});
Lampa.PlayerVideo.listener.follow('ended',       function() {});
Lampa.PlayerVideo.listener.follow('error',       function(e) { /* e.error, e.fatal */ });
Lampa.PlayerVideo.listener.follow('timeupdate',  function(e) { /* e.duration, e.current */ });
Lampa.PlayerVideo.listener.follow('canplay',     function() {});
Lampa.PlayerVideo.listener.follow('progress',    function(e) { /* e.down (percent) */ });
Lampa.PlayerVideo.listener.follow('tracks',      function(e) { /* e.tracks */ });
Lampa.PlayerVideo.listener.follow('subs',        function(e) { /* e.subs */ });
Lampa.PlayerVideo.listener.follow('levels',      function(e) { /* e.levels, e.current */ });
Lampa.PlayerVideo.listener.follow('loadeddata',  function() {});
Lampa.PlayerVideo.listener.follow('rewind',      function() {});
```

Source: `src/interaction/player.js`, `src/interaction/player/video.js`

---

## Settings

### Add a settings section

```js
Lampa.SettingsApi.addComponent({
  component: 'my_plugin',        // unique key
  icon: '<svg>...</svg>',        // SVG icon string
  name: 'My Plugin Settings'    // display name
});
```

### Add a parameter to a section

```js
Lampa.SettingsApi.addParam({
  component: 'my_plugin',
  param: {
    name: 'my_param',            // storage key (used with Lampa.Storage)
    type: 'select',              // 'select' | 'trigger' | 'input'
    values: { 'val1': 'Label 1', 'val2': 'Label 2' },  // for type:'select'
    default: 'val1'
  },
  field: {
    name: 'Display Name',
    description: 'Optional description shown under the field'
  },
  onChange: function(e) {},      // optional: called on value change
  onRender: function(item) {}    // optional: called when row is rendered
});
```

### Remove a section

```js
Lampa.SettingsApi.removeComponent('my_plugin');
```

### React to settings panel open

```js
Lampa.Settings.listener.follow('open', function(e) {
  // e.name: component name of the opened panel
  // e.body: jQuery DOM element of the panel
  const $panel = $('[data-name="my_param"]', e.body);
});
```

Source: `src/interaction/settings/settings.js`, `src/interaction/settings/api.js`

---

## Select / Modal Dialog

```js
Lampa.Select.show({
  title: 'Choose an option',
  items: [
    { title: 'Option 1', selected: true },
    { title: 'Option 2' },
    { separator: true, title: 'Group Label' },          // visual separator
    { title: 'Checkbox item', checkbox: true, checked: false }
  ],
  onSelect: function(item) { /* item is the chosen object */ },
  onBack:   function() { /* called on back/close */ },

  // optional:
  onFocus:  function(item, el) {},
  onCheck:  function(item, el) {},   // for checkbox items
  onDraw:   function(el, item) {},   // per-item render hook
  fullsize: false,                   // full screen mode
  nomark:   false,                   // don't highlight selected item
  nohide:   false                    // don't auto-close on select
});

Lampa.Select.hide();    // close without callback
Lampa.Select.close();   // close + call onBack
```

Source: `src/interaction/select.js`, `nb557/kp_source.js`

---

## Toast Notifications

```js
Lampa.Noty.show('Message text');

Lampa.Noty.show('Error message', {
  style: 'error',    // 'error' | 'success' (adds CSS class noty--style--{style})
  time: 5000         // display duration in ms, default: 3000
});
```

Source: `src/interaction/noty.js`

---

## TV Remote Navigation (Controller)

Interactive elements must have the `.selector` CSS class. The controller fires DOM events on them:
- `hover:focus` — element focused
- `hover:enter` — OK/Enter pressed
- `hover:long` — long press
- `hover:hover` — hover (non-TV contexts)

Register a controller for a screen:

```js
Lampa.Controller.add('my_controller', {
  toggle: function() {
    Lampa.Controller.collectionSet(html);           // set focusable elements
    Lampa.Controller.collectionFocus(false, html);  // focus first element
  },
  up:    function() { Navigator.move('up'); },
  down:  function() { Navigator.move('down'); },
  left:  function() { Navigator.move('left'); },
  right: function() { Navigator.move('right'); },
  enter: function() { /* OK pressed */ },
  back:  function() { Lampa.Activity.back(); }
});

Lampa.Controller.toggle('my_controller');   // activate this controller
```

Source: `src/core/controller.js`

---

## Global Event Bus

```js
// Subscribe
Lampa.Listener.follow('event_name', function(e) { /* e is event data */ });

// Publish
Lampa.Listener.send('event_name', { type: 'something', ... });
```

Known event channels: `'app'`, `'activity'`, `'player'`, `'settings'`

---

## DOM / jQuery

jQuery `$()` is globally available throughout Lampa and in plugins:

```js
$('body').append(myElement);
$.ajax({ url, success, error });
$('[data-name="foo"]', container);
```

No import needed — `window.$` is set by Lampa.

---

## Storage

```js
Lampa.Storage.set('key', value);
Lampa.Storage.get('key');
Lampa.Storage.get('key', defaultValue);
```

Parameter names defined in `SettingsApi.addParam` are stored/retrieved by the same key.

---

## Full `window.Lampa` Object (available APIs)

`Listener, Lang, Storage, Activity, Component, Player, PlayerVideo, Select, Noty, Controller, Settings, SettingsApi, Params, Scroll, Empty, Arrays, Utils, Reguest, Filter, Modal, Card, Keypad, Template, Background, Menu, Head, Notice, Favorite`

Note: `Reguest` is the correct spelling in Lampa source (not `Request`).
