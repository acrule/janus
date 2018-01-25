/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

// TODO debug run-cell not being tracked

define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'base/js/events',
    'notebook/js/cell'
], function(
    $,
    Jupyter,
    utils,
    events,
    cell
){

// VARIABLES
    // Reference object constructors so we can patch their functions
    var Notebook = Jupyter.notebook;
    var ActionHandler = Jupyter.actions;

    // Track actions that may change the notebook content or structure
    var actions_to_intercept = [
        // execute cells
        'run-cell',
        'run-cell-and-select-next',
        'run-cell-and-insert-below',
        'run-all-cells',
        'run-all-cells-above',
        'run-all-cells-below',
        'confirm-restart-kernel-and-run-all-cells',
        // delete cells
        'delete-cell',
        'undo-cell-deletion',
        // split and merge cells
        'split-cell-at-cursor',
        'merge-cell-with-previous-cell',
        'merge-cell-with-next-cell',
        'merge-selected-cells',
        'merge-cells',
        // insert cells
        'insert-cell-above',
        'insert-cell-below',
        // move cells
        'move-cell-down',
        'move-cell-up',
        // change cell type
        'change-cell-to-markdown',
        'change-cell-to-code',
        'change-cell-to-raw',
        // change display of cell output
        'clear-cell-output',
        'restart-kernel-and-clear-output',
        'toggle-cell-output-collapsed',
        'toggle-cell-output-scrolled',
        'confirm-restart-kernel-and-clear-output'
        // not tracking cut, copy, paste due to inconsistent calling of actions
        // e.g. in Notebok v 5.0.0, paste menu items do not call paste actions
        // Also, copy-paste shortcuts (e.g., CMD-C) are handled by the browser
        // We will patch the cut, copy, and paste functions instead
        // 'cut-cell',
        // 'copy-cell',
        // 'paste-cell-above',
        // 'paste-cell-below',
        // 'paste-cell-replace',
    ];

    // Track cells that have been edited but not executed
    var cellsWithUnexecutedEdits = [];

// TRACK GENERAL ACTIONS
    function trackAction(notebook, t, actionName, selectedIndex, selectedIndices) {
        /* Send information about action to server to process and save */

        if ( Notebook.metadata.track_history ) {
            // get url to send POST request
            var baseUrl = notebook.base_url;
            var notebookUrl =  notebook.notebook_path;
            var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);

            // get data ready
            var mod = notebook.toJSON();
            var d = JSON.stringify({
                time: t,
                name: actionName,
                index: selectedIndex,
                indices: selectedIndices,
                model: mod
            });

            // prepare POST settings
            var settings = {
                processData : false,
                type : 'POST',
                dataType: 'json',
                data: d,
                contentType: 'application/json',
            };

            // send the POST request,
            utils.promising_ajax(url, settings).then( function(value) {
                var t = Date.now();
                var hashed_nb_path = value['hashed_nb_path']
                var paths = Notebook.metadata.filepaths

                // then save any new filenames for future queries
                if(paths.length == 0){
                    paths.push([hashed_nb_path, t, t])
                } else if(paths[paths.length - 1][0] != hashed_nb_path){
                    paths.push([hashed_nb_path, t, t])
                } else{
                    paths[paths.length - 1][2] = t;
                }
            });
        }
    }

    function patchActionHandlerCall() {
        /* Patch ActionHandler to track actions that may change the notebook */

        var oldCall = ActionHandler.__proto__.call;
        ActionHandler.__proto__.call = function(){

            // remove 'jupter-notebook:' prefix
            var actionName = arguments[0].split(':')[1];

            // only track the action if it is in our list
            var actionInList = actions_to_intercept.indexOf(actionName) > -1;
            if ( !actionInList ) {
                oldCall.apply(this, arguments);
            } else {

                // get data ready to send to server
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();

                // Remove executed cells from list of cells w/ unexecuted edits
                if ( actionName.substring(0,3) == 'run' ) {
                    for ( i = 0; i < selectedIndices.length; i++ ) {
                        var unexecutedEditIndex = cellsWithUnexecutedEdits.indexOf(
                            selectedIndices[i])
                        if ( unexecutedEditIndex > -1 ) {
                            cellsWithUnexecutedEdits.splice(unexecutedEditIndex, 1);
                        }
                    }
                }

                function trackActionAfterExecution(evt){
                    /* if executing a cell, wait for execution to finish before
                       saving any data.  notebook v. 5.0.0 added `finished_execute.CodeCell`
                       action that could make this easier for later verssions */

                    trackAction(Notebook, t, actionName, selectedIndex,
                                selectedIndices);
                    events.off('kernel_idle.Kernel', trackActionAfterExecution)
                }

                // wait to track action if executing a code cell
                if ((actionName.substring(0,3) == 'run'
                    && Notebook.get_cell(selectedIndex).cell_type == 'code')
                    || actionName == 'confirm-restart-kernel-and-run-all-cells') {
                    events.on('kernel_idle.Kernel', trackActionAfterExecution);
                    oldCall.apply(this, arguments);
                } else {

                    // otherwise, just track the action immediately
                    oldCall.apply(this, arguments);
                    trackAction(this.env.notebook, t, actionName, selectedIndex,
                                selectedIndices);
                }
            }
        }
    }


