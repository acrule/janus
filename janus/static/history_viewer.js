/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/dialog',
    'base/js/utils',
    '../janus/utils'
], function(
    require,
    $,
    Jupyter,
    dialog,
    utils,
    JanusUtils
){

    // TODO Pull cell history from database, not metadata
    // TODO debug saving of cell versions before cell fully executed
    // TODO debug history dialog window overflowing the main screen
    // TODO enable cell hiding in history viewer
    // TODO show full history of all cell executions (stretch)
    // TODO enable truncated history based on program analysis (stretch)

    var HistoryModal = function(nb) {
        /* object represeting the history viewer modal popup

        Args:
            nb: notebook where history modal will live
        */

        var historyViewer = this;
        Jupyter.historyViewer = historyViewer;
        this.notebook = nb;
        this.getDataForModal()
    }

    HistoryModal.prototype.getDataForModal = function() {
        /* get data about previous notebook cell orders
           then render the modal using that data */

        that = this;
        this.nb_configs = [];

        // preapre url for GET request
        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);
        var paths = Jupyter.notebook.metadata.janus.filepaths;

        // format request for each previous notebook name
        for ( var i = 0; i < paths.length; i++ ) {
            // prepare POST settings
            var settings = {
                type : 'GET',
                data: {
                    q: 'config',
                    path: paths[i][0],
                    start: paths[i][1],
                    end: paths[i][2]
                },
            };

            // show the modal window only after we have all our data ready
            if (i == paths.length - 1) {
                utils.promising_ajax(url, settings).then( function(value, i) {
                    var d = JSON.parse(value)
                    that.nb_configs = that.nb_configs.concat(d['nb_configs']);
                    that.renderModal();
                });
            }
            else{
                // send the POST request
                utils.promising_ajax(url, settings).then(function(value, i){
                    var d = JSON.parse(value)
                    that.nb_configs = that.nb_configs.concat(d['nb_configs']);
                });
            }
        }
    }


    HistoryModal.prototype.renderModal = function() {
        /* show the modal, assuming we already have the nb history data */

        // get the number of versions from the database
        that = this
        numConfigs = this.nb_configs.length

        // log opening
        JanusUtils.logJanusAction(this.notebook, Date.now(), 'open-history', '', []);

        // create HTML for the modal's content
        var modal_body = $('<div/>');
        var modal_float = $('<div class="floater">');
        var revision = $('<div id="revision"/>')
        revision.append($('<div id="rev_num"/>'));
        revision.append($('<div id="rev_time"/>'));
        // modal_body.append(revision);
        modal_float.append(revision);

        // create the slider itself
        var slide = modal_float.append($('<div id="modal-slide"/>').slider({
            min: 0,
            max: numConfigs - 1,
            value: numConfigs - 1,
            step: 1,
            orientation: "horizontal",
            range: "min",
            slide: function( event, ui ) {
                that.updateModal(ui.value);
            }
        }));
        modal_float.append('<hr>');
        modal_float.append('<div/>');
        modal_body.append(modal_float);

        // and the wrapper for holding cells
        var history_cell_wrapper  = modal_body.append($("<div/>")
            .attr('id', 'history-cell-wrapper')
            .addClass('cell-wrapper'));

        // create the modal
        var mod = dialog.modal({
            title: 'Notebook History',
            body: modal_body,
            buttons: { 'OK': {
                click: function () {
                    JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'close-history', '', []);
                }
            } }
        });

        // and when it shows, render the last notebook configuration
        mod.on("shown.bs.modal", function () {
            that.updateModal(numConfigs - 1);
        })
    }


    HistoryModal.prototype.updateModal = function(version_num) {
        /* update the history viewer when the slider moves

        Args:
            version_num: version of the notebook to show (int)
        */

        // get the time since the edit being shown
        var t = parseInt( this.nb_configs[version_num][0] );
        var t_now = Date.now();
        var t_diff = ( t_now - t ) / 1000;
        var rev_string = ( version_num + 1 ).toString() + " of " + this.nb_configs.length.toString();
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

        // set the time and revision number in the ui
        $('#rev_num').html(rev_string);
        $('#rev_time').html(date_string);

        version_ids = this.nb_configs[version_num][3];
        this.getCellVersionData(version_ids);
    }


    HistoryModal.prototype.getCellVersionData = function(version_ids) {
        /* get data on specific cell versions to show
           then update the modal based on that data */

        that = this;

        // preapre url for GET request
        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);
        var paths = Jupyter.notebook.metadata.janus.filepaths;

        //  GET settings
        var settings = {
            type : 'GET',
            data: {
                q: 'versions',
                version_ids: version_ids
            },
        };

        // add cell versions to the history modal once we have data
        utils.promising_ajax(url, settings).then( function(value) {
            version_ids = eval(version_ids);
            var get_data = JSON.parse(value);
            that.cells = get_data['cells'];

            $('#history-cell-wrapper').empty();
            for ( i=0; i < version_ids.length; i++ ){
                if (version_ids[i] in that.cells){
                    that.appendCell(that.cells[version_ids[i]]);
                }
            }
        });
    }


    HistoryModal.prototype.appendCell = function(cellJSON) {
        /* add cell to modal */

        // add redonly cell to the wraper
        var newCell = JanusUtils.getDuplicateCell(cellJSON, Jupyter.notebook);
        newCell.code_mirror.setOption('readOnly', "nocursor");
        $('#history-cell-wrapper').append(newCell.element);

        // make sure all code cells are rendered
        if(newCell.cell_type == 'code'){
            newCell.render();
            newCell.focus_editor();
        }
    }


    function createHistoryModal() {
        /* create a new sidebar element */

        return new HistoryModal(Jupyter.notebook);
    }


    return{
        createHistoryModal: createHistoryModal
    };

})
