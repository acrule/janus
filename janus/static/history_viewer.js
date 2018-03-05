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

    // TODO some cell versions may be saving before cell is fully executed
    // TODO break hidCells into smaller functions that are easier to maintain

    var HistoryModal = function(nb) {
        /* object represeting the history viewer modal popup

        Args:
            nb: notebook where history modal will live
        */

        var historyViewer = this;
        Jupyter.historyViewer = historyViewer;

        this.notebook = nb;
        this.cells = [];

        // get notebook history and starting showing it
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
            } else {
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
            slide: function(event, ui) {
                that.updateUIText(ui.value);

            },
            stop: function( event, ui ) {
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
                    // track history closing
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

        // update UI text, then update the cells
        this.updateUIText(version_num);

        var version_ids = this.nb_configs[version_num][3];
        this.getCellVersionData(version_ids, version_num);
    }


    HistoryModal.prototype.updateUIText = function(version_num) {
        /* Update the UI text

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
            if (num_hours == 1){
                date_string = "1 hour ago";
            } else {
                date_string = num_hours.toString() + " hours ago";
            }
        } else {
            num_days = parseInt( t_diff / 86400 );
            if (num_days == 1) {
                date_string = "1 day ago";
            } else {
                date_string = num_days.toString() + " days ago";
            }
        }

        // set the time and revision number in the ui
        $('#rev_num').html(rev_string);
        $('#rev_time').html(date_string);
    }


    HistoryModal.prototype.getCellVersionData = function(version_ids, version_num) {
        /* get data on specific cell versions to show then update the modal based on that data

        Args:
            version_ids: cells versions we want to get data for
            version_num: version of the notebook to show (int)
        */


        // remember the scroll position so we don't jump around after rendering
        var that = this;
        var scrollY = $('.modal').scrollTop()
        var firstNew = null;

        // preapre url for GET request
        var baseUrl = Jupyter.notebook.base_url;
        var notebookUrl =  Jupyter.notebook.notebook_path;
        var url = utils.url_path_join(baseUrl, 'api/janus', notebookUrl);
        var paths = Jupyter.notebook.metadata.janus.filepaths;

        var hide_order = this.nb_configs[version_num][4];

        //  GET settings, asking for data for each cell version
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

            // prepare list of previous cells for comparison
            var newCells = []
            var oldIDs = [];
            var oldUsed = []
            var oldCells = Jupyter.historyViewer.cells
            for (var i = 0; i < oldCells.length; i++) {
                oldIDs.push(oldCells[i].metadata.janus.version_id);
                oldUsed.push(false);
            }

            // var cellWrapper= $('#history-cell-wrapper')
            for (var i = 0; i < version_ids.length; i++) {

                // check if this is a new cell from the immediately previous version
                if (version_num > 0) {
                    var lastIndex = Jupyter.historyViewer.nb_configs[version_num - 1][3].indexOf(version_ids[i])
                    var newVersion = (lastIndex == -1)
                }
                else {
                    var newVersion = true
                }

                // detach and reappend old cells so we don't have to recreate them
                var oldIndex = oldIDs.indexOf(version_ids[i])
                if (oldIndex >= 0) {

                    oldUsed[oldIndex] = true;

                    // update visibility
                    updateHide(oldCells[oldIndex], hide_order[i])

                    var c = $(oldCells[oldIndex].element).detach()
                    $(c).appendTo('#history-cell-wrapper')
                    newCells.push(oldCells[oldIndex])

                    if (newVersion) {
                        $(c).addClass('new-version')
                        if (firstNew == null) {
                            firstNew = oldCells[oldIndex]
                        }
                    } else {
                        $(c).removeClass('new-version')
                    }

                // or add new cells
                } else {

                    var newCell = JanusUtils.getDuplicateCell(cells[version_ids[i]], Jupyter.notebook);
                    if (newVersion) {
                        $(newCell.element).addClass('new-version')
                        if (firstNew == null) {
                            firstNew = newCell;
                        }
                    }
                    updateHide(newCell, hide_order[i])

                    newCell.metadata.janus.version_id = version_ids[i]
                    newCell.code_mirror.setOption('readOnly', "nocursor");
                    $('#history-cell-wrapper').append(newCell.element);

                    // make sure all code cells are rendered
                    if(newCell.cell_type == 'code'){
                        newCell.render();
                        newCell.focus_editor();
                    }

                    // add the cell to our list
                    newCells.push(newCell)
                }
            }

            // remove currently rendered cells not reused
            for (var i = 0; i < oldUsed.length; i++) {
                if (oldUsed[i] == false) {
                    $(oldCells[i].element).remove()
                }
            }

            // hide the hidden cells
            Jupyter.historyViewer.cells = newCells
            Jupyter.historyViewer.hideCells()

            // scroll to the last position, or the first new cell
            if (firstNew != null) {
                newPos = $(firstNew.element).position().top
                var modalHeight = $('.modal').height()
                $('.modal').scrollTop(scrollY)
                var bottom = scrollY + modalHeight
                if (newPos > bottom || newPos < scrollY){
                    $(".modal").animate({ scrollTop: newPos }, 500);
                }
            } else{
                $('.modal').scrollTop(scrollY)
            }


        });
    }

    function updateHide(cell, hide_state) {
        if (hide_state == 'c') {
            cell.metadata.janus.cell_hidden = true
            cell.metadata.janus.source_hidden = true
            cell.metadata.janus.output_hidden = true
        } else if (hide_state == 'o') {
            cell.metadata.janus.cell_hidden = false
            cell.metadata.janus.source_hidden = false
            cell.metadata.janus.output_hidden = true
        } else if (hide_state == 's') {
            cell.metadata.janus.cell_hidden = false
            cell.metadata.janus.source_hidden = true
            cell.metadata.janus.output_hidden = false
        } else if (hide_state == 'n') {
            cell.metadata.janus.cell_hidden = false
            cell.metadata.janus.source_hidden = false
            cell.metadata.janus.output_hidden = false
        }
    }


    HistoryModal.prototype.hideCells = function() {
        /* Hide cells in the modal and enable minimap */


        // remove current markers for hidden cells, outputs, and code
        $(".modal").find('.hide-container').remove()

        var cells = Jupyter.historyViewer.cells
        var serial_hidden_cells = []
        var serial_lines = 0
        var new_version = false

        for (var i = 0; i < cells.length; i++) {

            // keep track of groups of hidden cells
            var cellHidden = cells[i].metadata.janus.cell_hidden
            if (cellHidden) {
                serial_hidden_cells.push(cells[i])

                if ($(cells[i].element).hasClass('new-version')){
                    new_version = true
                }

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

                // ad the placeholder element
                var place = cells[i].element.before($('<div>')
                    .addClass('hide-container')
                    .addClass(function() {
                        if (new_version){
                            return 'new-version'
                        } else {
                            return ''
                        }
                    })
                    .append($('<div>')
                        .addClass('hide-spacer'))
                    .append($('<div>')
                        .addClass('hide-marker')
                        .data('ids', cell_ids.slice())
                        .hover(function(event){
                            JanusUtils.showMinimap(event, this, true)
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
                new_version = false
            }

            // render hidden code markers
            var outputArea = cells[i].element.find('div.output_wrapper')[0];
            var classes = "marker hidden-code fa fa-code";
            if (cells[i].metadata.janus.source_hidden && ! cells[i].metadata.janus.cell_hidden) {

                cells[i].element.find("div.input").hide();

                JanusUtils.removeMarkerType('.hidden-code', outputArea);
                var marker = JanusUtils.addMarkerToElement(outputArea, classes);
                $(marker).data('ids', [cells[i].metadata.janus.id])
                    // .data('showing', false)
                    .hover(function(event){
                        JanusUtils.showMinimap(event, this, true)
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

                cells[i].element.find("div.output").hide();

                JanusUtils.removeMarkerType('.hidden-output', markerContainer);
                var marker = JanusUtils.addMarkerToElement(markerContainer, classes);
                $(marker).data('ids', [cells[i].metadata.janus.id])
                    // .data('showing', false)
                    .hover(function(event){
                        JanusUtils.showMinimap(event, this, true)
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
