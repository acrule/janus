"""
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Manage directories where notebook history data is stored
"""

import os
import json
from hashlib import sha1

# TODO check if directory assignment works on Windows machines

def default_storage_dir():
    """
    return default directory for storing notebook history data
    """

    user_dir = os.path.expanduser('~')
    janus_db_dir = os.path.join(user_dir, '.jupyter', 'janus')
    return janus_db_dir


def create_dir(dir_path):
    """
    try creating directory with a particular path

    dir_path: (str) full path to the directory
    """

    try:
        os.makedirs(dir_path)
    except OSError:
        pass


def find_storage_dir():
    """
    return where to store notebook history data, default or user specified
    """

    # get default storage directory
    storage_dir = default_storage_dir()

    # determine if user has overridden default directory in config file
    user_dir = os.path.expanduser('~')
    config_path = os.path.join(user_dir, '.jupyter', 'nbconfig', 'notebook.json')
    filename = os.path.expanduser(config_path)
    if os.path.isfile(filename):
        with open(filename) as data_file:
            data = json.load(data_file)
            try:
                if data["Janus"]["data_directory"]:
                    storage_dir = data["Janus"]["data_directory"]
            except:
                pass

    # create storage directory if it does not already exist
    if not os.path.exists(storage_dir):
        create_dir(storage_dir)

    return storage_dir


def hash_path(path):
    """
    get unique, short, and encrypted notebook identifier based on full file path

    path: (str) full path to notebook
    """

    # only need first 8 charachters of hash to be uniquely identified
    h = sha1(path.encode())
    return h.hexdigest()[0:8]
