/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
    '../janus/versions',
    '../janus/utils'
], function(
    require,
    $,
    Jupyter,
    Cell,
    CodeCell,
    TextCell,
    JanusVersions,
    JanusUtils
){


    var Sidebar = function(nb) {
        /* A sidebar panel for showing hidden cells */
        var sidebar = this;
        Jupyter.sidebar = sidebar;

        sidebar.notebook = nb;
        sidebar.collapsed = true;
        sidebar.cells = [];
        sidebar.marker = null;
        sidebar.markerPosition = 0;

        // create html element for sidebar and add to page
        sidebar.element = $('<div id=sidebar-container>');
        $("#notebook").append(sidebar.element);

        return this;
    };


    Sidebar.prototype.renderCells = function(cells) {
        /* render notebook cells in the sidebar

        Args:
            cells: list of cell objects from the main notebook
        */

        // remove any cells currently in sidebar
        this.cells = []
        $('#sidebar-cell-wrapper').remove();
        this.element.append( $("<div/>")
            .attr('id', 'sidebar-cell-wrapper')
            .addClass('cell-wrapper'));

        // for each cell, create a new cell in the Sidebar with the same content
        for (var i = 0; i < cells.length; i++) {

            // add new cell to the sidebar
            newCell = this.createSidebarCell(cells[i]);
            $('#sidebar-cell-wrapper').append(newCell.element);
            this.cells.push(newCell);

            // make sure all code cells are rendered
            if (newCell.cell_type == 'code') {
                newCell.render();
                newCell.focus_editor();
                newCell.expand_output();
            }

            // hide output if needed
            if (newCell.metadata.janus.source_hidden && ! newCell.metadata.janus.output_hidden) {
                newCell.element.find("div.output_wrapper").hide();
            }

            if (newCell.metadata.janus.output_hidden && !newCell.metadata.janus.source_hidden) {
                newCell.element.find("div.input").hide();
            }

            // intercept sidebar click events and apply them to original cell
            newCell._on_click = function(event) {

                // select the appropriate cell in the original notebook
                this.events.trigger('select.Cell', {
                    'cell': this.nb_cell,
                    'extendSelection':event.shiftKey
                });
            }

            // propigate edits in sidebar cell to main notebook cell
            newCell.code_mirror.on('change', function(){
                if(newCell.nb_cell){
                    newCell.nb_cell.set_text( newCell.get_text() )
                }
            });

            // render any history markers
            JanusVersions.renderMarkers(newCell);
        }

        // focus the first cell in the sidebar
        if(cells.length > 0){
            cells[0].sb_cell.element.focus();
            if(cells[0].cell_type == 'code'){
                cells[0].sb_cell.focus_editor();
            }
        }
    }


    Sidebar.prototype.createSidebarCell = function(cell) {
        /* Create sidebar cell duplicating a cell in the main notebook

        Args:
            cell: a single cell object from the main notebook
        */

        var cellJSON = cell.toJSON();
        var newCell = JanusUtils.getDuplicateCell(cellJSON, this.notebook)

        // link the notebook and sidebar cells
        newCell.nb_cell = cell;
        cell.sb_cell = newCell;

        return newCell;
    }


    Sidebar.prototype.toggle = function(cells = []) {
        /* expand or collapse sidebar

        Args:
            cells: list of cell objects from the main notebook
        */

        // prepare info for logging
        var selID = ""
        var selIDs = []
        var markerType = ""

        for (var i = 0; i < cells.length; i++) {
            selIDs.push(cells[i].metadata.janus.id);
        }
        if (selIDs.length > 0){
            selID = selIDs[0];
        }
        if ($(this.marker).hasClass('hidden-code')){
            markerType = "source"
        } else if ($(this.marker).hasClass('hidden-output')) {
            markerType = "output"
        } else {
            markerType = "cells"
        }

        // get ids for cells to render, and cells already in sidebar
        var new_cell_ids = []
        var old_cell_ids = []
        for (i=0; i<cells.length; i++) {
            new_cell_ids.push(cells[i].metadata.janus.id)
        }
        for (j=0; j<this.cells.length; j++) {
            old_cell_ids.push(this.cells[j].metadata.janus.id)
        }

        // expand sidebar if collapsed
        if(this.collapsed){
            // log action
            var logName = 'open-sidebar-' + markerType
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), logName, selID, selIDs);

            this.expand()
            nb_cells = Jupyter.notebook.get_cells()
            for(i=0; i < nb_cells.length; i++){
                if(cells[0].metadata.janus.id == nb_cells[i].metadata.janus.id){
                    Jupyter.notebook.select(i);
                    Jupyter.notebook.scroll_to_cell(i, 500)
                }
            }
            if(cells.length > 0){
                this.renderCells(cells)
            }
            highlightMarker(this.marker);
        }

        // update sidebar if new cells, or new cell order
        else if (JSON.stringify(old_cell_ids) != JSON.stringify(new_cell_ids)) {

            // log action
            var logName = 'update-sidebar-' + markerType
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), logName, selID, selIDs);

            highlightMarker(this.marker)

            // select the corect cell
            nb_cells = Jupyter.notebook.get_cells()
            for (i=0; i < nb_cells.length; i++) {
                if (cells[0].metadata.janus.id == nb_cells[i].metadata.janus.id) {
                    Jupyter.notebook.select(i);
                }
            }

            // move the sidebar to a new position, this has been buggy
            var markerPosition = $(Jupyter.sidebar.marker).parent().position().top - 12
            if($(Jupyter.sidebar.marker).hasClass('hidden-code')){
                markerPosition = $(cells[0].element).position().top;
            }
            if($(Jupyter.sidebar.marker).hasClass('hidden-output')){
                markerPosition = $(cells[0].element).position().top;
            }
            this.element.animate({
                top: markerPosition,
            }, 0)

            if(cells.length > 0){
                Jupyter.sidebar.renderCells(cells);
                Jupyter.sidebar.cells[0].focus_editor();
            }
        }

        // otherwise collapse sidebar
        else{
            // log action
            var logName = 'close-sidebar-' + markerType
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), logName, selID, selIDs);

            this.collapse()
            highlightMarker(null)
        }
    }


    Sidebar.prototype.expand = function() {
        /* Show sidebar expanding from left of page */

        // only proceed if sidebar is collapsed
        if(! this.collapsed){
            return;
        }

        this.collapsed = false;
        var site_height = $("#site").height();
        var site_width = $("#site").width();
        var sidebar_width = (site_width - 45) / 2; // 40 pixel gutter + 15 pixel padding on each side of page

        $('#sidebar-cell-wrapper').show()

        // first move the notebook container to the side
        $("#notebook-container").animate({
            marginLeft: '15px',
            width: sidebar_width
        }, 400, function() {

            // get position based on the type of marker we are using
            var markerPosition = $(Jupyter.sidebar.marker).parent().position().top - 12
            if ($(Jupyter.sidebar.marker).hasClass('hidden-code')) {
                markerPosition = $(Jupyter.sidebar.cells[0].nb_cell.element).position().top;
            }
            if ($(Jupyter.sidebar.marker).hasClass('hidden-output')) {
                markerPosition = $(Jupyter.sidebar.cells[0].nb_cell.element).position().top;
            }

            // then move it the sidebar into position
            Jupyter.sidebar.element.animate({
                right: '15px',
                width: sidebar_width,
                top: markerPosition,
                padding: '0px'
            }, 400, function() {

                // ensure code cells are fully rendered
                sb_cells = Jupyter.sidebar.cells
                for (var i = 0; i < sb_cells.length; i++) {
                    if (sb_cells[i].cell_type == 'code') {
                        sb_cells[i].render();
                        sb_cells[i].focus_editor();
                        sb_cells[i].expand_output();
                    }
                }

                sb_cells[0].focus_editor();

                // then scroll the page to the correct spot, in case it jumped
                nb_cells = Jupyter.notebook.get_cells()
                for (var i=0; i < nb_cells.length; i++) {
                    if (sb_cells[0].metadata.janus.id == nb_cells[i].metadata.janus.id ) {
                        Jupyter.notebook.scroll_to_cell(i, 500)
                    }
                }
            })
        });
    };


    Sidebar.prototype.collapse = function() {
        /* Collapse the sidebar to the right page border */

        // only proceed if sidebar is expanded
        if (this.collapsed) {
            return;
        }

        this.collapsed = true;
        var menubar_width = $("#menubar-container").width();
        var site_width = $("#site").width();
        var margin = (site_width - menubar_width) / 2

        // need to use exact values for animation, then return to defaults
        $("#notebook-container").animate({
            marginLeft: margin,
            width: menubar_width
            }, 400, function(){
                $("#notebook-container").css( 'margin-left', 'auto' )
                $("#notebook-container").css( 'width', '' )
        })

        this.element.animate({
            right: '15px',
            width: 0,
            padding: '0px'
        }, 400, function(){
                $('#sidebar-cell-wrapper').hide(); // only hide after animation finishes
        });
    };


    Sidebar.prototype.update = function() {
        /* update the cells rendered in the sidebar, such as after deletion */

        if (! this.collapsed) {

            // get list of previous cells in sidebar and currently hidden cells
            nb_cells = Jupyter.notebook.get_cells()
            old_cell_ids = []
            hidden_cell_ids = []
            for (var j = 0; j < this.cells.length; j++) {
                old_cell_ids.push(this.cells[j].metadata.janus.id)
            }
            for (var i = 0; i < nb_cells.length; i++) {
                if (nb_cells[i].metadata.janus.cell_hidden) {
                    hidden_cell_ids.push(nb_cells[i].metadata.janus.id)
                }
            }

            // find the first hidden cell that was in our previous sidebar
            var first_hidden = null
            for (var k = 0; k < hidden_cell_ids.length; k++) {
                if (old_cell_ids.indexOf( hidden_cell_ids[k] ) >= 0) {
                    first_hidden = hidden_cell_ids[k]
                    break
                }
            }

            // if none found, then collapse the sidebar
            if (first_hidden == null) {
                this.collapse()
            }
            // else update the sidebar
            else{
                // get placeholder with the top previous hidden cell in it
                placeholders = $('.hide-marker').toArray()
                for (i = 0; i < placeholders.length; i++) {
                    if($(placeholders[i]).data('ids').indexOf(first_hidden) >= 0) {
                        Jupyter.sidebar.marker = placeholders[i];
                        Jupyter.sidebar.markerPosition = $(placeholders[i]).parent().position().top
                        Jupyter.sidebar.showWithCells($(placeholders[i]).data('ids'))
                        break
                    }
                }
            }
        }
    }


    Sidebar.prototype.hideHiddenCells = function() {
        /* hide all hidden cells and render placeholders in their place */

        // save data from and remove current markers for hidden cells
        $(".hide-container").remove()

        var cells = Jupyter.notebook.get_cells();
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

                var cell_ids = []
                for (var j = 0; j < numHidden; j++) {
                    serial_hidden_cells[j].element.addClass('hidden');
                    cell_ids.push(serial_hidden_cells[j].metadata.janus.id);
                }

                // create placeholder that will render this group of hidden cells
                Jupyter.sidebar.addPlaceholderAfterElementWithIds(serial_hidden_cells[numHidden - 1].element, cell_ids, serial_lines)

                // clear our lists
                serial_hidden_cells = []
                serial_lines = 0
            }
        }
    }


    Sidebar.prototype.showWithCells = function (cell_ids) {
        /* get cells to show in sidebar if given their Janus ids

        cell_ids: ids of the cells to show
        */

        cells = Jupyter.notebook.get_cells()
        cells_to_copy = []
        for(i = 0; i < cells.length; i++){
            if ( $.inArray( cells[i].metadata.janus.id, cell_ids ) > -1 ){
                cells_to_copy.push(cells[i])
            }
        }
        Jupyter.sidebar.toggle(cells_to_copy)
    }


