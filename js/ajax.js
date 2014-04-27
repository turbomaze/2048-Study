var AJAXHelper = {
	sendCORSRequest : function(url) {
		var scr = document.createElement('script');
		scr.id = 'jsonp-cors';
		scr.type = 'text/javascript';
		scr.src = url;
		document.getElementsByTagName('head')[0].appendChild(scr);
	},
};