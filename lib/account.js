module.exports = function(RED) {
  function AccountNode(config) {
    var node = this;
    RED.nodes.createNode(node, config);
    var AWS = require("aws-sdk");
    var request = require("request");
    var manifestBaseUrl = 'https://1u31fuekv5.execute-api.eu-west-1.amazonaws.com/prod/manifest/?hostname=';

    function authenticateUser(invoke, config, callback){
      var payload = {
        action: 'LOGIN',
        attributes: {
          userName: config.username,
          password: config.password
        }
      };
      invoke("AuthLambda", payload, callback);
    }
    function setupAWSCredentials(region, identityPool){
      AWS.config.region = region;
      AWS.config.credentials = new AWS.CognitoIdentityCredentials({ IdentityPoolId: identityPool});
    }
    function loginToAWS(token, region, userpool, cb){
      AWS.config.credentials.params.Logins = {['cognito-idp.' + region + '.amazonaws.com/' + userpool]: token};
      AWS.config.credentials.expired = true;
      AWS.config.credentials.get(function() { cb(null); });
    }
    function getManifest(url, callback){
      request(url, function(err, res, body){
        if(!err && body) callback(null, JSON.parse(body));
        else callback(err);
      });
    }

    function createInvokeFunction (manifest, endpoint, payload, callback) {
      var params = {
        FunctionName: manifest[endpoint],
        Payload: JSON.stringify(payload)
      };
      var lambda = new AWS.Lambda();
      lambda.invoke(params, function(err, res) {
        if (!err) {
          var payload = JSON.parse(res.Payload);
          if (!payload.errorMessage) callback(null, payload);
          else callback(JSON.parse(payload.errorMessage));
        }
        else callback(err);
      });
    };

    var manifestUrl = manifestBaseUrl + config.url;
    getManifest(manifestUrl, function(err, manifest){
      if(err) node.emit("error", err);
      else {
        node.invoke = createInvokeFunction.bind(null, manifest);

        setupAWSCredentials(manifest.Region, manifest.IdentityPool);
        authenticateUser(node.invoke.bind(null), config, function(err, res){
          if(err) node.emit("error", err);
          else {
            loginToAWS(res.credentials.token, manifest.Region, manifest.UserPool, function(err){
              if(err) node.emit("error", err);
              else node.emit("login");
            });
          }
        });
      }
    });
  }
  RED.nodes.registerType("cloud-connect-account", AccountNode);
}