// PLACEHOLDERS FOR HIDDEN CELLS
    Sidebar.prototype.addPlaceholderAfterElementWithIds = function(elem, cell_ids, serial_lines) {
        /* Add the placeholder used to open a group of hidden cells */

        // get placholder name from metadata, if present
        var markerMetadata = Jupyter.notebook.metadata.janus.janus_markers;
        var first_stored = '';
        if(markerMetadata){
            for(j = 0; j < markerMetadata.length; j++){
                overlap = markerMetadata[j].ids.filter((n) => cell_ids.includes(n))
                if(overlap.length > 0){
                    first_stored = markerMetadata[j].markerName
                    break
                }
            }
        }

        var place = elem.after($('<div>')
            .addClass('hide-container')
            .append($('<div>')
                .addClass('hide-spacer'))
            .append($('<div>')
                .addClass('hide-marker')
                .data('ids', cell_ids.slice())
                .click(function(){
                    $('#minimap').remove()
                    that = this;
                    Jupyter.sidebar.marker = that;
                    Jupyter.sidebar.markerPosition = $(that).parent().position().top;
                    Jupyter.sidebar.showWithCells($(this).data('ids'))
                })
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
                    .click(function(event){
                        enableVersionNameEditing(this)
                        event.stopPropagation()
                    })
                    .focusout(function(){
                        disableVersionNameEditing(this)
                    })
                    .hover(function(event){
                        this.style.color = "#333"
                        this.style.background = "#DDD"
                    },
                    function(event){
                        this.style.color = ""
                        this.style.background = ""
                    })
                    .text(function(){
                        if(first_stored == "" || first_stored == "Hidden Cells"){
                            return "Hidden Cells"
                        }
                        else{
                            return first_stored
                        }
                    })
                    // TODO intercept "Enter" to unselect, rather than start new line
                )
                .append($('<div>')
                    .addClass('hide-text')
                    .text(serial_lines +  " lines")
                    .append($('<div>')
                        .addClass('fa fa-angle-right hide-arrow')))
                )
            )
    }


    Sidebar.prototype.saveMarkerMetadata = function() {
        /* Store marker names to notebook metadata for later use */

        hideMarkers = $('.hide-marker').toArray()
        hideMetadata = []
        for (i = 0; i < hideMarkers.length; i++) {
            markerIDs = $(hideMarkers[i]).data('ids')
            markerName = $(hideMarkers[i]).find('.hide-label')[0].innerHTML
            hideMetadata.push({
                'ids': markerIDs,
                'markerName': markerName
            })
        }
        Jupyter.notebook.metadata.janus.janus_markers = hideMetadata
    }


    function highlightMarker(marker) {
        /*  highlight the marker clicked to show the sidebar
        marker: dom element, or null */

        $('.hide-marker').removeClass('active')
        $('.hidden-code').removeClass('active')
        $('.hidden-output').removeClass('active')
        if(marker != null){
            $(marker).addClass('active')
        }
    }


    function enableVersionNameEditing(element) {
        /* let version marker div be edited to name version

        Args:
            element: placeholder element to enable naming on
        */

        element.contentEditable = true;
        element.focus()
        Jupyter.notebook.keyboard_manager.edit_mode();
    }


    function disableVersionNameEditing(element) {
        /* stop editing version name and save to metadata

        Args:
            element: placeholder to get name from
        */

        element.contentEditable = false;
        Jupyter.notebook.keyboard_manager.command_mode();
        if(element.innerHTML == "" || element.innerHTML == "Hidden Cells"){
            element.innerHTML = "Hidden Cells"
        }
        Jupyter.sidebar.saveMarkerMetadata()

    }


    function createSidebar() {
        /* create a new sidebar element */

        return new Sidebar(Jupyter.notebook);
    }


    return{
        createSidebar: createSidebar
    };

});
