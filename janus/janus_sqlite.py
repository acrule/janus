"""
Janus: Jupyter Notebook Extension that assists with notebook cleaning
"""

import os
import pickle
import sqlite3
import nbformat
from threading import Timer

from janus.janus_diff import get_nb_diff

# TODO enable saving of only metadata, not the actual diff

class DbManager(object):
    def __init__(self, db_key, db_path):
        self.db_key = db_key
        self.db_path = db_path

        # timer so we don't access the db too often
        # and queues for storing data to be committed
        self.commitTimer = None
        self.action_queue = []
        self.cell_queue = []
        self.nb_queue = []

        # create db tables if they don't already exist
        self.create_action_table()
        self.create_cell_table()
        self.create_nb_table()

    def get_last_nb_config(self, nb_name):
        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        search = "SELECT * FROM nb_config WHERE name = " + nb_name + " ORDER BY ID DESC LIMIT 1"
        c.execute(search)
        rows = c.fetchall()
        if len(rows > 0):
            return rows[0]
        else:
            return []

    def get_cell_versions(self, cell_versions):
        cell_versions_tuple = str(tuple(cell_versions))
        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        search = "SELECT * FROM cells WHERE version_id IN " + cell_versions_tuple
        c.execute(search)
        rows = c.fetchall()
        return rows

    def get_previous_cell_versions(self, cell_id):
        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        search = "SELECT * FROM cells WHERE cell_id = " + cell_id + " ORDER BY ID DESC"
        c.execute(search)
        rows = c.fetchall()
        return rows

    def create_action_table(self):
        # create a db table for storing action data
        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        self.c.execute('''CREATE TABLE IF NOT EXISTS actions (time integer,
            name text, selected_cell integer, selected_cells text)''')
        self.conn.commit()
        self.conn.close()

    def create_cell_table(self):
        # create a db table for storing cell data
        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        self.c.execute('''CREATE TABLE IF NOT EXISTS cells (time integer,
            cell_id text, version_id text, cell_data text)''')
        self.conn.commit()
        self.conn.close()

    def create_nb_table(self):
        # create a db table for storing nb configuration data
        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()
        self.c.execute('''CREATE TABLE IF NOT EXISTS nb_configs (time integer,
            name text, cell_order text, version_order text)''')
        self.conn.commit()
        self.conn.close()

    def record_nb_config(self, t, nb_name, cell_order, version_order):
        # save the data to the database queue
        nb_data_tuple = (str(t), nb_name,
                    str(cell_order), str(version_order))
        self.nb_queue.append(nb_data_tuple)

        # commit data before notebook closes, otherwise let data queue until
        # there is a 2 second pause in activity to prevent rapid serial writing
        # to the database
        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None
        else:
            self.commitTimer = Timer(2.0, self.commit_queues)
            self.commitTimer.start()

    def record_cell(self, cell_id, version_id, cell_data):
        # save the data to the database queue
        cell_data_tuple = (str(cell_id), str(version_id), pickle.dumps(cell_data))
        self.cell_queue.append(cell_data_tuple)

        # commit data before notebook closes, otherwise let data queue until
        # there is a 2 second pause in activity to prevent rapid serial writing
        # to the database
        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None
        else:
            self.commitTimer = Timer(2.0, self.commit_queues)
            self.commitTimer.start()

    def record_action(self, action_data, hashed_full_path):
        """
        save action to sqlite database

        action_data: (dict) data about action, see above for more details
        dest_fname: (str) full path to where file is saved on volume
        db_manager: (DbManager) object managing DB read / write
        """

        # don't track extraneous unselect events
        if action_data['name'] in ['unselect-cell'] and diff == {}:
            return

        # save the data to the database queue
        action_data_tuple = (str(action_data['time']), action_data['name'],
                    str(action_data['index']), str(action_data['indices']))
        self.action_queue.append(action_data_tuple)

        check_for_nb_diff(action_data['time'], hashed_full_path, action_data['model']['cells'], self)

        # commit data before notebook closes, otherwise let data queue until
        # there is a 2 second pause in activity to prevent rapid serial writing
        # to the database
        if self.commitTimer:
            if self.commitTimer.is_alive():
                self.commitTimer.cancel()
                self.commitTimer = None
        if ad['name'] == 'notebook-closed':
            self.commit_queues()
        else:
            if not self.commitTimer:
                self.commitTimer = Timer(2.0, self.commit_queues)
                self.commitTimer.start()

    def commit_queues(self):
        # commit the queued data

        self.conn = sqlite3.connect(self.db_path)
        self.c = self.conn.cursor()

        try:
            self.c.executemany('INSERT INTO actions VALUES (?,?,?,?)', self.action_queue)
            self.c.executemany('INSERT INTO cells VALUES (?,?,?,?)', self.cell_queue)
            self.c.executemany('INSERT INTO nb_configs VALUES (?,?,?,?)', self.nb_queue)

            self.conn.commit()

            self.action_queue = []
            self.cell_queue = []
            self.nb_queue = []

        except:
            self.conn.rollback()
            raise

# def get_viewer_data(db, start_time, end_time):
#     # get data for the janus visualization
#     conn = sqlite3.connect(db)
#     c = conn.cursor()
#
#     search = "SELECT name FROM actions WHERE name = 'delete-cell' AND time BETWEEN " + str(start_time) + " and " + str(end_time)
#     c.execute(search)
#     rows = c.fetchall()
#     num_deletions = len(rows)
#
#     # TODO how to count when multiple cells are selected and run, or run-all?
#     search = "SELECT name FROM actions WHERE name LIKE 'run-cell%' AND time BETWEEN " + str(start_time) + " and " + str(end_time)
#     c.execute(search)
#     rows = c.fetchall()
#     num_runs = len(rows)
#
#     search = "SELECT time FROM actions WHERE time BETWEEN " + str(start_time) + " and " + str(end_time)
#     c.execute(search)
#     rows = c.fetchall()
#     total_time = 0;
#     if len(rows) > 0:
#         start_time = rows[0][0]
#         last_time = rows[0][0]
#         for i in range(1,len(rows)):
#             # use 5 minutes of inactivity as threshold for each editing session
#             if (rows[i][0] - last_time) >= (5 * 60 * 1000) or i == len(rows) - 1:
#                 total_time = total_time + last_time - start_time
#                 start_time = rows[i][0]
#                 last_time = rows[i][0]
#             else:
#                 last_time = rows[i][0]
#
#     search = "SELECT * FROM actions WHERE time BETWEEN " + str(start_time) + " and " + str(end_time)
#     c.execute(search)
#     all_rows = c.fetchall()
#
#     return (num_deletions, num_runs, total_time/1000, all_rows)
