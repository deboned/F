F.CollectionComponent = new Class(/** @lends F.CollectionComponent# */{
	toString: 'CollectionComponent',
	extend: F.Component,
	
	/**
	 * A component that can load and render a collection
	 *
	 * @constructs
	 * @extends F.Component
	 *
	 * @param {Object} options							Options for this component
	 * @param {Backbone.Collection} options.Collection	The collection class this component should operate on. Sets this.Collection
	 * @param {Object} [options.defaultParams ]			Default parameters to use when fetching this collection
	 *
	 * @property {Object} defaultParams				Default parameters to send with fetches for this collection. Can be overridden at instantiation. Calls to load(fetchParams) will merge fetchParams with defaultParams.
	 * @property {Backbone.Collection} Collection	The collection class to operate on. Not an instance of a collection, but the collection class itself.
	 */
	construct: function(options) {
		// Store the collection class
		this.setPropsFromOptions(options, [
			'Collection'
		]);
		
		// Create a collection
		this.collection = new this.Collection();
		
		// Re-render when the collection resets
		this.collection.on('reset', this.render);
		
		// Default parameters are the prototype params + options params
		this.defaultParams = _.extend({}, this.defaultParams, options.defaultParams);
		
		// Parameters to send with the request: just copy the default params
		this.params = _.extend({}, this.defaultParams);
	
		// Store if this collection has ever been loaded
		this.collectionLoaded = false;
	},
	
	Collection: Backbone.Collection,
	
	/**
	 * Get the collection associated with this component
	 *
	 * @returns {Backbone.Collection}	The collection associated with this component
	 */
	getCollection: function() {
		return this.collection;
	},
	
	/**
	 * Refresh this collection with the last parameters used
	 *
	 * @param {Function} callback	Optional callback to execute on successful fetch
	 *
	 * @returns {F.CollectionComponent}	this, chainable
	 */
	refresh: function(callback) {
		// Just load the colleciton with the current params
		this.load(this.params, callback);
		
		return this;
	},
	
	/**
	 * Fetch the collection with optional 
	 *
	 * @param {Object} fetchParams	Optional parameters to pass when fetching
	 * @param {Function} callback	Optional callback to execute on successful fetch
	 *
	 * @returns {F.CollectionComponent}	this, chainable
	 */
	load: function(fetchParams, callback) {
		// Combine new params, if any, with defaults and store, overwriting previous params
		if (fetchParams)
			this.params = _.extend({}, this.defaultParams, fetchParams);
		
		// Fetch collection contents
		this.collection.fetch({
			data: this.params,
			success: function() {
				this.trigger('collectionLoaded');
				this.collectionLoaded = true;
				
				if (typeof callback === 'function')
					callback.call(this, this.collection);
			}.bind(this)
		});
		
		return this;
	},
	
	/**
	 * Show this component. Provide options.params to fetch with new parameters. The collection will be fetched before showing if it hasn't already
	 *
	 * @param {Object} options	Pass fetch parameters with options.params
	 *
	 * @returns {F.CollectionComponent}	this, chainable
	 */
	show: function(options) {
		options = options || {};
		if (options.params) {
			// Load the collection by itemId
			this.load(options.params, function() {
				this.show();
			});
		}
		else if (!this.collectionLoaded) {
			// Perform initial load
			this.refresh(function() {
				this.show(); // show when we're fully loaded
			});
		}
		else
			this.inherited(arguments);
			
		return this;
	}
});
