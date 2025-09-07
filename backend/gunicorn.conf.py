bind = "0.0.0.0:5000"
workers = 3
threads = 2
timeout = 60
accesslog = "-"
errorlog = "-"
preload_app = True   # <-- ensures app (and seed) runs in master once, then forks
