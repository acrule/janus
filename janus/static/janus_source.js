/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'jquery',
    'base/js/namespace'
], function(
    $,
    Jupyter
){

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
        /* Show marker on cell with hidden source */

        if (cell.metadata.janus.source_hidden) {
            removeHiddenSourceMarkers(cell);
            addHiddenSourceMarker(cell);
        }
        else if (cell.cell_type == 'code'){
            removeHiddenSourceMarkers(cell);
            Jupyter.sidebar.collapse();
        }
    }

    function removeHiddenSourceMarkers(cell) {
        /* remove all hidden source markers from a cell */

        var output_area = cell.element.find('div.output_wrapper')[0];
        if (output_area) {
            var markers = output_area.getElementsByClassName('hidden-code')
            while (markers[0]) {
                markers[0].parentNode.removeChild(markers[0]);
            }
        }
    }

    function addHiddenSourceMarker(cell) {
        /* add a hidden source marker to a cell */

        var output_area = cell.element.find('div.output_wrapper')[0];
        if (output_area) {
            var newElement = document.createElement('div');
            newElement.className = "marker hidden-code fa fa-code";
            newElement.onclick = function() {
                showSourceInSidebar(cell, newElement);
            };
            output_area.appendChild(newElement);
            if (! cell.selected) {
                $(newElement).hide()
            }
        }
    }

    function showSourceInSidebar(cell, marker) {
        /* Show this cell's source in the sidebar */

        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
    }

    function initializeSourceVisibility() {
        /* hide any sources of cells with source hidden metadata */

        var cells = Jupyter.notebook.get_cells()
        for ( i=0; i < cells.length; i++ ) {

            if (cells[i].metadata.janus.source_hidden == undefined){
                cells[i].metadata.janus.source_hidden = false
            }

            if (cells[i].metadata.janus.source_hidden) {
                renderSourceMarker(cells[i]);
                cells[i].element.find("div.input").hide();
            }
        }
    };

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
        /* Show marker on cell with hidden source */

        if (cell.metadata.janus.output_hidden) {
            removeHiddenOutputMarkers(cell);
            addHiddenOutputMarker(cell);
        }
        else if (cell.cell_type == 'code'){
            removeHiddenOutputMarkers(cell);
            Jupyter.sidebar.collapse();
        }
    }

    function removeHiddenOutputMarkers(cell) {
        /* remove all hidden source markers from a cell */

        var input_area = cell.element.find('div.marker-container')[0];
        if (input_area) {
            var markers = input_area.getElementsByClassName('hidden-output')
            while (markers[0]) {
                markers[0].parentNode.removeChild(markers[0]);
            }
        }
    }

    function addHiddenOutputMarker(cell) {
        /* add a hidden source marker to a cell */

        var input_area = cell.element.find('div.marker-container')[0];
        if (input_area) {
            var newElement = document.createElement('div');
            newElement.className = "marker hidden-output fa fa-area-chart";
            newElement.onclick = function() {
                showOutputInSidebar(cell, newElement);
            };
            input_area.appendChild(newElement);
            if (! cell.selected) {
                $(newElement).hide()
            }
        }
    }

    function showOutputInSidebar(cell, marker) {
        /* Show this cell's source in the sidebar */

        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
    }

    function initializeOutputVisibility() {
        /* hide any sources of cells with source hidden metadata */

        var cells = Jupyter.notebook.get_cells()
        for ( i=0; i < cells.length; i++ ) {

            if (cells[i].metadata.janus.output_hidden == undefined){
                cells[i].metadata.janus.output_hidden = false
            }

            if (cells[i].metadata.janus.output_hidden) {
                renderOutputMarker(cells[i]);
                cells[i].element.find("div.output").hide();
            }
        }
    };

    return {
        toggleSourceVisibility: toggleSourceVisibility,
        initializeSourceVisibility: initializeSourceVisibility,
        toggleOutputVisibility: toggleOutputVisibility,
        initializeOutputVisibility: initializeOutputVisibility
    };
});
