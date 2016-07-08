module.exports = function(RED) {
  var AWS = require("aws-sdk");
  
  function ApiNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
        
    this.account = RED.nodes.getNode(config.account);
    this.endpoint = config.endpoint;
    
    node.status({ fill:"red", shape:"ring", text:"disconnected" });
    this.account.on("login",function() {
      node.lambda = new AWS.Lambda();
      node.status({ fill:"green", shape:"dot", text:"connected" });
    });
        
    this.on('input', function(msg) {
      node.account.invoke(node.endpoint, msg.payload, function(err, res) {
        msg.payload = err || res;
        node.send(msg);
      });
    });
  }
  RED.nodes.registerType("cloud-connect-api", ApiNode);
}