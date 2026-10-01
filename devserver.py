import http.server
import os
import socket
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # tipos MIME explícitos: en Windows el registro puede devolver text/plain
    # para .js y el navegador se niega a cargar los módulos ES
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.otf': 'font/otf',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, format, *args):
        # solo errores: el log de cada petición (fuentes, PNG...) ralentiza la consola
        if len(args) > 1 and str(args[1]).startswith(('4', '5')):
            super().log_message(format, *args)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True  # un móvil que deja conexiones abiertas no bloquea el cierre
    # en Windows SO_REUSEADDR deja que DOS servidores escuchen el mismo puerto
    # (uno viejo colgado seguiría respondiendo): ahí lo desactivamos
    allow_reuse_address = os.name != 'nt'
    request_queue_size = 64

    def handle_error(self, request, client_address):
        # el móvil corta conexiones a menudo (cambio de app, pantalla apagada):
        # no es un fallo del servidor, así que no volcamos la traza entera
        exc = sys.exc_info()[1]
        if isinstance(exc, (ConnectionError, socket.timeout, TimeoutError)):
            return
        super().handle_error(request, client_address)


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(('8.8.8.8', 80))
            return s.getsockname()[0]
    except OSError:
        return None


if __name__ == '__main__':
    # servimos siempre desde la carpeta donde vive este script, sin importar
    # cuál sea el directorio de trabajo del proceso que lo lanza
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    with Server(('0.0.0.0', port), NoCacheHandler) as httpd:
        print(f'Ordenador: http://localhost:{port}/', flush=True)
        ip = lan_ip()
        if ip:
            print(f'Móvil (misma wifi): http://{ip}:{port}/', flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor detenido.')
