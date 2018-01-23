"""
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Get diff between current and previous notebooks
"""

import ast
import os
import ast
import uuid
import pickle

# TODO implement smarter cell comparison that ignores trivial difference of
# matplotlib figures having a different memory location

def check_for_nb_diff(t, hashed_path, cells, db):
    """
    Check for differences between current and previous version of the notebook
    Save any new cells or notebook configurations to the nb_history database

    t: (str) time of action that prompted check for a notebook diff
    hashed_path: (str) hashed path to notebook file, used to query db
    cells: (list) cells in the current version of notebook
    db: (object) DBManager object managing connection to notebook history db
    """

    # prepare to track cell and cell version ids in current notebook
    new_cell_order = []
    new_version_order = []

    # if no previous record of this notebook, save each cell and the nb_config
    last_nb_config = db.get_last_nb_config(hashed_path)
    if(not last_nb_config):
        for c in cells:

            # create a new cell db entry
            cell_id = c['metadata']['janus']['id']
            version_id = uuid.uuid4().hex[0:8]
            cell_data = c
            db.record_cell(t, cell_id, version_id, cell_data)

            # keep track of the cell order
            new_cell_order.append(cell_id)
            new_version_order.append(version_id)

        # create new db entry for this notebook confiburation
        db.record_nb_config(t, hashed_path, new_cell_order, new_version_order)
        return

    # get the cell order and cells of the last notebook configuration
    last_cell_order = ast.literal_eval(last_nb_config[2])
    last_version_order = ast.literal_eval(last_nb_config[3])
    last_cells = [db.get_last_cell_version(cell_id) for cell_id in last_cell_order]

    # for each cell in the current notebook
    for c in cells:
        cell_id = c['metadata']['janus']['id']
        version_id = uuid.uuid4().hex[0:8]
        cell_data = c
        match_found = False

        # check if this cell had the same content in the last notebook config
        previous_versions = []
        if len(last_cells) > 0:
            previous_versions = [pv for pv in last_cells if pv[1] == cell_id]
        if len(previous_versions) > 0:
            previous_version = previous_versions[0]
            previous_content = pickle.loads(previous_version[3])

            # if the same cell content, use the old cell's version_id
            if not cells_different(previous_content, c):
                version_id = previous_version[2]
                new_cell_order.append(cell_id)
                new_version_order.append(version_id)
                match_found = True
                continue

        # check if a cell with the same content was in *older* nb configurations
        older_versions = db.get_all_cell_versions(cell_id)
        for older_version in older_versions:
            if not cells_different(pickle.loads(older_version[3]), c):
                version_id = older_version[2]
                new_cell_order.append(cell_id)
                new_version_order.append(version_id)
                match_found = True
                break

        # i no old versions matched, create a new entry
        if not match_found:
            db.record_cell(t, cell_id, version_id, cell_data)
            new_cell_order.append(cell_id)
            new_version_order.append(version_id)

    # save a new nb config if different from the last one
    if ( new_version_order != last_version_order ):
        db.record_nb_config(t, hashed_path, new_cell_order, new_version_order)

def cells_different(cell_a, cell_b, compare_outputs = False):
    """
    Return true/false if two cells are the same

    cell_a: (obj) JSON representation of first cell
    cell_b: (obj) JSON representation of second cell
    compare_outputs: (bool) whether to compare cell outputs, or just inputs
    """

    # check if cell type or source is different
    if (cell_a["cell_type"] != cell_b["cell_type"]
        or cell_a["source"] != cell_b["source"]):
        return True

    # otherwise compare outputs if it is a code cell
    elif compare_outputs and cell_b["cell_type"] == "code":
        # get the outputs
        cell_a_outs = cell_a['outputs']
        cell_b_outs = cell_b['outputs']
        # if different number of outputs, the cell has changed
        if len(cell_a_outs) != len(cell_b_outs):
            return True
        # compare the outputs one by one
        for j in range(len(cell_b_outs)):
            # check that the output type matches
            if cell_b_outs[j]['output_type'] != cell_a_outs[j]['output_type']:
                return True
            # and that the relevant data matches
            elif((cell_a_outs[j]['output_type'] in ["display_data","execute_result"]
                and cell_a_outs[j]['data'] != cell_b_outs[j]['data'])
                or (cell_a_outs[j]['output_type'] == "stream"
                and cell_a_outs[j]['text'] != cell_b_outs[j]['text'])
                or (cell_a_outs[j]['output_type'] == "error"
                and cell_a_outs[j]['evalue'] != cell_b_outs[j]['evalue'])):
                return True

    return False
