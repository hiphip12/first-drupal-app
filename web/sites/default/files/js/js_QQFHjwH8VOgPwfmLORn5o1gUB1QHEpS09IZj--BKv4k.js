/**
 * @file
 * Drupal Bootstrap object.
 */

/**
 * All Drupal Bootstrap JavaScript APIs are contained in this namespace.
 *
 * @param {underscore} _
 * @param {jQuery} $
 * @param {Drupal} Drupal
 * @param {drupalSettings} drupalSettings
 */
(function (_, $, Drupal, drupalSettings) {
  'use strict';

  /**
   * @typedef Drupal.bootstrap
   */
  var Bootstrap = {
    processedOnce: {},
    settings: drupalSettings.bootstrap || {}
  };

  /**
   * Wraps Drupal.checkPlain() to ensure value passed isn't empty.
   *
   * Encodes special characters in a plain-text string for display as HTML.
   *
   * @param {string} str
   *   The string to be encoded.
   *
   * @return {string}
   *   The encoded string.
   *
   * @ingroup sanitization
   */
  Bootstrap.checkPlain = function (str) {
    return str && Drupal.checkPlain(str) || '';
  };

  /**
   * Creates a jQuery plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.createPlugin = function (id, plugin, noConflict) {
    // Immediately return if plugin doesn't exist.
    if ($.fn[id] !== void 0) {
      return this.fatal('Specified jQuery plugin identifier already exists: @id. Use Drupal.bootstrap.replacePlugin() instead.', {'@id': id});
    }

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('You must provide a constructor function to create a jQuery plugin "@id": @plugin', {'@id': id, '@plugin':  plugin});
    }

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Diff object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of the first passed object that are not present
   *   in all other passed objects.
   */
  Bootstrap.diffObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.difference.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Map of supported events by regular expression.
   *
   * @type {Object<Event|MouseEvent|KeyboardEvent|TouchEvent,RegExp>}
   */
  Bootstrap.eventMap = {
    Event: /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    MouseEvent: /^(?:click|dblclick|mouse(?:down|enter|leave|up|over|move|out))$/,
    KeyboardEvent: /^(?:key(?:down|press|up))$/,
    TouchEvent: /^(?:touch(?:start|end|move|cancel))$/
  };

  /**
   * Extends a jQuery Plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A constructor function used to initialize the for the jQuery plugin.
   *
   * @return {Function|Boolean}
   *   The jQuery plugin constructor or FALSE if the plugin does not exist.
   */
  Bootstrap.extendPlugin = function (id, callback) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a callback function to extend the jQuery plugin "@id": @callback', {'@id': id, '@callback':  callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);
    if (!$.isPlainObject(plugin)) {
      return this.fatal('Returned value from callback is not a plain object that can be used to extend the jQuery plugin "@id": @obj', {'@obj':  plugin});
    }

    this.wrapPluginConstructor(constructor, plugin, true);

    return $.fn[id];
  };

  Bootstrap.superWrapper = function (parent, fn) {
    return function () {
      var previousSuper = this.super;
      this.super = parent;
      var ret = fn.apply(this, arguments);
      if (previousSuper) {
        this.super = previousSuper;
      }
      else {
        delete this.super;
      }
      return ret;
    };
  };

  /**
   * Provide a helper method for displaying when something is went wrong.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   An arguments to use in message.
   *
   * @return {Boolean}
   *   Always returns FALSE.
   */
  Bootstrap.fatal = function (message, args) {
    if (this.settings.dev && console.warn) {
      for (var name in args) {
        if (args.hasOwnProperty(name) && typeof args[name] === 'object') {
          args[name] = JSON.stringify(args[name]);
        }
      }
      Drupal.throwError(new Error(Drupal.formatString(message, args)));
    }
    return false;
  };

  /**
   * Intersects object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of first passed object that intersects with all
   *   other passed objects.
   */
  Bootstrap.intersectObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.intersection.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Normalizes an object's values.
   *
   * @param {Object} obj
   *   The object to normalize.
   *
   * @return {Object}
   *   The normalized object.
   */
  Bootstrap.normalizeObject = function (obj) {
    if (!$.isPlainObject(obj)) {
      return obj;
    }

    for (var k in obj) {
      if (typeof obj[k] === 'string') {
        if (obj[k] === 'true') {
          obj[k] = true;
        }
        else if (obj[k] === 'false') {
          obj[k] = false;
        }
        else if (obj[k].match(/^[\d-.]$/)) {
          obj[k] = parseFloat(obj[k]);
        }
      }
      else if ($.isPlainObject(obj[k])) {
        obj[k] = Bootstrap.normalizeObject(obj[k]);
      }
    }

    return obj;
  };

  /**
   * An object based once plugin (similar to jquery.once, but without the DOM).
   *
   * @param {String} id
   *   A unique identifier.
   * @param {Function} callback
   *   The callback to invoke if the identifier has not yet been seen.
   *
   * @return {Bootstrap}
   */
  Bootstrap.once = function (id, callback) {
    // Immediately return if identifier has already been processed.
    if (this.processedOnce[id]) {
      return this;
    }
    callback.call(this, this.settings);
    this.processedOnce[id] = true;
    return this;
  };

  /**
   * Provide jQuery UI like ability to get/set options for Bootstrap plugins.
   *
   * @param {string|object} key
   *   A string value of the option to set, can be dot like to a nested key.
   *   An object of key/value pairs.
   * @param {*} [value]
   *   (optional) A value to set for key.
   *
   * @returns {*}
   *   - Returns nothing if key is an object or both key and value parameters
   *   were provided to set an option.
   *   - Returns the a value for a specific setting if key was provided.
   *   - Returns an object of key/value pairs of all the options if no key or
   *   value parameter was provided.
   *
   * @see https://github.com/jquery/jquery-ui/blob/master/ui/widget.js
   */
  Bootstrap.option = function (key, value) {
    var options = $.isPlainObject(key) ? $.extend({}, key) : {};

    // Get all options (clone so it doesn't reference the internal object).
    if (arguments.length === 0) {
      return $.extend({}, this.options);
    }

    // Get/set single option.
    if (typeof key === "string") {
      // Handle nested keys in dot notation.
      // e.g., "foo.bar" => { foo: { bar: true } }
      var parts = key.split('.');
      key = parts.shift();
      var obj = options;
      if (parts.length) {
        for (var i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = obj[parts[i]] || {};
          obj = obj[parts[i]];
        }
        key = parts.pop();
      }

      // Get.
      if (arguments.length === 1) {
        return obj[key] === void 0 ? null : obj[key];
      }

      // Set.
      obj[key] = value;
    }

    // Set multiple options.
    $.extend(true, this.options, options);
  };

  /**
   * Adds a ".noConflict()" helper method if needed.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.pluginNoConflict = function (id, plugin, noConflict) {
    if (plugin.noConflict === void 0 && (noConflict === void 0 || noConflict)) {
      var old = $.fn[id];
      plugin.noConflict = function () {
        $.fn[id] = old;
        return this;
      };
    }
  };

  /**
   * Creates a handler that relays to another event name.
   *
   * @param {HTMLElement|jQuery} target
   *   A target element.
   * @param {String} name
   *   The name of the event to trigger.
   * @param {Boolean} [stopPropagation=true]
   *   Flag indicating whether to stop the propagation of the event, defaults
   *   to true.
   *
   * @return {Function}
   *   An even handler callback function.
   */
  Bootstrap.relayEvent = function (target, name, stopPropagation) {
    return function (e) {
      if (stopPropagation === void 0 || stopPropagation) {
        e.stopPropagation();
      }
      var $target = $(target);
      var parts = name.split('.').filter(Boolean);
      var type = parts.shift();
      e.target = $target[0];
      e.currentTarget = $target[0];
      e.namespace = parts.join('.');
      e.type = type;
      $target.trigger(e);
    };
  };

  /**
   * Replaces a Bootstrap jQuery plugin definition.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A callback function that is immediately invoked and must return a
   *   function that will be used as the plugin constructor.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.replacePlugin = function (id, callback, noConflict) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a valid callback function to replace a jQuery plugin: @callback', {'@callback': callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('Returned value from callback is not a usable function to replace a jQuery plugin "@id": @plugin', {'@id': id, '@plugin': plugin});
    }

    this.wrapPluginConstructor(constructor, plugin);

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Simulates a native event on an element in the browser.
   *
   * Note: This is a fairly complete modern implementation. If things aren't
   * working quite the way you intend (in older browsers), you may wish to use
   * the jQuery.simulate plugin. If it's available, this method will defer to
   * that plugin.
   *
   * @see https://github.com/jquery/jquery-simulate
   *
   * @param {HTMLElement|jQuery} element
   *   A DOM element to dispatch event on. Note: this may be a jQuery object,
   *   however be aware that this will trigger the same event for each element
   *   inside the jQuery collection; use with caution.
   * @param {String|String[]} type
   *   The type(s) of event to simulate.
   * @param {Object} [options]
   *   An object of options to pass to the event constructor. Typically, if
   *   an event is being proxied, you should just pass the original event
   *   object here. This allows, if the browser supports it, to be a truly
   *   simulated event.
   *
   * @return {Boolean}
   *   The return value is false if event is cancelable and at least one of the
   *   event handlers which handled this event called Event.preventDefault().
   *   Otherwise it returns true.
   */
  Bootstrap.simulate = function (element, type, options) {
    // Handle jQuery object wrappers so it triggers on each element.
    var ret = true;
    if (element instanceof $) {
      element.each(function () {
        if (!Bootstrap.simulate(this, type, options)) {
          ret = false;
        }
      });
      return ret;
    }

    if (!(element instanceof HTMLElement)) {
      this.fatal('Passed element must be an instance of HTMLElement, got "@type" instead.', {
        '@type': typeof element,
      });
    }

    // Defer to the jQuery.simulate plugin, if it's available.
    if (typeof $.simulate === 'function') {
      new $.simulate(element, type, options);
      return true;
    }

    var event;
    var ctor;
    var types = [].concat(type);
    for (var i = 0, l = types.length; i < l; i++) {
      type = types[i];
      for (var name in this.eventMap) {
        if (this.eventMap[name].test(type)) {
          ctor = name;
          break;
        }
      }
      if (!ctor) {
        throw new SyntaxError('Only rudimentary HTMLEvents, KeyboardEvents and MouseEvents are supported: ' + type);
      }
      var opts = {bubbles: true, cancelable: true};
      if (ctor === 'KeyboardEvent' || ctor === 'MouseEvent') {
        $.extend(opts, {ctrlKey: !1, altKey: !1, shiftKey: !1, metaKey: !1});
      }
      if (ctor === 'MouseEvent') {
        $.extend(opts, {button: 0, pointerX: 0, pointerY: 0, view: window});
      }
      if (options) {
        $.extend(opts, options);
      }
      if (typeof window[ctor] === 'function') {
        event = new window[ctor](type, opts);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (document.createEvent) {
        event = document.createEvent(ctor);
        event.initEvent(type, opts.bubbles, opts.cancelable);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (typeof element.fireEvent === 'function') {
        event = $.extend(document.createEventObject(), opts);
        if (!element.fireEvent('on' + type, event)) {
          ret = false;
        }
      }
      else if (typeof element[type]) {
        element[type]();
      }
    }
    return ret;
  };

  /**
   * Strips HTML and returns just text.
   *
   * @param {String|Element|jQuery} html
   *   A string of HTML content, an Element DOM object or a jQuery object.
   *
   * @return {String}
   *   The text without HTML tags.
   *
   * @todo Replace with http://locutus.io/php/strings/strip_tags/
   */
  Bootstrap.stripHtml = function (html) {
    if (html instanceof $) {
      html = html.html();
    }
    else if (html instanceof Element) {
      html = html.innerHTML;
    }
    var tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/^[\s\n\t]*|[\s\n\t]*$/, '');
  };

  /**
   * Provide a helper method for displaying when something is unsupported.
   *
   * @param {String} type
   *   The type of unsupported object, e.g. method or option.
   * @param {String} name
   *   The name of the unsupported object.
   * @param {*} [value]
   *   The value of the unsupported object.
   */
  Bootstrap.unsupported = function (type, name, value) {
    Bootstrap.warn('Unsupported by Drupal Bootstrap: (@type) @name -> @value', {
      '@type': type,
      '@name': name,
      '@value': typeof value === 'object' ? JSON.stringify(value) : value
    });
  };

  /**
   * Provide a helper method to display a warning.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   Arguments to use as replacements in Drupal.formatString.
   */
  Bootstrap.warn = function (message, args) {
    if (this.settings.dev && console.warn) {
      console.warn(Drupal.formatString(message, args));
    }
  };

  /**
   * Wraps a plugin with common functionality.
   *
   * @param {Function} constructor
   *   A plugin constructor being wrapped.
   * @param {Object|Function} plugin
   *   The plugin being wrapped.
   * @param {Boolean} [extend = false]
   *   Whether to add super extensibility.
   */
  Bootstrap.wrapPluginConstructor = function (constructor, plugin, extend) {
    var proto = constructor.prototype;

    // Add a jQuery UI like option getter/setter method.
    var option = this.option;
    if (proto.option === void(0)) {
      proto.option = function () {
        return option.apply(this, arguments);
      };
    }

    if (extend) {
      // Handle prototype properties separately.
      if (plugin.prototype !== void 0) {
        for (var key in plugin.prototype) {
          if (!plugin.prototype.hasOwnProperty(key)) continue;
          var value = plugin.prototype[key];
          if (typeof value === 'function') {
            proto[key] = this.superWrapper(proto[key] || function () {}, value);
          }
          else {
            proto[key] = $.isPlainObject(value) ? $.extend(true, {}, proto[key], value) : value;
          }
        }
      }
      delete plugin.prototype;

      // Handle static properties.
      for (key in plugin) {
        if (!plugin.hasOwnProperty(key)) continue;
        value = plugin[key];
        if (typeof value === 'function') {
          constructor[key] = this.superWrapper(constructor[key] || function () {}, value);
        }
        else {
          constructor[key] = $.isPlainObject(value) ? $.extend(true, {}, constructor[key], value) : value;
        }
      }
    }
  };

  // Add Bootstrap to the global Drupal object.
  Drupal.bootstrap = Drupal.bootstrap || Bootstrap;

})(window._, window.jQuery, window.Drupal, window.drupalSettings);
;
(function ($, _) {

  /**
   * @class Attributes
   *
   * Modifies attributes.
   *
   * @param {Object|Attributes} attributes
   *   An object to initialize attributes with.
   */
  var Attributes = function (attributes) {
    this.data = {};
    this.data['class'] = [];
    this.merge(attributes);
  };

  /**
   * Renders the attributes object as a string to inject into an HTML element.
   *
   * @return {String}
   *   A rendered string suitable for inclusion in HTML markup.
   */
  Attributes.prototype.toString = function () {
    var output = '';
    var name, value;
    var checkPlain = function (str) {
      return str && str.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '';
    };
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      output += ' ' + checkPlain(name) + '="' + checkPlain(value) + '"';
    }
    return output;
  };

  /**
   * Renders the Attributes object as a plain object.
   *
   * @return {Object}
   *   A plain object suitable for inclusion in DOM elements.
   */
  Attributes.prototype.toPlainObject = function () {
    var object = {};
    var name, value;
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      object[name] = value;
    }
    return object;
  };

  /**
   * Add class(es) to the array.
   *
   * @param {string|Array} value
   *   An individual class or an array of classes to add.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.addClass = function (value) {
    var args = Array.prototype.slice.call(arguments);
    this.data['class'] = this.sanitizeClasses(this.data['class'].concat(args));
    return this;
  };

  /**
   * Returns whether the requested attribute exists.
   *
   * @param {string} name
   *   An attribute name to check.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.exists = function (name) {
    return this.data[name] !== void(0) && this.data[name] !== null;
  };

  /**
   * Retrieve a specific attribute from the array.
   *
   * @param {string} name
   *   The specific attribute to retrieve.
   * @param {*} defaultValue
   *   (optional) The default value to set if the attribute does not exist.
   *
   * @return {*}
   *   A specific attribute value, passed by reference.
   */
  Attributes.prototype.get = function (name, defaultValue) {
    if (!this.exists(name)) this.data[name] = defaultValue;
    return this.data[name];
  };

  /**
   * Retrieves a cloned copy of the internal attributes data object.
   *
   * @return {Object}
   */
  Attributes.prototype.getData = function () {
    return _.extend({}, this.data);
  };

  /**
   * Retrieves classes from the array.
   *
   * @return {Array}
   *   The classes array.
   */
  Attributes.prototype.getClasses = function () {
    return this.get('class', []);
  };

  /**
   * Indicates whether a class is present in the array.
   *
   * @param {string|Array} className
   *   The class(es) to search for.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.hasClass = function (className) {
    className = this.sanitizeClasses(Array.prototype.slice.call(arguments));
    var classes = this.getClasses();
    for (var i = 0, l = className.length; i < l; i++) {
      // If one of the classes fails, immediately return false.
      if (_.indexOf(classes, className[i]) === -1) {
        return false;
      }
    }
    return true;
  };

  /**
   * Merges multiple values into the array.
   *
   * @param {Attributes|Node|jQuery|Object} object
   *   An Attributes object with existing data, a Node DOM element, a jQuery
   *   instance or a plain object where the key is the attribute name and the
   *   value is the attribute value.
   * @param {boolean} [recursive]
   *   Flag determining whether or not to recursively merge key/value pairs.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.merge = function (object, recursive) {
    // Immediately return if there is nothing to merge.
    if (!object) {
      return this;
    }

    // Get attributes from a jQuery element.
    if (object instanceof $) {
      object = object[0];
    }

    // Get attributes from a DOM element.
    if (object instanceof Node) {
      object = Array.prototype.slice.call(object.attributes).reduce(function (attributes, attribute) {
        attributes[attribute.name] = attribute.value;
        return attributes;
      }, {});
    }
    // Get attributes from an Attributes instance.
    else if (object instanceof Attributes) {
      object = object.getData();
    }
    // Otherwise, clone the object.
    else {
      object = _.extend({}, object);
    }

    // By this point, there should be a valid plain object.
    if (!$.isPlainObject(object)) {
      setTimeout(function () {
        throw new Error('Passed object is not supported: ' + object);
      });
      return this;
    }

    // Handle classes separately.
    if (object && object['class'] !== void 0) {
      this.addClass(object['class']);
      delete object['class'];
    }

    if (recursive === void 0 || recursive) {
      this.data = $.extend(true, {}, this.data, object);
    }
    else {
      this.data = $.extend({}, this.data, object);
    }

    return this;
  };

  /**
   * Removes an attribute from the array.
   *
   * @param {string} name
   *   The name of the attribute to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.remove = function (name) {
    if (this.exists(name)) delete this.data[name];
    return this;
  };

  /**
   * Removes a class from the attributes array.
   *
   * @param {...string|Array} className
   *   An individual class or an array of classes to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.removeClass = function (className) {
    var remove = this.sanitizeClasses(Array.prototype.slice.apply(arguments));
    this.data['class'] = _.without(this.getClasses(), remove);
    return this;
  };

  /**
   * Replaces a class in the attributes array.
   *
   * @param {string} oldValue
   *   The old class to remove.
   * @param {string} newValue
   *   The new class. It will not be added if the old class does not exist.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.replaceClass = function (oldValue, newValue) {
    var classes = this.getClasses();
    var i = _.indexOf(this.sanitizeClasses(oldValue), classes);
    if (i >= 0) {
      classes[i] = newValue;
      this.set('class', classes);
    }
    return this;
  };

  /**
   * Ensures classes are flattened into a single is an array and sanitized.
   *
   * @param {...String|Array} classes
   *   The class or classes to sanitize.
   *
   * @return {Array}
   *   A sanitized array of classes.
   */
  Attributes.prototype.sanitizeClasses = function (classes) {
    return _.chain(Array.prototype.slice.call(arguments))
      // Flatten in case there's a mix of strings and arrays.
      .flatten()

      // Split classes that may have been added with a space as a separator.
      .map(function (string) {
        return string.split(' ');
      })

      // Flatten again since it was just split into arrays.
      .flatten()

      // Filter out empty items.
      .filter()

      // Clean the class to ensure it's a valid class name.
      .map(function (value) {
        return Attributes.cleanClass(value);
      })

      // Ensure classes are unique.
      .uniq()

      // Retrieve the final value.
      .value();
  };

  /**
   * Sets an attribute on the array.
   *
   * @param {string} name
   *   The name of the attribute to set.
   * @param {*} value
   *   The value of the attribute to set.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.set = function (name, value) {
    var obj = $.isPlainObject(name) ? name : {};
    if (typeof name === 'string') {
      obj[name] = value;
    }
    return this.merge(obj);
  };

  /**
   * Prepares a string for use as a CSS identifier (element, class, or ID name).
   *
   * Note: this is essentially a direct copy from
   * \Drupal\Component\Utility\Html::cleanCssIdentifier
   *
   * @param {string} identifier
   *   The identifier to clean.
   * @param {Object} [filter]
   *   An object of string replacements to use on the identifier.
   *
   * @return {string}
   *   The cleaned identifier.
   */
  Attributes.cleanClass = function (identifier, filter) {
    filter = filter || {
      ' ': '-',
      '_': '-',
      '/': '-',
      '[': '-',
      ']': ''
    };

    identifier = identifier.toLowerCase();

    if (filter['__'] === void 0) {
      identifier = identifier.replace('__', '#DOUBLE_UNDERSCORE#');
    }

    identifier = identifier.replace(Object.keys(filter), Object.keys(filter).map(function(key) { return filter[key]; }));

    if (filter['__'] === void 0) {
      identifier = identifier.replace('#DOUBLE_UNDERSCORE#', '__');
    }

    identifier = identifier.replace(/[^\u002D\u0030-\u0039\u0041-\u005A\u005F\u0061-\u007A\u00A1-\uFFFF]/g, '');
    identifier = identifier.replace(['/^[0-9]/', '/^(-[0-9])|^(--)/'], ['_', '__']);

    return identifier;
  };

  /**
   * Creates an Attributes instance.
   *
   * @param {object|Attributes} [attributes]
   *   An object to initialize attributes with.
   *
   * @return {Attributes}
   *   An Attributes instance.
   *
   * @constructor
   */
  Attributes.create = function (attributes) {
    return new Attributes(attributes);
  };

  window.Attributes = Attributes;

})(window.jQuery, window._);
;
/**
 * @file
 * Theme hooks for the Drupal Bootstrap base theme.
 */
(function ($, Drupal, Bootstrap, Attributes) {

  /**
   * Fallback for theming an icon if the Icon API module is not installed.
   */
  if (!Drupal.icon) Drupal.icon = { bundles: {} };
  if (!Drupal.theme.icon || Drupal.theme.prototype.icon) {
    $.extend(Drupal.theme, /** @lends Drupal.theme */ {
      /**
       * Renders an icon.
       *
       * @param {string} bundle
       *   The bundle which the icon belongs to.
       * @param {string} icon
       *   The name of the icon to render.
       * @param {object|Attributes} [attributes]
       *   An object of attributes to also apply to the icon.
       *
       * @returns {string}
       */
      icon: function (bundle, icon, attributes) {
        if (!Drupal.icon.bundles[bundle]) return '';
        attributes = Attributes.create(attributes).addClass('icon').set('aria-hidden', 'true');
        icon = Drupal.icon.bundles[bundle](icon, attributes);
        return '<span' + attributes + '></span>';
      }
    });
  }

  /**
   * Callback for modifying an icon in the "bootstrap" icon bundle.
   *
   * @param {string} icon
   *   The icon being rendered.
   * @param {Attributes} attributes
   *   Attributes object for the icon.
   */
  Drupal.icon.bundles.bootstrap = function (icon, attributes) {
    attributes.addClass(['glyphicon', 'glyphicon-' + icon]);
  };

  /**
   * Add necessary theming hooks.
   */
  $.extend(Drupal.theme, /** @lends Drupal.theme */ {

    /**
     * Renders a Bootstrap AJAX glyphicon throbber.
     *
     * @returns {string}
     */
    ajaxThrobber: function () {
      return Drupal.theme('bootstrapIcon', 'refresh', {'class': ['ajax-throbber', 'glyphicon-spin'] });
    },

    /**
     * Renders a button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button. If it contains one of:
     *   - value: The label of the button.
     *   - context: The context type of Bootstrap button, can be one of:
     *     - default
     *     - primary
     *     - success
     *     - info
     *     - warning
     *     - danger
     *     - link
     *
     * @returns {string}
     */
    button: function (attributes) {
      attributes = Attributes.create(attributes).addClass('btn');
      var context = attributes.get('context', 'default');
      var label = attributes.get('value', '');
      attributes.remove('context').remove('value');
      if (!attributes.hasClass(['btn-default', 'btn-primary', 'btn-success', 'btn-info', 'btn-warning', 'btn-danger', 'btn-link'])) {
        attributes.addClass('btn-' + Bootstrap.checkPlain(context));
      }

      // Attempt to, intelligently, provide a default button "type".
      if (!attributes.exists('type')) {
        attributes.set('type', attributes.hasClass('form-submit') ? 'submit' : 'button');
      }

      return '<button' + attributes + '>' + label + '</button>';
    },

    /**
     * Alias for "button" theme hook.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    btn: function (attributes) {
      return Drupal.theme('button', attributes);
    },

    /**
     * Renders a button block element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-block': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-block'));
    },

    /**
     * Renders a large button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-lg': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-lg'));
    },

    /**
     * Renders a small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-sm': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-sm'));
    },

    /**
     * Renders an extra small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-xs': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-xs'));
    },

    /**
     * Renders a glyphicon.
     *
     * @param {string} name
     *   The name of the glyphicon.
     * @param {object|Attributes} [attributes]
     *   An object of attributes to apply to the icon.
     *
     * @returns {string}
     */
    bootstrapIcon: function (name, attributes) {
      return Drupal.theme('icon', 'bootstrap', name, attributes);
    }

  });

})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes);
;
/*! For license information please see main.min.js.LICENSE.txt */
(()=>{"use strict";var e,n={448:(e,n,t)=>{var r=t(294),l=t(840);function a(e){for(var n="https://reactjs.org/docs/error-decoder.html?invariant="+e,t=1;t<arguments.length;t++)n+="&args[]="+encodeURIComponent(arguments[t]);return"Minified React error #"+e+"; visit "+n+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var u=new Set,o={};function i(e,n){s(e,n),s(e+"Capture",n)}function s(e,n){for(o[e]=n,e=0;e<n.length;e++)u.add(n[e])}var c=!("undefined"==typeof window||void 0===window.document||void 0===window.document.createElement),f=Object.prototype.hasOwnProperty,d=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,p={},m={};function h(e,n,t,r,l,a,u){this.acceptsBooleans=2===n||3===n||4===n,this.attributeName=r,this.attributeNamespace=l,this.mustUseProperty=t,this.propertyName=e,this.type=n,this.sanitizeURL=a,this.removeEmptyString=u}var g={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach((function(e){g[e]=new h(e,0,!1,e,null,!1,!1)})),[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach((function(e){var n=e[0];g[n]=new h(n,1,!1,e[1],null,!1,!1)})),["contentEditable","draggable","spellCheck","value"].forEach((function(e){g[e]=new h(e,2,!1,e.toLowerCase(),null,!1,!1)})),["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach((function(e){g[e]=new h(e,2,!1,e,null,!1,!1)})),"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach((function(e){g[e]=new h(e,3,!1,e.toLowerCase(),null,!1,!1)})),["checked","multiple","muted","selected"].forEach((function(e){g[e]=new h(e,3,!0,e,null,!1,!1)})),["capture","download"].forEach((function(e){g[e]=new h(e,4,!1,e,null,!1,!1)})),["cols","rows","size","span"].forEach((function(e){g[e]=new h(e,6,!1,e,null,!1,!1)})),["rowSpan","start"].forEach((function(e){g[e]=new h(e,5,!1,e.toLowerCase(),null,!1,!1)}));var v=/[\-:]([a-z])/g;function y(e){return e[1].toUpperCase()}function b(e,n,t,r){var l=g.hasOwnProperty(n)?g[n]:null;(null!==l?0!==l.type:r||!(2<n.length)||"o"!==n[0]&&"O"!==n[0]||"n"!==n[1]&&"N"!==n[1])&&(function(e,n,t,r){if(null==n||function(e,n,t,r){if(null!==t&&0===t.type)return!1;switch(typeof n){case"function":case"symbol":return!0;case"boolean":return!r&&(null!==t?!t.acceptsBooleans:"data-"!==(e=e.toLowerCase().slice(0,5))&&"aria-"!==e);default:return!1}}(e,n,t,r))return!0;if(r)return!1;if(null!==t)switch(t.type){case 3:return!n;case 4:return!1===n;case 5:return isNaN(n);case 6:return isNaN(n)||1>n}return!1}(n,t,l,r)&&(t=null),r||null===l?function(e){return!!f.call(m,e)||!f.call(p,e)&&(d.test(e)?m[e]=!0:(p[e]=!0,!1))}(n)&&(null===t?e.removeAttribute(n):e.setAttribute(n,""+t)):l.mustUseProperty?e[l.propertyName]=null===t?3!==l.type&&"":t:(n=l.attributeName,r=l.attributeNamespace,null===t?e.removeAttribute(n):(t=3===(l=l.type)||4===l&&!0===t?"":""+t,r?e.setAttributeNS(r,n,t):e.setAttribute(n,t))))}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach((function(e){var n=e.replace(v,y);g[n]=new h(n,1,!1,e,null,!1,!1)})),"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach((function(e){var n=e.replace(v,y);g[n]=new h(n,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)})),["xml:base","xml:lang","xml:space"].forEach((function(e){var n=e.replace(v,y);g[n]=new h(n,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)})),["tabIndex","crossOrigin"].forEach((function(e){g[e]=new h(e,1,!1,e.toLowerCase(),null,!1,!1)})),g.xlinkHref=new h("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1),["src","href","action","formAction"].forEach((function(e){g[e]=new h(e,1,!1,e.toLowerCase(),null,!0,!0)}));var k=r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,w=Symbol.for("react.element"),S=Symbol.for("react.portal"),x=Symbol.for("react.fragment"),E=Symbol.for("react.strict_mode"),C=Symbol.for("react.profiler"),_=Symbol.for("react.provider"),P=Symbol.for("react.context"),N=Symbol.for("react.forward_ref"),z=Symbol.for("react.suspense"),T=Symbol.for("react.suspense_list"),L=Symbol.for("react.memo"),R=Symbol.for("react.lazy");Symbol.for("react.scope"),Symbol.for("react.debug_trace_mode");var M=Symbol.for("react.offscreen");Symbol.for("react.legacy_hidden"),Symbol.for("react.cache"),Symbol.for("react.tracing_marker");var F=Symbol.iterator;function O(e){return null===e||"object"!=typeof e?null:"function"==typeof(e=F&&e[F]||e["@@iterator"])?e:null}var D,I=Object.assign;function U(e){if(void 0===D)try{throw Error()}catch(e){var n=e.stack.trim().match(/\n( *(at )?)/);D=n&&n[1]||""}return"\n"+D+e}var V=!1;function A(e,n){if(!e||V)return"";V=!0;var t=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(n)if(n=function(){throw Error()},Object.defineProperty(n.prototype,"props",{set:function(){throw Error()}}),"object"==typeof Reflect&&Reflect.construct){try{Reflect.construct(n,[])}catch(e){var r=e}Reflect.construct(e,[],n)}else{try{n.call()}catch(e){r=e}e.call(n.prototype)}else{try{throw Error()}catch(e){r=e}e()}}catch(n){if(n&&r&&"string"==typeof n.stack){for(var l=n.stack.split("\n"),a=r.stack.split("\n"),u=l.length-1,o=a.length-1;1<=u&&0<=o&&l[u]!==a[o];)o--;for(;1<=u&&0<=o;u--,o--)if(l[u]!==a[o]){if(1!==u||1!==o)do{if(u--,0>--o||l[u]!==a[o]){var i="\n"+l[u].replace(" at new "," at ");return e.displayName&&i.includes("<anonymous>")&&(i=i.replace("<anonymous>",e.displayName)),i}}while(1<=u&&0<=o);break}}}finally{V=!1,Error.prepareStackTrace=t}return(e=e?e.displayName||e.name:"")?U(e):""}function $(e){switch(e.tag){case 5:return U(e.type);case 16:return U("Lazy");case 13:return U("Suspense");case 19:return U("SuspenseList");case 0:case 2:case 15:return A(e.type,!1);case 11:return A(e.type.render,!1);case 1:return A(e.type,!0);default:return""}}function j(e){if(null==e)return null;if("function"==typeof e)return e.displayName||e.name||null;if("string"==typeof e)return e;switch(e){case x:return"Fragment";case S:return"Portal";case C:return"Profiler";case E:return"StrictMode";case z:return"Suspense";case T:return"SuspenseList"}if("object"==typeof e)switch(e.$$typeof){case P:return(e.displayName||"Context")+".Consumer";case _:return(e._context.displayName||"Context")+".Provider";case N:var n=e.render;return(e=e.displayName)||(e=""!==(e=n.displayName||n.name||"")?"ForwardRef("+e+")":"ForwardRef"),e;case L:return null!==(n=e.displayName||null)?n:j(e.type)||"Memo";case R:n=e._payload,e=e._init;try{return j(e(n))}catch(e){}}return null}function B(e){var n=e.type;switch(e.tag){case 24:return"Cache";case 9:return(n.displayName||"Context")+".Consumer";case 10:return(n._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return e=(e=n.render).displayName||e.name||"",n.displayName||(""!==e?"ForwardRef("+e+")":"ForwardRef");case 7:return"Fragment";case 5:return n;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return j(n);case 8:return n===E?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if("function"==typeof n)return n.displayName||n.name||null;if("string"==typeof n)return n}return null}function H(e){switch(typeof e){case"boolean":case"number":case"string":case"undefined":case"object":return e;default:return""}}function W(e){var n=e.type;return(e=e.nodeName)&&"input"===e.toLowerCase()&&("checkbox"===n||"radio"===n)}function Q(e){e._valueTracker||(e._valueTracker=function(e){var n=W(e)?"checked":"value",t=Object.getOwnPropertyDescriptor(e.constructor.prototype,n),r=""+e[n];if(!e.hasOwnProperty(n)&&void 0!==t&&"function"==typeof t.get&&"function"==typeof t.set){var l=t.get,a=t.set;return Object.defineProperty(e,n,{configurable:!0,get:function(){return l.call(this)},set:function(e){r=""+e,a.call(this,e)}}),Object.defineProperty(e,n,{enumerable:t.enumerable}),{getValue:function(){return r},setValue:function(e){r=""+e},stopTracking:function(){e._valueTracker=null,delete e[n]}}}}(e))}function q(e){if(!e)return!1;var n=e._valueTracker;if(!n)return!0;var t=n.getValue(),r="";return e&&(r=W(e)?e.checked?"true":"false":e.value),(e=r)!==t&&(n.setValue(e),!0)}function K(e){if(void 0===(e=e||("undefined"!=typeof document?document:void 0)))return null;try{return e.activeElement||e.body}catch(n){return e.body}}function Y(e,n){var t=n.checked;return I({},n,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:null!=t?t:e._wrapperState.initialChecked})}function X(e,n){var t=null==n.defaultValue?"":n.defaultValue,r=null!=n.checked?n.checked:n.defaultChecked;t=H(null!=n.value?n.value:t),e._wrapperState={initialChecked:r,initialValue:t,controlled:"checkbox"===n.type||"radio"===n.type?null!=n.checked:null!=n.value}}function G(e,n){null!=(n=n.checked)&&b(e,"checked",n,!1)}function Z(e,n){G(e,n);var t=H(n.value),r=n.type;if(null!=t)"number"===r?(0===t&&""===e.value||e.value!=t)&&(e.value=""+t):e.value!==""+t&&(e.value=""+t);else if("submit"===r||"reset"===r)return void e.removeAttribute("value");n.hasOwnProperty("value")?ee(e,n.type,t):n.hasOwnProperty("defaultValue")&&ee(e,n.type,H(n.defaultValue)),null==n.checked&&null!=n.defaultChecked&&(e.defaultChecked=!!n.defaultChecked)}function J(e,n,t){if(n.hasOwnProperty("value")||n.hasOwnProperty("defaultValue")){var r=n.type;if(!("submit"!==r&&"reset"!==r||void 0!==n.value&&null!==n.value))return;n=""+e._wrapperState.initialValue,t||n===e.value||(e.value=n),e.defaultValue=n}""!==(t=e.name)&&(e.name=""),e.defaultChecked=!!e._wrapperState.initialChecked,""!==t&&(e.name=t)}function ee(e,n,t){"number"===n&&K(e.ownerDocument)===e||(null==t?e.defaultValue=""+e._wrapperState.initialValue:e.defaultValue!==""+t&&(e.defaultValue=""+t))}var ne=Array.isArray;function te(e,n,t,r){if(e=e.options,n){n={};for(var l=0;l<t.length;l++)n["$"+t[l]]=!0;for(t=0;t<e.length;t++)l=n.hasOwnProperty("$"+e[t].value),e[t].selected!==l&&(e[t].selected=l),l&&r&&(e[t].defaultSelected=!0)}else{for(t=""+H(t),n=null,l=0;l<e.length;l++){if(e[l].value===t)return e[l].selected=!0,void(r&&(e[l].defaultSelected=!0));null!==n||e[l].disabled||(n=e[l])}null!==n&&(n.selected=!0)}}function re(e,n){if(null!=n.dangerouslySetInnerHTML)throw Error(a(91));return I({},n,{value:void 0,defaultValue:void 0,children:""+e._wrapperState.initialValue})}function le(e,n){var t=n.value;if(null==t){if(t=n.children,n=n.defaultValue,null!=t){if(null!=n)throw Error(a(92));if(ne(t)){if(1<t.length)throw Error(a(93));t=t[0]}n=t}null==n&&(n=""),t=n}e._wrapperState={initialValue:H(t)}}function ae(e,n){var t=H(n.value),r=H(n.defaultValue);null!=t&&((t=""+t)!==e.value&&(e.value=t),null==n.defaultValue&&e.defaultValue!==t&&(e.defaultValue=t)),null!=r&&(e.defaultValue=""+r)}function ue(e){var n=e.textContent;n===e._wrapperState.initialValue&&""!==n&&null!==n&&(e.value=n)}function oe(e){switch(e){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function ie(e,n){return null==e||"http://www.w3.org/1999/xhtml"===e?oe(n):"http://www.w3.org/2000/svg"===e&&"foreignObject"===n?"http://www.w3.org/1999/xhtml":e}var se,ce,fe=(ce=function(e,n){if("http://www.w3.org/2000/svg"!==e.namespaceURI||"innerHTML"in e)e.innerHTML=n;else{for((se=se||document.createElement("div")).innerHTML="<svg>"+n.valueOf().toString()+"</svg>",n=se.firstChild;e.firstChild;)e.removeChild(e.firstChild);for(;n.firstChild;)e.appendChild(n.firstChild)}},"undefined"!=typeof MSApp&&MSApp.execUnsafeLocalFunction?function(e,n,t,r){MSApp.execUnsafeLocalFunction((function(){return ce(e,n)}))}:ce);function de(e,n){if(n){var t=e.firstChild;if(t&&t===e.lastChild&&3===t.nodeType)return void(t.nodeValue=n)}e.textContent=n}var pe={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},me=["Webkit","ms","Moz","O"];function he(e,n,t){return null==n||"boolean"==typeof n||""===n?"":t||"number"!=typeof n||0===n||pe.hasOwnProperty(e)&&pe[e]?(""+n).trim():n+"px"}function ge(e,n){for(var t in e=e.style,n)if(n.hasOwnProperty(t)){var r=0===t.indexOf("--"),l=he(t,n[t],r);"float"===t&&(t="cssFloat"),r?e.setProperty(t,l):e[t]=l}}Object.keys(pe).forEach((function(e){me.forEach((function(n){n=n+e.charAt(0).toUpperCase()+e.substring(1),pe[n]=pe[e]}))}));var ve=I({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function ye(e,n){if(n){if(ve[e]&&(null!=n.children||null!=n.dangerouslySetInnerHTML))throw Error(a(137,e));if(null!=n.dangerouslySetInnerHTML){if(null!=n.children)throw Error(a(60));if("object"!=typeof n.dangerouslySetInnerHTML||!("__html"in n.dangerouslySetInnerHTML))throw Error(a(61))}if(null!=n.style&&"object"!=typeof n.style)throw Error(a(62))}}function be(e,n){if(-1===e.indexOf("-"))return"string"==typeof n.is;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var ke=null;function we(e){return(e=e.target||e.srcElement||window).correspondingUseElement&&(e=e.correspondingUseElement),3===e.nodeType?e.parentNode:e}var Se=null,xe=null,Ee=null;function Ce(e){if(e=bl(e)){if("function"!=typeof Se)throw Error(a(280));var n=e.stateNode;n&&(n=wl(n),Se(e.stateNode,e.type,n))}}function _e(e){xe?Ee?Ee.push(e):Ee=[e]:xe=e}function Pe(){if(xe){var e=xe,n=Ee;if(Ee=xe=null,Ce(e),n)for(e=0;e<n.length;e++)Ce(n[e])}}function Ne(e,n){return e(n)}function ze(){}var Te=!1;function Le(e,n,t){if(Te)return e(n,t);Te=!0;try{return Ne(e,n,t)}finally{Te=!1,(null!==xe||null!==Ee)&&(ze(),Pe())}}function Re(e,n){var t=e.stateNode;if(null===t)return null;var r=wl(t);if(null===r)return null;t=r[n];e:switch(n){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(r=!r.disabled)||(r=!("button"===(e=e.type)||"input"===e||"select"===e||"textarea"===e)),e=!r;break e;default:e=!1}if(e)return null;if(t&&"function"!=typeof t)throw Error(a(231,n,typeof t));return t}var Me=!1;if(c)try{var Fe={};Object.defineProperty(Fe,"passive",{get:function(){Me=!0}}),window.addEventListener("test",Fe,Fe),window.removeEventListener("test",Fe,Fe)}catch(ce){Me=!1}function Oe(e,n,t,r,l,a,u,o,i){var s=Array.prototype.slice.call(arguments,3);try{n.apply(t,s)}catch(e){this.onError(e)}}var De=!1,Ie=null,Ue=!1,Ve=null,Ae={onError:function(e){De=!0,Ie=e}};function $e(e,n,t,r,l,a,u,o,i){De=!1,Ie=null,Oe.apply(Ae,arguments)}function je(e){var n=e,t=e;if(e.alternate)for(;n.return;)n=n.return;else{e=n;do{0!=(4098&(n=e).flags)&&(t=n.return),e=n.return}while(e)}return 3===n.tag?t:null}function Be(e){if(13===e.tag){var n=e.memoizedState;if(null===n&&null!==(e=e.alternate)&&(n=e.memoizedState),null!==n)return n.dehydrated}return null}function He(e){if(je(e)!==e)throw Error(a(188))}function We(e){return null!==(e=function(e){var n=e.alternate;if(!n){if(null===(n=je(e)))throw Error(a(188));return n!==e?null:e}for(var t=e,r=n;;){var l=t.return;if(null===l)break;var u=l.alternate;if(null===u){if(null!==(r=l.return)){t=r;continue}break}if(l.child===u.child){for(u=l.child;u;){if(u===t)return He(l),e;if(u===r)return He(l),n;u=u.sibling}throw Error(a(188))}if(t.return!==r.return)t=l,r=u;else{for(var o=!1,i=l.child;i;){if(i===t){o=!0,t=l,r=u;break}if(i===r){o=!0,r=l,t=u;break}i=i.sibling}if(!o){for(i=u.child;i;){if(i===t){o=!0,t=u,r=l;break}if(i===r){o=!0,r=u,t=l;break}i=i.sibling}if(!o)throw Error(a(189))}}if(t.alternate!==r)throw Error(a(190))}if(3!==t.tag)throw Error(a(188));return t.stateNode.current===t?e:n}(e))?Qe(e):null}function Qe(e){if(5===e.tag||6===e.tag)return e;for(e=e.child;null!==e;){var n=Qe(e);if(null!==n)return n;e=e.sibling}return null}var qe=l.unstable_scheduleCallback,Ke=l.unstable_cancelCallback,Ye=l.unstable_shouldYield,Xe=l.unstable_requestPaint,Ge=l.unstable_now,Ze=l.unstable_getCurrentPriorityLevel,Je=l.unstable_ImmediatePriority,en=l.unstable_UserBlockingPriority,nn=l.unstable_NormalPriority,tn=l.unstable_LowPriority,rn=l.unstable_IdlePriority,ln=null,an=null,un=Math.clz32?Math.clz32:function(e){return 0===(e>>>=0)?32:31-(on(e)/sn|0)|0},on=Math.log,sn=Math.LN2,cn=64,fn=4194304;function dn(e){switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return 4194240&e;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return 130023424&e;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return e}}function pn(e,n){var t=e.pendingLanes;if(0===t)return 0;var r=0,l=e.suspendedLanes,a=e.pingedLanes,u=268435455&t;if(0!==u){var o=u&~l;0!==o?r=dn(o):0!=(a&=u)&&(r=dn(a))}else 0!=(u=t&~l)?r=dn(u):0!==a&&(r=dn(a));if(0===r)return 0;if(0!==n&&n!==r&&0==(n&l)&&((l=r&-r)>=(a=n&-n)||16===l&&0!=(4194240&a)))return n;if(0!=(4&r)&&(r|=16&t),0!==(n=e.entangledLanes))for(e=e.entanglements,n&=r;0<n;)l=1<<(t=31-un(n)),r|=e[t],n&=~l;return r}function mn(e,n){switch(e){case 1:case 2:case 4:return n+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return n+5e3;default:return-1}}function hn(e){return 0!=(e=-1073741825&e.pendingLanes)?e:1073741824&e?1073741824:0}function gn(){var e=cn;return 0==(4194240&(cn<<=1))&&(cn=64),e}function vn(e){for(var n=[],t=0;31>t;t++)n.push(e);return n}function yn(e,n,t){e.pendingLanes|=n,536870912!==n&&(e.suspendedLanes=0,e.pingedLanes=0),(e=e.eventTimes)[n=31-un(n)]=t}function bn(e,n){var t=e.entangledLanes|=n;for(e=e.entanglements;t;){var r=31-un(t),l=1<<r;l&n|e[r]&n&&(e[r]|=n),t&=~l}}var kn=0;function wn(e){return 1<(e&=-e)?4<e?0!=(268435455&e)?16:536870912:4:1}var Sn,xn,En,Cn,_n,Pn=!1,Nn=[],zn=null,Tn=null,Ln=null,Rn=new Map,Mn=new Map,Fn=[],On="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function Dn(e,n){switch(e){case"focusin":case"focusout":zn=null;break;case"dragenter":case"dragleave":Tn=null;break;case"mouseover":case"mouseout":Ln=null;break;case"pointerover":case"pointerout":Rn.delete(n.pointerId);break;case"gotpointercapture":case"lostpointercapture":Mn.delete(n.pointerId)}}function In(e,n,t,r,l,a){return null===e||e.nativeEvent!==a?(e={blockedOn:n,domEventName:t,eventSystemFlags:r,nativeEvent:a,targetContainers:[l]},null!==n&&null!==(n=bl(n))&&xn(n),e):(e.eventSystemFlags|=r,n=e.targetContainers,null!==l&&-1===n.indexOf(l)&&n.push(l),e)}function Un(e){var n=yl(e.target);if(null!==n){var t=je(n);if(null!==t)if(13===(n=t.tag)){if(null!==(n=Be(t)))return e.blockedOn=n,void _n(e.priority,(function(){En(t)}))}else if(3===n&&t.stateNode.current.memoizedState.isDehydrated)return void(e.blockedOn=3===t.tag?t.stateNode.containerInfo:null)}e.blockedOn=null}function Vn(e){if(null!==e.blockedOn)return!1;for(var n=e.targetContainers;0<n.length;){var t=Xn(e.domEventName,e.eventSystemFlags,n[0],e.nativeEvent);if(null!==t)return null!==(n=bl(t))&&xn(n),e.blockedOn=t,!1;var r=new(t=e.nativeEvent).constructor(t.type,t);ke=r,t.target.dispatchEvent(r),ke=null,n.shift()}return!0}function An(e,n,t){Vn(e)&&t.delete(n)}function $n(){Pn=!1,null!==zn&&Vn(zn)&&(zn=null),null!==Tn&&Vn(Tn)&&(Tn=null),null!==Ln&&Vn(Ln)&&(Ln=null),Rn.forEach(An),Mn.forEach(An)}function jn(e,n){e.blockedOn===n&&(e.blockedOn=null,Pn||(Pn=!0,l.unstable_scheduleCallback(l.unstable_NormalPriority,$n)))}function Bn(e){function n(n){return jn(n,e)}if(0<Nn.length){jn(Nn[0],e);for(var t=1;t<Nn.length;t++){var r=Nn[t];r.blockedOn===e&&(r.blockedOn=null)}}for(null!==zn&&jn(zn,e),null!==Tn&&jn(Tn,e),null!==Ln&&jn(Ln,e),Rn.forEach(n),Mn.forEach(n),t=0;t<Fn.length;t++)(r=Fn[t]).blockedOn===e&&(r.blockedOn=null);for(;0<Fn.length&&null===(t=Fn[0]).blockedOn;)Un(t),null===t.blockedOn&&Fn.shift()}var Hn=k.ReactCurrentBatchConfig,Wn=!0;function Qn(e,n,t,r){var l=kn,a=Hn.transition;Hn.transition=null;try{kn=1,Kn(e,n,t,r)}finally{kn=l,Hn.transition=a}}function qn(e,n,t,r){var l=kn,a=Hn.transition;Hn.transition=null;try{kn=4,Kn(e,n,t,r)}finally{kn=l,Hn.transition=a}}function Kn(e,n,t,r){if(Wn){var l=Xn(e,n,t,r);if(null===l)Hr(e,n,r,Yn,t),Dn(e,r);else if(function(e,n,t,r,l){switch(n){case"focusin":return zn=In(zn,e,n,t,r,l),!0;case"dragenter":return Tn=In(Tn,e,n,t,r,l),!0;case"mouseover":return Ln=In(Ln,e,n,t,r,l),!0;case"pointerover":var a=l.pointerId;return Rn.set(a,In(Rn.get(a)||null,e,n,t,r,l)),!0;case"gotpointercapture":return a=l.pointerId,Mn.set(a,In(Mn.get(a)||null,e,n,t,r,l)),!0}return!1}(l,e,n,t,r))r.stopPropagation();else if(Dn(e,r),4&n&&-1<On.indexOf(e)){for(;null!==l;){var a=bl(l);if(null!==a&&Sn(a),null===(a=Xn(e,n,t,r))&&Hr(e,n,r,Yn,t),a===l)break;l=a}null!==l&&r.stopPropagation()}else Hr(e,n,r,null,t)}}var Yn=null;function Xn(e,n,t,r){if(Yn=null,null!==(e=yl(e=we(r))))if(null===(n=je(e)))e=null;else if(13===(t=n.tag)){if(null!==(e=Be(n)))return e;e=null}else if(3===t){if(n.stateNode.current.memoizedState.isDehydrated)return 3===n.tag?n.stateNode.containerInfo:null;e=null}else n!==e&&(e=null);return Yn=e,null}function Gn(e){switch(e){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(Ze()){case Je:return 1;case en:return 4;case nn:case tn:return 16;case rn:return 536870912;default:return 16}default:return 16}}var Zn=null,Jn=null,et=null;function nt(){if(et)return et;var e,n,t=Jn,r=t.length,l="value"in Zn?Zn.value:Zn.textContent,a=l.length;for(e=0;e<r&&t[e]===l[e];e++);var u=r-e;for(n=1;n<=u&&t[r-n]===l[a-n];n++);return et=l.slice(e,1<n?1-n:void 0)}function tt(e){var n=e.keyCode;return"charCode"in e?0===(e=e.charCode)&&13===n&&(e=13):e=n,10===e&&(e=13),32<=e||13===e?e:0}function rt(){return!0}function lt(){return!1}function at(e){function n(n,t,r,l,a){for(var u in this._reactName=n,this._targetInst=r,this.type=t,this.nativeEvent=l,this.target=a,this.currentTarget=null,e)e.hasOwnProperty(u)&&(n=e[u],this[u]=n?n(l):l[u]);return this.isDefaultPrevented=(null!=l.defaultPrevented?l.defaultPrevented:!1===l.returnValue)?rt:lt,this.isPropagationStopped=lt,this}return I(n.prototype,{preventDefault:function(){this.defaultPrevented=!0;var e=this.nativeEvent;e&&(e.preventDefault?e.preventDefault():"unknown"!=typeof e.returnValue&&(e.returnValue=!1),this.isDefaultPrevented=rt)},stopPropagation:function(){var e=this.nativeEvent;e&&(e.stopPropagation?e.stopPropagation():"unknown"!=typeof e.cancelBubble&&(e.cancelBubble=!0),this.isPropagationStopped=rt)},persist:function(){},isPersistent:rt}),n}var ut,ot,it,st={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},ct=at(st),ft=I({},st,{view:0,detail:0}),dt=at(ft),pt=I({},ft,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Ct,button:0,buttons:0,relatedTarget:function(e){return void 0===e.relatedTarget?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==it&&(it&&"mousemove"===e.type?(ut=e.screenX-it.screenX,ot=e.screenY-it.screenY):ot=ut=0,it=e),ut)},movementY:function(e){return"movementY"in e?e.movementY:ot}}),mt=at(pt),ht=at(I({},pt,{dataTransfer:0})),gt=at(I({},ft,{relatedTarget:0})),vt=at(I({},st,{animationName:0,elapsedTime:0,pseudoElement:0})),yt=I({},st,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),bt=at(yt),kt=at(I({},st,{data:0})),wt={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},St={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},xt={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Et(e){var n=this.nativeEvent;return n.getModifierState?n.getModifierState(e):!!(e=xt[e])&&!!n[e]}function Ct(){return Et}var _t=I({},ft,{key:function(e){if(e.key){var n=wt[e.key]||e.key;if("Unidentified"!==n)return n}return"keypress"===e.type?13===(e=tt(e))?"Enter":String.fromCharCode(e):"keydown"===e.type||"keyup"===e.type?St[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Ct,charCode:function(e){return"keypress"===e.type?tt(e):0},keyCode:function(e){return"keydown"===e.type||"keyup"===e.type?e.keyCode:0},which:function(e){return"keypress"===e.type?tt(e):"keydown"===e.type||"keyup"===e.type?e.keyCode:0}}),Pt=at(_t),Nt=at(I({},pt,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0})),zt=at(I({},ft,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Ct})),Tt=at(I({},st,{propertyName:0,elapsedTime:0,pseudoElement:0})),Lt=I({},pt,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Rt=at(Lt),Mt=[9,13,27,32],Ft=c&&"CompositionEvent"in window,Ot=null;c&&"documentMode"in document&&(Ot=document.documentMode);var Dt=c&&"TextEvent"in window&&!Ot,It=c&&(!Ft||Ot&&8<Ot&&11>=Ot),Ut=String.fromCharCode(32),Vt=!1;function At(e,n){switch(e){case"keyup":return-1!==Mt.indexOf(n.keyCode);case"keydown":return 229!==n.keyCode;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function $t(e){return"object"==typeof(e=e.detail)&&"data"in e?e.data:null}var jt=!1,Bt={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Ht(e){var n=e&&e.nodeName&&e.nodeName.toLowerCase();return"input"===n?!!Bt[e.type]:"textarea"===n}function Wt(e,n,t,r){_e(r),0<(n=Qr(n,"onChange")).length&&(t=new ct("onChange","change",null,t,r),e.push({event:t,listeners:n}))}var Qt=null,qt=null;function Kt(e){Ur(e,0)}function Yt(e){if(q(kl(e)))return e}function Xt(e,n){if("change"===e)return n}var Gt=!1;if(c){var Zt;if(c){var Jt="oninput"in document;if(!Jt){var er=document.createElement("div");er.setAttribute("oninput","return;"),Jt="function"==typeof er.oninput}Zt=Jt}else Zt=!1;Gt=Zt&&(!document.documentMode||9<document.documentMode)}function nr(){Qt&&(Qt.detachEvent("onpropertychange",tr),qt=Qt=null)}function tr(e){if("value"===e.propertyName&&Yt(qt)){var n=[];Wt(n,qt,e,we(e)),Le(Kt,n)}}function rr(e,n,t){"focusin"===e?(nr(),qt=t,(Qt=n).attachEvent("onpropertychange",tr)):"focusout"===e&&nr()}function lr(e){if("selectionchange"===e||"keyup"===e||"keydown"===e)return Yt(qt)}function ar(e,n){if("click"===e)return Yt(n)}function ur(e,n){if("input"===e||"change"===e)return Yt(n)}var or="function"==typeof Object.is?Object.is:function(e,n){return e===n&&(0!==e||1/e==1/n)||e!=e&&n!=n};function ir(e,n){if(or(e,n))return!0;if("object"!=typeof e||null===e||"object"!=typeof n||null===n)return!1;var t=Object.keys(e),r=Object.keys(n);if(t.length!==r.length)return!1;for(r=0;r<t.length;r++){var l=t[r];if(!f.call(n,l)||!or(e[l],n[l]))return!1}return!0}function sr(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function cr(e,n){var t,r=sr(e);for(e=0;r;){if(3===r.nodeType){if(t=e+r.textContent.length,e<=n&&t>=n)return{node:r,offset:n-e};e=t}e:{for(;r;){if(r.nextSibling){r=r.nextSibling;break e}r=r.parentNode}r=void 0}r=sr(r)}}function fr(e,n){return!(!e||!n)&&(e===n||(!e||3!==e.nodeType)&&(n&&3===n.nodeType?fr(e,n.parentNode):"contains"in e?e.contains(n):!!e.compareDocumentPosition&&!!(16&e.compareDocumentPosition(n))))}function dr(){for(var e=window,n=K();n instanceof e.HTMLIFrameElement;){try{var t="string"==typeof n.contentWindow.location.href}catch(e){t=!1}if(!t)break;n=K((e=n.contentWindow).document)}return n}function pr(e){var n=e&&e.nodeName&&e.nodeName.toLowerCase();return n&&("input"===n&&("text"===e.type||"search"===e.type||"tel"===e.type||"url"===e.type||"password"===e.type)||"textarea"===n||"true"===e.contentEditable)}function mr(e){var n=dr(),t=e.focusedElem,r=e.selectionRange;if(n!==t&&t&&t.ownerDocument&&fr(t.ownerDocument.documentElement,t)){if(null!==r&&pr(t))if(n=r.start,void 0===(e=r.end)&&(e=n),"selectionStart"in t)t.selectionStart=n,t.selectionEnd=Math.min(e,t.value.length);else if((e=(n=t.ownerDocument||document)&&n.defaultView||window).getSelection){e=e.getSelection();var l=t.textContent.length,a=Math.min(r.start,l);r=void 0===r.end?a:Math.min(r.end,l),!e.extend&&a>r&&(l=r,r=a,a=l),l=cr(t,a);var u=cr(t,r);l&&u&&(1!==e.rangeCount||e.anchorNode!==l.node||e.anchorOffset!==l.offset||e.focusNode!==u.node||e.focusOffset!==u.offset)&&((n=n.createRange()).setStart(l.node,l.offset),e.removeAllRanges(),a>r?(e.addRange(n),e.extend(u.node,u.offset)):(n.setEnd(u.node,u.offset),e.addRange(n)))}for(n=[],e=t;e=e.parentNode;)1===e.nodeType&&n.push({element:e,left:e.scrollLeft,top:e.scrollTop});for("function"==typeof t.focus&&t.focus(),t=0;t<n.length;t++)(e=n[t]).element.scrollLeft=e.left,e.element.scrollTop=e.top}}var hr=c&&"documentMode"in document&&11>=document.documentMode,gr=null,vr=null,yr=null,br=!1;function kr(e,n,t){var r=t.window===t?t.document:9===t.nodeType?t:t.ownerDocument;br||null==gr||gr!==K(r)||(r="selectionStart"in(r=gr)&&pr(r)?{start:r.selectionStart,end:r.selectionEnd}:{anchorNode:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection()).anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset},yr&&ir(yr,r)||(yr=r,0<(r=Qr(vr,"onSelect")).length&&(n=new ct("onSelect","select",null,n,t),e.push({event:n,listeners:r}),n.target=gr)))}function wr(e,n){var t={};return t[e.toLowerCase()]=n.toLowerCase(),t["Webkit"+e]="webkit"+n,t["Moz"+e]="moz"+n,t}var Sr={animationend:wr("Animation","AnimationEnd"),animationiteration:wr("Animation","AnimationIteration"),animationstart:wr("Animation","AnimationStart"),transitionend:wr("Transition","TransitionEnd")},xr={},Er={};function Cr(e){if(xr[e])return xr[e];if(!Sr[e])return e;var n,t=Sr[e];for(n in t)if(t.hasOwnProperty(n)&&n in Er)return xr[e]=t[n];return e}c&&(Er=document.createElement("div").style,"AnimationEvent"in window||(delete Sr.animationend.animation,delete Sr.animationiteration.animation,delete Sr.animationstart.animation),"TransitionEvent"in window||delete Sr.transitionend.transition);var _r=Cr("animationend"),Pr=Cr("animationiteration"),Nr=Cr("animationstart"),zr=Cr("transitionend"),Tr=new Map,Lr="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function Rr(e,n){Tr.set(e,n),i(n,[e])}for(var Mr=0;Mr<Lr.length;Mr++){var Fr=Lr[Mr];Rr(Fr.toLowerCase(),"on"+(Fr[0].toUpperCase()+Fr.slice(1)))}Rr(_r,"onAnimationEnd"),Rr(Pr,"onAnimationIteration"),Rr(Nr,"onAnimationStart"),Rr("dblclick","onDoubleClick"),Rr("focusin","onFocus"),Rr("focusout","onBlur"),Rr(zr,"onTransitionEnd"),s("onMouseEnter",["mouseout","mouseover"]),s("onMouseLeave",["mouseout","mouseover"]),s("onPointerEnter",["pointerout","pointerover"]),s("onPointerLeave",["pointerout","pointerover"]),i("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),i("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),i("onBeforeInput",["compositionend","keypress","textInput","paste"]),i("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),i("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),i("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Or="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Dr=new Set("cancel close invalid load scroll toggle".split(" ").concat(Or));function Ir(e,n,t){var r=e.type||"unknown-event";e.currentTarget=t,function(e,n,t,r,l,u,o,i,s){if($e.apply(this,arguments),De){if(!De)throw Error(a(198));var c=Ie;De=!1,Ie=null,Ue||(Ue=!0,Ve=c)}}(r,n,void 0,e),e.currentTarget=null}function Ur(e,n){n=0!=(4&n);for(var t=0;t<e.length;t++){var r=e[t],l=r.event;r=r.listeners;e:{var a=void 0;if(n)for(var u=r.length-1;0<=u;u--){var o=r[u],i=o.instance,s=o.currentTarget;if(o=o.listener,i!==a&&l.isPropagationStopped())break e;Ir(l,o,s),a=i}else for(u=0;u<r.length;u++){if(i=(o=r[u]).instance,s=o.currentTarget,o=o.listener,i!==a&&l.isPropagationStopped())break e;Ir(l,o,s),a=i}}}if(Ue)throw e=Ve,Ue=!1,Ve=null,e}function Vr(e,n){var t=n[hl];void 0===t&&(t=n[hl]=new Set);var r=e+"__bubble";t.has(r)||(Br(n,e,2,!1),t.add(r))}function Ar(e,n,t){var r=0;n&&(r|=4),Br(t,e,r,n)}var $r="_reactListening"+Math.random().toString(36).slice(2);function jr(e){if(!e[$r]){e[$r]=!0,u.forEach((function(n){"selectionchange"!==n&&(Dr.has(n)||Ar(n,!1,e),Ar(n,!0,e))}));var n=9===e.nodeType?e:e.ownerDocument;null===n||n[$r]||(n[$r]=!0,Ar("selectionchange",!1,n))}}function Br(e,n,t,r){switch(Gn(n)){case 1:var l=Qn;break;case 4:l=qn;break;default:l=Kn}t=l.bind(null,n,t,e),l=void 0,!Me||"touchstart"!==n&&"touchmove"!==n&&"wheel"!==n||(l=!0),r?void 0!==l?e.addEventListener(n,t,{capture:!0,passive:l}):e.addEventListener(n,t,!0):void 0!==l?e.addEventListener(n,t,{passive:l}):e.addEventListener(n,t,!1)}function Hr(e,n,t,r,l){var a=r;if(0==(1&n)&&0==(2&n)&&null!==r)e:for(;;){if(null===r)return;var u=r.tag;if(3===u||4===u){var o=r.stateNode.containerInfo;if(o===l||8===o.nodeType&&o.parentNode===l)break;if(4===u)for(u=r.return;null!==u;){var i=u.tag;if((3===i||4===i)&&((i=u.stateNode.containerInfo)===l||8===i.nodeType&&i.parentNode===l))return;u=u.return}for(;null!==o;){if(null===(u=yl(o)))return;if(5===(i=u.tag)||6===i){r=a=u;continue e}o=o.parentNode}}r=r.return}Le((function(){var r=a,l=we(t),u=[];e:{var o=Tr.get(e);if(void 0!==o){var i=ct,s=e;switch(e){case"keypress":if(0===tt(t))break e;case"keydown":case"keyup":i=Pt;break;case"focusin":s="focus",i=gt;break;case"focusout":s="blur",i=gt;break;case"beforeblur":case"afterblur":i=gt;break;case"click":if(2===t.button)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":i=mt;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":i=ht;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":i=zt;break;case _r:case Pr:case Nr:i=vt;break;case zr:i=Tt;break;case"scroll":i=dt;break;case"wheel":i=Rt;break;case"copy":case"cut":case"paste":i=bt;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":i=Nt}var c=0!=(4&n),f=!c&&"scroll"===e,d=c?null!==o?o+"Capture":null:o;c=[];for(var p,m=r;null!==m;){var h=(p=m).stateNode;if(5===p.tag&&null!==h&&(p=h,null!==d&&null!=(h=Re(m,d))&&c.push(Wr(m,h,p))),f)break;m=m.return}0<c.length&&(o=new i(o,s,null,t,l),u.push({event:o,listeners:c}))}}if(0==(7&n)){if(i="mouseout"===e||"pointerout"===e,(!(o="mouseover"===e||"pointerover"===e)||t===ke||!(s=t.relatedTarget||t.fromElement)||!yl(s)&&!s[ml])&&(i||o)&&(o=l.window===l?l:(o=l.ownerDocument)?o.defaultView||o.parentWindow:window,i?(i=r,null!==(s=(s=t.relatedTarget||t.toElement)?yl(s):null)&&(s!==(f=je(s))||5!==s.tag&&6!==s.tag)&&(s=null)):(i=null,s=r),i!==s)){if(c=mt,h="onMouseLeave",d="onMouseEnter",m="mouse","pointerout"!==e&&"pointerover"!==e||(c=Nt,h="onPointerLeave",d="onPointerEnter",m="pointer"),f=null==i?o:kl(i),p=null==s?o:kl(s),(o=new c(h,m+"leave",i,t,l)).target=f,o.relatedTarget=p,h=null,yl(l)===r&&((c=new c(d,m+"enter",s,t,l)).target=p,c.relatedTarget=f,h=c),f=h,i&&s)e:{for(d=s,m=0,p=c=i;p;p=qr(p))m++;for(p=0,h=d;h;h=qr(h))p++;for(;0<m-p;)c=qr(c),m--;for(;0<p-m;)d=qr(d),p--;for(;m--;){if(c===d||null!==d&&c===d.alternate)break e;c=qr(c),d=qr(d)}c=null}else c=null;null!==i&&Kr(u,o,i,c,!1),null!==s&&null!==f&&Kr(u,f,s,c,!0)}if("select"===(i=(o=r?kl(r):window).nodeName&&o.nodeName.toLowerCase())||"input"===i&&"file"===o.type)var g=Xt;else if(Ht(o))if(Gt)g=ur;else{g=lr;var v=rr}else(i=o.nodeName)&&"input"===i.toLowerCase()&&("checkbox"===o.type||"radio"===o.type)&&(g=ar);switch(g&&(g=g(e,r))?Wt(u,g,t,l):(v&&v(e,o,r),"focusout"===e&&(v=o._wrapperState)&&v.controlled&&"number"===o.type&&ee(o,"number",o.value)),v=r?kl(r):window,e){case"focusin":(Ht(v)||"true"===v.contentEditable)&&(gr=v,vr=r,yr=null);break;case"focusout":yr=vr=gr=null;break;case"mousedown":br=!0;break;case"contextmenu":case"mouseup":case"dragend":br=!1,kr(u,t,l);break;case"selectionchange":if(hr)break;case"keydown":case"keyup":kr(u,t,l)}var y;if(Ft)e:{switch(e){case"compositionstart":var b="onCompositionStart";break e;case"compositionend":b="onCompositionEnd";break e;case"compositionupdate":b="onCompositionUpdate";break e}b=void 0}else jt?At(e,t)&&(b="onCompositionEnd"):"keydown"===e&&229===t.keyCode&&(b="onCompositionStart");b&&(It&&"ko"!==t.locale&&(jt||"onCompositionStart"!==b?"onCompositionEnd"===b&&jt&&(y=nt()):(Jn="value"in(Zn=l)?Zn.value:Zn.textContent,jt=!0)),0<(v=Qr(r,b)).length&&(b=new kt(b,e,null,t,l),u.push({event:b,listeners:v}),(y||null!==(y=$t(t)))&&(b.data=y))),(y=Dt?function(e,n){switch(e){case"compositionend":return $t(n);case"keypress":return 32!==n.which?null:(Vt=!0,Ut);case"textInput":return(e=n.data)===Ut&&Vt?null:e;default:return null}}(e,t):function(e,n){if(jt)return"compositionend"===e||!Ft&&At(e,n)?(e=nt(),et=Jn=Zn=null,jt=!1,e):null;switch(e){case"paste":default:return null;case"keypress":if(!(n.ctrlKey||n.altKey||n.metaKey)||n.ctrlKey&&n.altKey){if(n.char&&1<n.char.length)return n.char;if(n.which)return String.fromCharCode(n.which)}return null;case"compositionend":return It&&"ko"!==n.locale?null:n.data}}(e,t))&&0<(r=Qr(r,"onBeforeInput")).length&&(l=new kt("onBeforeInput","beforeinput",null,t,l),u.push({event:l,listeners:r}),l.data=y)}Ur(u,n)}))}function Wr(e,n,t){return{instance:e,listener:n,currentTarget:t}}function Qr(e,n){for(var t=n+"Capture",r=[];null!==e;){var l=e,a=l.stateNode;5===l.tag&&null!==a&&(l=a,null!=(a=Re(e,t))&&r.unshift(Wr(e,a,l)),null!=(a=Re(e,n))&&r.push(Wr(e,a,l))),e=e.return}return r}function qr(e){if(null===e)return null;do{e=e.return}while(e&&5!==e.tag);return e||null}function Kr(e,n,t,r,l){for(var a=n._reactName,u=[];null!==t&&t!==r;){var o=t,i=o.alternate,s=o.stateNode;if(null!==i&&i===r)break;5===o.tag&&null!==s&&(o=s,l?null!=(i=Re(t,a))&&u.unshift(Wr(t,i,o)):l||null!=(i=Re(t,a))&&u.push(Wr(t,i,o))),t=t.return}0!==u.length&&e.push({event:n,listeners:u})}var Yr=/\r\n?/g,Xr=/\u0000|\uFFFD/g;function Gr(e){return("string"==typeof e?e:""+e).replace(Yr,"\n").replace(Xr,"")}function Zr(e,n,t){if(n=Gr(n),Gr(e)!==n&&t)throw Error(a(425))}function Jr(){}var el=null,nl=null;function tl(e,n){return"textarea"===e||"noscript"===e||"string"==typeof n.children||"number"==typeof n.children||"object"==typeof n.dangerouslySetInnerHTML&&null!==n.dangerouslySetInnerHTML&&null!=n.dangerouslySetInnerHTML.__html}var rl="function"==typeof setTimeout?setTimeout:void 0,ll="function"==typeof clearTimeout?clearTimeout:void 0,al="function"==typeof Promise?Promise:void 0,ul="function"==typeof queueMicrotask?queueMicrotask:void 0!==al?function(e){return al.resolve(null).then(e).catch(ol)}:rl;function ol(e){setTimeout((function(){throw e}))}function il(e,n){var t=n,r=0;do{var l=t.nextSibling;if(e.removeChild(t),l&&8===l.nodeType)if("/$"===(t=l.data)){if(0===r)return e.removeChild(l),void Bn(n);r--}else"$"!==t&&"$?"!==t&&"$!"!==t||r++;t=l}while(t);Bn(n)}function sl(e){for(;null!=e;e=e.nextSibling){var n=e.nodeType;if(1===n||3===n)break;if(8===n){if("$"===(n=e.data)||"$!"===n||"$?"===n)break;if("/$"===n)return null}}return e}function cl(e){e=e.previousSibling;for(var n=0;e;){if(8===e.nodeType){var t=e.data;if("$"===t||"$!"===t||"$?"===t){if(0===n)return e;n--}else"/$"===t&&n++}e=e.previousSibling}return null}var fl=Math.random().toString(36).slice(2),dl="__reactFiber$"+fl,pl="__reactProps$"+fl,ml="__reactContainer$"+fl,hl="__reactEvents$"+fl,gl="__reactListeners$"+fl,vl="__reactHandles$"+fl;function yl(e){var n=e[dl];if(n)return n;for(var t=e.parentNode;t;){if(n=t[ml]||t[dl]){if(t=n.alternate,null!==n.child||null!==t&&null!==t.child)for(e=cl(e);null!==e;){if(t=e[dl])return t;e=cl(e)}return n}t=(e=t).parentNode}return null}function bl(e){return!(e=e[dl]||e[ml])||5!==e.tag&&6!==e.tag&&13!==e.tag&&3!==e.tag?null:e}function kl(e){if(5===e.tag||6===e.tag)return e.stateNode;throw Error(a(33))}function wl(e){return e[pl]||null}var Sl=[],xl=-1;function El(e){return{current:e}}function Cl(e){0>xl||(e.current=Sl[xl],Sl[xl]=null,xl--)}function _l(e,n){xl++,Sl[xl]=e.current,e.current=n}var Pl={},Nl=El(Pl),zl=El(!1),Tl=Pl;function Ll(e,n){var t=e.type.contextTypes;if(!t)return Pl;var r=e.stateNode;if(r&&r.__reactInternalMemoizedUnmaskedChildContext===n)return r.__reactInternalMemoizedMaskedChildContext;var l,a={};for(l in t)a[l]=n[l];return r&&((e=e.stateNode).__reactInternalMemoizedUnmaskedChildContext=n,e.__reactInternalMemoizedMaskedChildContext=a),a}function Rl(e){return null!=e.childContextTypes}function Ml(){Cl(zl),Cl(Nl)}function Fl(e,n,t){if(Nl.current!==Pl)throw Error(a(168));_l(Nl,n),_l(zl,t)}function Ol(e,n,t){var r=e.stateNode;if(n=n.childContextTypes,"function"!=typeof r.getChildContext)return t;for(var l in r=r.getChildContext())if(!(l in n))throw Error(a(108,B(e)||"Unknown",l));return I({},t,r)}function Dl(e){return e=(e=e.stateNode)&&e.__reactInternalMemoizedMergedChildContext||Pl,Tl=Nl.current,_l(Nl,e),_l(zl,zl.current),!0}function Il(e,n,t){var r=e.stateNode;if(!r)throw Error(a(169));t?(e=Ol(e,n,Tl),r.__reactInternalMemoizedMergedChildContext=e,Cl(zl),Cl(Nl),_l(Nl,e)):Cl(zl),_l(zl,t)}var Ul=null,Vl=!1,Al=!1;function $l(e){null===Ul?Ul=[e]:Ul.push(e)}function jl(){if(!Al&&null!==Ul){Al=!0;var e=0,n=kn;try{var t=Ul;for(kn=1;e<t.length;e++){var r=t[e];do{r=r(!0)}while(null!==r)}Ul=null,Vl=!1}catch(n){throw null!==Ul&&(Ul=Ul.slice(e+1)),qe(Je,jl),n}finally{kn=n,Al=!1}}return null}var Bl=[],Hl=0,Wl=null,Ql=0,ql=[],Kl=0,Yl=null,Xl=1,Gl="";function Zl(e,n){Bl[Hl++]=Ql,Bl[Hl++]=Wl,Wl=e,Ql=n}function Jl(e,n,t){ql[Kl++]=Xl,ql[Kl++]=Gl,ql[Kl++]=Yl,Yl=e;var r=Xl;e=Gl;var l=32-un(r)-1;r&=~(1<<l),t+=1;var a=32-un(n)+l;if(30<a){var u=l-l%5;a=(r&(1<<u)-1).toString(32),r>>=u,l-=u,Xl=1<<32-un(n)+l|t<<l|r,Gl=a+e}else Xl=1<<a|t<<l|r,Gl=e}function ea(e){null!==e.return&&(Zl(e,1),Jl(e,1,0))}function na(e){for(;e===Wl;)Wl=Bl[--Hl],Bl[Hl]=null,Ql=Bl[--Hl],Bl[Hl]=null;for(;e===Yl;)Yl=ql[--Kl],ql[Kl]=null,Gl=ql[--Kl],ql[Kl]=null,Xl=ql[--Kl],ql[Kl]=null}var ta=null,ra=null,la=!1,aa=null;function ua(e,n){var t=Rs(5,null,null,0);t.elementType="DELETED",t.stateNode=n,t.return=e,null===(n=e.deletions)?(e.deletions=[t],e.flags|=16):n.push(t)}function oa(e,n){switch(e.tag){case 5:var t=e.type;return null!==(n=1!==n.nodeType||t.toLowerCase()!==n.nodeName.toLowerCase()?null:n)&&(e.stateNode=n,ta=e,ra=sl(n.firstChild),!0);case 6:return null!==(n=""===e.pendingProps||3!==n.nodeType?null:n)&&(e.stateNode=n,ta=e,ra=null,!0);case 13:return null!==(n=8!==n.nodeType?null:n)&&(t=null!==Yl?{id:Xl,overflow:Gl}:null,e.memoizedState={dehydrated:n,treeContext:t,retryLane:1073741824},(t=Rs(18,null,null,0)).stateNode=n,t.return=e,e.child=t,ta=e,ra=null,!0);default:return!1}}function ia(e){return 0!=(1&e.mode)&&0==(128&e.flags)}function sa(e){if(la){var n=ra;if(n){var t=n;if(!oa(e,n)){if(ia(e))throw Error(a(418));n=sl(t.nextSibling);var r=ta;n&&oa(e,n)?ua(r,t):(e.flags=-4097&e.flags|2,la=!1,ta=e)}}else{if(ia(e))throw Error(a(418));e.flags=-4097&e.flags|2,la=!1,ta=e}}}function ca(e){for(e=e.return;null!==e&&5!==e.tag&&3!==e.tag&&13!==e.tag;)e=e.return;ta=e}function fa(e){if(e!==ta)return!1;if(!la)return ca(e),la=!0,!1;var n;if((n=3!==e.tag)&&!(n=5!==e.tag)&&(n="head"!==(n=e.type)&&"body"!==n&&!tl(e.type,e.memoizedProps)),n&&(n=ra)){if(ia(e))throw da(),Error(a(418));for(;n;)ua(e,n),n=sl(n.nextSibling)}if(ca(e),13===e.tag){if(!(e=null!==(e=e.memoizedState)?e.dehydrated:null))throw Error(a(317));e:{for(e=e.nextSibling,n=0;e;){if(8===e.nodeType){var t=e.data;if("/$"===t){if(0===n){ra=sl(e.nextSibling);break e}n--}else"$"!==t&&"$!"!==t&&"$?"!==t||n++}e=e.nextSibling}ra=null}}else ra=ta?sl(e.stateNode.nextSibling):null;return!0}function da(){for(var e=ra;e;)e=sl(e.nextSibling)}function pa(){ra=ta=null,la=!1}function ma(e){null===aa?aa=[e]:aa.push(e)}var ha=k.ReactCurrentBatchConfig;function ga(e,n){if(e&&e.defaultProps){for(var t in n=I({},n),e=e.defaultProps)void 0===n[t]&&(n[t]=e[t]);return n}return n}var va=El(null),ya=null,ba=null,ka=null;function wa(){ka=ba=ya=null}function Sa(e){var n=va.current;Cl(va),e._currentValue=n}function xa(e,n,t){for(;null!==e;){var r=e.alternate;if((e.childLanes&n)!==n?(e.childLanes|=n,null!==r&&(r.childLanes|=n)):null!==r&&(r.childLanes&n)!==n&&(r.childLanes|=n),e===t)break;e=e.return}}function Ea(e,n){ya=e,ka=ba=null,null!==(e=e.dependencies)&&null!==e.firstContext&&(0!=(e.lanes&n)&&(ko=!0),e.firstContext=null)}function Ca(e){var n=e._currentValue;if(ka!==e)if(e={context:e,memoizedValue:n,next:null},null===ba){if(null===ya)throw Error(a(308));ba=e,ya.dependencies={lanes:0,firstContext:e}}else ba=ba.next=e;return n}var _a=null;function Pa(e){null===_a?_a=[e]:_a.push(e)}function Na(e,n,t,r){var l=n.interleaved;return null===l?(t.next=t,Pa(n)):(t.next=l.next,l.next=t),n.interleaved=t,za(e,r)}function za(e,n){e.lanes|=n;var t=e.alternate;for(null!==t&&(t.lanes|=n),t=e,e=e.return;null!==e;)e.childLanes|=n,null!==(t=e.alternate)&&(t.childLanes|=n),t=e,e=e.return;return 3===t.tag?t.stateNode:null}var Ta=!1;function La(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function Ra(e,n){e=e.updateQueue,n.updateQueue===e&&(n.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,effects:e.effects})}function Ma(e,n){return{eventTime:e,lane:n,tag:0,payload:null,callback:null,next:null}}function Fa(e,n,t){var r=e.updateQueue;if(null===r)return null;if(r=r.shared,0!=(2&zi)){var l=r.pending;return null===l?n.next=n:(n.next=l.next,l.next=n),r.pending=n,za(e,t)}return null===(l=r.interleaved)?(n.next=n,Pa(r)):(n.next=l.next,l.next=n),r.interleaved=n,za(e,t)}function Oa(e,n,t){if(null!==(n=n.updateQueue)&&(n=n.shared,0!=(4194240&t))){var r=n.lanes;t|=r&=e.pendingLanes,n.lanes=t,bn(e,t)}}function Da(e,n){var t=e.updateQueue,r=e.alternate;if(null!==r&&t===(r=r.updateQueue)){var l=null,a=null;if(null!==(t=t.firstBaseUpdate)){do{var u={eventTime:t.eventTime,lane:t.lane,tag:t.tag,payload:t.payload,callback:t.callback,next:null};null===a?l=a=u:a=a.next=u,t=t.next}while(null!==t);null===a?l=a=n:a=a.next=n}else l=a=n;return t={baseState:r.baseState,firstBaseUpdate:l,lastBaseUpdate:a,shared:r.shared,effects:r.effects},void(e.updateQueue=t)}null===(e=t.lastBaseUpdate)?t.firstBaseUpdate=n:e.next=n,t.lastBaseUpdate=n}function Ia(e,n,t,r){var l=e.updateQueue;Ta=!1;var a=l.firstBaseUpdate,u=l.lastBaseUpdate,o=l.shared.pending;if(null!==o){l.shared.pending=null;var i=o,s=i.next;i.next=null,null===u?a=s:u.next=s,u=i;var c=e.alternate;null!==c&&(o=(c=c.updateQueue).lastBaseUpdate)!==u&&(null===o?c.firstBaseUpdate=s:o.next=s,c.lastBaseUpdate=i)}if(null!==a){var f=l.baseState;for(u=0,c=s=i=null,o=a;;){var d=o.lane,p=o.eventTime;if((r&d)===d){null!==c&&(c=c.next={eventTime:p,lane:0,tag:o.tag,payload:o.payload,callback:o.callback,next:null});e:{var m=e,h=o;switch(d=n,p=t,h.tag){case 1:if("function"==typeof(m=h.payload)){f=m.call(p,f,d);break e}f=m;break e;case 3:m.flags=-65537&m.flags|128;case 0:if(null==(d="function"==typeof(m=h.payload)?m.call(p,f,d):m))break e;f=I({},f,d);break e;case 2:Ta=!0}}null!==o.callback&&0!==o.lane&&(e.flags|=64,null===(d=l.effects)?l.effects=[o]:d.push(o))}else p={eventTime:p,lane:d,tag:o.tag,payload:o.payload,callback:o.callback,next:null},null===c?(s=c=p,i=f):c=c.next=p,u|=d;if(null===(o=o.next)){if(null===(o=l.shared.pending))break;o=(d=o).next,d.next=null,l.lastBaseUpdate=d,l.shared.pending=null}}if(null===c&&(i=f),l.baseState=i,l.firstBaseUpdate=s,l.lastBaseUpdate=c,null!==(n=l.shared.interleaved)){l=n;do{u|=l.lane,l=l.next}while(l!==n)}else null===a&&(l.shared.lanes=0);Ii|=u,e.lanes=u,e.memoizedState=f}}function Ua(e,n,t){if(e=n.effects,n.effects=null,null!==e)for(n=0;n<e.length;n++){var r=e[n],l=r.callback;if(null!==l){if(r.callback=null,r=t,"function"!=typeof l)throw Error(a(191,l));l.call(r)}}}var Va=(new r.Component).refs;function Aa(e,n,t,r){t=null==(t=t(r,n=e.memoizedState))?n:I({},n,t),e.memoizedState=t,0===e.lanes&&(e.updateQueue.baseState=t)}var $a={isMounted:function(e){return!!(e=e._reactInternals)&&je(e)===e},enqueueSetState:function(e,n,t){e=e._reactInternals;var r=ns(),l=ts(e),a=Ma(r,l);a.payload=n,null!=t&&(a.callback=t),null!==(n=Fa(e,a,l))&&(rs(n,e,l,r),Oa(n,e,l))},enqueueReplaceState:function(e,n,t){e=e._reactInternals;var r=ns(),l=ts(e),a=Ma(r,l);a.tag=1,a.payload=n,null!=t&&(a.callback=t),null!==(n=Fa(e,a,l))&&(rs(n,e,l,r),Oa(n,e,l))},enqueueForceUpdate:function(e,n){e=e._reactInternals;var t=ns(),r=ts(e),l=Ma(t,r);l.tag=2,null!=n&&(l.callback=n),null!==(n=Fa(e,l,r))&&(rs(n,e,r,t),Oa(n,e,r))}};function ja(e,n,t,r,l,a,u){return"function"==typeof(e=e.stateNode).shouldComponentUpdate?e.shouldComponentUpdate(r,a,u):!(n.prototype&&n.prototype.isPureReactComponent&&ir(t,r)&&ir(l,a))}function Ba(e,n,t){var r=!1,l=Pl,a=n.contextType;return"object"==typeof a&&null!==a?a=Ca(a):(l=Rl(n)?Tl:Nl.current,a=(r=null!=(r=n.contextTypes))?Ll(e,l):Pl),n=new n(t,a),e.memoizedState=null!==n.state&&void 0!==n.state?n.state:null,n.updater=$a,e.stateNode=n,n._reactInternals=e,r&&((e=e.stateNode).__reactInternalMemoizedUnmaskedChildContext=l,e.__reactInternalMemoizedMaskedChildContext=a),n}function Ha(e,n,t,r){e=n.state,"function"==typeof n.componentWillReceiveProps&&n.componentWillReceiveProps(t,r),"function"==typeof n.UNSAFE_componentWillReceiveProps&&n.UNSAFE_componentWillReceiveProps(t,r),n.state!==e&&$a.enqueueReplaceState(n,n.state,null)}function Wa(e,n,t,r){var l=e.stateNode;l.props=t,l.state=e.memoizedState,l.refs=Va,La(e);var a=n.contextType;"object"==typeof a&&null!==a?l.context=Ca(a):(a=Rl(n)?Tl:Nl.current,l.context=Ll(e,a)),l.state=e.memoizedState,"function"==typeof(a=n.getDerivedStateFromProps)&&(Aa(e,n,a,t),l.state=e.memoizedState),"function"==typeof n.getDerivedStateFromProps||"function"==typeof l.getSnapshotBeforeUpdate||"function"!=typeof l.UNSAFE_componentWillMount&&"function"!=typeof l.componentWillMount||(n=l.state,"function"==typeof l.componentWillMount&&l.componentWillMount(),"function"==typeof l.UNSAFE_componentWillMount&&l.UNSAFE_componentWillMount(),n!==l.state&&$a.enqueueReplaceState(l,l.state,null),Ia(e,t,l,r),l.state=e.memoizedState),"function"==typeof l.componentDidMount&&(e.flags|=4194308)}function Qa(e,n,t){if(null!==(e=t.ref)&&"function"!=typeof e&&"object"!=typeof e){if(t._owner){if(t=t._owner){if(1!==t.tag)throw Error(a(309));var r=t.stateNode}if(!r)throw Error(a(147,e));var l=r,u=""+e;return null!==n&&null!==n.ref&&"function"==typeof n.ref&&n.ref._stringRef===u?n.ref:(n=function(e){var n=l.refs;n===Va&&(n=l.refs={}),null===e?delete n[u]:n[u]=e},n._stringRef=u,n)}if("string"!=typeof e)throw Error(a(284));if(!t._owner)throw Error(a(290,e))}return e}function qa(e,n){throw e=Object.prototype.toString.call(n),Error(a(31,"[object Object]"===e?"object with keys {"+Object.keys(n).join(", ")+"}":e))}function Ka(e){return(0,e._init)(e._payload)}function Ya(e){function n(n,t){if(e){var r=n.deletions;null===r?(n.deletions=[t],n.flags|=16):r.push(t)}}function t(t,r){if(!e)return null;for(;null!==r;)n(t,r),r=r.sibling;return null}function r(e,n){for(e=new Map;null!==n;)null!==n.key?e.set(n.key,n):e.set(n.index,n),n=n.sibling;return e}function l(e,n){return(e=Fs(e,n)).index=0,e.sibling=null,e}function u(n,t,r){return n.index=r,e?null!==(r=n.alternate)?(r=r.index)<t?(n.flags|=2,t):r:(n.flags|=2,t):(n.flags|=1048576,t)}function o(n){return e&&null===n.alternate&&(n.flags|=2),n}function i(e,n,t,r){return null===n||6!==n.tag?((n=Us(t,e.mode,r)).return=e,n):((n=l(n,t)).return=e,n)}function s(e,n,t,r){var a=t.type;return a===x?f(e,n,t.props.children,r,t.key):null!==n&&(n.elementType===a||"object"==typeof a&&null!==a&&a.$$typeof===R&&Ka(a)===n.type)?((r=l(n,t.props)).ref=Qa(e,n,t),r.return=e,r):((r=Os(t.type,t.key,t.props,null,e.mode,r)).ref=Qa(e,n,t),r.return=e,r)}function c(e,n,t,r){return null===n||4!==n.tag||n.stateNode.containerInfo!==t.containerInfo||n.stateNode.implementation!==t.implementation?((n=Vs(t,e.mode,r)).return=e,n):((n=l(n,t.children||[])).return=e,n)}function f(e,n,t,r,a){return null===n||7!==n.tag?((n=Ds(t,e.mode,r,a)).return=e,n):((n=l(n,t)).return=e,n)}function d(e,n,t){if("string"==typeof n&&""!==n||"number"==typeof n)return(n=Us(""+n,e.mode,t)).return=e,n;if("object"==typeof n&&null!==n){switch(n.$$typeof){case w:return(t=Os(n.type,n.key,n.props,null,e.mode,t)).ref=Qa(e,null,n),t.return=e,t;case S:return(n=Vs(n,e.mode,t)).return=e,n;case R:return d(e,(0,n._init)(n._payload),t)}if(ne(n)||O(n))return(n=Ds(n,e.mode,t,null)).return=e,n;qa(e,n)}return null}function p(e,n,t,r){var l=null!==n?n.key:null;if("string"==typeof t&&""!==t||"number"==typeof t)return null!==l?null:i(e,n,""+t,r);if("object"==typeof t&&null!==t){switch(t.$$typeof){case w:return t.key===l?s(e,n,t,r):null;case S:return t.key===l?c(e,n,t,r):null;case R:return p(e,n,(l=t._init)(t._payload),r)}if(ne(t)||O(t))return null!==l?null:f(e,n,t,r,null);qa(e,t)}return null}function m(e,n,t,r,l){if("string"==typeof r&&""!==r||"number"==typeof r)return i(n,e=e.get(t)||null,""+r,l);if("object"==typeof r&&null!==r){switch(r.$$typeof){case w:return s(n,e=e.get(null===r.key?t:r.key)||null,r,l);case S:return c(n,e=e.get(null===r.key?t:r.key)||null,r,l);case R:return m(e,n,t,(0,r._init)(r._payload),l)}if(ne(r)||O(r))return f(n,e=e.get(t)||null,r,l,null);qa(n,r)}return null}function h(l,a,o,i){for(var s=null,c=null,f=a,h=a=0,g=null;null!==f&&h<o.length;h++){f.index>h?(g=f,f=null):g=f.sibling;var v=p(l,f,o[h],i);if(null===v){null===f&&(f=g);break}e&&f&&null===v.alternate&&n(l,f),a=u(v,a,h),null===c?s=v:c.sibling=v,c=v,f=g}if(h===o.length)return t(l,f),la&&Zl(l,h),s;if(null===f){for(;h<o.length;h++)null!==(f=d(l,o[h],i))&&(a=u(f,a,h),null===c?s=f:c.sibling=f,c=f);return la&&Zl(l,h),s}for(f=r(l,f);h<o.length;h++)null!==(g=m(f,l,h,o[h],i))&&(e&&null!==g.alternate&&f.delete(null===g.key?h:g.key),a=u(g,a,h),null===c?s=g:c.sibling=g,c=g);return e&&f.forEach((function(e){return n(l,e)})),la&&Zl(l,h),s}function g(l,o,i,s){var c=O(i);if("function"!=typeof c)throw Error(a(150));if(null==(i=c.call(i)))throw Error(a(151));for(var f=c=null,h=o,g=o=0,v=null,y=i.next();null!==h&&!y.done;g++,y=i.next()){h.index>g?(v=h,h=null):v=h.sibling;var b=p(l,h,y.value,s);if(null===b){null===h&&(h=v);break}e&&h&&null===b.alternate&&n(l,h),o=u(b,o,g),null===f?c=b:f.sibling=b,f=b,h=v}if(y.done)return t(l,h),la&&Zl(l,g),c;if(null===h){for(;!y.done;g++,y=i.next())null!==(y=d(l,y.value,s))&&(o=u(y,o,g),null===f?c=y:f.sibling=y,f=y);return la&&Zl(l,g),c}for(h=r(l,h);!y.done;g++,y=i.next())null!==(y=m(h,l,g,y.value,s))&&(e&&null!==y.alternate&&h.delete(null===y.key?g:y.key),o=u(y,o,g),null===f?c=y:f.sibling=y,f=y);return e&&h.forEach((function(e){return n(l,e)})),la&&Zl(l,g),c}return function e(r,a,u,i){if("object"==typeof u&&null!==u&&u.type===x&&null===u.key&&(u=u.props.children),"object"==typeof u&&null!==u){switch(u.$$typeof){case w:e:{for(var s=u.key,c=a;null!==c;){if(c.key===s){if((s=u.type)===x){if(7===c.tag){t(r,c.sibling),(a=l(c,u.props.children)).return=r,r=a;break e}}else if(c.elementType===s||"object"==typeof s&&null!==s&&s.$$typeof===R&&Ka(s)===c.type){t(r,c.sibling),(a=l(c,u.props)).ref=Qa(r,c,u),a.return=r,r=a;break e}t(r,c);break}n(r,c),c=c.sibling}u.type===x?((a=Ds(u.props.children,r.mode,i,u.key)).return=r,r=a):((i=Os(u.type,u.key,u.props,null,r.mode,i)).ref=Qa(r,a,u),i.return=r,r=i)}return o(r);case S:e:{for(c=u.key;null!==a;){if(a.key===c){if(4===a.tag&&a.stateNode.containerInfo===u.containerInfo&&a.stateNode.implementation===u.implementation){t(r,a.sibling),(a=l(a,u.children||[])).return=r,r=a;break e}t(r,a);break}n(r,a),a=a.sibling}(a=Vs(u,r.mode,i)).return=r,r=a}return o(r);case R:return e(r,a,(c=u._init)(u._payload),i)}if(ne(u))return h(r,a,u,i);if(O(u))return g(r,a,u,i);qa(r,u)}return"string"==typeof u&&""!==u||"number"==typeof u?(u=""+u,null!==a&&6===a.tag?(t(r,a.sibling),(a=l(a,u)).return=r,r=a):(t(r,a),(a=Us(u,r.mode,i)).return=r,r=a),o(r)):t(r,a)}}var Xa=Ya(!0),Ga=Ya(!1),Za={},Ja=El(Za),eu=El(Za),nu=El(Za);function tu(e){if(e===Za)throw Error(a(174));return e}function ru(e,n){switch(_l(nu,n),_l(eu,e),_l(Ja,Za),e=n.nodeType){case 9:case 11:n=(n=n.documentElement)?n.namespaceURI:ie(null,"");break;default:n=ie(n=(e=8===e?n.parentNode:n).namespaceURI||null,e=e.tagName)}Cl(Ja),_l(Ja,n)}function lu(){Cl(Ja),Cl(eu),Cl(nu)}function au(e){tu(nu.current);var n=tu(Ja.current),t=ie(n,e.type);n!==t&&(_l(eu,e),_l(Ja,t))}function uu(e){eu.current===e&&(Cl(Ja),Cl(eu))}var ou=El(0);function iu(e){for(var n=e;null!==n;){if(13===n.tag){var t=n.memoizedState;if(null!==t&&(null===(t=t.dehydrated)||"$?"===t.data||"$!"===t.data))return n}else if(19===n.tag&&void 0!==n.memoizedProps.revealOrder){if(0!=(128&n.flags))return n}else if(null!==n.child){n.child.return=n,n=n.child;continue}if(n===e)break;for(;null===n.sibling;){if(null===n.return||n.return===e)return null;n=n.return}n.sibling.return=n.return,n=n.sibling}return null}var su=[];function cu(){for(var e=0;e<su.length;e++)su[e]._workInProgressVersionPrimary=null;su.length=0}var fu=k.ReactCurrentDispatcher,du=k.ReactCurrentBatchConfig,pu=0,mu=null,hu=null,gu=null,vu=!1,yu=!1,bu=0,ku=0;function wu(){throw Error(a(321))}function Su(e,n){if(null===n)return!1;for(var t=0;t<n.length&&t<e.length;t++)if(!or(e[t],n[t]))return!1;return!0}function xu(e,n,t,r,l,u){if(pu=u,mu=n,n.memoizedState=null,n.updateQueue=null,n.lanes=0,fu.current=null===e||null===e.memoizedState?uo:oo,e=t(r,l),yu){u=0;do{if(yu=!1,bu=0,25<=u)throw Error(a(301));u+=1,gu=hu=null,n.updateQueue=null,fu.current=io,e=t(r,l)}while(yu)}if(fu.current=ao,n=null!==hu&&null!==hu.next,pu=0,gu=hu=mu=null,vu=!1,n)throw Error(a(300));return e}function Eu(){var e=0!==bu;return bu=0,e}function Cu(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return null===gu?mu.memoizedState=gu=e:gu=gu.next=e,gu}function _u(){if(null===hu){var e=mu.alternate;e=null!==e?e.memoizedState:null}else e=hu.next;var n=null===gu?mu.memoizedState:gu.next;if(null!==n)gu=n,hu=e;else{if(null===e)throw Error(a(310));e={memoizedState:(hu=e).memoizedState,baseState:hu.baseState,baseQueue:hu.baseQueue,queue:hu.queue,next:null},null===gu?mu.memoizedState=gu=e:gu=gu.next=e}return gu}function Pu(e,n){return"function"==typeof n?n(e):n}function Nu(e){var n=_u(),t=n.queue;if(null===t)throw Error(a(311));t.lastRenderedReducer=e;var r=hu,l=r.baseQueue,u=t.pending;if(null!==u){if(null!==l){var o=l.next;l.next=u.next,u.next=o}r.baseQueue=l=u,t.pending=null}if(null!==l){u=l.next,r=r.baseState;var i=o=null,s=null,c=u;do{var f=c.lane;if((pu&f)===f)null!==s&&(s=s.next={lane:0,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),r=c.hasEagerState?c.eagerState:e(r,c.action);else{var d={lane:f,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null};null===s?(i=s=d,o=r):s=s.next=d,mu.lanes|=f,Ii|=f}c=c.next}while(null!==c&&c!==u);null===s?o=r:s.next=i,or(r,n.memoizedState)||(ko=!0),n.memoizedState=r,n.baseState=o,n.baseQueue=s,t.lastRenderedState=r}if(null!==(e=t.interleaved)){l=e;do{u=l.lane,mu.lanes|=u,Ii|=u,l=l.next}while(l!==e)}else null===l&&(t.lanes=0);return[n.memoizedState,t.dispatch]}function zu(e){var n=_u(),t=n.queue;if(null===t)throw Error(a(311));t.lastRenderedReducer=e;var r=t.dispatch,l=t.pending,u=n.memoizedState;if(null!==l){t.pending=null;var o=l=l.next;do{u=e(u,o.action),o=o.next}while(o!==l);or(u,n.memoizedState)||(ko=!0),n.memoizedState=u,null===n.baseQueue&&(n.baseState=u),t.lastRenderedState=u}return[u,r]}function Tu(){}function Lu(e,n){var t=mu,r=_u(),l=n(),u=!or(r.memoizedState,l);if(u&&(r.memoizedState=l,ko=!0),r=r.queue,Bu(Fu.bind(null,t,r,e),[e]),r.getSnapshot!==n||u||null!==gu&&1&gu.memoizedState.tag){if(t.flags|=2048,Uu(9,Mu.bind(null,t,r,l,n),void 0,null),null===Ti)throw Error(a(349));0!=(30&pu)||Ru(t,n,l)}return l}function Ru(e,n,t){e.flags|=16384,e={getSnapshot:n,value:t},null===(n=mu.updateQueue)?(n={lastEffect:null,stores:null},mu.updateQueue=n,n.stores=[e]):null===(t=n.stores)?n.stores=[e]:t.push(e)}function Mu(e,n,t,r){n.value=t,n.getSnapshot=r,Ou(n)&&Du(e)}function Fu(e,n,t){return t((function(){Ou(n)&&Du(e)}))}function Ou(e){var n=e.getSnapshot;e=e.value;try{var t=n();return!or(e,t)}catch(e){return!0}}function Du(e){var n=za(e,1);null!==n&&rs(n,e,1,-1)}function Iu(e){var n=Cu();return"function"==typeof e&&(e=e()),n.memoizedState=n.baseState=e,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Pu,lastRenderedState:e},n.queue=e,e=e.dispatch=no.bind(null,mu,e),[n.memoizedState,e]}function Uu(e,n,t,r){return e={tag:e,create:n,destroy:t,deps:r,next:null},null===(n=mu.updateQueue)?(n={lastEffect:null,stores:null},mu.updateQueue=n,n.lastEffect=e.next=e):null===(t=n.lastEffect)?n.lastEffect=e.next=e:(r=t.next,t.next=e,e.next=r,n.lastEffect=e),e}function Vu(){return _u().memoizedState}function Au(e,n,t,r){var l=Cu();mu.flags|=e,l.memoizedState=Uu(1|n,t,void 0,void 0===r?null:r)}function $u(e,n,t,r){var l=_u();r=void 0===r?null:r;var a=void 0;if(null!==hu){var u=hu.memoizedState;if(a=u.destroy,null!==r&&Su(r,u.deps))return void(l.memoizedState=Uu(n,t,a,r))}mu.flags|=e,l.memoizedState=Uu(1|n,t,a,r)}function ju(e,n){return Au(8390656,8,e,n)}function Bu(e,n){return $u(2048,8,e,n)}function Hu(e,n){return $u(4,2,e,n)}function Wu(e,n){return $u(4,4,e,n)}function Qu(e,n){return"function"==typeof n?(e=e(),n(e),function(){n(null)}):null!=n?(e=e(),n.current=e,function(){n.current=null}):void 0}function qu(e,n,t){return t=null!=t?t.concat([e]):null,$u(4,4,Qu.bind(null,n,e),t)}function Ku(){}function Yu(e,n){var t=_u();n=void 0===n?null:n;var r=t.memoizedState;return null!==r&&null!==n&&Su(n,r[1])?r[0]:(t.memoizedState=[e,n],e)}function Xu(e,n){var t=_u();n=void 0===n?null:n;var r=t.memoizedState;return null!==r&&null!==n&&Su(n,r[1])?r[0]:(e=e(),t.memoizedState=[e,n],e)}function Gu(e,n,t){return 0==(21&pu)?(e.baseState&&(e.baseState=!1,ko=!0),e.memoizedState=t):(or(t,n)||(t=gn(),mu.lanes|=t,Ii|=t,e.baseState=!0),n)}function Zu(e,n){var t=kn;kn=0!==t&&4>t?t:4,e(!0);var r=du.transition;du.transition={};try{e(!1),n()}finally{kn=t,du.transition=r}}function Ju(){return _u().memoizedState}function eo(e,n,t){var r=ts(e);t={lane:r,action:t,hasEagerState:!1,eagerState:null,next:null},to(e)?ro(n,t):null!==(t=Na(e,n,t,r))&&(rs(t,e,r,ns()),lo(t,n,r))}function no(e,n,t){var r=ts(e),l={lane:r,action:t,hasEagerState:!1,eagerState:null,next:null};if(to(e))ro(n,l);else{var a=e.alternate;if(0===e.lanes&&(null===a||0===a.lanes)&&null!==(a=n.lastRenderedReducer))try{var u=n.lastRenderedState,o=a(u,t);if(l.hasEagerState=!0,l.eagerState=o,or(o,u)){var i=n.interleaved;return null===i?(l.next=l,Pa(n)):(l.next=i.next,i.next=l),void(n.interleaved=l)}}catch(e){}null!==(t=Na(e,n,l,r))&&(rs(t,e,r,l=ns()),lo(t,n,r))}}function to(e){var n=e.alternate;return e===mu||null!==n&&n===mu}function ro(e,n){yu=vu=!0;var t=e.pending;null===t?n.next=n:(n.next=t.next,t.next=n),e.pending=n}function lo(e,n,t){if(0!=(4194240&t)){var r=n.lanes;t|=r&=e.pendingLanes,n.lanes=t,bn(e,t)}}var ao={readContext:Ca,useCallback:wu,useContext:wu,useEffect:wu,useImperativeHandle:wu,useInsertionEffect:wu,useLayoutEffect:wu,useMemo:wu,useReducer:wu,useRef:wu,useState:wu,useDebugValue:wu,useDeferredValue:wu,useTransition:wu,useMutableSource:wu,useSyncExternalStore:wu,useId:wu,unstable_isNewReconciler:!1},uo={readContext:Ca,useCallback:function(e,n){return Cu().memoizedState=[e,void 0===n?null:n],e},useContext:Ca,useEffect:ju,useImperativeHandle:function(e,n,t){return t=null!=t?t.concat([e]):null,Au(4194308,4,Qu.bind(null,n,e),t)},useLayoutEffect:function(e,n){return Au(4194308,4,e,n)},useInsertionEffect:function(e,n){return Au(4,2,e,n)},useMemo:function(e,n){var t=Cu();return n=void 0===n?null:n,e=e(),t.memoizedState=[e,n],e},useReducer:function(e,n,t){var r=Cu();return n=void 0!==t?t(n):n,r.memoizedState=r.baseState=n,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:n},r.queue=e,e=e.dispatch=eo.bind(null,mu,e),[r.memoizedState,e]},useRef:function(e){return e={current:e},Cu().memoizedState=e},useState:Iu,useDebugValue:Ku,useDeferredValue:function(e){return Cu().memoizedState=e},useTransition:function(){var e=Iu(!1),n=e[0];return e=Zu.bind(null,e[1]),Cu().memoizedState=e,[n,e]},useMutableSource:function(){},useSyncExternalStore:function(e,n,t){var r=mu,l=Cu();if(la){if(void 0===t)throw Error(a(407));t=t()}else{if(t=n(),null===Ti)throw Error(a(349));0!=(30&pu)||Ru(r,n,t)}l.memoizedState=t;var u={value:t,getSnapshot:n};return l.queue=u,ju(Fu.bind(null,r,u,e),[e]),r.flags|=2048,Uu(9,Mu.bind(null,r,u,t,n),void 0,null),t},useId:function(){var e=Cu(),n=Ti.identifierPrefix;if(la){var t=Gl;n=":"+n+"R"+(t=(Xl&~(1<<32-un(Xl)-1)).toString(32)+t),0<(t=bu++)&&(n+="H"+t.toString(32)),n+=":"}else n=":"+n+"r"+(t=ku++).toString(32)+":";return e.memoizedState=n},unstable_isNewReconciler:!1},oo={readContext:Ca,useCallback:Yu,useContext:Ca,useEffect:Bu,useImperativeHandle:qu,useInsertionEffect:Hu,useLayoutEffect:Wu,useMemo:Xu,useReducer:Nu,useRef:Vu,useState:function(){return Nu(Pu)},useDebugValue:Ku,useDeferredValue:function(e){return Gu(_u(),hu.memoizedState,e)},useTransition:function(){return[Nu(Pu)[0],_u().memoizedState]},useMutableSource:Tu,useSyncExternalStore:Lu,useId:Ju,unstable_isNewReconciler:!1},io={readContext:Ca,useCallback:Yu,useContext:Ca,useEffect:Bu,useImperativeHandle:qu,useInsertionEffect:Hu,useLayoutEffect:Wu,useMemo:Xu,useReducer:zu,useRef:Vu,useState:function(){return zu(Pu)},useDebugValue:Ku,useDeferredValue:function(e){var n=_u();return null===hu?n.memoizedState=e:Gu(n,hu.memoizedState,e)},useTransition:function(){return[zu(Pu)[0],_u().memoizedState]},useMutableSource:Tu,useSyncExternalStore:Lu,useId:Ju,unstable_isNewReconciler:!1};function so(e,n){try{var t="",r=n;do{t+=$(r),r=r.return}while(r);var l=t}catch(e){l="\nError generating stack: "+e.message+"\n"+e.stack}return{value:e,source:n,stack:l,digest:null}}function co(e,n,t){return{value:e,source:null,stack:null!=t?t:null,digest:null!=n?n:null}}function fo(e,n){try{console.error(n.value)}catch(e){setTimeout((function(){throw e}))}}var po="function"==typeof WeakMap?WeakMap:Map;function mo(e,n,t){(t=Ma(-1,t)).tag=3,t.payload={element:null};var r=n.value;return t.callback=function(){Wi||(Wi=!0,Qi=r),fo(0,n)},t}function ho(e,n,t){(t=Ma(-1,t)).tag=3;var r=e.type.getDerivedStateFromError;if("function"==typeof r){var l=n.value;t.payload=function(){return r(l)},t.callback=function(){fo(0,n)}}var a=e.stateNode;return null!==a&&"function"==typeof a.componentDidCatch&&(t.callback=function(){fo(0,n),"function"!=typeof r&&(null===qi?qi=new Set([this]):qi.add(this));var e=n.stack;this.componentDidCatch(n.value,{componentStack:null!==e?e:""})}),t}function go(e,n,t){var r=e.pingCache;if(null===r){r=e.pingCache=new po;var l=new Set;r.set(n,l)}else void 0===(l=r.get(n))&&(l=new Set,r.set(n,l));l.has(t)||(l.add(t),e=_s.bind(null,e,n,t),n.then(e,e))}function vo(e){do{var n;if((n=13===e.tag)&&(n=null===(n=e.memoizedState)||null!==n.dehydrated),n)return e;e=e.return}while(null!==e);return null}function yo(e,n,t,r,l){return 0==(1&e.mode)?(e===n?e.flags|=65536:(e.flags|=128,t.flags|=131072,t.flags&=-52805,1===t.tag&&(null===t.alternate?t.tag=17:((n=Ma(-1,1)).tag=2,Fa(t,n,1))),t.lanes|=1),e):(e.flags|=65536,e.lanes=l,e)}var bo=k.ReactCurrentOwner,ko=!1;function wo(e,n,t,r){n.child=null===e?Ga(n,null,t,r):Xa(n,e.child,t,r)}function So(e,n,t,r,l){t=t.render;var a=n.ref;return Ea(n,l),r=xu(e,n,t,r,a,l),t=Eu(),null===e||ko?(la&&t&&ea(n),n.flags|=1,wo(e,n,r,l),n.child):(n.updateQueue=e.updateQueue,n.flags&=-2053,e.lanes&=~l,Wo(e,n,l))}function xo(e,n,t,r,l){if(null===e){var a=t.type;return"function"!=typeof a||Ms(a)||void 0!==a.defaultProps||null!==t.compare||void 0!==t.defaultProps?((e=Os(t.type,null,r,n,n.mode,l)).ref=n.ref,e.return=n,n.child=e):(n.tag=15,n.type=a,Eo(e,n,a,r,l))}if(a=e.child,0==(e.lanes&l)){var u=a.memoizedProps;if((t=null!==(t=t.compare)?t:ir)(u,r)&&e.ref===n.ref)return Wo(e,n,l)}return n.flags|=1,(e=Fs(a,r)).ref=n.ref,e.return=n,n.child=e}function Eo(e,n,t,r,l){if(null!==e){var a=e.memoizedProps;if(ir(a,r)&&e.ref===n.ref){if(ko=!1,n.pendingProps=r=a,0==(e.lanes&l))return n.lanes=e.lanes,Wo(e,n,l);0!=(131072&e.flags)&&(ko=!0)}}return Po(e,n,t,r,l)}function Co(e,n,t){var r=n.pendingProps,l=r.children,a=null!==e?e.memoizedState:null;if("hidden"===r.mode)if(0==(1&n.mode))n.memoizedState={baseLanes:0,cachePool:null,transitions:null},_l(Fi,Mi),Mi|=t;else{if(0==(1073741824&t))return e=null!==a?a.baseLanes|t:t,n.lanes=n.childLanes=1073741824,n.memoizedState={baseLanes:e,cachePool:null,transitions:null},n.updateQueue=null,_l(Fi,Mi),Mi|=e,null;n.memoizedState={baseLanes:0,cachePool:null,transitions:null},r=null!==a?a.baseLanes:t,_l(Fi,Mi),Mi|=r}else null!==a?(r=a.baseLanes|t,n.memoizedState=null):r=t,_l(Fi,Mi),Mi|=r;return wo(e,n,l,t),n.child}function _o(e,n){var t=n.ref;(null===e&&null!==t||null!==e&&e.ref!==t)&&(n.flags|=512,n.flags|=2097152)}function Po(e,n,t,r,l){var a=Rl(t)?Tl:Nl.current;return a=Ll(n,a),Ea(n,l),t=xu(e,n,t,r,a,l),r=Eu(),null===e||ko?(la&&r&&ea(n),n.flags|=1,wo(e,n,t,l),n.child):(n.updateQueue=e.updateQueue,n.flags&=-2053,e.lanes&=~l,Wo(e,n,l))}function No(e,n,t,r,l){if(Rl(t)){var a=!0;Dl(n)}else a=!1;if(Ea(n,l),null===n.stateNode)Ho(e,n),Ba(n,t,r),Wa(n,t,r,l),r=!0;else if(null===e){var u=n.stateNode,o=n.memoizedProps;u.props=o;var i=u.context,s=t.contextType;s="object"==typeof s&&null!==s?Ca(s):Ll(n,s=Rl(t)?Tl:Nl.current);var c=t.getDerivedStateFromProps,f="function"==typeof c||"function"==typeof u.getSnapshotBeforeUpdate;f||"function"!=typeof u.UNSAFE_componentWillReceiveProps&&"function"!=typeof u.componentWillReceiveProps||(o!==r||i!==s)&&Ha(n,u,r,s),Ta=!1;var d=n.memoizedState;u.state=d,Ia(n,r,u,l),i=n.memoizedState,o!==r||d!==i||zl.current||Ta?("function"==typeof c&&(Aa(n,t,c,r),i=n.memoizedState),(o=Ta||ja(n,t,o,r,d,i,s))?(f||"function"!=typeof u.UNSAFE_componentWillMount&&"function"!=typeof u.componentWillMount||("function"==typeof u.componentWillMount&&u.componentWillMount(),"function"==typeof u.UNSAFE_componentWillMount&&u.UNSAFE_componentWillMount()),"function"==typeof u.componentDidMount&&(n.flags|=4194308)):("function"==typeof u.componentDidMount&&(n.flags|=4194308),n.memoizedProps=r,n.memoizedState=i),u.props=r,u.state=i,u.context=s,r=o):("function"==typeof u.componentDidMount&&(n.flags|=4194308),r=!1)}else{u=n.stateNode,Ra(e,n),o=n.memoizedProps,s=n.type===n.elementType?o:ga(n.type,o),u.props=s,f=n.pendingProps,d=u.context,i="object"==typeof(i=t.contextType)&&null!==i?Ca(i):Ll(n,i=Rl(t)?Tl:Nl.current);var p=t.getDerivedStateFromProps;(c="function"==typeof p||"function"==typeof u.getSnapshotBeforeUpdate)||"function"!=typeof u.UNSAFE_componentWillReceiveProps&&"function"!=typeof u.componentWillReceiveProps||(o!==f||d!==i)&&Ha(n,u,r,i),Ta=!1,d=n.memoizedState,u.state=d,Ia(n,r,u,l);var m=n.memoizedState;o!==f||d!==m||zl.current||Ta?("function"==typeof p&&(Aa(n,t,p,r),m=n.memoizedState),(s=Ta||ja(n,t,s,r,d,m,i)||!1)?(c||"function"!=typeof u.UNSAFE_componentWillUpdate&&"function"!=typeof u.componentWillUpdate||("function"==typeof u.componentWillUpdate&&u.componentWillUpdate(r,m,i),"function"==typeof u.UNSAFE_componentWillUpdate&&u.UNSAFE_componentWillUpdate(r,m,i)),"function"==typeof u.componentDidUpdate&&(n.flags|=4),"function"==typeof u.getSnapshotBeforeUpdate&&(n.flags|=1024)):("function"!=typeof u.componentDidUpdate||o===e.memoizedProps&&d===e.memoizedState||(n.flags|=4),"function"!=typeof u.getSnapshotBeforeUpdate||o===e.memoizedProps&&d===e.memoizedState||(n.flags|=1024),n.memoizedProps=r,n.memoizedState=m),u.props=r,u.state=m,u.context=i,r=s):("function"!=typeof u.componentDidUpdate||o===e.memoizedProps&&d===e.memoizedState||(n.flags|=4),"function"!=typeof u.getSnapshotBeforeUpdate||o===e.memoizedProps&&d===e.memoizedState||(n.flags|=1024),r=!1)}return zo(e,n,t,r,a,l)}function zo(e,n,t,r,l,a){_o(e,n);var u=0!=(128&n.flags);if(!r&&!u)return l&&Il(n,t,!1),Wo(e,n,a);r=n.stateNode,bo.current=n;var o=u&&"function"!=typeof t.getDerivedStateFromError?null:r.render();return n.flags|=1,null!==e&&u?(n.child=Xa(n,e.child,null,a),n.child=Xa(n,null,o,a)):wo(e,n,o,a),n.memoizedState=r.state,l&&Il(n,t,!0),n.child}function To(e){var n=e.stateNode;n.pendingContext?Fl(0,n.pendingContext,n.pendingContext!==n.context):n.context&&Fl(0,n.context,!1),ru(e,n.containerInfo)}function Lo(e,n,t,r,l){return pa(),ma(l),n.flags|=256,wo(e,n,t,r),n.child}var Ro,Mo,Fo,Oo,Do={dehydrated:null,treeContext:null,retryLane:0};function Io(e){return{baseLanes:e,cachePool:null,transitions:null}}function Uo(e,n,t){var r,l=n.pendingProps,u=ou.current,o=!1,i=0!=(128&n.flags);if((r=i)||(r=(null===e||null!==e.memoizedState)&&0!=(2&u)),r?(o=!0,n.flags&=-129):null!==e&&null===e.memoizedState||(u|=1),_l(ou,1&u),null===e)return sa(n),null!==(e=n.memoizedState)&&null!==(e=e.dehydrated)?(0==(1&n.mode)?n.lanes=1:"$!"===e.data?n.lanes=8:n.lanes=1073741824,null):(i=l.children,e=l.fallback,o?(l=n.mode,o=n.child,i={mode:"hidden",children:i},0==(1&l)&&null!==o?(o.childLanes=0,o.pendingProps=i):o=Is(i,l,0,null),e=Ds(e,l,t,null),o.return=n,e.return=n,o.sibling=e,n.child=o,n.child.memoizedState=Io(t),n.memoizedState=Do,e):Vo(n,i));if(null!==(u=e.memoizedState)&&null!==(r=u.dehydrated))return function(e,n,t,r,l,u,o){if(t)return 256&n.flags?(n.flags&=-257,Ao(e,n,o,r=co(Error(a(422))))):null!==n.memoizedState?(n.child=e.child,n.flags|=128,null):(u=r.fallback,l=n.mode,r=Is({mode:"visible",children:r.children},l,0,null),(u=Ds(u,l,o,null)).flags|=2,r.return=n,u.return=n,r.sibling=u,n.child=r,0!=(1&n.mode)&&Xa(n,e.child,null,o),n.child.memoizedState=Io(o),n.memoizedState=Do,u);if(0==(1&n.mode))return Ao(e,n,o,null);if("$!"===l.data){if(r=l.nextSibling&&l.nextSibling.dataset)var i=r.dgst;return r=i,Ao(e,n,o,r=co(u=Error(a(419)),r,void 0))}if(i=0!=(o&e.childLanes),ko||i){if(null!==(r=Ti)){switch(o&-o){case 4:l=2;break;case 16:l=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:l=32;break;case 536870912:l=268435456;break;default:l=0}0!==(l=0!=(l&(r.suspendedLanes|o))?0:l)&&l!==u.retryLane&&(u.retryLane=l,za(e,l),rs(r,e,l,-1))}return gs(),Ao(e,n,o,r=co(Error(a(421))))}return"$?"===l.data?(n.flags|=128,n.child=e.child,n=Ns.bind(null,e),l._reactRetry=n,null):(e=u.treeContext,ra=sl(l.nextSibling),ta=n,la=!0,aa=null,null!==e&&(ql[Kl++]=Xl,ql[Kl++]=Gl,ql[Kl++]=Yl,Xl=e.id,Gl=e.overflow,Yl=n),(n=Vo(n,r.children)).flags|=4096,n)}(e,n,i,l,r,u,t);if(o){o=l.fallback,i=n.mode,r=(u=e.child).sibling;var s={mode:"hidden",children:l.children};return 0==(1&i)&&n.child!==u?((l=n.child).childLanes=0,l.pendingProps=s,n.deletions=null):(l=Fs(u,s)).subtreeFlags=14680064&u.subtreeFlags,null!==r?o=Fs(r,o):(o=Ds(o,i,t,null)).flags|=2,o.return=n,l.return=n,l.sibling=o,n.child=l,l=o,o=n.child,i=null===(i=e.child.memoizedState)?Io(t):{baseLanes:i.baseLanes|t,cachePool:null,transitions:i.transitions},o.memoizedState=i,o.childLanes=e.childLanes&~t,n.memoizedState=Do,l}return e=(o=e.child).sibling,l=Fs(o,{mode:"visible",children:l.children}),0==(1&n.mode)&&(l.lanes=t),l.return=n,l.sibling=null,null!==e&&(null===(t=n.deletions)?(n.deletions=[e],n.flags|=16):t.push(e)),n.child=l,n.memoizedState=null,l}function Vo(e,n){return(n=Is({mode:"visible",children:n},e.mode,0,null)).return=e,e.child=n}function Ao(e,n,t,r){return null!==r&&ma(r),Xa(n,e.child,null,t),(e=Vo(n,n.pendingProps.children)).flags|=2,n.memoizedState=null,e}function $o(e,n,t){e.lanes|=n;var r=e.alternate;null!==r&&(r.lanes|=n),xa(e.return,n,t)}function jo(e,n,t,r,l){var a=e.memoizedState;null===a?e.memoizedState={isBackwards:n,rendering:null,renderingStartTime:0,last:r,tail:t,tailMode:l}:(a.isBackwards=n,a.rendering=null,a.renderingStartTime=0,a.last=r,a.tail=t,a.tailMode=l)}function Bo(e,n,t){var r=n.pendingProps,l=r.revealOrder,a=r.tail;if(wo(e,n,r.children,t),0!=(2&(r=ou.current)))r=1&r|2,n.flags|=128;else{if(null!==e&&0!=(128&e.flags))e:for(e=n.child;null!==e;){if(13===e.tag)null!==e.memoizedState&&$o(e,t,n);else if(19===e.tag)$o(e,t,n);else if(null!==e.child){e.child.return=e,e=e.child;continue}if(e===n)break e;for(;null===e.sibling;){if(null===e.return||e.return===n)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}r&=1}if(_l(ou,r),0==(1&n.mode))n.memoizedState=null;else switch(l){case"forwards":for(t=n.child,l=null;null!==t;)null!==(e=t.alternate)&&null===iu(e)&&(l=t),t=t.sibling;null===(t=l)?(l=n.child,n.child=null):(l=t.sibling,t.sibling=null),jo(n,!1,l,t,a);break;case"backwards":for(t=null,l=n.child,n.child=null;null!==l;){if(null!==(e=l.alternate)&&null===iu(e)){n.child=l;break}e=l.sibling,l.sibling=t,t=l,l=e}jo(n,!0,t,null,a);break;case"together":jo(n,!1,null,null,void 0);break;default:n.memoizedState=null}return n.child}function Ho(e,n){0==(1&n.mode)&&null!==e&&(e.alternate=null,n.alternate=null,n.flags|=2)}function Wo(e,n,t){if(null!==e&&(n.dependencies=e.dependencies),Ii|=n.lanes,0==(t&n.childLanes))return null;if(null!==e&&n.child!==e.child)throw Error(a(153));if(null!==n.child){for(t=Fs(e=n.child,e.pendingProps),n.child=t,t.return=n;null!==e.sibling;)e=e.sibling,(t=t.sibling=Fs(e,e.pendingProps)).return=n;t.sibling=null}return n.child}function Qo(e,n){if(!la)switch(e.tailMode){case"hidden":n=e.tail;for(var t=null;null!==n;)null!==n.alternate&&(t=n),n=n.sibling;null===t?e.tail=null:t.sibling=null;break;case"collapsed":t=e.tail;for(var r=null;null!==t;)null!==t.alternate&&(r=t),t=t.sibling;null===r?n||null===e.tail?e.tail=null:e.tail.sibling=null:r.sibling=null}}function qo(e){var n=null!==e.alternate&&e.alternate.child===e.child,t=0,r=0;if(n)for(var l=e.child;null!==l;)t|=l.lanes|l.childLanes,r|=14680064&l.subtreeFlags,r|=14680064&l.flags,l.return=e,l=l.sibling;else for(l=e.child;null!==l;)t|=l.lanes|l.childLanes,r|=l.subtreeFlags,r|=l.flags,l.return=e,l=l.sibling;return e.subtreeFlags|=r,e.childLanes=t,n}function Ko(e,n,t){var r=n.pendingProps;switch(na(n),n.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return qo(n),null;case 1:case 17:return Rl(n.type)&&Ml(),qo(n),null;case 3:return r=n.stateNode,lu(),Cl(zl),Cl(Nl),cu(),r.pendingContext&&(r.context=r.pendingContext,r.pendingContext=null),null!==e&&null!==e.child||(fa(n)?n.flags|=4:null===e||e.memoizedState.isDehydrated&&0==(256&n.flags)||(n.flags|=1024,null!==aa&&(os(aa),aa=null))),Mo(e,n),qo(n),null;case 5:uu(n);var l=tu(nu.current);if(t=n.type,null!==e&&null!=n.stateNode)Fo(e,n,t,r,l),e.ref!==n.ref&&(n.flags|=512,n.flags|=2097152);else{if(!r){if(null===n.stateNode)throw Error(a(166));return qo(n),null}if(e=tu(Ja.current),fa(n)){r=n.stateNode,t=n.type;var u=n.memoizedProps;switch(r[dl]=n,r[pl]=u,e=0!=(1&n.mode),t){case"dialog":Vr("cancel",r),Vr("close",r);break;case"iframe":case"object":case"embed":Vr("load",r);break;case"video":case"audio":for(l=0;l<Or.length;l++)Vr(Or[l],r);break;case"source":Vr("error",r);break;case"img":case"image":case"link":Vr("error",r),Vr("load",r);break;case"details":Vr("toggle",r);break;case"input":X(r,u),Vr("invalid",r);break;case"select":r._wrapperState={wasMultiple:!!u.multiple},Vr("invalid",r);break;case"textarea":le(r,u),Vr("invalid",r)}for(var i in ye(t,u),l=null,u)if(u.hasOwnProperty(i)){var s=u[i];"children"===i?"string"==typeof s?r.textContent!==s&&(!0!==u.suppressHydrationWarning&&Zr(r.textContent,s,e),l=["children",s]):"number"==typeof s&&r.textContent!==""+s&&(!0!==u.suppressHydrationWarning&&Zr(r.textContent,s,e),l=["children",""+s]):o.hasOwnProperty(i)&&null!=s&&"onScroll"===i&&Vr("scroll",r)}switch(t){case"input":Q(r),J(r,u,!0);break;case"textarea":Q(r),ue(r);break;case"select":case"option":break;default:"function"==typeof u.onClick&&(r.onclick=Jr)}r=l,n.updateQueue=r,null!==r&&(n.flags|=4)}else{i=9===l.nodeType?l:l.ownerDocument,"http://www.w3.org/1999/xhtml"===e&&(e=oe(t)),"http://www.w3.org/1999/xhtml"===e?"script"===t?((e=i.createElement("div")).innerHTML="<script><\/script>",e=e.removeChild(e.firstChild)):"string"==typeof r.is?e=i.createElement(t,{is:r.is}):(e=i.createElement(t),"select"===t&&(i=e,r.multiple?i.multiple=!0:r.size&&(i.size=r.size))):e=i.createElementNS(e,t),e[dl]=n,e[pl]=r,Ro(e,n,!1,!1),n.stateNode=e;e:{switch(i=be(t,r),t){case"dialog":Vr("cancel",e),Vr("close",e),l=r;break;case"iframe":case"object":case"embed":Vr("load",e),l=r;break;case"video":case"audio":for(l=0;l<Or.length;l++)Vr(Or[l],e);l=r;break;case"source":Vr("error",e),l=r;break;case"img":case"image":case"link":Vr("error",e),Vr("load",e),l=r;break;case"details":Vr("toggle",e),l=r;break;case"input":X(e,r),l=Y(e,r),Vr("invalid",e);break;case"option":default:l=r;break;case"select":e._wrapperState={wasMultiple:!!r.multiple},l=I({},r,{value:void 0}),Vr("invalid",e);break;case"textarea":le(e,r),l=re(e,r),Vr("invalid",e)}for(u in ye(t,l),s=l)if(s.hasOwnProperty(u)){var c=s[u];"style"===u?ge(e,c):"dangerouslySetInnerHTML"===u?null!=(c=c?c.__html:void 0)&&fe(e,c):"children"===u?"string"==typeof c?("textarea"!==t||""!==c)&&de(e,c):"number"==typeof c&&de(e,""+c):"suppressContentEditableWarning"!==u&&"suppressHydrationWarning"!==u&&"autoFocus"!==u&&(o.hasOwnProperty(u)?null!=c&&"onScroll"===u&&Vr("scroll",e):null!=c&&b(e,u,c,i))}switch(t){case"input":Q(e),J(e,r,!1);break;case"textarea":Q(e),ue(e);break;case"option":null!=r.value&&e.setAttribute("value",""+H(r.value));break;case"select":e.multiple=!!r.multiple,null!=(u=r.value)?te(e,!!r.multiple,u,!1):null!=r.defaultValue&&te(e,!!r.multiple,r.defaultValue,!0);break;default:"function"==typeof l.onClick&&(e.onclick=Jr)}switch(t){case"button":case"input":case"select":case"textarea":r=!!r.autoFocus;break e;case"img":r=!0;break e;default:r=!1}}r&&(n.flags|=4)}null!==n.ref&&(n.flags|=512,n.flags|=2097152)}return qo(n),null;case 6:if(e&&null!=n.stateNode)Oo(e,n,e.memoizedProps,r);else{if("string"!=typeof r&&null===n.stateNode)throw Error(a(166));if(t=tu(nu.current),tu(Ja.current),fa(n)){if(r=n.stateNode,t=n.memoizedProps,r[dl]=n,(u=r.nodeValue!==t)&&null!==(e=ta))switch(e.tag){case 3:Zr(r.nodeValue,t,0!=(1&e.mode));break;case 5:!0!==e.memoizedProps.suppressHydrationWarning&&Zr(r.nodeValue,t,0!=(1&e.mode))}u&&(n.flags|=4)}else(r=(9===t.nodeType?t:t.ownerDocument).createTextNode(r))[dl]=n,n.stateNode=r}return qo(n),null;case 13:if(Cl(ou),r=n.memoizedState,null===e||null!==e.memoizedState&&null!==e.memoizedState.dehydrated){if(la&&null!==ra&&0!=(1&n.mode)&&0==(128&n.flags))da(),pa(),n.flags|=98560,u=!1;else if(u=fa(n),null!==r&&null!==r.dehydrated){if(null===e){if(!u)throw Error(a(318));if(!(u=null!==(u=n.memoizedState)?u.dehydrated:null))throw Error(a(317));u[dl]=n}else pa(),0==(128&n.flags)&&(n.memoizedState=null),n.flags|=4;qo(n),u=!1}else null!==aa&&(os(aa),aa=null),u=!0;if(!u)return 65536&n.flags?n:null}return 0!=(128&n.flags)?(n.lanes=t,n):((r=null!==r)!=(null!==e&&null!==e.memoizedState)&&r&&(n.child.flags|=8192,0!=(1&n.mode)&&(null===e||0!=(1&ou.current)?0===Oi&&(Oi=3):gs())),null!==n.updateQueue&&(n.flags|=4),qo(n),null);case 4:return lu(),Mo(e,n),null===e&&jr(n.stateNode.containerInfo),qo(n),null;case 10:return Sa(n.type._context),qo(n),null;case 19:if(Cl(ou),null===(u=n.memoizedState))return qo(n),null;if(r=0!=(128&n.flags),null===(i=u.rendering))if(r)Qo(u,!1);else{if(0!==Oi||null!==e&&0!=(128&e.flags))for(e=n.child;null!==e;){if(null!==(i=iu(e))){for(n.flags|=128,Qo(u,!1),null!==(r=i.updateQueue)&&(n.updateQueue=r,n.flags|=4),n.subtreeFlags=0,r=t,t=n.child;null!==t;)e=r,(u=t).flags&=14680066,null===(i=u.alternate)?(u.childLanes=0,u.lanes=e,u.child=null,u.subtreeFlags=0,u.memoizedProps=null,u.memoizedState=null,u.updateQueue=null,u.dependencies=null,u.stateNode=null):(u.childLanes=i.childLanes,u.lanes=i.lanes,u.child=i.child,u.subtreeFlags=0,u.deletions=null,u.memoizedProps=i.memoizedProps,u.memoizedState=i.memoizedState,u.updateQueue=i.updateQueue,u.type=i.type,e=i.dependencies,u.dependencies=null===e?null:{lanes:e.lanes,firstContext:e.firstContext}),t=t.sibling;return _l(ou,1&ou.current|2),n.child}e=e.sibling}null!==u.tail&&Ge()>Bi&&(n.flags|=128,r=!0,Qo(u,!1),n.lanes=4194304)}else{if(!r)if(null!==(e=iu(i))){if(n.flags|=128,r=!0,null!==(t=e.updateQueue)&&(n.updateQueue=t,n.flags|=4),Qo(u,!0),null===u.tail&&"hidden"===u.tailMode&&!i.alternate&&!la)return qo(n),null}else 2*Ge()-u.renderingStartTime>Bi&&1073741824!==t&&(n.flags|=128,r=!0,Qo(u,!1),n.lanes=4194304);u.isBackwards?(i.sibling=n.child,n.child=i):(null!==(t=u.last)?t.sibling=i:n.child=i,u.last=i)}return null!==u.tail?(n=u.tail,u.rendering=n,u.tail=n.sibling,u.renderingStartTime=Ge(),n.sibling=null,t=ou.current,_l(ou,r?1&t|2:1&t),n):(qo(n),null);case 22:case 23:return ds(),r=null!==n.memoizedState,null!==e&&null!==e.memoizedState!==r&&(n.flags|=8192),r&&0!=(1&n.mode)?0!=(1073741824&Mi)&&(qo(n),6&n.subtreeFlags&&(n.flags|=8192)):qo(n),null;case 24:case 25:return null}throw Error(a(156,n.tag))}function Yo(e,n){switch(na(n),n.tag){case 1:return Rl(n.type)&&Ml(),65536&(e=n.flags)?(n.flags=-65537&e|128,n):null;case 3:return lu(),Cl(zl),Cl(Nl),cu(),0!=(65536&(e=n.flags))&&0==(128&e)?(n.flags=-65537&e|128,n):null;case 5:return uu(n),null;case 13:if(Cl(ou),null!==(e=n.memoizedState)&&null!==e.dehydrated){if(null===n.alternate)throw Error(a(340));pa()}return 65536&(e=n.flags)?(n.flags=-65537&e|128,n):null;case 19:return Cl(ou),null;case 4:return lu(),null;case 10:return Sa(n.type._context),null;case 22:case 23:return ds(),null;default:return null}}Ro=function(e,n){for(var t=n.child;null!==t;){if(5===t.tag||6===t.tag)e.appendChild(t.stateNode);else if(4!==t.tag&&null!==t.child){t.child.return=t,t=t.child;continue}if(t===n)break;for(;null===t.sibling;){if(null===t.return||t.return===n)return;t=t.return}t.sibling.return=t.return,t=t.sibling}},Mo=function(){},Fo=function(e,n,t,r){var l=e.memoizedProps;if(l!==r){e=n.stateNode,tu(Ja.current);var a,u=null;switch(t){case"input":l=Y(e,l),r=Y(e,r),u=[];break;case"select":l=I({},l,{value:void 0}),r=I({},r,{value:void 0}),u=[];break;case"textarea":l=re(e,l),r=re(e,r),u=[];break;default:"function"!=typeof l.onClick&&"function"==typeof r.onClick&&(e.onclick=Jr)}for(c in ye(t,r),t=null,l)if(!r.hasOwnProperty(c)&&l.hasOwnProperty(c)&&null!=l[c])if("style"===c){var i=l[c];for(a in i)i.hasOwnProperty(a)&&(t||(t={}),t[a]="")}else"dangerouslySetInnerHTML"!==c&&"children"!==c&&"suppressContentEditableWarning"!==c&&"suppressHydrationWarning"!==c&&"autoFocus"!==c&&(o.hasOwnProperty(c)?u||(u=[]):(u=u||[]).push(c,null));for(c in r){var s=r[c];if(i=null!=l?l[c]:void 0,r.hasOwnProperty(c)&&s!==i&&(null!=s||null!=i))if("style"===c)if(i){for(a in i)!i.hasOwnProperty(a)||s&&s.hasOwnProperty(a)||(t||(t={}),t[a]="");for(a in s)s.hasOwnProperty(a)&&i[a]!==s[a]&&(t||(t={}),t[a]=s[a])}else t||(u||(u=[]),u.push(c,t)),t=s;else"dangerouslySetInnerHTML"===c?(s=s?s.__html:void 0,i=i?i.__html:void 0,null!=s&&i!==s&&(u=u||[]).push(c,s)):"children"===c?"string"!=typeof s&&"number"!=typeof s||(u=u||[]).push(c,""+s):"suppressContentEditableWarning"!==c&&"suppressHydrationWarning"!==c&&(o.hasOwnProperty(c)?(null!=s&&"onScroll"===c&&Vr("scroll",e),u||i===s||(u=[])):(u=u||[]).push(c,s))}t&&(u=u||[]).push("style",t);var c=u;(n.updateQueue=c)&&(n.flags|=4)}},Oo=function(e,n,t,r){t!==r&&(n.flags|=4)};var Xo=!1,Go=!1,Zo="function"==typeof WeakSet?WeakSet:Set,Jo=null;function ei(e,n){var t=e.ref;if(null!==t)if("function"==typeof t)try{t(null)}catch(t){Cs(e,n,t)}else t.current=null}function ni(e,n,t){try{t()}catch(t){Cs(e,n,t)}}var ti=!1;function ri(e,n,t){var r=n.updateQueue;if(null!==(r=null!==r?r.lastEffect:null)){var l=r=r.next;do{if((l.tag&e)===e){var a=l.destroy;l.destroy=void 0,void 0!==a&&ni(n,t,a)}l=l.next}while(l!==r)}}function li(e,n){if(null!==(n=null!==(n=n.updateQueue)?n.lastEffect:null)){var t=n=n.next;do{if((t.tag&e)===e){var r=t.create;t.destroy=r()}t=t.next}while(t!==n)}}function ai(e){var n=e.ref;if(null!==n){var t=e.stateNode;e.tag,e=t,"function"==typeof n?n(e):n.current=e}}function ui(e){var n=e.alternate;null!==n&&(e.alternate=null,ui(n)),e.child=null,e.deletions=null,e.sibling=null,5===e.tag&&null!==(n=e.stateNode)&&(delete n[dl],delete n[pl],delete n[hl],delete n[gl],delete n[vl]),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}function oi(e){return 5===e.tag||3===e.tag||4===e.tag}function ii(e){e:for(;;){for(;null===e.sibling;){if(null===e.return||oi(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;5!==e.tag&&6!==e.tag&&18!==e.tag;){if(2&e.flags)continue e;if(null===e.child||4===e.tag)continue e;e.child.return=e,e=e.child}if(!(2&e.flags))return e.stateNode}}function si(e,n,t){var r=e.tag;if(5===r||6===r)e=e.stateNode,n?8===t.nodeType?t.parentNode.insertBefore(e,n):t.insertBefore(e,n):(8===t.nodeType?(n=t.parentNode).insertBefore(e,t):(n=t).appendChild(e),null!=(t=t._reactRootContainer)||null!==n.onclick||(n.onclick=Jr));else if(4!==r&&null!==(e=e.child))for(si(e,n,t),e=e.sibling;null!==e;)si(e,n,t),e=e.sibling}function ci(e,n,t){var r=e.tag;if(5===r||6===r)e=e.stateNode,n?t.insertBefore(e,n):t.appendChild(e);else if(4!==r&&null!==(e=e.child))for(ci(e,n,t),e=e.sibling;null!==e;)ci(e,n,t),e=e.sibling}var fi=null,di=!1;function pi(e,n,t){for(t=t.child;null!==t;)mi(e,n,t),t=t.sibling}function mi(e,n,t){if(an&&"function"==typeof an.onCommitFiberUnmount)try{an.onCommitFiberUnmount(ln,t)}catch(e){}switch(t.tag){case 5:Go||ei(t,n);case 6:var r=fi,l=di;fi=null,pi(e,n,t),di=l,null!==(fi=r)&&(di?(e=fi,t=t.stateNode,8===e.nodeType?e.parentNode.removeChild(t):e.removeChild(t)):fi.removeChild(t.stateNode));break;case 18:null!==fi&&(di?(e=fi,t=t.stateNode,8===e.nodeType?il(e.parentNode,t):1===e.nodeType&&il(e,t),Bn(e)):il(fi,t.stateNode));break;case 4:r=fi,l=di,fi=t.stateNode.containerInfo,di=!0,pi(e,n,t),fi=r,di=l;break;case 0:case 11:case 14:case 15:if(!Go&&null!==(r=t.updateQueue)&&null!==(r=r.lastEffect)){l=r=r.next;do{var a=l,u=a.destroy;a=a.tag,void 0!==u&&(0!=(2&a)||0!=(4&a))&&ni(t,n,u),l=l.next}while(l!==r)}pi(e,n,t);break;case 1:if(!Go&&(ei(t,n),"function"==typeof(r=t.stateNode).componentWillUnmount))try{r.props=t.memoizedProps,r.state=t.memoizedState,r.componentWillUnmount()}catch(e){Cs(t,n,e)}pi(e,n,t);break;case 21:pi(e,n,t);break;case 22:1&t.mode?(Go=(r=Go)||null!==t.memoizedState,pi(e,n,t),Go=r):pi(e,n,t);break;default:pi(e,n,t)}}function hi(e){var n=e.updateQueue;if(null!==n){e.updateQueue=null;var t=e.stateNode;null===t&&(t=e.stateNode=new Zo),n.forEach((function(n){var r=zs.bind(null,e,n);t.has(n)||(t.add(n),n.then(r,r))}))}}function gi(e,n){var t=n.deletions;if(null!==t)for(var r=0;r<t.length;r++){var l=t[r];try{var u=e,o=n,i=o;e:for(;null!==i;){switch(i.tag){case 5:fi=i.stateNode,di=!1;break e;case 3:case 4:fi=i.stateNode.containerInfo,di=!0;break e}i=i.return}if(null===fi)throw Error(a(160));mi(u,o,l),fi=null,di=!1;var s=l.alternate;null!==s&&(s.return=null),l.return=null}catch(e){Cs(l,n,e)}}if(12854&n.subtreeFlags)for(n=n.child;null!==n;)vi(n,e),n=n.sibling}function vi(e,n){var t=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:if(gi(n,e),yi(e),4&r){try{ri(3,e,e.return),li(3,e)}catch(n){Cs(e,e.return,n)}try{ri(5,e,e.return)}catch(n){Cs(e,e.return,n)}}break;case 1:gi(n,e),yi(e),512&r&&null!==t&&ei(t,t.return);break;case 5:if(gi(n,e),yi(e),512&r&&null!==t&&ei(t,t.return),32&e.flags){var l=e.stateNode;try{de(l,"")}catch(n){Cs(e,e.return,n)}}if(4&r&&null!=(l=e.stateNode)){var u=e.memoizedProps,o=null!==t?t.memoizedProps:u,i=e.type,s=e.updateQueue;if(e.updateQueue=null,null!==s)try{"input"===i&&"radio"===u.type&&null!=u.name&&G(l,u),be(i,o);var c=be(i,u);for(o=0;o<s.length;o+=2){var f=s[o],d=s[o+1];"style"===f?ge(l,d):"dangerouslySetInnerHTML"===f?fe(l,d):"children"===f?de(l,d):b(l,f,d,c)}switch(i){case"input":Z(l,u);break;case"textarea":ae(l,u);break;case"select":var p=l._wrapperState.wasMultiple;l._wrapperState.wasMultiple=!!u.multiple;var m=u.value;null!=m?te(l,!!u.multiple,m,!1):p!==!!u.multiple&&(null!=u.defaultValue?te(l,!!u.multiple,u.defaultValue,!0):te(l,!!u.multiple,u.multiple?[]:"",!1))}l[pl]=u}catch(n){Cs(e,e.return,n)}}break;case 6:if(gi(n,e),yi(e),4&r){if(null===e.stateNode)throw Error(a(162));l=e.stateNode,u=e.memoizedProps;try{l.nodeValue=u}catch(n){Cs(e,e.return,n)}}break;case 3:if(gi(n,e),yi(e),4&r&&null!==t&&t.memoizedState.isDehydrated)try{Bn(n.containerInfo)}catch(n){Cs(e,e.return,n)}break;case 4:default:gi(n,e),yi(e);break;case 13:gi(n,e),yi(e),8192&(l=e.child).flags&&(u=null!==l.memoizedState,l.stateNode.isHidden=u,!u||null!==l.alternate&&null!==l.alternate.memoizedState||(ji=Ge())),4&r&&hi(e);break;case 22:if(f=null!==t&&null!==t.memoizedState,1&e.mode?(Go=(c=Go)||f,gi(n,e),Go=c):gi(n,e),yi(e),8192&r){if(c=null!==e.memoizedState,(e.stateNode.isHidden=c)&&!f&&0!=(1&e.mode))for(Jo=e,f=e.child;null!==f;){for(d=Jo=f;null!==Jo;){switch(m=(p=Jo).child,p.tag){case 0:case 11:case 14:case 15:ri(4,p,p.return);break;case 1:ei(p,p.return);var h=p.stateNode;if("function"==typeof h.componentWillUnmount){r=p,t=p.return;try{n=r,h.props=n.memoizedProps,h.state=n.memoizedState,h.componentWillUnmount()}catch(e){Cs(r,t,e)}}break;case 5:ei(p,p.return);break;case 22:if(null!==p.memoizedState){Si(d);continue}}null!==m?(m.return=p,Jo=m):Si(d)}f=f.sibling}e:for(f=null,d=e;;){if(5===d.tag){if(null===f){f=d;try{l=d.stateNode,c?"function"==typeof(u=l.style).setProperty?u.setProperty("display","none","important"):u.display="none":(i=d.stateNode,o=null!=(s=d.memoizedProps.style)&&s.hasOwnProperty("display")?s.display:null,i.style.display=he("display",o))}catch(n){Cs(e,e.return,n)}}}else if(6===d.tag){if(null===f)try{d.stateNode.nodeValue=c?"":d.memoizedProps}catch(n){Cs(e,e.return,n)}}else if((22!==d.tag&&23!==d.tag||null===d.memoizedState||d===e)&&null!==d.child){d.child.return=d,d=d.child;continue}if(d===e)break e;for(;null===d.sibling;){if(null===d.return||d.return===e)break e;f===d&&(f=null),d=d.return}f===d&&(f=null),d.sibling.return=d.return,d=d.sibling}}break;case 19:gi(n,e),yi(e),4&r&&hi(e);case 21:}}function yi(e){var n=e.flags;if(2&n){try{e:{for(var t=e.return;null!==t;){if(oi(t)){var r=t;break e}t=t.return}throw Error(a(160))}switch(r.tag){case 5:var l=r.stateNode;32&r.flags&&(de(l,""),r.flags&=-33),ci(e,ii(e),l);break;case 3:case 4:var u=r.stateNode.containerInfo;si(e,ii(e),u);break;default:throw Error(a(161))}}catch(n){Cs(e,e.return,n)}e.flags&=-3}4096&n&&(e.flags&=-4097)}function bi(e,n,t){Jo=e,ki(e,n,t)}function ki(e,n,t){for(var r=0!=(1&e.mode);null!==Jo;){var l=Jo,a=l.child;if(22===l.tag&&r){var u=null!==l.memoizedState||Xo;if(!u){var o=l.alternate,i=null!==o&&null!==o.memoizedState||Go;o=Xo;var s=Go;if(Xo=u,(Go=i)&&!s)for(Jo=l;null!==Jo;)i=(u=Jo).child,22===u.tag&&null!==u.memoizedState?xi(l):null!==i?(i.return=u,Jo=i):xi(l);for(;null!==a;)Jo=a,ki(a,n,t),a=a.sibling;Jo=l,Xo=o,Go=s}wi(e)}else 0!=(8772&l.subtreeFlags)&&null!==a?(a.return=l,Jo=a):wi(e)}}function wi(e){for(;null!==Jo;){var n=Jo;if(0!=(8772&n.flags)){var t=n.alternate;try{if(0!=(8772&n.flags))switch(n.tag){case 0:case 11:case 15:Go||li(5,n);break;case 1:var r=n.stateNode;if(4&n.flags&&!Go)if(null===t)r.componentDidMount();else{var l=n.elementType===n.type?t.memoizedProps:ga(n.type,t.memoizedProps);r.componentDidUpdate(l,t.memoizedState,r.__reactInternalSnapshotBeforeUpdate)}var u=n.updateQueue;null!==u&&Ua(n,u,r);break;case 3:var o=n.updateQueue;if(null!==o){if(t=null,null!==n.child)switch(n.child.tag){case 5:case 1:t=n.child.stateNode}Ua(n,o,t)}break;case 5:var i=n.stateNode;if(null===t&&4&n.flags){t=i;var s=n.memoizedProps;switch(n.type){case"button":case"input":case"select":case"textarea":s.autoFocus&&t.focus();break;case"img":s.src&&(t.src=s.src)}}break;case 6:case 4:case 12:case 19:case 17:case 21:case 22:case 23:case 25:break;case 13:if(null===n.memoizedState){var c=n.alternate;if(null!==c){var f=c.memoizedState;if(null!==f){var d=f.dehydrated;null!==d&&Bn(d)}}}break;default:throw Error(a(163))}Go||512&n.flags&&ai(n)}catch(e){Cs(n,n.return,e)}}if(n===e){Jo=null;break}if(null!==(t=n.sibling)){t.return=n.return,Jo=t;break}Jo=n.return}}function Si(e){for(;null!==Jo;){var n=Jo;if(n===e){Jo=null;break}var t=n.sibling;if(null!==t){t.return=n.return,Jo=t;break}Jo=n.return}}function xi(e){for(;null!==Jo;){var n=Jo;try{switch(n.tag){case 0:case 11:case 15:var t=n.return;try{li(4,n)}catch(e){Cs(n,t,e)}break;case 1:var r=n.stateNode;if("function"==typeof r.componentDidMount){var l=n.return;try{r.componentDidMount()}catch(e){Cs(n,l,e)}}var a=n.return;try{ai(n)}catch(e){Cs(n,a,e)}break;case 5:var u=n.return;try{ai(n)}catch(e){Cs(n,u,e)}}}catch(e){Cs(n,n.return,e)}if(n===e){Jo=null;break}var o=n.sibling;if(null!==o){o.return=n.return,Jo=o;break}Jo=n.return}}var Ei,Ci=Math.ceil,_i=k.ReactCurrentDispatcher,Pi=k.ReactCurrentOwner,Ni=k.ReactCurrentBatchConfig,zi=0,Ti=null,Li=null,Ri=0,Mi=0,Fi=El(0),Oi=0,Di=null,Ii=0,Ui=0,Vi=0,Ai=null,$i=null,ji=0,Bi=1/0,Hi=null,Wi=!1,Qi=null,qi=null,Ki=!1,Yi=null,Xi=0,Gi=0,Zi=null,Ji=-1,es=0;function ns(){return 0!=(6&zi)?Ge():-1!==Ji?Ji:Ji=Ge()}function ts(e){return 0==(1&e.mode)?1:0!=(2&zi)&&0!==Ri?Ri&-Ri:null!==ha.transition?(0===es&&(es=gn()),es):0!==(e=kn)?e:e=void 0===(e=window.event)?16:Gn(e.type)}function rs(e,n,t,r){if(50<Gi)throw Gi=0,Zi=null,Error(a(185));yn(e,t,r),0!=(2&zi)&&e===Ti||(e===Ti&&(0==(2&zi)&&(Ui|=t),4===Oi&&is(e,Ri)),ls(e,r),1===t&&0===zi&&0==(1&n.mode)&&(Bi=Ge()+500,Vl&&jl()))}function ls(e,n){var t=e.callbackNode;!function(e,n){for(var t=e.suspendedLanes,r=e.pingedLanes,l=e.expirationTimes,a=e.pendingLanes;0<a;){var u=31-un(a),o=1<<u,i=l[u];-1===i?0!=(o&t)&&0==(o&r)||(l[u]=mn(o,n)):i<=n&&(e.expiredLanes|=o),a&=~o}}(e,n);var r=pn(e,e===Ti?Ri:0);if(0===r)null!==t&&Ke(t),e.callbackNode=null,e.callbackPriority=0;else if(n=r&-r,e.callbackPriority!==n){if(null!=t&&Ke(t),1===n)0===e.tag?function(e){Vl=!0,$l(e)}(ss.bind(null,e)):$l(ss.bind(null,e)),ul((function(){0==(6&zi)&&jl()})),t=null;else{switch(wn(r)){case 1:t=Je;break;case 4:t=en;break;case 16:default:t=nn;break;case 536870912:t=rn}t=Ts(t,as.bind(null,e))}e.callbackPriority=n,e.callbackNode=t}}function as(e,n){if(Ji=-1,es=0,0!=(6&zi))throw Error(a(327));var t=e.callbackNode;if(xs()&&e.callbackNode!==t)return null;var r=pn(e,e===Ti?Ri:0);if(0===r)return null;if(0!=(30&r)||0!=(r&e.expiredLanes)||n)n=vs(e,r);else{n=r;var l=zi;zi|=2;var u=hs();for(Ti===e&&Ri===n||(Hi=null,Bi=Ge()+500,ps(e,n));;)try{bs();break}catch(n){ms(e,n)}wa(),_i.current=u,zi=l,null!==Li?n=0:(Ti=null,Ri=0,n=Oi)}if(0!==n){if(2===n&&0!==(l=hn(e))&&(r=l,n=us(e,l)),1===n)throw t=Di,ps(e,0),is(e,r),ls(e,Ge()),t;if(6===n)is(e,r);else{if(l=e.current.alternate,0==(30&r)&&!function(e){for(var n=e;;){if(16384&n.flags){var t=n.updateQueue;if(null!==t&&null!==(t=t.stores))for(var r=0;r<t.length;r++){var l=t[r],a=l.getSnapshot;l=l.value;try{if(!or(a(),l))return!1}catch(e){return!1}}}if(t=n.child,16384&n.subtreeFlags&&null!==t)t.return=n,n=t;else{if(n===e)break;for(;null===n.sibling;){if(null===n.return||n.return===e)return!0;n=n.return}n.sibling.return=n.return,n=n.sibling}}return!0}(l)&&(2===(n=vs(e,r))&&0!==(u=hn(e))&&(r=u,n=us(e,u)),1===n))throw t=Di,ps(e,0),is(e,r),ls(e,Ge()),t;switch(e.finishedWork=l,e.finishedLanes=r,n){case 0:case 1:throw Error(a(345));case 2:case 5:Ss(e,$i,Hi);break;case 3:if(is(e,r),(130023424&r)===r&&10<(n=ji+500-Ge())){if(0!==pn(e,0))break;if(((l=e.suspendedLanes)&r)!==r){ns(),e.pingedLanes|=e.suspendedLanes&l;break}e.timeoutHandle=rl(Ss.bind(null,e,$i,Hi),n);break}Ss(e,$i,Hi);break;case 4:if(is(e,r),(4194240&r)===r)break;for(n=e.eventTimes,l=-1;0<r;){var o=31-un(r);u=1<<o,(o=n[o])>l&&(l=o),r&=~u}if(r=l,10<(r=(120>(r=Ge()-r)?120:480>r?480:1080>r?1080:1920>r?1920:3e3>r?3e3:4320>r?4320:1960*Ci(r/1960))-r)){e.timeoutHandle=rl(Ss.bind(null,e,$i,Hi),r);break}Ss(e,$i,Hi);break;default:throw Error(a(329))}}}return ls(e,Ge()),e.callbackNode===t?as.bind(null,e):null}function us(e,n){var t=Ai;return e.current.memoizedState.isDehydrated&&(ps(e,n).flags|=256),2!==(e=vs(e,n))&&(n=$i,$i=t,null!==n&&os(n)),e}function os(e){null===$i?$i=e:$i.push.apply($i,e)}function is(e,n){for(n&=~Vi,n&=~Ui,e.suspendedLanes|=n,e.pingedLanes&=~n,e=e.expirationTimes;0<n;){var t=31-un(n),r=1<<t;e[t]=-1,n&=~r}}function ss(e){if(0!=(6&zi))throw Error(a(327));xs();var n=pn(e,0);if(0==(1&n))return ls(e,Ge()),null;var t=vs(e,n);if(0!==e.tag&&2===t){var r=hn(e);0!==r&&(n=r,t=us(e,r))}if(1===t)throw t=Di,ps(e,0),is(e,n),ls(e,Ge()),t;if(6===t)throw Error(a(345));return e.finishedWork=e.current.alternate,e.finishedLanes=n,Ss(e,$i,Hi),ls(e,Ge()),null}function cs(e,n){var t=zi;zi|=1;try{return e(n)}finally{0===(zi=t)&&(Bi=Ge()+500,Vl&&jl())}}function fs(e){null!==Yi&&0===Yi.tag&&0==(6&zi)&&xs();var n=zi;zi|=1;var t=Ni.transition,r=kn;try{if(Ni.transition=null,kn=1,e)return e()}finally{kn=r,Ni.transition=t,0==(6&(zi=n))&&jl()}}function ds(){Mi=Fi.current,Cl(Fi)}function ps(e,n){e.finishedWork=null,e.finishedLanes=0;var t=e.timeoutHandle;if(-1!==t&&(e.timeoutHandle=-1,ll(t)),null!==Li)for(t=Li.return;null!==t;){var r=t;switch(na(r),r.tag){case 1:null!=(r=r.type.childContextTypes)&&Ml();break;case 3:lu(),Cl(zl),Cl(Nl),cu();break;case 5:uu(r);break;case 4:lu();break;case 13:case 19:Cl(ou);break;case 10:Sa(r.type._context);break;case 22:case 23:ds()}t=t.return}if(Ti=e,Li=e=Fs(e.current,null),Ri=Mi=n,Oi=0,Di=null,Vi=Ui=Ii=0,$i=Ai=null,null!==_a){for(n=0;n<_a.length;n++)if(null!==(r=(t=_a[n]).interleaved)){t.interleaved=null;var l=r.next,a=t.pending;if(null!==a){var u=a.next;a.next=l,r.next=u}t.pending=r}_a=null}return e}function ms(e,n){for(;;){var t=Li;try{if(wa(),fu.current=ao,vu){for(var r=mu.memoizedState;null!==r;){var l=r.queue;null!==l&&(l.pending=null),r=r.next}vu=!1}if(pu=0,gu=hu=mu=null,yu=!1,bu=0,Pi.current=null,null===t||null===t.return){Oi=1,Di=n,Li=null;break}e:{var u=e,o=t.return,i=t,s=n;if(n=Ri,i.flags|=32768,null!==s&&"object"==typeof s&&"function"==typeof s.then){var c=s,f=i,d=f.tag;if(0==(1&f.mode)&&(0===d||11===d||15===d)){var p=f.alternate;p?(f.updateQueue=p.updateQueue,f.memoizedState=p.memoizedState,f.lanes=p.lanes):(f.updateQueue=null,f.memoizedState=null)}var m=vo(o);if(null!==m){m.flags&=-257,yo(m,o,i,0,n),1&m.mode&&go(u,c,n),s=c;var h=(n=m).updateQueue;if(null===h){var g=new Set;g.add(s),n.updateQueue=g}else h.add(s);break e}if(0==(1&n)){go(u,c,n),gs();break e}s=Error(a(426))}else if(la&&1&i.mode){var v=vo(o);if(null!==v){0==(65536&v.flags)&&(v.flags|=256),yo(v,o,i,0,n),ma(so(s,i));break e}}u=s=so(s,i),4!==Oi&&(Oi=2),null===Ai?Ai=[u]:Ai.push(u),u=o;do{switch(u.tag){case 3:u.flags|=65536,n&=-n,u.lanes|=n,Da(u,mo(0,s,n));break e;case 1:i=s;var y=u.type,b=u.stateNode;if(0==(128&u.flags)&&("function"==typeof y.getDerivedStateFromError||null!==b&&"function"==typeof b.componentDidCatch&&(null===qi||!qi.has(b)))){u.flags|=65536,n&=-n,u.lanes|=n,Da(u,ho(u,i,n));break e}}u=u.return}while(null!==u)}ws(t)}catch(e){n=e,Li===t&&null!==t&&(Li=t=t.return);continue}break}}function hs(){var e=_i.current;return _i.current=ao,null===e?ao:e}function gs(){0!==Oi&&3!==Oi&&2!==Oi||(Oi=4),null===Ti||0==(268435455&Ii)&&0==(268435455&Ui)||is(Ti,Ri)}function vs(e,n){var t=zi;zi|=2;var r=hs();for(Ti===e&&Ri===n||(Hi=null,ps(e,n));;)try{ys();break}catch(n){ms(e,n)}if(wa(),zi=t,_i.current=r,null!==Li)throw Error(a(261));return Ti=null,Ri=0,Oi}function ys(){for(;null!==Li;)ks(Li)}function bs(){for(;null!==Li&&!Ye();)ks(Li)}function ks(e){var n=Ei(e.alternate,e,Mi);e.memoizedProps=e.pendingProps,null===n?ws(e):Li=n,Pi.current=null}function ws(e){var n=e;do{var t=n.alternate;if(e=n.return,0==(32768&n.flags)){if(null!==(t=Ko(t,n,Mi)))return void(Li=t)}else{if(null!==(t=Yo(t,n)))return t.flags&=32767,void(Li=t);if(null===e)return Oi=6,void(Li=null);e.flags|=32768,e.subtreeFlags=0,e.deletions=null}if(null!==(n=n.sibling))return void(Li=n);Li=n=e}while(null!==n);0===Oi&&(Oi=5)}function Ss(e,n,t){var r=kn,l=Ni.transition;try{Ni.transition=null,kn=1,function(e,n,t,r){do{xs()}while(null!==Yi);if(0!=(6&zi))throw Error(a(327));t=e.finishedWork;var l=e.finishedLanes;if(null===t)return null;if(e.finishedWork=null,e.finishedLanes=0,t===e.current)throw Error(a(177));e.callbackNode=null,e.callbackPriority=0;var u=t.lanes|t.childLanes;if(function(e,n){var t=e.pendingLanes&~n;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.expiredLanes&=n,e.mutableReadLanes&=n,e.entangledLanes&=n,n=e.entanglements;var r=e.eventTimes;for(e=e.expirationTimes;0<t;){var l=31-un(t),a=1<<l;n[l]=0,r[l]=-1,e[l]=-1,t&=~a}}(e,u),e===Ti&&(Li=Ti=null,Ri=0),0==(2064&t.subtreeFlags)&&0==(2064&t.flags)||Ki||(Ki=!0,Ts(nn,(function(){return xs(),null}))),u=0!=(15990&t.flags),0!=(15990&t.subtreeFlags)||u){u=Ni.transition,Ni.transition=null;var o=kn;kn=1;var i=zi;zi|=4,Pi.current=null,function(e,n){if(el=Wn,pr(e=dr())){if("selectionStart"in e)var t={start:e.selectionStart,end:e.selectionEnd};else e:{var r=(t=(t=e.ownerDocument)&&t.defaultView||window).getSelection&&t.getSelection();if(r&&0!==r.rangeCount){t=r.anchorNode;var l=r.anchorOffset,u=r.focusNode;r=r.focusOffset;try{t.nodeType,u.nodeType}catch(e){t=null;break e}var o=0,i=-1,s=-1,c=0,f=0,d=e,p=null;n:for(;;){for(var m;d!==t||0!==l&&3!==d.nodeType||(i=o+l),d!==u||0!==r&&3!==d.nodeType||(s=o+r),3===d.nodeType&&(o+=d.nodeValue.length),null!==(m=d.firstChild);)p=d,d=m;for(;;){if(d===e)break n;if(p===t&&++c===l&&(i=o),p===u&&++f===r&&(s=o),null!==(m=d.nextSibling))break;p=(d=p).parentNode}d=m}t=-1===i||-1===s?null:{start:i,end:s}}else t=null}t=t||{start:0,end:0}}else t=null;for(nl={focusedElem:e,selectionRange:t},Wn=!1,Jo=n;null!==Jo;)if(e=(n=Jo).child,0!=(1028&n.subtreeFlags)&&null!==e)e.return=n,Jo=e;else for(;null!==Jo;){n=Jo;try{var h=n.alternate;if(0!=(1024&n.flags))switch(n.tag){case 0:case 11:case 15:case 5:case 6:case 4:case 17:break;case 1:if(null!==h){var g=h.memoizedProps,v=h.memoizedState,y=n.stateNode,b=y.getSnapshotBeforeUpdate(n.elementType===n.type?g:ga(n.type,g),v);y.__reactInternalSnapshotBeforeUpdate=b}break;case 3:var k=n.stateNode.containerInfo;1===k.nodeType?k.textContent="":9===k.nodeType&&k.documentElement&&k.removeChild(k.documentElement);break;default:throw Error(a(163))}}catch(e){Cs(n,n.return,e)}if(null!==(e=n.sibling)){e.return=n.return,Jo=e;break}Jo=n.return}h=ti,ti=!1}(e,t),vi(t,e),mr(nl),Wn=!!el,nl=el=null,e.current=t,bi(t,e,l),Xe(),zi=i,kn=o,Ni.transition=u}else e.current=t;if(Ki&&(Ki=!1,Yi=e,Xi=l),0===(u=e.pendingLanes)&&(qi=null),function(e){if(an&&"function"==typeof an.onCommitFiberRoot)try{an.onCommitFiberRoot(ln,e,void 0,128==(128&e.current.flags))}catch(e){}}(t.stateNode),ls(e,Ge()),null!==n)for(r=e.onRecoverableError,t=0;t<n.length;t++)r((l=n[t]).value,{componentStack:l.stack,digest:l.digest});if(Wi)throw Wi=!1,e=Qi,Qi=null,e;0!=(1&Xi)&&0!==e.tag&&xs(),0!=(1&(u=e.pendingLanes))?e===Zi?Gi++:(Gi=0,Zi=e):Gi=0,jl()}(e,n,t,r)}finally{Ni.transition=l,kn=r}return null}function xs(){if(null!==Yi){var e=wn(Xi),n=Ni.transition,t=kn;try{if(Ni.transition=null,kn=16>e?16:e,null===Yi)var r=!1;else{if(e=Yi,Yi=null,Xi=0,0!=(6&zi))throw Error(a(331));var l=zi;for(zi|=4,Jo=e.current;null!==Jo;){var u=Jo,o=u.child;if(0!=(16&Jo.flags)){var i=u.deletions;if(null!==i){for(var s=0;s<i.length;s++){var c=i[s];for(Jo=c;null!==Jo;){var f=Jo;switch(f.tag){case 0:case 11:case 15:ri(8,f,u)}var d=f.child;if(null!==d)d.return=f,Jo=d;else for(;null!==Jo;){var p=(f=Jo).sibling,m=f.return;if(ui(f),f===c){Jo=null;break}if(null!==p){p.return=m,Jo=p;break}Jo=m}}}var h=u.alternate;if(null!==h){var g=h.child;if(null!==g){h.child=null;do{var v=g.sibling;g.sibling=null,g=v}while(null!==g)}}Jo=u}}if(0!=(2064&u.subtreeFlags)&&null!==o)o.return=u,Jo=o;else e:for(;null!==Jo;){if(0!=(2048&(u=Jo).flags))switch(u.tag){case 0:case 11:case 15:ri(9,u,u.return)}var y=u.sibling;if(null!==y){y.return=u.return,Jo=y;break e}Jo=u.return}}var b=e.current;for(Jo=b;null!==Jo;){var k=(o=Jo).child;if(0!=(2064&o.subtreeFlags)&&null!==k)k.return=o,Jo=k;else e:for(o=b;null!==Jo;){if(0!=(2048&(i=Jo).flags))try{switch(i.tag){case 0:case 11:case 15:li(9,i)}}catch(e){Cs(i,i.return,e)}if(i===o){Jo=null;break e}var w=i.sibling;if(null!==w){w.return=i.return,Jo=w;break e}Jo=i.return}}if(zi=l,jl(),an&&"function"==typeof an.onPostCommitFiberRoot)try{an.onPostCommitFiberRoot(ln,e)}catch(e){}r=!0}return r}finally{kn=t,Ni.transition=n}}return!1}function Es(e,n,t){e=Fa(e,n=mo(0,n=so(t,n),1),1),n=ns(),null!==e&&(yn(e,1,n),ls(e,n))}function Cs(e,n,t){if(3===e.tag)Es(e,e,t);else for(;null!==n;){if(3===n.tag){Es(n,e,t);break}if(1===n.tag){var r=n.stateNode;if("function"==typeof n.type.getDerivedStateFromError||"function"==typeof r.componentDidCatch&&(null===qi||!qi.has(r))){n=Fa(n,e=ho(n,e=so(t,e),1),1),e=ns(),null!==n&&(yn(n,1,e),ls(n,e));break}}n=n.return}}function _s(e,n,t){var r=e.pingCache;null!==r&&r.delete(n),n=ns(),e.pingedLanes|=e.suspendedLanes&t,Ti===e&&(Ri&t)===t&&(4===Oi||3===Oi&&(130023424&Ri)===Ri&&500>Ge()-ji?ps(e,0):Vi|=t),ls(e,n)}function Ps(e,n){0===n&&(0==(1&e.mode)?n=1:(n=fn,0==(130023424&(fn<<=1))&&(fn=4194304)));var t=ns();null!==(e=za(e,n))&&(yn(e,n,t),ls(e,t))}function Ns(e){var n=e.memoizedState,t=0;null!==n&&(t=n.retryLane),Ps(e,t)}function zs(e,n){var t=0;switch(e.tag){case 13:var r=e.stateNode,l=e.memoizedState;null!==l&&(t=l.retryLane);break;case 19:r=e.stateNode;break;default:throw Error(a(314))}null!==r&&r.delete(n),Ps(e,t)}function Ts(e,n){return qe(e,n)}function Ls(e,n,t,r){this.tag=e,this.key=t,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=n,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Rs(e,n,t,r){return new Ls(e,n,t,r)}function Ms(e){return!(!(e=e.prototype)||!e.isReactComponent)}function Fs(e,n){var t=e.alternate;return null===t?((t=Rs(e.tag,n,e.key,e.mode)).elementType=e.elementType,t.type=e.type,t.stateNode=e.stateNode,t.alternate=e,e.alternate=t):(t.pendingProps=n,t.type=e.type,t.flags=0,t.subtreeFlags=0,t.deletions=null),t.flags=14680064&e.flags,t.childLanes=e.childLanes,t.lanes=e.lanes,t.child=e.child,t.memoizedProps=e.memoizedProps,t.memoizedState=e.memoizedState,t.updateQueue=e.updateQueue,n=e.dependencies,t.dependencies=null===n?null:{lanes:n.lanes,firstContext:n.firstContext},t.sibling=e.sibling,t.index=e.index,t.ref=e.ref,t}function Os(e,n,t,r,l,u){var o=2;if(r=e,"function"==typeof e)Ms(e)&&(o=1);else if("string"==typeof e)o=5;else e:switch(e){case x:return Ds(t.children,l,u,n);case E:o=8,l|=8;break;case C:return(e=Rs(12,t,n,2|l)).elementType=C,e.lanes=u,e;case z:return(e=Rs(13,t,n,l)).elementType=z,e.lanes=u,e;case T:return(e=Rs(19,t,n,l)).elementType=T,e.lanes=u,e;case M:return Is(t,l,u,n);default:if("object"==typeof e&&null!==e)switch(e.$$typeof){case _:o=10;break e;case P:o=9;break e;case N:o=11;break e;case L:o=14;break e;case R:o=16,r=null;break e}throw Error(a(130,null==e?e:typeof e,""))}return(n=Rs(o,t,n,l)).elementType=e,n.type=r,n.lanes=u,n}function Ds(e,n,t,r){return(e=Rs(7,e,r,n)).lanes=t,e}function Is(e,n,t,r){return(e=Rs(22,e,r,n)).elementType=M,e.lanes=t,e.stateNode={isHidden:!1},e}function Us(e,n,t){return(e=Rs(6,e,null,n)).lanes=t,e}function Vs(e,n,t){return(n=Rs(4,null!==e.children?e.children:[],e.key,n)).lanes=t,n.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},n}function As(e,n,t,r,l){this.tag=n,this.containerInfo=e,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=vn(0),this.expirationTimes=vn(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=vn(0),this.identifierPrefix=r,this.onRecoverableError=l,this.mutableSourceEagerHydrationData=null}function $s(e,n,t,r,l,a,u,o,i){return e=new As(e,n,t,o,i),1===n?(n=1,!0===a&&(n|=8)):n=0,a=Rs(3,null,null,n),e.current=a,a.stateNode=e,a.memoizedState={element:r,isDehydrated:t,cache:null,transitions:null,pendingSuspenseBoundaries:null},La(a),e}function js(e){if(!e)return Pl;e:{if(je(e=e._reactInternals)!==e||1!==e.tag)throw Error(a(170));var n=e;do{switch(n.tag){case 3:n=n.stateNode.context;break e;case 1:if(Rl(n.type)){n=n.stateNode.__reactInternalMemoizedMergedChildContext;break e}}n=n.return}while(null!==n);throw Error(a(171))}if(1===e.tag){var t=e.type;if(Rl(t))return Ol(e,t,n)}return n}function Bs(e,n,t,r,l,a,u,o,i){return(e=$s(t,r,!0,e,0,a,0,o,i)).context=js(null),t=e.current,(a=Ma(r=ns(),l=ts(t))).callback=null!=n?n:null,Fa(t,a,l),e.current.lanes=l,yn(e,l,r),ls(e,r),e}function Hs(e,n,t,r){var l=n.current,a=ns(),u=ts(l);return t=js(t),null===n.context?n.context=t:n.pendingContext=t,(n=Ma(a,u)).payload={element:e},null!==(r=void 0===r?null:r)&&(n.callback=r),null!==(e=Fa(l,n,u))&&(rs(e,l,u,a),Oa(e,l,u)),u}function Ws(e){return(e=e.current).child?(e.child.tag,e.child.stateNode):null}function Qs(e,n){if(null!==(e=e.memoizedState)&&null!==e.dehydrated){var t=e.retryLane;e.retryLane=0!==t&&t<n?t:n}}function qs(e,n){Qs(e,n),(e=e.alternate)&&Qs(e,n)}Ei=function(e,n,t){if(null!==e)if(e.memoizedProps!==n.pendingProps||zl.current)ko=!0;else{if(0==(e.lanes&t)&&0==(128&n.flags))return ko=!1,function(e,n,t){switch(n.tag){case 3:To(n),pa();break;case 5:au(n);break;case 1:Rl(n.type)&&Dl(n);break;case 4:ru(n,n.stateNode.containerInfo);break;case 10:var r=n.type._context,l=n.memoizedProps.value;_l(va,r._currentValue),r._currentValue=l;break;case 13:if(null!==(r=n.memoizedState))return null!==r.dehydrated?(_l(ou,1&ou.current),n.flags|=128,null):0!=(t&n.child.childLanes)?Uo(e,n,t):(_l(ou,1&ou.current),null!==(e=Wo(e,n,t))?e.sibling:null);_l(ou,1&ou.current);break;case 19:if(r=0!=(t&n.childLanes),0!=(128&e.flags)){if(r)return Bo(e,n,t);n.flags|=128}if(null!==(l=n.memoizedState)&&(l.rendering=null,l.tail=null,l.lastEffect=null),_l(ou,ou.current),r)break;return null;case 22:case 23:return n.lanes=0,Co(e,n,t)}return Wo(e,n,t)}(e,n,t);ko=0!=(131072&e.flags)}else ko=!1,la&&0!=(1048576&n.flags)&&Jl(n,Ql,n.index);switch(n.lanes=0,n.tag){case 2:var r=n.type;Ho(e,n),e=n.pendingProps;var l=Ll(n,Nl.current);Ea(n,t),l=xu(null,n,r,e,l,t);var u=Eu();return n.flags|=1,"object"==typeof l&&null!==l&&"function"==typeof l.render&&void 0===l.$$typeof?(n.tag=1,n.memoizedState=null,n.updateQueue=null,Rl(r)?(u=!0,Dl(n)):u=!1,n.memoizedState=null!==l.state&&void 0!==l.state?l.state:null,La(n),l.updater=$a,n.stateNode=l,l._reactInternals=n,Wa(n,r,e,t),n=zo(null,n,r,!0,u,t)):(n.tag=0,la&&u&&ea(n),wo(null,n,l,t),n=n.child),n;case 16:r=n.elementType;e:{switch(Ho(e,n),e=n.pendingProps,r=(l=r._init)(r._payload),n.type=r,l=n.tag=function(e){if("function"==typeof e)return Ms(e)?1:0;if(null!=e){if((e=e.$$typeof)===N)return 11;if(e===L)return 14}return 2}(r),e=ga(r,e),l){case 0:n=Po(null,n,r,e,t);break e;case 1:n=No(null,n,r,e,t);break e;case 11:n=So(null,n,r,e,t);break e;case 14:n=xo(null,n,r,ga(r.type,e),t);break e}throw Error(a(306,r,""))}return n;case 0:return r=n.type,l=n.pendingProps,Po(e,n,r,l=n.elementType===r?l:ga(r,l),t);case 1:return r=n.type,l=n.pendingProps,No(e,n,r,l=n.elementType===r?l:ga(r,l),t);case 3:e:{if(To(n),null===e)throw Error(a(387));r=n.pendingProps,l=(u=n.memoizedState).element,Ra(e,n),Ia(n,r,null,t);var o=n.memoizedState;if(r=o.element,u.isDehydrated){if(u={element:r,isDehydrated:!1,cache:o.cache,pendingSuspenseBoundaries:o.pendingSuspenseBoundaries,transitions:o.transitions},n.updateQueue.baseState=u,n.memoizedState=u,256&n.flags){n=Lo(e,n,r,t,l=so(Error(a(423)),n));break e}if(r!==l){n=Lo(e,n,r,t,l=so(Error(a(424)),n));break e}for(ra=sl(n.stateNode.containerInfo.firstChild),ta=n,la=!0,aa=null,t=Ga(n,null,r,t),n.child=t;t;)t.flags=-3&t.flags|4096,t=t.sibling}else{if(pa(),r===l){n=Wo(e,n,t);break e}wo(e,n,r,t)}n=n.child}return n;case 5:return au(n),null===e&&sa(n),r=n.type,l=n.pendingProps,u=null!==e?e.memoizedProps:null,o=l.children,tl(r,l)?o=null:null!==u&&tl(r,u)&&(n.flags|=32),_o(e,n),wo(e,n,o,t),n.child;case 6:return null===e&&sa(n),null;case 13:return Uo(e,n,t);case 4:return ru(n,n.stateNode.containerInfo),r=n.pendingProps,null===e?n.child=Xa(n,null,r,t):wo(e,n,r,t),n.child;case 11:return r=n.type,l=n.pendingProps,So(e,n,r,l=n.elementType===r?l:ga(r,l),t);case 7:return wo(e,n,n.pendingProps,t),n.child;case 8:case 12:return wo(e,n,n.pendingProps.children,t),n.child;case 10:e:{if(r=n.type._context,l=n.pendingProps,u=n.memoizedProps,o=l.value,_l(va,r._currentValue),r._currentValue=o,null!==u)if(or(u.value,o)){if(u.children===l.children&&!zl.current){n=Wo(e,n,t);break e}}else for(null!==(u=n.child)&&(u.return=n);null!==u;){var i=u.dependencies;if(null!==i){o=u.child;for(var s=i.firstContext;null!==s;){if(s.context===r){if(1===u.tag){(s=Ma(-1,t&-t)).tag=2;var c=u.updateQueue;if(null!==c){var f=(c=c.shared).pending;null===f?s.next=s:(s.next=f.next,f.next=s),c.pending=s}}u.lanes|=t,null!==(s=u.alternate)&&(s.lanes|=t),xa(u.return,t,n),i.lanes|=t;break}s=s.next}}else if(10===u.tag)o=u.type===n.type?null:u.child;else if(18===u.tag){if(null===(o=u.return))throw Error(a(341));o.lanes|=t,null!==(i=o.alternate)&&(i.lanes|=t),xa(o,t,n),o=u.sibling}else o=u.child;if(null!==o)o.return=u;else for(o=u;null!==o;){if(o===n){o=null;break}if(null!==(u=o.sibling)){u.return=o.return,o=u;break}o=o.return}u=o}wo(e,n,l.children,t),n=n.child}return n;case 9:return l=n.type,r=n.pendingProps.children,Ea(n,t),r=r(l=Ca(l)),n.flags|=1,wo(e,n,r,t),n.child;case 14:return l=ga(r=n.type,n.pendingProps),xo(e,n,r,l=ga(r.type,l),t);case 15:return Eo(e,n,n.type,n.pendingProps,t);case 17:return r=n.type,l=n.pendingProps,l=n.elementType===r?l:ga(r,l),Ho(e,n),n.tag=1,Rl(r)?(e=!0,Dl(n)):e=!1,Ea(n,t),Ba(n,r,l),Wa(n,r,l,t),zo(null,n,r,!0,e,t);case 19:return Bo(e,n,t);case 22:return Co(e,n,t)}throw Error(a(156,n.tag))};var Ks="function"==typeof reportError?reportError:function(e){console.error(e)};function Ys(e){this._internalRoot=e}function Xs(e){this._internalRoot=e}function Gs(e){return!(!e||1!==e.nodeType&&9!==e.nodeType&&11!==e.nodeType)}function Zs(e){return!(!e||1!==e.nodeType&&9!==e.nodeType&&11!==e.nodeType&&(8!==e.nodeType||" react-mount-point-unstable "!==e.nodeValue))}function Js(){}function ec(e,n,t,r,l){var a=t._reactRootContainer;if(a){var u=a;if("function"==typeof l){var o=l;l=function(){var e=Ws(u);o.call(e)}}Hs(n,u,e,l)}else u=function(e,n,t,r,l){if(l){if("function"==typeof r){var a=r;r=function(){var e=Ws(u);a.call(e)}}var u=Bs(n,r,e,0,null,!1,0,"",Js);return e._reactRootContainer=u,e[ml]=u.current,jr(8===e.nodeType?e.parentNode:e),fs(),u}for(;l=e.lastChild;)e.removeChild(l);if("function"==typeof r){var o=r;r=function(){var e=Ws(i);o.call(e)}}var i=$s(e,0,!1,null,0,!1,0,"",Js);return e._reactRootContainer=i,e[ml]=i.current,jr(8===e.nodeType?e.parentNode:e),fs((function(){Hs(n,i,t,r)})),i}(t,n,e,l,r);return Ws(u)}Xs.prototype.render=Ys.prototype.render=function(e){var n=this._internalRoot;if(null===n)throw Error(a(409));Hs(e,n,null,null)},Xs.prototype.unmount=Ys.prototype.unmount=function(){var e=this._internalRoot;if(null!==e){this._internalRoot=null;var n=e.containerInfo;fs((function(){Hs(null,e,null,null)})),n[ml]=null}},Xs.prototype.unstable_scheduleHydration=function(e){if(e){var n=Cn();e={blockedOn:null,target:e,priority:n};for(var t=0;t<Fn.length&&0!==n&&n<Fn[t].priority;t++);Fn.splice(t,0,e),0===t&&Un(e)}},Sn=function(e){switch(e.tag){case 3:var n=e.stateNode;if(n.current.memoizedState.isDehydrated){var t=dn(n.pendingLanes);0!==t&&(bn(n,1|t),ls(n,Ge()),0==(6&zi)&&(Bi=Ge()+500,jl()))}break;case 13:fs((function(){var n=za(e,1);if(null!==n){var t=ns();rs(n,e,1,t)}})),qs(e,1)}},xn=function(e){if(13===e.tag){var n=za(e,134217728);null!==n&&rs(n,e,134217728,ns()),qs(e,134217728)}},En=function(e){if(13===e.tag){var n=ts(e),t=za(e,n);null!==t&&rs(t,e,n,ns()),qs(e,n)}},Cn=function(){return kn},_n=function(e,n){var t=kn;try{return kn=e,n()}finally{kn=t}},Se=function(e,n,t){switch(n){case"input":if(Z(e,t),n=t.name,"radio"===t.type&&null!=n){for(t=e;t.parentNode;)t=t.parentNode;for(t=t.querySelectorAll("input[name="+JSON.stringify(""+n)+'][type="radio"]'),n=0;n<t.length;n++){var r=t[n];if(r!==e&&r.form===e.form){var l=wl(r);if(!l)throw Error(a(90));q(r),Z(r,l)}}}break;case"textarea":ae(e,t);break;case"select":null!=(n=t.value)&&te(e,!!t.multiple,n,!1)}},Ne=cs,ze=fs;var nc={usingClientEntryPoint:!1,Events:[bl,kl,wl,_e,Pe,cs]},tc={findFiberByHostInstance:yl,bundleType:0,version:"18.2.0",rendererPackageName:"react-dom"},rc={bundleType:tc.bundleType,version:tc.version,rendererPackageName:tc.rendererPackageName,rendererConfig:tc.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:k.ReactCurrentDispatcher,findHostInstanceByFiber:function(e){return null===(e=We(e))?null:e.stateNode},findFiberByHostInstance:tc.findFiberByHostInstance||function(){return null},findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.2.0-next-9e3b772b8-20220608"};if("undefined"!=typeof __REACT_DEVTOOLS_GLOBAL_HOOK__){var lc=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!lc.isDisabled&&lc.supportsFiber)try{ln=lc.inject(rc),an=lc}catch(ce){}}n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=nc,n.createPortal=function(e,n){var t=2<arguments.length&&void 0!==arguments[2]?arguments[2]:null;if(!Gs(n))throw Error(a(200));return function(e,n,t){var r=3<arguments.length&&void 0!==arguments[3]?arguments[3]:null;return{$$typeof:S,key:null==r?null:""+r,children:e,containerInfo:n,implementation:t}}(e,n,null,t)},n.createRoot=function(e,n){if(!Gs(e))throw Error(a(299));var t=!1,r="",l=Ks;return null!=n&&(!0===n.unstable_strictMode&&(t=!0),void 0!==n.identifierPrefix&&(r=n.identifierPrefix),void 0!==n.onRecoverableError&&(l=n.onRecoverableError)),n=$s(e,1,!1,null,0,t,0,r,l),e[ml]=n.current,jr(8===e.nodeType?e.parentNode:e),new Ys(n)},n.findDOMNode=function(e){if(null==e)return null;if(1===e.nodeType)return e;var n=e._reactInternals;if(void 0===n){if("function"==typeof e.render)throw Error(a(188));throw e=Object.keys(e).join(","),Error(a(268,e))}return null===(e=We(n))?null:e.stateNode},n.flushSync=function(e){return fs(e)},n.hydrate=function(e,n,t){if(!Zs(n))throw Error(a(200));return ec(null,e,n,!0,t)},n.hydrateRoot=function(e,n,t){if(!Gs(e))throw Error(a(405));var r=null!=t&&t.hydratedSources||null,l=!1,u="",o=Ks;if(null!=t&&(!0===t.unstable_strictMode&&(l=!0),void 0!==t.identifierPrefix&&(u=t.identifierPrefix),void 0!==t.onRecoverableError&&(o=t.onRecoverableError)),n=Bs(n,null,e,1,null!=t?t:null,l,0,u,o),e[ml]=n.current,jr(e),r)for(e=0;e<r.length;e++)l=(l=(t=r[e])._getVersion)(t._source),null==n.mutableSourceEagerHydrationData?n.mutableSourceEagerHydrationData=[t,l]:n.mutableSourceEagerHydrationData.push(t,l);return new Xs(n)},n.render=function(e,n,t){if(!Zs(n))throw Error(a(200));return ec(null,e,n,!1,t)},n.unmountComponentAtNode=function(e){if(!Zs(e))throw Error(a(40));return!!e._reactRootContainer&&(fs((function(){ec(null,null,e,!1,(function(){e._reactRootContainer=null,e[ml]=null}))})),!0)},n.unstable_batchedUpdates=cs,n.unstable_renderSubtreeIntoContainer=function(e,n,t,r){if(!Zs(t))throw Error(a(200));if(null==e||void 0===e._reactInternals)throw Error(a(38));return ec(e,n,t,!1,r)},n.version="18.2.0-next-9e3b772b8-20220608"},935:(e,n,t)=>{!function e(){if("undefined"!=typeof __REACT_DEVTOOLS_GLOBAL_HOOK__&&"function"==typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE)try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e)}catch(e){console.error(e)}}(),e.exports=t(448)},408:(e,n)=>{var t=Symbol.for("react.element"),r=Symbol.for("react.portal"),l=Symbol.for("react.fragment"),a=Symbol.for("react.strict_mode"),u=Symbol.for("react.profiler"),o=Symbol.for("react.provider"),i=Symbol.for("react.context"),s=Symbol.for("react.forward_ref"),c=Symbol.for("react.suspense"),f=Symbol.for("react.memo"),d=Symbol.for("react.lazy"),p=Symbol.iterator,m={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},h=Object.assign,g={};function v(e,n,t){this.props=e,this.context=n,this.refs=g,this.updater=t||m}function y(){}function b(e,n,t){this.props=e,this.context=n,this.refs=g,this.updater=t||m}v.prototype.isReactComponent={},v.prototype.setState=function(e,n){if("object"!=typeof e&&"function"!=typeof e&&null!=e)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,n,"setState")},v.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")},y.prototype=v.prototype;var k=b.prototype=new y;k.constructor=b,h(k,v.prototype),k.isPureReactComponent=!0;var w=Array.isArray,S=Object.prototype.hasOwnProperty,x={current:null},E={key:!0,ref:!0,__self:!0,__source:!0};function C(e,n,r){var l,a={},u=null,o=null;if(null!=n)for(l in void 0!==n.ref&&(o=n.ref),void 0!==n.key&&(u=""+n.key),n)S.call(n,l)&&!E.hasOwnProperty(l)&&(a[l]=n[l]);var i=arguments.length-2;if(1===i)a.children=r;else if(1<i){for(var s=Array(i),c=0;c<i;c++)s[c]=arguments[c+2];a.children=s}if(e&&e.defaultProps)for(l in i=e.defaultProps)void 0===a[l]&&(a[l]=i[l]);return{$$typeof:t,type:e,key:u,ref:o,props:a,_owner:x.current}}function _(e){return"object"==typeof e&&null!==e&&e.$$typeof===t}var P=/\/+/g;function N(e,n){return"object"==typeof e&&null!==e&&null!=e.key?function(e){var n={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,(function(e){return n[e]}))}(""+e.key):n.toString(36)}function z(e,n,l,a,u){var o=typeof e;"undefined"!==o&&"boolean"!==o||(e=null);var i=!1;if(null===e)i=!0;else switch(o){case"string":case"number":i=!0;break;case"object":switch(e.$$typeof){case t:case r:i=!0}}if(i)return u=u(i=e),e=""===a?"."+N(i,0):a,w(u)?(l="",null!=e&&(l=e.replace(P,"$&/")+"/"),z(u,n,l,"",(function(e){return e}))):null!=u&&(_(u)&&(u=function(e,n){return{$$typeof:t,type:e.type,key:n,ref:e.ref,props:e.props,_owner:e._owner}}(u,l+(!u.key||i&&i.key===u.key?"":(""+u.key).replace(P,"$&/")+"/")+e)),n.push(u)),1;if(i=0,a=""===a?".":a+":",w(e))for(var s=0;s<e.length;s++){var c=a+N(o=e[s],s);i+=z(o,n,l,c,u)}else if(c=function(e){return null===e||"object"!=typeof e?null:"function"==typeof(e=p&&e[p]||e["@@iterator"])?e:null}(e),"function"==typeof c)for(e=c.call(e),s=0;!(o=e.next()).done;)i+=z(o=o.value,n,l,c=a+N(o,s++),u);else if("object"===o)throw n=String(e),Error("Objects are not valid as a React child (found: "+("[object Object]"===n?"object with keys {"+Object.keys(e).join(", ")+"}":n)+"). If you meant to render a collection of children, use an array instead.");return i}function T(e,n,t){if(null==e)return e;var r=[],l=0;return z(e,r,"","",(function(e){return n.call(t,e,l++)})),r}function L(e){if(-1===e._status){var n=e._result;(n=n()).then((function(n){0!==e._status&&-1!==e._status||(e._status=1,e._result=n)}),(function(n){0!==e._status&&-1!==e._status||(e._status=2,e._result=n)})),-1===e._status&&(e._status=0,e._result=n)}if(1===e._status)return e._result.default;throw e._result}var R={current:null},M={transition:null},F={ReactCurrentDispatcher:R,ReactCurrentBatchConfig:M,ReactCurrentOwner:x};n.Children={map:T,forEach:function(e,n,t){T(e,(function(){n.apply(this,arguments)}),t)},count:function(e){var n=0;return T(e,(function(){n++})),n},toArray:function(e){return T(e,(function(e){return e}))||[]},only:function(e){if(!_(e))throw Error("React.Children.only expected to receive a single React element child.");return e}},n.Component=v,n.Fragment=l,n.Profiler=u,n.PureComponent=b,n.StrictMode=a,n.Suspense=c,n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=F,n.cloneElement=function(e,n,r){if(null==e)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+e+".");var l=h({},e.props),a=e.key,u=e.ref,o=e._owner;if(null!=n){if(void 0!==n.ref&&(u=n.ref,o=x.current),void 0!==n.key&&(a=""+n.key),e.type&&e.type.defaultProps)var i=e.type.defaultProps;for(s in n)S.call(n,s)&&!E.hasOwnProperty(s)&&(l[s]=void 0===n[s]&&void 0!==i?i[s]:n[s])}var s=arguments.length-2;if(1===s)l.children=r;else if(1<s){i=Array(s);for(var c=0;c<s;c++)i[c]=arguments[c+2];l.children=i}return{$$typeof:t,type:e.type,key:a,ref:u,props:l,_owner:o}},n.createContext=function(e){return(e={$$typeof:i,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null}).Provider={$$typeof:o,_context:e},e.Consumer=e},n.createElement=C,n.createFactory=function(e){var n=C.bind(null,e);return n.type=e,n},n.createRef=function(){return{current:null}},n.forwardRef=function(e){return{$$typeof:s,render:e}},n.isValidElement=_,n.lazy=function(e){return{$$typeof:d,_payload:{_status:-1,_result:e},_init:L}},n.memo=function(e,n){return{$$typeof:f,type:e,compare:void 0===n?null:n}},n.startTransition=function(e){var n=M.transition;M.transition={};try{e()}finally{M.transition=n}},n.unstable_act=function(){throw Error("act(...) is not supported in production builds of React.")},n.useCallback=function(e,n){return R.current.useCallback(e,n)},n.useContext=function(e){return R.current.useContext(e)},n.useDebugValue=function(){},n.useDeferredValue=function(e){return R.current.useDeferredValue(e)},n.useEffect=function(e,n){return R.current.useEffect(e,n)},n.useId=function(){return R.current.useId()},n.useImperativeHandle=function(e,n,t){return R.current.useImperativeHandle(e,n,t)},n.useInsertionEffect=function(e,n){return R.current.useInsertionEffect(e,n)},n.useLayoutEffect=function(e,n){return R.current.useLayoutEffect(e,n)},n.useMemo=function(e,n){return R.current.useMemo(e,n)},n.useReducer=function(e,n,t){return R.current.useReducer(e,n,t)},n.useRef=function(e){return R.current.useRef(e)},n.useState=function(e){return R.current.useState(e)},n.useSyncExternalStore=function(e,n,t){return R.current.useSyncExternalStore(e,n,t)},n.useTransition=function(){return R.current.useTransition()},n.version="18.2.0"},294:(e,n,t)=>{e.exports=t(408)},53:(e,n)=>{function t(e,n){var t=e.length;e.push(n);e:for(;0<t;){var r=t-1>>>1,l=e[r];if(!(0<a(l,n)))break e;e[r]=n,e[t]=l,t=r}}function r(e){return 0===e.length?null:e[0]}function l(e){if(0===e.length)return null;var n=e[0],t=e.pop();if(t!==n){e[0]=t;e:for(var r=0,l=e.length,u=l>>>1;r<u;){var o=2*(r+1)-1,i=e[o],s=o+1,c=e[s];if(0>a(i,t))s<l&&0>a(c,i)?(e[r]=c,e[s]=t,r=s):(e[r]=i,e[o]=t,r=o);else{if(!(s<l&&0>a(c,t)))break e;e[r]=c,e[s]=t,r=s}}}return n}function a(e,n){var t=e.sortIndex-n.sortIndex;return 0!==t?t:e.id-n.id}if("object"==typeof performance&&"function"==typeof performance.now){var u=performance;n.unstable_now=function(){return u.now()}}else{var o=Date,i=o.now();n.unstable_now=function(){return o.now()-i}}var s=[],c=[],f=1,d=null,p=3,m=!1,h=!1,g=!1,v="function"==typeof setTimeout?setTimeout:null,y="function"==typeof clearTimeout?clearTimeout:null,b="undefined"!=typeof setImmediate?setImmediate:null;function k(e){for(var n=r(c);null!==n;){if(null===n.callback)l(c);else{if(!(n.startTime<=e))break;l(c),n.sortIndex=n.expirationTime,t(s,n)}n=r(c)}}function w(e){if(g=!1,k(e),!h)if(null!==r(s))h=!0,M(S);else{var n=r(c);null!==n&&F(w,n.startTime-e)}}function S(e,t){h=!1,g&&(g=!1,y(_),_=-1),m=!0;var a=p;try{for(k(t),d=r(s);null!==d&&(!(d.expirationTime>t)||e&&!z());){var u=d.callback;if("function"==typeof u){d.callback=null,p=d.priorityLevel;var o=u(d.expirationTime<=t);t=n.unstable_now(),"function"==typeof o?d.callback=o:d===r(s)&&l(s),k(t)}else l(s);d=r(s)}if(null!==d)var i=!0;else{var f=r(c);null!==f&&F(w,f.startTime-t),i=!1}return i}finally{d=null,p=a,m=!1}}"undefined"!=typeof navigator&&void 0!==navigator.scheduling&&void 0!==navigator.scheduling.isInputPending&&navigator.scheduling.isInputPending.bind(navigator.scheduling);var x,E=!1,C=null,_=-1,P=5,N=-1;function z(){return!(n.unstable_now()-N<P)}function T(){if(null!==C){var e=n.unstable_now();N=e;var t=!0;try{t=C(!0,e)}finally{t?x():(E=!1,C=null)}}else E=!1}if("function"==typeof b)x=function(){b(T)};else if("undefined"!=typeof MessageChannel){var L=new MessageChannel,R=L.port2;L.port1.onmessage=T,x=function(){R.postMessage(null)}}else x=function(){v(T,0)};function M(e){C=e,E||(E=!0,x())}function F(e,t){_=v((function(){e(n.unstable_now())}),t)}n.unstable_IdlePriority=5,n.unstable_ImmediatePriority=1,n.unstable_LowPriority=4,n.unstable_NormalPriority=3,n.unstable_Profiling=null,n.unstable_UserBlockingPriority=2,n.unstable_cancelCallback=function(e){e.callback=null},n.unstable_continueExecution=function(){h||m||(h=!0,M(S))},n.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):P=0<e?Math.floor(1e3/e):5},n.unstable_getCurrentPriorityLevel=function(){return p},n.unstable_getFirstCallbackNode=function(){return r(s)},n.unstable_next=function(e){switch(p){case 1:case 2:case 3:var n=3;break;default:n=p}var t=p;p=n;try{return e()}finally{p=t}},n.unstable_pauseExecution=function(){},n.unstable_requestPaint=function(){},n.unstable_runWithPriority=function(e,n){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var t=p;p=e;try{return n()}finally{p=t}},n.unstable_scheduleCallback=function(e,l,a){var u=n.unstable_now();switch(a="object"==typeof a&&null!==a&&"number"==typeof(a=a.delay)&&0<a?u+a:u,e){case 1:var o=-1;break;case 2:o=250;break;case 5:o=1073741823;break;case 4:o=1e4;break;default:o=5e3}return e={id:f++,callback:l,priorityLevel:e,startTime:a,expirationTime:o=a+o,sortIndex:-1},a>u?(e.sortIndex=a,t(c,e),null===r(s)&&e===r(c)&&(g?(y(_),_=-1):g=!0,F(w,a-u))):(e.sortIndex=o,t(s,e),h||m||(h=!0,M(S))),e},n.unstable_shouldYield=z,n.unstable_wrapCallback=function(e){var n=p;return function(){var t=p;p=n;try{return e.apply(this,arguments)}finally{p=t}}}},840:(e,n,t)=>{e.exports=t(53)}},t={};function r(e){var l=t[e];if(void 0!==l)return l.exports;var a=t[e]={exports:{}};return n[e](a,a.exports,r),a.exports}e=r(294),r(935).render(e.createElement("h1",null," React Counter will land here "),document.getElementById("react-app"))})();;
/**
 * @file
 * Attaches behaviors for Drupal's active link marking.
 */

(function (Drupal, drupalSettings) {
  /**
   * Append is-active class.
   *
   * The link is only active if its path corresponds to the current path, the
   * language of the linked path is equal to the current language, and if the
   * query parameters of the link equal those of the current request, since the
   * same request with different query parameters may yield a different page
   * (e.g. pagers, exposed View filters).
   *
   * Does not discriminate based on element type, so allows you to set the
   * is-active class on any element: a, li…
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.activeLinks = {
    attach(context) {
      // Start by finding all potentially active links.
      const path = drupalSettings.path;
      const queryString = JSON.stringify(path.currentQuery);
      const querySelector = path.currentQuery
        ? `[data-drupal-link-query='${queryString}']`
        : ':not([data-drupal-link-query])';
      const originalSelectors = [
        `[data-drupal-link-system-path="${path.currentPath}"]`,
      ];
      let selectors;

      // If this is the front page, we have to check for the <front> path as
      // well.
      if (path.isFront) {
        originalSelectors.push('[data-drupal-link-system-path="<front>"]');
      }

      // Add language filtering.
      selectors = [].concat(
        // Links without any hreflang attributes (most of them).
        originalSelectors.map((selector) => `${selector}:not([hreflang])`),
        // Links with hreflang equals to the current language.
        originalSelectors.map(
          (selector) => `${selector}[hreflang="${path.currentLanguage}"]`,
        ),
      );

      // Add query string selector for pagers, exposed filters.
      selectors = selectors.map((current) => current + querySelector);

      // Query the DOM.
      const activeLinks = context.querySelectorAll(selectors.join(','));
      const il = activeLinks.length;
      for (let i = 0; i < il; i++) {
        activeLinks[i].classList.add('is-active');
      }
    },
    detach(context, settings, trigger) {
      if (trigger === 'unload') {
        const activeLinks = context.querySelectorAll(
          '[data-drupal-link-system-path].is-active',
        );
        const il = activeLinks.length;
        for (let i = 0; i < il; i++) {
          activeLinks[i].classList.remove('is-active');
        }
      }
    },
  };
})(Drupal, drupalSettings);
;
/**
 * @file
 * Bootstrap Popovers.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  var $document = $(document);

  /**
   * Extend the Bootstrap Popover plugin constructor class.
   */
  Bootstrap.extendPlugin('popover', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.popover_animation,
        autoClose: !!settings.popover_auto_close,
        enabled: settings.popover_enabled,
        html: !!settings.popover_html,
        placement: settings.popover_placement,
        selector: settings.popover_selector,
        trigger: settings.popover_trigger,
        title: settings.popover_title,
        content: settings.popover_content,
        delay: parseInt(settings.popover_delay, 10),
        container: settings.popover_container
      }
    };
  });

  /**
   * Bootstrap Popovers.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapPopovers = {
    $activePopover: null,
    attach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      var _this = this;

      $document
        .on('show.bs.popover', '[data-toggle=popover]', function () {
          var $trigger = $(this);
          var popover = $trigger.data('bs.popover');

          // Only keep track of clicked triggers that we're manually handling.
          if (popover.options.originalTrigger === 'click') {
            if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($trigger)) {
              _this.$activePopover.popover('hide');
            }
            _this.$activePopover = $trigger;
          }
        })
        // Unfortunately, :focusable is only made available when using jQuery
        // UI. While this would be the most semantic pseudo selector to use
        // here, jQuery UI may not always be loaded. Instead, just use :visible
        // here as this just needs some sort of selector here. This activates
        // delegate binding to elements in jQuery so it can work it's bubbling
        // focus magic since elements don't really propagate their focus events.
        // @see https://www.drupal.org/project/bootstrap/issues/3013236
        .on('focus.bs.popover', ':visible', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($target) && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('click.bs.popover', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !$target.is('[data-toggle=popover]') && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('keyup.bs.popover', function (e) {
          if (_this.$activePopover && _this.getOption('autoClose') && e.which === 27) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
      ;

      var elements = $(context).find('[data-toggle=popover]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.popover.Constructor.DEFAULTS, $element.data());

        // Store the original trigger.
        options.originalTrigger = options.trigger;

        // If the trigger is "click", then we'll handle it manually here.
        if (options.trigger === 'click') {
          options.trigger = 'manual';
        }

        // Retrieve content from a target element.
        var target = options.target || $element.is('a[href^="#"]') && $element.attr('href');
        var $target = $document.find(target).clone();
        if (!options.content && $target[0]) {
          $target.removeClass('visually-hidden hidden').removeAttr('aria-hidden');
          options.content = $target.wrap('<div/>').parent()[options.html ? 'html' : 'text']() || '';
        }

        // Initialize the popover.
        $element.popover(options);

        // Handle clicks manually.
        if (options.originalTrigger === 'click') {
          // To ensure the element is bound multiple times, remove any
          // previously set event handler before adding another one.
          $element
            .off('click.drupal.bootstrap.popover')
            .on('click.drupal.bootstrap.popover', function (e) {
              $(this).popover('toggle');
              e.preventDefault();
              e.stopPropagation();
            })
          ;
        }
      }
    },
    detach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all popovers.
      $(context).find('[data-toggle="popover"]')
        .off('click.drupal.bootstrap.popover')
        .popover('destroy')
      ;
    },
    getOption: function(name, defaultValue, element) {
      var $element = element ? $(element) : this.$activePopover;
      var options = $.extend(true, {}, $.fn.popover.Constructor.DEFAULTS, ($element && $element.data('bs.popover') || {}).options);
      if (options[name] !== void 0) {
        return options[name];
      }
      return defaultValue !== void 0 ? defaultValue : void 0;
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
 * @file
 * Bootstrap Tooltips.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  /**
   * Extend the Bootstrap Tooltip plugin constructor class.
   */
  Bootstrap.extendPlugin('tooltip', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.tooltip_animation,
        enabled: settings.tooltip_enabled,
        html: !!settings.tooltip_html,
        placement: settings.tooltip_placement,
        selector: settings.tooltip_selector,
        trigger: settings.tooltip_trigger,
        delay: parseInt(settings.tooltip_delay, 10),
        container: settings.tooltip_container
      }
    };
  });

  /**
   * Bootstrap Tooltips.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapTooltips = {
    attach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      var elements = $(context).find('[data-toggle="tooltip"]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, $element.data());
        $element.tooltip(options);
      }
    },
    detach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all tooltips.
      $(context).find('[data-toggle="tooltip"]').tooltip('destroy');
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
 * @file
 * Adapted from underscore.js with the addition Drupal namespace.
 */

/**
 * Limits the invocations of a function in a given time frame.
 *
 * The debounce function wrapper should be used sparingly. One clear use case
 * is limiting the invocation of a callback attached to the window resize event.
 *
 * Before using the debounce function wrapper, consider first whether the
 * callback could be attached to an event that fires less frequently or if the
 * function can be written in such a way that it is only invoked under specific
 * conditions.
 *
 * @param {function} func
 *   The function to be invoked.
 * @param {number} wait
 *   The time period within which the callback function should only be
 *   invoked once. For example if the wait period is 250ms, then the callback
 *   will only be called at most 4 times per second.
 * @param {boolean} immediate
 *   Whether we wait at the beginning or end to execute the function.
 *
 * @return {function}
 *   The debounced function.
 */
Drupal.debounce = function (func, wait, immediate) {
  let timeout;
  let result;
  return function (...args) {
    const context = this;
    const later = function () {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
    }
    return result;
  };
};
;
/**
 * @file
 * Adds an HTML element and method to trigger audio UAs to read system messages.
 *
 * Use {@link Drupal.announce} to indicate to screen reader users that an
 * element on the page has changed state. For instance, if clicking a link
 * loads 10 more items into a list, one might announce the change like this.
 *
 * @example
 * $('#search-list')
 *   .on('itemInsert', function (event, data) {
 *     // Insert the new items.
 *     $(data.container.el).append(data.items.el);
 *     // Announce the change to the page contents.
 *     Drupal.announce(Drupal.t('@count items added to @container',
 *       {'@count': data.items.length, '@container': data.container.title}
 *     ));
 *   });
 */

(function (Drupal, debounce) {
  let liveElement;
  const announcements = [];

  /**
   * Builds a div element with the aria-live attribute and add it to the DOM.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for drupalAnnounce.
   */
  Drupal.behaviors.drupalAnnounce = {
    attach(context) {
      // Create only one aria-live element.
      if (!liveElement) {
        liveElement = document.createElement('div');
        liveElement.id = 'drupal-live-announce';
        liveElement.className = 'visually-hidden';
        liveElement.setAttribute('aria-live', 'polite');
        liveElement.setAttribute('aria-busy', 'false');
        document.body.appendChild(liveElement);
      }
    },
  };

  /**
   * Concatenates announcements to a single string; appends to the live region.
   */
  function announce() {
    const text = [];
    let priority = 'polite';
    let announcement;

    // Create an array of announcement strings to be joined and appended to the
    // aria live region.
    const il = announcements.length;
    for (let i = 0; i < il; i++) {
      announcement = announcements.pop();
      text.unshift(announcement.text);
      // If any of the announcements has a priority of assertive then the group
      // of joined announcements will have this priority.
      if (announcement.priority === 'assertive') {
        priority = 'assertive';
      }
    }

    if (text.length) {
      // Clear the liveElement so that repeated strings will be read.
      liveElement.innerHTML = '';
      // Set the busy state to true until the node changes are complete.
      liveElement.setAttribute('aria-busy', 'true');
      // Set the priority to assertive, or default to polite.
      liveElement.setAttribute('aria-live', priority);
      // Print the text to the live region. Text should be run through
      // Drupal.t() before being passed to Drupal.announce().
      liveElement.innerHTML = text.join('\n');
      // The live text area is updated. Allow the AT to announce the text.
      liveElement.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Triggers audio UAs to read the supplied text.
   *
   * The aria-live region will only read the text that currently populates its
   * text node. Replacing text quickly in rapid calls to announce results in
   * only the text from the most recent call to {@link Drupal.announce} being
   * read. By wrapping the call to announce in a debounce function, we allow for
   * time for multiple calls to {@link Drupal.announce} to queue up their
   * messages. These messages are then joined and append to the aria-live region
   * as one text node.
   *
   * @param {string} text
   *   A string to be read by the UA.
   * @param {string} [priority='polite']
   *   A string to indicate the priority of the message. Can be either
   *   'polite' or 'assertive'.
   *
   * @return {function}
   *   The return of the call to debounce.
   *
   * @see http://www.w3.org/WAI/PF/aria-practices/#liveprops
   */
  Drupal.announce = function (text, priority) {
    // Save the text and priority into a closure variable. Multiple simultaneous
    // announcements will be concatenated and read in sequence.
    announcements.push({
      text,
      priority,
    });
    // Immediately invoke the function that debounce returns. 200 ms is right at
    // the cusp where humans notice a pause, so we will wait
    // at most this much time before the set of queued announcements is read.
    return debounce(announce, 200)();
  };
})(Drupal, Drupal.debounce);
;
/**
 * @file
 * Manages elements that can offset the size of the viewport.
 *
 * Measures and reports viewport offset dimensions from elements like the
 * toolbar that can potentially displace the positioning of other elements.
 */

/**
 * @typedef {object} Drupal~displaceOffset
 *
 * @prop {number} top
 * @prop {number} left
 * @prop {number} right
 * @prop {number} bottom
 */

/**
 * Triggers when layout of the page changes.
 *
 * This is used to position fixed element on the page during page resize and
 * Toolbar toggling.
 *
 * @event drupalViewportOffsetChange
 */
(function ($, Drupal, debounce) {
  /**
   *
   * @type {Drupal~displaceOffset}
   */
  const cache = {
    right: 0,
    left: 0,
    bottom: 0,
    top: 0,
  };
  /**
   * The prefix used for the css custom variable name.
   *
   * @type {string}
   */
  const cssVarPrefix = '--drupal-displace-offset';
  const documentStyle = document.documentElement.style;
  const offsetKeys = Object.keys(cache);
  /**
   * The object with accessors that update the CSS variable on value update.
   *
   * @type {Drupal~displaceOffset}
   */
  const offsetProps = {};
  offsetKeys.forEach((edge) => {
    offsetProps[edge] = {
      // Show this property when using Object.keys().
      enumerable: true,
      get() {
        return cache[edge];
      },
      set(value) {
        // Only update the CSS custom variable when the value changed.
        if (value !== cache[edge]) {
          documentStyle.setProperty(`${cssVarPrefix}-${edge}`, `${value}px`);
        }
        cache[edge] = value;
      },
    };
  });

  /**
   * Current value of the size of margins on the page.
   *
   * This property is read-only and the object is sealed to prevent key name
   * modifications since key names are used to dynamically construct CSS custom
   * variable names.
   *
   * @name Drupal.displace.offsets
   *
   * @type {Drupal~displaceOffset}
   */
  const offsets = Object.seal(Object.defineProperties({}, offsetProps));

  /**
   * Calculates displacement for element based on its dimensions and placement.
   *
   * @param {HTMLElement} el
   *   The element whose dimensions and placement will be measured.
   *
   * @param {string} edge
   *   The name of the edge of the viewport that the element is associated
   *   with.
   *
   * @return {number}
   *   The viewport displacement distance for the requested edge.
   */
  function getRawOffset(el, edge) {
    const $el = $(el);
    const documentElement = document.documentElement;
    let displacement = 0;
    const horizontal = edge === 'left' || edge === 'right';
    // Get the offset of the element itself.
    let placement = $el.offset()[horizontal ? 'left' : 'top'];
    // Subtract scroll distance from placement to get the distance
    // to the edge of the viewport.
    placement -=
      window[`scroll${horizontal ? 'X' : 'Y'}`] ||
      document.documentElement[`scroll${horizontal ? 'Left' : 'Top'}`] ||
      0;
    // Find the displacement value according to the edge.
    switch (edge) {
      // Left and top elements displace as a sum of their own offset value
      // plus their size.
      case 'top':
        // Total displacement is the sum of the elements placement and size.
        displacement = placement + $el.outerHeight();
        break;

      case 'left':
        // Total displacement is the sum of the elements placement and size.
        displacement = placement + $el.outerWidth();
        break;

      // Right and bottom elements displace according to their left and
      // top offset. Their size isn't important.
      case 'bottom':
        displacement = documentElement.clientHeight - placement;
        break;

      case 'right':
        displacement = documentElement.clientWidth - placement;
        break;

      default:
        displacement = 0;
    }
    return displacement;
  }

  /**
   * Gets a specific edge's offset.
   *
   * Any element with the attribute data-offset-{edge} e.g. data-offset-top will
   * be considered in the viewport offset calculations. If the attribute has a
   * numeric value, that value will be used. If no value is provided, one will
   * be calculated using the element's dimensions and placement.
   *
   * @function Drupal.displace.calculateOffset
   *
   * @param {string} edge
   *   The name of the edge to calculate. Can be 'top', 'right',
   *   'bottom' or 'left'.
   *
   * @return {number}
   *   The viewport displacement distance for the requested edge.
   */
  function calculateOffset(edge) {
    let edgeOffset = 0;
    const displacingElements = document.querySelectorAll(
      `[data-offset-${edge}]`,
    );
    const n = displacingElements.length;
    for (let i = 0; i < n; i++) {
      const el = displacingElements[i];
      // If the element is not visible, do consider its dimensions.
      if (el.style.display === 'none') {
        continue;
      }
      // If the offset data attribute contains a displacing value, use it.
      let displacement = parseInt(el.getAttribute(`data-offset-${edge}`), 10);
      // If the element's offset data attribute exits
      // but is not a valid number then get the displacement
      // dimensions directly from the element.
      // eslint-disable-next-line no-restricted-globals
      if (isNaN(displacement)) {
        displacement = getRawOffset(el, edge);
      }
      // If the displacement value is larger than the current value for this
      // edge, use the displacement value.
      edgeOffset = Math.max(edgeOffset, displacement);
    }

    return edgeOffset;
  }

  /**
   * Informs listeners of the current offset dimensions.
   *
   * Corresponding CSS custom variables are also updated.
   * Corresponding CSS custom variables names are:
   *  - `--drupal-displace-offset-top`
   *  - `--drupal-displace-offset-right`
   *  - `--drupal-displace-offset-bottom`
   *  - `--drupal-displace-offset-left`
   *
   * @function Drupal.displace
   *
   * @prop {Drupal~displaceOffset} offsets
   *
   * @param {boolean} [broadcast=true]
   *   When true, causes the recalculated offsets values to be
   *   broadcast to listeners. If none is given, defaults to true.
   *
   * @return {Drupal~displaceOffset}
   *   An object whose keys are the for sides an element -- top, right, bottom
   *   and left. The value of each key is the viewport displacement distance for
   *   that edge.
   *
   * @fires event:drupalViewportOffsetChange
   */
  function displace(broadcast = true) {
    const newOffsets = {};
    // Getting the offset and setting the offset needs to be separated because
    // of performance concerns. Only do DOM/style reading happening here.
    offsetKeys.forEach((edge) => {
      newOffsets[edge] = calculateOffset(edge);
    });
    // Once we have all the values, write to the DOM/style.
    offsetKeys.forEach((edge) => {
      // Updating the value in place also update Drupal.displace.offsets.
      offsets[edge] = newOffsets[edge];
    });

    if (broadcast) {
      $(document).trigger('drupalViewportOffsetChange', offsets);
    }
    return offsets;
  }

  /**
   * Registers a resize handler on the window.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.drupalDisplace = {
    attach() {
      // Mark this behavior as processed on the first pass.
      if (this.displaceProcessed) {
        return;
      }
      this.displaceProcessed = true;
      $(window).on('resize.drupalDisplace', debounce(displace, 200));
    },
  };

  /**
   * Assign the displace function to a property of the Drupal global object.
   *
   * @ignore
   */
  Drupal.displace = displace;

  /**
   * Expose offsets to other scripts to avoid having to recalculate offsets.
   *
   * @ignore
   */
  Object.defineProperty(Drupal.displace, 'offsets', {
    value: offsets,
    // Make sure other scripts don't replace this object.
    writable: false,
  });

  /**
   * Expose method to compute a single edge offsets.
   *
   * @ignore
   */
  Drupal.displace.calculateOffset = calculateOffset;
})(jQuery, Drupal, Drupal.debounce);
;
/**
 * @file
 * Builds a nested accordion widget.
 *
 * Invoke on an HTML list element with the jQuery plugin pattern.
 *
 * @example
 * $('.toolbar-menu').drupalToolbarMenu();
 */

(function ($, Drupal, drupalSettings) {
  /**
   * Store the open menu tray.
   */
  let activeItem = Drupal.url(drupalSettings.path.currentPath);

  $.fn.drupalToolbarMenu = function () {
    const ui = {
      handleOpen: Drupal.t('Extend'),
      handleClose: Drupal.t('Collapse'),
    };

    /**
     * Toggle the open/close state of a list is a menu.
     *
     * @param {jQuery} $item
     *   The li item to be toggled.
     *
     * @param {Boolean} switcher
     *   A flag that forces toggleClass to add or a remove a class, rather than
     *   simply toggling its presence.
     */
    function toggleList($item, switcher) {
      const $toggle = $item
        .children('.toolbar-box')
        .children('.toolbar-handle');
      switcher =
        typeof switcher !== 'undefined' ? switcher : !$item.hasClass('open');
      // Toggle the item open state.
      $item.toggleClass('open', switcher);
      // Twist the toggle.
      $toggle.toggleClass('open', switcher);
      // Adjust the toggle text.
      $toggle.find('.action').each((index, element) => {
        // Expand Structure, Collapse Structure.
        element.textContent = switcher ? ui.handleClose : ui.handleOpen;
      });
    }

    /**
     * Handle clicks from the disclosure button on an item with sub-items.
     *
     * @param {Object} event
     *   A jQuery Event object.
     */
    function toggleClickHandler(event) {
      const $toggle = $(event.target);
      const $item = $toggle.closest('li');
      // Toggle the list item.
      toggleList($item);
      // Close open sibling menus.
      const $openItems = $item.siblings().filter('.open');
      toggleList($openItems, false);
    }

    /**
     * Handle clicks from a menu item link.
     *
     * @param {Object} event
     *   A jQuery Event object.
     */
    function linkClickHandler(event) {
      // If the toolbar is positioned fixed (and therefore hiding content
      // underneath), then users expect clicks in the administration menu tray
      // to take them to that destination but for the menu tray to be closed
      // after clicking: otherwise the toolbar itself is obstructing the view
      // of the destination they chose.
      if (!Drupal.toolbar.models.toolbarModel.get('isFixed')) {
        Drupal.toolbar.models.toolbarModel.set('activeTab', null);
      }
      // Stopping propagation to make sure that once a toolbar-box is clicked
      // (the whitespace part), the page is not redirected anymore.
      event.stopPropagation();
    }

    /**
     * Add markup to the menu elements.
     *
     * Items with sub-elements have a list toggle attached to them. Menu item
     * links and the corresponding list toggle are wrapped with in a div
     * classed with .toolbar-box. The .toolbar-box div provides a positioning
     * context for the item list toggle.
     *
     * @param {jQuery} $menu
     *   The root of the menu to be initialized.
     */
    function initItems($menu) {
      const options = {
        class: 'toolbar-icon toolbar-handle',
        action: ui.handleOpen,
        text: '',
      };
      // Initialize items and their links.
      $menu.find('li > a').wrap('<div class="toolbar-box">');
      // Add a handle to each list item if it has a menu.
      $menu.find('li').each((index, element) => {
        const $item = $(element);
        if ($item.children('ul.toolbar-menu').length) {
          const $box = $item.children('.toolbar-box');
          const $link = $box.find('a');
          options.text = Drupal.t('@label', {
            '@label': $link.length ? $link[0].textContent : '',
          });
          $item
            .children('.toolbar-box')
            .append(Drupal.theme('toolbarMenuItemToggle', options));
        }
      });
    }

    /**
     * Adds a level class to each list based on its depth in the menu.
     *
     * This function is called recursively on each sub level of lists elements
     * until the depth of the menu is exhausted.
     *
     * @param {jQuery} $lists
     *   A jQuery object of ul elements.
     *
     * @param {number} level
     *   The current level number to be assigned to the list elements.
     */
    function markListLevels($lists, level) {
      level = !level ? 1 : level;
      const $lis = $lists.children('li').addClass(`level-${level}`);
      $lists = $lis.children('ul');
      if ($lists.length) {
        markListLevels($lists, level + 1);
      }
    }

    /**
     * On page load, open the active menu item.
     *
     * Marks the trail of the active link in the menu back to the root of the
     * menu with .menu-item--active-trail.
     *
     * @param {jQuery} $menu
     *   The root of the menu.
     */
    function openActiveItem($menu) {
      const pathItem = $menu.find(`a[href="${window.location.pathname}"]`);
      if (pathItem.length && !activeItem) {
        activeItem = window.location.pathname;
      }
      if (activeItem) {
        const $activeItem = $menu
          .find(`a[href="${activeItem}"]`)
          .addClass('menu-item--active');
        const $activeTrail = $activeItem
          .parentsUntil('.root', 'li')
          .addClass('menu-item--active-trail');
        toggleList($activeTrail, true);
      }
    }

    // Return the jQuery object.
    return this.each(function (selector) {
      const menu = once('toolbar-menu', this);
      if (menu.length) {
        const $menu = $(menu);
        // Bind event handlers.
        $menu
          .on('click.toolbar', '.toolbar-box', toggleClickHandler)
          .on('click.toolbar', '.toolbar-box a', linkClickHandler);

        $menu.addClass('root');
        initItems($menu);
        markListLevels($menu);
        // Restore previous and active states.
        openActiveItem($menu);
      }
    });
  };

  /**
   * A toggle is an interactive element often bound to a click handler.
   *
   * @param {object} options
   *   Options for the button.
   * @param {string} options.class
   *   Class to set on the button.
   * @param {string} options.action
   *   Action for the button.
   * @param {string} options.text
   *   Used as label for the button.
   *
   * @return {string}
   *   A string representing a DOM fragment.
   */
  Drupal.theme.toolbarMenuItemToggle = function (options) {
    return `<button class="${options.class}"><span class="action">${options.action}</span> <span class="label">${options.text}</span></button>`;
  };
})(jQuery, Drupal, drupalSettings);
;
/**
 * @file
 * Defines the behavior of the Drupal administration toolbar.
 */

(function ($, Drupal, drupalSettings) {
  // Merge run-time settings with the defaults.
  const options = $.extend(
    {
      breakpoints: {
        'toolbar.narrow': '',
        'toolbar.standard': '',
        'toolbar.wide': '',
      },
    },
    drupalSettings.toolbar,
    // Merge strings on top of drupalSettings so that they are not mutable.
    {
      strings: {
        horizontal: Drupal.t('Horizontal orientation'),
        vertical: Drupal.t('Vertical orientation'),
      },
    },
  );

  /**
   * Registers tabs with the toolbar.
   *
   * The Drupal toolbar allows modules to register top-level tabs. These may
   * point directly to a resource or toggle the visibility of a tray.
   *
   * Modules register tabs with hook_toolbar().
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the toolbar rendering functionality to the toolbar element.
   */
  Drupal.behaviors.toolbar = {
    attach(context) {
      // Verify that the user agent understands media queries. Complex admin
      // toolbar layouts require media query support.
      if (!window.matchMedia('only screen').matches) {
        return;
      }
      // Process the administrative toolbar.
      once('toolbar', '#toolbar-administration', context).forEach((toolbar) => {
        // Establish the toolbar models and views.
        const model = new Drupal.toolbar.ToolbarModel({
          locked: JSON.parse(
            localStorage.getItem('Drupal.toolbar.trayVerticalLocked'),
          ),
          activeTab: document.getElementById(
            JSON.parse(localStorage.getItem('Drupal.toolbar.activeTabID')),
          ),
          height: $('#toolbar-administration').outerHeight(),
        });

        Drupal.toolbar.models.toolbarModel = model;

        // Attach a listener to the configured media query breakpoints.
        // Executes it before Drupal.toolbar.views to avoid extra rendering.
        Object.keys(options.breakpoints).forEach((label) => {
          const mq = options.breakpoints[label];
          const mql = window.matchMedia(mq);
          Drupal.toolbar.mql[label] = mql;
          // Curry the model and the label of the media query breakpoint to
          // the mediaQueryChangeHandler function.
          mql.addListener(
            Drupal.toolbar.mediaQueryChangeHandler.bind(null, model, label),
          );
          // Fire the mediaQueryChangeHandler for each configured breakpoint
          // so that they process once.
          Drupal.toolbar.mediaQueryChangeHandler.call(null, model, label, mql);
        });

        Drupal.toolbar.views.toolbarVisualView =
          new Drupal.toolbar.ToolbarVisualView({
            el: toolbar,
            model,
            strings: options.strings,
          });
        Drupal.toolbar.views.toolbarAuralView =
          new Drupal.toolbar.ToolbarAuralView({
            el: toolbar,
            model,
            strings: options.strings,
          });
        Drupal.toolbar.views.bodyVisualView = new Drupal.toolbar.BodyVisualView(
          {
            el: toolbar,
            model,
          },
        );

        // Force layout render to fix mobile view. Only needed on load, not
        // for every media query match.
        model.trigger('change:isFixed', model, model.get('isFixed'));
        model.trigger('change:activeTray', model, model.get('activeTray'));

        // Render collapsible menus.
        const menuModel = new Drupal.toolbar.MenuModel();
        Drupal.toolbar.models.menuModel = menuModel;
        Drupal.toolbar.views.menuVisualView = new Drupal.toolbar.MenuVisualView(
          {
            el: $(toolbar).find('.toolbar-menu-administration').get(0),
            model: menuModel,
            strings: options.strings,
          },
        );

        // Handle the resolution of Drupal.toolbar.setSubtrees.
        // This is handled with a deferred so that the function may be invoked
        // asynchronously.
        Drupal.toolbar.setSubtrees.done((subtrees) => {
          menuModel.set('subtrees', subtrees);
          const theme = drupalSettings.ajaxPageState.theme;
          localStorage.setItem(
            `Drupal.toolbar.subtrees.${theme}`,
            JSON.stringify(subtrees),
          );
          // Indicate on the toolbarModel that subtrees are now loaded.
          model.set('areSubtreesLoaded', true);
        });

        // Trigger an initial attempt to load menu subitems. This first attempt
        // is made after the media query handlers have had an opportunity to
        // process. The toolbar starts in the vertical orientation by default,
        // unless the viewport is wide enough to accommodate a horizontal
        // orientation. Thus we give the Toolbar a chance to determine if it
        // should be set to horizontal orientation before attempting to load
        // menu subtrees.
        Drupal.toolbar.views.toolbarVisualView.loadSubtrees();

        $(document)
          // Update the model when the viewport offset changes.
          .on('drupalViewportOffsetChange.toolbar', (event, offsets) => {
            model.set('offsets', offsets);
          });

        // Broadcast model changes to other modules.
        model
          .on('change:orientation', (model, orientation) => {
            $(document).trigger('drupalToolbarOrientationChange', orientation);
          })
          .on('change:activeTab', (model, tab) => {
            $(document).trigger('drupalToolbarTabChange', tab);
          })
          .on('change:activeTray', (model, tray) => {
            $(document).trigger('drupalToolbarTrayChange', tray);
          });

        // If the toolbar's orientation is horizontal and no active tab is
        // defined then show the tray of the first toolbar tab by default (but
        // not the first 'Home' toolbar tab).
        if (
          Drupal.toolbar.models.toolbarModel.get('orientation') ===
            'horizontal' &&
          Drupal.toolbar.models.toolbarModel.get('activeTab') === null
        ) {
          Drupal.toolbar.models.toolbarModel.set({
            activeTab: $(
              '.toolbar-bar .toolbar-tab:not(.home-toolbar-tab) a',
            ).get(0),
          });
        }

        $(window).on({
          'dialog:aftercreate': (event, dialog, $element, settings) => {
            const $toolbar = $('#toolbar-bar');
            $toolbar.css('margin-top', '0');

            // When off-canvas is positioned in top, toolbar has to be moved down.
            if (settings.drupalOffCanvasPosition === 'top') {
              const height = Drupal.offCanvas
                .getContainer($element)
                .outerHeight();
              $toolbar.css('margin-top', `${height}px`);

              $element.on('dialogContentResize.off-canvas', () => {
                const newHeight = Drupal.offCanvas
                  .getContainer($element)
                  .outerHeight();
                $toolbar.css('margin-top', `${newHeight}px`);
              });
            }
          },
          'dialog:beforeclose': () => {
            $('#toolbar-bar').css('margin-top', '0');
          },
        });
      });
    },
  };

  /**
   * Toolbar methods of Backbone objects.
   *
   * @namespace
   */
  Drupal.toolbar = {
    /**
     * A hash of View instances.
     *
     * @type {object.<string, Backbone.View>}
     */
    views: {},

    /**
     * A hash of Model instances.
     *
     * @type {object.<string, Backbone.Model>}
     */
    models: {},

    /**
     * A hash of MediaQueryList objects tracked by the toolbar.
     *
     * @type {object.<string, object>}
     */
    mql: {},

    /**
     * Accepts a list of subtree menu elements.
     *
     * A deferred object that is resolved by an inlined JavaScript callback.
     *
     * @type {jQuery.Deferred}
     *
     * @see toolbar_subtrees_jsonp().
     */
    setSubtrees: new $.Deferred(),

    /**
     * Respond to configured narrow media query changes.
     *
     * @param {Drupal.toolbar.ToolbarModel} model
     *   A toolbar model
     * @param {string} label
     *   Media query label.
     * @param {object} mql
     *   A MediaQueryList object.
     */
    mediaQueryChangeHandler(model, label, mql) {
      switch (label) {
        case 'toolbar.narrow':
          model.set({
            isOriented: mql.matches,
            isTrayToggleVisible: false,
          });
          // If the toolbar doesn't have an explicit orientation yet, or if the
          // narrow media query doesn't match then set the orientation to
          // vertical.
          if (!mql.matches || !model.get('orientation')) {
            model.set({ orientation: 'vertical' }, { validate: true });
          }
          break;

        case 'toolbar.standard':
          model.set({
            isFixed: mql.matches,
          });
          break;

        case 'toolbar.wide':
          model.set(
            {
              orientation:
                mql.matches && !model.get('locked') ? 'horizontal' : 'vertical',
            },
            { validate: true },
          );
          // The tray orientation toggle visibility does not need to be
          // validated.
          model.set({
            isTrayToggleVisible: mql.matches,
          });
          break;

        default:
          break;
      }
    },
  };

  /**
   * A toggle is an interactive element often bound to a click handler.
   *
   * @return {string}
   *   A string representing a DOM fragment.
   */
  Drupal.theme.toolbarOrientationToggle = function () {
    return (
      '<div class="toolbar-toggle-orientation"><div class="toolbar-lining">' +
      '<button class="toolbar-icon" type="button"></button>' +
      '</div></div>'
    );
  };

  /**
   * Ajax command to set the toolbar subtrees.
   *
   * @param {Drupal.Ajax} ajax
   *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
   * @param {object} response
   *   JSON response from the Ajax request.
   * @param {number} [status]
   *   XMLHttpRequest status.
   */
  Drupal.AjaxCommands.prototype.setToolbarSubtrees = function (
    ajax,
    response,
    status,
  ) {
    Drupal.toolbar.setSubtrees.resolve(response.subtrees);
  };
})(jQuery, Drupal, drupalSettings);
;
/**
 * @file
 * A Backbone Model for collapsible menus.
 */

(function (Backbone, Drupal) {
  /**
   * Backbone Model for collapsible menus.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.toolbar.MenuModel = Backbone.Model.extend(
    /** @lends Drupal.toolbar.MenuModel# */ {
      /**
       * @type {object}
       *
       * @prop {object} subtrees
       */
      defaults: /** @lends Drupal.toolbar.MenuModel# */ {
        /**
         * @type {object}
         */
        subtrees: {},
      },
    },
  );
})(Backbone, Drupal);
;
/**
 * @file
 * A Backbone Model for the toolbar.
 */

(function (Backbone, Drupal) {
  /**
   * Backbone model for the toolbar.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.toolbar.ToolbarModel = Backbone.Model.extend(
    /** @lends Drupal.toolbar.ToolbarModel# */ {
      /**
       * @type {object}
       *
       * @prop activeTab
       * @prop activeTray
       * @prop isOriented
       * @prop isFixed
       * @prop areSubtreesLoaded
       * @prop isViewportOverflowConstrained
       * @prop orientation
       * @prop locked
       * @prop isTrayToggleVisible
       * @prop height
       * @prop offsets
       */
      defaults: /** @lends Drupal.toolbar.ToolbarModel# */ {
        /**
         * The active toolbar tab. All other tabs should be inactive under
         * normal circumstances. It will remain active across page loads. The
         * active item is stored as an ID selector e.g. '#toolbar-item--1'.
         *
         * @type {string}
         */
        activeTab: null,

        /**
         * Represents whether a tray is open or not. Stored as an ID selector e.g.
         * '#toolbar-item--1-tray'.
         *
         * @type {string}
         */
        activeTray: null,

        /**
         * Indicates whether the toolbar is displayed in an oriented fashion,
         * either horizontal or vertical.
         *
         * @type {boolean}
         */
        isOriented: false,

        /**
         * Indicates whether the toolbar is positioned absolute (false) or fixed
         * (true).
         *
         * @type {boolean}
         */
        isFixed: false,

        /**
         * Menu subtrees are loaded through an AJAX request only when the Toolbar
         * is set to a vertical orientation.
         *
         * @type {boolean}
         */
        areSubtreesLoaded: false,

        /**
         * If the viewport overflow becomes constrained, isFixed must be true so
         * that elements in the trays aren't lost off-screen and impossible to
         * get to.
         *
         * @type {boolean}
         */
        isViewportOverflowConstrained: false,

        /**
         * The orientation of the active tray.
         *
         * @type {string}
         */
        orientation: 'horizontal',

        /**
         * A tray is locked if a user toggled it to vertical. Otherwise a tray
         * will switch between vertical and horizontal orientation based on the
         * configured breakpoints. The locked state will be maintained across page
         * loads.
         *
         * @type {boolean}
         */
        locked: false,

        /**
         * Indicates whether the tray orientation toggle is visible.
         *
         * @type {boolean}
         */
        isTrayToggleVisible: true,

        /**
         * The height of the toolbar.
         *
         * @type {number}
         */
        height: null,

        /**
         * The current viewport offsets determined by {@link Drupal.displace}. The
         * offsets suggest how a module might position is components relative to
         * the viewport.
         *
         * @type {object}
         *
         * @prop {number} top
         * @prop {number} right
         * @prop {number} bottom
         * @prop {number} left
         */
        offsets: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      },

      /**
       * {@inheritdoc}
       *
       * @param {object} attributes
       *   Attributes for the toolbar.
       * @param {object} options
       *   Options for the toolbar.
       *
       * @return {string|undefined}
       *   Returns an error message if validation failed.
       */
      validate(attributes, options) {
        // Prevent the orientation being set to horizontal if it is locked, unless
        // override has not been passed as an option.
        if (
          attributes.orientation === 'horizontal' &&
          this.get('locked') &&
          !options.override
        ) {
          return Drupal.t(
            'The toolbar cannot be set to a horizontal orientation when it is locked.',
          );
        }
      },
    },
  );
})(Backbone, Drupal);
;
/**
 * @file
 * A Backbone view for the body element.
 */

(function ($, Drupal, Backbone) {
  Drupal.toolbar.BodyVisualView = Backbone.View.extend(
    /** @lends Drupal.toolbar.BodyVisualView# */ {
      /**
       * Adjusts the body element with the toolbar position and dimension changes.
       *
       * @constructs
       *
       * @augments Backbone.View
       */
      initialize() {
        this.listenTo(this.model, 'change:activeTray ', this.render);
        this.listenTo(
          this.model,
          'change:isFixed change:isViewportOverflowConstrained',
          this.isToolbarFixed,
        );
      },

      isToolbarFixed() {
        // When the toolbar is fixed, it will not scroll with page scrolling.
        const isViewportOverflowConstrained = this.model.get(
          'isViewportOverflowConstrained',
        );
        $('body').toggleClass(
          'toolbar-fixed',
          isViewportOverflowConstrained || this.model.get('isFixed'),
        );
      },

      /**
       * {@inheritdoc}
       */
      render() {
        $('body')
          // Toggle the toolbar-tray-open class on the body element. The class is
          // applied when a toolbar tray is active. Padding might be applied to
          // the body element to prevent the tray from overlapping content.
          .toggleClass('toolbar-tray-open', !!this.model.get('activeTray'));
      },
    },
  );
})(jQuery, Drupal, Backbone);
;
/**
 * @file
 * A Backbone view for the collapsible menus.
 */

(function ($, Backbone, Drupal) {
  Drupal.toolbar.MenuVisualView = Backbone.View.extend(
    /** @lends Drupal.toolbar.MenuVisualView# */ {
      /**
       * Backbone View for collapsible menus.
       *
       * @constructs
       *
       * @augments Backbone.View
       */
      initialize() {
        this.listenTo(this.model, 'change:subtrees', this.render);
      },

      /**
       * {@inheritdoc}
       */
      render() {
        const subtrees = this.model.get('subtrees');
        // Add subtrees.
        Object.keys(subtrees || {}).forEach((id) => {
          $(
            once('toolbar-subtrees', this.$el.find(`#toolbar-link-${id}`)),
          ).after(subtrees[id]);
        });
        // Render the main menu as a nested, collapsible accordion.
        if ('drupalToolbarMenu' in $.fn) {
          this.$el.children('.toolbar-menu').drupalToolbarMenu();
        }
      },
    },
  );
})(jQuery, Backbone, Drupal);
;
/**
 * @file
 * A Backbone view for the aural feedback of the toolbar.
 */

(function (Backbone, Drupal) {
  Drupal.toolbar.ToolbarAuralView = Backbone.View.extend(
    /** @lends Drupal.toolbar.ToolbarAuralView# */ {
      /**
       * Backbone view for the aural feedback of the toolbar.
       *
       * @constructs
       *
       * @augments Backbone.View
       *
       * @param {object} options
       *   Options for the view.
       * @param {object} options.strings
       *   Various strings to use in the view.
       */
      initialize(options) {
        this.strings = options.strings;

        this.listenTo(
          this.model,
          'change:orientation',
          this.onOrientationChange,
        );
        this.listenTo(this.model, 'change:activeTray', this.onActiveTrayChange);
      },

      /**
       * Announces an orientation change.
       *
       * @param {Drupal.toolbar.ToolbarModel} model
       *   The toolbar model in question.
       * @param {string} orientation
       *   The new value of the orientation attribute in the model.
       */
      onOrientationChange(model, orientation) {
        Drupal.announce(
          Drupal.t('Tray orientation changed to @orientation.', {
            '@orientation': orientation,
          }),
        );
      },

      /**
       * Announces a changed active tray.
       *
       * @param {Drupal.toolbar.ToolbarModel} model
       *   The toolbar model in question.
       * @param {HTMLElement} tray
       *   The new value of the tray attribute in the model.
       */
      onActiveTrayChange(model, tray) {
        const relevantTray =
          tray === null ? model.previous('activeTray') : tray;
        // Current activeTray and previous activeTray are empty, no state change
        // to announce.
        if (!relevantTray) {
          return;
        }
        const action = tray === null ? Drupal.t('closed') : Drupal.t('opened');
        const trayNameElement =
          relevantTray.querySelector('.toolbar-tray-name');
        let text;
        if (trayNameElement !== null) {
          text = Drupal.t('Tray "@tray" @action.', {
            '@tray': trayNameElement.textContent,
            '@action': action,
          });
        } else {
          text = Drupal.t('Tray @action.', { '@action': action });
        }
        Drupal.announce(text);
      },
    },
  );
})(Backbone, Drupal);
;
/**
 * @file
 * A Backbone view for the toolbar element. Listens to mouse & touch.
 */

(function ($, Drupal, drupalSettings, Backbone) {
  Drupal.toolbar.ToolbarVisualView = Backbone.View.extend(
    /** @lends Drupal.toolbar.ToolbarVisualView# */ {
      /**
       * Event map for the `ToolbarVisualView`.
       *
       * @return {object}
       *   A map of events.
       */
      events() {
        // Prevents delay and simulated mouse events.
        const touchEndToClick = function (event) {
          event.preventDefault();
          event.target.click();
        };

        return {
          'click .toolbar-bar .toolbar-tab .trigger': 'onTabClick',
          'click .toolbar-toggle-orientation button':
            'onOrientationToggleClick',
          'touchend .toolbar-bar .toolbar-tab .trigger': touchEndToClick,
          'touchend .toolbar-toggle-orientation button': touchEndToClick,
        };
      },

      /**
       * Backbone view for the toolbar element. Listens to mouse & touch.
       *
       * @constructs
       *
       * @augments Backbone.View
       *
       * @param {object} options
       *   Options for the view object.
       * @param {object} options.strings
       *   Various strings to use in the view.
       */
      initialize(options) {
        this.strings = options.strings;

        this.listenTo(
          this.model,
          'change:activeTab change:orientation change:isOriented change:isTrayToggleVisible',
          this.render,
        );
        this.listenTo(this.model, 'change:mqMatches', this.onMediaQueryChange);
        this.listenTo(this.model, 'change:offsets', this.adjustPlacement);
        this.listenTo(
          this.model,
          'change:activeTab change:orientation change:isOriented',
          this.updateToolbarHeight,
        );

        // Add the tray orientation toggles, but only if there is a menu.
        this.$el
          .find('.toolbar-tray .toolbar-lining')
          .has('.toolbar-menu')
          .append(Drupal.theme('toolbarOrientationToggle'));

        // Trigger an activeTab change so that listening scripts can respond on
        // page load. This will call render.
        this.model.trigger('change:activeTab');
      },

      /**
       * Update the toolbar element height.
       *
       * @constructs
       *
       * @augments Backbone.View
       */
      updateToolbarHeight() {
        const toolbarTabOuterHeight =
          $('#toolbar-bar').find('.toolbar-tab').outerHeight() || 0;
        const toolbarTrayHorizontalOuterHeight =
          $('.is-active.toolbar-tray-horizontal').outerHeight() || 0;
        this.model.set(
          'height',
          toolbarTabOuterHeight + toolbarTrayHorizontalOuterHeight,
        );

        $('body').css({
          'padding-top': this.model.get('height'),
        });
        $('html').css({
          'scroll-padding-top': this.model.get('height'),
        });

        this.triggerDisplace();
      },

      // Trigger a recalculation of viewport displacing elements. Use setTimeout
      // to ensure this recalculation happens after changes to visual elements
      // have processed.
      triggerDisplace() {
        _.defer(() => {
          Drupal.displace(true);
        });
      },

      /**
       * {@inheritdoc}
       *
       * @return {Drupal.toolbar.ToolbarVisualView}
       *   The `ToolbarVisualView` instance.
       */
      render() {
        this.updateTabs();
        this.updateTrayOrientation();
        this.updateBarAttributes();

        $('body').removeClass('toolbar-loading');

        // Load the subtrees if the orientation of the toolbar is changed to
        // vertical. This condition responds to the case that the toolbar switches
        // from horizontal to vertical orientation. The toolbar starts in a
        // vertical orientation by default and then switches to horizontal during
        // initialization if the media query conditions are met. Simply checking
        // that the orientation is vertical here would result in the subtrees
        // always being loaded, even when the toolbar initialization ultimately
        // results in a horizontal orientation.
        //
        // @see Drupal.behaviors.toolbar.attach() where admin menu subtrees
        // loading is invoked during initialization after media query conditions
        // have been processed.
        if (
          this.model.changed.orientation === 'vertical' ||
          this.model.changed.activeTab
        ) {
          this.loadSubtrees();
        }

        return this;
      },

      /**
       * Responds to a toolbar tab click.
       *
       * @param {jQuery.Event} event
       *   The event triggered.
       */
      onTabClick(event) {
        // If this tab has a tray associated with it, it is considered an
        // activatable tab.
        if (event.currentTarget.hasAttribute('data-toolbar-tray')) {
          const activeTab = this.model.get('activeTab');
          const clickedTab = event.currentTarget;

          // Set the event target as the active item if it is not already.
          this.model.set(
            'activeTab',
            !activeTab || clickedTab !== activeTab ? clickedTab : null,
          );

          event.preventDefault();
          event.stopPropagation();
        }
      },

      /**
       * Toggles the orientation of a toolbar tray.
       *
       * @param {jQuery.Event} event
       *   The event triggered.
       */
      onOrientationToggleClick(event) {
        const orientation = this.model.get('orientation');
        // Determine the toggle-to orientation.
        const antiOrientation =
          orientation === 'vertical' ? 'horizontal' : 'vertical';
        const locked = antiOrientation === 'vertical';
        // Remember the locked state.
        if (locked) {
          localStorage.setItem('Drupal.toolbar.trayVerticalLocked', 'true');
        } else {
          localStorage.removeItem('Drupal.toolbar.trayVerticalLocked');
        }
        // Update the model.
        this.model.set(
          {
            locked,
            orientation: antiOrientation,
          },
          {
            validate: true,
            override: true,
          },
        );

        event.preventDefault();
        event.stopPropagation();
      },

      /**
       * Updates the display of the tabs: toggles a tab and the associated tray.
       */
      updateTabs() {
        const $tab = $(this.model.get('activeTab'));
        // Deactivate the previous tab.
        $(this.model.previous('activeTab'))
          .removeClass('is-active')
          .prop('aria-pressed', false);
        // Deactivate the previous tray.
        $(this.model.previous('activeTray')).removeClass('is-active');

        // Activate the selected tab.
        if ($tab.length > 0) {
          $tab
            .addClass('is-active')
            // Mark the tab as pressed.
            .prop('aria-pressed', true);
          const name = $tab.attr('data-toolbar-tray');
          // Store the active tab name or remove the setting.
          const id = $tab.get(0).id;
          if (id) {
            localStorage.setItem(
              'Drupal.toolbar.activeTabID',
              JSON.stringify(id),
            );
          }
          // Activate the associated tray.
          const $tray = this.$el.find(
            `[data-toolbar-tray="${name}"].toolbar-tray`,
          );
          if ($tray.length) {
            $tray.addClass('is-active');
            this.model.set('activeTray', $tray.get(0));
          } else {
            // There is no active tray.
            this.model.set('activeTray', null);
          }
        } else {
          // There is no active tray.
          this.model.set('activeTray', null);
          localStorage.removeItem('Drupal.toolbar.activeTabID');
        }
      },

      /**
       * Update the attributes of the toolbar bar element.
       */
      updateBarAttributes() {
        const isOriented = this.model.get('isOriented');
        if (isOriented) {
          this.$el.find('.toolbar-bar').attr('data-offset-top', '');
        } else {
          this.$el.find('.toolbar-bar').removeAttr('data-offset-top');
        }
        // Toggle between a basic vertical view and a more sophisticated
        // horizontal and vertical display of the toolbar bar and trays.
        this.$el.toggleClass('toolbar-oriented', isOriented);
      },

      /**
       * Updates the orientation of the active tray if necessary.
       */
      updateTrayOrientation() {
        const orientation = this.model.get('orientation');

        // The antiOrientation is used to render the view of action buttons like
        // the tray orientation toggle.
        const antiOrientation =
          orientation === 'vertical' ? 'horizontal' : 'vertical';

        // Toggle toolbar's parent classes before other toolbar classes to avoid
        // potential flicker and re-rendering.
        $('body')
          .toggleClass('toolbar-vertical', orientation === 'vertical')
          .toggleClass('toolbar-horizontal', orientation === 'horizontal');

        const removeClass =
          antiOrientation === 'horizontal'
            ? 'toolbar-tray-horizontal'
            : 'toolbar-tray-vertical';
        const $trays = this.$el
          .find('.toolbar-tray')
          .removeClass(removeClass)
          .addClass(`toolbar-tray-${orientation}`);

        // Update the tray orientation toggle button.
        const iconClass = `toolbar-icon-toggle-${orientation}`;
        const iconAntiClass = `toolbar-icon-toggle-${antiOrientation}`;
        const $orientationToggle = this.$el
          .find('.toolbar-toggle-orientation')
          .toggle(this.model.get('isTrayToggleVisible'));
        const $orientationToggleButton = $orientationToggle.find('button');
        $orientationToggleButton[0].value = antiOrientation;
        $orientationToggleButton
          .attr('title', this.strings[antiOrientation])
          .removeClass(iconClass)
          .addClass(iconAntiClass);
        $orientationToggleButton[0].textContent = this.strings[antiOrientation];

        // Update data offset attributes for the trays.
        const dir = document.documentElement.dir;
        const edge = dir === 'rtl' ? 'right' : 'left';
        // Remove data-offset attributes from the trays so they can be refreshed.
        $trays.removeAttr('data-offset-left data-offset-right data-offset-top');
        // If an active vertical tray exists, mark it as an offset element.
        $trays
          .filter('.toolbar-tray-vertical.is-active')
          .attr(`data-offset-${edge}`, '');
        // If an active horizontal tray exists, mark it as an offset element.
        $trays
          .filter('.toolbar-tray-horizontal.is-active')
          .attr('data-offset-top', '');
      },

      /**
       * Sets the tops of the trays so that they align with the bottom of the bar.
       */
      adjustPlacement() {
        const $trays = this.$el.find('.toolbar-tray');
        if (!this.model.get('isOriented')) {
          $trays
            .removeClass('toolbar-tray-horizontal')
            .addClass('toolbar-tray-vertical');
        }
      },

      /**
       * Calls the endpoint URI that builds an AJAX command with the rendered
       * subtrees.
       *
       * The rendered admin menu subtrees HTML is cached on the client in
       * localStorage until the cache of the admin menu subtrees on the server-
       * side is invalidated. The subtreesHash is stored in localStorage as well
       * and compared to the subtreesHash in drupalSettings to determine when the
       * admin menu subtrees cache has been invalidated.
       */
      loadSubtrees() {
        const $activeTab = $(this.model.get('activeTab'));
        const orientation = this.model.get('orientation');
        // Only load and render the admin menu subtrees if:
        //   (1) They have not been loaded yet.
        //   (2) The active tab is the administration menu tab, indicated by the
        //       presence of the data-drupal-subtrees attribute.
        //   (3) The orientation of the tray is vertical.
        if (
          !this.model.get('areSubtreesLoaded') &&
          typeof $activeTab.data('drupal-subtrees') !== 'undefined' &&
          orientation === 'vertical'
        ) {
          const subtreesHash = drupalSettings.toolbar.subtreesHash;
          const theme = drupalSettings.ajaxPageState.theme;
          const endpoint = Drupal.url(`toolbar/subtrees/${subtreesHash}`);
          const cachedSubtreesHash = localStorage.getItem(
            `Drupal.toolbar.subtreesHash.${theme}`,
          );
          const cachedSubtrees = JSON.parse(
            localStorage.getItem(`Drupal.toolbar.subtrees.${theme}`),
          );
          const isVertical = this.model.get('orientation') === 'vertical';
          // If we have the subtrees in localStorage and the subtree hash has not
          // changed, then use the cached data.
          if (
            isVertical &&
            subtreesHash === cachedSubtreesHash &&
            cachedSubtrees
          ) {
            Drupal.toolbar.setSubtrees.resolve(cachedSubtrees);
          }
          // Only make the call to get the subtrees if the orientation of the
          // toolbar is vertical.
          else if (isVertical) {
            // Remove the cached menu information.
            localStorage.removeItem(`Drupal.toolbar.subtreesHash.${theme}`);
            localStorage.removeItem(`Drupal.toolbar.subtrees.${theme}`);
            // The AJAX response's command will trigger the resolve method of the
            // Drupal.toolbar.setSubtrees Promise.
            Drupal.ajax({ url: endpoint }).execute();
            // Cache the hash for the subtrees locally.
            localStorage.setItem(
              `Drupal.toolbar.subtreesHash.${theme}`,
              subtreesHash,
            );
          }
        }
      },
    },
  );
})(jQuery, Drupal, drupalSettings, Backbone);
;
/*! shepherd.js 10.0.1 */

'use strict';(function(O,pa){"object"===typeof exports&&"undefined"!==typeof module?module.exports=pa():"function"===typeof define&&define.amd?define(pa):(O="undefined"!==typeof globalThis?globalThis:O||self,O.Shepherd=pa())})(this,function(){function O(a,b){return!1!==b.clone&&b.isMergeableObject(a)?ea(Array.isArray(a)?[]:{},a,b):a}function pa(a,b,c){return a.concat(b).map(function(d){return O(d,c)})}function Db(a){return Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(a).filter(function(b){return a.propertyIsEnumerable(b)}):
[]}function Sa(a){return Object.keys(a).concat(Db(a))}function Ta(a,b){try{return b in a}catch(c){return!1}}function Eb(a,b,c){var d={};c.isMergeableObject(a)&&Sa(a).forEach(function(e){d[e]=O(a[e],c)});Sa(b).forEach(function(e){if(!Ta(a,e)||Object.hasOwnProperty.call(a,e)&&Object.propertyIsEnumerable.call(a,e))if(Ta(a,e)&&c.isMergeableObject(b[e])){if(c.customMerge){var f=c.customMerge(e);f="function"===typeof f?f:ea}else f=ea;d[e]=f(a[e],b[e],c)}else d[e]=O(b[e],c)});return d}function ea(a,b,c){c=
c||{};c.arrayMerge=c.arrayMerge||pa;c.isMergeableObject=c.isMergeableObject||Fb;c.cloneUnlessOtherwiseSpecified=O;var d=Array.isArray(b),e=Array.isArray(a);return d!==e?O(b,c):d?c.arrayMerge(a,b,c):Eb(a,b,c)}function Z(a){return"function"===typeof a}function qa(a){return"string"===typeof a}function Ua(a){let b=Object.getOwnPropertyNames(a.constructor.prototype);for(let c=0;c<b.length;c++){let d=b[c],e=a[d];"constructor"!==d&&"function"===typeof e&&(a[d]=e.bind(a))}return a}function Gb(a,b){return c=>
{if(b.isOpen()){let d=b.el&&c.currentTarget===b.el;(void 0!==a&&c.currentTarget.matches(a)||d)&&b.tour.next()}}}function Hb(a){let {event:b,selector:c}=a.options.advanceOn||{};if(b){let d=Gb(c,a),e;try{e=document.querySelector(c)}catch(f){}if(void 0===c||e)e?(e.addEventListener(b,d),a.on("destroy",()=>e.removeEventListener(b,d))):(document.body.addEventListener(b,d,!0),a.on("destroy",()=>document.body.removeEventListener(b,d,!0)));else return console.error(`No element was found for the selector supplied to advanceOn: ${c}`)}else return console.error("advanceOn was defined, but no event name was passed.")}
function M(a){return a?(a.nodeName||"").toLowerCase():null}function K(a){return null==a?window:"[object Window]"!==a.toString()?(a=a.ownerDocument)?a.defaultView||window:window:a}function fa(a){var b=K(a).Element;return a instanceof b||a instanceof Element}function F(a){var b=K(a).HTMLElement;return a instanceof b||a instanceof HTMLElement}function Ea(a){if("undefined"===typeof ShadowRoot)return!1;var b=K(a).ShadowRoot;return a instanceof b||a instanceof ShadowRoot}function N(a){return a.split("-")[0]}
function ha(a,b){void 0===b&&(b=!1);var c=a.getBoundingClientRect(),d=1,e=1;F(a)&&b&&(b=a.offsetHeight,a=a.offsetWidth,0<a&&(d=ia(c.width)/a||1),0<b&&(e=ia(c.height)/b||1));return{width:c.width/d,height:c.height/e,top:c.top/e,right:c.right/d,bottom:c.bottom/e,left:c.left/d,x:c.left/d,y:c.top/e}}function Fa(a){var b=ha(a),c=a.offsetWidth,d=a.offsetHeight;1>=Math.abs(b.width-c)&&(c=b.width);1>=Math.abs(b.height-d)&&(d=b.height);return{x:a.offsetLeft,y:a.offsetTop,width:c,height:d}}function Va(a,b){var c=
b.getRootNode&&b.getRootNode();if(a.contains(b))return!0;if(c&&Ea(c)){do{if(b&&a.isSameNode(b))return!0;b=b.parentNode||b.host}while(b)}return!1}function P(a){return K(a).getComputedStyle(a)}function U(a){return((fa(a)?a.ownerDocument:a.document)||window.document).documentElement}function wa(a){return"html"===M(a)?a:a.assignedSlot||a.parentNode||(Ea(a)?a.host:null)||U(a)}function Wa(a){return F(a)&&"fixed"!==P(a).position?a.offsetParent:null}function ra(a){for(var b=K(a),c=Wa(a);c&&0<=["table","td",
"th"].indexOf(M(c))&&"static"===P(c).position;)c=Wa(c);if(c&&("html"===M(c)||"body"===M(c)&&"static"===P(c).position))return b;if(!c)a:{c=-1!==navigator.userAgent.toLowerCase().indexOf("firefox");if(-1===navigator.userAgent.indexOf("Trident")||!F(a)||"fixed"!==P(a).position)for(a=wa(a),Ea(a)&&(a=a.host);F(a)&&0>["html","body"].indexOf(M(a));){var d=P(a);if("none"!==d.transform||"none"!==d.perspective||"paint"===d.contain||-1!==["transform","perspective"].indexOf(d.willChange)||c&&"filter"===d.willChange||
c&&d.filter&&"none"!==d.filter){c=a;break a}else a=a.parentNode}c=null}return c||b}function Ga(a){return 0<=["top","bottom"].indexOf(a)?"x":"y"}function Xa(a){return Object.assign({},{top:0,right:0,bottom:0,left:0},a)}function Ya(a,b){return b.reduce(function(c,d){c[d]=a;return c},{})}function ja(a){return a.split("-")[1]}function Za(a){var b,c=a.popper,d=a.popperRect,e=a.placement,f=a.variation,g=a.offsets,l=a.position,m=a.gpuAcceleration,k=a.adaptive,p=a.roundOffsets,q=a.isFixed;a=g.x;a=void 0===
a?0:a;var n=g.y,r=void 0===n?0:n;n="function"===typeof p?p({x:a,y:r}):{x:a,y:r};a=n.x;r=n.y;n=g.hasOwnProperty("x");g=g.hasOwnProperty("y");var x="left",h="top",t=window;if(k){var v=ra(c),A="clientHeight",u="clientWidth";v===K(c)&&(v=U(c),"static"!==P(v).position&&"absolute"===l&&(A="scrollHeight",u="scrollWidth"));if("top"===e||("left"===e||"right"===e)&&"end"===f)h="bottom",r-=(q&&v===t&&t.visualViewport?t.visualViewport.height:v[A])-d.height,r*=m?1:-1;if("left"===e||("top"===e||"bottom"===e)&&
"end"===f)x="right",a-=(q&&v===t&&t.visualViewport?t.visualViewport.width:v[u])-d.width,a*=m?1:-1}c=Object.assign({position:l},k&&Ib);!0===p?(p=r,d=window.devicePixelRatio||1,a={x:ia(a*d)/d||0,y:ia(p*d)/d||0}):a={x:a,y:r};p=a;a=p.x;r=p.y;if(m){var w;return Object.assign({},c,(w={},w[h]=g?"0":"",w[x]=n?"0":"",w.transform=1>=(t.devicePixelRatio||1)?"translate("+a+"px, "+r+"px)":"translate3d("+a+"px, "+r+"px, 0)",w))}return Object.assign({},c,(b={},b[h]=g?r+"px":"",b[x]=n?a+"px":"",b.transform="",b))}
function xa(a){return a.replace(/left|right|bottom|top/g,function(b){return Jb[b]})}function $a(a){return a.replace(/start|end/g,function(b){return Kb[b]})}function Ha(a){a=K(a);return{scrollLeft:a.pageXOffset,scrollTop:a.pageYOffset}}function Ia(a){return ha(U(a)).left+Ha(a).scrollLeft}function Ja(a){a=P(a);return/auto|scroll|overlay|hidden/.test(a.overflow+a.overflowY+a.overflowX)}function ab(a){return 0<=["html","body","#document"].indexOf(M(a))?a.ownerDocument.body:F(a)&&Ja(a)?a:ab(wa(a))}function sa(a,
b){var c;void 0===b&&(b=[]);var d=ab(a);a=d===(null==(c=a.ownerDocument)?void 0:c.body);c=K(d);d=a?[c].concat(c.visualViewport||[],Ja(d)?d:[]):d;b=b.concat(d);return a?b:b.concat(sa(wa(d)))}function Ka(a){return Object.assign({},a,{left:a.x,top:a.y,right:a.x+a.width,bottom:a.y+a.height})}function bb(a,b){if("viewport"===b){b=K(a);var c=U(a);b=b.visualViewport;var d=c.clientWidth;c=c.clientHeight;var e=0,f=0;b&&(d=b.width,c=b.height,/^((?!chrome|android).)*safari/i.test(navigator.userAgent)||(e=b.offsetLeft,
f=b.offsetTop));a={width:d,height:c,x:e+Ia(a),y:f};a=Ka(a)}else fa(b)?(a=ha(b),a.top+=b.clientTop,a.left+=b.clientLeft,a.bottom=a.top+b.clientHeight,a.right=a.left+b.clientWidth,a.width=b.clientWidth,a.height=b.clientHeight,a.x=a.left,a.y=a.top):(f=U(a),a=U(f),d=Ha(f),b=null==(c=f.ownerDocument)?void 0:c.body,c=L(a.scrollWidth,a.clientWidth,b?b.scrollWidth:0,b?b.clientWidth:0),e=L(a.scrollHeight,a.clientHeight,b?b.scrollHeight:0,b?b.clientHeight:0),f=-d.scrollLeft+Ia(f),d=-d.scrollTop,"rtl"===P(b||
a).direction&&(f+=L(a.clientWidth,b?b.clientWidth:0)-c),a=Ka({width:c,height:e,x:f,y:d}));return a}function Lb(a){var b=sa(wa(a)),c=0<=["absolute","fixed"].indexOf(P(a).position)&&F(a)?ra(a):a;return fa(c)?b.filter(function(d){return fa(d)&&Va(d,c)&&"body"!==M(d)}):[]}function Mb(a,b,c){b="clippingParents"===b?Lb(a):[].concat(b);c=[].concat(b,[c]);c=c.reduce(function(d,e){e=bb(a,e);d.top=L(e.top,d.top);d.right=V(e.right,d.right);d.bottom=V(e.bottom,d.bottom);d.left=L(e.left,d.left);return d},bb(a,
c[0]));c.width=c.right-c.left;c.height=c.bottom-c.top;c.x=c.left;c.y=c.top;return c}function cb(a){var b=a.reference,c=a.element,d=(a=a.placement)?N(a):null;a=a?ja(a):null;var e=b.x+b.width/2-c.width/2,f=b.y+b.height/2-c.height/2;switch(d){case "top":e={x:e,y:b.y-c.height};break;case "bottom":e={x:e,y:b.y+b.height};break;case "right":e={x:b.x+b.width,y:f};break;case "left":e={x:b.x-c.width,y:f};break;default:e={x:b.x,y:b.y}}d=d?Ga(d):null;if(null!=d)switch(f="y"===d?"height":"width",a){case "start":e[d]-=
b[f]/2-c[f]/2;break;case "end":e[d]+=b[f]/2-c[f]/2}return e}function ta(a,b){void 0===b&&(b={});var c=b;b=c.placement;b=void 0===b?a.placement:b;var d=c.boundary,e=void 0===d?"clippingParents":d;d=c.rootBoundary;var f=void 0===d?"viewport":d;d=c.elementContext;d=void 0===d?"popper":d;var g=c.altBoundary,l=void 0===g?!1:g;c=c.padding;c=void 0===c?0:c;c=Xa("number"!==typeof c?c:Ya(c,ua));g=a.rects.popper;l=a.elements[l?"popper"===d?"reference":"popper":d];e=Mb(fa(l)?l:l.contextElement||U(a.elements.popper),
e,f);f=ha(a.elements.reference);l=cb({reference:f,element:g,strategy:"absolute",placement:b});g=Ka(Object.assign({},g,l));f="popper"===d?g:f;var m={top:e.top-f.top+c.top,bottom:f.bottom-e.bottom+c.bottom,left:e.left-f.left+c.left,right:f.right-e.right+c.right};a=a.modifiersData.offset;if("popper"===d&&a){var k=a[b];Object.keys(m).forEach(function(p){var q=0<=["right","bottom"].indexOf(p)?1:-1,n=0<=["top","bottom"].indexOf(p)?"y":"x";m[p]+=k[n]*q})}return m}function Nb(a,b){void 0===b&&(b={});var c=
b.boundary,d=b.rootBoundary,e=b.padding,f=b.flipVariations,g=b.allowedAutoPlacements,l=void 0===g?db:g,m=ja(b.placement);b=m?f?eb:eb.filter(function(p){return ja(p)===m}):ua;f=b.filter(function(p){return 0<=l.indexOf(p)});0===f.length&&(f=b);var k=f.reduce(function(p,q){p[q]=ta(a,{placement:q,boundary:c,rootBoundary:d,padding:e})[N(q)];return p},{});return Object.keys(k).sort(function(p,q){return k[p]-k[q]})}function Ob(a){if("auto"===N(a))return[];var b=xa(a);return[$a(a),b,$a(b)]}function fb(a,
b,c){void 0===c&&(c={x:0,y:0});return{top:a.top-b.height-c.y,right:a.right-b.width+c.x,bottom:a.bottom-b.height+c.y,left:a.left-b.width-c.x}}function gb(a){return["top","right","bottom","left"].some(function(b){return 0<=a[b]})}function Pb(a,b,c){void 0===c&&(c=!1);var d=F(b),e;if(e=F(b)){var f=b.getBoundingClientRect();e=ia(f.width)/b.offsetWidth||1;f=ia(f.height)/b.offsetHeight||1;e=1!==e||1!==f}f=e;e=U(b);a=ha(a,f);f={scrollLeft:0,scrollTop:0};var g={x:0,y:0};if(d||!d&&!c){if("body"!==M(b)||Ja(e))f=
b!==K(b)&&F(b)?{scrollLeft:b.scrollLeft,scrollTop:b.scrollTop}:Ha(b);F(b)?(g=ha(b,!0),g.x+=b.clientLeft,g.y+=b.clientTop):e&&(g.x=Ia(e))}return{x:a.left+f.scrollLeft-g.x,y:a.top+f.scrollTop-g.y,width:a.width,height:a.height}}function Qb(a){function b(f){d.add(f.name);[].concat(f.requires||[],f.requiresIfExists||[]).forEach(function(g){d.has(g)||(g=c.get(g))&&b(g)});e.push(f)}var c=new Map,d=new Set,e=[];a.forEach(function(f){c.set(f.name,f)});a.forEach(function(f){d.has(f.name)||b(f)});return e}function Rb(a){var b=
Qb(a);return Sb.reduce(function(c,d){return c.concat(b.filter(function(e){return e.phase===d}))},[])}function Tb(a){var b;return function(){b||(b=new Promise(function(c){Promise.resolve().then(function(){b=void 0;c(a())})}));return b}}function Ub(a){var b=a.reduce(function(c,d){var e=c[d.name];c[d.name]=e?Object.assign({},e,d,{options:Object.assign({},e.options,d.options),data:Object.assign({},e.data,d.data)}):d;return c},{});return Object.keys(b).map(function(c){return b[c]})}function hb(){for(var a=
arguments.length,b=Array(a),c=0;c<a;c++)b[c]=arguments[c];return!b.some(function(d){return!(d&&"function"===typeof d.getBoundingClientRect)})}function La(){La=Object.assign?Object.assign.bind():function(a){for(var b=1;b<arguments.length;b++){var c=arguments[b],d;for(d in c)Object.prototype.hasOwnProperty.call(c,d)&&(a[d]=c[d])}return a};return La.apply(this,arguments)}function Vb(){return[{name:"applyStyles",fn(a){let {state:b}=a;Object.keys(b.elements).forEach(c=>{if("popper"===c){var d=b.attributes[c]||
{},e=b.elements[c];Object.assign(e.style,{position:"fixed",left:"50%",top:"50%",transform:"translate(-50%, -50%)"});Object.keys(d).forEach(f=>{let g=d[f];!1===g?e.removeAttribute(f):e.setAttribute(f,!0===g?"":g)})}})}},{name:"computeStyles",options:{adaptive:!1}}]}function ib(a){return{name:"focusAfterRender",enabled:!0,phase:"afterWrite",fn(){setTimeout(()=>{a.el&&a.el.focus({preventScroll:!0})},300)}}}function jb(a){return qa(a)&&""!==a?"-"!==a.charAt(a.length-1)?`${a}-`:a:""}function Ma(){let a=
Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,b=>{let c=(a+16*Math.random())%16|0;a=Math.floor(a/16);return("x"==b?c:c&3|8).toString(16)})}function kb(a,b){if(a.popperOptions){let c=Object.assign({},b,a.popperOptions);if(a.popperOptions.modifiers&&0<a.popperOptions.modifiers.length){let d=a.popperOptions.modifiers.map(e=>e.name);b=b.modifiers.filter(e=>!d.includes(e.name));c.modifiers=Array.from(new Set([...b,...a.popperOptions.modifiers]))}return c}return b}function G(){}
function Wb(a,b){for(let c in b)a[c]=b[c];return a}function ka(a){return a()}function lb(a){return"function"===typeof a}function Q(a,b){return a!=a?b==b:a!==b||a&&"object"===typeof a||"function"===typeof a}function H(a){a.parentNode.removeChild(a)}function mb(a){return document.createElementNS("http://www.w3.org/2000/svg",a)}function ya(a,b,c,d){a.addEventListener(b,c,d);return()=>a.removeEventListener(b,c,d)}function B(a,b,c){null==c?a.removeAttribute(b):a.getAttribute(b)!==c&&a.setAttribute(b,c)}
function nb(a,b){let c=Object.getOwnPropertyDescriptors(a.__proto__);for(let d in b)null==b[d]?a.removeAttribute(d):"style"===d?a.style.cssText=b[d]:"__value"===d?a.value=a[d]=b[d]:c[d]&&c[d].set?a[d]=b[d]:B(a,d,b[d])}function la(a,b,c){a.classList[c?"add":"remove"](b)}function za(){if(!R)throw Error("Function called outside component initialization");return R}function Na(a){Aa.push(a)}function ob(){let a=R;do{for(;Ba<va.length;){var b=va[Ba];Ba++;R=b;b=b.$$;if(null!==b.fragment){b.update();b.before_update.forEach(ka);
var c=b.dirty;b.dirty=[-1];b.fragment&&b.fragment.p(b.ctx,c);b.after_update.forEach(Na)}}R=null;for(Ba=va.length=0;ma.length;)ma.pop()();for(b=0;b<Aa.length;b+=1)c=Aa[b],Oa.has(c)||(Oa.add(c),c());Aa.length=0}while(va.length);for(;pb.length;)pb.pop()();Pa=!1;Oa.clear();R=a}function aa(){ba={r:0,c:[],p:ba}}function ca(){ba.r||ba.c.forEach(ka);ba=ba.p}function z(a,b){a&&a.i&&(Ca.delete(a),a.i(b))}function C(a,b,c,d){a&&a.o?Ca.has(a)||(Ca.add(a),ba.c.push(()=>{Ca.delete(a);d&&(c&&a.d(1),d())}),a.o(b)):
d&&d()}function da(a){a&&a.c()}function W(a,b,c,d){let {fragment:e,on_mount:f,on_destroy:g,after_update:l}=a.$$;e&&e.m(b,c);d||Na(()=>{let m=f.map(ka).filter(lb);g?g.push(...m):m.forEach(ka);a.$$.on_mount=[]});l.forEach(Na)}function X(a,b){a=a.$$;null!==a.fragment&&(a.on_destroy.forEach(ka),a.fragment&&a.fragment.d(b),a.on_destroy=a.fragment=null,a.ctx=[])}function S(a,b,c,d,e,f,g,l){void 0===l&&(l=[-1]);let m=R;R=a;let k=a.$$={fragment:null,ctx:null,props:f,update:G,not_equal:e,bound:Object.create(null),
on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(b.context||(m?m.$$.context:[])),callbacks:Object.create(null),dirty:l,skip_bound:!1,root:b.target||m.$$.root};g&&g(k.root);let p=!1;k.ctx=c?c(a,b.props||{},function(q,n){let r=(2>=arguments.length?0:arguments.length-2)?2>=arguments.length?void 0:arguments[2]:n;if(k.ctx&&e(k.ctx[q],k.ctx[q]=r)){if(!k.skip_bound&&k.bound[q])k.bound[q](r);p&&(-1===a.$$.dirty[0]&&(va.push(a),Pa||(Pa=!0,Xb.then(ob)),a.$$.dirty.fill(0)),
a.$$.dirty[q/31|0]|=1<<q%31)}return n}):[];k.update();p=!0;k.before_update.forEach(ka);k.fragment=d?d(k.ctx):!1;b.target&&(b.hydrate?(c=Array.from(b.target.childNodes),k.fragment&&k.fragment.l(c),c.forEach(H)):k.fragment&&k.fragment.c(),b.intro&&z(a.$$.fragment),W(a,b.target,b.anchor,b.customElement),ob());R=m}function Yb(a){let b,c,d,e,f;return{c(){b=document.createElement("button");B(b,"aria-label",c=a[3]?a[3]:null);B(b,"class",d=`${a[1]||""} shepherd-button ${a[4]?"shepherd-button-secondary":""}`);
b.disabled=a[2];B(b,"tabindex","0")},m(g,l){g.insertBefore(b,l||null);b.innerHTML=a[5];e||(f=ya(b,"click",function(){lb(a[0])&&a[0].apply(this,arguments)}),e=!0)},p(g,l){[l]=l;a=g;l&32&&(b.innerHTML=a[5]);l&8&&c!==(c=a[3]?a[3]:null)&&B(b,"aria-label",c);l&18&&d!==(d=`${a[1]||""} shepherd-button ${a[4]?"shepherd-button-secondary":""}`)&&B(b,"class",d);l&4&&(b.disabled=a[2])},i:G,o:G,d(g){g&&H(b);e=!1;f()}}}function Zb(a,b,c){function d(n){return Z(n)?n.call(f):n}let {config:e,step:f}=b,g,l,m,k,p,q;
a.$$set=n=>{"config"in n&&c(6,e=n.config);"step"in n&&c(7,f=n.step)};a.$$.update=()=>{a.$$.dirty&192&&(c(0,g=e.action?e.action.bind(f.tour):null),c(1,l=e.classes),c(2,m=e.disabled?d(e.disabled):!1),c(3,k=e.label?d(e.label):null),c(4,p=e.secondary),c(5,q=e.text?d(e.text):null))};return[g,l,m,k,p,q,e,f]}function qb(a,b,c){a=a.slice();a[2]=b[c];return a}function rb(a){let b,c,d=a[1],e=[];for(let g=0;g<d.length;g+=1)e[g]=sb(qb(a,d,g));let f=g=>C(e[g],1,1,()=>{e[g]=null});return{c(){for(let g=0;g<e.length;g+=
1)e[g].c();b=document.createTextNode("")},m(g,l){for(let m=0;m<e.length;m+=1)e[m].m(g,l);g.insertBefore(b,l||null);c=!0},p(g,l){if(l&3){d=g[1];let m;for(m=0;m<d.length;m+=1){let k=qb(g,d,m);e[m]?(e[m].p(k,l),z(e[m],1)):(e[m]=sb(k),e[m].c(),z(e[m],1),e[m].m(b.parentNode,b))}aa();for(m=d.length;m<e.length;m+=1)f(m);ca()}},i(g){if(!c){for(g=0;g<d.length;g+=1)z(e[g]);c=!0}},o(g){e=e.filter(Boolean);for(g=0;g<e.length;g+=1)C(e[g]);c=!1},d(g){var l=e;for(let m=0;m<l.length;m+=1)l[m]&&l[m].d(g);g&&H(b)}}}
function sb(a){let b,c;b=new $b({props:{config:a[2],step:a[0]}});return{c(){da(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&2&&(f.config=d[2]);e&1&&(f.step=d[0]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function ac(a){let b,c,d=a[1]&&rb(a);return{c(){b=document.createElement("footer");d&&d.c();B(b,"class","shepherd-footer")},m(e,f){e.insertBefore(b,f||null);d&&d.m(b,null);c=!0},p(e,f){[f]=f;e[1]?d?(d.p(e,f),f&2&&z(d,1)):(d=rb(e),d.c(),z(d,
1),d.m(b,null)):d&&(aa(),C(d,1,1,()=>{d=null}),ca())},i(e){c||(z(d),c=!0)},o(e){C(d);c=!1},d(e){e&&H(b);d&&d.d()}}}function bc(a,b,c){let d,{step:e}=b;a.$$set=f=>{"step"in f&&c(0,e=f.step)};a.$$.update=()=>{a.$$.dirty&1&&c(1,d=e.options.buttons)};return[e,d]}function cc(a){let b,c,d,e,f;return{c(){b=document.createElement("button");c=document.createElement("span");c.textContent="\u00d7";B(c,"aria-hidden","true");B(b,"aria-label",d=a[0].label?a[0].label:"Close Tour");B(b,"class","shepherd-cancel-icon");
B(b,"type","button")},m(g,l){g.insertBefore(b,l||null);b.appendChild(c);e||(f=ya(b,"click",a[1]),e=!0)},p(g,l){[l]=l;l&1&&d!==(d=g[0].label?g[0].label:"Close Tour")&&B(b,"aria-label",d)},i:G,o:G,d(g){g&&H(b);e=!1;f()}}}function dc(a,b,c){let {cancelIcon:d,step:e}=b;a.$$set=f=>{"cancelIcon"in f&&c(0,d=f.cancelIcon);"step"in f&&c(2,e=f.step)};return[d,f=>{f.preventDefault();e.cancel()},e]}function ec(a){let b;return{c(){b=document.createElement("h3");B(b,"id",a[1]);B(b,"class","shepherd-title")},m(c,
d){c.insertBefore(b,d||null);a[3](b)},p(c,d){[d]=d;d&2&&B(b,"id",c[1])},i:G,o:G,d(c){c&&H(b);a[3](null)}}}function fc(a,b,c){let {labelId:d,element:e,title:f}=b;za().$$.after_update.push(()=>{Z(f)&&c(2,f=f());c(0,e.innerHTML=f,e)});a.$$set=g=>{"labelId"in g&&c(1,d=g.labelId);"element"in g&&c(0,e=g.element);"title"in g&&c(2,f=g.title)};return[e,d,f,function(g){ma[g?"unshift":"push"](()=>{e=g;c(0,e)})}]}function tb(a){let b,c;b=new gc({props:{labelId:a[0],title:a[2]}});return{c(){da(b.$$.fragment)},
m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&1&&(f.labelId=d[0]);e&4&&(f.title=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function ub(a){let b,c;b=new hc({props:{cancelIcon:a[3],step:a[1]}});return{c(){da(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&8&&(f.cancelIcon=d[3]);e&2&&(f.step=d[1]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function ic(a){let b,c,d,e=a[2]&&tb(a),f=a[3]&&a[3].enabled&&
ub(a);return{c(){b=document.createElement("header");e&&e.c();c=document.createTextNode(" ");f&&f.c();B(b,"class","shepherd-header")},m(g,l){g.insertBefore(b,l||null);e&&e.m(b,null);b.appendChild(c);f&&f.m(b,null);d=!0},p(g,l){[l]=l;g[2]?e?(e.p(g,l),l&4&&z(e,1)):(e=tb(g),e.c(),z(e,1),e.m(b,c)):e&&(aa(),C(e,1,1,()=>{e=null}),ca());g[3]&&g[3].enabled?f?(f.p(g,l),l&8&&z(f,1)):(f=ub(g),f.c(),z(f,1),f.m(b,null)):f&&(aa(),C(f,1,1,()=>{f=null}),ca())},i(g){d||(z(e),z(f),d=!0)},o(g){C(e);C(f);d=!1},d(g){g&&
H(b);e&&e.d();f&&f.d()}}}function jc(a,b,c){let {labelId:d,step:e}=b,f,g;a.$$set=l=>{"labelId"in l&&c(0,d=l.labelId);"step"in l&&c(1,e=l.step)};a.$$.update=()=>{a.$$.dirty&2&&(c(2,f=e.options.title),c(3,g=e.options.cancelIcon))};return[d,e,f,g]}function kc(a){let b;return{c(){b=document.createElement("div");B(b,"class","shepherd-text");B(b,"id",a[1])},m(c,d){c.insertBefore(b,d||null);a[3](b)},p(c,d){[d]=d;d&2&&B(b,"id",c[1])},i:G,o:G,d(c){c&&H(b);a[3](null)}}}function lc(a,b,c){let {descriptionId:d,
element:e,step:f}=b;za().$$.after_update.push(()=>{let {text:g}=f.options;Z(g)&&(g=g.call(f));g instanceof HTMLElement?e.appendChild(g):c(0,e.innerHTML=g,e)});a.$$set=g=>{"descriptionId"in g&&c(1,d=g.descriptionId);"element"in g&&c(0,e=g.element);"step"in g&&c(2,f=g.step)};return[e,d,f,function(g){ma[g?"unshift":"push"](()=>{e=g;c(0,e)})}]}function vb(a){let b,c;b=new mc({props:{labelId:a[1],step:a[2]}});return{c(){da(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&2&&(f.labelId=d[1]);e&4&&
(f.step=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function wb(a){let b,c;b=new nc({props:{descriptionId:a[0],step:a[2]}});return{c(){da(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&1&&(f.descriptionId=d[0]);e&4&&(f.step=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function xb(a){let b,c;b=new oc({props:{step:a[2]}});return{c(){da(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};
e&4&&(f.step=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function pc(a){let b,c=void 0!==a[2].options.title||a[2].options.cancelIcon&&a[2].options.cancelIcon.enabled,d,e=void 0!==a[2].options.text,f,g=Array.isArray(a[2].options.buttons)&&a[2].options.buttons.length,l,m=c&&vb(a),k=e&&wb(a),p=g&&xb(a);return{c(){b=document.createElement("div");m&&m.c();d=document.createTextNode(" ");k&&k.c();f=document.createTextNode(" ");p&&p.c();B(b,"class","shepherd-content")},
m(q,n){q.insertBefore(b,n||null);m&&m.m(b,null);b.appendChild(d);k&&k.m(b,null);b.appendChild(f);p&&p.m(b,null);l=!0},p(q,n){[n]=n;n&4&&(c=void 0!==q[2].options.title||q[2].options.cancelIcon&&q[2].options.cancelIcon.enabled);c?m?(m.p(q,n),n&4&&z(m,1)):(m=vb(q),m.c(),z(m,1),m.m(b,d)):m&&(aa(),C(m,1,1,()=>{m=null}),ca());n&4&&(e=void 0!==q[2].options.text);e?k?(k.p(q,n),n&4&&z(k,1)):(k=wb(q),k.c(),z(k,1),k.m(b,f)):k&&(aa(),C(k,1,1,()=>{k=null}),ca());n&4&&(g=Array.isArray(q[2].options.buttons)&&q[2].options.buttons.length);
g?p?(p.p(q,n),n&4&&z(p,1)):(p=xb(q),p.c(),z(p,1),p.m(b,null)):p&&(aa(),C(p,1,1,()=>{p=null}),ca())},i(q){l||(z(m),z(k),z(p),l=!0)},o(q){C(m);C(k);C(p);l=!1},d(q){q&&H(b);m&&m.d();k&&k.d();p&&p.d()}}}function qc(a,b,c){let {descriptionId:d,labelId:e,step:f}=b;a.$$set=g=>{"descriptionId"in g&&c(0,d=g.descriptionId);"labelId"in g&&c(1,e=g.labelId);"step"in g&&c(2,f=g.step)};return[d,e,f]}function yb(a){let b;return{c(){b=document.createElement("div");B(b,"class","shepherd-arrow");B(b,"data-popper-arrow",
"")},m(c,d){c.insertBefore(b,d||null)},d(c){c&&H(b)}}}function rc(a){let b,c,d,e,f,g,l,m,k=a[4].options.arrow&&a[4].options.attachTo&&a[4].options.attachTo.element&&a[4].options.attachTo.on&&yb();d=new sc({props:{descriptionId:a[2],labelId:a[3],step:a[4]}});let p=[{"aria-describedby":e=void 0!==a[4].options.text?a[2]:null},{"aria-labelledby":f=a[4].options.title?a[3]:null},a[1],{role:"dialog"},{tabindex:"0"}],q={};for(let n=0;n<p.length;n+=1)q=Wb(q,p[n]);return{c(){b=document.createElement("div");
k&&k.c();c=document.createTextNode(" ");da(d.$$.fragment);nb(b,q);la(b,"shepherd-has-cancel-icon",a[5]);la(b,"shepherd-has-title",a[6]);la(b,"shepherd-element",!0)},m(n,r){n.insertBefore(b,r||null);k&&k.m(b,null);b.appendChild(c);W(d,b,null);a[13](b);g=!0;l||(m=ya(b,"keydown",a[7]),l=!0)},p(n,r){var [x]=r;n[4].options.arrow&&n[4].options.attachTo&&n[4].options.attachTo.element&&n[4].options.attachTo.on?k||(k=yb(),k.c(),k.m(b,c)):k&&(k.d(1),k=null);r={};x&4&&(r.descriptionId=n[2]);x&8&&(r.labelId=
n[3]);x&16&&(r.step=n[4]);d.$set(r);r=b;x=[(!g||x&20&&e!==(e=void 0!==n[4].options.text?n[2]:null))&&{"aria-describedby":e},(!g||x&24&&f!==(f=n[4].options.title?n[3]:null))&&{"aria-labelledby":f},x&2&&n[1],{role:"dialog"},{tabindex:"0"}];let h={},t={},v={$$scope:1},A=p.length;for(;A--;){let u=p[A],w=x[A];if(w){for(let y in u)y in w||(t[y]=1);for(let y in w)v[y]||(h[y]=w[y],v[y]=1);p[A]=w}else for(let y in u)v[y]=1}for(let u in t)u in h||(h[u]=void 0);nb(r,q=h);la(b,"shepherd-has-cancel-icon",n[5]);
la(b,"shepherd-has-title",n[6]);la(b,"shepherd-element",!0)},i(n){g||(z(d.$$.fragment,n),g=!0)},o(n){C(d.$$.fragment,n);g=!1},d(n){n&&H(b);k&&k.d();X(d);a[13](null);l=!1;m()}}}function zb(a){return a.split(" ").filter(b=>!!b.length)}function tc(a,b,c){let {classPrefix:d,element:e,descriptionId:f,firstFocusableElement:g,focusableElements:l,labelId:m,lastFocusableElement:k,step:p,dataStepId:q}=b,n,r,x;za().$$.on_mount.push(()=>{c(1,q={[`data-${d}shepherd-step-id`]:p.id});c(9,l=e.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'));
c(8,g=l[0]);c(10,k=l[l.length-1])});za().$$.after_update.push(()=>{if(x!==p.options.classes){var h=x;qa(h)&&(h=zb(h),h.length&&e.classList.remove(...h));h=x=p.options.classes;qa(h)&&(h=zb(h),h.length&&e.classList.add(...h))}});a.$$set=h=>{"classPrefix"in h&&c(11,d=h.classPrefix);"element"in h&&c(0,e=h.element);"descriptionId"in h&&c(2,f=h.descriptionId);"firstFocusableElement"in h&&c(8,g=h.firstFocusableElement);"focusableElements"in h&&c(9,l=h.focusableElements);"labelId"in h&&c(3,m=h.labelId);"lastFocusableElement"in
h&&c(10,k=h.lastFocusableElement);"step"in h&&c(4,p=h.step);"dataStepId"in h&&c(1,q=h.dataStepId)};a.$$.update=()=>{a.$$.dirty&16&&(c(5,n=p.options&&p.options.cancelIcon&&p.options.cancelIcon.enabled),c(6,r=p.options&&p.options.title))};return[e,q,f,m,p,n,r,h=>{const {tour:t}=p;switch(h.keyCode){case 9:if(0===l.length){h.preventDefault();break}if(h.shiftKey){if(document.activeElement===g||document.activeElement.classList.contains("shepherd-element"))h.preventDefault(),k.focus()}else document.activeElement===
k&&(h.preventDefault(),g.focus());break;case 27:t.options.exitOnEsc&&p.cancel();break;case 37:t.options.keyboardNavigation&&t.back();break;case 39:t.options.keyboardNavigation&&t.next()}},g,l,k,d,()=>e,function(h){ma[h?"unshift":"push"](()=>{e=h;c(0,e)})}]}function uc(a){a&&({steps:a}=a,a.forEach(b=>{b.options&&!1===b.options.canClickTarget&&b.options.attachTo&&b.target instanceof HTMLElement&&b.target.classList.remove("shepherd-target-click-disabled")}))}function vc(a){let b,c,d,e,f;return{c(){b=
mb("svg");c=mb("path");B(c,"d",a[2]);B(b,"class",d=`${a[1]?"shepherd-modal-is-visible":""} shepherd-modal-overlay-container`)},m(g,l){g.insertBefore(b,l||null);b.appendChild(c);a[11](b);e||(f=ya(b,"touchmove",a[3]),e=!0)},p(g,l){[l]=l;l&4&&B(c,"d",g[2]);l&2&&d!==(d=`${g[1]?"shepherd-modal-is-visible":""} shepherd-modal-overlay-container`)&&B(b,"class",d)},i:G,o:G,d(g){g&&H(b);a[11](null);e=!1;f()}}}function Ab(a){if(!a)return null;let b=a instanceof HTMLElement&&window.getComputedStyle(a).overflowY;
return"hidden"!==b&&"visible"!==b&&a.scrollHeight>=a.clientHeight?a:Ab(a.parentElement)}function wc(a,b,c){function d(){c(4,p={width:0,height:0,x:0,y:0,r:0})}function e(){c(1,q=!1);l()}function f(h,t,v,A){void 0===h&&(h=0);void 0===t&&(t=0);if(A){var u=A.getBoundingClientRect();let y=u.y||u.top;u=u.bottom||y+u.height;if(v){var w=v.getBoundingClientRect();v=w.y||w.top;w=w.bottom||v+w.height;y=Math.max(y,v);u=Math.min(u,w)}let {y:Y,height:E}={y,height:Math.max(u-y,0)},{x:I,width:D,left:na}=A.getBoundingClientRect();
c(4,p={width:D+2*h,height:E+2*h,x:(I||na)-h,y:Y-h,r:t})}else d()}function g(){c(1,q=!0)}function l(){n&&(cancelAnimationFrame(n),n=void 0);window.removeEventListener("touchmove",x,{passive:!1})}function m(h){let {modalOverlayOpeningPadding:t,modalOverlayOpeningRadius:v}=h.options,A=Ab(h.target),u=()=>{n=void 0;f(t,v,A,h.target);n=requestAnimationFrame(u)};u();window.addEventListener("touchmove",x,{passive:!1})}let {element:k,openingProperties:p}=b;Ma();let q=!1,n=void 0,r;d();let x=h=>{h.preventDefault()};
a.$$set=h=>{"element"in h&&c(0,k=h.element);"openingProperties"in h&&c(4,p=h.openingProperties)};a.$$.update=()=>{if(a.$$.dirty&16){let {width:h,height:t,x:v=0,y:A=0,r:u=0}=p,{innerWidth:w,innerHeight:y}=window;c(2,r=`M${w},${y}\
H0\
V0\
H${w}\
V${y}\
Z\
M${v+u},${A}\
a${u},${u},0,0,0-${u},${u}\
V${t+A-u}\
a${u},${u},0,0,0,${u},${u}\
H${h+v-u}\
a${u},${u},0,0,0,${u}-${u}\
V${A+u}\
a${u},${u},0,0,0-${u}-${u}\
Z`)}};return[k,q,r,h=>{h.stopPropagation()},p,()=>k,d,e,f,function(h){l();h.tour.options.useModalOverlay?(m(h),g()):e()},g,function(h){ma[h?"unshift":"push"](()=>{k=h;c(0,k)})}]}var Fb=function(a){var b;if(b=!!a&&"object"===typeof a)b=Object.prototype.toString.call(a),b=!("[object RegExp]"===b||"[object Date]"===b||a.$$typeof===xc);return b},xc="function"===typeof Symbol&&Symbol.for?Symbol.for("react.element"):60103;ea.all=function(a,b){if(!Array.isArray(a))throw Error("first argument should be an array");
return a.reduce(function(c,d){return ea(c,d,b)},{})};var yc=ea;class Qa{on(a,b,c,d){void 0===d&&(d=!1);void 0===this.bindings&&(this.bindings={});void 0===this.bindings[a]&&(this.bindings[a]=[]);this.bindings[a].push({handler:b,ctx:c,once:d});return this}once(a,b,c){return this.on(a,b,c,!0)}off(a,b){if(void 0===this.bindings||void 0===this.bindings[a])return this;void 0===b?delete this.bindings[a]:this.bindings[a].forEach((c,d)=>{c.handler===b&&this.bindings[a].splice(d,1)});return this}trigger(a){for(var b=
arguments.length,c=Array(1<b?b-1:0),d=1;d<b;d++)c[d-1]=arguments[d];void 0!==this.bindings&&this.bindings[a]&&this.bindings[a].forEach((e,f)=>{let {ctx:g,handler:l,once:m}=e;l.apply(g||this,c);m&&this.bindings[a].splice(f,1)});return this}}var ua=["top","bottom","right","left"],eb=ua.reduce(function(a,b){return a.concat([b+"-start",b+"-end"])},[]),db=[].concat(ua,["auto"]).reduce(function(a,b){return a.concat([b,b+"-start",b+"-end"])},[]),Sb="beforeRead read afterRead beforeMain main afterMain beforeWrite write afterWrite".split(" "),
L=Math.max,V=Math.min,ia=Math.round,Ib={top:"auto",right:"auto",bottom:"auto",left:"auto"},Da={passive:!0},Jb={left:"right",right:"left",bottom:"top",top:"bottom"},Kb={start:"end",end:"start"},Bb={placement:"bottom",modifiers:[],strategy:"absolute"},zc=function(a){void 0===a&&(a={});var b=a.defaultModifiers,c=void 0===b?[]:b;a=a.defaultOptions;var d=void 0===a?Bb:a;return function(e,f,g){function l(){k.orderedModifiers.forEach(function(r){var x=r.name,h=r.options;h=void 0===h?{}:h;r=r.effect;"function"===
typeof r&&(x=r({state:k,name:x,instance:n,options:h}),p.push(x||function(){}))})}function m(){p.forEach(function(r){return r()});p=[]}void 0===g&&(g=d);var k={placement:"bottom",orderedModifiers:[],options:Object.assign({},Bb,d),modifiersData:{},elements:{reference:e,popper:f},attributes:{},styles:{}},p=[],q=!1,n={state:k,setOptions:function(r){r="function"===typeof r?r(k.options):r;m();k.options=Object.assign({},d,k.options,r);k.scrollParents={reference:fa(e)?sa(e):e.contextElement?sa(e.contextElement):
[],popper:sa(f)};r=Rb(Ub([].concat(c,k.options.modifiers)));k.orderedModifiers=r.filter(function(x){return x.enabled});l();return n.update()},forceUpdate:function(){if(!q){var r=k.elements,x=r.reference;r=r.popper;if(hb(x,r))for(k.rects={reference:Pb(x,ra(r),"fixed"===k.options.strategy),popper:Fa(r)},k.reset=!1,k.placement=k.options.placement,k.orderedModifiers.forEach(function(v){return k.modifiersData[v.name]=Object.assign({},v.data)}),x=0;x<k.orderedModifiers.length;x++)if(!0===k.reset)k.reset=
!1,x=-1;else{var h=k.orderedModifiers[x];r=h.fn;var t=h.options;t=void 0===t?{}:t;h=h.name;"function"===typeof r&&(k=r({state:k,options:t,name:h,instance:n})||k)}}},update:Tb(function(){return new Promise(function(r){n.forceUpdate();r(k)})}),destroy:function(){m();q=!0}};if(!hb(e,f))return n;n.setOptions(g).then(function(r){if(!q&&g.onFirstUpdate)g.onFirstUpdate(r)});return n}}({defaultModifiers:[{name:"eventListeners",enabled:!0,phase:"write",fn:function(){},effect:function(a){var b=a.state,c=a.instance;
a=a.options;var d=a.scroll,e=void 0===d?!0:d;a=a.resize;var f=void 0===a?!0:a,g=K(b.elements.popper),l=[].concat(b.scrollParents.reference,b.scrollParents.popper);e&&l.forEach(function(m){m.addEventListener("scroll",c.update,Da)});f&&g.addEventListener("resize",c.update,Da);return function(){e&&l.forEach(function(m){m.removeEventListener("scroll",c.update,Da)});f&&g.removeEventListener("resize",c.update,Da)}},data:{}},{name:"popperOffsets",enabled:!0,phase:"read",fn:function(a){var b=a.state;b.modifiersData[a.name]=
cb({reference:b.rects.reference,element:b.rects.popper,strategy:"absolute",placement:b.placement})},data:{}},{name:"computeStyles",enabled:!0,phase:"beforeWrite",fn:function(a){var b=a.state,c=a.options;a=c.gpuAcceleration;a=void 0===a?!0:a;var d=c.adaptive;d=void 0===d?!0:d;c=c.roundOffsets;c=void 0===c?!0:c;a={placement:N(b.placement),variation:ja(b.placement),popper:b.elements.popper,popperRect:b.rects.popper,gpuAcceleration:a,isFixed:"fixed"===b.options.strategy};null!=b.modifiersData.popperOffsets&&
(b.styles.popper=Object.assign({},b.styles.popper,Za(Object.assign({},a,{offsets:b.modifiersData.popperOffsets,position:b.options.strategy,adaptive:d,roundOffsets:c}))));null!=b.modifiersData.arrow&&(b.styles.arrow=Object.assign({},b.styles.arrow,Za(Object.assign({},a,{offsets:b.modifiersData.arrow,position:"absolute",adaptive:!1,roundOffsets:c}))));b.attributes.popper=Object.assign({},b.attributes.popper,{"data-popper-placement":b.placement})},data:{}},{name:"applyStyles",enabled:!0,phase:"write",
fn:function(a){var b=a.state;Object.keys(b.elements).forEach(function(c){var d=b.styles[c]||{},e=b.attributes[c]||{},f=b.elements[c];F(f)&&M(f)&&(Object.assign(f.style,d),Object.keys(e).forEach(function(g){var l=e[g];!1===l?f.removeAttribute(g):f.setAttribute(g,!0===l?"":l)}))})},effect:function(a){var b=a.state,c={popper:{position:b.options.strategy,left:"0",top:"0",margin:"0"},arrow:{position:"absolute"},reference:{}};Object.assign(b.elements.popper.style,c.popper);b.styles=c;b.elements.arrow&&
Object.assign(b.elements.arrow.style,c.arrow);return function(){Object.keys(b.elements).forEach(function(d){var e=b.elements[d],f=b.attributes[d]||{};d=Object.keys(b.styles.hasOwnProperty(d)?b.styles[d]:c[d]).reduce(function(g,l){g[l]="";return g},{});F(e)&&M(e)&&(Object.assign(e.style,d),Object.keys(f).forEach(function(g){e.removeAttribute(g)}))})}},requires:["computeStyles"]},{name:"offset",enabled:!0,phase:"main",requires:["popperOffsets"],fn:function(a){var b=a.state,c=a.name;a=a.options.offset;
var d=void 0===a?[0,0]:a;a=db.reduce(function(g,l){var m=b.rects;var k=N(l);var p=0<=["left","top"].indexOf(k)?-1:1,q="function"===typeof d?d(Object.assign({},m,{placement:l})):d;m=q[0];q=q[1];m=m||0;q=(q||0)*p;k=0<=["left","right"].indexOf(k)?{x:q,y:m}:{x:m,y:q};g[l]=k;return g},{});var e=a[b.placement],f=e.x;e=e.y;null!=b.modifiersData.popperOffsets&&(b.modifiersData.popperOffsets.x+=f,b.modifiersData.popperOffsets.y+=e);b.modifiersData[c]=a}},{name:"flip",enabled:!0,phase:"main",fn:function(a){var b=
a.state,c=a.options;a=a.name;if(!b.modifiersData[a]._skip){var d=c.mainAxis;d=void 0===d?!0:d;var e=c.altAxis;e=void 0===e?!0:e;var f=c.fallbackPlacements,g=c.padding,l=c.boundary,m=c.rootBoundary,k=c.altBoundary,p=c.flipVariations,q=void 0===p?!0:p,n=c.allowedAutoPlacements;c=b.options.placement;p=N(c);f=f||(p!==c&&q?Ob(c):[xa(c)]);var r=[c].concat(f).reduce(function(E,I){return E.concat("auto"===N(I)?Nb(b,{placement:I,boundary:l,rootBoundary:m,padding:g,flipVariations:q,allowedAutoPlacements:n}):
I)},[]);c=b.rects.reference;f=b.rects.popper;var x=new Map;p=!0;for(var h=r[0],t=0;t<r.length;t++){var v=r[t],A=N(v),u="start"===ja(v),w=0<=["top","bottom"].indexOf(A),y=w?"width":"height",Y=ta(b,{placement:v,boundary:l,rootBoundary:m,altBoundary:k,padding:g});u=w?u?"right":"left":u?"bottom":"top";c[y]>f[y]&&(u=xa(u));y=xa(u);w=[];d&&w.push(0>=Y[A]);e&&w.push(0>=Y[u],0>=Y[y]);if(w.every(function(E){return E})){h=v;p=!1;break}x.set(v,w)}if(p)for(d=function(E){var I=r.find(function(D){if(D=x.get(D))return D.slice(0,
E).every(function(na){return na})});if(I)return h=I,"break"},e=q?3:1;0<e&&"break"!==d(e);e--);b.placement!==h&&(b.modifiersData[a]._skip=!0,b.placement=h,b.reset=!0)}},requiresIfExists:["offset"],data:{_skip:!1}},{name:"preventOverflow",enabled:!0,phase:"main",fn:function(a){var b=a.state,c=a.options;a=a.name;var d=c.mainAxis,e=void 0===d?!0:d;d=c.altAxis;var f=void 0===d?!1:d;d=c.tether;var g=void 0===d?!0:d;d=c.tetherOffset;var l=void 0===d?0:d,m=ta(b,{boundary:c.boundary,rootBoundary:c.rootBoundary,
padding:c.padding,altBoundary:c.altBoundary}),k=N(b.placement),p=ja(b.placement),q=!p,n=Ga(k);c="x"===n?"y":"x";d=b.modifiersData.popperOffsets;var r=b.rects.reference,x=b.rects.popper;l="function"===typeof l?l(Object.assign({},b.rects,{placement:b.placement})):l;var h="number"===typeof l?{mainAxis:l,altAxis:l}:Object.assign({mainAxis:0,altAxis:0},l),t=b.modifiersData.offset?b.modifiersData.offset[b.placement]:null;l={x:0,y:0};if(d){if(e){var v,A="y"===n?"top":"left",u="y"===n?"bottom":"right",w=
"y"===n?"height":"width";e=d[n];var y=e+m[A],Y=e-m[u],E=g?-x[w]/2:0,I="start"===p?r[w]:x[w];p="start"===p?-x[w]:-r[w];var D=b.elements.arrow;D=g&&D?Fa(D):{width:0,height:0};var na=b.modifiersData["arrow#persistent"]?b.modifiersData["arrow#persistent"].padding:{top:0,right:0,bottom:0,left:0};A=na[A];u=na[u];D=L(0,V(r[w],D[w]));I=q?r[w]/2-E-D-A-h.mainAxis:I-D-A-h.mainAxis;q=q?-r[w]/2+E+D+u+h.mainAxis:p+D+u+h.mainAxis;w=(w=b.elements.arrow&&ra(b.elements.arrow))?"y"===n?w.clientTop||0:w.clientLeft||
0:0;E=null!=(v=null==t?void 0:t[n])?v:0;v=e+q-E;y=g?V(y,e+I-E-w):y;v=g?L(Y,v):Y;v=L(y,V(e,v));d[n]=v;l[n]=v-e}if(f){var J;f=d[c];e="y"===c?"height":"width";v=f+m["x"===n?"top":"left"];m=f-m["x"===n?"bottom":"right"];k=-1!==["top","left"].indexOf(k);n=null!=(J=null==t?void 0:t[c])?J:0;J=k?v:f-r[e]-x[e]-n+h.altAxis;r=k?f+r[e]+x[e]-n-h.altAxis:m;g&&k?(J=L(J,V(f,r)),J=J>r?r:J):J=L(g?J:v,V(f,g?r:m));d[c]=J;l[c]=J-f}b.modifiersData[a]=l}},requiresIfExists:["offset"]},{name:"arrow",enabled:!0,phase:"main",
fn:function(a){var b,c=a.state,d=a.name,e=a.options,f=c.elements.arrow,g=c.modifiersData.popperOffsets,l=N(c.placement);a=Ga(l);l=0<=["left","right"].indexOf(l)?"height":"width";if(f&&g){e=e.padding;e="function"===typeof e?e(Object.assign({},c.rects,{placement:c.placement})):e;e=Xa("number"!==typeof e?e:Ya(e,ua));var m=Fa(f),k="y"===a?"top":"left",p="y"===a?"bottom":"right",q=c.rects.reference[l]+c.rects.reference[a]-g[a]-c.rects.popper[l];g=g[a]-c.rects.reference[a];f=(f=ra(f))?"y"===a?f.clientHeight||
0:f.clientWidth||0:0;g=f/2-m[l]/2+(q/2-g/2);l=L(e[k],V(g,f-m[l]-e[p]));c.modifiersData[d]=(b={},b[a]=l,b.centerOffset=l-g,b)}},effect:function(a){var b=a.state;a=a.options.element;a=void 0===a?"[data-popper-arrow]":a;if(null!=a){if("string"===typeof a&&(a=b.elements.popper.querySelector(a),!a))return;Va(b.elements.popper,a)&&(b.elements.arrow=a)}},requires:["popperOffsets"],requiresIfExists:["preventOverflow"]},{name:"hide",enabled:!0,phase:"main",requiresIfExists:["preventOverflow"],fn:function(a){var b=
a.state;a=a.name;var c=b.rects.reference,d=b.rects.popper,e=b.modifiersData.preventOverflow,f=ta(b,{elementContext:"reference"}),g=ta(b,{altBoundary:!0});c=fb(f,c);d=fb(g,d,e);e=gb(c);g=gb(d);b.modifiersData[a]={referenceClippingOffsets:c,popperEscapeOffsets:d,isReferenceHidden:e,hasPopperEscaped:g};b.attributes.popper=Object.assign({},b.attributes.popper,{"data-popper-reference-hidden":e,"data-popper-escaped":g})}}]});let R,va=[],ma=[],Aa=[],pb=[],Xb=Promise.resolve(),Pa=!1,Oa=new Set,Ba=0,Ca=new Set,
ba;class T{$destroy(){X(this,1);this.$destroy=G}$on(a,b){let c=this.$$.callbacks[a]||(this.$$.callbacks[a]=[]);c.push(b);return()=>{let d=c.indexOf(b);-1!==d&&c.splice(d,1)}}$set(a){this.$$set&&0!==Object.keys(a).length&&(this.$$.skip_bound=!0,this.$$set(a),this.$$.skip_bound=!1)}}class $b extends T{constructor(a){super();S(this,a,Zb,Yb,Q,{config:6,step:7})}}class oc extends T{constructor(a){super();S(this,a,bc,ac,Q,{step:0})}}class hc extends T{constructor(a){super();S(this,a,dc,cc,Q,{cancelIcon:0,
step:2})}}class gc extends T{constructor(a){super();S(this,a,fc,ec,Q,{labelId:1,element:0,title:2})}}class mc extends T{constructor(a){super();S(this,a,jc,ic,Q,{labelId:0,step:1})}}class nc extends T{constructor(a){super();S(this,a,lc,kc,Q,{descriptionId:1,element:0,step:2})}}class sc extends T{constructor(a){super();S(this,a,qc,pc,Q,{descriptionId:0,labelId:1,step:2})}}class Ac extends T{constructor(a){super();S(this,a,tc,rc,Q,{classPrefix:11,element:0,descriptionId:2,firstFocusableElement:8,focusableElements:9,
labelId:3,lastFocusableElement:10,step:4,dataStepId:1,getElement:12})}get getElement(){return this.$$.ctx[12]}}var Cb=function(a,b){return b={exports:{}},a(b,b.exports),b.exports}(function(a,b){(function(){a.exports={polyfill:function(){function c(h,t){this.scrollLeft=h;this.scrollTop=t}function d(h){if(null===h||"object"!==typeof h||void 0===h.behavior||"auto"===h.behavior||"instant"===h.behavior)return!0;if("object"===typeof h&&"smooth"===h.behavior)return!1;throw new TypeError("behavior member of ScrollOptions "+
h.behavior+" is not a valid value for enumeration ScrollBehavior.");}function e(h,t){if("Y"===t)return h.clientHeight+x<h.scrollHeight;if("X"===t)return h.clientWidth+x<h.scrollWidth}function f(h,t){h=k.getComputedStyle(h,null)["overflow"+t];return"auto"===h||"scroll"===h}function g(h){var t=e(h,"Y")&&f(h,"Y");h=e(h,"X")&&f(h,"X");return t||h}function l(h){var t=(r()-h.startTime)/468;var v=.5*(1-Math.cos(Math.PI*(1<t?1:t)));t=h.startX+(h.x-h.startX)*v;v=h.startY+(h.y-h.startY)*v;h.method.call(h.scrollable,
t,v);t===h.x&&v===h.y||k.requestAnimationFrame(l.bind(k,h))}function m(h,t,v){var A=r();if(h===p.body){var u=k;var w=k.scrollX||k.pageXOffset;h=k.scrollY||k.pageYOffset;var y=n.scroll}else u=h,w=h.scrollLeft,h=h.scrollTop,y=c;l({scrollable:u,method:y,startTime:A,startX:w,startY:h,x:t,y:v})}var k=window,p=document;if(!("scrollBehavior"in p.documentElement.style&&!0!==k.__forceSmoothScrollPolyfill__)){var q=k.HTMLElement||k.Element,n={scroll:k.scroll||k.scrollTo,scrollBy:k.scrollBy,elementScroll:q.prototype.scroll||
c,scrollIntoView:q.prototype.scrollIntoView},r=k.performance&&k.performance.now?k.performance.now.bind(k.performance):Date.now,x=/MSIE |Trident\/|Edge\//.test(k.navigator.userAgent)?1:0;k.scroll=k.scrollTo=function(h,t){void 0!==h&&(!0===d(h)?n.scroll.call(k,void 0!==h.left?h.left:"object"!==typeof h?h:k.scrollX||k.pageXOffset,void 0!==h.top?h.top:void 0!==t?t:k.scrollY||k.pageYOffset):m.call(k,p.body,void 0!==h.left?~~h.left:k.scrollX||k.pageXOffset,void 0!==h.top?~~h.top:k.scrollY||k.pageYOffset))};
k.scrollBy=function(h,t){void 0!==h&&(d(h)?n.scrollBy.call(k,void 0!==h.left?h.left:"object"!==typeof h?h:0,void 0!==h.top?h.top:void 0!==t?t:0):m.call(k,p.body,~~h.left+(k.scrollX||k.pageXOffset),~~h.top+(k.scrollY||k.pageYOffset)))};q.prototype.scroll=q.prototype.scrollTo=function(h,t){if(void 0!==h)if(!0===d(h)){if("number"===typeof h&&void 0===t)throw new SyntaxError("Value could not be converted");n.elementScroll.call(this,void 0!==h.left?~~h.left:"object"!==typeof h?~~h:this.scrollLeft,void 0!==
h.top?~~h.top:void 0!==t?~~t:this.scrollTop)}else t=h.left,h=h.top,m.call(this,this,"undefined"===typeof t?this.scrollLeft:~~t,"undefined"===typeof h?this.scrollTop:~~h)};q.prototype.scrollBy=function(h,t){void 0!==h&&(!0===d(h)?n.elementScroll.call(this,void 0!==h.left?~~h.left+this.scrollLeft:~~h+this.scrollLeft,void 0!==h.top?~~h.top+this.scrollTop:~~t+this.scrollTop):this.scroll({left:~~h.left+this.scrollLeft,top:~~h.top+this.scrollTop,behavior:h.behavior}))};q.prototype.scrollIntoView=function(h){if(!0===
d(h))n.scrollIntoView.call(this,void 0===h?!0:h);else{for(h=this;h!==p.body&&!1===g(h);)h=h.parentNode||h.host;var t=h.getBoundingClientRect(),v=this.getBoundingClientRect();h!==p.body?(m.call(this,h,h.scrollLeft+v.left-t.left,h.scrollTop+v.top-t.top),"fixed"!==k.getComputedStyle(h).position&&k.scrollBy({left:t.left,top:t.top,behavior:"smooth"})):k.scrollBy({left:v.left,top:v.top,behavior:"smooth"})}}}}}})()});Cb.polyfill;Cb.polyfill();class Ra extends Qa{constructor(a,b){void 0===b&&(b={});super(a,
b);this.tour=a;this.classPrefix=this.tour.options?jb(this.tour.options.classPrefix):"";this.styles=a.styles;this._resolvedAttachTo=null;Ua(this);this._setOptions(b);return this}cancel(){this.tour.cancel();this.trigger("cancel")}complete(){this.tour.complete();this.trigger("complete")}destroy(){this.tooltip&&(this.tooltip.destroy(),this.tooltip=null);this.el instanceof HTMLElement&&this.el.parentNode&&(this.el.parentNode.removeChild(this.el),this.el=null);this._updateStepTargetOnHide();this.trigger("destroy")}getTour(){return this.tour}hide(){this.tour.modal.hide();
this.trigger("before-hide");this.el&&(this.el.hidden=!0);this._updateStepTargetOnHide();this.trigger("hide")}_resolveAttachToOptions(){let a=this.options.attachTo||{},b=Object.assign({},a);Z(b.element)&&(b.element=b.element.call(this));if(qa(b.element)){try{b.element=document.querySelector(b.element)}catch(c){}b.element||console.error(`The element for this Shepherd step was not found ${a.element}`)}return this._resolvedAttachTo=b}_getResolvedAttachToOptions(){return null===this._resolvedAttachTo?
this._resolveAttachToOptions():this._resolvedAttachTo}isOpen(){return!(!this.el||this.el.hidden)}show(){if(Z(this.options.beforeShowPromise)){let a=this.options.beforeShowPromise();if(void 0!==a)return a.then(()=>this._show())}this._show()}updateStepOptions(a){Object.assign(this.options,a);this.shepherdElementComponent&&this.shepherdElementComponent.$set({step:this})}getElement(){return this.el}getTarget(){return this.target}_createTooltipContent(){this.shepherdElementComponent=new Ac({target:this.tour.options.stepsContainer||
document.body,props:{classPrefix:this.classPrefix,descriptionId:`${this.id}-description`,labelId:`${this.id}-label`,step:this,styles:this.styles}});return this.shepherdElementComponent.getElement()}_scrollTo(a){let {element:b}=this._getResolvedAttachToOptions();Z(this.options.scrollToHandler)?this.options.scrollToHandler(b):b instanceof Element&&"function"===typeof b.scrollIntoView&&b.scrollIntoView(a)}_getClassOptions(a){var b=this.tour&&this.tour.options&&this.tour.options.defaultStepOptions;b=
b&&b.classes?b.classes:"";a=[...(a.classes?a.classes:"").split(" "),...b.split(" ")];a=new Set(a);return Array.from(a).join(" ").trim()}_setOptions(a){void 0===a&&(a={});let b=this.tour&&this.tour.options&&this.tour.options.defaultStepOptions;b=yc({},b||{});this.options=Object.assign({arrow:!0},b,a);let {when:c}=this.options;this.options.classes=this._getClassOptions(a);this.destroy();this.id=this.options.id||`step-${Ma()}`;c&&Object.keys(c).forEach(d=>{this.on(d,c[d],this)})}_setupElements(){void 0!==
this.el&&this.destroy();this.el=this._createTooltipContent();this.options.advanceOn&&Hb(this);this.tooltip&&this.tooltip.destroy();let a=this._getResolvedAttachToOptions(),b=a.element;var c={modifiers:[{name:"preventOverflow",options:{altAxis:!0,tether:!1}},ib(this)],strategy:"absolute"};if(void 0!==a&&null!==a&&a.element&&a.on)c.placement=a.on;else{c=Vb();var d={placement:"top",strategy:"fixed",modifiers:[ib(this)]};c=d=La({},d,{modifiers:Array.from(new Set([...d.modifiers,...c]))})}(d=this.tour&&
this.tour.options&&this.tour.options.defaultStepOptions)&&(c=kb(d,c));c=kb(this.options,c);void 0!==a&&null!==a&&a.element&&a.on||(b=document.body,this.shepherdElementComponent.getElement().classList.add("shepherd-centered"));this.tooltip=zc(b,this.el,c);this.target=a.element}_show(){this.trigger("before-show");this._resolveAttachToOptions();this._setupElements();this.tour.modal||this.tour._setupModal();this.tour.modal.setupForStep(this);this._styleTargetElementForStep(this);this.el.hidden=!1;this.options.scrollTo&&
setTimeout(()=>{this._scrollTo(this.options.scrollTo)});this.el.hidden=!1;let a=this.shepherdElementComponent.getElement(),b=this.target||document.body;b.classList.add(`${this.classPrefix}shepherd-enabled`);b.classList.add(`${this.classPrefix}shepherd-target`);a.classList.add("shepherd-enabled");this.trigger("show")}_styleTargetElementForStep(a){let b=a.target;b&&(a.options.highlightClass&&b.classList.add(a.options.highlightClass),b.classList.remove("shepherd-target-click-disabled"),!1===a.options.canClickTarget&&
b.classList.add("shepherd-target-click-disabled"))}_updateStepTargetOnHide(){let a=this.target||document.body;this.options.highlightClass&&a.classList.remove(this.options.highlightClass);a.classList.remove("shepherd-target-click-disabled",`${this.classPrefix}shepherd-enabled`,`${this.classPrefix}shepherd-target`)}}class Bc extends T{constructor(a){super();S(this,a,wc,vc,Q,{element:0,openingProperties:4,getElement:5,closeModalOpening:6,hide:7,positionModal:8,setupForStep:9,show:10})}get getElement(){return this.$$.ctx[5]}get closeModalOpening(){return this.$$.ctx[6]}get hide(){return this.$$.ctx[7]}get positionModal(){return this.$$.ctx[8]}get setupForStep(){return this.$$.ctx[9]}get show(){return this.$$.ctx[10]}}
let oa=new Qa;class Cc extends Qa{constructor(a){void 0===a&&(a={});super(a);Ua(this);this.options=Object.assign({},{exitOnEsc:!0,keyboardNavigation:!0},a);this.classPrefix=jb(this.options.classPrefix);this.steps=[];this.addSteps(this.options.steps);"active cancel complete inactive show start".split(" ").map(b=>{(c=>{this.on(c,d=>{d=d||{};d.tour=this;oa.trigger(c,d)})})(b)});this._setTourID();return this}addStep(a,b){a instanceof Ra?a.tour=this:a=new Ra(this,a);void 0!==b?this.steps.splice(b,0,a):
this.steps.push(a);return a}addSteps(a){Array.isArray(a)&&a.forEach(b=>{this.addStep(b)});return this}back(){let a=this.steps.indexOf(this.currentStep);this.show(a-1,!1)}cancel(){this.options.confirmCancel?window.confirm(this.options.confirmCancelMessage||"Are you sure you want to stop the tour?")&&this._done("cancel"):this._done("cancel")}complete(){this._done("complete")}getById(a){return this.steps.find(b=>b.id===a)}getCurrentStep(){return this.currentStep}hide(){let a=this.getCurrentStep();if(a)return a.hide()}isActive(){return oa.activeTour===
this}next(){let a=this.steps.indexOf(this.currentStep);a===this.steps.length-1?this.complete():this.show(a+1,!0)}removeStep(a){let b=this.getCurrentStep();this.steps.some((c,d)=>{if(c.id===a)return c.isOpen()&&c.hide(),c.destroy(),this.steps.splice(d,1),!0});b&&b.id===a&&(this.currentStep=void 0,this.steps.length?this.show(0):this.cancel())}show(a,b){void 0===a&&(a=0);void 0===b&&(b=!0);if(a=qa(a)?this.getById(a):this.steps[a])this._updateStateBeforeShow(),Z(a.options.showOn)&&!a.options.showOn()?
this._skipStep(a,b):(this.trigger("show",{step:a,previous:this.currentStep}),this.currentStep=a,a.show())}start(){this.trigger("start");this.focusedElBeforeOpen=document.activeElement;this.currentStep=null;this._setupModal();this._setupActiveTour();this.next()}_done(a){let b=this.steps.indexOf(this.currentStep);Array.isArray(this.steps)&&this.steps.forEach(c=>c.destroy());uc(this);this.trigger(a,{index:b});oa.activeTour=null;this.trigger("inactive",{tour:this});this.modal&&this.modal.hide();"cancel"!==
a&&"complete"!==a||!this.modal||(a=document.querySelector(".shepherd-modal-overlay-container"))&&a.remove();this.focusedElBeforeOpen instanceof HTMLElement&&this.focusedElBeforeOpen.focus()}_setupActiveTour(){this.trigger("active",{tour:this});oa.activeTour=this}_setupModal(){this.modal=new Bc({target:this.options.modalContainer||document.body,props:{classPrefix:this.classPrefix,styles:this.styles}})}_skipStep(a,b){a=this.steps.indexOf(a);a===this.steps.length-1?this.complete():this.show(b?a+1:a-
1,b)}_updateStateBeforeShow(){this.currentStep&&this.currentStep.hide();this.isActive()||this._setupActiveTour()}_setTourID(){this.id=`${this.options.tourName||"tour"}--${Ma()}`}}Object.assign(oa,{Tour:Cc,Step:Ra});return oa})

;
/**
 * @file
 * Attaches behaviors for the Tour module's toolbar tab.
 */

(($, Backbone, Drupal, settings, document, Shepherd) => {
  const queryString = decodeURI(window.location.search);

  /**
   * Attaches the tour's toolbar tab behavior.
   *
   * It uses the query string for:
   * - tour: When ?tour=1 is present, the tour will start automatically after
   *   the page has loaded.
   * - tips: Pass ?tips=class in the url to filter the available tips to the
   *   subset which match the given class.
   *
   * @example
   * http://example.com/foo?tour=1&tips=bar
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attach tour functionality on `tour` events.
   */
  Drupal.behaviors.tour = {
    attach(context) {
      once('tour', 'body').forEach(() => {
        const model = new Drupal.tour.models.StateModel();
        // eslint-disable-next-line no-new
        new Drupal.tour.views.ToggleTourView({
          el: $(context).find('#toolbar-tab-tour'),
          model,
        });

        model
          // Allow other scripts to respond to tour events.
          .on('change:isActive', (tourModel, isActive) => {
            $(document).trigger(
              isActive ? 'drupalTourStarted' : 'drupalTourStopped',
            );
          });
        // Initialization: check whether a tour is available on the current
        // page.
        if (settings._tour_internal) {
          model.set('tour', settings._tour_internal);
        }
        // Start the tour immediately if toggled via query string.
        if (/tour=?/i.test(queryString)) {
          model.set('isActive', true);
        }
      });
    },
  };

  /**
   * @namespace
   */
  Drupal.tour = Drupal.tour || {
    /**
     * @namespace Drupal.tour.models
     */
    models: {},

    /**
     * @namespace Drupal.tour.views
     */
    views: {},
  };

  /**
   * Backbone Model for tours.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.tour.models.StateModel = Backbone.Model.extend(
    /** @lends Drupal.tour.models.StateModel# */ {
      /**
       * @type {object}
       */
      defaults: /** @lends Drupal.tour.models.StateModel# */ {
        /**
         * Indicates whether the Drupal root window has a tour.
         *
         * @type {Array}
         */
        tour: [],

        /**
         * Indicates whether the tour is currently running.
         *
         * @type {boolean}
         */
        isActive: false,

        /**
         * Indicates which tour is the active one (necessary to cleanly stop).
         *
         * @type {Array}
         */
        activeTour: [],
      },
    },
  );

  Drupal.tour.views.ToggleTourView = Backbone.View.extend(
    /** @lends Drupal.tour.views.ToggleTourView# */ {
      /**
       * @type {object}
       */
      events: { click: 'onClick' },

      /**
       * Handles edit mode toggle interactions.
       *
       * @constructs
       *
       * @augments Backbone.View
       */
      initialize() {
        this.listenTo(this.model, 'change:tour change:isActive', this.render);
        this.listenTo(this.model, 'change:isActive', this.toggleTour);
      },

      /**
       * {@inheritdoc}
       *
       * @return {Drupal.tour.views.ToggleTourView}
       *   The `ToggleTourView` view.
       */
      render() {
        // Render the visibility.
        this.$el.toggleClass('hidden', this._getTour().length === 0);
        // Render the state.
        const isActive = this.model.get('isActive');
        this.$el
          .find('button')
          .toggleClass('is-active', isActive)
          .attr('aria-pressed', isActive);
        return this;
      },

      /**
       * Model change handler; starts or stops the tour.
       */
      toggleTour() {
        if (this.model.get('isActive')) {
          this._removeIrrelevantTourItems(this._getTour());
          const tourItems = this.model.get('tour');
          const that = this;

          if (tourItems.length) {
            // If Joyride is positioned relative to the top or bottom of an
            // element, and its secondary position is right or left, then the
            // arrow is also positioned right or left. Shepherd defaults to
            // center positioning the arrow.
            //
            // In most cases, this arrow positioning difference has
            // little impact. However, tours built with Joyride may have tips
            // using a higher level selector than the element the tip is
            // expected to point to, and relied on Joyride's arrow positioning
            // to align the arrow with the expected reference element. Joyride's
            // arrow positioning behavior is replicated here to prevent those
            // use cases from causing UI regressions.
            //
            // This modifier is provided here instead of TourViewBuilder (where
            // most position modifications are) because it includes adding a
            // JavaScript callback function.
            settings.tourShepherdConfig.defaultStepOptions.popperOptions.modifiers.push(
              {
                name: 'moveArrowJoyridePosition',
                enabled: true,
                phase: 'write',
                fn({ state }) {
                  const { arrow } = state.elements;
                  const { placement } = state;
                  if (
                    arrow &&
                    /^top|bottom/.test(placement) &&
                    /-start|-end$/.test(placement)
                  ) {
                    const horizontalPosition = placement.split('-')[1];
                    const offset =
                      horizontalPosition === 'start'
                        ? 28
                        : state.elements.popper.clientWidth - 56;
                    arrow.style.transform = `translate3d(${offset}px, 0px, 0px)`;
                  }
                },
              },
            );
            const shepherdTour = new Shepherd.Tour(settings.tourShepherdConfig);
            shepherdTour.on('cancel', () => {
              that.model.set('isActive', false);
            });
            shepherdTour.on('complete', () => {
              that.model.set('isActive', false);
            });

            tourItems.forEach((tourStepConfig, index) => {
              // Create the configuration for a given tour step by using values
              // defined in TourViewBuilder.
              // @see \Drupal\tour\TourViewBuilder::viewMultiple()
              const tourItemOptions = {
                title: tourStepConfig.title
                  ? Drupal.checkPlain(tourStepConfig.title)
                  : null,
                text: () => Drupal.theme('tourItemContent', tourStepConfig),
                attachTo: tourStepConfig.attachTo,
                buttons: [Drupal.tour.nextButton(shepherdTour, tourStepConfig)],
                classes: tourStepConfig.classes,
                index,
              };

              tourItemOptions.when = {
                show() {
                  const nextButton =
                    shepherdTour.currentStep.el.querySelector('footer button');

                  // Drupal disables Shepherd's built in focus after item
                  // creation functionality due to focus being set on the tour
                  // item container after every scroll and resize event. In its
                  // place, the 'next' button is focused here.
                  nextButton.focus();

                  // When Stable 9 is part of the active theme, the
                  // Drupal.tour.convertToJoyrideMarkup() function is available.
                  // This function converts Shepherd markup to Joyride markup,
                  // facilitating the use of the Shepherd library that is
                  // backwards compatible with customizations intended for
                  // Joyride.
                  // The Drupal.tour.convertToJoyrideMarkup() function is
                  // internal, and will eventually be removed from Drupal core.
                  if (Drupal.tour.hasOwnProperty('convertToJoyrideMarkup')) {
                    Drupal.tour.convertToJoyrideMarkup(shepherdTour);
                  }
                },
              };

              shepherdTour.addStep(tourItemOptions);
            });
            shepherdTour.start();
            this.model.set({ isActive: true, activeTour: shepherdTour });
          }
        } else {
          this.model.get('activeTour').cancel();
          this.model.set({ isActive: false, activeTour: [] });
        }
      },

      /**
       * Toolbar tab click event handler; toggles isActive.
       *
       * @param {jQuery.Event} event
       *   The click event.
       */
      onClick(event) {
        this.model.set('isActive', !this.model.get('isActive'));
        event.preventDefault();
        event.stopPropagation();
      },

      /**
       * Gets the tour.
       *
       * @return {array}
       *   An array of Shepherd tour item objects.
       */
      _getTour() {
        return this.model.get('tour');
      },

      /**
       * Removes tour items for elements that don't have matching page elements.
       *
       * Or that are explicitly filtered out via the 'tips' query string.
       *
       * @example
       * <caption>This will filter out tips that do not have a matching
       * page element or don't have the "bar" class.</caption>
       * http://example.com/foo?tips=bar
       *
       * @param {Object[]} tourItems
       *   An array containing tour Step config objects.
       *   The object properties relevant to this function:
       *   - classes {string}: A string of classes to be added to the tour step
       *     when rendered.
       *   - selector {string}: The selector a tour step is associated with.
       */
      _removeIrrelevantTourItems(tourItems) {
        const tips = /tips=([^&]+)/.exec(queryString);
        const filteredTour = tourItems.filter((tourItem) => {
          // If the query parameter 'tips' is set, remove all tips that don't
          // have the matching class. The `tourItem` variable is a step config
          // object, and the 'classes' property is a ShepherdJS Step() config
          // option that provides a string.
          if (
            tips &&
            tourItem.hasOwnProperty('classes') &&
            tourItem.classes.indexOf(tips[1]) === -1
          ) {
            return false;
          }

          // If a selector is configured but there isn't a matching element,
          // return false.
          return !(
            tourItem.selector && !document.querySelector(tourItem.selector)
          );
        });

        // If there are tours filtered, we'll have to update model.
        if (tourItems.length !== filteredTour.length) {
          filteredTour.forEach((filteredTourItem, filteredTourItemId) => {
            filteredTour[filteredTourItemId].counter = Drupal.t(
              '!tour_item of !total',
              {
                '!tour_item': filteredTourItemId + 1,
                '!total': filteredTour.length,
              },
            );

            if (filteredTourItemId === filteredTour.length - 1) {
              filteredTour[filteredTourItemId].cancelText =
                Drupal.t('End tour');
            }
          });
          this.model.set('tour', filteredTour);
        }
      },
    },
  );

  /**
   * Provides an object that will become the tour item's 'next' button.
   *
   * Similar to a theme function, themes can override this function to customize
   * the resulting button. Unlike a theme function, it returns an object instead
   * of a string, which is why it is not part of Drupal.theme.
   *
   * @param {Tour} shepherdTour
   *  A class representing a Shepherd site tour.
   * @param {Object} tourStepConfig
   *   An object generated in TourViewBuilder used for creating the options
   *   passed to `Tour.addStep(options)`.
   *   Contains the following properties:
   *   - id {string}: The tour.tip ID specified by its config
   *   - selector {string|null}: The selector of the element the tour step is
   *     attaching to.
   *   - module {string}: The module providing the tip plugin used by this step.
   *   - counter {string}: A string indicating which tour step this is out of
   *     how many total steps.
   *   - attachTo {Object} This is directly mapped to the `attachTo` Step()
   *     option. It has two properties:
   *     - element {string}: The selector of the element the step attaches to.
   *     - on {string}: a PopperJS compatible string to specify step position.
   *   - classes {string}: Will be added to the class attribute of the step.
   *   - body {string}: Markup that is mapped to the `text` Step() option. Will
   *     become the step content.
   *   - title {string}: is mapped to the `title` Step() option.
   *
   * @return {{classes: string, action: string, text: string}}
   *    An object structured in the manner Shepherd requires to create the
   *    'next' button.
   *
   * @see https://shepherdjs.dev/docs/Tour.html
   * @see \Drupal\tour\TourViewBuilder::viewMultiple()
   * @see https://shepherdjs.dev/docs/Step.html
   */
  Drupal.tour.nextButton = (shepherdTour, tourStepConfig) => {
    return {
      classes: 'button button--primary',
      text: tourStepConfig.cancelText
        ? tourStepConfig.cancelText
        : Drupal.t('Next'),
      action: tourStepConfig.cancelText
        ? shepherdTour.cancel
        : shepherdTour.next,
    };
  };

  /**
   * Theme function for tour item content.
   *
   * @param {Object} tourStepConfig
   *   An object generated in TourViewBuilder used for creating the options
   *   passed to `Tour.addStep(options)`.
   *   Contains the following properties:
   *   - id {string}: The tour.tip ID specified by its config
   *   - selector {string|null}: The selector of the element the tour step is
   *     attaching to.
   *   - module {string}: The module providing the tip plugin used by this step.
   *   - counter {string}: A string indicating which tour step this is out of
   *     how many total steps.
   *   - attachTo {Object} This is directly mapped to the `attachTo` Step()
   *     option. It has two properties:
   *     - element {string}: The selector of the element the step attaches to.
   *     - on {string}: a PopperJS compatible string to specify step position.
   *   - classes {string}: Will be added to the class attribute of the step.
   *   - body {string}: Markup that is mapped to the `text` Step() option. Will
   *     become the step content.
   *   - title {string}: is mapped to the `title` Step() option.
   *
   * @return {string}
   *   The tour item content markup.
   *
   * @see \Drupal\tour\TourViewBuilder::viewMultiple()
   * @see https://shepherdjs.dev/docs/Step.html
   */
  Drupal.theme.tourItemContent = (tourStepConfig) =>
    `${tourStepConfig.body}<div class="tour-progress">${tourStepConfig.counter}</div>`;
})(jQuery, Backbone, Drupal, drupalSettings, document, window.Shepherd);
;
/**
 * @file
 * Manages page tabbing modifications made by modules.
 */

/**
 * Allow modules to respond to the constrain event.
 *
 * @event drupalTabbingConstrained
 */

/**
 * Allow modules to respond to the tabbingContext release event.
 *
 * @event drupalTabbingContextReleased
 */

/**
 * Allow modules to respond to the constrain event.
 *
 * @event drupalTabbingContextActivated
 */

/**
 * Allow modules to respond to the constrain event.
 *
 * @event drupalTabbingContextDeactivated
 */

(function ($, Drupal, { tabbable, isTabbable }) {
  /**
   * Provides an API for managing page tabbing order modifications.
   *
   * @constructor Drupal~TabbingManager
   */
  function TabbingManager() {
    /**
     * Tabbing sets are stored as a stack. The active set is at the top of the
     * stack. We use a JavaScript array as if it were a stack; we consider the
     * first element to be the bottom and the last element to be the top. This
     * allows us to use JavaScript's built-in Array.push() and Array.pop()
     * methods.
     *
     * @type {Array.<Drupal~TabbingContext>}
     */
    this.stack = [];
  }

  /**
   * Stores a set of tabbable elements.
   *
   * This constraint can be removed with the release() method.
   *
   * @constructor Drupal~TabbingContext
   *
   * @param {object} options
   *   A set of initiating values
   * @param {number} options.level
   *   The level in the TabbingManager's stack of this tabbingContext.
   * @param {jQuery} options.$tabbableElements
   *   The DOM elements that should be reachable via the tab key when this
   *   tabbingContext is active.
   * @param {jQuery} options.$disabledElements
   *   The DOM elements that should not be reachable via the tab key when this
   *   tabbingContext is active.
   * @param {boolean} options.released
   *   A released tabbingContext can never be activated again. It will be
   *   cleaned up when the TabbingManager unwinds its stack.
   * @param {boolean} options.active
   *   When true, the tabbable elements of this tabbingContext will be reachable
   *   via the tab key and the disabled elements will not. Only one
   *   tabbingContext can be active at a time.
   *  @param {boolean} options.trapFocus
   *   When true, focus is trapped within the tabbable elements, i.e. focus will
   *   remain within the browser.
   */
  function TabbingContext(options) {
    $.extend(
      this,
      /** @lends Drupal~TabbingContext# */ {
        /**
         * @type {?number}
         */
        level: null,

        /**
         * @type {jQuery}
         */
        $tabbableElements: $(),

        /**
         * @type {jQuery}
         */
        $disabledElements: $(),

        /**
         * @type {boolean}
         */
        released: false,

        /**
         * @type {boolean}
         */
        active: false,

        /**
         * @type {boolean}
         */
        trapFocus: false,
      },
      options,
    );
  }

  /**
   * Add public methods to the TabbingManager class.
   */
  $.extend(
    TabbingManager.prototype,
    /** @lends Drupal~TabbingManager# */ {
      /**
       * Constrain tabbing to the specified set of elements only.
       *
       * Makes elements outside of the specified set of elements unreachable via
       * the tab key.
       *
       * @param {jQuery|Selector|Element|ElementArray|object|selection} elements
       *   The set of elements to which tabbing should be constrained. Can also
       *   be any jQuery-compatible argument.
       * @param {object} [options={}]
       *   Constrain options.
       * @param {boolean} [options.trapFocus=false]
       *   When true, tabbing is trapped within the set of elements and can't
       *   leave the browser. If the final element in the set is tabbed, the
       *   first element in the set will receive focus. If the first element in
       *   the set is shift-tabbed, the last element in the set will receive
       *   focus.
       *   When false, it is possible to tab out of the browser window by
       *   tabbing the final element in the set or shift-tabbing the first
       *   element in the set.
       *
       * @return {Drupal~TabbingContext}
       *   The TabbingContext instance.
       *
       * @fires event:drupalTabbingConstrained
       */
      constrain(elements, { trapFocus = false } = {}) {
        // Deactivate all tabbingContexts to prepare for the new constraint. A
        // tabbingContext instance will only be reactivated if the stack is
        // unwound to it in the _unwindStack() method.
        const il = this.stack.length;
        for (let i = 0; i < il; i++) {
          this.stack[i].deactivate();
        }

        // The "active tabbing set" are the elements tabbing should be constrained
        // to.
        let tabbableElements = [];
        $(elements).each((index, rootElement) => {
          tabbableElements = [...tabbableElements, ...tabbable(rootElement)];
          if (isTabbable(rootElement)) {
            tabbableElements = [...tabbableElements, rootElement];
          }
        });

        const tabbingContext = new TabbingContext({
          // The level is the current height of the stack before this new
          // tabbingContext is pushed on top of the stack.
          level: this.stack.length,
          $tabbableElements: $(tabbableElements),
          trapFocus,
        });

        this.stack.push(tabbingContext);

        // Activates the tabbingContext; this will manipulate the DOM to constrain
        // tabbing.
        tabbingContext.activate();

        // Allow modules to respond to the constrain event.
        $(document).trigger('drupalTabbingConstrained', tabbingContext);

        return tabbingContext;
      },

      /**
       * Restores a former tabbingContext when an active one is released.
       *
       * The TabbingManager stack of tabbingContext instances will be unwound
       * from the top-most released tabbingContext down to the first non-released
       * tabbingContext instance. This non-released instance is then activated.
       */
      release() {
        // Unwind as far as possible: find the topmost non-released
        // tabbingContext.
        let toActivate = this.stack.length - 1;
        while (toActivate >= 0 && this.stack[toActivate].released) {
          toActivate--;
        }

        // Delete all tabbingContexts after the to be activated one. They have
        // already been deactivated, so their effect on the DOM has been reversed.
        this.stack.splice(toActivate + 1);

        // Get topmost tabbingContext, if one exists, and activate it.
        if (toActivate >= 0) {
          this.stack[toActivate].activate();
        }
      },

      /**
       * Makes all elements outside of the tabbingContext's set untabbable.
       *
       * Elements made untabbable have their original tabindex and autofocus
       * values stored so that they might be restored later when this
       * tabbingContext is deactivated.
       *
       * @param {Drupal~TabbingContext} tabbingContext
       *   The TabbingContext instance that has been activated.
       */
      activate(tabbingContext) {
        const $set = tabbingContext.$tabbableElements;
        const level = tabbingContext.level;
        // Determine which elements are reachable via tabbing by default.
        const $disabledSet = $(tabbable(document.body))
          // Exclude elements of the active tabbing set.
          .not($set);
        // Set the disabled set on the tabbingContext.
        tabbingContext.$disabledElements = $disabledSet;
        // Record the tabindex for each element, so we can restore it later.
        const il = $disabledSet.length;
        for (let i = 0; i < il; i++) {
          this.recordTabindex($disabledSet.eq(i), level);
        }
        // Make all tabbable elements outside of the active tabbing set
        // unreachable.
        $disabledSet.prop('tabindex', -1).prop('autofocus', false);

        // Set focus on an element in the tabbingContext's set of tabbable
        // elements. First, check if there is an element with an autofocus
        // attribute. Select the last one from the DOM order.
        let $hasFocus = $set.filter('[autofocus]').eq(-1);
        // If no element in the tabbable set has an autofocus attribute, select
        // the first element in the set.
        if ($hasFocus.length === 0) {
          $hasFocus = $set.eq(0);
        }
        $hasFocus.trigger('focus');

        // Trap focus within the set.
        if ($set.length && tabbingContext.trapFocus) {
          $set.last().on('keydown.focus-trap', (event) => {
            if (event.key === 'Tab' && !event.shiftKey) {
              event.preventDefault();
              $set.first().focus();
            }
          });
          $set.first().on('keydown.focus-trap', (event) => {
            if (event.key === 'Tab' && event.shiftKey) {
              event.preventDefault();
              $set.last().focus();
            }
          });
        }
      },

      /**
       * Restores that tabbable state of a tabbingContext's disabled elements.
       *
       * Elements that were made untabbable have their original tabindex and
       * autofocus values restored.
       *
       * @param {Drupal~TabbingContext} tabbingContext
       *   The TabbingContext instance that has been deactivated.
       */
      deactivate(tabbingContext) {
        const $set = tabbingContext.$disabledElements;
        const level = tabbingContext.level;
        const il = $set.length;

        tabbingContext.$tabbableElements.first().off('keydown.focus-trap');
        tabbingContext.$tabbableElements.last().off('keydown.focus-trap');
        for (let i = 0; i < il; i++) {
          this.restoreTabindex($set.eq(i), level);
        }
      },

      /**
       * Records the tabindex and autofocus values of an untabbable element.
       *
       * @param {jQuery} $el
       *   The set of elements that have been disabled.
       * @param {number} level
       *   The stack level for which the tabindex attribute should be recorded.
       */
      recordTabindex($el, level) {
        const tabInfo = $el.data('drupalOriginalTabIndices') || {};
        tabInfo[level] = {
          tabindex: $el[0].getAttribute('tabindex'),
          autofocus: $el[0].hasAttribute('autofocus'),
        };
        $el.data('drupalOriginalTabIndices', tabInfo);
      },

      /**
       * Restores the tabindex and autofocus values of a reactivated element.
       *
       * @param {jQuery} $el
       *   The element that is being reactivated.
       * @param {number} level
       *   The stack level for which the tabindex attribute should be restored.
       */
      restoreTabindex($el, level) {
        const tabInfo = $el.data('drupalOriginalTabIndices');
        if (tabInfo && tabInfo[level]) {
          const data = tabInfo[level];
          if (data.tabindex) {
            $el[0].setAttribute('tabindex', data.tabindex);
          }
          // If the element did not have a tabindex at this stack level then
          // remove it.
          else {
            $el[0].removeAttribute('tabindex');
          }
          if (data.autofocus) {
            $el[0].setAttribute('autofocus', 'autofocus');
          }

          // Clean up $.data.
          if (level === 0) {
            // Remove all data.
            $el.removeData('drupalOriginalTabIndices');
          } else {
            // Remove the data for this stack level and higher.
            let levelToDelete = level;
            while (tabInfo.hasOwnProperty(levelToDelete)) {
              delete tabInfo[levelToDelete];
              levelToDelete++;
            }
            $el.data('drupalOriginalTabIndices', tabInfo);
          }
        }
      },
    },
  );

  /**
   * Add public methods to the TabbingContext class.
   */
  $.extend(
    TabbingContext.prototype,
    /** @lends Drupal~TabbingContext# */ {
      /**
       * Releases this TabbingContext.
       *
       * Once a TabbingContext object is released, it can never be activated
       * again.
       *
       * @fires event:drupalTabbingContextReleased
       */
      release() {
        if (!this.released) {
          this.deactivate();
          this.released = true;
          Drupal.tabbingManager.release(this);
          // Allow modules to respond to the tabbingContext release event.
          $(document).trigger('drupalTabbingContextReleased', this);
        }
      },

      /**
       * Activates this TabbingContext.
       *
       * @fires event:drupalTabbingContextActivated
       */
      activate() {
        // A released TabbingContext object can never be activated again.
        if (!this.active && !this.released) {
          this.active = true;
          Drupal.tabbingManager.activate(this);
          // Allow modules to respond to the constrain event.
          $(document).trigger('drupalTabbingContextActivated', this);
        }
      },

      /**
       * Deactivates this TabbingContext.
       *
       * @fires event:drupalTabbingContextDeactivated
       */
      deactivate() {
        if (this.active) {
          this.active = false;
          Drupal.tabbingManager.deactivate(this);
          // Allow modules to respond to the constrain event.
          $(document).trigger('drupalTabbingContextDeactivated', this);
        }
      },
    },
  );

  // Mark this behavior as processed on the first pass and return if it is
  // already processed.
  if (Drupal.tabbingManager) {
    return;
  }

  /**
   * @type {Drupal~TabbingManager}
   */
  Drupal.tabbingManager = new TabbingManager();
})(jQuery, Drupal, window.tabbable);
;
/**
 * @file
 * Attaches behaviors for the Contextual module's edit toolbar tab.
 */

(function ($, Drupal, Backbone) {
  const strings = {
    tabbingReleased: Drupal.t(
      'Tabbing is no longer constrained by the Contextual module.',
    ),
    tabbingConstrained: Drupal.t(
      'Tabbing is constrained to a set of @contextualsCount and the edit mode toggle.',
    ),
    pressEsc: Drupal.t('Press the esc key to exit.'),
  };

  /**
   * Initializes a contextual link: updates its DOM, sets up model and views.
   *
   * @param {HTMLElement} context
   *   A contextual links DOM element as rendered by the server.
   */
  function initContextualToolbar(context) {
    if (!Drupal.contextual || !Drupal.contextual.collection) {
      return;
    }

    const contextualToolbar = Drupal.contextualToolbar;
    contextualToolbar.model = new contextualToolbar.StateModel(
      {
        // Checks whether localStorage indicates we should start in edit mode
        // rather than view mode.
        // @see Drupal.contextualToolbar.VisualView.persist
        isViewing:
          document.querySelector('body .contextual-region') === null ||
          localStorage.getItem('Drupal.contextualToolbar.isViewing') !==
            'false',
      },
      {
        contextualCollection: Drupal.contextual.collection,
      },
    );

    const viewOptions = {
      el: $('.toolbar .toolbar-bar .contextual-toolbar-tab'),
      model: contextualToolbar.model,
      strings,
    };
    new contextualToolbar.VisualView(viewOptions);
    new contextualToolbar.AuralView(viewOptions);
  }

  /**
   * Attaches contextual's edit toolbar tab behavior.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches contextual toolbar behavior on a contextualToolbar-init event.
   */
  Drupal.behaviors.contextualToolbar = {
    attach(context) {
      if (once('contextualToolbar-init', 'body').length) {
        initContextualToolbar(context);
      }
    },
  };

  /**
   * Namespace for the contextual toolbar.
   *
   * @namespace
   *
   * @private
   */
  Drupal.contextualToolbar = {
    /**
     * The {@link Drupal.contextualToolbar.StateModel} instance.
     *
     * @type {?Drupal.contextualToolbar.StateModel}
     *
     * @deprecated in drupal:9.4.0 and is removed from drupal:11.0.0. There is
     * no replacement.
     */
    model: null,
  };
})(jQuery, Drupal, Backbone);
;
/**
 * @file
 * A Backbone Model for the state of Contextual module's edit toolbar tab.
 */

(function (Drupal, Backbone) {
  /**
   * @deprecated in drupal:9.4.0 and is removed from drupal:11.0.0. There is no
   *  replacement.
   */
  Drupal.contextualToolbar.StateModel = Backbone.Model.extend(
    /** @lends Drupal.contextualToolbar.StateModel# */ {
      /**
       * @type {object}
       *
       * @prop {boolean} isViewing
       * @prop {boolean} isVisible
       * @prop {number} contextualCount
       * @prop {Drupal~TabbingContext} tabbingContext
       */
      defaults: /** @lends Drupal.contextualToolbar.StateModel# */ {
        /**
         * Indicates whether the toggle is currently in "view" or "edit" mode.
         *
         * @type {boolean}
         */
        isViewing: true,

        /**
         * Indicates whether the toggle should be visible or hidden. Automatically
         * calculated, depends on contextualCount.
         *
         * @type {boolean}
         */
        isVisible: false,

        /**
         * Tracks how many contextual links exist on the page.
         *
         * @type {number}
         */
        contextualCount: 0,

        /**
         * A TabbingContext object as returned by {@link Drupal~TabbingManager}:
         * the set of tabbable elements when edit mode is enabled.
         *
         * @type {?Drupal~TabbingContext}
         */
        tabbingContext: null,
      },

      /**
       * Models the state of the edit mode toggle.
       *
       * @constructs
       *
       * @augments Backbone.Model
       *
       * @param {object} attrs
       *   Attributes for the backbone model.
       * @param {object} options
       *   An object with the following option:
       * @param {Backbone.collection} options.contextualCollection
       *   The collection of {@link Drupal.contextual.StateModel} models that
       *   represent the contextual links on the page.
       */
      initialize(attrs, options) {
        // Respond to new/removed contextual links.
        this.listenTo(
          options.contextualCollection,
          'reset remove add',
          this.countContextualLinks,
        );
        this.listenTo(
          options.contextualCollection,
          'add',
          this.lockNewContextualLinks,
        );

        // Automatically determine visibility.
        this.listenTo(this, 'change:contextualCount', this.updateVisibility);

        // Whenever edit mode is toggled, lock all contextual links.
        this.listenTo(this, 'change:isViewing', (model, isViewing) => {
          options.contextualCollection.each((contextualModel) => {
            contextualModel.set('isLocked', !isViewing);
          });
        });
      },

      /**
       * Tracks the number of contextual link models in the collection.
       *
       * @param {Drupal.contextual.StateModel} contextualModel
       *   The contextual links model that was added or removed.
       * @param {Backbone.Collection} contextualCollection
       *    The collection of contextual link models.
       */
      countContextualLinks(contextualModel, contextualCollection) {
        this.set('contextualCount', contextualCollection.length);
      },

      /**
       * Lock newly added contextual links if edit mode is enabled.
       *
       * @param {Drupal.contextual.StateModel} contextualModel
       *   The contextual links model that was added.
       * @param {Backbone.Collection} [contextualCollection]
       *    The collection of contextual link models.
       */
      lockNewContextualLinks(contextualModel, contextualCollection) {
        if (!this.get('isViewing')) {
          contextualModel.set('isLocked', true);
        }
      },

      /**
       * Automatically updates visibility of the view/edit mode toggle.
       */
      updateVisibility() {
        this.set('isVisible', this.get('contextualCount') > 0);
      },
    },
  );
})(Drupal, Backbone);
;
/**
 * @file
 * A Backbone View that provides the aural view of the edit mode toggle.
 */

(function ($, Drupal, Backbone, _) {
  /**
   * @deprecated in drupal:9.4.0 and is removed from drupal:11.0.0. There is no
   *  replacement.
   */
  Drupal.contextualToolbar.AuralView = Backbone.View.extend(
    /** @lends Drupal.contextualToolbar.AuralView# */ {
      /**
       * Tracks whether the tabbing constraint announcement has been read once.
       *
       * @type {boolean}
       */
      announcedOnce: false,

      /**
       * Renders the aural view of the edit mode toggle (screen reader support).
       *
       * @constructs
       *
       * @augments Backbone.View
       *
       * @param {object} options
       *   Options for the view.
       */
      initialize(options) {
        this.options = options;

        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model, 'change:isViewing', this.manageTabbing);

        $(document).on('keyup', _.bind(this.onKeypress, this));
        this.manageTabbing();
      },

      /**
       * {@inheritdoc}
       *
       * @return {Drupal.contextualToolbar.AuralView}
       *   The current contextual toolbar aural view.
       */
      render() {
        // Render the state.
        this.$el
          .find('button')
          .attr('aria-pressed', !this.model.get('isViewing'));

        return this;
      },

      /**
       * Limits tabbing to the contextual links and edit mode toolbar tab.
       */
      manageTabbing() {
        let tabbingContext = this.model.get('tabbingContext');
        // Always release an existing tabbing context.
        if (tabbingContext) {
          // Only announce release when the context was active.
          if (tabbingContext.active) {
            Drupal.announce(this.options.strings.tabbingReleased);
          }
          tabbingContext.release();
        }
        // Create a new tabbing context when edit mode is enabled.
        if (!this.model.get('isViewing')) {
          tabbingContext = Drupal.tabbingManager.constrain(
            $('.contextual-toolbar-tab, .contextual'),
          );
          this.model.set('tabbingContext', tabbingContext);
          this.announceTabbingConstraint();
          this.announcedOnce = true;
        }
      },

      /**
       * Announces the current tabbing constraint.
       */
      announceTabbingConstraint() {
        const strings = this.options.strings;
        Drupal.announce(
          Drupal.formatString(strings.tabbingConstrained, {
            '@contextualsCount': Drupal.formatPlural(
              Drupal.contextual.collection.length,
              '@count contextual link',
              '@count contextual links',
            ),
          }),
        );
        Drupal.announce(strings.pressEsc);
      },

      /**
       * Responds to esc and tab key press events.
       *
       * @param {jQuery.Event} event
       *   The keypress event.
       */
      onKeypress(event) {
        // The first tab key press is tracked so that an announcement about
        // tabbing constraints can be raised if edit mode is enabled when the page
        // is loaded.
        if (
          !this.announcedOnce &&
          event.keyCode === 9 &&
          !this.model.get('isViewing')
        ) {
          this.announceTabbingConstraint();
          // Set announce to true so that this conditional block won't run again.
          this.announcedOnce = true;
        }
        // Respond to the ESC key. Exit out of edit mode.
        if (event.keyCode === 27) {
          this.model.set('isViewing', true);
        }
      },
    },
  );
})(jQuery, Drupal, Backbone, _);
;
/**
 * @file
 * A Backbone View that provides the visual view of the edit mode toggle.
 */

(function (Drupal, Backbone) {
  /**
   * @deprecated in drupal:9.4.0 and is removed from drupal:11.0.0. There is no
   *  replacement.
   */
  Drupal.contextualToolbar.VisualView = Backbone.View.extend(
    /** @lends Drupal.contextualToolbar.VisualView# */ {
      /**
       * Events for the Backbone view.
       *
       * @return {object}
       *   A mapping of events to be used in the view.
       */
      events() {
        // Prevents delay and simulated mouse events.
        const touchEndToClick = function (event) {
          event.preventDefault();
          event.target.click();
        };

        return {
          click() {
            this.model.set('isViewing', !this.model.get('isViewing'));
          },
          touchend: touchEndToClick,
        };
      },

      /**
       * Renders the visual view of the edit mode toggle.
       *
       * Listens to mouse & touch and handles edit mode toggle interactions.
       *
       * @constructs
       *
       * @augments Backbone.View
       */
      initialize() {
        this.listenTo(this.model, 'change', this.render);
        this.listenTo(this.model, 'change:isViewing', this.persist);
      },

      /**
       * {@inheritdoc}
       *
       * @return {Drupal.contextualToolbar.VisualView}
       *   The current contextual toolbar visual view.
       */
      render() {
        // Render the visibility.
        this.$el.toggleClass('hidden', !this.model.get('isVisible'));
        // Render the state.
        this.$el
          .find('button')
          .toggleClass('is-active', !this.model.get('isViewing'));

        return this;
      },

      /**
       * Model change handler; persists the isViewing value to localStorage.
       *
       * `isViewing === true` is the default, so only stores in localStorage when
       * it's not the default value (i.e. false).
       *
       * @param {Drupal.contextualToolbar.StateModel} model
       *   A {@link Drupal.contextualToolbar.StateModel} model.
       * @param {boolean} isViewing
       *   The value of the isViewing attribute in the model.
       */
      persist(model, isViewing) {
        if (!isViewing) {
          localStorage.setItem('Drupal.contextualToolbar.isViewing', 'false');
        } else {
          localStorage.removeItem('Drupal.contextualToolbar.isViewing');
        }
      },
    },
  );
})(Drupal, Backbone);
;
/**
 * @file
 * Replaces the home link in toolbar with a back to site link.
 */

(function ($, Drupal, drupalSettings) {
  const pathInfo = drupalSettings.path;
  const escapeAdminPath = sessionStorage.getItem('escapeAdminPath');
  const windowLocation = window.location;

  // Saves the last non-administrative page in the browser to be able to link
  // back to it when browsing administrative pages. If there is a destination
  // parameter there is not need to save the current path because the page is
  // loaded within an existing "workflow".
  if (
    !pathInfo.currentPathIsAdmin &&
    !/destination=/.test(windowLocation.search)
  ) {
    sessionStorage.setItem('escapeAdminPath', windowLocation);
  }

  /**
   * Replaces the "Home" link with "Back to site" link.
   *
   * Back to site link points to the last non-administrative page the user
   * visited within the same browser tab.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the replacement functionality to the toolbar-escape-admin element.
   */
  Drupal.behaviors.escapeAdmin = {
    attach() {
      const toolbarEscape = once('escapeAdmin', '[data-toolbar-escape-admin]');
      if (toolbarEscape.length && pathInfo.currentPathIsAdmin) {
        if (escapeAdminPath !== null) {
          $(toolbarEscape).attr('href', escapeAdminPath);
        } else {
          toolbarEscape[0].textContent = Drupal.t('Home');
        }
      }
    },
  };
})(jQuery, Drupal, drupalSettings);
;
/**
 * @file
 * Renders BigPipe placeholders using Drupal's Ajax system.
 */

(function (Drupal, drupalSettings) {
  /**
   * Maps textContent of <script type="application/vnd.drupal-ajax"> to an AJAX response.
   *
   * @param {string} content
   *   The text content of a <script type="application/vnd.drupal-ajax"> DOM node.
   * @return {Array|boolean}
   *   The parsed Ajax response containing an array of Ajax commands, or false in
   *   case the DOM node hasn't fully arrived yet.
   */
  function mapTextContentToAjaxResponse(content) {
    if (content === '') {
      return false;
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      return false;
    }
  }

  /**
   * Executes Ajax commands in <script type="application/vnd.drupal-ajax"> tag.
   *
   * These Ajax commands replace placeholders with HTML and load missing CSS/JS.
   *
   * @param {HTMLScriptElement} placeholderReplacement
   *   Script tag created by BigPipe.
   */
  function bigPipeProcessPlaceholderReplacement(placeholderReplacement) {
    const placeholderId = placeholderReplacement.getAttribute(
      'data-big-pipe-replacement-for-placeholder-with-id',
    );
    const content = placeholderReplacement.textContent.trim();
    // Ignore any placeholders that are not in the known placeholder list. Used
    // to avoid someone trying to XSS the site via the placeholdering mechanism.
    if (
      typeof drupalSettings.bigPipePlaceholderIds[placeholderId] !== 'undefined'
    ) {
      const response = mapTextContentToAjaxResponse(content);
      // If we try to parse the content too early (when the JSON containing Ajax
      // commands is still arriving), textContent will be empty or incomplete.
      if (response === false) {
        /**
         * Mark as unprocessed so this will be retried later.
         * @see bigPipeProcessDocument()
         */
        once.remove('big-pipe', placeholderReplacement);
      } else {
        // Create a Drupal.Ajax object without associating an element, a
        // progress indicator or a URL.
        const ajaxObject = Drupal.ajax({
          url: '',
          base: false,
          element: false,
          progress: false,
        });
        // Then, simulate an AJAX response having arrived, and let the Ajax
        // system handle it.
        ajaxObject.success(response, 'success');
      }
    }
  }

  // The frequency with which to check for newly arrived BigPipe placeholders.
  // Hence 50 ms means we check 20 times per second. Setting this to 100 ms or
  // more would cause the user to see content appear noticeably slower.
  const interval = drupalSettings.bigPipeInterval || 50;

  // The internal ID to contain the watcher service.
  let timeoutID;

  /**
   * Processes a streamed HTML document receiving placeholder replacements.
   *
   * @param {HTMLDocument} context
   *   The HTML document containing <script type="application/vnd.drupal-ajax">
   *   tags generated by BigPipe.
   *
   * @return {bool}
   *   Returns true when processing has been finished and a stop signal has been
   *   found.
   */
  function bigPipeProcessDocument(context) {
    // Make sure we have BigPipe-related scripts before processing further.
    if (!context.querySelector('script[data-big-pipe-event="start"]')) {
      return false;
    }

    // Attach Drupal behaviors early, if possible.
    once('big-pipe-early-behaviors', 'body', context).forEach((el) => {
      Drupal.attachBehaviors(el);
    });

    once(
      'big-pipe',
      'script[data-big-pipe-replacement-for-placeholder-with-id]',
      context,
    ).forEach(bigPipeProcessPlaceholderReplacement);

    // If we see the stop signal, clear the timeout: all placeholder
    // replacements are guaranteed to be received and processed.
    if (context.querySelector('script[data-big-pipe-event="stop"]')) {
      if (timeoutID) {
        clearTimeout(timeoutID);
      }
      return true;
    }

    return false;
  }

  function bigPipeProcess() {
    timeoutID = setTimeout(() => {
      if (!bigPipeProcessDocument(document)) {
        bigPipeProcess();
      }
    }, interval);
  }

  bigPipeProcess();

  // If something goes wrong, make sure everything is cleaned up and has had a
  // chance to be processed with everything loaded.
  window.addEventListener('load', () => {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }
    bigPipeProcessDocument(document);
  });
})(Drupal, drupalSettings);
;
