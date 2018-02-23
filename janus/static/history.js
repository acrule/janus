/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes

Track actions that occur in the notebook
*/

define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'base/js/events',
    '../janus/utils'
], function(
    $,
    Jupyter,
    utils,
    events,
    JanusUtils
){


// VARIABLES
    var Notebook = Jupyter.notebook;
    var ActionHandler = Jupyter.actions;
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
        'confirm-restart-kernel-and-clear-output',
        // save notebook
        'save-notebook'
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


// TRACK GENERAL ACTIONS
    function trackAction(nb, t, actionName, selIndex, selIndices) {
        /* Send information about action to server to process and save

        Args:
            nb: the notebook
            t: time of action
            actionName: name of action to be tracked
            selIndex: index of primary selected cell
            selIndices: indicies of selected cells in nb
        */

        if (Notebook.metadata.janus.track_history) {

            // get url to send POST request
            var baseUrl = nb.base_url;
            var nbUrl =  nb.notebook_path;
            var url = utils.url_path_join(baseUrl, 'api/janus', nbUrl);

            // get data ready
            var mod = nb.toJSON();
            var d = JSON.stringify({
                time: t,
                name: actionName,
                index: selIndex,
                indices: selIndices,
                model: mod,
                type: 'action'
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
                saveNBPath(value, t)
            });
        }
    }


    function saveNBPath(value, t) {
        /* save metadata that this nb path was in use at this rev_time

        used later when requesting historical data from the db. We need
        to know all prior names of the notebook for accurate query

        Args:
            value: return value of the AJAX request
            t: time of action that prompted check
        */

        var hashed_nb_path = value['hashed_nb_path']
        var paths = Notebook.metadata.janus.filepaths
        var numPaths = paths.length

        // then save any new filenames for future queries
        if (numPaths == 0) {
            paths.push([hashed_nb_path, t, t])
        } else if(paths[numPaths - 1][0] != hashed_nb_path) {
            paths.push([hashed_nb_path, t, t])
        } else {
            paths[numPaths - 1][2] = t;
        }

        // updateHistoryUI();

    }

    function updateHistoryUI() {
        /* find the time of the last significant edit */

        // update the last edit in the history UI element
        var historyLabel = $('#history-label').find('a')

        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);
        var paths = Jupyter.notebook.metadata.janus.filepaths
        var numPaths = paths.length
        var foundLast = false;

        // don't proceed if no history
        if (numPaths == 0) {
            return
        }

        // get time of last significant change to the notebook
        var t = null;
        for (var i = 0; i < numPaths; i++){

            var settings = {
                type : 'GET',
                data: {
                    q: 'config',
                    path: paths[i][0],
                    start: paths[i][1],
                    end: paths[i][2]
                },
            };

            utils.promising_ajax(url, settings).then(function(value, i, t){
                var d = JSON.parse(value)
                var numConfigs = d['nb_configs'].length
                if (numConfigs > 0){
                    t = d['nb_configs'][numConfigs - 1][0]

                    var t_now = Date.now();
                    var t_diff = ( t_now - t ) / 1000;
                    var date_string = "";

                    // get a human readible version of the time
                    if ( t_diff < 3600 ) {
                        num_min = parseInt( t_diff / 60 );
                        date_string = num_min.toString() + " min ago";
                    } else if ( t_diff < 86400 ) {
                        num_hours = parseInt( t_diff / 3600 );
                        date_string = num_hours.toString() + " hours ago";
                    } else {
                        num_days = parseInt( t_diff / 86400 );
                        date_string = num_days.toString() + " days ago";
                    }

                    historyLabel.html("Last edit " + date_string)

                }
            })
        }
    }


    function patchActionHandlerCall() {
        /* Patch ActionHandler to track actions that may change the notebook */

        var oldCall = ActionHandler.__proto__.call;
        ActionHandler.__proto__.call = function() {

            // only track actions in our list, removing 'jupter-notebook:' prefix
            var nb = Notebook
            var ts = JanusUtils.getTimeAndSelection()
            var actionName = arguments[0].split(':')[1];
            var actionInList = actions_to_intercept.indexOf(actionName) > -1;

            if (! actionInList) {
                oldCall.apply(this, arguments);

            } else {
                /* if executing a cell, wait for execution to finish before
                saving any data.  notebook v. 5.0.0 added `finished_execute.CodeCell`
                action that could make this easier for later versions
                */

                function trackActionAfterExecution(evt){
                    /* track the action only after it has unexecuted

                    Need to wait till the execution has updated the ceel(s) contents

                    Args:
                        evt: the event of the execution finishing (kernel_idle.Kernel)
                    */

                    trackAction(nb, ts.t, actionName, ts.selIndex, ts.selIndices);
                    events.off('kernel_idle.Kernel', trackActionAfterExecution)
                }

                if ((actionName.substring(0,3) == 'run'
                        && Notebook.get_cell(ts.selIndex).cell_type == 'code')
                        || actionName == 'confirm-restart-kernel-and-run-all-cells') {
                    events.on('kernel_idle.Kernel', trackActionAfterExecution);
                    oldCall.apply(this, arguments);
                } else {

                    // otherwise, just track the action immediately
                    oldCall.apply(this, arguments);
                    trackAction(nb, ts.t, actionName, ts.selIndex, ts.selIndices);
                }
            }
        }
    }


// SETUP HISTORY TRACKING
    function trackNotebookOpenClose() {
        /* track when notebook opens and closes */

        trackAction(Notebook, Date.now(), 'notebook-opened', 0, [0]);
        window.onbeforeunload = function(event) {
            trackAction(Notebook, Date.now(), 'notebook-closed', 0, [0]);
        }
    }


    function toggleHistoryRecording() {
        /* turn on/off recording of notebook history */

        Notebook.metadata.janus.track_history = ! Notebook.metadata.janus.track_history
        var message = 'Not tracking changes';
        var menuText = 'Start Tracking Changes'
        if (Notebook.metadata.janus.track_history) {
            message = 'Tracking changes';
            menuText = 'Stop Tracking Changes'
        }
        Jupyter.notification_area.widget('notebook').set_message(message, 2000)
        $('#toggle_nb_recording').find('a').text(menuText)
    }


    function prepHistoryTracking() {
        /* Called as extension loads and notebook opens */

        trackNotebookOpenClose();
        patchActionHandlerCall();
    }


    return {
        prepHistoryTracking: prepHistoryTracking,
        toggleHistoryRecording: toggleHistoryRecording,
        trackAction: trackAction,
        updateHistoryUI: updateHistoryUI
    };

});
