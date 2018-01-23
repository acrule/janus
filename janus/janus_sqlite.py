"""
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Handles interactions with the database storing notebook history data
"""

import pickle
import sqlite3
from threading import Timer

from janus.janus_diff import check_for_nb_diff

# TODO Put time and version history numbers into the history scroller
# TODO Style the history window
# TODO Enable cell folding in history viewer
# TODO fix cell selection bug

class DbManager(object):
    def __init__(self, db_path):

        # path to the database
        self.db_path = db_path

        # timer so we don't access the db too often
        self.commitTimer = None

        # and queues for storing data to be committed
        self.action_queue = []
        self.cell_queue = []
        self.nb_queue = []

        # create db tables if they don't already exist
        self.create_initial_tables()

    def create_initial_tables(self):
        """
        Create action, cell, and nb_config tables for later use
        """

        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()

        self.c.execute('''CREATE TABLE IF NOT EXISTS actions (time integer,
            name text, selected_cell integer, selected_cells text)''')

        self.c.execute('''CREATE TABLE IF NOT EXISTS cells (time integer,
            cell_id text, version_id text, cell_data text)''')

        self.c.execute('''CREATE TABLE IF NOT EXISTS nb_configs (time integer,
            name text, cell_order text, version_order text)''')

        self.conn.commit()
        self.conn.close()

    def record_nb_config(self, t, nb_name, cell_order, version_order):
        """
        Record new notebook configuration

        t: (int) time when action triggering this new configuration occured
        nb_name: (str) hashed full path to the notebook
        cell_order: (list) strings of unique cell identifiers
        version_order: (list) strings of unique cell version identifiers
        """

        # save the data to the database queue
        nb_data_tuple = (t, str(nb_name), str(cell_order), str(version_order))
        self.nb_queue.append(nb_data_tuple)
        self.update_timer()

    def record_cell(self, t, cell_id, version_id, cell_data):
        """
        Record new cell version

        t: (int) time when action triggering this new cell occured
        cell_id: (str) unique cell identifier
        version_id: (str) unique cell version identifier
        cell_data: (obj) JSON representation of the new cell version
        """

        # save the data to the database queue
        cell_data_tuple = (t, str(cell_id), str(version_id), pickle.dumps(cell_data))
        self.cell_queue.append(cell_data_tuple)
        self.update_timer()

    def record_action(self, action_data, hashed_path):
        """
        save action to database

        action_data: (dict) data about action, including name and full notebook
        hashed_path: (str) hashed path to where notebook is saved on volume
        """

        # save the data to the database queue
        t = action_data['time']
        name = action_data['name']
        selected_index = action_data['index']
        selected_indicies = action_data['indices']
        cells = action_data['model']['cells']
        action_data_tuple = (str(t), str(name), str(selected_index),
                            str(selected_indicies))
        self.action_queue.append(action_data_tuple)

        # check for new cells or nb_configs as a result of this action
        check_for_nb_diff(t, hashed_path, cells, self)

        # commit all queues if notebook is closing, otherwise update our timer
        if name == 'notebook-closed':
            self.commit_queues()
        self.update_timer()

    def commit_queues(self):
        """
        commit any data in queues to the database We queue data until there is
        a pause in activity (e.g. 2 seconds) to limit db open / close
        """

        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()

        try:
            self.c.executemany('INSERT INTO actions VALUES (?,?,?,?)', self.action_queue)
            self.c.executemany('INSERT INTO cells VALUES (?,?,?,?)', self.cell_queue)
            self.c.executemany('INSERT INTO nb_configs VALUES (?,?,?,?)', self.nb_queue)

            self.conn.commit()
            self.conn.close()

            self.action_queue = []
            self.cell_queue = []
            self.nb_queue = []

        except:
            self.conn.rollback()
            raise

    def update_timer(self):
        """
        Delay committing data until 2 seconds of idle activity
        """

        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None
        # else:
        self.commitTimer = Timer(2.0, self.commit_queues)
        self.commitTimer.start()

    def execute_search(self, search):
        """
        execute a particular search against the database

        search: (str) SQL query
        """

        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        self.c.execute(search)
        rows = self.c.fetchall()
        return rows

    def get_nb_configs(self, path, start, end):
        """
        Return list of all prior nb configurations (e.g. cell and cell versions)

        paths: (list) with [hashed_path, start_time, end_time]
        """

        matched_configs = []

        # look for nb_configs in the queue
        queued_configs = [q for q in self.nb_queue if q[1] == nb_name].reverse()
        if(queued_configs):
            for q in queued_configs:
                matched_configs.append(q)

        # look for older configs in the database
        search = "SELECT * FROM nb_configs WHERE name = \'" + path + "\' AND time BETWEEN " + str(start) + " and " + str(end)
        rows = self.execute_search(search)
        for row in rows:
            matched_configs.append(row)

        matched_configs.sort(key=lambda x: x[0])
        return matched_configs

    def get_last_nb_config(self, nb_name):
        """
        Return last nb configuration (e.g. cell and cell versions)

        nb_name: (str) hashed path to the notebook
        """

        # Look for last nb_config in the queue
        if len(self.nb_queue) > 0:
            return self.nb_queue[-1]

        # Look for last nb_config in the database
        else:
            search = "SELECT * FROM nb_configs WHERE name = \'" + nb_name + "\' ORDER BY time DESC LIMIT 1"
            rows = self.execute_search(search)

            if len(rows) > 0:
                return rows[0]
            else:
                return []

    def get_last_cell_version(self, cell_id):
        """
        Return a particular cell version

        cell_id: (str) unique cell identifier to look for
        """

        # look for last cell version in the queue
        matched_in_queue = [q for q in self.cell_queue if q[1] == cell_id]
        if len(matched_in_queue) > 0:
            return matched_in_queue[-1]

        # otherwise look for cell version in the database
        else:
            search = "SELECT * FROM cells WHERE cell_id = \'" + cell_id + "\'"
            rows = self.execute_search(search)
            if len(rows) > 0:
                return rows[-1]
            else:
                return (0,"","","")

    def get_all_cell_versions(self, cell_id):
        """
        Return list of all prior versions of cell

        cell_id: (str) unique cell identifier
        """

        # look for versions of a particular cell in the queue
        matched_versions = [q for q in self.cell_queue if q[2] == cell_id].reverse()
        if not matched_versions:
            matched_versions = []

        # look for versions of the cell in the database
        search = "SELECT * FROM cells WHERE cell_id = \'" + cell_id + "\' ORDER BY time DESC"
        rows = self.execute_search(search)
        for row in rows:
            matched_versions.append(row)

        return matched_versions

    def get_versions(self, version_ids):
        """
        Return dict of particular cell versions with cell_id as keys

        version_ids: (list) unique cell version identifiers
        """

        # look for particular versions in the queue
        matched_in_queue = [q for q in self.cell_queue if q[2] == version_id]
        if not matched_in_queue:
            matched_in_queue = []

        # look for particular versions in the database
        if len(version_ids) > 1:
            version_ids = str(tuple(version_ids))
            search = "SELECT * FROM cells WHERE version_id in " + version_ids
        else:
            search = "SELECT * FROM cells WHERE version_id = \'" + version_ids[0] + "\'"
        rows = self.execute_search(search)
        for row in rows:
            matched_in_queue.append(row)

        cell_dict = {}
        for m in matched_in_queue:
            cell_dict[m[2]] = pickle.loads(m[3])

        return cell_dict
