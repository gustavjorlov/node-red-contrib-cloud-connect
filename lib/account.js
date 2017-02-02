module.exports = function(RED) {
  var AWS = require("aws-sdk");
  var request = require("request");
    
  function AccountNode(n) {
    RED.nodes.createNode(this,n);
    var node = this;
    
    this.url = n.url;
    this.username = n.username;
    this.password = n.password;
    
    this.invoke = function(endpoint, payload, cb) {
      var params = {
        FunctionName: node.manifest[endpoint],
        Payload: JSON.stringify(payload)
      };
      var lambda = new AWS.Lambda();
      lambda.invoke(params, function(err, res) {
        if (!err) {
          var pl = JSON.parse(res.Payload);
          if (!pl.errorMessage) {
            cb(null, pl)
          } else {
            cb(JSON.parse(pl.errorMessage))
          }
        } else {
          cb(err);
        }
      });
    }
    
    var manifestUrl = 'https://1u31fuekv5.execute-api.eu-west-1.amazonaws.com' + 
    '/prod/manifest/?hostname=' + this.url;
    
    request(manifestUrl, function(err, res, body) {
      if (body && !err) {
        var mf = node.manifest =  JSON.parse(body);
        
        AWS.config.region = mf.Region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
          IdentityPoolId: mf.IdentityPool
        });
        
        var pl = {
          action: 'LOGIN',
          attributes: {
            userName: node.username,
            password: node.password
          }
        };
        node.invoke("AuthLambda", pl, function(err, res) {
          if (!err) {
            var creds = res.credentials;
            AWS.config.credentials.params.Logins = {
				      ['cognito-idp.' + mf.Region + '.amazonaws.com/' + mf.UserPool]: creds.token
			      };
            AWS.config.credentials.expired = true;
            AWS.config.credentials.get(function() {
              node.emit("login");
            })
          } else {
            node.emit("error", err);
          }
        })
      }
    })
  }
  RED.nodes.registerType("cloud-connect-account", AccountNode);
}
