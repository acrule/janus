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
    // TODO enable truncated history based on program analysis (stretch)

    var HistoryModal = function(nb) {
        /* object represeting the history viewer modal popup

        Args:
            nb: notebook where history modal will live
        */

        var historyViewer = this;
        Jupyter.historyViewer = historyViewer;
        this.notebook = nb;
        this.cells = []
        this.getDataForModal()
    }

    HistoryModal.prototype.getDataForModal = function() {
        /* get data about previous notebook cell orders
           then render the modal using that data */

        var that = this;
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
        var that = this
        numConfigs = this.nb_configs.length

        // log opening
        JanusUtils.logJanusAction(this.notebook, Date.now(), 'open-history', '', []);

        // create HTML for the modal's content
        var modal_body = $('<div/>');
        var modal_float = $('<div class="floater">');
        var revision = $('<div id="revision"/>')
        revision.append($('<div id="rev_num"/>'));
        revision.append($('<div id="rev_time"/>'));
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
        /* get data on specific cell versions to show then update the modal based on that data

        Args:
            version_ids: cells versions we want to get data for
        */


        // remember the scroll position so we don't jump around after rendering
        // new cells
        that = this;
        var scrollY = $('.modal').scrollTop()

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
            var cells = get_data['cells'];
            that.cells = []

            $('#history-cell-wrapper').empty();
            for ( i=0; i < version_ids.length; i++ ){
                if (version_ids[i] in cells){
                    that.appendCell(cells[version_ids[i]], scrollY);
                }
            }
        });
    }


    HistoryModal.prototype.appendCell = function(cellJSON, scrollY) {
        /* add cell to modal */

        // add redonly cell to the wraper
        var newCell = JanusUtils.getDuplicateCell(cellJSON, Jupyter.notebook);
        newCell.code_mirror.setOption('readOnly', "nocursor");
        $('#history-cell-wrapper').append(newCell.element);
        this.cells.push(newCell)

        // make sure all code cells are rendered
        if(newCell.cell_type == 'code'){
            newCell.render();
            newCell.focus_editor();
        }

        // set scroll position
        $('.modal').scrollTop(scrollY)
        this.hideCells()

    }


    //TODO break this into smaller functions that are easier to maintain
    HistoryModal.prototype.hideCells = function() {
        /* Hide cells in the modal and enable minimap */


        // remove current markers for hidden cells, outputs, and code
        $(".modal").find('.hide-container').remove()

        var cells = Jupyter.historyViewer.cells
        var serial_hidden_cells = []
        var serial_lines = 0

        for (var i = 0; i < cells.length; i++) {

            // keep track of groups of hidden cells
            var cellHidden = cells[i].metadata.janus.cell_hidden
            if (cellHidden) {
                serial_hidden_cells.push(cells[i])

                // count lines of code
                if (cells[i].cell_type == "code") {
                    var lines_of_code = cells[i].get_text().split('\n').length
                    if (lines_of_code > 0) {
                        serial_lines = serial_lines + lines_of_code
                    }
                }
            }

            // create placeholder if at last cell, or at visible cell after
            // a group of hidden cells
            var numHidden = serial_hidden_cells.length
            if ( i == cells.length - 1 && cellHidden || (! cellHidden && numHidden > 0) ){

                // get the cell ids
                var cell_ids = []
                for (var j = 0; j < numHidden; j++) {
                    serial_hidden_cells[j].element.addClass('hidden');
                    cell_ids.push(serial_hidden_cells[j].metadata.janus.id);
                }

                var place = cells[i].element.before($('<div>')
                    .addClass('hide-container')
                    .append($('<div>')
                        .addClass('hide-spacer'))
                    .append($('<div>')
                        .addClass('hide-marker')
                        .data('ids', cell_ids.slice())
                        .hover(function(event){
                            JanusUtils.showMinimap(event, this)
                        },
                        function(event){
                            JanusUtils.hideMinimap(event, this)
                        })
                        .mousemove( function(event){
                            JanusUtils.moveMinimap(event, this);
                        }
                        )
                        .append($('<div>')
                            .addClass('hide-label')
                            .text("Hidden Cells")
                        )
                        .append($('<div>')
                            .addClass('hide-text')
                            .text(serial_lines +  " lines")
                            .append($('<div>')
                                .addClass('fa fa-angle-right hide-arrow')))
                        )
                    )

                // clear our lists
                serial_hidden_cells = []
                serial_lines = 0
            }

            // render hidden code markers
            var outputArea = cells[i].element.find('div.output_wrapper')[0];
            var classes = "marker hidden-code fa fa-code";
            if (cells[i].metadata.janus.source_hidden && ! cells[i].metadata.janus.cell_hidden) {

                cells[i].element.find("div.input").hide('slow');

                JanusUtils.removeMarkerType('.hidden-code', outputArea);
                var marker = JanusUtils.addMarkerToElement(outputArea, classes);
                $(marker).data('ids', [cells[i].metadata.janus.id])
                    // .data('showing', false)
                    .hover(function(event){
                        JanusUtils.showMinimap(event, this)
                    },
                    function(event){
                        JanusUtils.hideMinimap(event, this)
                    })
                    .mousemove( function(event){
                        JanusUtils.moveMinimap(event, this);
                    })
            }

            // render hidden output markers
            var markerContainer = JanusUtils.getMarkerContainer(cells[i])
            var classes = "marker hidden-output fa fa-area-chart";
            var selID = cells[i].metadata.janus.id
            if (cells[i].metadata.janus.output_hidden && ! cells[i].metadata.janus.cell_hidden) {

                cells[i].element.find("div.output").hide('slow');

                JanusUtils.removeMarkerType('.hidden-output', markerContainer);
                var marker = JanusUtils.addMarkerToElement(markerContainer, classes);
                $(marker).data('ids', [cells[i].metadata.janus.id])
                    // .data('showing', false)
                    .hover(function(event){
                        JanusUtils.showMinimap(event, this)
                    },
                    function(event){
                        JanusUtils.hideMinimap(event, this)
                    })
                    .mousemove( function(event){
                        JanusUtils.moveMinimap(event, this);
                    })
            }

        }
    }


    function createHistoryModal() {
        /* create a new history viewer element */

        return new HistoryModal(Jupyter.notebook);
    }


    return{
        createHistoryModal: createHistoryModal
    };

})
