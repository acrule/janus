"""
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Implements main handler for saving and retrieving notebook history
"""

import os
import ast
import json

from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler, path_regex

from .janus_sqlite import DbManager
from .janus_dir import find_storage_dir, create_dir, hash_path

class JanusHandler(IPythonHandler):
    """Implements main handler for saving and retrieving notebook history."""

    # object managing connection to notebook history database
    db_manager = None

    def get(self, path=''):
        """
        Retrieve requested data about notebook history

        path: (str) relative path of notebook GET request
        """

        # get db connection
        self.db_manager = self.get_db()

        # hash path to get short, encrypted, and unique notebook identifier
        os_path = self.contents_manager._get_os_path(path)
        hashed_path = hash_path(os_path)

        # either a list of all previous notebook cell configurations
        query_type = self.get_argument('q', None, True)

        path = self.get_argument('path', None, True)
        start = self.get_argument('start', None, True)
        end = self.get_argument('end', None, True)

        # paths = ast.literal_eval( self.get_argument('paths', None, True) )

        if (query_type == 'config'):
            nb_configs = self.db_manager.get_nb_configs(path, start, end)
            self.finish(json.dumps({'nb_configs': nb_configs}))

        # or data about individual cell versions
        elif (query_type == 'versions'):
            version_ids = self.get_argument('version_ids', None, True)
            version_ids = ast.literal_eval(version_ids)
            cells = self.db_manager.get_versions(version_ids)
            self.finish(json.dumps({'cells': cells}))

        # or data about a cell's entrie history
        elif (query_type == 'cell_history'):
            cell_id = self.get_argument('cell_id', None, True)
            versions = self.db_manager.get_cell_history(path, start, end, cell_id)
            self.finish(json.dumps({'versions': versions}))

        elif (query_type == 'comment'):
            comments = self.db_manager.get_comments()
            self.finish(json.dumps({'comments': comments}))

        else:
            self.finish(json.dumps({'msg': "Did not understand the request"}))

    def post(self, path=''):
        """Save data about notebook actions

        path: (str) relative path to notebook requesting POST
        """

        # get db connection
        self.db_manager = self.get_db()

        # hash path for a short, encrypted and unique notebook identifier
        os_path = self.contents_manager._get_os_path(path)
        hashed_path = hash_path(os_path)

        # save data sent in POST
        post_data = self.get_json_body()
        if post_data['type'] == "action":
            self.db_manager.record_action(post_data, hashed_path)
        elif post_data['type'] == "log":
            self.db_manager.record_log(post_data, hashed_path)
        elif post_data['type'] == "comment":
            self.db_manager.record_comment(post_data, hashed_path)
        elif post_data['type'] == "export_db":
            self.db_manager.export_data_and_clean(hashed_path, False)  # TODO: any params we need?
        self.finish(json.dumps({'hashed_nb_path': hashed_path}))

    def get_db(self):
        """
        Ensure notebook history database is present
        """

        # if needed, create directory for database
        janus_dir = find_storage_dir()
        if not os.path.isdir(janus_dir):
            create_dir(janus_dir)

        # set up connection with database
        db_path = os.path.join(janus_dir, "nb_history.db")
        if self.db_manager:
            return self.db_manager
        else:
            return DbManager(db_path)


def _jupyter_server_extension_paths():
    """serverextension configuration. Returns dict of serverext file location."""

    return [{
        "module": "janus"
    }]

def _jupyter_nbextension_paths():
    """nbextension configuration. Returns dict of nbextension file location."""

    return [dict(
        section="notebook",
        # the path is relative to the `janus` directory
        src="static",
        # directory in the `janus/` namespace
        dest="janus",
        # _also_ in the `janus/` namespace
        require="janus/main")]

def load_jupyter_server_extension(nb_app):
    """Load the server extension and set up routing to proper handler.

    nb_app: (obj) Jupyter Notebook Application
    """

    nb_app.log.info('Janus Server extension loaded')
    web_app = nb_app.web_app
    host_pattern = '.*$'
    route_pattern = url_path_join(web_app.settings['base_url'],
                                    r"/api/janus%s" % path_regex)
    web_app.add_handlers(host_pattern, [(route_pattern, JanusHandler)])
