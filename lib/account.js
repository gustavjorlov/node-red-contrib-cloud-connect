module.exports = function(RED) {
  function AccountNode(config) {
    var node = this;
    RED.nodes.createNode(node, config);
    var AWS = require("aws-sdk");
    var request = require("request");
    var manifestBaseUrl = 'https://1u31fuekv5.execute-api.eu-west-1.amazonaws.com/prod/manifest/?hostname=';
    var refreshToken = null;
    var accessToken = null;
    var region = null;
    var identityPool = null;
    var userPool = null;

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
    function setupAWSCredentials(){
      AWS.config.region = region;
      AWS.config.credentials = new AWS.CognitoIdentityCredentials({ IdentityPoolId: identityPool});
    }
    function loginToAWS(token, cb){
      AWS.config.credentials.params.Logins = {['cognito-idp.' + region + '.amazonaws.com/' + userPool]: token};
      AWS.config.credentials.expired = true;
      AWS.config.credentials.get(function(err) {
        if(err) console.log('AWS.config.credentials.get err', err);
        cb(null);
      });
    }
    function refreshAccessToken(callback){
      setupAWSCredentials(region);
      var payload = {
        action: 'REFRESH',
        attributes: {refreshToken: refreshToken}
      };
      console.log("refreshAccessToken trying to refresh using", payload);
      node.invoke("AuthLambda", payload, function(err, data){
        console.log("AuthLambda refreshToken", err, data);

        refreshToken = data.credentials.refreshToken;
        accessToken = data.credentials.token;
        loginToAWS(data.credentials.token, function(loginErr){
          if(err) {
            node.emit("error", loginErr);
            callback(loginErr);
          } else {
            node.emit("login");
            callback(loginErr, data);
          }
        });
      });
    }
    function getManifest(url, callback){
      request(url, function(err, res, body){
        if(!err && body) callback(null, JSON.parse(body));
        else callback(err);
      });
    }

    function createInvokeFunction (manifest, endpoint, payload, callback) {
      if (!manifest.hasOwnProperty(endpoint)) callback('Connection to API failed', null);
      else {
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
          } else {
            if(err.code === 'CredentialsError' || err.code === 'NotAuthorizedException'){
              console.log('err.code', err.code, 'will refreshAccessToken with', refreshToken);
              refreshAccessToken(function(refreshErr, refreshData){
                console.log('refreshAccessToken responded with', refreshErr, refreshData);
                console.log("will retry lambda.invoke with", params);
                lambda.invoke(params, function(err, res){
                  callback(err, res);
                });
              });
            } else {
              callback(err);
            }
          }
        });
      }
    };

    var manifestUrl = manifestBaseUrl + config.url;
    getManifest(manifestUrl, function(err, manifest){
      if(err) node.emit("error", err);
      else {
        node.invoke = createInvokeFunction.bind(null, manifest);
        identityPool = manifest.IdentityPool;
        region = manifest.Region;
        userPool = manifest.UserPool;

        setupAWSCredentials();
        authenticateUser(node.invoke.bind(null), config, function(err, res){
          if(err) node.emit("error", err);
          else {
            refreshToken = res.credentials.refreshToken;
            accessToken = res.credentials.token;
            loginToAWS(res.credentials.token, function(err){
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
