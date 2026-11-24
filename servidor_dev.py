"""Servidor local de desarrollo sin caché (los módulos JS se recargan siempre).

Uso:  python servidor_dev.py [puerto] [carpeta]
"""
import functools
import http.server
import sys


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 5190
    carpeta = sys.argv[2] if len(sys.argv) > 2 else "."
    manejador = functools.partial(SinCache, directory=carpeta)
    with http.server.ThreadingHTTPServer(("127.0.0.1", puerto), manejador) as srv:
        print(f"Sirviendo {carpeta} en http://localhost:{puerto}")
        srv.serve_forever()
