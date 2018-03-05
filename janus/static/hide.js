/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes

Handle hiding and showing cells
*/

define([
    'jquery',
    'base/js/namespace',
    '../janus/utils'
], function(
    $,
    Jupyter,
    JanusUtils
){

    //TODO substantial duplicate code that could be put into helper functions

    function toggleSelCellsVisibility() {
        /* toggle visiblity of all selected cells

        use the visibility of the primary selected cell to set visibility for
        remainder of selection */

        var selCell = Jupyter.notebook.get_selected_cell();
        var primaryHidden = selCell.metadata.janus.cell_hidden
        var selCells = Jupyter.notebook.get_selected_cells();

        // get ids of selected cells and log the action
        var selID = selCell.metadata.janus.id
        var selIDs = []
        for (var i = 0; i < selCells.length; i++){
            selIDs.push(selCells[i].metadata.janus.id)
        }

        // perform the hiding / showing
        for (var i = 0; i < selCells.length; i++) {
            if (primaryHidden) {
                showCell(selCells[i]);
            } else {
                hideCell(selCells[i]);
            }
        }

        if (primaryHidden){
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'show-cells', selID, selIDs);
        } else {
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'hide-cells', selID, selIDs);
        }
    }


    function hideCell(cell) {
        /* hide a cell so it appears in the sidebar

        Args:
            cell: cell to hide
        */

        // styling
        cell.element.find("div.input").hide('slow');
        cell.element.find("div.output").hide('slow');
        cell.element.addClass('hidden');

        // metadata
        cell.metadata.janus.cell_hidden = true;
        cell.metadata.janus.source_hidden = true;
        cell.metadata.janus.output_hidden = true;

        // markers and sidebar
        Jupyter.sidebar.saveMarkerMetadata();
        Jupyter.sidebar.updateHiddenCells();
    }


    function showCell(cell) {
        /* show a cell so it appears in the main notebook rather than sidebar

        Args:
            cell: cell to show
        */

        // styling
        cell.element.find("div.input").show('slow');
        cell.element.find("div.output").show('slow');
        cell.element.removeClass('hidden');

        // metadata
        cell.metadata.janus.cell_hidden = false;
        cell.metadata.janus.source_hidden = false;
        cell.metadata.janus.output_hidden = false;

        // update text with content from sidebar cell
        if (cell.sb_cell){
            cell.set_text(cell.sb_cell.get_text());
        }
        cell.render();

        // update hidden source / ouptut markers
        renderSourceMarker(cell);
        renderOutputMarker(cell);

        // update sidebar
        Jupyter.sidebar.saveMarkerMetadata();
        Jupyter.sidebar.updateHiddenCells();
    }


    function toggleSourceVisibility() {
        /* Hide/Show the source of individual cells */

        // get selected ids and log the action
        var selCell = Jupyter.notebook.get_selected_cell();
        var showSource = selCell.metadata.janus.source_hidden
        var selCells = Jupyter.notebook.get_selected_cells();

        var selID = selCell.metadata.janus.id
        var selIDs = []
        for (var i = 0; i < selCells.length; i++){
            selIDs.push(selCells[i].metadata.janus.id)
        }

        // perform the hiding / showing
        for (var i = 0; i < selCells.length; i++) {

            var numOutputs = selCells[i].output_area.outputs.length

            // if we should show the source
            if (showSource) {
                if (selCells[i].metadata.janus.output_hidden && numOutputs > 0) {
                    // only show the source
                    $(selCells[i].element).removeClass('hidden');
                    selCells[i].metadata.janus.source_hidden = false;
                    selCells[i].metadata.janus.cell_hidden = false;
                    $(selCells[i].element).find("div.input").show('slow');
                } else {
                    // show the whole cell
                    showCell(selCells[i])
                }
            } else {
                if (selCells[i].metadata.janus.output_hidden || numOutputs == 0) {
                    // hide the entire cell
                    hideCell(selCells[i])
                } else {
                    // only hide the source
                    selCells[i].metadata.janus.source_hidden = true;
                    selCells[i].element.find("div.input").hide('slow');
                }
            }

            renderSourceMarker(selCells[i]);

        }

        // update the sidebar
        Jupyter.sidebar.saveMarkerMetadata();
        Jupyter.sidebar.updateHiddenCells();

        if (showSource){
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'show-source', selID, selIDs);
        } else {
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'hide-source', selID, selIDs);
        }
    }


    function renderSourceMarker(cell) {
        /* Show marker on cell with hidden source

        Args:
            cell: main notebook cell to hide source
        */

        var outputArea = cell.element.find('div.output_wrapper')[0];
        var classes = "marker hidden-code fa fa-code";

        if (cell.metadata.janus.source_hidden && ! cell.metadata.janus.cell_hidden) {

            JanusUtils.removeMarkerType('.hidden-code', outputArea);
            var marker = JanusUtils.addMarkerToElement(outputArea, classes);
            $(marker).data('ids', [cell.metadata.janus.id])
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
            marker.onclick = function() { showCellInSidebar(cell, marker); };
        }
        else if (cell.cell_type == 'code') {
            JanusUtils.removeMarkerType('.hidden-code', outputArea);
        }
    }


    function toggleOutputVisibility() {
        /* Hide/Show the outputs of individual cells */

        var selCell = Jupyter.notebook.get_selected_cell();
        var showOutput = selCell.metadata.janus.output_hidden;
        var selCells = Jupyter.notebook.get_selected_cells();

        // log the action
        var selID = selCell.metadata.janus.id
        var selIDs = []
        for (var i = 0; i < selCells.length; i++){
            selIDs.push(selCells[i].metadata.janus.id)
        }

        // perform the hiding / showing
        for (var i = 0; i < selCells.length; i++) {

            var numOutputs = selCells[i].output_area.outputs.length
            if (numOutputs > 0){
                if (showOutput) {
                    if (! selCells[i].metadata.janus.source_hidden) {
                        // show whole cell
                        showCell(selCells[i])
                    } else {
                        // just show the output
                        selCells[i].element.removeClass('hidden');
                        selCells[i].metadata.janus.output_hidden = false;
                        selCells[i].metadata.janus.cell_hidden = false;
                        selCells[i].element.find("div.output").show('slow');
                    }
                } else {
                    if (selCells[i].metadata.janus.source_hidden) {
                        hideCell(selCells[i])
                    } else if (numOutputs > 0) {
                        // hide just the output
                        selCells[i].metadata.janus.output_hidden = true;
                        selCells[i].element.find("div.output").hide('slow');
                    }
                }

            renderOutputMarker(selCells[i]);

            }
        }

        // update the sidebar
        Jupyter.sidebar.saveMarkerMetadata();
        Jupyter.sidebar.updateHiddenCells();

        if (showOutput){
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'show-output', selID, selIDs);
        } else {
            JanusUtils.logJanusAction(Jupyter.notebook, Date.now(), 'hide-output', selID, selIDs);
        }
    }


    function renderOutputMarker(cell) {
        /* Show marker on cell with hidden source

        Args:
            Cell: cell to place marker on
        */

        var markerContainer = JanusUtils.getMarkerContainer(cell)
        var classes = "marker hidden-output fa fa-area-chart";
        var selID = cell.metadata.janus.id

        if (cell.metadata.janus.output_hidden && ! cell.metadata.janus.cell_hidden) {

            JanusUtils.removeMarkerType('.hidden-output', markerContainer);
            var marker = JanusUtils.addMarkerToElement(markerContainer, classes);
            $(marker).data('ids', [cell.metadata.janus.id])
                .hover(function(event){
                    JanusUtils.showMinimap(event, this)
                },
                function(event){
                    JanusUtils.hideMinimap(event, this)
                })
                .mousemove( function(event){
                    JanusUtils.moveMinimap(event, this);
                })
            marker.onclick = function() { showCellInSidebar(cell, marker); };
        }
        else if (cell.cell_type == 'code') {
            JanusUtils.removeMarkerType('.hidden-output', markerContainer);
        }
    }


    function toggleAllSections(){
        /* Show or hide all hide cell sections in the sidebar */

        if (Jupyter.sidebar.collapsed) {
            for (var i = 0; i < Jupyter.sidebar.sections.length; i++) {
                Jupyter.sidebar.sections[i].showing = true;
            }
        } else {
            for (var i = 0; i < Jupyter.sidebar.sections.length; i++) {
                Jupyter.sidebar.sections[i].showing = false;
            }
        }

        Jupyter.sidebar.updateSidebarSections()
    }


    function initializeVisibility() {
        /* hide source and outputs of all cells in nb with proper metadata */

        var cells = Jupyter.notebook.get_cells()
        for ( i=0; i < cells.length; i++ ) {

            // output hidden
            if (cells[i].metadata.janus.output_hidden) {
                renderOutputMarker(cells[i]);
                cells[i].element.find("div.output").hide('slow');
            }

            // source hidden
            if (cells[i].metadata.janus.source_hidden) {
                renderSourceMarker(cells[i]);
                cells[i].element.find("div.input").hide('slow');
            }
        }
    }


    function showCellInSidebar(cell, marker) {
        /* Show this cell in the sidebar

        Args:
            cell: cell to show
            marker: marker being clicked to show cell (use for sidebar position)
        */

        // update showing metadata
        var index = $(marker).data('sectionIndex')
        Jupyter.sidebar.sections[index].showing = true;
        Jupyter.sidebar.sections[index].element.show()
        $(marker).addClass('active')

        var secCells = Jupyter.sidebar.sections[index].cells
        for (var i = 0; i < secCells.length; i++) {
            if (secCells.cell_type == 'code') {
                secCells[i].render();
                secCells[i].focus_editor();
                secCells[i].expand_output();
            }
        }

        // show the item
        Jupyter.sidebar.expand()
    }


    return {
        toggleSelCellsVisibility: toggleSelCellsVisibility,
        toggleSourceVisibility: toggleSourceVisibility,
        toggleOutputVisibility: toggleOutputVisibility,
        initializeVisibility, initializeVisibility,
        toggleAllSections: toggleAllSections
    };

});
