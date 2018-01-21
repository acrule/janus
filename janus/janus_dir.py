"""
Janus: Jupyter Notebook Extension that assists with notebook cleaning
"""

import os
import json
import datetime
from hashlib import sha1

# TODO write function docstrings
# TODO enable use on Windows machines (check directory structure)

def default_storage_dir():
    # get default directory for storing notebook history data
    user_dir = os.path.expanduser('~')
    janus_db_dir = os.path.join(user_dir, '.jupyter', 'janus')
    return janus_db_dir

def create_dir(dir_path):
    # try creating directory with a particular path
    # path: (str) full path to the directory
    try:
        os.makedirs(dir_path)
    except OSError:
        pass

def find_storage_dir():
    # determine where to store notebook history data

    # get default storage directory
    storage_dir = default_storage_dir()

    # determine if user has overridden default directory in config file
    config_path = '~/.jupyter/nbconfig/notebook.json'
    filename = os.path.expanduser(config_path)
    if os.path.isfile(filename):
        with open(filename) as data_file:
            data = json.load(data_file)
            try:
                if data["Comet"]["data_directory"]:
                    storage_dir = data["Comet"]["data_directory"]
            except:
                pass

    # create storage directory if it does not already exist
    if not os.path.exists(storage_dir):
        create_dir(storage_dir)

    return storage_dir

def hash_path(path):
    # get unique but semanticly meaningless identifier based on file path
    # path: (str) full path

    #only need first 8 charachters of hash to be uniquely identified
    h = sha1(path.encode())
    return h.hexdigest()[0:8]

# def was_saved_recently(version_dir, min_time=300):
#     """ check if a previous version of the file has been saved recently
#
#     version_dir: (str) dir to look for previous versions
#     min_time: (int) minimum time in seconds allowed between saves """
#
#     versions = [f for f in os.listdir(version_dir)
#         if os.path.isfile(os.path.join(version_dir, f))
#         and f[-6:] == '.ipynb']
#     if len(versions) > 0:
#         vdir, vname = os.path.split(versions[-1])
#         vname, vext = os.path.splitext(vname)
#         last_time_saved = datetime.datetime.strptime(vname[-26:],
#             "%Y-%m-%d-%H-%M-%S-%f")
#         delta = (datetime.datetime.now() - last_time_saved).seconds
#         return delta <= min_time
#     else:
#         return False
