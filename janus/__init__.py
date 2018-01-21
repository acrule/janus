"""
Janus: Jupyter Notebook Extension that assists with notebook cleaning
"""

import os
import json
import datetime

import nbformat
from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler, path_regex

from .janus_diff import get_nb_diff
from .janus_sqlite import DbManager
from .janus_dir import find_storage_dir, create_dir, hash_path # was_saved_recently
# from .janus_viewer import get_viewer_html

class JanusHandler(IPythonHandler):

    # TODO merge all connections as using only one database
    # manage connections to various sqlite databases
    db_manager_directory = {}

    # check if extension loaded by visiting http://localhost:8888/api/janus
    def get(self, path=''):
        """
        Render a website visualizing the notebook's edit history
        path: (str) relative path to notebook requesting POST
        """

        # get unique path to each file using filename and hashed path
        # we hash the path for a private, short, and unique identifier
        os_dir, fname = os.path.split(self.contents_manager._get_os_path(path))
        fname, file_ext = os.path.splitext(fname)
        hashed_path = hash_path(os_dir)
        data_dir = find_storage_dir()

        # display visualization of janus data
        # data = get_viewer_html(data_dir, hashed_path, fname)
        # if len(data['versions']) > 0:
        #     self.render("comet_template.html", data = data)
        # else:
        self.render("janus_template_nodata.html", filename = fname)

    def post(self, path=''):
        """
        Save data about notebook actions
        path: (str) relative path to notebook requesting POST
        """
        # get file, directory, and database names
        # we hash the path for a private, short, and unique identifier
        os_path = self.contents_manager._get_os_path(path)
        os_dir, fname = os.path.split(os_path)
        fname, file_ext = os.path.splitext(fname)
        hashed_path = hash_path(os_dir)
        dest_dir = os.path.join(find_storage_dir(), hashed_path, fname)
        version_dir = os.path.join(dest_dir, "versions")
        db_path = os.path.join(dest_dir, fname + ".db")
        db_key = os.path.join(hashed_path, fname)

        # if needed, create storage directories
        if not os.path.isdir(dest_dir):
            create_dir(dest_dir)
            create_dir(version_dir)

        # set up connection with database
        if db_key not in self.db_manager_directory:
            self.db_manager_directory[db_key] = DbManager(db_key, db_path)

        db_manager = self.db_manager_directory[db_key]

        # save data
        post_data = self.get_json_body()
        hashed_full_path = os.path.join(hashed_path, fname + file_ext)

        if track_actions:
            db_manager.record_action(post_data, hashed_full_path)
        # save_changes(os_path, post_data, db_manager, hashed_full_path)

        self.finish(json.dumps({'hashed_nb_path': hashed_full_path}))

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

    # def get_template_path(self):
    #     return None

# def save_changes(os_path, action_data, db_manager, hashed_full_path,
#                 track_versions=True, track_actions=True):
#     """
#     Track notebook changes with periodic snapshots, and action tracking
#     os_path: (str) path to notebook as saved on the operating system
#     action_data: (dict) action data in the form of
#         t: (int) time action was performed
#         name: (str) name of action
#         index: (int) selected index
#         indices: (list of ints) selected indices
#         model: (dict) notebook JSON
#     track_versions: (bool) periodically save full versions of the notebook
#     track_actions: (bool) track individual actions performed on the notebook
#     """
#
#     data_dir = find_storage_dir()
#     if not data_dir:
#         print("Could not find directory to save Janus data")
#     else:
#         # generate file names, using a hashed path to uniquely identify files
#         # with the same name (e.g., Untitled.ipynb)
#         os_dir, fname = os.path.split(os_path)
#         hashed_path = hash_path(os_dir)
#         fname, file_ext = os.path.splitext(fname)
#         # date_string = datetime.datetime.now().strftime("-%Y-%m-%d-%H-%M-%S-%f")
#
#         dest_dir = os.path.join(data_dir, hashed_path, fname)
#         version_dir = os.path.join(dest_dir, "versions")
#         dbname = os.path.join(dest_dir, fname + ".db")
#         # dest_fname = os.path.join(dest_dir, fname + ".ipynb")
#         # ver_fname = os.path.join(version_dir, fname + date_string + ".ipynb")
#
#         # save information about the action to the database
#
#         # # get the notebook in the correct format (nbnode)
#         # current_nb = nbformat.from_dict(action_data['model'])
#
#         # save file versions and only continue if nb has meaningfully changed
#         # if os.path.isfile(dest_fname):
#         #     diff, cell_order = get_nb_diff(action_data, dest_fname, True)
#         #     if not diff:
#         #         return
#         #
#         # # save the current file for future comparison
#         # nbformat.write(current_nb, dest_fname, nbformat.NO_CONVERT)
#
#         # save a time-stamped version periodically
#         # if track_versions:
#         #     if not was_saved_recently(version_dir):
#         #         nbformat.write(current_nb, ver_fname, nbformat.NO_CONVERT)
