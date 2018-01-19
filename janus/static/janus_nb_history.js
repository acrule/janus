/*
NBComet: Jupyter Notebook extension to track full notebook history
*/

// TODO debug run-cell not being tracked
// TODO add menu item to toggle tracking of only metadata, or also content

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

    // Actions to track. For all available actions see:
    // https://github.com/jupyter/notebook/blob/master/notebook/static/notebook/js/actions.js
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
        // also copy-paste shortcuts (e.g., CMD-C) are handled by the browser
        // cut and paste
        // 'cut-cell',
        // 'copy-cell',
        // 'paste-cell-above',
        // 'paste-cell-below',
        // 'paste-cell-replace',
    ];

    // Track cells that have been edited but not executed
    var cellsWithUnexecutedEdits = [];


// TRACK NOTEBOOK OPEN AND CLOSE
    function trackNotebookOpenClose(){
        /* track notebook open and close events */
        trackAction(Notebook, Date.now(), 'notebook-opened', 0, [0]);
        window.onbeforeunload = function(event) {
            trackAction(Notebook, Date.now(), 'notebook-closed', 0, [0]);
        }
    }


// TRACK NOTEBOOK MOVE / RENAME
    function trackRename(){
        oldRename = Notebook.__proto__.rename
        Notebook.__proto__.rename = function(){
            new_name = arguments[0]

            // POST request to rename files
            // rename folder
            // rename db
            // rename ipynb

            return oldRename.apply(this, arguments)
        }
    }


// GENERATE COMET MENU
    function initializeCometMenu(){
        renderCometMenu();
        verifyCometSettings();
        displayCometRecordingStatus();
    }

    function renderCometMenu(){
        /* add menu after help menu for managing Comet recording */
        var mainMenu = $('#help_menu').parent().parent();
        mainMenu.append($('<li>')
            .addClass('dropdown')
            .attr('id', 'comet-header')
            .append($('<a>')
                .addClass('dropdown-toggle')
                .attr('href','#')
                .attr('data-toggle', 'dropdown')
                .text('Comet')
                )
            );

        var cometHeader = $('#comet-header')
        cometHeader.append($('<ul>')
            .addClass('dropdown-menu')
            .attr('id', 'comet-menu')
        );

        var cometMenu = $('#comet-menu');
        cometMenu.append($('<li>')
            .attr('id', 'comet_settings')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Recording')
                .click(toggleCometRecording)
            )
        );

        cometMenu.append($('<li>')
            .attr('id', 'comet_settings')
            .append($('<a>')
                .attr('href', '/api/nbcomet/' + Notebook.notebook_path)
                .text('See Comet Data')
            )
        );
    }

    function verifyCometSettings(){
        /* ensure that the notebook has a comet_tracking setting */
        if (Notebook.metadata.comet_tracking === undefined){
            Notebook.metadata.comet_tracking = true;
        }
        // Generate a random 13-digit hexadecimal string to uniquely identify notebook
        if (Notebook.metadata.comet_paths === undefined){
            Notebook.metadata.comet_paths = [];
        }
        // check that cells have right metadata
        cells = Notebook.get_cells()
        for(i = 0; i < cells.length; i++){
            if (cells[i].metadata.comet_cell_id === undefined){
                cells[i].metadata.comet_cell_id = Math.random().toString(16).substring(2);
            }
        }
    }

    function toggleCometRecording(){
        /* turn recording on and off */
        if(Notebook.metadata.comet_tracking){
            trackAction(Notebook, Date.now(), 'comet-tracking-off', 0, [0]);
            Notebook.metadata.comet_tracking = !Notebook.metadata.comet_tracking;
        }
        else{
            Notebook.metadata.comet_tracking = !Notebook.metadata.comet_tracking;
            trackAction(Notebook, Date.now(), 'comet-tracking-on', 0, [0]);
        }
        displayCometRecordingStatus();
    }

    function displayCometRecordingStatus(){
        /* Set message and update menu-items when tracking turned on / off */
        var message = 'Comet Tracking off';
        var menuText = 'Start Tracking';
        if(Notebook.metadata.comet_tracking){
            message = 'Comet Tracking on';
            menuText = 'Stop Tracking';
        }
        $('#comet_settings').find('a').text(menuText);
        Jupyter.notification_area.widget('notebook').set_message(message, 2000)
    }


