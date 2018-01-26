/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Handle indenting and unindenting of cells to and from the Janus sidebar
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

// INDENT AND UNINDENT
    function indentSelectedCells() {
        /* move selected cells to the sidebar */

        // set metadata for all selected cells
        var selCells = Jupyter.notebook.get_selected_cells();
        for (i = 0; i < selCells.length; i++) {
            selCells[i].metadata.janus.cell_hidden = true;
            selCells[i].element.addClass('hidden');
        }

        // update the sidebar and placholders across the notebook
        Jupyter.sidebar.saveMarkerMetadata();
        Jupyter.sidebar.hideIndentedCells();
        Jupyter.sidebar.update();
    }


    function unindentSelectedCells() {
        /* move selected cells back to the main notebook */

        // keep track of currently indented cells for future comparison
        Jupyter.sidebar.saveMarkerMetadata();

        // update metadata and copy sidebar cell source to notebook cell
        var selCells = Jupyter.notebook.get_selected_cells();
        for (i = 0; i < selCells.length; i++) {
            selCells[i].element.removeClass('hidden');
            selCells[i].metadata.janus.cell_hidden = false;
            selCells[i].set_text(selCells[i].sb_cell.get_text());
            selCells[i].render();
        }

        // remove any unindented cells from the sidebar
        for (j = 0; j < Jupyter.sidebar.cells.length; j++) {
            if (Jupyter.sidebar.cells[j].selected) {
                Jupyter.sidebar.cells[j].element.addClass('hidden');
                Jupyter.sidebar.cells[j].element.remove();
                Jupyter.sidebar.cells.splice(j, 1);
            }
        }

        // update sidebar and notebook rendering of hidden cells
        Jupyter.sidebar.hideIndentedCells();
        Jupyter.sidebar.update();
    }


// HIDE SOURCE
    function toggleSourceVisibility() {
        /* Hide/Show the source of individual cells */

        var selCells = Jupyter.notebook.get_selected_cells();
        for (i = 0; i < selCells.length; i++){
            selCells[i].element.find("div.input").toggle('slow');
            selCells[i].metadata.janus.source_hidden =! selCells[i].metadata.janus.source_hidden;
            renderSourceMarker(selCells[i]);
        }
    }


    function renderSourceMarker(cell) {
        /* Show marker on cell with hidden source

        Args:
            cell: main notebook cell to hide source
        */

        var outputArea = cell.element.find('div.output_wrapper')[0];
        var classes = "marker hidden-code fa fa-code";

        if (cell.metadata.janus.source_hidden) {
            JanusUtils.removeMarkerType('.hidden-code', outputArea);
            var marker = JanusUtils.addMarkerToElement(outputArea, classes);
            marker.onclick = function() { showCellInSidebar(cell, marker); };
        }
        else if (cell.cell_type == 'code') {
            JanusUtils.removeMarkerType('.hidden-code', outputArea);
            Jupyter.sidebar.collapse();
            // TODO may want to do Jupyter.sidebar.update() instead
        }
    }


// HIDE OUTPUTS
    function toggleOutputVisibility() {
        /* Hide/Show the outputs of individual cells */

        var selCells = Jupyter.notebook.get_selected_cells();
        for (i = 0; i < selCells.length; i++){
            selCells[i].element.find("div.output").toggle('slow');
            selCells[i].metadata.janus.output_hidden =! selCells[i].metadata.janus.output_hidden;
            renderOutputMarker(selCells[i]);
        }
    }


    function renderOutputMarker(cell) {
        /* Show marker on cell with hidden source

        Args:
            Cell: cell to place marker on
        */

        var markerContainer = JanusUtils.getMarkerContainer(cell)
        var classes = "marker hidden-output fa fa-area-chart";

        if (cell.metadata.janus.output_hidden) {
            JanusUtils.removeMarkerType('.hidden-output', markerContainer);
            var marker = JanusUtils.addMarkerToElement(markerContainer, classes);
            marker.onclick = function() { showCellInSidebar(cell, marker); };
        }
        else if (cell.cell_type == 'code') {
            JanusUtils.removeMarkerType('.hidden-output', markerContainer);
            Jupyter.sidebar.collapse();
            // TODO may want to do Jupyter.sidebar.update() instead
        }
    }


// GENERAL
    function initializeVisibility() {
        /* hide source and outputs of all cells in nb with proper metadata */

        var cells = Jupyter.notebook.get_cells()
        for ( i=0; i < cells.length; i++ ) {

            // output hidden
            if (cells[i].metadata.janus.output_hidden) {
                renderOutputMarker(cells[i]);
                cells[i].element.find("div.output").hide();
            }

            // source hidden
            if (cells[i].metadata.janus.source_hidden) {
                renderSourceMarker(cells[i]);
                cells[i].element.find("div.input").hide();
            }
        }
    }


    function showCellInSidebar(cell, marker) {
        /* Show this cell in the sidebar

        Args:
            cell: cell to show
            marker: marker being clicked to show cell (use for sidebar position)
        */

        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
    }


    return {
        indentSelectedCells: indentSelectedCells,
        unindentSelectedCells: unindentSelectedCells,
        toggleSourceVisibility: toggleSourceVisibility,
        toggleOutputVisibility: toggleOutputVisibility,
        initializeVisibility, initializeVisibility
    };

});
