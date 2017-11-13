"""
Janus: Jupyter Notebook Extension that assist with notebook cleaning
"""

import os
import json
import datetime

from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler, path_regex

class JanusHandler(IPythonHandler):

    # check if extension loaded by visiting http://localhost:8888/api/janus
    def get(self, path=''):
        """
        Handle GET request
        """

        html = "<h1>Janus is working</h1>"
        self.write(html)

    def post(self, path=''):
        """
        Handle POST request
        """

        print("Just got the Janus POST requst")
        self.finish(json.dumps({'time': datetime.now()}))

def _jupyter_server_extension_paths():
    """
    Jupyter server configuration
    returns dictionary with where to find server extension files
    """
    return [{
        "module": "janus"
    }]

def _jupyter_nbextension_paths():
    """
    Jupyter nbextension configuration
    returns dictionary with where to find nbextension files
    """
    return [dict(
        section="notebook",
        # the path is relative to the `janus` directory
        src="static",
        # directory in the `janus/` namespace
        dest="janus",
        # _also_ in the `janus/` namespace
        require="janus/main")]

def load_jupyter_server_extension(nb_app):
    """
    Load the server extension and set up routing to proper handler
    nb_app: (obj) Jupyter Notebook Application
    """

    nb_app.log.info('Janus Server extension loaded')
    web_app = nb_app.web_app
    host_pattern = '.*$'
    route_pattern = url_path_join(web_app.settings['base_url'],
                                    r"/api/janus%s" % path_regex)
    web_app.add_handlers(host_pattern, [(route_pattern, JanusHandler)])
