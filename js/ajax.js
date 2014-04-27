var AJAXHelper = {
	createCORSRequest : function(method, url) {
		var xhr = new XMLHttpRequest();
		if ("withCredentials" in xhr) {
			xhr.open(method, url, true);
		} else if (typeof XDomainRequest != "undefined") {
			xhr = new XDomainRequest();
			xhr.open(method, url);
		} else xhr = null;
		return xhr;
	},

	makeCorsRequest : function(url, callback) {
		var xhr = this.createCORSRequest('GET', url);
		if (!xhr) {
			callback(false);
		}
		xhr.onload = function() {
			var text = xhr.responseText;
			callback(text);
		};
		xhr.onerror = function() { callback(false); };
		xhr.send();
	}
};