# -*- coding: utf-8 -*-
# adapted from: https://gist.github.com/HaiyangXu/ec88cbdce3cdbac7b8d5

import sys
import http.server
import socketserver
from http import HTTPStatus

if len(sys.argv) != 3:
    raise Exception(f"Usage: {sys.argv[0]} address port")

ADDR = sys.argv[1]
PORT = sys.argv[2]

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        '.manifest': 'text/cache-manifest',
        '.text':     'text/plain',
        '.txt':      'text/plain',
        '.html':     'text/html',
        '.htm':      'text/html',
        '.css':      'text/css',
        '.jpeg':     'image/jpg',
        '.jpg':      'image/jpg',
        '.png':      'image/png',
        '.gif':      'image/gif',
        '.svg':      'image/svg+xml',
        '.js':       'application/javascript',
        '.cjs':      'application/javascript',
        '.mjs':      'application/javascript',
        '.json':     'application/json',
        '.wasm':     'application/wasm',
        '.xml':      'application/xml',
        '':          'application/octet-stream',  # default
    }

    # disable directory listing
    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND, "directory listing not supported")
        return None

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        http.server.SimpleHTTPRequestHandler.end_headers(self)

# The following avoids the problem where the server is still holding the socket open after exit:
# See: https://zaiste.net/posts/python_simplehttpserver_not_closing_port/
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer((ADDR, int(PORT)), Handler) as httpd:
    print("started server at", ADDR, PORT)
    httpd.serve_forever()