// SEND ACTION DATA TO SERVER
    function trackAction(notebook, t, actionName, selectedIndex,
                        selectedIndices){
        /* Send information about data to Comet Server to process */
        if(Notebook.metadata.comet_tracking){
            /* Send data about the action to the Comet server extension */
            var baseUrl = notebook.base_url;
            var notebookUrl =  notebook.notebook_path;
            var url = utils.url_path_join(baseUrl, 'api/nbcomet', notebookUrl);

            var mod = notebook.toJSON();
            var d = JSON.stringify({
                time: t,
                name: actionName,
                index: selectedIndex,
                indices: selectedIndices,
                model: mod
            });

            var settings = {
                processData : false,
                type : 'POST',
                dataType: 'json',
                data: d,
                contentType: 'application/json',
            };

            utils.promising_ajax(url, settings).then(function(value){
                var hashed_nb_path = value['hashed_nb_path']
                var paths = Notebook.metadata.comet_paths

                if(paths.length == 0){
                    var t = Date.now();
                    paths.push([hashed_nb_path, t])
                }
                else if(paths[paths.length-1][0] != hashed_nb_path){
                    var t = Date.now();
                    paths.push([hashed_nb_path, t])
                }
            });
        }
    }


// TRACK COPY PASTE
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

// TRACK ACTIONS
    function patchActionHandlerCall(){
        /* Track desired actions */
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

                // Remove executed cells from list of cells with unexecuted changes
                if(actionName.substring(0,3) == 'run'){
                    for(i = 0; i < selectedIndices.length; i++){
                        var j = cellsWithUnexecutedEdits.indexOf(
                            selectedIndices[i])
                        if(j > -1){
                            cellsWithUnexecutedEdits.splice(j, 1);
                        }
                    }
                }

                function trackActionAfterExecution(evt){
                    trackAction(Notebook, t, actionName, selectedIndex,
                                selectedIndices);
                    console.log("Tracking actions after execution")
                    events.off('kernel_idle.Kernel', trackActionAfterExecution)
                }

                // if executing a Code cell wait for execution to finish
                // notebook v. 5.0.0 added the `finished_execute.CodeCell` event
                // that could make this easier for later versions
                //TODO check if it needs to be a code type cell, or if markdown also does this

                if((actionName.substring(0,3) == 'run'
                    && Notebook.get_cell(selectedIndex).cell_type == 'code')
                    || actionName == 'confirm-restart-kernel-and-run-all-cells'){
                    console.log('Running Cell')
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

// TRACK CHANGES TO UNEXECUTED CELLS
    function trackUnexecutedCellChanges(){
        /* Get currently rendered cells to track unexecuted changes */
        patchCellUnselect();
        var cells = Notebook.get_cells();
        for(var i = 0; i < cells.length; i++){
            trackChangesToCell(cells[i]);
        }
        patchInsertCellAtIndex();
    }

    function patchCellUnselect(){
        /* Track when cells are edited but not executed */
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
            c.metadata.comet_cell_id = Math.random().toString(16).substring(2);
            return c;
        }
    }

    function trackChangesToCell(c){
        /* Track unexecuted changes for a particular cell */
        c.code_mirror.on('change', function(){
            var i = Notebook.get_selected_index();
            if(cellsWithUnexecutedEdits.indexOf(i) == -1){
                cellsWithUnexecutedEdits.push(i);
            }
        });
    }


// LOAD EXTENSION
    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[NBComet] tracking changes to notebook');
        trackNotebookOpenClose();
        initializeCometMenu();
        patchActionHandlerCall();
        patchCutCopyPaste();
        trackUnexecutedCellChanges();
        trackRename();
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
