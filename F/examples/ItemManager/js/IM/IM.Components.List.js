IM.Components.List = new Class({
	toString: 'List',
	extend: F.List,
	
	// F.CollectionComponent can send params when it fetches the collection, provide defaults here
	// Params passed to subsequent calls to this.load(params) will be merged with default params provided here
	options: {
		params: {
			sort: 'name'
		}
	},
	
	// The collection we'll be using
	Collection: IM.Collections.Items,
	
	// Our custom template
	ItemTemplate: IM.Templates.ListItem,
	
	// Extend the list view so we give it the CSS class we want
	ListView: F.List.prototype.ListView.extend({
		className: 'itemList'
	})
});
