(function() {
	function decapitalize(str) {
		return str.slice(0, 1).toLowerCase()+str.slice(1);	
	}
	
	F.Component = new Class(/** @lends F.Component# */{
		toString: 'Component',
		extend: F.EventEmitter,
		
		options: {
			singly: false, // Show only one subcomponent at a time
			visible: false, // Visible immediately or not
			debug: false
		},
		
		/**
		 * Generic component class
		 *
		 * @extends F.EventEmitter
		 * @constructs
		 *
		 * @param {Object} options	Component options
		 * @param {Boolean} options.singly		Whether this component will allow multiple sub-components to be visible at once. If true, only one component will be visible at a time.
		 * @param {Boolean} options.visible		If true, this component will be visible immediately.
		 * @param {Boolean} options.debug		If true, show debug messages for this component.
		 *
		 * @property {Object} options			Default options for this component. These will be merged with options passed to the constructor.
		 */
		construct: function(options) {
			// Merge options up the prototype chain
			this.mergeOptions();
			
			// Add defaults to options arg and make available to other constructors
			// Modify this.options to reflect any modifications the options arg may have made
			this.applyOptions(options);
			
			// Sub components
			this.components = {};
			
			// Hold the bubbled event listeners
			this._bubbledEvts = {};
			
			// Make sure the following functions are always called in scope
			// They are used in event handlers, and we want to be able to remove them
			this.bind(this._handleSubComponentShown);
			this.bind(this.render);
		},
		
		/**
		 * Destroy this instance and free associated memory
		 */
		destruct: function() {
			// If this module has a view in this.view, destroy it automatically
			if (this.view)
				this.view.remove();
			
			// Destroy sub-components
			for (var component in this.components) {
				this.components[component].destruct();
				delete this[component];
			}
			
			// Stop listening, we're done
			this.stopListening();
		
			// Clear references to components
			delete this.components;
		},
		
		/**
		 * Render the view associated with this component, if it has one
		 *
		 * @returns {F.Component}	this, chainable
		 */
		render: function() {
			if (this.view) {
				this.view.render();
			}
			
			return this;
		},
	
		/**
		 * Set an event to bubble up the component chain by re-triggering it when the given sub-component triggers it
		 * 
		 * @param {String} componentName	Name of the component whose event to bubble
		 * @param {String} evt				Name of event to bubble up
		 *
		 * @returns {F.Component}	this, chainable
		 */
		bubble: function(componentName, evt) {
			if (!this[componentName]) {
				console.error("%s: cannot set event '%s' for bubbling from component '%s', component does not exist", this.toString(), evt, componentName);
				return this;
			}
			
			if (!this._bubbledEvts[componentName])
				this._bubbledEvts[componentName] = {};
			
			// Create a handler
			var handler = this._bubbledEvts[componentName][evt] = function() {
				// Turn the event arguments into an array
				var args = Array.prototype.slice.call(arguments);
				
				// Add the name of the event to the arguments array
				args.unshift(evt);
				
				// Call to bubble the event up
				this.trigger.apply(this, args);
			}.bind(this);
			
			// Add the listener
			this[componentName].on(evt, handler);
			
			return this;
		},
	
		/**
		 * Discontinue bubbling of a given event
		 * 
		 * @param {String} componentName	Name of the component whose event to stop bubbling
		 * @param {String} evt				Name of event that was set to bubble
		 *
		 * @returns {F.Component}	this, chainable
		 */
		unbubble: function(componentName, evt) {
			if (!this._bubbledEvts[componentName] || !this._bubbledEvts[componentName][evt]) {
				console.warn("%s: cannot discontinue bubbling of event '%s' for component '%s', event was not set for bubbling", this.toString(), evt, componentName);
				return this;
			}

			// Remove the listener
			this[componentName].off(evt, this._bubbledEvts[componentName][evt]);

			return this;
		},

		/**
		 * Add an instance of another component as a sub-component.
		 *
		 * this[subComponent.toString()] is used to reference the sub-component:
		 * 
		 *   this.List.show();
		 * 
		 * You can give a component an optional custom name as the second argument, then reference as such:
		 * 
		 *  this.myCustomComponent.show();
		 * 
		 * @param {F.Component} component	Instance of component
		 * @param {Function} componentName	Optional custom name for this component
		 *
		 * @returns {F.Component}	The sub-component that was added
		 */
		addComponent: function(component, componentName) {
			// Get the name of the component
			if (componentName) {
				// Tell component its new name, if provided
				componentName = decapitalize(componentName);
			}
			else {
				// Use lowercase of toString
				componentName = decapitalize(component.toString());
			}
			
			// Give component its new name
			component.setName(componentName);
			
			// Store component
			this[componentName] = this.components[componentName] = component;
		
			// Hide view by default
			if (component.view) {
				if (component.view.el) {
					if (component.options.visible === true) {
						// Call show method so view is rendered
						component.show({ silent: true });
					}
					else {
						// Just hide the el
						component.view.$el.hide();
					}
				}
				else {
					console.warn('Component %s has a view without an element', componentName, component, component.view, component.view.options);
				}
			}
			
			// Store this component as the parent
			component.parent = this;
			
			// Show a sub-component when it shows one of it's sub-components
			this.listenTo(component, 'component:shown', this._handleSubComponentShown);
			
			return component;
		},
	
		/**
		 * Remove a sub-component
		 *
		 * @param {Function} componentName	Component name
		 *
		 * @returns {F.Component}	this, chainable
		 */
		removeComponent: function(componentName) {
			var component = this[componentName];
		
			if (component !== undefined) {
				this.stopListening(component);
		
				delete this[componentName];
				delete this.components[componentName];
			}
		
			return this;
		},
	
	
		/**
		 * Handles showing/hiding components in singly mode, triggering of events
		 *
		 * @param {Function} evt	Event object from component:shown
		 */
		_handleSubComponentShown: function(evt) {
			var newComponent = this.components[evt.name];

			if (newComponent !== undefined) {
				// hide current component(s) for non-overlays
				if (this.options.singly && !newComponent.overlay) {
					this.hideAllSubComponents([evt.name]);
					
					// Store currently visible subComponent
					this.currentSubComponent = newComponent;
				}
				
				// Trigger an event to inidcate the component changed
				this.trigger('subComponent:shown', {
					name: evt.name,
					component: evt.component
				});
				
				// Show self
				this.show();
			}
		},
	
		/**
		 * Show this component and emit an event so parent components can show themselves. Use options.silent to prevent component:shown event from firing
		 *
		 * @param {Object} options	Options object
		 *
		 * @returns {F.Component}	this, chainable
		 */
		show: function(options) {
			options = options || {};
			
			// Debug output
			if (this.inDebugMode()) {
				// Don't show if already shown
				if (this.isVisible())
					console.log('%s: not showing self; already visible', this.toString());
				else
					console.log('%s: showing self', this.toString());
			}
		
			if (!options.silent) {
				// Always trigger event before we show ourself so others can hide/show
				this.trigger('component:shown', {
					name: this.toString(),
					component: this
				});
			}
		
			// Always call show on the view so it has a chance to re-render
			if (this.view) {
				this.view.show();
				
				// Call setup if we're not setup
				if (!this.options.isSetup && typeof this.setup === 'function') {
					this.setup(options);
					this.options.isSetup = true;
				}
			}
		
			this.options.visible = true;
	
			return this;
		},
	
		/**
		 * Hide this component
		 *
		 * @returns {F.Component}	this, chainable
		 */
		hide: function(options) {
			options = options || {};
			
			if (!this.isVisible())
				return false;
			
			if (this.inDebugMode()) {
				console.log('%s: hiding self', this.toString());
			}
			
			// Hide the view
			if (this.view)
				this.view.hide();
			
			if (!options.silent) {
				// Trigger event after we hide ourself so we're out of the way before the next action
				this.trigger('component:hidden', {
					name: this.toString(),
					component: this
				});
			}
			
			// Call teardown if we're setup
			if (this.options.isSetup && typeof this.teardown === 'function') {
				this.teardown(options);
				this.options.isSetup = false;
			}
		
			this.options.visible = false;
	
			return this;
		},
	
		/**
		 * Check if this component, or F as a whole, is in debug mode and should output debug messages
		 *
		 * @returns {Boolean} Component or F is in debug mode
		 */
		inDebugMode: function() {
			return this.options.debug || F.options.debug;
		},
		
		/**
		 * Check if this component is currently visible
		 *
		 * @returns {Boolean} Component is visible
		 */
		isVisible: function() {
			return this.options.visible;
		},

		/**
		 * Show all sub-components
		 *
		 * @param {String[]} [except]	List of component names not to show. These components will not be hidden if they are already shown
		 *
		 * @returns {F.Component}	this, chainable
		 */
		showAllSubComponents: function(except) {
			except = !_.isArray(except) ? [] : except;
			for (var componentName in this.components) {
				if (~except.indexOf(componentName))
					continue;
				this.components[componentName].show();
			}

			return this;
		},
		
		/**
		 * Hide all sub-components
		 *
		 * @param {String[]} [except]	List of component names not to hide. These components will not be shown if they are already hidden
		 *
		 * @returns {F.Component}	this, chainable
		 */
		hideAllSubComponents: function(except) {
			except = !_.isArray(except) ? [] : except;
			for (var componentName in this.components) {
				if (~except.indexOf(componentName))
					continue;
				this.components[componentName].hide();
			}
		
			return this;
		},
		
		/**
		 * Set a custom name for this component. Only useful before passing to {@link F.Component.addComponent}
		 *
		 * @param {Function} componentName	Component name
		 *
		 * @returns {F.Component}	this, chainable
		 */
		setName: function(customName) {
			/**
			 * Get this component's name
			 *
			 * @returns {String}	Component's name; either a custom name given when added with {@link F.Component.addComponent}, or toString method or string from prototype
			 */
			this.toString = function() {
				return customName;
			};
			
			return this;
		},
		
		/**
		 * Set properties of this instance from an options object, then remove the properties from the options object
		 *
		 * @param {Object} options		Options object with many properties
		 * @param {String[]} props		Properties to copy from options object
		 *
		 * @returns {F.Component}	this, chainable
		 */
		setPropsFromOptions: function(options, props) {
			_.each(props, function(prop) {
				// Add the property to this instance, or use existing property if it's already there
				this[prop] = options[prop] || this[prop];
				// Delete the property from the options object
				delete options[prop];
			}.bind(this));
			
			return this;
		},
		
		/**
		 * Merge options up the prototype chain. Options defined in the child class take precedence over those defined in the parent class.
		 */
		mergeOptions: function() {
			// Create a set of all options in the correct order
			var optionSets = [];
			var proto = this.constructor.prototype;
			while (proto) {
				if (proto.hasOwnProperty('options')) {
					optionSets.unshift(proto.options);
				}
				proto = proto.superClass;
			}
			
			// All options should end up merged into a new object
			// That is, move our reference out of the prototype before we modify it
			optionSets.unshift({});
			
			// Perform the merge and store the new options object
			this.options = _.extend.apply(_, optionSets);
		},
		
		/**
		 * Applies passed options to instance options and applies instance options to passed options.
		 * Individual passed options will not be applied to instance options unless they are defined in default options for the class or parent class.
		 * <br>Note: The options merge is one level deep.
		 * <br>Note: This function assumes that <code>this.options</code> does not refer to an object in the prototype.
		 *
		 * @param {Object} options	Instance options object (usually argument to constructor)
		 *
		 * @returns {Object}	Merged options object
		 */
		applyOptions: function(options) {
			// Assume we already have moved our reference to this.options out of the prototype
			// Apply options from passed object to this.options
			for (var option in options) {
				if (this.options.hasOwnProperty(option))
					this.options[option] = options[option];
			}
			
			// Apply any missing defaults back to passed options object
			_.extend(options, this.options);

			return options;
		}
		
		/**
		 * Triggered when this component is shown
		 *
		 * @name F.Component#component:shown
		 * @event
		 *
		 * @param {Object}	evt					Event object
		 * @param {String}	evt.name			This component's name
		 * @param {F.Component}	evt.component	This component
		 */

		/**
		 * Triggered when this component is hidden
		 *
		 * @name F.Component#component:hidden
		 * @event
		 *
		 * @param {Object}	evt					Event object
		 * @param {String}	evt.name			This component's name
		 * @param {F.Component}	evt.component	This component
		 */
	});
}());
