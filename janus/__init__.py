"""
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
"""

import os
import ast
import json
import datetime

import nbformat
from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler, path_regex

# from .janus_diff import get_nb_diff
from .janus_sqlite import DbManager
from .janus_dir import find_storage_dir, create_dir, hash_path # was_saved_recently
# from .janus_viewer import get_viewer_html

class JanusHandler(IPythonHandler):

    # TODO merge all connections as using only one database
    # manage connections to various sqlite databases
    # db_manager_directory = {}
    db_manager = None

    # check if extension loaded by visiting http://localhost:8888/api/janus
    def get(self, path=''):
        """
        Render a website visualizing the notebook's edit history
        path: (str) relative path to notebook requesting POST
        """


        # get unique path to each file using filename and hashed path
        # we hash the path for a private, short, and unique identifier
        os_path = self.contents_manager._get_os_path(path)
        hashed_path = hash_path(os_path)

        janus_dir = find_storage_dir()
        db_path = os.path.join(janus_dir, "nb_history.db")

        query_type = self.get_argument('q', None, True)


        if not self.db_manager:
            self.db_manager = DbManager(db_path)
        # os_dir, fname = os.path.split(os_path)
        # fname, file_ext = os.path.splitext(fname)

        # query the database for nb_configs
        if (query_type == 'config'):
            nb_configs = self.db_manager.get_nb_configs(hashed_path)
            self.finish(json.dumps({'nb_configs': nb_configs}))
        elif (query_type == 'versions'):
            version_ids = self.get_argument('version_ids', None, True)
            version_ids = ast.literal_eval(version_ids)

            cells = self.db_manager.get_versions(version_ids)

            self.finish(json.dumps({'cells': cells}))
        else:
            self.finish(json.dumps({'msg': "Did not understand the request"}))

    def post(self, path=''):
        """
        Save data about notebook actions
        path: (str) relative path to notebook requesting POST
        """

        # hash the path for a private, short, and unique nb identifier
        os_path = self.contents_manager._get_os_path(path)
        hashed_path = hash_path(os_path)

        # find where the nb_history database should be
        janus_dir = find_storage_dir()
        db_path = os.path.join(janus_dir, "nb_history.db")

        # if needed, create storage directories
        if not os.path.isdir(janus_dir):
            create_dir(janus_dir)
            # create_dir(version_dir)

        # set up connection with database
        if not self.db_manager:
            self.db_manager = DbManager(db_path)

        # db_manager = self.db_manager_directory[db_key]

        # save data
        post_data = self.get_json_body()
        # hashed_full_path = os.path.join(hashed_path, fname + file_ext)

        # TODO make this a flag in the metadta
        track_actions = True

        if track_actions:
            self.db_manager.record_action(post_data, hashed_path)
        # save_changes(os_path, post_data, db_manager, hashed_full_path)

        self.finish(json.dumps({'hashed_nb_path': hashed_path}))

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
