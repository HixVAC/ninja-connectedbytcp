var Socket = require('./lib/socket')
  , util = require('util')
  , stream = require('stream')
  , ConnectedByTCP = require('connectedbytcp')
  , configHandlers = require('./lib/config');

// Give our module a stream interface
util.inherits(connectedbytcp,stream);

/**
 * Called when our client starts up
 * @constructor
 *
 * @param  {Object} opts Saved/default module configuration
 * @param  {Object} app  The app event emitter
 * @param  {String} app.id The client serial number
 *
 * @property  {Function} save When called will save the contents of `opts`
 * @property  {Function} config Will be called when config data is received from the cloud
 *
 * @fires register - Emit this when you wish to register a device (see Device)
 * @fires config - Emit this when you wish to send config data back to the cloud
 */
function connectedbytcp(opts,app) {

  var self = this;
  this._app = app;
  this._opts = opts;
  this._opts.sockets = opts.sockets || [];
  this.devices = [];
  app.once('client::up', this.init.bind(this));
 };

/**
 * Discover and load TCP Bases
 */
connectedbytcp.prototype.init = function(){
  this._app.log.info("(TCP Lights) init()");

  this._opts.sockets.forEach(this.load.bind(this));
};

// Export it
module.exports = connectedbytcp;

connectedbytcp.prototype.load = function(host) {
	var self = this;
	
	this._app.log.info("(TCP Lights) Device at " + host + " is now being registered");
	app = this._app;
	
	var client = new ConnectedByTCP(host);
    
	var fetchState = function() {
		client.GetState(function(error,system){
			if(!error){
				system.forEach(function(room) { 
					if( self.devices[room["rid"]] == undefined ){
						var G = "TCP"+room["rid"];
						var name = room["name"];
						var id = room["rid"];
						
						var device = new Socket(self._app,client,G,name,id,"room");
						self.devices[room["rid"]] = device;
						self.emit('register',device);
						
						var rdevices = room["device"];
						if (typeof(rdevices["did"]) !== 'undefined'){
							// Only One Device So Don't Add
						}else{
							rdevices.forEach(function(rdevice) { 
								var dG = "TCP"+rdevice["did"];
								var dname = name + " > " + rdevice["name"];
								var did = rdevice["did"];
						
								var ddevice = new Socket(self._app,client,dG,dname,did,"device");
								
								self.devices[did] = ddevice;
								self.emit('register',ddevice);
							});
						}
					}else{
						// Update Room
						self.devices[ room["rid"] ].updateState(room);
						
						// Update Fixtures In Room
						var rdevices = room["device"];
						if (typeof(rdevices["did"]) !== 'undefined'){
							// Only One Device So Don't Add
						}else{
							rdevices.forEach(function(rdevice) { 
								self.devices[ rdevice["did"] ].updateState(rdevice);
							});
						}
					}
				});
			}
			setTimeout(fetchState,5000);
		});
		
	};
	setTimeout(fetchState,1000);
};

/**
 * Add a particular TCP to this configuration
 * @param {[String} host Host of the TCP to remember
 */
connectedbytcp.prototype.remember = function(host) {
  this._app.log.info("(TCP Lights) remember()");
  this._opts.sockets.push(host);
  this.save();
};

/**
 * Called when a user prompts a configuration
 * @param  {Object}   rpc     RPC Object
 * @param  {Function} cb      Callback with return data
 */
connectedbytcp.prototype.config = function(rpc,cb) {
  this._app.log.info("(TCP Lights) config()");
  var self = this;

  if (!rpc) {
    return configHandlers.probe.call(this,cb);
  }

  switch (rpc.method) {
    case 'configScan':               return configHandlers.configScan.call(this,rpc.params,cb); break;
    case 'manual_set_tcp':    return configHandlers.manual_set_tcp.call(this,rpc.params,cb); break;
    case 'manual_get_tcp':    return configHandlers.manual_get_tcp.call(this,rpc.params,cb); break;
    case 'manual_show_remove': return configHandlers.manual_show_remove.call(this,rpc.params,cb); break;
    case 'manual_remove_tcp': return configHandlers.manual_remove_tcp.call(this,rpc.params,cb); break;
    default:                   return cb(true);                                              break;
  }
};
