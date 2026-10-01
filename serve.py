"""Portfolyo sitesini yerelde çalıştırmak için:

    python serve.py          # http://localhost:8000
    python serve.py 3000     # farklı port

Tarayıcıda otomatik açılır; dosya değiştirdiğinde sayfayı yenilemen yeterli.
"""
import http.server
import os
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # yenileince taze gelsin
        super().end_headers()


with http.server.ThreadingHTTPServer(("", PORT), Handler) as srv:
    url = f"http://localhost:{PORT}"
    print(f"🔥 Ateş hazır: {url}  (durdurmak için Ctrl+C)")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    srv.serve_forever()
