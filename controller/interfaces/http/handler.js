var
    _ = require('lodash'),
    fs = require('fs'),
    http = require('http'),
	path = require('path'),
    express = require('express'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    lessMiddleware = require('less-middleware'),

    disco = require('../../../common').disco,
    console = require('clim')()

    controllerConfig = (require('../../../config').cn || { }),
    httpConfig = (controllerConfig ? controllerConfig.http  : { }),
    wsConfig   = (controllerConfig ? controllerConfig.ws    : { })
    ;

(function() {
    'use strict';

    var HttpHandler = function(controller, port) {
        this.controller = controller;
        this.port = port;
    }

    HttpHandler.prototype.start = function() {
        var self = this;
        var app = express();

        app.use(express.logger('dev'));
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(methodOverride());

        // Set the x-powered-by header
        app.use(function(req, res, next) {
            res.header("X-powered-by", "Hobu, Inc.");
            next();
        });

        // development only
        if (app.get('env') == 'development') {
            app.use(express.errorHandler());
        }

        app.use(app.router);

        if (httpConfig.enableStaticServe) {
            app.set('views', __dirname + '/static/views');
            app.set('view engine', 'jade');

            var publicDir = '/static/public';
            app.use(lessMiddleware(path.join(__dirname, publicDir)));
            app.use(express.static(__dirname + publicDir));

            app.get('/ws/:pipelineId', function(req, res) {
                res.render('wsView');
            });

            app.get('/http/:pipelineId', function(req, res) {
                res.render('httpView');
            });
        }

        registerCommands(self.controller, app);

        var server = http.createServer(app);
        var port = httpConfig.port || 8081;

        disco.register('web', port, function(err, service) {
            if (err) return console.log("Failed to register service:", err);

            server.listen(service.port, function () {
                console.log('HTTP server running on port ' + port);
            });
        });
    }

    var extend = function(err, response, command) {
        var common = {
            status: !err,
            command: command
        }

        if (err) common['reason'] = err.message;

        return _.extend(response || { }, common);
    }

    var registerCommands = function(controller, app) {
        app.post('/create/:pipelineId', function(req, res) {
            controller.create(req.params.pipelineId, function(err, data) {
                res.json(extend(err, data, 'create'));
            });
        });

        app.get('/session/:session/numPoints', function(req, res) {
            controller.numPoints(req.params.session, function(err, data) {
                res.json(extend(err, data, 'numPoints'));
            });
        });

        app.get('/session/:session/schema', function(req, res) {
            controller.schema(req.params.session, function(err, data) {
                res.json(extend(err, data, 'schema'));
            });
        });

        app.get('/session/:session/stats', function(req, res) {
            controller.stats(req.params.session, function(err, data) {
                res.json(extend(err, data, 'stats'));
            });
        });

        app.get('/session/:session/srs', function(req, res) {
            controller.srs(req.params.session, function(err, data) {
                res.json(extend(err, data, 'srs'));
            });
        });

        app.get('/session/:session/fills', function(req, res) {
            controller.fills(req.params.session, function(err, data) {
                res.json(extend(err, data, 'fills'));
            });
        });

        app.post('/session/:session/serialize', function(req, res) {
            controller.serialize(req.params.session, function(err, data) {
                res.json(extend(err, data, 'serialize'));
            });
        });

        app.delete('/session/:session', function(req, res) {
            controller.destroy(req.params.session, function(err, data) {
                res.json(extend(err, data, 'destroy'));
            });
        });

        app.delete('/session/:session/readId/:readId', function(req, res) {
            controller.cancel(
                req.params.session,
                req.params.readId,
                function(err, data) {
                    res.json(extend(err, data, 'cancel'));
                }
            );
        });

        app.get('/session/:session/read', function(req, res) {
            controller.read(
                req.params.session,
                req.query,
                function(err, shRes) {
                    res.header('Num-Points', shRes.numPoints);
                    res.header('Read-ID', shRes.readId);

                    if (shRes.rasterMeta) {
                        res.header(
                            'Raster-Meta',
                            JSON.stringify(shRes.rasterMeta));
                    }
                },
                function(data) { res.write(data); },
                function() { res.end(); }
            );
        });
    }

    module.exports.HttpHandler = HttpHandler;
})();

