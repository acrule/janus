"""
Janus: Jupyter Notebook Extension that assists with notebook cleaning
"""

import os
import pickle
import sqlite3
import nbformat
from threading import Timer

from janus.janus_diff import check_for_nb_diff

# TODO enable saving of only metadata, not the actual diff

class DbManager(object):
    def __init__(self, db_path):
        # self.db_key = db_key
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
        # save the data to the database queue
        nb_data_tuple = (t, str(nb_name), str(cell_order), str(version_order))
        self.nb_queue.append(nb_data_tuple)

        # commit data before notebook closes, otherwise let data queue until
        # there is a 2 second pause in activity to prevent rapid serial writing
        # to the database
        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None
        # else:
        self.commitTimer = Timer(2.0, self.commit_queues)
        self.commitTimer.start()

    def record_cell(self, t, cell_id, version_id, cell_data):
        # save the data to the database queue
        cell_data_tuple = (t, str(cell_id), str(version_id), pickle.dumps(cell_data))
        self.cell_queue.append(cell_data_tuple)

        # commit data before notebook closes, otherwise let data queue until
        # there is a 2 second pause in activity to prevent rapid serial writing
        # to the database
        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None
        # else:
        self.commitTimer = Timer(2.0, self.commit_queues)
        self.commitTimer.start()

    def record_action(self, action_data, hashed_full_path):
        """
        save action to sqlite database

        action_data: (dict) data about action, see above for more details
        dest_fname: (str) full path to where file is saved on volume
        db_manager: (DbManager) object managing DB read / write
        """

        # save the data to the database queue
        action_data_tuple = (str(action_data['time']), str(action_data['name']),
                    str(action_data['index']), str(action_data['indices']))
        self.action_queue.append(action_data_tuple)

        t = action_data['time']
        cells = action_data['model']['cells']
        check_for_nb_diff(t, hashed_full_path, cells, self)

        # commit data before notebook closes, otherwise let data queue until
        # there is a 2 second pause in activity to prevent rapid serial writing
        # to the database
        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None

        if action_data['name'] == 'notebook-closed':
            self.commit_queues()

        else:
            if not self.commitTimer:
                self.commitTimer = Timer(2.0, self.commit_queues)
                self.commitTimer.start()

    def commit_queues(self):
        # commit any queued data

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

# FUNCTIONS FOR RETRIEVING DATA TO PERFORM NOTEBOOK DIFF
    def get_last_nb_config(self, nb_name):

        # return the last nb configuration queued to be commited to the database
        if len(self.nb_queue) > 0:
            return self.nb_queue[-1]
        else:
            # or get the last one from the database
            self.conn = sqlite3.connect(self.db_path)
            self.c = self.conn.cursor()

            search = "SELECT * FROM nb_configs WHERE name = \'" + nb_name + "\' ORDER BY time DESC LIMIT 1"
            self.c.execute(search)
            rows = self.c.fetchall()

            if len(rows) > 0:
                return rows[0]
            else:
                return []

    def get_last_cell_version(self, version_id):
        matched_in_queue = [q for q in self.cell_queue if q[1] == version_id]
        if len(matched_in_queue) > 0:
            return matched_in_queue[-1]

        else:
            # cell_versions_tuple = str(tuple(cell_versions))
            self.conn = sqlite3.connect(self.db_path)
            self.c = self.conn.cursor()

            search = "SELECT * FROM cells WHERE version_id = \'" + version_id + "\'"
            self.c.execute(search)

            rows = self.c.fetchall()
            return rows[-1]

    def get_all_cell_versions(self, cell_id):
        matched_versions = [q for q in self.cell_queue if q[2] == cell_id].reverse()
        if not matched_versions:
            matched_versions = []

        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        search = "SELECT * FROM cells WHERE cell_id = \'" + cell_id + "\' ORDER BY time DESC"
        self.c.execute(search)
        rows = self.c.fetchall()

        for row in rows:
            matched_versions.append(row)

        return matched_versions
