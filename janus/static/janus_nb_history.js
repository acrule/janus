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
    function trackAction(notebook, t, actionName, selectedIndex,
                        selectedIndices){
        /* Send information about action to Comet Server to process */
        if(Notebook.metadata.track_history){
            // compose url to POST to
            var baseUrl = notebook.base_url;
            var notebookUrl =  notebook.notebook_path;
            var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);

            // get data ready to post
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

            // send the POST request, then check if filename has changed
            utils.promising_ajax(url, settings).then(function(value){
                var t = Date.now();
                var hashed_nb_path = value['hashed_nb_path']
                var paths = Notebook.metadata.filepaths

                if(paths.length == 0){
                    paths.push([hashed_nb_path, t, t])
                }
                else if(paths[paths.length - 1][0] != hashed_nb_path){
                    paths.push([hashed_nb_path, t, t])
                }
                else{
                    paths[paths.length - 1][2] = t;
                }
            });
        }
    }

    function patchActionHandlerCall(){
        /* Patch ActionHandler to track actions that may change the notebook */
        var oldCall = ActionHandler.__proto__.call;
        ActionHandler.__proto__.call = function(){
            // remove 'jupter-notebook:' prefix
            var actionName = arguments[0].split(':')[1];
            var actionInList = actions_to_intercept.indexOf(actionName) > -1;
            if(!actionInList){
                oldCall.apply(this, arguments);
            }
            else{
                // oldCall.apply(this, arguments);
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();

                // Remove executed cells from list of cells w/ unexecuted edits
                if(actionName.substring(0,3) == 'run'){
                    for(i = 0; i < selectedIndices.length; i++){
                        var j = cellsWithUnexecutedEdits.indexOf(
                            selectedIndices[i])
                        if(j > -1){
                            cellsWithUnexecutedEdits.splice(j, 1);
                        }
                    }
                }

                // if executing a Code cell wait for execution to finish
                // notebook v. 5.0.0 added the `finished_execute.CodeCell` event
                // that could make this easier for later versions
                function trackActionAfterExecution(evt){
                    trackAction(Notebook, t, actionName, selectedIndex,
                                selectedIndices);
                    events.off('kernel_idle.Kernel', trackActionAfterExecution)
                }

                //TODO check if it needs to be a code type cell, or if markdown also does this
                if((actionName.substring(0,3) == 'run'
                    && Notebook.get_cell(selectedIndex).cell_type == 'code')
                    || actionName == 'confirm-restart-kernel-and-run-all-cells'){
                    events.on('kernel_idle.Kernel', trackActionAfterExecution);
                    oldCall.apply(this, arguments);
                }
                // if not executing a code cell just track the action immediately
                else{
                    oldCall.apply(this, arguments);
                    trackAction(this.env.notebook, t, actionName, selectedIndex,
                                selectedIndices);
                }
            }
        }
    }


// TRACK SPECIFIC UNIQUE ACTIONS
    function trackNotebookOpenClose(){
        /* track when notebook opens and closes */
        trackAction(Notebook, Date.now(), 'notebook-opened', 0, [0]);
        window.onbeforeunload = function(event) {
            trackAction(Notebook, Date.now(), 'notebook-closed', 0, [0]);
        }
    }

    function patchCutCopyPaste(){
        /* Track when cells are cut, copied, and pasted */
        // TODO the 'cut_cell' function calls the copy function, so for now cut
        // actions will be tracked twice, and data need to be cleaned later
        var oldCut = Notebook.__proto__.cut_cell;
        var oldCopy = Notebook.__proto__.copy_cell;
        var oldPasteReplace = Notebook.__proto__.paste_cell_replace;
        var oldPasteAbove = Notebook.__proto__.paste_cell_above;
        var oldPasteBelow = Notebook.__proto__.paste_cell_below;

        Notebook.__proto__.cut_cell = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldCut.apply(this, arguments);

            trackAction(this, t, 'cut-cell', selectedIndex, selectedIndices);
        }

        Notebook.__proto__.copy_cell = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldCopy.apply(this, arguments);

            trackAction(this, t, 'copy-cell', selectedIndex, selectedIndices);
        }

        Notebook.__proto__.paste_cell_replace = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldPasteReplace.apply(this, arguments);

            trackAction(this, t, 'paste-cell-replace', selectedIndex,
                        selectedIndices);
        }

        Notebook.__proto__.paste_cell_above = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldPasteAbove.apply(this, arguments);

            trackAction(this, t, 'paste-cell-above', selectedIndex,
                        selectedIndices);
        }

        Notebook.__proto__.paste_cell_below = function(){
            var t = Date.now();
            var selectedIndex = this.get_selected_index();
            var selectedIndices = this.get_selected_cells_indices();

            oldPasteBelow.apply(this, arguments);

            trackAction(this, t, 'paste-cell-below', selectedIndex,
                        selectedIndices);
        }

        // listen for broswer-initiated (e.g. hotkey) cut, copy, paste events
        document.addEventListener('cut', function(){
            if (Notebook.mode == 'command') {
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'cut-cell', selectedIndex,
                            selectedIndices);
            }
        });

        document.addEventListener('copy', function(){
            if (Notebook.mode == 'command') {
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'copy-cell', selectedIndex,
                            selectedIndices);
            }
        });

        document.addEventListener('paste', function(){
            if (Notebook.mode == 'command') {
                var t = Date.now();
                var selectedIndex = Notebook.get_selected_index();
                var selectedIndices = Notebook.get_selected_cells_indices();
                trackAction(Notebook, t, 'paste-cell-below', selectedIndex,
                            selectedIndices);
            }
        });

    }


// TRACK CHANGES TO UNEXECUTED CELLS
    function trackUnexecutedCellChanges(){
        /* Get currently rendered cells to track unexecuted changes */
        var cells = Notebook.get_cells();
        for(var i = 0; i < cells.length; i++){
            trackChangesToCell(cells[i]);
        }
        patchCellUnselect();
        patchInsertCellAtIndex();
    }

    function trackChangesToCell(c){
        /* Track which cells have unexecuted changes */
        c.code_mirror.on('change', function(){
            var i = Notebook.get_selected_index();
            if(cellsWithUnexecutedEdits.indexOf(i) == -1){
                cellsWithUnexecutedEdits.push(i);
            }
        });
    }

    function patchCellUnselect(){
        /* Track when cells are edited and unselected before being executed */
        oldCellUnselect = cell.Cell.prototype.unselect;
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
            oldCellUnselect.apply(this);
        }
    }

    function patchInsertCellAtIndex(){
        /* Get newly created cells to track unexecuted changes */
        var oldInsertCellAtIndex = Notebook.__proto__.insert_cell_at_index;
        Notebook.__proto__.insert_cell_at_index = function(){
            c = oldInsertCellAtIndex.apply(this, arguments);
            trackChangesToCell(c);
            // c.metadata.comet_cell_id = Math.random().toString(16).substring(2);
            return c;
        }
    }


// LOAD EXTENSION
    function prepNbHistoryTracking(){
        /* Called as extension loads and notebook opens */
        trackNotebookOpenClose();
        patchActionHandlerCall();
        patchCutCopyPaste();
        trackUnexecutedCellChanges();
    }

    return {
        prepNbHistoryTracking: prepNbHistoryTracking
    };
});