// TRACK SPECIFIC UNIQUE ACTIONS
    function trackNotebookOpenClose() {
        /* track when notebook opens and closes */

        trackAction(Notebook, Date.now(), 'notebook-opened', 0, [0]);
        window.onbeforeunload = function(event) {
            trackAction(Notebook, Date.now(), 'notebook-closed', 0, [0]);
        }
    }

    function patchCutCopyPaste() {
        /* Track when cells are cut, copied, and pasted */

        // TODO the 'cut_cell' function calls the copy function, so for now cut
        // actions will be tracked twice, and data need to be cleaned later

        // First, patch action initiated by the notebook
        var oldCut = Notebook.__proto__.cut_cell;
        var oldCopy = Notebook.__proto__.copy_cell;
        var oldPasteReplace = Notebook.__proto__.paste_cell_replace;
        var oldPasteAbove = Notebook.__proto__.paste_cell_above;
        var oldPasteBelow = Notebook.__proto__.paste_cell_below;

        Notebook.__proto__.cut_cell = function(){
            var ts = getTimeAndSelection()
            oldCut.apply(this, arguments);
            trackAction(this, ts.t, 'cut-cell', ts.selIndex, ts.selIndices);
        }

        Notebook.__proto__.copy_cell = function(){
            var ts = getTimeAndSelection()
            oldCopy.apply(this, arguments);
            trackAction(this, ts.t, 'copy-cell', ts.selIndex, ts.selIndices);
        }

        Notebook.__proto__.paste_cell_replace = function(){
            var ts = getTimeAndSelection()
            oldPasteReplace.apply(this, arguments);
            trackAction(this, ts.t, 'paste-cell-replace', ts.selIndex, ts.selIndices);
        }

        Notebook.__proto__.paste_cell_above = function(){
            var ts = getTimeAndSelection()
            oldPasteAbove.apply(this, arguments);
            trackAction(this, ts.t, 'paste-cell-above', ts.selIndex, ts.selIndices);
        }

        Notebook.__proto__.paste_cell_below = function(){
            var ts = getTimeAndSelection()
            oldPasteBelow.apply(this, arguments);
            trackAction(this, ts.t, 'paste-cell-below', ts.selIndex, ts.selIndices);
        }


        // Next, listen for broswer-initiated (e.g. hotkey) cut, copy, paste events
        document.addEventListener('cut', function(){
            if (Notebook.mode == 'command') {
                var ts = getTimeAndSelection()
                trackAction(Notebook, ts.t, 'cut-cell', ts.selIndex, ts.selIndices);
            }
        });

        document.addEventListener('copy', function(){
            if (Notebook.mode == 'command') {
                var ts = getTimeAndSelection()
                trackAction(Notebook, ts.t, 'copy-cell', ts.selIndex, ts.selIndices);
            }
        });

        document.addEventListener('paste', function(){
            if (Notebook.mode == 'command') {
                var ts = getTimeAndSelection()
                trackAction(Notebook, ts.t, 'paste-cell-below', ts.selIndex, ts.selIndices);
            }
        });

    }

    function getTimeAndSelection() {
        /* get time and selected cells */

        var t = Date.now();
        var selIndex = Notebook.get_selected_index();
        var selIndices = Notebook.get_selected_cells_indices();

        return {
            t: t,
            selIndex: selIndex,
            selIndices: selIndices
        }
    }


// TRACK CHANGES TO UNEXECUTED CELLS
    function trackUnexecutedCellChanges() {
        /* Get currently rendered cells to track unexecuted changes */

        var cells = Notebook.get_cells();
        for ( var i = 0; i < cells.length; i++ ) {
            trackChangesToCell(cells[i]);
        }
        patchCellUnselect();
        patchInsertCellAtIndex();
    }

    function trackChangesToCell(c) {
        /* Track which cells have unexecuted changes */

        c.code_mirror.on('change', function(){
            var i = Notebook.get_selected_index();
            if ( cellsWithUnexecutedEdits.indexOf(i) == -1 ) {
                cellsWithUnexecutedEdits.push(i);
            }
        });
    }

    function patchCellUnselect() {
        /* Track when cells are edited and unselected before being executed */

        var oldCellUnselect = cell.Cell.prototype.unselect;
        cell.Cell.prototype.unselect = function(){
            var i = Notebook.get_selected_index();
            var li = cellsWithUnexecutedEdits.indexOf(i)
            var unexecutedChanges = li > -1;

            if(this.selected && unexecutedChanges){
                var t = Date.now();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'unselect-cell', i, selectedIndices);
                cellsWithUnexecutedEdits.splice(li, 1);
            }

            // need to return context object so mult-cell selection works
            var cont = oldCellUnselect.apply(this, arguments);
            return cont
        }
    }

    function patchInsertCellAtIndex() {
        /* Get newly created cells to track unexecuted changes */

        var oldInsertCellAtIndex = Notebook.__proto__.insert_cell_at_index;
        Notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            trackChangesToCell(c);
            return c;
        }
    }

    function toggleHistoryRecording() {
        /* turn on/off recording of notebook history */

        Jupyter.notebook.metadata.track_history = ! Jupyter.notebook.metadata.track_history

        // Set message about recording
       var message = 'Notebook history recording off';
       if(Jupyter.notebook.metadata.track_history){
           message = 'Notebook history recording on';
       }
       Jupyter.notification_area.widget('notebook').set_message(message, 2000)
    }


// LOAD EXTENSION
    function prepNbHistoryTracking() {
        /* Called as extension loads and notebook opens */

        trackNotebookOpenClose();
        patchActionHandlerCall();
        patchCutCopyPaste();
        trackUnexecutedCellChanges();
    }

    return {
        prepNbHistoryTracking: prepNbHistoryTracking,
        toggleHistoryRecording: toggleHistoryRecording
    };
});
