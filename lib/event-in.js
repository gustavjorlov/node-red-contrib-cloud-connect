module.exports = function(RED) {
  var AWS = require("aws-sdk");
  var AWSIot = require('aws-iot-device-sdk');
  
  function EventInNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    
    this.account = RED.nodes.getNode(config.account);
    this.topic = config.topic;
    this.name = config.name;
    
    node.status({ fill:"red", shape:"ring", text:"disconnected" });
    
    this.account.on("login",function() {
      var creds = AWS.config.credentials;
      
      var mqtt = node.mqtt = AWSIot.device({
        region: AWS.config.region,
        protocol: 'wss',
        maximumReconnectTimeMs: 8000,
        accessKeyId: creds.accessKeyId,
        secretKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken
      });

      mqtt.on('connect', function() {
        node.status({ fill:"green", shape:"dot", text:"connected" });
        mqtt.subscribe(node.topic);
      });
      
      mqtt.on('message', function(topic, payload) {
        node.send({
          topic: topic,
          payload: JSON.parse(payload)
        });
      });
    });
    
    this.close = function() {
      if (node.mqtt && node.topic) node.mqtt.unsubscribe(node.topic);
    };
    
  }
  RED.nodes.registerType("cloud-connect-event-in", EventInNode);
}