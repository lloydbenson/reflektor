// Load modules

var Ws = require('ws');
var Hoek = require('hoek');


// Declare internals

var internals = {};


internals.defaults = {
    endpoint: '/debug/terminal',
    host: 'localhost',
    port: 0
};


exports.register = function (plugin, options, next) {

    var settings = Hoek.applyToDefaults(internals.defaults, options || {});

    plugin.route({
        method: 'GET',
        path: settings.endpoint,
        handler: internals.handler
    });

    var server = new plugin.hapi.Server(settings.host, settings.port);
    server.start(function () {

        var subscribers = [];
        internals.template(server.info.host, server.info.port);
        var ws = new Ws.Server({ server: server.listener });
        ws.on('connection', function (socket) {

            subscribers.push(socket);
            socket.send('Welcome');
        });

        var oldStdout = process.stdout.write.bind(process.stdout);
        process.stdout.write = function (chunk, encoding) {

            oldStdout(chunk, encoding);
            transmit(chunk);
        };

        var oldStderr = process.stderr.write.bind(process.stderr);
        process.stderr.write = function (chunk, encoding) {

            oldStderr(chunk, encoding);
            transmit(chunk);
        };

        plugin.events.on('request', function (request) {

            transmit('Got a request');
        });

        var transmit = function (data) {

            for (var i = 0, il = subscribers.length; i < il; ++i) {
                try {
                    if (subscribers[i].readyState === Ws.OPEN) {
                        subscribers[i].send(data.toString());
                    }
                }
                catch (err) {}
            }
        };

        return next();
    });
};


internals.handler = function (request, reply) {

    reply(internals.template);
};


internals.template = function (host, port) {

    internals.template = '<!DOCTYPE html><html lang="en"><head><title>Debug Terminal</title>' +
        '<meta http-equiv="Content-Language" content="en-us">' +
        '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
        '</head><body>' +
        '<script language="javascript">' +
        'var ws = new WebSocket("ws://' + host + ':' + port + '");' +
        'ws.onmessage = function (event) { console.log(event.data); };' +
        '</script>' +
        '</body></html>';
};